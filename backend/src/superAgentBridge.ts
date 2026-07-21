import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import WebSocket from 'ws';
import { getInputHistory, saveInputHistory } from './sessionManager';

const AUDIT_FILE = path.join(process.cwd(), 'superagent-audit.ndjson');
const AUDIT_MAX_BYTES = 2 * 1024 * 1024; // 2MB rotate threshold

/**
 * High-frequency event types emitted on every streaming token — not useful in
 * the audit trail and would add huge I/O overhead if logged individually.
 */
const AUDIT_SKIP_INNER_TYPES = new Set([
  'text_delta', 'thought', 'reasoning', 'tool_start', 'tool_progress'
]);

/** Delegates to SuperAgent server-based input history in sessionManager */
export async function getCliPromptHistory(workspace?: string): Promise<string[]> {
  return getInputHistory(workspace || process.cwd());
}

/** Delegates to SuperAgent server-based input history in sessionManager */
export async function saveCliPromptHistory(prompt: string, workspace?: string): Promise<void> {
  await saveInputHistory(workspace || process.cwd(), prompt);
}

/**
 * Append a single NDJSON line to the audit log.
 * This replaces the old read-entire-file → parse → push → stringify-all → write-entire-file
 * pattern which was blocking the Node.js event loop on every streaming token.
 * Rotates by truncating to the last 500 lines when file exceeds AUDIT_MAX_BYTES.
 */
export function logSuperAgentEvent(type: string, data: any) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), type, data }) + '\n';
  fs.appendFile(AUDIT_FILE, entry, 'utf8', (err) => {
    if (err) return;
    fs.stat(AUDIT_FILE, (statErr, stats) => {
      if (!statErr && stats.size > AUDIT_MAX_BYTES) {
        fs.readFile(AUDIT_FILE, 'utf8', (readErr, content) => {
          if (readErr) return;
          const lines = content.split('\n').filter(Boolean);
          fs.writeFile(AUDIT_FILE, lines.slice(-500).join('\n') + '\n', 'utf8', () => {});
        });
      }
    });
  });
}

/**
 * Read audit logs from NDJSON format (one JSON object per line).
 * Falls back gracefully if the file still has the old JSON-array format.
 */
export function getAuditLogs(): any[] {
  if (!fs.existsSync(AUDIT_FILE)) {
    // Try old .json file for backward compatibility during migration
    const oldFile = AUDIT_FILE.replace('.ndjson', '.json');
    if (fs.existsSync(oldFile)) {
      try { return JSON.parse(fs.readFileSync(oldFile, 'utf8') || '[]'); } catch { return []; }
    }
    return [];
  }
  try {
    const content = fs.readFileSync(AUDIT_FILE, 'utf8');
    // Parse NDJSON: each non-empty line is a JSON object
    return content.split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

export function clearAuditLogs() {
  try {
    fs.writeFileSync(AUDIT_FILE, '', 'utf8');
  } catch (e) {
    console.error('[WS-Agent] Failed to clear audit log:', e);
  }
}

let autoSuperAgentProcess: any = null;
let isStartingSuperAgent = false;
let currentWorkspacePath = '';
let currentAgentMode = 'single';
let currentCustomArgs = '';
let cachedBunEnv: { cmd: string; spawnEnv: NodeJS.ProcessEnv } | null = null;

export function forceKillPort7888() {
  try {
    if (os.platform() === 'win32') {
      const out = execSync('netstat -ano | findstr :7888', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const lines = out.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const pidStr = parts[parts.length - 1];
          const pid = parseInt(pidStr, 10);
          if (pid && pid > 0 && pid !== process.pid) {
            execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
          }
        }
      }
    } else {
      execSync('lsof -t -i:7888 | xargs kill -9', { stdio: 'ignore' });
    }
  } catch (e) {}
}

function pingPort7888(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 7888,
      path: '/api/instances',
      method: 'GET',
      timeout: 1500
    }, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/** Callbacks queued while a spawn is in progress. Fired once server is ready or failed. */
let pendingStartCallbacks: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

/**
 * Drain all pending callbacks — call resolve if ok, reject(err) if startup failed.
 */
function drainPendingCallbacks(err?: Error) {
  const cbs = pendingStartCallbacks.splice(0);
  for (const cb of cbs) {
    if (err) cb.reject(err);
    else cb.resolve();
  }
}

/**
 * Resolves the bun executable and returns a spawn-safe { cmd, env } pair.
 *
 * Problem: bun installs to ~/.bun/bin which is in the user's interactive PATH
 * but not necessarily in the PATH inherited by Node child processes.
 * We resolve the absolute path at runtime so spawn always works.
 */
function resolveBunEnv(): { cmd: string; spawnEnv: NodeJS.ProcessEnv } {
  const isWin = os.platform() === 'win32';

  console.log(`[WS-Agent][debug] resolveBunEnv() — platform=${os.platform()}`);
  console.log(`[WS-Agent][debug] process.env.PATH = ${process.env.PATH}`);

  // 1. Try to find bun via where / which (uses inherited PATH)
  try {
    const whereCmd = isWin ? 'where bun 2>nul' : 'which bun 2>/dev/null';
    console.log(`[WS-Agent][debug] Trying: ${whereCmd}`);
    const found = execSync(
      whereCmd,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).split(/\r?\n/)[0].trim();
    console.log(`[WS-Agent][debug] where/which result: "${found}" — exists=${fs.existsSync(found)}`);
    if (found && fs.existsSync(found)) {
      console.log(`[WS-Agent][debug] Resolved bun via PATH: ${found}`);
      return { cmd: found, spawnEnv: { ...process.env } };
    }
  } catch (e: any) {
    console.log(`[WS-Agent][debug] where/which failed: ${e.message}`);
  }

  // 2. Check the default bun install location: ~/.bun/bin/bun[.exe]
  const bunBinDir = path.join(os.homedir(), '.bun', 'bin');
  const bunExe = path.join(bunBinDir, isWin ? 'bun.exe' : 'bun');
  console.log(`[WS-Agent][debug] Checking fallback path: ${bunExe} — exists=${fs.existsSync(bunExe)}`);
  if (fs.existsSync(bunExe)) {
    const sep = isWin ? ';' : ':';
    const patchedPath = `${bunBinDir}${sep}${process.env.PATH || ''}`;
    console.log(`[WS-Agent][debug] Resolved bun via fallback: ${bunExe}`);
    console.log(`[WS-Agent][debug] Patched PATH = ${patchedPath}`);
    return { cmd: bunExe, spawnEnv: { ...process.env, PATH: patchedPath } };
  }

  // 3. Last resort — just use 'bun' and hope the OS can resolve it
  console.warn('[WS-Agent][debug] Could not resolve bun path anywhere. Falling back to plain "bun".');
  return { cmd: 'bun', spawnEnv: { ...process.env } };
}

/** Returns cached bun env; resolves and caches on first call. */
function getCachedBunEnv(): { cmd: string; spawnEnv: NodeJS.ProcessEnv } {
  if (!cachedBunEnv) cachedBunEnv = resolveBunEnv();
  return cachedBunEnv;
}

/**
 * Shared SuperAgent spawn implementation used by both startSuperAgentEager and
 * ensureSuperAgentServer. Eliminates code duplication and provides:
 *  - stdout capture for INSTANT ready detection (no polling delay)
 *  - stderr real-time logging + accumulation for error reporting
 *  - deferred exit check to handle shell-wrapper vs actual process exit
 *  - 500ms poll loop as fallback if the stdout ready marker is missed
 */
function spawnSuperAgentProcess(opts: {
  agentMode: string;
  customArgs: string;
  cwd: string;
  label: string;
  onReady: () => void;
  onFail: (reason: string) => void;
}): void {
  const { agentMode, customArgs, cwd, label, onReady, onFail } = opts;

  const spawnArgs = ['x', 'superagent', '--server', '--client-mode', 'tline'];
  if (agentMode === 'multi') spawnArgs.push('--multi');
  if (customArgs && customArgs.trim()) spawnArgs.push(...customArgs.trim().split(/\s+/));

  const { cmd: bunCmd, spawnEnv } = getCachedBunEnv();
  console.log(`[${label}] Spawning: ${bunCmd} ${spawnArgs.join(' ')} (cwd: ${cwd})`);

  // Sentinel: prevents double-resolve when both stdout marker and poll see ready
  let resolved = false;
  let stderrOutput = '';

  function resolveReady() {
    if (resolved) return;
    resolved = true;
    isStartingSuperAgent = false;
    console.log(`[${label}] SuperAgent server is ready on port 7888.`);
    onReady();
    drainPendingCallbacks();
  }

  function resolveFailure(reason: string) {
    if (resolved) return;
    resolved = true;
    isStartingSuperAgent = false;
    autoSuperAgentProcess = null;
    console.error(`[${label}] Startup failed: ${reason}`);
    onFail(reason);
    drainPendingCallbacks(new Error(reason));
  }

  try {
    autoSuperAgentProcess = spawn(bunCmd, spawnArgs, {
      cwd,
      shell: false,
      detached: false,
      env: spawnEnv,
      stdio: ['ignore', 'pipe', 'pipe']  // capture stdout + stderr
    });

    console.log(`[${label}][debug] PID: ${autoSuperAgentProcess.pid}`);

    // stdout: instant ready detection via server's startup banner
    const READY_MARKER = /running at http/i;
    if (autoSuperAgentProcess.stdout) {
      autoSuperAgentProcess.stdout.setEncoding('utf8');
      autoSuperAgentProcess.stdout.on('data', (chunk: string) => {
        chunk.split(/\r?\n/).filter(Boolean).forEach(l => console.log(`[${label}][stdout] ${l}`));
        if (!resolved && READY_MARKER.test(chunk)) {
          console.log(`[${label}] Ready marker found in stdout.`);
          resolveReady();
        }
      });
    }

    // stderr: log live AND accumulate for error reporting on exit
    if (autoSuperAgentProcess.stderr) {
      autoSuperAgentProcess.stderr.setEncoding('utf8');
      autoSuperAgentProcess.stderr.on('data', (chunk: string) => {
        chunk.split(/\r?\n/).filter(Boolean).forEach(l => console.log(`[${label}][stderr] ${l}`));
        stderrOutput += chunk;
        if (stderrOutput.length > 2000) stderrOutput = stderrOutput.slice(-2000);
      });
    }

    // exit: deferred ping to distinguish real crash vs shell-wrapper early exit
    autoSuperAgentProcess.on('exit', (code: any, signal: any) => {
      console.log(`[${label}] Process exited: code=${code}, signal=${signal}`);
      if (resolved) {
        // Post-startup crash — clear ref so next prompt triggers respawn
        autoSuperAgentProcess = null;
        logSuperAgentEvent('system_error', { message: 'SuperAgent crashed post-startup', code, signal });
        return;
      }
      setTimeout(() => {
        if (resolved) return;
        pingPort7888().then((running) => {
          if (resolved) return;
          if (running) {
            resolveReady();  // shell wrapper exited but server is actually up
          } else {
            const detail = stderrOutput.trim()
              ? `\n${stderrOutput.trim().slice(0, 400)}`
              : ' No error output. Run "bun x superagent --server" to diagnose.';
            resolveFailure(`Process exited with code ${code}.${detail}`);
          }
        });
      }, 2000);
    });

    autoSuperAgentProcess.on('error', (err: any) => {
      console.error(`[${label}] Spawn error:`, err);
      resolveFailure(err.message);
    });

    // poll loop: fallback if stdout ready marker was missed
    const POLL_INTERVAL_MS = 500;
    const MAX_WAIT_MS = 20000;
    const startedAt = Date.now();
    const pollReady = () => {
      if (resolved) return;
      pingPort7888().then((ready) => {
        if (resolved) return;
        const elapsed = Math.round((Date.now() - startedAt) / 100) * 100;
        console.log(`[${label}][debug] ping 7888 → ${ready ? 'UP ✓' : 'not yet'} (${elapsed}ms)`);
        if (ready) {
          resolveReady();
        } else if (Date.now() - startedAt >= MAX_WAIT_MS) {
          resolveFailure('Timed out after 20 seconds. Run "bun x superagent --server" to diagnose.');
        } else {
          setTimeout(pollReady, POLL_INTERVAL_MS);
        }
      });
    };
    setTimeout(pollReady, POLL_INTERVAL_MS);
  } catch (e: any) {
    resolveFailure(e.message);
  }
}

function ensureSuperAgentServer(
  workspacePath: string,
  agentMode: string,
  customArgs: string,
  ws: WebSocket,
  callback: () => void
): void {
  const isWin = os.platform() === 'win32';

  const modeChanged = currentAgentMode !== agentMode;
  const argsChanged = currentCustomArgs !== customArgs;

  if (autoSuperAgentProcess && (modeChanged || argsChanged)) {
    console.log('[WS-Agent] Settings changed (mode/args). Restarting SuperAgent server process...');
    ws.send(JSON.stringify({ type: 'status', text: 'Settings changed. Restarting SuperAgent server...' }));
    try {
      if (isWin) {
        const pid = autoSuperAgentProcess.pid;
        if (pid) execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        autoSuperAgentProcess.kill();
      }
    } catch (e) {
      console.error('[WS-Agent] Failed to kill previous process:', e);
    }
    autoSuperAgentProcess = null;
    isStartingSuperAgent = false;
    drainPendingCallbacks(new Error('SuperAgent server restart requested.'));
  }

  // A spawn is already in flight — queue this callback to be resolved when it finishes
  if (isStartingSuperAgent) {
    ws.send(JSON.stringify({ type: 'status', text: 'SuperAgent server is starting up...' }));
    pendingStartCallbacks.push({
      resolve: callback,
      reject: (err: Error) => {
        ws.send(JSON.stringify({ type: 'status', text: `SuperAgent startup failed: ${err.message}` }));
      }
    });
    return;
  }

  if (autoSuperAgentProcess) {
    if (autoSuperAgentProcess.killed || autoSuperAgentProcess.exitCode !== null) {
      autoSuperAgentProcess = null;
    } else {
      callback();
      return;
    }
  }

  // Mark as starting SYNCHRONOUSLY before the async ping so any concurrent
  // ensureSuperAgentServer / startSuperAgentEager call sees the flag immediately
  // and queues itself instead of racing to spawn a second server.
  isStartingSuperAgent = true;
  console.log('[WS-Agent][debug] ensureSuperAgentServer: acquired startup lock');

  // Before spawning, ping port 7888 — it may already be running externally.
  pingPort7888().then((alreadyRunning) => {
    if (alreadyRunning) {
      console.log('[WS-Agent] SuperAgent server already running on port 7888. Skipping spawn.');
      isStartingSuperAgent = false;
      currentWorkspacePath = workspacePath;
      currentAgentMode = agentMode;
      currentCustomArgs = customArgs;
      callback();
      drainPendingCallbacks();
      return;
    }

    ws.send(JSON.stringify({ type: 'status', text: 'Auto-starting SuperAgent server on port 7888...' }));
    logSuperAgentEvent('system', { message: 'Auto-starting SuperAgent server process', workspacePath, agentMode, customArgs });

    currentWorkspacePath = workspacePath;
    currentAgentMode = agentMode;
    currentCustomArgs = customArgs;

    spawnSuperAgentProcess({
      agentMode,
      customArgs,
      cwd: workspacePath,
      label: 'WS-Agent',
      onReady: () => {
        ws.send(JSON.stringify({ type: 'status', text: `Connected to SuperAgent server (${path.basename(workspacePath)})` }));
        callback();
      },
      onFail: (reason) => {
        ws.send(JSON.stringify({ type: 'status', text: `SuperAgent failed to start: ${reason}` }));
      }
    });
  });
}

/**
 * Eagerly starts the SuperAgent server once at backend startup.
 * No WebSocket required — status messages go to console only.
 * If the server is already running on port 7888, this is a no-op.
 * Subsequent calls from WS handlers will see the server is up and skip spawning.
 */
export function startSuperAgentEager(agentMode: string = 'single', customArgs: string = ''): void {
  // Already running or starting → skip
  if (isStartingSuperAgent || autoSuperAgentProcess) return;

  // Mark as starting SYNCHRONOUSLY before the async ping — same race-prevention
  // as ensureSuperAgentServer above.
  isStartingSuperAgent = true;
  console.log('[WS-Agent][debug] startSuperAgentEager: acquired startup lock');

  pingPort7888().then((alreadyRunning) => {
    if (alreadyRunning) {
      console.log('[WS-Agent] SuperAgent server already running on port 7888 (eager check). Skipping spawn.');
      isStartingSuperAgent = false;
      currentAgentMode = agentMode;
      currentCustomArgs = customArgs;
      drainPendingCallbacks();
      return;
    }

    currentAgentMode = agentMode;
    currentCustomArgs = customArgs;

    spawnSuperAgentProcess({
      agentMode,
      customArgs,
      cwd: process.cwd(),            // backend's own cwd, not a workspace path
      label: 'WS-Agent-Eager',
      onReady: () => {
        logSuperAgentEvent('system', { message: 'Eager SuperAgent server ready' });
      },
      onFail: (reason) => {
        logSuperAgentEvent('system_error', { message: 'Eager SuperAgent startup failed', reason });
      }
    });
  });
}

async function initializeSuperAgentSession(workspacePath: string, mode: string, sessionId?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const initPayload: any = {
      workspace: workspacePath,
      mode: mode === 'multi' ? 'multi' : 'single',
      clientMode: 'tline'
    };
    if (sessionId) {
      initPayload.sessionId = sessionId;
      initPayload.resume = sessionId;
    }
    const postData = JSON.stringify(initPayload);

    const req = http.request({
      hostname: '127.0.0.1',
      port: 7888,
      path: '/api/init',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-workspace-path': workspacePath,
        'x-client-mode': 'tline'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(!!parsed.success);
        } catch {
          resolve(false);
        }
      });
    });

    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}

function sendSuperAgentRequest(pathName: string, payload: any, workspacePath: string, timeoutMs: number = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 7888,
      path: `${pathName}?workspace=${encodeURIComponent(workspacePath)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-workspace-path': workspacePath,
        'x-client-mode': 'tline'
      },
      timeout: timeoutMs
    }, (res) => {
      const statusCode = res.statusCode || 0;
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        // Detect HTML error pages (e.g. proxy 404/502 returning <!doctype html>)
        const trimmed = body.trim().toLowerCase();
        if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
          resolve({ error: `SuperAgent server returned an HTML error page (HTTP ${statusCode}). The server may not be running or the endpoint is unreachable.` });
          return;
        }

        // Non-2xx status code
        if (statusCode < 200 || statusCode >= 300) {
          try {
            const parsed = JSON.parse(body);
            resolve({ error: parsed.error || parsed.message || `SuperAgent server returned HTTP ${statusCode}`, statusCode });
          } catch {
            resolve({ error: `SuperAgent server returned HTTP ${statusCode}: ${body.slice(0, 200)}`, statusCode });
          }
          return;
        }

        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch {
          resolve({ error: `Invalid response from SuperAgent server: ${body.slice(0, 200)}` });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${pathName} timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

export function handleSuperAgentConnection(ws: WebSocket, req: http.IncomingMessage) {
  console.log('[WS-Agent] SuperAgent Client connected');

  const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const workspacePath = parsedUrl.searchParams.get('workspace') || process.cwd();
  const agentMode = parsedUrl.searchParams.get('agentMode') || 'single';
  const customArgs = parsedUrl.searchParams.get('customArgs') || '';

  let sseReq: http.ClientRequest | null = null;
  let connectionAttempts = 0;
  let isClosed = false;

  function connectToSuperAgentSSE() {
    if (isClosed || ws.readyState !== WebSocket.OPEN) return;

    sseReq = http.request({
      hostname: '127.0.0.1',
      port: 7888,
      path: `/api/events?workspace=${encodeURIComponent(workspacePath)}`,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'x-workspace-path': workspacePath
      }
    }, (res) => {
      // Reset connectionAttempts on successful connection
      connectionAttempts = 0;
      ws.send(JSON.stringify({ type: 'status', text: `Connected to SuperAgent server (${path.basename(workspacePath)})` }));
      logSuperAgentEvent('system', { message: 'Connected to local SuperAgent SSE events', workspace: workspacePath });

      // Disable Nagle algorithm on the SSE loopback socket.
      // Without this, TCP buffers small token packets for ~200ms before flushing,
      // adding visible latency to every streaming token sent over 127.0.0.1.
      try { (res.socket as any)?.setNoDelay(true); } catch {}

      res.setEncoding('utf8');
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          // Fast-path: forward raw JSON string directly to WebSocket client
          // without parse → re-stringify round-trip to eliminate CPU overhead
          // on every streaming token.
          ws.send(dataStr);

          // Audit log: parse lazily only for non-noise events to avoid
          // disk I/O on every text_delta / thought / tool_start token.
          try {
            const event = JSON.parse(dataStr);
            const innerType = event?.event?.type as string | undefined;
            const isStreamingNoise = innerType !== undefined && AUDIT_SKIP_INNER_TYPES.has(innerType);
            if (!isStreamingNoise) {
              logSuperAgentEvent('agent_event', event);
            }

            if (process.env.LOG_STREAM_RESPONSE === 'true') {
              if (event.type === 'agent_event' && event.event) {
                const sub = event.event;
                if (sub.type === 'text_delta') {
                  process.stdout.write(sub.text || sub.delta || sub.content || '');
                } else if (sub.type === 'message') {
                  const contentStr = typeof sub.content === 'string' ? sub.content : JSON.stringify(sub.content);
                  console.log(`\n[WS-Agent][Stream Message] [${sub.role || 'assistant'}]: ${contentStr}`);
                } else if (sub.type === 'tool_call') {
                  console.log(`\n[WS-Agent][Stream ToolCall] ${sub.name || sub.tool}: ${JSON.stringify(sub.input || sub.args || {})}`);
                } else if (sub.type === 'tool_result') {
                  console.log(`\n[WS-Agent][Stream ToolResult] ${sub.name || sub.tool}: ${JSON.stringify(sub.result || sub.output || '')}`);
                } else {
                  console.log(`\n[WS-Agent][Stream Event] [${sub.type}]`, JSON.stringify(sub));
                }
              } else {
                console.log(`\n[WS-Agent][Stream Event]`, JSON.stringify(event));
              }
            }
          } catch {}
        }
      });

      res.on('end', () => {
        console.log('[WS-Agent] SuperAgent SSE connection ended by server.');
        if (!isClosed && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'status', text: 'SSE connection ended. Reconnecting...' }));
          setTimeout(connectToSuperAgentSSE, 1000);
        }
      });
    });

    sseReq.on('error', (err: any) => {
      logSuperAgentEvent('system_error', { message: 'Failed to connect to SuperAgent server', error: err.message });
      connectionAttempts++;

      if (connectionAttempts === 1 && !isClosed && ws.readyState === WebSocket.OPEN) {
        ensureSuperAgentServer(workspacePath, agentMode, customArgs, ws, () => {
          connectToSuperAgentSSE();
        });
      } else {
        if (!isClosed && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'status',
            text: 'SuperAgent server not running on port 7888. Retrying connection...'
          }));
          setTimeout(connectToSuperAgentSSE, 2000);
        }
      }
    });

    sseReq.end();
  }

  connectToSuperAgentSSE();

  ws.on('message', async (message: string) => {
    try {
      const parsed = JSON.parse(message);
      const actionType = parsed.type;

      if (actionType === 'prompt') {
        const text = parsed.text || '';
        console.log(`[WS-Agent] Prompt (${workspacePath}): ${text}`);
        logSuperAgentEvent('prompt', { text, workspace: workspacePath });
        await saveCliPromptHistory(text);

        // Ensure SuperAgent server process is running
        await new Promise<void>((resolve) => {
          ensureSuperAgentServer(workspacePath, agentMode, customArgs, ws, resolve);
        });

        try {
          const chatPayload: any = { message: text };
          if (parsed.sessionId) {
            chatPayload.sessionId = parsed.sessionId;
          }

          let response: any;
          try {
            response = await sendSuperAgentRequest('/api/chat', chatPayload, workspacePath);
          } catch (err: any) {
            if (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
              console.log('[WS-Agent] Connection refused on port 7888. Auto-restarting SuperAgent server process...');
              ws.send(JSON.stringify({ type: 'status', text: 'SuperAgent server unreachable. Auto-restarting...' }));
              // Reset process state so ensureSuperAgentServer will respawn
              autoSuperAgentProcess = null;
              isStartingSuperAgent = false;
              // Wait for the server to fully come up before retrying
              await new Promise<void>((resolve) => {
                ensureSuperAgentServer(workspacePath, agentMode, customArgs, ws, resolve);
              });
              // Re-initialize session on the freshly started server
              const initOk = await initializeSuperAgentSession(workspacePath, agentMode, parsed.sessionId);
              if (!initOk) {
                throw new Error('SuperAgent server restarted but session initialization failed.');
              }
              // Retry chat — if it fails again, let the outer catch surface the error
              try {
                response = await sendSuperAgentRequest('/api/chat', chatPayload, workspacePath);
              } catch (retryErr: any) {
                if (retryErr?.code === 'ECONNREFUSED' || retryErr?.message?.includes('ECONNREFUSED')) {
                  throw new Error('SuperAgent server is still unreachable after restart. Please check that "superagent --server" can run in this workspace.');
                }
                throw retryErr;
              }
            } else {
              throw err;
            }
          }

          // Retry once if session wasn't initialized
          if (response && response.error === 'Session not initialized') {
            await initializeSuperAgentSession(workspacePath, agentMode, parsed.sessionId);
            response = await sendSuperAgentRequest('/api/chat', chatPayload, workspacePath);
          }

          // Determine if response indicates an error
          const hasError = response && (response.error || response.raw);
          const errorMsg = response?.error || (response?.raw ? `Unexpected response from server: ${String(response.raw).slice(0, 200)}` : null);

          if (hasError) {
            ws.send(JSON.stringify({ type: 'chat_response', success: false, result: { error: errorMsg } }));
            logSuperAgentEvent('chat_response_error', { error: errorMsg });
          } else {
            ws.send(JSON.stringify({ type: 'chat_response', success: true, result: response }));
            logSuperAgentEvent('chat_response', response);
          }
        } catch (err: any) {
          const errMsg = `Failed to send prompt: ${err.message}`;
          ws.send(JSON.stringify({ type: 'chat_response', success: false, result: { error: errMsg } }));
          logSuperAgentEvent('system_error', { message: 'Failed to send prompt to SuperAgent', error: err.message });
        }
      } else if (actionType === 'approve_permission') {
        const { permissionId, approval } = parsed;
        logSuperAgentEvent('permission_response', { permissionId, approval });
        await sendSuperAgentRequest('/api/approve', { permissionId, approval }, workspacePath);
      } else if (actionType === 'answer_question') {
        const { questionId, answer } = parsed;
        logSuperAgentEvent('question_response', { questionId, answer });
        await sendSuperAgentRequest('/api/answer', { questionId, answer }, workspacePath);
      } else if (actionType === 'approve_plan') {
        const { action } = parsed;
        logSuperAgentEvent('plan_response', { action });
        await sendSuperAgentRequest('/api/plan/approve', { action }, workspacePath);
      } else if (actionType === 'abort') {
        logSuperAgentEvent('abort_request', { workspace: workspacePath });
        try {
          await sendSuperAgentRequest('/api/abort', {}, workspacePath, 2000);
        } catch (err: any) {
          console.log('[WS-Agent] /api/abort request failed or timed out:', err.message);
        }

        ws.send(JSON.stringify({ type: 'status', text: 'Agent execution aborted by user.' }));
        ws.send(JSON.stringify({ type: 'agent_event', event: { type: 'done' } }));
      }
    } catch (e) {
      console.error('[WS-Agent] Error parsing client message:', e);
    }
  });

  ws.on('close', () => {
    console.log('[WS-Agent] Client disconnected');
    isClosed = true;
    if (sseReq) {
      sseReq.destroy();
    }
  });
}

// Clean up child process on exit
process.on('exit', () => {
  if (autoSuperAgentProcess) {
    const isWin = os.platform() === 'win32';
    const pid = autoSuperAgentProcess.pid;
    if (pid) {
      console.log(`[WS-Agent] Cleaning up SuperAgent process (PID: ${pid}) on backend exit...`);
      try {
        if (isWin) {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        } else {
          autoSuperAgentProcess.kill('SIGKILL');
        }
      } catch (e) {
        // Already dead or permission error
      }
    }
    autoSuperAgentProcess = null;
  }
});
