import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import WebSocket from 'ws';
import { getInputHistory, saveInputHistory } from './sessionManager';

const AUDIT_FILE = path.join(process.cwd(), 'superagent-audit.json');

/** Delegates to SQLite-based input history in sessionManager */
export function getCliPromptHistory(workspace?: string): string[] {
  return getInputHistory(workspace || process.cwd());
}

/** Delegates to SQLite-based input history in sessionManager */
export function saveCliPromptHistory(prompt: string, workspace?: string) {
  saveInputHistory(workspace || process.cwd(), prompt);
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

function ensureSuperAgentServer(
  workspacePath: string,
  agentMode: string,
  customArgs: string,
  ws: WebSocket,
  callback: () => void
) {
  const isWin = os.platform() === 'win32';
  const cmd = isWin ? 'bunx.cmd' : 'bunx';

  const modeChanged = currentAgentMode !== agentMode;
  const pathChanged = currentWorkspacePath !== workspacePath;
  const argsChanged = currentCustomArgs !== customArgs;

  if (autoSuperAgentProcess && (modeChanged || pathChanged || argsChanged)) {
    console.log('[WS-Agent] Settings changed. Restarting SuperAgent server process...');
    ws.send(JSON.stringify({ type: 'status', text: 'Settings changed. Restarting SuperAgent server...' }));
    try {
      if (isWin) {
        const pid = autoSuperAgentProcess.pid;
        if (pid) {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        }
      } else {
        autoSuperAgentProcess.kill();
      }
    } catch (e) {
      console.error('[WS-Agent] Failed to kill previous process:', e);
    }
    autoSuperAgentProcess = null;
    isStartingSuperAgent = false;
  }

  if (isStartingSuperAgent) {
    ws.send(JSON.stringify({ type: 'status', text: 'SuperAgent server is starting up...' }));
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

  isStartingSuperAgent = true;
  ws.send(JSON.stringify({ type: 'status', text: 'Auto-starting SuperAgent server on port 7888...' }));
  logSuperAgentEvent('system', { message: 'Auto-starting SuperAgent server process', workspacePath, agentMode, customArgs });

  currentWorkspacePath = workspacePath;
  currentAgentMode = agentMode;
  currentCustomArgs = customArgs;

  try {
    const spawnArgs = ['superagent', '--server'];
    if (agentMode === 'multi') {
      spawnArgs.push('--multi');
    }
    if (customArgs && customArgs.trim()) {
      const parts = customArgs.trim().split(/\s+/);
      spawnArgs.push(...parts);
    }

    console.log(`[WS-Agent] Spawning SuperAgent with args: ${spawnArgs.join(' ')} in cwd: ${workspacePath}`);

    autoSuperAgentProcess = spawn(cmd, spawnArgs, {
      cwd: workspacePath,
      shell: true,
      detached: false,
      stdio: 'ignore'
    });

    autoSuperAgentProcess.on('error', (err: any) => {
      console.error('[WS-Agent] Failed to spawn SuperAgent:', err);
      ws.send(JSON.stringify({ type: 'status', text: `Failed to auto-start SuperAgent: ${err.message}` }));
      isStartingSuperAgent = false;
    });

    setTimeout(() => {
      isStartingSuperAgent = false;
      callback();
    }, 3000);
  } catch (e: any) {
    console.error('[WS-Agent] Spawn error:', e);
    ws.send(JSON.stringify({ type: 'status', text: `Error spawning SuperAgent process: ${e.message}` }));
    isStartingSuperAgent = false;
  }
}

async function initializeSuperAgentSession(workspacePath: string, mode: string): Promise<boolean> {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      workspace: workspacePath,
      mode: mode === 'multi' ? 'multi' : 'single'
    });

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
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch {
          resolve({ raw: body });
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
        saveCliPromptHistory(text);

        // Ensure session exists
        await initializeSuperAgentSession(workspacePath, agentMode);

        try {
          let response = await sendSuperAgentRequest('/api/chat', { message: text }, workspacePath);

          // Retry once if session wasn't initialized
          if (response && response.error === 'Session not initialized') {
            await initializeSuperAgentSession(workspacePath, agentMode);
            response = await sendSuperAgentRequest('/api/chat', { message: text }, workspacePath);
          }

          ws.send(JSON.stringify({ type: 'chat_response', success: true, result: response }));
          logSuperAgentEvent('chat_response', response);
        } catch (err: any) {
          ws.send(JSON.stringify({ type: 'status', text: `Failed to send prompt: ${err.message}` }));
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

        if (autoSuperAgentProcess) {
          console.log('[WS-Agent] Force killing SuperAgent server process on user abort...');
          try {
            if (os.platform() === 'win32') {
              const pid = autoSuperAgentProcess.pid;
              if (pid) {
                execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
              }
            } else {
              autoSuperAgentProcess.kill('SIGKILL');
            }
          } catch (e) {
            console.error('[WS-Agent] Failed to kill SuperAgent process on abort:', e);
          }
          autoSuperAgentProcess = null;
          isStartingSuperAgent = false;
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
