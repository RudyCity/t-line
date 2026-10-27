import { resolveSuperAgentCorePort } from './superAgentCorePort';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import WebSocket from 'ws';
import { getInputHistory, saveInputHistory } from './sessionManager';
import { loadMergedPresets } from './presetUtils';
import { rotateAllKnownLogs } from './logRotation';
import { getSuperAgentServiceHeaders } from './superAgentAuth';
import { selectSuperAgentLaunch } from './superAgentRuntime';
import { probeSuperAgentPort } from './superAgentPortProbe';
import { classifyCoreReconnect, isExplicitResumeRequest } from './coreReconnectSafety';
import { SseStreamParser } from './superAgentSseParser';
import {
  SessionLifecycleManager,
  buildCoreSsePath,
  type CoreInitResponse
} from './superAgentSessionLifecycle';
import {
  validateAndSanitizeMultimodalInput,
} from './superAgentMultimodal';

const SUPERAGENT_LOG_FILE = path.join(os.homedir(), '.tline-superagent.log');

// Bound on-disk log size at module init. Without this, the per-process log
// files in the user's home directory can grow to hundreds of MB over weeks
// of use. See backend/src/logRotation.ts for the rotation strategy.
rotateAllKnownLogs();

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

/** Legacy force-kill is permanently disabled. No PID is trusted by its port. */
export function forceKillPort7888(): never {
  throw new Error('Unsafe port-owner termination is disabled. Use a verified Core supervisor drain or explicit maintenance.');
}

function pingPort7888(): Promise<boolean> {
  return probeSuperAgentPort(resolveSuperAgentCorePort()).then(state => state === 'compatible');
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
  // Installed T-Line ships its own Bun binary. Reuse this exact executable
  // when launching SuperAgent, even on PCs with no global Bun or Node.
  const bundled = process.env.TLINE_BUN_RUNTIME
    || ((process.versions as any).bun ? process.execPath : '');
  if (bundled && fs.existsSync(bundled)) {
    const dir = path.dirname(bundled);
    const patchedPath = dir + path.delimiter + (process.env.PATH || '');
    return { cmd: bundled, spawnEnv: {
      ...process.env, PATH: patchedPath, TLINE_BUN_RUNTIME: bundled
    } };
  }

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

  let launch;
  try {
    const extraArgs = customArgs && customArgs.trim() ? customArgs.trim().split(/\s+/) : [];
    launch = selectSuperAgentLaunch(process.env.TLINE_SUPERAGENT_SOURCE_DIR, agentMode, extraArgs);
  } catch (error: any) {
    isStartingSuperAgent = false;
    autoSuperAgentProcess = null;
    const message = String(error?.message || error);
    onFail(message);
    drainPendingCallbacks(new Error(message));
    return;
  }
  // Child processes inherit the backend identity. Require a matching Windows
  // token and a genuine EACCES/EPERM probe before spawning in strict mode.
  if (process.env.SUPERAGENT_REQUIRE_OS_SANDBOX === '1') {
    let problem = '';
    try {
      const expected = process.env.SUPERAGENT_OS_RUNNER_IDENTITY?.trim();
      const probe = process.env.SUPERAGENT_OS_DENIED_PROBE_PATH?.trim();
      if (process.platform !== 'win32' || !expected || !probe) throw new Error('Windows runner identity and denied probe are required');
      const actual = execSync('whoami.exe', { encoding: 'utf8', timeout: 3000 }).trim();
      if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error('T-Line backend identity does not match configured runner');
      try {
        const fd = fs.openSync(probe, 'r');
        fs.closeSync(fd);
        throw new Error('Denied probe was readable');
      } catch (error: any) {
        if (error?.code !== 'EACCES' && error?.code !== 'EPERM') throw error;
      }
    } catch (error: any) { problem = String(error?.message || error); }
    if (problem) {
      const reason = 'OS isolation verification failed: ' + problem;
      isStartingSuperAgent = false;
      autoSuperAgentProcess = null;
      onFail(reason);
      drainPendingCallbacks(new Error(reason));
      return;
    }
  }
  const spawnArgs = launch.args;
  const { cmd: bunCmd, spawnEnv } = getCachedBunEnv();
  logToSuperAgentFile(`[Runtime] Selected ${launch.runtime} ${launch.version || 'version not yet verified'}`);
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
          // A child can print a ready banner without serving an authenticated
          // SuperAgent protocol. Trust only the verified loopback probe.
          probeSuperAgentPort(resolveSuperAgentCorePort()).then(portState => {
            if (portState === 'compatible') resolveReady();
            else logToSuperAgentFile(
              `[${label}] Ignored stdout ready marker: authenticated probe = ${portState}`
            );
          }).catch(error => {
            logToSuperAgentFile(`[${label}] Ready probe failed: ${String(error)}`);
          });
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
  // Execution mode belongs to the /api/init session, not this shared listener.
  // Never terminate the core process (or other sessions/agents) on mode changes.
  // Custom startup flags remain pinned until an explicit supervised restart.
  if (autoSuperAgentProcess && currentCustomArgs !== customArgs) {
    ws.send(JSON.stringify({
      type: 'status',
      text: 'Startup flags have not changed on the running shared server. Use supervised core restart to apply them.'
    }));
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
  probeSuperAgentPort(resolveSuperAgentCorePort()).then((portState) => {
    if (portState === 'free' && resolveSuperAgentCorePort() !== 7888) {
      const message = 'Configured external Core is offline. Refusing to auto-start or take over a different port.';
      isStartingSuperAgent = false;
      ws.send(JSON.stringify({ type: 'status', text: message }));
      drainPendingCallbacks(new Error(message));
      return;
    }
    if (portState === 'occupied') {
      const message = 'Port 7888 is occupied by an unverified or unauthorized HTTP service. Refusing to launch or terminate a process.';
      logToSuperAgentFile('[WS-Agent] ' + message);
      isStartingSuperAgent = false;
      ws.send(JSON.stringify({ type: 'status', text: message }));
      drainPendingCallbacks(new Error(message));
      return;
    }
    if (portState === 'compatible') {
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

  probeSuperAgentPort(resolveSuperAgentCorePort()).then((portState) => {
    if (portState === 'free' && resolveSuperAgentCorePort() !== 7888) {
      isStartingSuperAgent = false;
      drainPendingCallbacks(new Error('Configured external Core is offline. No automatic takeover on a non-default port.'));
      return;
    }
    if (portState === 'occupied') {
      const message = 'Port 7888 is occupied by an unverified/unauthorized service. Eager startup refused; no process terminated.';
      logToSuperAgentFile('[WS-Agent-Eager] ' + message);
      isStartingSuperAgent = false;
      drainPendingCallbacks(new Error(message));
      return;
    }
    if (portState === 'compatible') {
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

async function initializeSuperAgentSession(workspacePath: string, mode: string, sessionId?: string): Promise<CoreInitResponse> {
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
      port: resolveSuperAgentCorePort(),
      path: '/api/init',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-workspace-path': workspacePath,
        'x-client-mode': 'tline',
        ...getSuperAgentServiceHeaders()
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ ...parsed, statusCode: res.statusCode });
        } catch {
          resolve({ success: false, statusCode: res.statusCode, error: 'Malformed init response' });
        }
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err?.message || String(err) }));
    req.write(postData);
    req.end();
  });
}

export function sendSuperAgentRequest(pathName: string, payload: any, workspacePath: string, timeoutMs: number = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: resolveSuperAgentCorePort(),
      path: `${pathName}?workspace=${encodeURIComponent(workspacePath)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-workspace-path': workspacePath,
        'x-client-mode': 'tline',
        ...(typeof payload?.sessionId === 'string' ? { 'x-session-id': payload.sessionId } : {}),
        ...getSuperAgentServiceHeaders()
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
            resolve({ error: parsed.error || parsed.message || `SuperAgent server returned HTTP ${statusCode}`,
              statusCode, code: typeof parsed.code === 'string' ? parsed.code : undefined,
              requiresExplicitResume: parsed.requiresExplicitResume === true,
              automaticChatReplayAllowed: false });
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

// Read-only health query for one already-bound session. This never uses chat or
// init and never changes Core owner/session affinity.
async function readCoreSessionForReconnect(sessionId: string, workspacePath: string):
    Promise<{ statusCode: number; code?: string }> {
  return new Promise(resolve => {
    const pathName = '/api/status?sessionId=' + encodeURIComponent(sessionId) +
      '&workspace=' + encodeURIComponent(workspacePath);
    const request = http.request({
      host: '127.0.0.1', port: resolveSuperAgentCorePort(), method: 'GET', path: pathName,
      timeout: 2200, headers: {
        'x-client-mode': 'tline', 'x-workspace-path': workspacePath,
        ...getSuperAgentServiceHeaders()
      },
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 4096) request.destroy();
      });
      response.once('end', () => {
        let code: string | undefined;
        try { const data = JSON.parse(body); if (typeof data?.code === 'string') code = data.code; }
        catch {}
        resolve({ statusCode: response.statusCode || 0, code });
      });
    });
    request.once('timeout', () => request.destroy());
    request.once('error', () => resolve({ statusCode: 0 }));
    request.end();
  });
}

export function handleSuperAgentConnection(ws: WebSocket, req: http.IncomingMessage) {
  console.log('[WS-Agent] SuperAgent Client connected');

  const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const workspacePath = parsedUrl.searchParams.get('workspace') || process.cwd();
  const agentMode = parsedUrl.searchParams.get('agentMode') || 'single';
  const customArgs = parsedUrl.searchParams.get('customArgs') || '';
  const initialSessionId = parsedUrl.searchParams.get('sessionId') || undefined;

  const lifecycleManager = new SessionLifecycleManager(
    initialSessionId || 'default',
    workspacePath,
    (msg: string) => {
      if (!isClosed && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  );

  let sseReq: http.ClientRequest | null = null;
  // Track all SSE handles opened for this WS client so a single disconnect
  // can deterministically destroy every outstanding request. Without this,
  // orphaned http.ClientRequests can hold sockets + parser state past WS close.
  const activeSseReqs = new Set<http.ClientRequest>();
  let sseReconnectTimeout: NodeJS.Timeout | null = null;
let sseReconnectAttempts = 0;
const SSE_EVENT_BUFFER_LIMIT = 200;
const SSE_EVENT_BUFFER_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const sseEventBuffer: Array<{ id: number; payload: string }> = [];
let sseEventBufferBytes = 0;
let sseEventCounter = 0;
let lastSseEventIdRef = 0;
let replayCursor = 0;
let suppressBufferWrite = false;
  let connectionAttempts = 0;
  let isClosed = false;
  let sseConnected = false;

  function scheduleSseRetry() {
    if (isClosed || ws.readyState !== WebSocket.OPEN) return;
    // A long outage must not permanently disable the read-only SSE channel.
    // Exponential backoff is capped to prevent request storms.
    sseReconnectAttempts = Math.min(sseReconnectAttempts + 1, 32);
    const delay = Math.min(30000, 500 * (2 ** Math.min(sseReconnectAttempts - 1, 6)));
    if (sseReconnectTimeout) clearTimeout(sseReconnectTimeout);
    sseReconnectTimeout = setTimeout(connectToSuperAgentSSE, delay);
  }

  function connectToSuperAgentSSE() {
    if (isClosed || ws.readyState !== WebSocket.OPEN) return;
    sseConnected = false;
    if (sseReconnectTimeout) {
      clearTimeout(sseReconnectTimeout);
      sseReconnectTimeout = null;
    }
    if (sseReq) {
      try { sseReq.destroy(); } catch {}
      activeSseReqs.delete(sseReq);
      sseReq = null;
    }
    const lastBufferedEventId = lastSseEventIdRef;
    const replayEventId = replayCursor;

    const ssePath = buildCoreSsePath(workspacePath, initialSessionId);

    sseReq = http.request({
      hostname: '127.0.0.1',
      port: resolveSuperAgentCorePort(),
      path: ssePath,

      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'x-workspace-path': workspacePath,
        ...getSuperAgentServiceHeaders()

      }
    }, (res) => {
      if (res.statusCode !== 200) {
        // Never label an HTTP 503 (including dead-session routing) as a
        // successful SSE connection. Preserve the explicit-resume decision.
        let errorBody = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          errorBody += chunk;
          if (errorBody.length > 4096) res.destroy();
        });
        res.once('end', () => {
          let upstreamCode: string | undefined;
          try {
            const parsed = JSON.parse(errorBody);
            if (typeof parsed.code === 'string') upstreamCode = parsed.code;
          } catch {}
          const initializing = (res.statusCode === 400 || res.statusCode === 404) &&
            (/session not initialized/i.test(errorBody) || /session does not exist/i.test(errorBody));
          if (initialSessionId && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(classifyCoreReconnect({
              sessionId: initialSessionId,
              statusCode: initializing ? 503 : (res.statusCode || 0),
              upstreamCode: initializing ? 'CORE_SUPERVISOR_UNAVAILABLE' : upstreamCode,
            })));
          }
          // Initial SSE may race with the one eager init performed for a new
          // session. Retrying GET is safe; sending the prompt again is not.
          if ((res.statusCode === 503 || res.statusCode === 404 || initializing) &&
              upstreamCode !== 'SESSION_WORKER_DEAD' &&
              upstreamCode !== 'SESSION_OWNER_UNAVAILABLE') scheduleSseRetry();
        });
        return;
      }
      // Only a verified HTTP 200 stream resets the bounded SSE retry budget.
      sseConnected = true;
      connectionAttempts = 0;
      sseReconnectAttempts = 0;
      ws.send(JSON.stringify({ type: 'status', text: `Connected to SuperAgent server (${path.basename(workspacePath)})` }));
      lifecycleManager.markSseSubscribed(200);

      // Disable Nagle algorithm on the SSE loopback socket.
      try { (res.socket as any)?.setNoDelay(true); } catch {}

      res.setEncoding('utf8');
      // SSE frame parser conforms to WHATWG SSE specification
      const parser = new SseStreamParser((msg) => {
        if (msg.id) {
          lifecycleManager.recordCoreEventId(msg.id);
        }
        const dataStr = msg.data.trim();
        if (!dataStr || dataStr === '[DONE]') return;

        ws.send(dataStr);

        if (!suppressBufferWrite) {
          sseEventCounter += 1;
          lastSseEventIdRef = sseEventCounter;
          sseEventBuffer.push({ id: sseEventCounter, payload: dataStr });
          sseEventBufferBytes += Buffer.byteLength(dataStr, 'utf8');
          if (
            sseEventBuffer.length > SSE_EVENT_BUFFER_LIMIT ||
            sseEventBufferBytes > SSE_EVENT_BUFFER_MAX_BYTES
          ) {
            const dropN = Math.max(1, Math.floor(sseEventBuffer.length * 0.1));
            const dropped = sseEventBuffer.splice(0, dropN);
            for (const evt of dropped) {
              sseEventBufferBytes -= Buffer.byteLength(evt.payload, 'utf8');
            }
          }
        }

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
      });
      // After successful reconnect, replay any events buffered while disconnected.
      // Only replay once per reconnect cycle.
      suppressBufferWrite = false;
      if (replayEventId > 0 && replayEventId < lastSseEventIdRef) {
        const missed = sseEventBuffer.filter((e) => e.id > replayEventId);
        for (const evt of missed) {
          try { ws.send(evt.payload); } catch { /* ws closed mid-replay */ }
        }
        replayCursor = lastSseEventIdRef;
      } else {
        replayCursor = lastSseEventIdRef;
      }

      res.on('data', (chunk) => {
        parser.feed(String(chunk));
      });

      res.on('end', () => {
        if (currentSseReq !== sseReq) return; // superseded stream
        sseConnected = false;
        console.log('[WS-Agent] SuperAgent SSE connection ended by server.');
        // Capture replay cursor before closing so next connect replays missed events.
        replayCursor = lastSseEventIdRef;
        suppressBufferWrite = true;
        if (!isClosed && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'status', text: 'SSE connection ended. Reconnecting...' }));
          scheduleSseRetry();
        }
      });
    });

    const currentSseReq = sseReq;
    sseReq.on('error', () => {
      if (currentSseReq !== sseReq) return; // intentional stream replacement
      sseConnected = false;
      // A failed GET/SSE is safe to retry with a bounded budget; never
      // auto-launch a potentially foreign Core listener during reconnection.
      if (initialSessionId && !isClosed && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(classifyCoreReconnect({
          sessionId: initialSessionId, statusCode: 503,
          upstreamCode: 'CORE_SUPERVISOR_UNAVAILABLE',
        })));
      }
      scheduleSseRetry();
    });

    // Track this SSE handle so a WS disconnect can destroy every outstanding
    // request, not just the latest one. The Set is auto-pruned when the
    // request emits 'close' (normal end, error, or destroy).
    if (sseReq) {
      const trackedReq: http.ClientRequest = sseReq;
      activeSseReqs.add(trackedReq);
      trackedReq.on('close', () => {
        activeSseReqs.delete(trackedReq);
      });
    }
    sseReq.end();
  }

  lifecycleManager.markWsConnected();
  lifecycleManager.markInitInProgress();

  async function performSessionInitAndSubscribe() {
    try {
      const initRes = await initializeSuperAgentSession(workspacePath, agentMode, initialSessionId);
      if (initRes.success) {
        lifecycleManager.markInitAck(initRes);
        connectToSuperAgentSSE();
      } else {
        console.warn('[WS-Agent] Initial session init not successful:', initRes.error || initRes.statusCode);
        if (initRes.statusCode === 503 || initRes.statusCode === 400 || initRes.statusCode === 404) {
          scheduleInitRetry();
        } else {
          lifecycleManager.markError(initRes.error || 'Session initialization rejected by Core', initRes.statusCode);
        }
      }
    } catch (err: any) {
      console.warn('[WS-Agent] Session init exception:', err?.message || err);
      scheduleInitRetry();
    }
  }

  function scheduleInitRetry() {
    if (isClosed || ws.readyState !== WebSocket.OPEN) return;
    sseReconnectAttempts = Math.min(sseReconnectAttempts + 1, 32);
    const delay = Math.min(30000, 500 * (2 ** Math.min(sseReconnectAttempts - 1, 6)));
    setTimeout(performSessionInitAndSubscribe, delay);
  }

  void performSessionInitAndSubscribe();

  ws.on('message', async (message: string) => {
    try {
      const parsed = JSON.parse(message);
      const actionType = parsed.type;
      // Every interactive operation must originate from a valid session-bound
      // transport, including approvals and aborts (not just chat prompts).
      if (!initialSessionId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(initialSessionId)) {
        ws.send(JSON.stringify({ type: 'chat_response', success: false,
          result: { error: 'Open a valid assistant session before using this channel.' } }));
        return;
      }

      if (actionType === 'core_health_probe') {
        const health = await readCoreSessionForReconnect(initialSessionId, workspacePath);
        if (health.statusCode === 200 && !sseConnected) {
          sseReconnectAttempts = 0; // manual/read-only retry is a fresh probe budget
          connectToSuperAgentSSE();
        }
        ws.send(JSON.stringify(classifyCoreReconnect({
          sessionId: initialSessionId, statusCode: health.statusCode,
          upstreamCode: health.code,
        })));
        return;
      }
      if (actionType === 'resume_session') {
        if (!isExplicitResumeRequest({
          channelSessionId: initialSessionId, requestedSessionId: parsed.sessionId,
          approval: parsed.approved,
        })) {
          ws.send(JSON.stringify(classifyCoreReconnect({
            sessionId: initialSessionId, statusCode: 409,
          })));
          return;
        }
        const result = await sendSuperAgentRequest('/api/init', {
          workspace: workspacePath, mode: agentMode === 'multi' ? 'multi' : 'single',
          clientMode: 'tline', sessionId: initialSessionId, resume: initialSessionId,
        }, workspacePath);
        if (result?.success === true && result.sessionId === initialSessionId) {
          ws.send(JSON.stringify(classifyCoreReconnect({
            sessionId: initialSessionId, statusCode: 200,
          })));
          connectToSuperAgentSSE(); // GET only; never reissue a chat/tool request.
        } else {
          const notice = classifyCoreReconnect({
            sessionId: initialSessionId, statusCode: result?.statusCode || 409,
            upstreamCode: result?.code,
          });
          // The explicit resume was denied by Core; do not retry it.
          ws.send(JSON.stringify(notice));
        }
        return;
      }
      if (actionType === 'prompt') {
        // The transport is a session-bound channel, not a general-purpose
        // agent execution proxy. Deny stale-tab and cross-session sends.
        const { isBoundAssistantSession, validAssistantTurnId } = await import('./tlineAssistantSession');
        if (!isBoundAssistantSession(initialSessionId, parsed.sessionId)) {
          ws.send(JSON.stringify({ type: 'chat_response', success: false,
            sessionId: initialSessionId,
            result: { error: 'Session changed. Reconnect the assistant before sending.' } }));
          return;
        }

        // Gate prompt send: Must be READY
        if (!lifecycleManager.canSendPrompt()) {
          ws.send(JSON.stringify({ type: 'chat_response', success: false,
            sessionId: initialSessionId,
            result: { error: 'Assistant session is not ready yet. Please wait for initialization and stream subscription.' } }));
          return;
        }

        if (parsed.clientMessageId !== undefined && !validAssistantTurnId(parsed.clientMessageId)) {
          ws.send(JSON.stringify({ type: 'chat_response', success: false,
            sessionId: initialSessionId,
            result: { error: 'Invalid message identity.' } }));
          return;
        }

        const turnId = parsed.clientMessageId || '';
        if (turnId && !lifecycleManager.recordWriteAttempt(turnId)) {
          ws.send(JSON.stringify({ type: 'chat_response', success: false,
            sessionId: initialSessionId,
            result: { error: 'Duplicate write attempt. Prompt write already accepted or in-flight.' } }));
          return;
        }

        // Validate active preset is configured before sending prompt
        let activeModelName: string | undefined;
        try {
          const configSnapshot = await loadMergedPresets();
          const modeKey: 'single' | 'multi' = agentMode === 'multi' ? 'multi' : 'single';
          const activePresetId = configSnapshot.activePresetId?.[modeKey];
          const activePresetsList = configSnapshot.presets?.[modeKey] || [];
          const activePreset = activePresetsList.find((p: any) =>
            p.id?.toLowerCase() === activePresetId?.toLowerCase() ||
            p.name?.toLowerCase() === activePresetId?.toLowerCase()
          );
          if (!activePresetId || !activePreset) {
            const errMsg = `No active model preset selected for ${agentMode} mode. Please select an active preset.`;
            ws.send(JSON.stringify({ type: 'chat_response', success: false, result: { error: errMsg } }));
            logSuperAgentEvent('chat_response_error', { error: errMsg });
            return;
          }
          activeModelName = activePreset.model || activePreset.modelName;
        } catch (presetCheckErr: any) {
          console.warn('[WS-Agent] Active preset check warning:', presetCheckErr?.message);
        }

        // Multimodal validation
        const validation = validateAndSanitizeMultimodalInput(parsed.text || '', parsed.parts, activeModelName);
        if (!validation.valid) {
          ws.send(JSON.stringify({ type: 'chat_response', success: false,
            sessionId: initialSessionId,
            result: { error: validation.error } }));
          return;
        }

        const cleanHistoryText = validation.cleanHistoryText || parsed.text || '';
        console.log(`[WS-Agent] Prompt received (${workspacePath}, ${cleanHistoryText.length} chars)`);
        logToSuperAgentFile(`[WS-Agent] Prompt received (${workspacePath}, ${cleanHistoryText.length} chars)`);
        logSuperAgentEvent('prompt', { length: cleanHistoryText.length, workspace: workspacePath });
        await saveCliPromptHistory(cleanHistoryText, workspacePath);

        // Ensure SuperAgent server process is running
        await new Promise<void>((resolve) => {
          ensureSuperAgentServer(workspacePath, agentMode, customArgs, ws, resolve);
        });

        try {
          const messageContent = validation.sanitizedParts && validation.sanitizedParts.length > 0
            ? validation.sanitizedParts
            : cleanHistoryText;
          const chatPayload: any = { message: messageContent, sessionId: initialSessionId };
          if (parsed.clientMessageId) chatPayload.clientMessageId = parsed.clientMessageId;
          // A transport failure after a POST is an unknown outcome. Never
          // call /api/chat again, regardless of whether the connection refused,
          // timed out, or closed after Core accepted the request.
          let response: any;
          try {
            response = await sendSuperAgentRequest('/api/chat', chatPayload, workspacePath);
          } catch (_err: any) {
            const notice = classifyCoreReconnect({
              sessionId: initialSessionId, uncertainWrite: true,
            });
            ws.send(JSON.stringify(notice));
            ws.send(JSON.stringify({ type: 'chat_response', sessionId: initialSessionId,
              success: false, result: { error: notice.message } }));
            return;
          }

          // A definite session-not-initialized response still needs a user
          // decision; never silently reinitialize and resend the same prompt.
          if (response?.error === 'Session not initialized') {
            const notice = classifyCoreReconnect({
              sessionId: initialSessionId, statusCode: 409,
            });
            ws.send(JSON.stringify(notice));
            ws.send(JSON.stringify({ type: 'chat_response', sessionId: initialSessionId,
              success: false, result: { error: notice.message } }));
            return;
          }
          if (response?.error && (response.statusCode === 503 ||
              response.code === 'SESSION_WORKER_DEAD' ||
              response.code === 'SESSION_OWNER_UNAVAILABLE')) {
            ws.send(JSON.stringify(classifyCoreReconnect({
              sessionId: initialSessionId, statusCode: response.statusCode,
              upstreamCode: response.code,
            })));
          }

          // Determine if response indicates an error
          const hasError = response && (response.error || response.raw);
          const errorMsg = response?.error || (response?.raw ? `Unexpected response from server: ${String(response.raw).slice(0, 200)}` : null);

          if (hasError) {
            ws.send(JSON.stringify({ type: 'chat_response', sessionId: initialSessionId, success: false, result: { error: errorMsg } }));
            logSuperAgentEvent('chat_response_error', { error: errorMsg });
          } else {
            ws.send(JSON.stringify({ type: 'chat_response', sessionId: initialSessionId, success: true, result: response }));
            logSuperAgentEvent('chat_response', response);
          }
        } catch (err: any) {
          const errMsg = `Failed to send prompt: ${err.message}`;
          ws.send(JSON.stringify({ type: 'chat_response', sessionId: initialSessionId, success: false, result: { error: errMsg } }));
          logSuperAgentEvent('system_error', { message: 'Failed to send prompt to SuperAgent', error: err.message });
        }
      } else if (actionType === 'approve_permission') {
        const { permissionId, approval } = parsed;
        if (typeof permissionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(permissionId) ||
            (approval !== true && approval !== false && approval !== 'session')) {
          ws.send(JSON.stringify({ type: 'permission_decision_ack', sessionId: initialSessionId,
            permissionId: typeof permissionId === 'string' ? permissionId : '',
            accepted: false, code: 'INVALID_DECISION' }));
          return;
        }
        logSuperAgentEvent('permission_response', { action: 'decision_sent', approved: approval !== false });
        try {
          const decision = await sendSuperAgentRequest('/api/approve',
            { permissionId, approval, sessionId: initialSessionId }, workspacePath, 10000);
          if (!isClosed && ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: 'permission_decision_ack', sessionId: initialSessionId,
              permissionId, accepted: decision?.success === true,
              code: decision?.success === true ? 'ACCEPTED' :
                decision?.statusCode === 404 ? 'NOT_FOUND' :
                decision?.statusCode === 409 ? 'ALREADY_DECIDED' : 'CORE_REJECTED' }));
        } catch {
          // Unknown outcome: never send the same approval again automatically.
          if (!isClosed && ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: 'permission_decision_ack', sessionId: initialSessionId,
              permissionId, accepted: false, code: 'OUTCOME_UNKNOWN' }));
        }
      } else if (actionType === 'answer_question') {
        const { questionId, answer } = parsed;
        logSuperAgentEvent('question_response', { questionId, answer });
        await sendSuperAgentRequest('/api/answer', { questionId, answer, sessionId: initialSessionId }, workspacePath);
      } else if (actionType === 'approve_plan') {
        const { action } = parsed;
        logSuperAgentEvent('plan_response', { action });
        await sendSuperAgentRequest('/api/plan/approve', { action, sessionId: initialSessionId }, workspacePath);
      } else if (actionType === 'abort') {
        logSuperAgentEvent('abort_request', { workspace: workspacePath });
        try {
          await sendSuperAgentRequest('/api/abort', { sessionId: initialSessionId }, workspacePath, 2000);
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
      try { sseReq.destroy(); } catch {}
      sseReq = null;
    }
    // Destroy any other SSE handles that may still be in flight (reconnect
    // races, abandoned requests, etc.) and clear the tracking set.
    for (const req of activeSseReqs) {
      try { req.destroy(); } catch {}
    }
    activeSseReqs.clear();
    if (sseReconnectTimeout) {
      clearTimeout(sseReconnectTimeout);
      sseReconnectTimeout = null;
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
