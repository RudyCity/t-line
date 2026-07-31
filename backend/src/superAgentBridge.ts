import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import WebSocket from 'ws';
import { getInputHistory, saveInputHistory } from './sessionManager';
import { loadMergedPresets } from './presetUtils';

const SUPERAGENT_LOG_FILE = path.join(os.homedir(), '.tline-superagent.log');

// Log message to a dedicated file
export function logToSuperAgentFile(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  try {
    // Rotate log file if it exceeds 5MB
    if (fs.existsSync(SUPERAGENT_LOG_FILE) && fs.statSync(SUPERAGENT_LOG_FILE).size > 5 * 1024 * 1024) {
      fs.writeFileSync(SUPERAGENT_LOG_FILE, `[${timestamp}] [INFO] Log file rotated (exceeded 5MB limit)\n`);
    }
    fs.appendFile(SUPERAGENT_LOG_FILE, logLine, () => {});
  } catch (err) {
    // Ignore logging errors
  }
}

// Log once on load
console.log(`[system] SuperAgent process logger initialized. Writing to: ${SUPERAGENT_LOG_FILE}`);
logToSuperAgentFile(`Logger initialized. Log file path: ${SUPERAGENT_LOG_FILE}`);

// Logging helper for SuperAgent events
function logSuperAgentEvent(type: string, data: any) {
  const ts = new Date().toISOString();
  const msg = `[SA:${type}] ${JSON.stringify(data).slice(0, 500)}`;
  console.log(`[SA:${type}] ${ts}`, JSON.stringify(data).slice(0, 500));
  logToSuperAgentFile(msg);
}

/** Delegates to SuperAgent server-based input history in sessionManager */
export async function getCliPromptHistory(workspace?: string): Promise<string[]> {
  return getInputHistory(workspace || process.cwd());
}

/** Delegates to SuperAgent server-based input history in sessionManager */
export async function saveCliPromptHistory(prompt: string, workspace?: string): Promise<void> {
  await saveInputHistory(workspace || process.cwd(), prompt);
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

  const msgPlatform = `resolveBunEnv() — platform=${os.platform()}`;
  console.log(`[WS-Agent][debug] ${msgPlatform}`);
  logToSuperAgentFile(`[debug] ${msgPlatform}`);

  const msgPath = `process.env.PATH = ${process.env.PATH}`;
  console.log(`[WS-Agent][debug] ${msgPath}`);
  logToSuperAgentFile(`[debug] ${msgPath}`);

  // 1. Try to find bun via where / which (uses inherited PATH)
  try {
    const whereCmd = isWin ? 'where bun 2>nul' : 'which bun 2>/dev/null';
    console.log(`[WS-Agent][debug] Trying: ${whereCmd}`);
    logToSuperAgentFile(`[debug] Trying: ${whereCmd}`);

    const found = execSync(
      whereCmd,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).split(/\r?\n/)[0].trim();

    const msgResult = `where/which result: "${found}" — exists=${fs.existsSync(found)}`;
    console.log(`[WS-Agent][debug] ${msgResult}`);
    logToSuperAgentFile(`[debug] ${msgResult}`);

    if (found && fs.existsSync(found)) {
      const msgResolved = `Resolved bun via PATH: ${found}`;
      console.log(`[WS-Agent][debug] ${msgResolved}`);
      logToSuperAgentFile(`[debug] ${msgResolved}`);
      return { cmd: found, spawnEnv: { ...process.env } };
    }
  } catch (e: any) {
    const msgFailed = `where/which failed: ${e.message}`;
    console.log(`[WS-Agent][debug] ${msgFailed}`);
    logToSuperAgentFile(`[debug] ${msgFailed}`);
  }

  // 2. Check the default bun install location: ~/.bun/bin/bun[.exe]
  const bunBinDir = path.join(os.homedir(), '.bun', 'bin');
  const bunExe = path.join(bunBinDir, isWin ? 'bun.exe' : 'bun');
  const msgChecking = `Checking fallback path: ${bunExe} — exists=${fs.existsSync(bunExe)}`;
  console.log(`[WS-Agent][debug] ${msgChecking}`);
  logToSuperAgentFile(`[debug] ${msgChecking}`);

  if (fs.existsSync(bunExe)) {
    const sep = isWin ? ';' : ':';
    const patchedPath = `${bunBinDir}${sep}${process.env.PATH || ''}`;
    const msgFallback = `Resolved bun via fallback: ${bunExe}`;
    console.log(`[WS-Agent][debug] ${msgFallback}`);
    logToSuperAgentFile(`[debug] ${msgFallback}`);

    const msgPatchedPath = `Patched PATH = ${patchedPath}`;
    console.log(`[WS-Agent][debug] ${msgPatchedPath}`);
    logToSuperAgentFile(`[debug] ${msgPatchedPath}`);

    return { cmd: bunExe, spawnEnv: { ...process.env, PATH: patchedPath } };
  }

  // 3. Last resort — just use 'bun' and hope the OS can resolve it
  const msgLastResort = 'Could not resolve bun path anywhere. Falling back to plain "bun".';
  console.warn(`[WS-Agent][debug] ${msgLastResort}`);
  logToSuperAgentFile(`[warn] ${msgLastResort}`);
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
  const msgSpawning = `Spawning: ${bunCmd} ${spawnArgs.join(' ')} (cwd: ${cwd})`;
  console.log(`[${label}] ${msgSpawning}`);
  logToSuperAgentFile(`[${label}] ${msgSpawning}`);

  // Sentinel: prevents double-resolve when both stdout marker and poll see ready
  let resolved = false;
  let stderrOutput = '';

  function resolveReady() {
    if (resolved) return;
    resolved = true;
    isStartingSuperAgent = false;
    const msgReady = `SuperAgent server is ready on port 7888.`;
    console.log(`[${label}] ${msgReady}`);
    logToSuperAgentFile(`[${label}] ${msgReady}`);
    onReady();
    drainPendingCallbacks();
  }

  function resolveFailure(reason: string) {
    if (resolved) return;
    resolved = true;
    isStartingSuperAgent = false;
    autoSuperAgentProcess = null;
    const msgFailed = `Startup failed: ${reason}`;
    console.error(`[${label}] ${msgFailed}`);
    logToSuperAgentFile(`[${label}] ${msgFailed}`);
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

    const msgPid = `PID: ${autoSuperAgentProcess.pid}`;
    console.log(`[${label}][debug] ${msgPid}`);
    logToSuperAgentFile(`[${label}][debug] ${msgPid}`);

    // stdout: instant ready detection via server's startup banner
    const READY_MARKER = /running at http/i;
    if (autoSuperAgentProcess.stdout) {
      autoSuperAgentProcess.stdout.setEncoding('utf8');
      autoSuperAgentProcess.stdout.on('data', (chunk: string) => {
        chunk.split(/\r?\n/).filter(Boolean).forEach(l => {
          console.log(`[${label}][stdout] ${l}`);
          logToSuperAgentFile(`[${label}][stdout] ${l}`);
        });
        if (!resolved && READY_MARKER.test(chunk)) {
          const msgMarker = `Ready marker found in stdout.`;
          console.log(`[${label}] ${msgMarker}`);
          logToSuperAgentFile(`[${label}] ${msgMarker}`);
          resolveReady();
        }
      });
    }

    // stderr: log live AND accumulate for error reporting on exit
    if (autoSuperAgentProcess.stderr) {
      autoSuperAgentProcess.stderr.setEncoding('utf8');
      autoSuperAgentProcess.stderr.on('data', (chunk: string) => {
        chunk.split(/\r?\n/).filter(Boolean).forEach(l => {
          console.log(`[${label}][stderr] ${l}`);
          logToSuperAgentFile(`[${label}][stderr] ${l}`);
        });
        stderrOutput += chunk;
        if (stderrOutput.length > 2000) stderrOutput = stderrOutput.slice(-2000);
      });
    }

    // exit: deferred ping to distinguish real crash vs shell-wrapper early exit
    autoSuperAgentProcess.on('exit', (code: any, signal: any) => {
      const msgExit = `Process exited: code=${code}, signal=${signal}`;
      console.log(`[${label}] ${msgExit}`);
      logToSuperAgentFile(`[${label}] ${msgExit}`);
      if (resolved) {
        // Post-startup crash — clear ref so next prompt triggers respawn
        autoSuperAgentProcess = null;
        return;
      }
      setTimeout(() => {
        if (resolved) return;
        pingPort7888().then((running) => {
          if (resolved) return;
          if (running) {
            logToSuperAgentFile(`[${label}] Server is running on port 7888 after shell wrapper exited.`);
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
      logToSuperAgentFile(`[${label}][error] Spawn error: ${err.message}`);
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
        const msgPing = `ping 7888 → ${ready ? 'UP ✓' : 'not yet'} (${elapsed}ms)`;
        console.log(`[${label}][debug] ${msgPing}`);
        logToSuperAgentFile(`[${label}][debug] ${msgPing}`);
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
    const msgRestart = 'Settings changed (mode/args). Restarting SuperAgent server process...';
    console.log(`[WS-Agent] ${msgRestart}`);
    logToSuperAgentFile(`[WS-Agent] ${msgRestart}`);
    ws.send(JSON.stringify({ type: 'status', text: 'Settings changed. Restarting SuperAgent server...' }));
    try {
      if (isWin) {
        const pid = autoSuperAgentProcess.pid;
        if (pid) {
          logToSuperAgentFile(`[WS-Agent] Killing process PID ${pid} via taskkill`);
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        }
      } else {
        logToSuperAgentFile(`[WS-Agent] Killing process PID ${autoSuperAgentProcess.pid} via kill()`);
        autoSuperAgentProcess.kill();
      }
    } catch (e: any) {
      const msgKillFailed = `Failed to kill previous process: ${e.message}`;
      console.error(`[WS-Agent] ${msgKillFailed}`);
      logToSuperAgentFile(`[WS-Agent][error] ${msgKillFailed}`);
    }
    autoSuperAgentProcess = null;
    isStartingSuperAgent = false;
    drainPendingCallbacks(new Error('SuperAgent server restart requested.'));
  }

  // A spawn is already in flight — queue this callback to be resolved when it finishes
  if (isStartingSuperAgent) {
    logToSuperAgentFile('[WS-Agent] SuperAgent server startup already in flight. Queuing callback.');
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
      const msgAlready = 'SuperAgent server already running on port 7888. Skipping spawn.';
      console.log(`[WS-Agent] ${msgAlready}`);
      logToSuperAgentFile(`[WS-Agent] ${msgAlready}`);
      isStartingSuperAgent = false;
      currentWorkspacePath = workspacePath;
      currentAgentMode = agentMode;
      currentCustomArgs = customArgs;
      callback();
      drainPendingCallbacks();
      return;
    }

    ws.send(JSON.stringify({ type: 'status', text: 'Auto-starting SuperAgent server on port 7888...' }));

    currentWorkspacePath = workspacePath;
    currentAgentMode = agentMode;
    currentCustomArgs = customArgs;

    const resolvedCwd = (workspacePath.startsWith('ssh:') || workspacePath.startsWith('ssh://') || workspacePath.startsWith('chain:'))
      ? process.cwd()
      : workspacePath;

    spawnSuperAgentProcess({
      agentMode,
      customArgs,
      cwd: resolvedCwd,
      label: 'WS-Agent',
      onReady: () => {
        const workspaceLabel = workspacePath.startsWith('ssh:') || workspacePath.startsWith('chain:') 
          ? workspacePath 
          : path.basename(workspacePath);
        ws.send(JSON.stringify({ type: 'status', text: `Connected to SuperAgent server (${workspaceLabel})` }));
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
      const msgEager = 'SuperAgent server already running on port 7888 (eager check). Skipping spawn.';
      console.log(`[WS-Agent] ${msgEager}`);
      logToSuperAgentFile(`[WS-Agent] ${msgEager}`);
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

export function sendSuperAgentRequest(pathName: string, payload: any, workspacePath: string, timeoutMs: number = 30000): Promise<any> {
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
  const initialSessionId = parsedUrl.searchParams.get('sessionId') || undefined;

  let sseReq: http.ClientRequest | null = null;
  let connectionAttempts = 0;
  let isClosed = false;

  function connectToSuperAgentSSE() {
    if (isClosed || ws.readyState !== WebSocket.OPEN) return;
    if (sseReq) {
      try { sseReq.destroy(); } catch {}
      sseReq = null;
    }

    const ssePath = `/api/events?workspace=${encodeURIComponent(workspacePath)}${initialSessionId ? `&sessionId=${encodeURIComponent(initialSessionId)}` : ''}`;

    sseReq = http.request({
      hostname: '127.0.0.1',
      port: 7888,
      path: ssePath,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'x-workspace-path': workspacePath
      }
    }, (res) => {
      // Reset connectionAttempts on successful connection
      connectionAttempts = 0;
      ws.send(JSON.stringify({ type: 'status', text: `Connected to SuperAgent server (${path.basename(workspacePath)})` }));

      // Disable Nagle algorithm on the SSE loopback socket.
      // Without this, TCP buffers small token packets for ~200ms before flushing,
      // adding visible latency to every streaming token sent over 127.0.0.1.
      try { (res.socket as any)?.setNoDelay(true); } catch {}

      res.setEncoding('utf8');
      let buffer = '';
      res.on('data', (chunk) => {
        console.log(`[BRIDGE DEBUG] Received chunk at ${new Date().toISOString()}, length: ${chunk.length}`);
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

          if (process.env.LOG_STREAM_RESPONSE === 'true') {
            try {
              const event = JSON.parse(dataStr);
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
            } catch {}
          }
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

  // Eagerly initialize SuperAgent session on WS connection so first prompt won't fail
  initializeSuperAgentSession(workspacePath, agentMode, initialSessionId).catch((err) => {
    console.warn('[WS-Agent] Eager session init warning:', err?.message || err);
  });

  ws.on('message', async (message: string) => {
    try {
      const parsed = JSON.parse(message);
      const actionType = parsed.type;

      if (actionType === 'prompt') {
        const text = parsed.text || '';
        const msgPrompt = `Prompt (${workspacePath}): ${text}`;
        console.log(`[WS-Agent] ${msgPrompt}`);
        logToSuperAgentFile(`[WS-Agent] ${msgPrompt}`);
        logSuperAgentEvent('prompt', { text, workspace: workspacePath });
        await saveCliPromptHistory(text);

        // Ensure SuperAgent server process is running
        await new Promise<void>((resolve) => {
          ensureSuperAgentServer(workspacePath, agentMode, customArgs, ws, resolve);
        });

        // Validate active preset is configured before sending prompt
        try {
          const configSnapshot = await loadMergedPresets();
          const modeKey: 'single' | 'multi' = agentMode === 'multi' ? 'multi' : 'single';
          const activePresetId = configSnapshot.activePresetId?.[modeKey];
          const activePresetsList = configSnapshot.presets?.[modeKey] || [];
          const hasActivePreset = Boolean(
            activePresetId &&
            activePresetsList.some((p: any) => p.id?.toLowerCase() === activePresetId.toLowerCase() || p.name?.toLowerCase() === activePresetId.toLowerCase())
          );
          if (!hasActivePreset) {
            const errMsg = `No active model preset selected for ${agentMode} mode. Please select an active preset.`;
            ws.send(JSON.stringify({ type: 'chat_response', success: false, result: { error: errMsg } }));
            logSuperAgentEvent('chat_response_error', { error: errMsg });
            return;
          }
        } catch (presetCheckErr: any) {
          console.warn('[WS-Agent] Active preset check warning:', presetCheckErr?.message);
        }

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
      const msgCleanup = `Cleaning up SuperAgent process (PID: ${pid}) on backend exit...`;
      console.log(`[WS-Agent] ${msgCleanup}`);
      logToSuperAgentFile(`[WS-Agent] ${msgCleanup}`);
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
