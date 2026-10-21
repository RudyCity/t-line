import { spawn as spawnProcess, ChildProcessWithoutNullStreams, exec } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { isSSHPath, parseSSHPath } from './sshHelpers';

// Production PTYs use Bun's native Terminal/ConPTY runtime, which works
// under Windows without node-pty's Node-specific native add-on.
const bunRuntime: any = (globalThis as any).Bun;

function killProcessTree(pid: number): void {
  if (!pid) return;
  const isWin = os.platform() === 'win32';
  const cmd = isWin
    ? `taskkill /pid ${pid} /f /t`
    : `pkill -P ${pid} || kill -9 ${pid}`;
  
  exec(cmd, (err) => {
    if (err) {
      try { process.kill(pid, 'SIGKILL'); } catch (e) {}
    }
  });
}

export interface ITerminal {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (code: number) => void): void;
  kill(): void;
  getPid(): number;
  getProcessName(): string;
}

// ── Bun native pseudo-terminal (Windows ConPTY, POSIX openpty) ───────
class BunTerminal implements ITerminal {
  private process: any;
  private decoder = new TextDecoder();
  private dataCallbacks = new Set<(data: string) => void>();
  private exitCallbacks = new Set<(code: number) => void>();
  private initialOutput: string[] = [];
  private initialLength = 0;
  private exitedCode: number | null = null;
  private processName: string;

  constructor(shell: string, args: string[], cwd: string, cols: number, rows: number) {
    if (!bunRuntime?.spawn) {
      throw new Error('Bun runtime with native PTY support is required for interactive terminals');
    }
    this.processName = path.basename(shell);
    this.process = bunRuntime.spawn([shell, ...args], {
      cwd: cwd || os.homedir(),
      env: process.env,
      terminal: {
        cols: Math.max(1, cols || 80),
        rows: Math.max(1, rows || 24),
        name: 'xterm-256color',
        data: (_terminal: unknown, bytes: Uint8Array) => {
          const chunk = this.decoder.decode(bytes, { stream: true });
          if (!chunk) return;
          if (this.dataCallbacks.size === 0) {
            this.initialOutput.push(chunk);
            this.initialLength += chunk.length;
            while (this.initialLength > 256 * 1024 && this.initialOutput.length) {
              this.initialLength -= this.initialOutput.shift()!.length;
            }
          } else {
            for (const callback of this.dataCallbacks) callback(chunk);
          }
        }
      }
    });
    this.process.exited.then((code: number) => {
      this.exitedCode = code;
      const remaining = this.decoder.decode();
      if (remaining) {
        for (const callback of this.dataCallbacks) callback(remaining);
      }
      for (const callback of this.exitCallbacks) callback(code);
      try { this.process.terminal?.close(); } catch { /* already disposed */ }
    }, (error: Error) => {
      console.error('[PTY] Bun terminal process failed:', error);
      this.exitedCode = 1;
      for (const callback of this.exitCallbacks) callback(1);
    });
  }

  write(data: string): void { this.process.terminal?.write(data); }
  resize(cols: number, rows: number): void {
    try { this.process.terminal?.resize(Math.max(1, cols), Math.max(1, rows)); }
    catch (error) { console.error('Error resizing Bun terminal:', error); }
  }
  onData(cb: (data: string) => void): void {
    this.dataCallbacks.add(cb);
    if (this.initialOutput.length) {
      const buffered = this.initialOutput.join('');
      this.initialOutput = [];
      this.initialLength = 0;
      cb(buffered);
    }
  }
  onExit(cb: (code: number) => void): void {
    this.exitCallbacks.add(cb);
    if (this.exitedCode !== null) cb(this.exitedCode);
  }
  kill(): void {
    const pid = this.getPid();
    if (pid) killProcessTree(pid);
    else try { this.process.kill(); } catch { /* process ended */ }
    try { this.process.terminal?.close(); } catch { /* already closed */ }
  }
  getPid(): number { return this.process.pid || 0; }
  getProcessName(): string { return this.processName; }
}

// ── child_process.spawn fallback ──────────────────────────
class SpawnTerminal implements ITerminal {
  private child: ChildProcessWithoutNullStreams;
  private pid: number;

  constructor(shell: string, args: string[], cwd: string) {
    this.child = spawnProcess(shell, args, {
      cwd: cwd || os.homedir(),
      env: process.env,
      shell: true
    });
    this.pid = this.child.pid || 0;
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
  }

  write(data: string): void {
    if (this.child.stdin.writable) {
      // child_process.spawn stdin expects standard newlines (\r\n on Windows, \n on POSIX)
      // instead of carriage returns (\r) used by pty/xterm.
      let normalized = data;
      if (os.platform() === 'win32') {
        normalized = data.replace(/\r(?!\n)/g, '\r\n').replace(/(?<!\r)\n/g, '\r\n');
      } else {
        normalized = data.replace(/\r/g, '\n');
      }
      this.child.stdin.write(normalized);
    }
  }

  resize(cols: number, rows: number): void {
    console.log(`Resize requested: cols=${cols}, rows=${rows} (ignored in fallback mode)`);
  }

  onData(cb: (data: string) => void): void {
    this.child.stdout.on('data', (data) => cb(data.toString()));
    this.child.stderr.on('data', (data) => cb(data.toString()));
  }

  onExit(cb: (code: number) => void): void {
    this.child.on('exit', (code) => cb(code || 0));
  }

  kill(): void {
    const pid = this.getPid();
    if (pid) {
      killProcessTree(pid);
    } else {
      try { this.child.kill(); } catch (e) {}
    }
  }
  getPid(): number { return this.pid; }
  getProcessName(): string { return 'Shell'; }
}

// ── Session wrapper ────────────────────────────────────────
const OUTPUT_BUFFER_MAX_LINES = 200;
const OUTPUT_BUFFER_MAX_BYTES = 256 * 1024; // 256 KB

/**
 * FLUSH_INTERVAL_MS: How often to batch-flush PTY output to the WebSocket sender.
 * 16ms ≈ one 60fps frame. Grouping rapid PTY chunks into one WS message per frame
 * eliminates the blink/flicker caused by xterm.js repainting on every individual write.
 */
const FLUSH_INTERVAL_MS = 16;

interface TerminalSession {
  terminal: ITerminal;
  senders: Map<any, (data: string) => void>;
  onExits: Map<any, (code: number) => void>;
  cleanupTimeout: NodeJS.Timeout | null;
  isDetached: boolean;
  shellType: string;
  cwd: string;
  cols: number;
  rows: number;
  /** Rolling output buffer for replay on reconnect */
  outputBufferChunks: string[];
  outputBufferLength: number;
  /** Batch-flush: accumulate PTY chunks before sending to WS sender */
  pendingFlushChunks: string[];
  flushTimer: NodeJS.Timeout | null;
}


// ── Main Terminal Manager ──────────────────────────────────
export class TerminalManager {
  private terminals = new Map<string, ITerminal>();
  private sessions = new Map<string, TerminalSession>();

  private getGitBashPath(): string {
    const defaultPaths = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\git-bash.exe',
      path.join(os.homedir(), 'AppData\\Local\\Programs\\Git\\bin\\bash.exe')
    ];
    for (const p of defaultPaths) {
      if (fs.existsSync(p)) return p;
    }
    return 'bash.exe';
  }

  createTerminal(id: string, cwd: string, cols: number, rows: number, shellType = 'powershell'): ITerminal {
    const isWin = os.platform() === 'win32';
    let shell = '';
    let args: string[] = [];
    let normalizedCwd = '';

    if (cwd && cwd.startsWith('ssh://')) {
      const ssh = parseSSHPath(cwd);
      if (!ssh) throw new Error('Invalid SSH Path');
      shell = 'ssh';
      args = [
        '-t',
        '-p', ssh.port.toString(),
        '-o', 'StrictHostKeyChecking=accept-new',
        `${ssh.user}@${ssh.host}`,
        '--', 'bash', '-c',
        `cd ${JSON.stringify(ssh.remotePath)} && exec $SHELL -l`
      ];
      normalizedCwd = os.homedir();
    } else {
      if (isWin) {
        // Normalize common aliases so workspace configs that store 'bash'
        // (Git Bash) map correctly instead of falling through to PowerShell.
        const st = (shellType || 'powershell').trim().toLowerCase();
        // Custom absolute path (from frontend "custom:<path>").
        if (st.startsWith('custom:')) {
          shell = shellType!.replace(/^custom:/i, '').trim();
          args = [];
        } else if (st === 'gitbash' || st === 'bash' || st === 'bash.exe' || st === 'git-bash' || st === 'sh') {
          shell = this.getGitBashPath(); args = ['--login', '-i'];
        } else if (st === 'cmd' || st === 'cmd.exe') {
          shell = 'cmd.exe'; args = ['/k'];
        } else if (st === 'wsl') {
          shell = 'wsl.exe'; args = [];
        } else {
          shell = 'powershell.exe'; args = ['-NoLogo'];
        }
      } else {
        const st = (shellType || 'bash').trim().toLowerCase();
        shell = (st === 'wsl' || st === 'bash' || st === 'gitbash' || st === 'sh') ? 'bash' : (st === 'cmd' ? 'sh' : 'bash');
        args = [];
      }
      normalizedCwd = cwd ? path.normalize(cwd) : os.homedir();
    }

    console.log(`[PTY] Spawning PTY terminal: id=${id}, shell=${shell}, args=${JSON.stringify(args)}, cwd=${normalizedCwd}, size=${cols}x${rows}`);

    const terminal: ITerminal = bunRuntime?.spawn
      ? new BunTerminal(shell, args, normalizedCwd, cols, rows)
      : new SpawnTerminal(shell, args, normalizedCwd);

    this.terminals.set(id, terminal);

    const session: TerminalSession = {
      terminal,
      senders: new Map(),
      onExits: new Map(),
      cleanupTimeout: null,
      isDetached: false,
      shellType,
      cwd: cwd || normalizedCwd,
      cols: cols || 80,
      rows: rows || 24,
      outputBufferChunks: [],
      outputBufferLength: 0,
      pendingFlushChunks: [],
      flushTimer: null,
    };
    this.sessions.set(id, session);

    // ── Batch-flush helper ─────────────────────────────────
    // Instead of forwarding each PTY chunk immediately (causing xterm to repaint
    // hundreds of times per second during AI agent streaming), we accumulate
    // chunks and send them as one combined message every FLUSH_INTERVAL_MS.
    const scheduleFlush = () => {
      const activeSess = this.sessions.get(id);
      if (!activeSess || activeSess.flushTimer !== null) return;

      activeSess.flushTimer = setTimeout(() => {
        const sess = this.sessions.get(id);
        if (!sess) return;
        sess.flushTimer = null;
        if (sess.pendingFlushChunks.length === 0) return;

        const combined = sess.pendingFlushChunks.join('');
        sess.pendingFlushChunks = [];

        for (const sender of sess.senders.values()) {
          try {
            sender(combined);
          } catch (e) {
            console.error(`Error sending combined data to sender for terminal ${id}:`, e);
          }
        }
      }, FLUSH_INTERVAL_MS);
    };

    // Stream data → output buffer + schedule batched send
    terminal.onData((data) => {
      const activeSess = this.sessions.get(id);
      if (!activeSess) return;

      // Always append to rolling replay buffer
      activeSess.outputBufferChunks.push(data);
      activeSess.outputBufferLength += data.length;

      // Merge chunks occasionally to prevent array size explosion and trim to max bytes
      if (activeSess.outputBufferChunks.length > 100) {
        let merged = activeSess.outputBufferChunks.join('');
        if (merged.length > OUTPUT_BUFFER_MAX_BYTES) {
          merged = merged.slice(-OUTPUT_BUFFER_MAX_BYTES);
        }
        activeSess.outputBufferChunks = [merged];
        activeSess.outputBufferLength = merged.length;
      }

      // Trim buffer chunks if they exceed maximum bytes
      while (activeSess.outputBufferLength > OUTPUT_BUFFER_MAX_BYTES && activeSess.outputBufferChunks.length > 0) {
        const removed = activeSess.outputBufferChunks.shift();
        if (removed) {
          activeSess.outputBufferLength -= removed.length;
        }
      }

      if (activeSess.senders.size > 0) {
        // If data is very small (typing echo, backspace, arrow keys), bypass batching completely
        // to deliver sub-millisecond response feedback.
        if (data.length <= 5) {
          for (const sender of activeSess.senders.values()) {
            try {
              sender(data);
            } catch (e) {
              console.error(`Error sending fast data to sender for terminal ${id}:`, e);
            } 
          }
          return;
        }

        // For larger outputs (cat, ls, compilation output), use batched flush to avoid UI locking
        activeSess.pendingFlushChunks.push(data);
        scheduleFlush();
      }
    });

    terminal.onExit((code) => {
      console.log(`[PTY] Terminal process exited: id=${id}, code=${code}`);
      const activeSess = this.sessions.get(id);
      if (activeSess) {
        for (const onExit of activeSess.onExits.values()) {
          try {
            onExit(code);
          } catch (e) {
            console.error(`Error calling onExit callback for terminal ${id}:`, e);
          }
        }
        if (activeSess.cleanupTimeout) clearTimeout(activeSess.cleanupTimeout);
        this.sessions.delete(id);
        this.terminals.delete(id);
        activeProcessesCache.delete(activeSess.terminal.getPid());
      }
    });

    return terminal;
  }

  getTerminal(id: string): ITerminal | undefined {
    return this.terminals.get(id);
  }

  resizeTerminal(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id);
    if (session) {
      if (session.cols === cols && session.rows === rows) {
        return false;
      }
      session.cols = cols;
      session.rows = rows;
      try {
        session.terminal.resize(cols, rows);
        return true;
      } catch (e) {
        console.error(`Error resizing terminal ${id}:`, e);
      }
    }
    return false;
  }

  /** Get the output buffer for replay on reconnect */
  getOutputBuffer(id: string): string {
    const session = this.sessions.get(id);
    return session ? session.outputBufferChunks.join('') : '';
  }

  /** Clear output buffer (after replay) */
  clearOutputBuffer(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.outputBufferChunks = [];
      session.outputBufferLength = 0;
    }
  }

  setSender(id: string, key: any, sender: ((data: string) => void) | null, onExit?: ((code: number) => void) | null) {
    const session = this.sessions.get(id);
    if (session) {
      if (sender) {
        session.senders.set(key, sender);
        if (onExit) {
          session.onExits.set(key, onExit);
        }
        if (session.cleanupTimeout) {
          clearTimeout(session.cleanupTimeout);
          session.cleanupTimeout = null;
          console.log(`PTY Session ${id} successfully re-attached to socket.`);
        }
        session.isDetached = false;
      } else {
        session.senders.delete(key);
        session.onExits.delete(key);
        if (session.senders.size === 0) {
          session.isDetached = true;
        }
      }
    }
  }

  /** Detach session: keep alive for 10 minutes */
  detachSession(id: string, key: any) {
    const session = this.sessions.get(id);
    if (session) {
      session.senders.delete(key);
      session.onExits.delete(key);
      
      if (session.senders.size === 0) {
        session.isDetached = true;
        if (session.cleanupTimeout) clearTimeout(session.cleanupTimeout);

        session.cleanupTimeout = setTimeout(() => {
          console.log(`PTY Session ${id} was detached for 10 minutes. Cleaning up terminal process.`);
          this.removeTerminal(id);
        }, 600000);

        console.log(`PTY Session ${id} detached (no active senders). Keeping alive for 10 minutes.`);
      } else {
        console.log(`PTY Session ${id} detached connection, but still has ${session.senders.size} active senders.`);
      }
    }
  }

  isSessionPersisted(id: string): boolean {
    const session = this.sessions.get(id);
    return session ? session.isDetached : false;
  }

  removeTerminal(id: string): boolean {
    console.log(`[PTY] Removing terminal session: id=${id}`);
    const session = this.sessions.get(id);
    if (session) {
      if (session.cleanupTimeout) clearTimeout(session.cleanupTimeout);
      if (session.flushTimer) clearTimeout(session.flushTimer);
      session.pendingFlushChunks = [];
      try { session.terminal.kill(); } catch (e) {
        console.error(`Error killing terminal ${id}:`, e);
      }
      this.sessions.delete(id);
      this.terminals.delete(id);
      return true;
    }
    return false;
  }

  listTerminals() {
    return Array.from(this.sessions.keys()).map(id => ({
      id,
      pid: this.sessions.get(id)?.terminal.getPid(),
      isDetached: this.sessions.get(id)?.isDetached,
      shellType: this.sessions.get(id)?.shellType,
      cwd: this.sessions.get(id)?.cwd
    }));
  }
}

export const terminalManager = new TerminalManager();

export interface ActiveProcessSummary {
  pid: number;
  ppid: number;
  name: string;
  commandLine: string;
  isClaude: boolean;
  isGemini: boolean;
  isCursor: boolean;
  isSuperagent: boolean;
  isAgy: boolean;
  isOpenCode: boolean;
}

function parseWmicCsv(csvContent: string): any[] {
  const cleanContent = csvContent.replace(/\r/g, '');
  const lines = cleanContent.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
  
  const cmdIdx = headers.indexOf('commandline');
  const nameIdx = headers.indexOf('name');
  const ppidIdx = headers.indexOf('parentprocessid');
  const pidIdx = headers.indexOf('processid');

  if (nameIdx === -1 || ppidIdx === -1 || pidIdx === -1) {
    return [];
  }

  const processes: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(currentCell);
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell);

    if (cells.length < headers.length) continue;

    let rebuiltCells = cells;
    if (cells.length > headers.length && cmdIdx !== -1) {
      const leftCount = cmdIdx;
      const rightCount = headers.length - 1 - cmdIdx;
      
      const leftCells = cells.slice(0, leftCount);
      const rightCells = cells.slice(cells.length - rightCount);
      const middleCells = cells.slice(leftCount, cells.length - rightCount);
      
      const commandLineCell = middleCells.join(',');
      rebuiltCells = [...leftCells, commandLineCell, ...rightCells];
    }

    const pid = parseInt(rebuiltCells[pidIdx], 10);
    const ppid = parseInt(rebuiltCells[ppidIdx], 10);
    const name = rebuiltCells[nameIdx] ? rebuiltCells[nameIdx].replace(/^"|"$/g, '').trim() : '';
    const commandLine = cmdIdx !== -1 && rebuiltCells[cmdIdx] ? rebuiltCells[cmdIdx].replace(/^"|"$/g, '').trim() : '';

    if (!isNaN(pid) && !isNaN(ppid)) {
      processes.push({ pid, ppid, name, commandLine });
    }
  }

  return processes;
}

function parsePsOutput(psContent: string): any[] {
  const lines = psContent.split(/\r?\n/);
  const processes: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    
    const pid = parseInt(parts[0], 10);
    const ppid = parseInt(parts[1], 10);
    const name = parts[2];
    const commandLine = parts.slice(3).join(' ');
    
    if (!isNaN(pid) && !isNaN(ppid)) {
      processes.push({ pid, ppid, name, commandLine });
    }
  }
  return processes;
}

function getChildrenForPids(pids: number[]): Promise<any[]> {
  if (pids.length === 0) return Promise.resolve([]);
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const cmd = isWin
      ? `wmic process where "${pids.map(pid => `ParentProcessId=${pid}`).join(' or ')}" get CommandLine,Name,ParentProcessId,ProcessId /FORMAT:csv`
      : `ps -ax -o pid,ppid,comm,command 2>/dev/null || ps -ax -o pid,ppid,comm,args`;

    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (!stdout) {
        resolve([]);
        return;
      }
      try {
        const processes = isWin ? parseWmicCsv(stdout) : parsePsOutput(stdout);
        if (!isWin) {
          // On Unix, since we fetched all processes, filter them here to only children of the pids
          const pidSet = new Set(pids);
          const filtered = processes.filter(p => pidSet.has(p.ppid));
          resolve(filtered);
        } else {
          resolve(processes);
        }
      } catch (e) {
        resolve([]);
      }
    });
  });
}

function getDescendantsForPid(shellPid: number): Promise<any[]> {
  return new Promise((resolve) => {
    const descendants: any[] = [];
    const queue = [shellPid];
    const visited = new Set<number>();

    const next = () => {
      const pidsToQuery = queue.filter(pid => !visited.has(pid));
      if (pidsToQuery.length === 0) {
        resolve(descendants);
        return;
      }
      pidsToQuery.forEach(pid => visited.add(pid));

      getChildrenForPids(pidsToQuery).then((children) => {
        // Remove queried PIDs from queue
        pidsToQuery.forEach(pid => {
          const idx = queue.indexOf(pid);
          if (idx > -1) queue.splice(idx, 1);
        });

        if (children.length > 0) {
          descendants.push(...children);
          children.forEach(child => {
            if (!visited.has(child.pid)) {
              queue.push(child.pid);
            }
          });
        }
        next();
      });
    };

    next();
  });
}

// Cache active processes per shell PID to avoid spamming process checks
const activeProcessesCache = new Map<number, { time: number; data: ActiveProcessSummary[] }>();

export function getActiveProcessesForPid(shellPid: number): Promise<ActiveProcessSummary[]> {
  const now = Date.now();
  const cached = activeProcessesCache.get(shellPid);
  if (cached && now - cached.time < 9000) {
    return Promise.resolve(cached.data);
  }

  return new Promise((resolve) => {
    getDescendantsForPid(shellPid).then((descendants) => {
      try {
        // Filter and map to ActiveProcessSummary
        const summaries: ActiveProcessSummary[] = descendants
          .filter(p => {
            const nameLower = p.name.toLowerCase();
            return nameLower !== 'conhost.exe' && 
                   nameLower !== 'openconsole.exe' && 
                   p.pid !== shellPid;
          })
          .map(p => {
            const cmdLower = p.commandLine.toLowerCase();
            const nameLower = p.name.toLowerCase();
            
            const isClaude = cmdLower.includes('claude') || cmdLower.includes('@anthropic-ai/claude-code');
            const isGemini = cmdLower.includes('gemini') || cmdLower.includes('google/generative-ai');
            const isCursor = cmdLower.includes('cursor') || nameLower.includes('cursor');
            const isSuperagent = cmdLower.includes('superagent') || cmdLower.includes('superagent-cli');
            const isAgy = cmdLower.includes('agy') || nameLower.includes('agy');
            const isOpenCode = cmdLower.includes('opencode') || cmdLower.includes('open-code') || nameLower.includes('opencode') || nameLower.includes('open-code');

            return {
              pid: p.pid,
              ppid: p.ppid,
              name: p.name,
              commandLine: p.commandLine,
              isClaude,
              isGemini,
              isCursor,
              isSuperagent,
              isAgy,
              isOpenCode
            };
          });

        activeProcessesCache.set(shellPid, { time: now, data: summaries });
        resolve(summaries);
      } catch (e) {
        console.error('Error in getActiveProcessesForPid:', e);
        resolve([]);
      }
    });
  });
}

