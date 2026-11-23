/**
 * Agent Client Protocol (ACP) - Universal WebSocket Bridge Adapter for T-Line
 * Translates between T-Line frontend WebSocket messages and any ACP server
 * (Antigravity agy.exe, Superagent Core, Codex, and user-configured ACP servers).
 */

import type WebSocket from 'ws';
import { SuperAgentAcpClient, type AcpPermissionRequest } from './superAgentAcpClient';
import { getAcpEngine } from './acpEngineRegistry';
import { provisionAllAdeMcp } from './acpMcpProvisioner';

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

// Global in-flight ACP reverse permission requests across all active engines
export const pendingAcpPermissions = new Map<
  string,
  {
    client: SuperAgentAcpClient;
    rpcId: string | number;
    sessionId?: string;
  }
>();

/**
 * Resolves a pending reverse permission request issued by any active ACP engine.
 * Returns true if the permission was found and resolved, false otherwise.
 */
export function resolvePendingAcpPermission(
  permissionId: string,
  approval: boolean | 'session' | 'always',
  reason?: string
): boolean {
  const pending = pendingAcpPermissions.get(permissionId);
  if (!pending) return false;

  pendingAcpPermissions.delete(permissionId);
  const decision = approval === 'session' ? 'approved_session' : (approval === true || approval === 'always') ? 'approved' : 'denied';
  try {
    pending.client.respondPermission(pending.rpcId, decision, reason);
    return true;
  } catch (err) {
    console.warn(`[ACP-Gateway] Failed to respond to ACP permission '${permissionId}':`, err);
    return false;
  }
}

/**
 * Unwraps dynamic Superagent tool calls (superagent_tool_execute & call_mcp_tool)
 * to present the actual tool name and arguments cleanly in UI streaming.
 */
export function unwrapDynamicTool(tool: any, description: any): { resolvedTool: string; resolvedArgs: any } {
  let resolvedTool = typeof tool === 'string' ? tool : String(tool || 'unknown_tool');
  let resolvedArgs = description;

  if (tool === 'superagent_tool_execute' && description && typeof description === 'object') {
    if (description.name) {
      resolvedTool = description.name;
      resolvedArgs = description.arguments || description;
    }
  } else if (tool === 'call_mcp_tool' && description && typeof description === 'object') {
    if (description.ToolName) {
      resolvedTool = description.ToolName;
      resolvedArgs = description.Arguments || description;
    }
  }

  return { resolvedTool, resolvedArgs };
}

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
      let resolvedTool = data.tool;
      let resolvedArgs = data.description;

      // Dynamic Gateway unwrapping: show the target tool being executed (e.g. superagent_chrome_cdp)
      if (data.tool === 'superagent_tool_execute' && data.description && typeof data.description === 'object') {
        if (data.description.name) {
          resolvedTool = data.description.name;
          resolvedArgs = data.description.arguments || data.description;
        }
      } else if (data.tool === 'call_mcp_tool' && data.description && typeof data.description === 'object') {
        if (data.description.ToolName) {
          resolvedTool = data.description.ToolName;
          resolvedArgs = data.description.Arguments || data.description;
        }
      }

      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: 'tool_start',
          toolCall: {
            id: data.callId || `call_${Date.now()}`,
            name: resolvedTool,
            args: resolvedArgs,
          },
          description: resolvedArgs,
        },
        sessionId: data.sessionId || this.activeSessionId,
      });
    });

    // 4. Tool Execution End
    this.client.on('tool_call_end', (data) => {
      let resolvedTool = data.tool;
      if (data.tool === 'superagent_tool_execute' && data.description && typeof data.description === 'object') {
        if (data.description.name) {
          resolvedTool = data.description.name;
        }
      } else if (data.tool === 'call_mcp_tool' && data.description && typeof data.description === 'object') {
        if (data.description.ToolName) {
          resolvedTool = data.description.ToolName;
        }
      }

      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: 'tool_end',
          toolResult: {
            id: data.callId,
            name: resolvedTool,
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
      const statusLower = String(data.status || '').toLowerCase();
      const isTerminal = statusLower === 'done' || statusLower === 'completed' || statusLower === 'idle' || statusLower === 'success' || statusLower === 'finished';
      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: isTerminal ? 'done' : 'status',
          status: data.status,
          summary: data.summary,
        },
        sessionId: data.sessionId || this.activeSessionId,
      });

      if (isTerminal) {
        this.sendToFrontend({
          type: 'chat_response',
          success: true,
          sessionId: data.sessionId || this.activeSessionId,
        });
      }
    });

    // 6b. Process exit / termination lifecycle (prevents UI loading lock when ACP child exits)
    this.client.on('exit', ({ code, signal }: { code: number | null; signal: string | null }) => {
      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: 'done',
          status: 'done',
          summary: `ACP process completed${code !== null ? ` (exit code: ${code})` : ''}`,
        },
        sessionId: this.activeSessionId,
      });
      this.sendToFrontend({
        type: 'chat_response',
        success: code === 0 || code === null,
        sessionId: this.activeSessionId,
      });
    });

    // 6c. Error lifecycle
    this.client.on('error', (err: any) => {
      this.sendToFrontend({
        type: 'agent_event',
        event: {
          type: 'done',
          status: 'error',
          summary: err?.message || String(err),
        },
        sessionId: this.activeSessionId,
      });
      this.sendToFrontend({
        type: 'chat_response',
        success: false,
        sessionId: this.activeSessionId,
        result: { error: err?.message || String(err) },
      });
    });

    // 7. Reverse Permission Request
    this.client.on('permission_requested', (req: AcpPermissionRequest & { rpcId: string | number; [key: string]: any }) => {
      const permId = String(req.permissionId || req.id || req.callId || `perm_${req.rpcId}`);
      const toolName = (req as any).tool || (req as any).name || req.target || (req as any).toolCall?.name || (req as any).toolCall?.tool;
      const toolCall = (req as any).toolCall || {
        name: toolName || req.action || 'system_tool',
        tool: toolName || req.action || 'system_tool',
        args: (req as any).args || (req as any).input || (req as any).parameters || (req as any).details || {},
      };
      const description = req.description || (toolName ? `Execute tool: ${toolName}` : `Authorize action: ${req.action}`);

      this.pendingPermissionRpcMap.set(permId, req.rpcId);
      pendingAcpPermissions.set(permId, { client: this.client, rpcId: req.rpcId, sessionId: req.sessionId });
      this.sendToFrontend({
        type: 'permission_required',
        permissionId: permId,
        description,
        toolCall,
        action: req.action,
        target: req.target || toolName,
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
        mode: msg.mode,
        loop: msg.loop || msg.isLoop,
        goalMode: msg.goalMode || msg.goal,
        maxIterations: msg.maxIterations,
      });
      return;
    }

    // Handle permission response
    if ((msg.type === 'permission_response' || msg.type === 'approve_permission') && (msg.permissionId || msg.id)) {
      const permId = String(msg.permissionId || msg.id);
      const rpcId = this.pendingPermissionRpcMap.get(permId);
      if (rpcId !== undefined) {
        this.pendingPermissionRpcMap.delete(permId);
        pendingAcpPermissions.delete(permId);
        const decision =
          msg.approval === 'session' || msg.decision === 'approved_session'
            ? 'approved_session'
            : (msg.approval === true || msg.decision === 'approved' || msg.approval === 'always')
              ? 'approved'
              : 'denied';
        this.client.respondPermission(rpcId, decision, msg.reason);
        // Dispatch ACK so frontend approvalInFlight clears immediately
        this.sendToFrontend({
          type: 'permission_decision_ack',
          sessionId: msg.sessionId || this.activeSessionId,
          permissionId: permId,
          accepted: true,
          code: 'ACCEPTED',
        });
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
    for (const permId of this.pendingPermissionRpcMap.keys()) {
      pendingAcpPermissions.delete(permId);
    }
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
  const engineProfile = getAcpEngine(engineId);

  let entry = activeEngineClients.get(key);

  if (!entry) {
    console.log(`[ACP-Gateway] Spawning Universal ACP Server for ${engineProfile.name} (${engineProfile.command} ${engineProfile.args.join(' ')})`);

    const client = new SuperAgentAcpClient({
      command: engineProfile.command,
      args: engineProfile.args,
      env: engineProfile.env,
      workspacePath,
    });

    // Auto-provision Superagent MCP into OpenCode & Cline before session starts
    try {
      provisionAllAdeMcp(workspacePath);
    } catch (provisionErr) {
      console.warn('[ACP-Gateway] Non-blocking MCP auto-provision warning:', provisionErr);
    }

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
        const { resolvedTool, resolvedArgs } = unwrapDynamicTool(ev.tool, ev.description);
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: {
            type: 'tool_start',
            toolCall: { id: ev.callId || `call_${Date.now()}`, name: resolvedTool, args: resolvedArgs },
            description: resolvedArgs,
          },
          sessionId,
        }));
      }
    });

    client.on('tool_call_end', (ev) => {
      if (ws.readyState === 1) {
        const { resolvedTool } = unwrapDynamicTool(ev.tool, undefined);
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: {
            type: 'tool_end',
            toolResult: { id: ev.callId, name: resolvedTool, isError: ev.status === 'failed' },
          },
          sessionId,
        }));
      }
    });

    client.on('permission_requested', (ev: any) => {
      const permId = String(ev.permissionId || ev.id || ev.callId || `perm_${ev.rpcId}`);
      const toolName = ev.tool || ev.name || ev.target || ev.toolCall?.name || ev.toolCall?.tool;
      const toolCall = ev.toolCall || {
        name: toolName || ev.action || 'system_tool',
        tool: toolName || ev.action || 'system_tool',
        args: ev.args || ev.input || ev.parameters || ev.details || {},
      };
      const description = ev.description || (toolName ? `Execute tool: ${toolName}` : `Authorize action: ${ev.action}`);

      pendingAcpPermissions.set(permId, { client, rpcId: ev.rpcId, sessionId: ev.sessionId });
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'permission_required',
          permissionId: permId,
          description,
          toolCall,
          action: ev.action,
          target: ev.target || toolName,
          riskLevel: ev.riskLevel,
          expiresInMs: ev.expiresInMs,
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
        const statusLower = String(ev.status || '').toLowerCase();
        const isTerminal = statusLower === 'done' || statusLower === 'completed' || statusLower === 'idle' || statusLower === 'success' || statusLower === 'finished';
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: {
            type: isTerminal ? 'done' : 'status',
            status: ev.status,
            summary: ev.summary,
          },
          sessionId,
        }));

        if (isTerminal) {
          ws.send(JSON.stringify({
            type: 'chat_response',
            success: true,
            sessionId,
          }));
        }
      }
    });

    client.on('exit', ({ code, signal }: { code: number | null; signal: string | null }) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: {
            type: 'done',
            status: 'done',
            summary: `ACP process completed${code !== null ? ` (exit code: ${code})` : ''}`,
          },
          sessionId,
        }));
        ws.send(JSON.stringify({
          type: 'chat_response',
          success: code === 0 || code === null,
          sessionId,
        }));
      }
    });

    client.on('error', (err: any) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'agent_event',
          event: {
            type: 'done',
            status: 'error',
            summary: err?.message || String(err),
          },
          sessionId,
        }));
        ws.send(JSON.stringify({
          type: 'chat_response',
          success: false,
          sessionId,
          result: { error: err?.message || String(err) },
        }));
      }
    });

    // Auto cleanup when websocket closes
    ws.once('close', () => {
      activeEngineClients.delete(key);
      for (const [permId, pending] of pendingAcpPermissions.entries()) {
        if (pending.client === client) {
          pendingAcpPermissions.delete(permId);
        }
      }
      client.close();
    });

    await client.start();
    await client.initialize();
    const sessionRes = await client.newSession(workspacePath, 'tline', engineProfile.systemPromptAppend);
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
    await entry.client.sendPrompt(entry.acpSessionId, finalPrompt, undefined, {
      engine: engineId,
      systemPromptAppend: engineProfile.systemPromptAppend,
      mode: modeId,
      loop: (options as any).loop || (options as any).isLoop,
      goalMode: (options as any).goalMode || (options as any).goal,
    });
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
