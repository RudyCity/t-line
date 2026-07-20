import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import WebSocket from 'ws';
import { getInputHistory, saveInputHistory } from './sessionManager';

const AUDIT_FILE = path.join(process.cwd(), 'superagent-audit.json');

/** Delegates to SuperAgent server-based input history in sessionManager */
export async function getCliPromptHistory(workspace?: string): Promise<string[]> {
  return getInputHistory(workspace || process.cwd());
}

/** Delegates to SuperAgent server-based input history in sessionManager */
export async function saveCliPromptHistory(prompt: string, workspace?: string): Promise<void> {
  await saveInputHistory(workspace || process.cwd(), prompt);
}

export function logSuperAgentEvent(type: string, data: any) {
  try {
    let logs: any[] = [];
    if (fs.existsSync(AUDIT_FILE)) {
      const content = fs.readFileSync(AUDIT_FILE, 'utf8');
      logs = JSON.parse(content || '[]');
    }
    logs.push({
      timestamp: new Date().toISOString(),
      type,
      data
    });
    if (logs.length > 1000) {
      logs = logs.slice(logs.length - 1000);
    }
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.error('[WS-Agent] Audit log error:', e);
  }
}

export function getAuditLogs(): any[] {
  if (fs.existsSync(AUDIT_FILE)) {
    try {
      const content = fs.readFileSync(AUDIT_FILE, 'utf8');
      return JSON.parse(content || '[]');
    } catch {
      return [];
    }
  }
  return [];
}

export function clearAuditLogs() {
  try {
    fs.writeFileSync(AUDIT_FILE, '[]', 'utf8');
  } catch (e) {
    console.error('[WS-Agent] Failed to clear audit log:', e);
  }
}

let autoSuperAgentProcess: any = null;
let isStartingSuperAgent = false;
let currentWorkspacePath = '';
let currentAgentMode = 'single';
let currentCustomArgs = '';

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

function ensureSuperAgentServer(
  workspacePath: string,
  agentMode: string,
  customArgs: string,
  ws: WebSocket,
  callback: () => void
): void {
  const isWin = os.platform() === 'win32';
  const cmd = isWin ? 'bunx.cmd' : 'bunx';

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

  // Before spawning, ping port 7888 — it may already be running externally.
  pingPort7888().then((alreadyRunning) => {
    if (alreadyRunning) {
      console.log('[WS-Agent] SuperAgent server already running on port 7888. Skipping spawn.');
      currentWorkspacePath = workspacePath;
      currentAgentMode = agentMode;
      currentCustomArgs = customArgs;
      callback();
      return;
    }

    isStartingSuperAgent = true;
    ws.send(JSON.stringify({ type: 'status', text: 'Auto-starting SuperAgent server on port 7888...' }));
    logSuperAgentEvent('system', { message: 'Auto-starting SuperAgent server process', workspacePath, agentMode, customArgs });

    currentWorkspacePath = workspacePath;
    currentAgentMode = agentMode;
    currentCustomArgs = customArgs;

    // Track whether this particular spawn attempt is still live
    let spawnAborted = false;
    let stderrOutput = '';

    function abortStartup(reason: string) {
      if (spawnAborted) return;
      spawnAborted = true;
      isStartingSuperAgent = false;
      autoSuperAgentProcess = null;
      console.error(`[WS-Agent] SuperAgent startup aborted: ${reason}`);
      ws.send(JSON.stringify({ type: 'status', text: `SuperAgent failed to start: ${reason}` }));
      logSuperAgentEvent('system_error', { message: 'SuperAgent startup failed', reason });
      drainPendingCallbacks(new Error(reason));
    }

    try {
      const spawnArgs = ['superagent', '--server'];
      if (agentMode === 'multi') spawnArgs.push('--multi');
      if (customArgs && customArgs.trim()) {
        spawnArgs.push(...customArgs.trim().split(/\s+/));
      }

      console.log(`[WS-Agent] Spawning SuperAgent with args: ${spawnArgs.join(' ')} in cwd: ${workspacePath}`);

      autoSuperAgentProcess = spawn(cmd, spawnArgs, {
        cwd: workspacePath,
        shell: true,
        detached: false,
        stdio: ['ignore', 'ignore', 'pipe']   // capture stderr for diagnostics
      });

      // Capture stderr so we can surface it when the process exits
      if (autoSuperAgentProcess.stderr) {
        autoSuperAgentProcess.stderr.setEncoding('utf8');
        autoSuperAgentProcess.stderr.on('data', (chunk: string) => {
          stderrOutput += chunk;
          // Keep last 2000 chars to avoid unbounded growth
          if (stderrOutput.length > 2000) {
            stderrOutput = stderrOutput.slice(stderrOutput.length - 2000);
          }
        });
      }

      autoSuperAgentProcess.on('exit', (code: any, signal: any) => {
        console.log(`[WS-Agent] SuperAgent server process exited with code ${code}, signal ${signal}`);
        // NOTE: with shell:true, the shell wrapper process exits almost immediately
        // while the actual bun/node server continues running. Do NOT abort the ping
        // loop here — let pingPort7888() be the sole readiness signal.
        // We only clean up the process reference if startup was already resolved.
        if (spawnAborted) {
          autoSuperAgentProcess = null;
          isStartingSuperAgent = false;
        }
        // If the shell exits early AND we later time out, abortStartup will fire then.
      });

      autoSuperAgentProcess.on('error', (err: any) => {
        console.error('[WS-Agent] Failed to spawn SuperAgent:', err);
        abortStartup(err.message);
      });

      // Poll until port 7888 responds (up to 20 seconds), then fire callback
      const POLL_INTERVAL_MS = 500;
      const MAX_WAIT_MS = 20000;
      const startedAt = Date.now();
      const pollReady = () => {
        if (spawnAborted) return;   // process already exited — no-op
        pingPort7888().then((ready) => {
          if (spawnAborted) return;
          if (ready) {
            console.log('[WS-Agent] SuperAgent server is now ready on port 7888.');
            spawnAborted = true;  // sentinel: polling done
            isStartingSuperAgent = false;
            callback();
            drainPendingCallbacks();
          } else if (Date.now() - startedAt >= MAX_WAIT_MS) {
            abortStartup('Timed out after 20 seconds. Run "bunx superagent --server" manually to see the error.');
          } else {
            setTimeout(pollReady, POLL_INTERVAL_MS);
          }
        });
      };
      setTimeout(pollReady, POLL_INTERVAL_MS);
    } catch (e: any) {
      console.error('[WS-Agent] Spawn error:', e);
      abortStartup(e.message);
    }
  });
}

async function initializeSuperAgentSession(workspacePath: string, mode: string, sessionId?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const initPayload: any = {
      workspace: workspacePath,
      mode: mode === 'multi' ? 'multi' : 'single'
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
        'x-workspace-path': workspacePath
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
        'x-workspace-path': workspacePath
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

  function connectToSuperAgentSSE() {
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
      ws.send(JSON.stringify({ type: 'status', text: `Connected to SuperAgent server (${path.basename(workspacePath)})` }));
      logSuperAgentEvent('system', { message: 'Connected to local SuperAgent SSE events', workspace: workspacePath });

      // Proactively initialize session for this workspace
      initializeSuperAgentSession(workspacePath, agentMode).catch(() => {});

      res.setEncoding('utf8');
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const dataStr = line.slice(6).trim();
              const event = JSON.parse(dataStr);
              ws.send(JSON.stringify(event));
              logSuperAgentEvent('agent_event', event);
            } catch {}
          }
        }
      });

      res.on('end', () => {
        ws.send(JSON.stringify({ type: 'status', text: 'SuperAgent SSE connection closed.' }));
        logSuperAgentEvent('system', { message: 'SuperAgent SSE connection closed' });
      });
    });

    sseReq.on('error', (err: any) => {
      logSuperAgentEvent('system_error', { message: 'Failed to connect to SuperAgent server', error: err.message });
      connectionAttempts++;

      if (connectionAttempts === 1) {
        ensureSuperAgentServer(workspacePath, agentMode, customArgs, ws, () => {
          connectToSuperAgentSSE();
        });
      } else {
        ws.send(JSON.stringify({
          type: 'status',
          text: 'SuperAgent server not running on port 7888. Run "superagent --server" to connect.'
        }));
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

        // Ensure session exists
        await initializeSuperAgentSession(workspacePath, agentMode, parsed.sessionId);

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
    if (sseReq) {
      sseReq.destroy();
    }
  });
}
