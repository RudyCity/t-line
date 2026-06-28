import { spawn as spawnProcess, ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

let pty: any = null;
try {
  pty = require('node-pty');
  console.log('Successfully loaded native node-pty for pseudo-terminal support.');

  // Monkeypatch node-pty to prevent AttachConsole errors on Windows when cleaning up terminals.
  if (os.platform() === 'win32') {
    try {
      const windowsPtyAgentPath = require.resolve('node-pty/lib/windowsPtyAgent');
      const { WindowsPtyAgent } = require(windowsPtyAgentPath);
      if (WindowsPtyAgent && WindowsPtyAgent.prototype) {
        const child_process = require('child_process');

        WindowsPtyAgent.prototype._getConsoleProcessList = function () {
          const _this = this;
          return new Promise((resolve) => {
            let resolved = false;
            const safeResolve = (list: number[]) => {
              if (resolved) return;
              resolved = true;
              clearTimeout(timeout);
              resolve(list);
            };

            const agentPath = path.join(
              path.dirname(windowsPtyAgentPath),
              'conpty_console_list_agent'
            );

            const agent = child_process.fork(
              agentPath,
              [_this._innerPid.toString()],
              { silent: true }
            );

            agent.on('message', (message: any) => {
              if (message && message.consoleProcessList) {
                safeResolve(message.consoleProcessList);
              }
            });

            agent.on('exit', () => {
              safeResolve([_this._innerPid]);
            });

            agent.on('error', () => {
              safeResolve([_this._innerPid]);
            });

            const timeout = setTimeout(() => {
              try {
                agent.kill();
              } catch (e) {}
              safeResolve([_this._innerPid]);
            }, 2000);
          });
        };
        console.log('Successfully monkeypatched node-pty conpty_console_list_agent to prevent AttachConsole errors.');
      }
    } catch (e) {
      console.warn('Failed to monkeypatch node-pty console process list helper:', e);
    }
  }
} catch (e) {
  console.warn('Native node-pty not available. Falling back to child_process.spawn.');
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

// ── node-pty based terminal ────────────────────────────────
class PtyTerminal implements ITerminal {
  private ptyProcess: any;

  constructor(shell: string, args: string[], cwd: string, cols: number, rows: number) {
    this.ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: cwd || os.homedir(),
      env: process.env as Record<string, string>,
      useConpty: true
    });
  }

  write(data: string): void { this.ptyProcess.write(data); }

  resize(cols: number, rows: number): void {
    try { this.ptyProcess.resize(cols, rows); } catch (e) {
      console.error('Error resizing pty:', e);
    }
  }

  onData(cb: (data: string) => void): void { this.ptyProcess.onData(cb); }

  onExit(cb: (code: number) => void): void {
    this.ptyProcess.onExit(({ exitCode }: { exitCode: number }) => cb(exitCode));
  }

  kill(): void { this.ptyProcess.kill(); }
  getPid(): number { return this.ptyProcess.pid; }
  getProcessName(): string { return this.ptyProcess.process; }
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
    if (this.child.stdin.writable) { this.child.stdin.write(data); }
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

  kill(): void { this.child.kill(); }
  getPid(): number { return this.pid; }
  getProcessName(): string { return 'Shell'; }
}

// ── Session wrapper ────────────────────────────────────────
const OUTPUT_BUFFER_MAX_LINES = 500;
const OUTPUT_BUFFER_MAX_BYTES = 128 * 1024; // 128 KB

interface TerminalSession {
  terminal: ITerminal;
  sender: ((data: string) => void) | null;
  onExit?: ((code: number) => void) | null;
  cleanupTimeout: NodeJS.Timeout | null;
  isDetached: boolean;
  shellType: string;
  cwd: string;
  /** Rolling output buffer for replay on reconnect */
  outputBufferChunks: string[];
  outputBufferLength: number;
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

    if (isWin) {
      switch (shellType) {
        case 'cmd':
          shell = 'cmd.exe'; args = []; break;
        case 'gitbash':
          shell = this.getGitBashPath(); args = ['--login', '-i']; break;
        case 'wsl':
          shell = 'wsl.exe'; args = []; break;
        case 'powershell':
        default:
          shell = 'powershell.exe'; args = ['-NoLogo']; break;
      }
    } else {
      shell = shellType === 'wsl' ? 'bash' : (shellType === 'cmd' ? 'sh' : 'bash');
      args = [];
    }

    const normalizedCwd = cwd ? path.normalize(cwd) : os.homedir();
    let terminal: ITerminal;
    if (pty) {
      terminal = new PtyTerminal(shell, args, normalizedCwd, cols, rows);
    } else {
      terminal = new SpawnTerminal(shell, args, normalizedCwd);
    }

    this.terminals.set(id, terminal);

    const session: TerminalSession = {
      terminal,
      sender: null,
      cleanupTimeout: null,
      isDetached: false,
      shellType,
      cwd: normalizedCwd,
      outputBufferChunks: [],
      outputBufferLength: 0,
    };
    this.sessions.set(id, session);

    // Stream data → sender + append to output buffer
    terminal.onData((data) => {
      const activeSess = this.sessions.get(id);
      if (!activeSess) return;

      activeSess.outputBufferChunks.push(data);
      activeSess.outputBufferLength += data.length;

      // Trim buffer chunks if they exceed maximum bytes
      while (activeSess.outputBufferLength > OUTPUT_BUFFER_MAX_BYTES && activeSess.outputBufferChunks.length > 0) {
        const removed = activeSess.outputBufferChunks.shift();
        if (removed) {
          activeSess.outputBufferLength -= removed.length;
        }
      }

      if (activeSess.sender) {
        activeSess.sender(data);
      }
    });

    terminal.onExit((code) => {
      const activeSess = this.sessions.get(id);
      if (activeSess) {
        if (activeSess.onExit) activeSess.onExit(code);
        if (activeSess.cleanupTimeout) clearTimeout(activeSess.cleanupTimeout);
        this.sessions.delete(id);
        this.terminals.delete(id);
      }
    });

    return terminal;
  }

  getTerminal(id: string): ITerminal | undefined {
    return this.terminals.get(id);
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

  setSender(id: string, sender: ((data: string) => void) | null, onExit?: ((code: number) => void) | null) {
    const session = this.sessions.get(id);
    if (session) {
      session.sender = sender;
      if (onExit !== undefined) session.onExit = onExit;
      if (sender) {
        if (session.cleanupTimeout) {
          clearTimeout(session.cleanupTimeout);
          session.cleanupTimeout = null;
          console.log(`PTY Session ${id} successfully re-attached to socket.`);
        }
        session.isDetached = false;
      }
    }
  }

  /** Detach session: keep alive for 30s (reduced from 60s) */
  detachSession(id: string) {
    const session = this.sessions.get(id);
    if (session) {
      session.sender = null;
      session.isDetached = true;
      if (session.cleanupTimeout) clearTimeout(session.cleanupTimeout);

      session.cleanupTimeout = setTimeout(() => {
        console.log(`PTY Session ${id} was detached for 30s. Cleaning up terminal process.`);
        this.removeTerminal(id);
      }, 30000); // ← Reduced from 60s to 30s

      console.log(`PTY Session ${id} detached. Keeping alive for 30 seconds.`);
    }
  }

  isSessionPersisted(id: string): boolean {
    const session = this.sessions.get(id);
    return session ? session.isDetached : false;
  }

  removeTerminal(id: string): boolean {
    const session = this.sessions.get(id);
    if (session) {
      if (session.cleanupTimeout) clearTimeout(session.cleanupTimeout);
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
