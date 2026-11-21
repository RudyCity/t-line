/**
 * Agent Client Protocol (ACP) - Universal WebSocket Bridge Adapter for T-Line
 * Translates between T-Line frontend WebSocket messages and any ACP server
 * (Antigravity agy.exe, Superagent Core, Codex, and user-configured ACP servers).
 */

import type WebSocket from 'ws';
import { SuperAgentAcpClient, type AcpPermissionRequest } from './superAgentAcpClient';
import { getAcpEngine } from './acpEngineRegistry';

export interface AcpBridgeAdapterOptions {
  client?: SuperAgentAcpClient;
  ws: WebSocket;
  workspacePath: string;
  defaultSessionId?: string;
  engineId?: string;
}

export interface DispatchAcpPromptOptions {
  ws: WebSocket;
  workspacePath: string;
  sessionId: string;
  engineId: string;
  modelId?: string;
  modeId?: string;
  prompt: string;
  history?: Array<{ role: string; text: string }>;
  clientMessageId?: string;
}

// Global active client pool per WebSocket connection and engine
const activeEngineClients = new Map<string, { client: SuperAgentAcpClient; acpSessionId: string }>();

function getClientKey(ws: WebSocket, engineId: string): string {
  // Use a unique symbol or property attached to ws if possible, else memory map
  const wsId = (ws as any)._tlineWsId || ((ws as any)._tlineWsId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  return `${wsId}_${engineId}`;
}

export class SuperAgentAcpBridgeAdapter {
  private client: SuperAgentAcpClient;
  private ws: WebSocket;
  private workspacePath: string;
  private activeSessionId: string;
  private activeEngine = 'superagent';
  private pendingPermissionRpcMap = new Map<string, string | number>();
  private isDisposed = false;

  constructor(options: AcpBridgeAdapterOptions) {
    this.ws = options.ws;
    this.workspacePath = options.workspacePath;
    this.activeSessionId = options.defaultSessionId || `session_${Date.now()}`;
    this.activeEngine = options.engineId || 'superagent';

    if (options.client) {
      this.client = options.client;
    } else {
      const engineProfile = getAcpEngine(this.activeEngine);
      this.client = new SuperAgentAcpClient({
        command: engineProfile.command,
        args: engineProfile.args,
        env: engineProfile.env,
        workspacePath: this.workspacePath,
      });
    }

    this.bindClientEvents();
    this.bindWebSocketEvents();
  }

  private sendToFrontend(messageObj: any): void {
    if (this.isDisposed || this.ws.readyState !== 1 /* WebSocket.OPEN */) return;
    try {
      this.ws.send(JSON.stringify(messageObj));
    } catch {}
  }

  private bindClientEvents(): void {
    // 1. Thought Process Stream (Accordion)
    this.client.on('thought', ({ sessionId, delta }) => {
      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: 'thought',
          content: delta,
        },
        sessionId: sessionId || this.activeSessionId,
      });
    });

    // 2. Text Content Stream
    this.client.on('text', ({ sessionId, delta }) => {
      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: 'text',
          content: delta,
        },
        sessionId: sessionId || this.activeSessionId,
      });
    });

    // 3. Tool Execution Start
    this.client.on('tool_call_start', (data) => {
      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: 'tool_start',
          toolCall: {
            id: data.callId || `call_${Date.now()}`,
            name: data.tool,
            args: data.description,
          },
          description: data.description,
        },
        sessionId: data.sessionId || this.activeSessionId,
      });
    });

    // 4. Tool Execution End
    this.client.on('tool_call_end', (data) => {
      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: 'tool_end',
          toolResult: {
            id: data.callId,
            name: data.tool,
            isError: data.status === 'failed',
          },
        },
        sessionId: data.sessionId || this.activeSessionId,
      });
    });

    // 5. Usage / Token tracking
    this.client.on('usage', (data) => {
      this.sendToFrontend({
        type: 'token_usage',
        promptTokens: data.used || 0,
        completionTokens: 0,
        contextSize: data.size || 1048576,
        totalCostUsd: 0,
        sessionId: data.sessionId || this.activeSessionId,
      });
    });

    // 6. Status change
    this.client.on('status', (data) => {
      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: data.status === 'done' ? 'done' : 'status',
          status: data.status,
          summary: data.summary,
        },
        sessionId: data.sessionId || this.activeSessionId,
      });

      if (data.status === 'done') {
        this.sendToFrontend({
          type: 'chat_response',
          success: true,
          sessionId: data.sessionId || this.activeSessionId,
        });
      }
    });

    // 7. Reverse Permission Request
    this.client.on('permission_requested', (req: AcpPermissionRequest & { rpcId: string | number }) => {
      this.pendingPermissionRpcMap.set(req.permissionId, req.rpcId);
      this.sendToFrontend({
        type: 'permission_required',
        permissionId: req.permissionId,
        description: req.description,
        action: req.action,
        target: req.target,
        riskLevel: req.riskLevel,
        expiresInMs: req.expiresInMs,
        sessionId: req.sessionId || this.activeSessionId,
      });
    });
  }

  private bindWebSocketEvents(): void {
    this.ws.on('message', async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      await this.handleFrontendMessage(msg);
    });

    this.ws.on('close', () => {
      this.dispose();
    });
  }

  public async handleFrontendMessage(msg: any): Promise<void> {
    if (!msg || typeof msg !== 'object') return;

    // Handle prompt
    if (msg.type === 'prompt' && (typeof msg.prompt === 'string' || typeof msg.text === 'string')) {
      const promptText = msg.text || msg.prompt || '';
      const sessionId = msg.sessionId || this.activeSessionId;

      await this.client.sendPrompt(sessionId, promptText, msg.parts, {
        engine: this.activeEngine,
        history: msg.history,
      });
      return;
    }

    // Handle permission response
    if (msg.type === 'permission_response' && msg.permissionId) {
      const rpcId = this.pendingPermissionRpcMap.get(msg.permissionId);
      if (rpcId !== undefined) {
        this.pendingPermissionRpcMap.delete(msg.permissionId);
        const decision =
          msg.decision === 'approved' || msg.decision === 'approved_session'
            ? msg.decision
            : 'denied';
        this.client.respondPermission(rpcId, decision, msg.reason);
      }
      return;
    }

    // Handle cancellation
    if (msg.type === 'cancel') {
      const sessionId = msg.sessionId || this.activeSessionId;
      try {
        await this.client.cancelSession(sessionId, msg.reason);
      } catch {}
      return;
    }
  }

  public getSessionId(): string {
    return this.activeSessionId;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.pendingPermissionRpcMap.clear();
    this.client.close();
  }
}

/**
 * Updates model on the active live ACP session for a given engine and connection.
 */
export async function dispatchAcpSwitchModel(ws: WebSocket, engineId: string, modelId: string): Promise<void> {
  const key = getClientKey(ws, engineId);
  const entry = activeEngineClients.get(key);
  if (entry) {
    try {
      await entry.client.setModel(entry.acpSessionId, modelId);
      console.log(`[ACP-Gateway] Updated active session model to '${modelId}' on ${engineId}`);
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: {
            type: 'status',
            status: 'model_changed',
            summary: `Active model switched to ${modelId}`,
          },
          sessionId: entry.acpSessionId,
        }));
      }
    } catch (e) {
      console.warn(`[ACP-Gateway] Failed to update active session model:`, e);
    }
  }
}

/**
 * High-level helper: dispatches a user prompt directly to any ACP server,
 * managing the client lifecycle, single-thread history continuity, and streaming events.
 */
export async function dispatchAcpPrompt(options: DispatchAcpPromptOptions): Promise<void> {
  const { ws, workspacePath, sessionId, engineId, modelId, modeId, prompt, history } = options;
  const key = getClientKey(ws, engineId);

  let entry = activeEngineClients.get(key);

  if (!entry) {
    const engineProfile = getAcpEngine(engineId);
    console.log(`[ACP-Gateway] Spawning Universal ACP Server for ${engineProfile.name} (${engineProfile.command} ${engineProfile.args.join(' ')})`);

    const client = new SuperAgentAcpClient({
      command: engineProfile.command,
      args: engineProfile.args,
      env: engineProfile.env,
      workspacePath,
    });

    // Pipe streaming events to frontend
    client.on('text', (ev) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: { type: 'text', content: ev.delta },
          sessionId,
        }));
      }
    });

    client.on('thought', (ev) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: { type: 'thought', content: ev.delta },
          sessionId,
        }));
      }
    });

    client.on('tool_call_start', (ev) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: {
            type: 'tool_start',
            toolCall: { id: ev.callId || `call_${Date.now()}`, name: ev.tool, args: ev.description },
            description: ev.description,
          },
          sessionId,
        }));
      }
    });

    client.on('tool_call_end', (ev) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: {
            type: 'tool_end',
            toolResult: { id: ev.callId, name: ev.tool, isError: ev.status === 'failed' },
          },
          sessionId,
        }));
      }
    });

    client.on('usage', (ev) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'token_usage',
          promptTokens: ev.used || 0,
          completionTokens: 0,
          contextSize: ev.size || 1048576,
          totalCostUsd: 0,
          sessionId,
        }));
      }
    });

    client.on('status', (ev) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: {
            type: ev.status === 'done' ? 'done' : 'status',
            status: ev.status,
            summary: ev.summary,
          },
          sessionId,
        }));

        if (ev.status === 'done') {
          ws.send(JSON.stringify({
            type: 'chat_response',
            success: true,
            sessionId,
          }));
        }
      }
    });

    // Auto cleanup when websocket closes
    ws.once('close', () => {
      activeEngineClients.delete(key);
      client.close();
    });

    await client.start();
    await client.initialize();
    const sessionRes = await client.newSession(workspacePath);
    entry = { client, acpSessionId: sessionRes.sessionId };
    activeEngineClients.set(key, entry);
  }

  // Switch or set model / mode on the ACP session if requested
  if (modelId) {
    try {
      await entry.client.setModel(entry.acpSessionId, modelId);
    } catch (modelErr) {
      console.warn(`[ACP-Gateway] Could not set model '${modelId}' on ${engineId}:`, modelErr);
    }
  }

  if (modeId) {
    try {
      await entry.client.setMode(entry.acpSessionId, modeId);
    } catch (modeErr) {
      console.warn(`[ACP-Gateway] Could not set mode '${modeId}' on ${engineId}:`, modeErr);
    }
  }

  // Build context-enriched prompt if previous thread turns exist
  let finalPrompt = prompt;
  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-6);
    const historyBlock = recentHistory
      .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
      .join('\n');
    finalPrompt = `[Context from prior conversation in this session]\n${historyBlock}\n\n[Current User Message]\n${prompt}`;
  }

  try {
    await entry.client.sendPrompt(entry.acpSessionId, finalPrompt);
  } catch (err: any) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'chat_response',
        success: false,
        sessionId,
        result: { error: err?.message || String(err) },
      }));
    }
  }
}
