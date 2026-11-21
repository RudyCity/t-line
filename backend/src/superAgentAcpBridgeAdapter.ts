/**
 * Agent Client Protocol (ACP) - WebSocket Bridge Adapter for T-Line
 * Translates between T-Line frontend WebSocket messages and the SuperAgentAcpClient
 * to deliver real-time streaming tokens, thought streams, tool events, and permission gates.
 */

import type WebSocket from 'ws';
import { SuperAgentAcpClient, type AcpPermissionRequest } from './superAgentAcpClient';

export interface AcpBridgeAdapterOptions {
  client: SuperAgentAcpClient;
  ws: WebSocket;
  workspacePath: string;
  defaultSessionId?: string;
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
    this.client = options.client;
    this.ws = options.ws;
    this.workspacePath = options.workspacePath;
    this.activeSessionId = options.defaultSessionId || `session_${Date.now()}`;

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
    // 1. Thought Stream
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

    // 5. Agent Status Change
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
    });

    // 6. Reverse Permission Request (Human-in-the-Loop)
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

    // A. Handle Prompt Submission
    if (msg.type === 'prompt' && typeof msg.prompt === 'string') {
      const sessionId = msg.sessionId || this.activeSessionId;
      const targetEngine = msg.engine || this.activeEngine;

      if (targetEngine !== this.activeEngine) {
        this.activeEngine = targetEngine;
        this.sendToFrontend({
          type: 'agent_event',
          event: {
            type: 'status',
            summary: `Execution engine switched to ${targetEngine}. Context preserved.`,
          },
          sessionId,
        });
      }

      const promptContext = {
        ...(msg.context || {}),
        engine: this.activeEngine,
        history: Array.isArray(msg.history) ? msg.history : [],
      };

      try {
        await this.client.sendPrompt(sessionId, msg.prompt, msg.attachments, promptContext);
      } catch (err: any) {
        this.sendToFrontend({
          type: 'error',
          message: err?.message || String(err),
          sessionId,
        });
      }
      return;
    }

    // B. Handle Permission Decision Response from Frontend Modal
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

    // C. Handle Task Cancellation
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
  }
}
