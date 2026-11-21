/**
 * Agent Client Protocol (ACP) - Universal Desktop Client for T-Line
 * Standardized JSON-RPC 2.0 client that spawns and orchestrates ANY ACP-compliant server
 * (Antigravity agy.exe, Superagent Core, Codex, or Custom third-party ACP servers)
 * over line-delimited stdio or duplex streams.
 */

import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import type { Readable, Writable } from 'stream';

export interface AcpClientOptions {
  command?: string;
  args?: string[];
  bunCommand?: string;
  superAgentCliPath?: string;
  workspacePath?: string;
  inputStream?: Readable;
  outputStream?: Writable;
  spawnSubprocess?: boolean;
  env?: Record<string, string>;
}

export interface AcpInitializeResult {
  protocolVersion: number | string;
  agentInfo: {
    name: string;
    version: string;
  };
  agentCapabilities?: Record<string, any>;
  capabilities?: Record<string, any>;
  models?: Record<string, any>;
  authMethods?: any[];
  supportedMethods?: string[];
}

export interface AcpSessionUpdate {
  sessionId: string;
  seq?: number;
  timestamp?: number;
  update: {
    sessionUpdate?: string;
    kind?: string;
    delta?: string;
    content?: {
      type: string;
      text?: string;
      [key: string]: any;
    };
    tool?: string;
    actor?: string;
    callId?: string;
    status?: string;
    summary?: string;
    used?: number;
    size?: number;
    [key: string]: any;
  };
}

export interface AcpPermissionRequest {
  permissionId: string;
  sessionId: string;
  workspacePath: string;
  action: 'file_write' | 'command_execute' | 'network_access' | 'subagent_spawn' | 'mcp_grant';
  target: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  expiresInMs: number;
}

export class SuperAgentAcpClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private inputStream: Readable | null = null;
  private outputStream: Writable | null = null;
  private buffer = '';
  private requestId = 1;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timer: NodeJS.Timeout;
    }
  >();

  private options: AcpClientOptions;
  private isConnected = false;
  private currentSessionId = '';

  constructor(options: AcpClientOptions = {}) {
    super();
    this.options = {
      bunCommand: 'bun',
      spawnSubprocess: true,
      ...options,
    };

    if (options.inputStream && options.outputStream) {
      this.bindStreams(options.inputStream, options.outputStream);
    }
  }

  /**
   * Binds to existing streams (useful for tests or custom IPC).
   */
  public bindStreams(input: Readable, output: Writable): void {
    this.inputStream = input;
    this.outputStream = output;
    this.isConnected = true;

    this.inputStream.on('data', (chunk) => this.handleData(chunk));
    this.inputStream.on('error', (err) => this.emit('error', err));
  }

  /**
   * Spawns the ACP server process (agy.exe acp, superagent --acp, codex acp, etc.).
   */
  public async start(): Promise<void> {
    if (this.isConnected) return;

    if (this.options.spawnSubprocess) {
      let cmd = this.options.command;
      let args = this.options.args || [];

      // Fallback for legacy superagentCliPath option
      if (!cmd && this.options.superAgentCliPath) {
        cmd = this.options.bunCommand || 'bun';
        args = [this.options.superAgentCliPath, '--acp'];
        if (this.options.workspacePath) {
          args.push('-w', this.options.workspacePath);
        }
      }

      if (!cmd) {
        throw new Error('SuperAgentAcpClient: neither command nor superAgentCliPath provided');
      }

      const cwd = this.options.workspacePath || process.cwd();
      const env = {
        ...process.env,
        ...(this.options.env || {}),
      };

      this.process = spawn(cmd, args, {
        cwd,
        env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process.stdout || !this.process.stdin) {
        throw new Error(`Failed to attach stdio pipes to ACP process (${cmd})`);
      }

      this.bindStreams(this.process.stdout, this.process.stdin);

      this.process.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        this.emit('stderr', text);
      });

      this.process.on('exit', (code, signal) => {
        this.isConnected = false;
        this.emit('exit', { code, signal });
      });

      this.process.on('error', (err) => {
        this.emit('error', err);
      });
    } else if (!this.inputStream || !this.outputStream) {
      throw new Error('SuperAgentAcpClient requires either command or custom streams');
    }
  }

  /**
   * Sends JSON-RPC `initialize` handshake compliant with ACP v1 (integer protocolVersion).
   */
  public async initialize(): Promise<AcpInitializeResult> {
    return this.sendRequest<AcpInitializeResult>('initialize', {
      protocolVersion: 1, // Standard integer protocol version for universal ACP (agy, zed, superagent)
      clientInfo: {
        name: 'tline-desktop',
        version: '1.3.752',
      },
      capabilities: {
        streaming: true,
        diffInspection: true,
        interactivePermissions: true,
      },
      workspace: {
        workspacePath: this.options.workspacePath || process.cwd(),
      },
    });
  }

  /**
   * Creates an isolated conversation session in the ACP server.
   */
  public async newSession(
    workspacePath?: string,
    clientMode: 'tline' | 'zed' | 'generic' = 'tline',
    systemPromptAppend?: string
  ): Promise<{ sessionId: string; workspacePath: string; models?: any; modes?: any }> {
    const cwd = workspacePath || this.options.workspacePath || process.cwd();
    const params: Record<string, any> = {
      cwd,
      workspacePath: cwd,
      clientMode,
    };

    if (systemPromptAppend) {
      params.systemPrompt = systemPromptAppend;
      params._meta = {
        antigravity: {
          systemPrompt: {
            append: systemPromptAppend,
          },
        },
      };
    }

    const res = await this.sendRequest('session/new', params);

    if (res?.sessionId) {
      this.currentSessionId = res.sessionId;
    }

    return {
      sessionId: res?.sessionId || this.currentSessionId,
      workspacePath: cwd,
      models: res?.models,
      modes: res?.modes,
    };
  }

  /**
   * Sends a user prompt to the active session.
   * Supports both plain string or structured content block arrays.
   */
  public async sendPrompt(
    sessionId: string,
    prompt: string | any[],
    attachments?: any[],
    context?: any
  ): Promise<any> {
    const targetSessionId = sessionId || this.currentSessionId;
    
    // Normalize prompt to ACP universal content array format: [{ type: "text", text: "..." }]
    let promptPayload: any[];
    if (typeof prompt === 'string') {
      promptPayload = [{ type: 'text', text: prompt }];
    } else if (Array.isArray(prompt)) {
      promptPayload = prompt;
    } else {
      promptPayload = [{ type: 'text', text: String(prompt || '') }];
    }

    const res = await this.sendRequest('session/prompt', {
      sessionId: targetSessionId,
      prompt: promptPayload,
      attachments,
      context,
    }, 180000); // 3 minutes timeout for deep reasoning / big turns

    // Emit turn completed when prompt returns
    this.emit('status', {
      sessionId: targetSessionId,
      status: 'done',
      summary: 'Turn completed',
      usage: res?.usage,
    });

    return res;
  }

  /**
   * Updates the active model for an ACP session (e.g. gemini-3.8-flash-high, claude-sonnet-4-6).
   */
  public async setModel(sessionId: string, modelId: string): Promise<any> {
    const targetSessionId = sessionId || this.currentSessionId;
    return this.sendRequest('session/set_model', {
      sessionId: targetSessionId,
      modelId,
    });
  }

  /**
   * Updates the active mode for an ACP session (e.g. default, accept-edits, auto, plan).
   */
  public async setMode(sessionId: string, modeId: string): Promise<any> {
    const targetSessionId = sessionId || this.currentSessionId;
    return this.sendRequest('session/set_mode', {
      sessionId: targetSessionId,
      modeId,
    });
  }

  /**
   * Cancels an ongoing task session.
   */
  public async cancelSession(sessionId: string, reason?: string): Promise<{ cancelled: boolean }> {
    return this.sendRequest('session/cancel', {
      sessionId: sessionId || this.currentSessionId,
      reason,
    });
  }

  /**
   * Responds to an ACP `session/request_permission` callback.
   */
  public respondPermission(
    permissionRpcId: string | number,
    decision: 'approved' | 'approved_session' | 'denied' | 'cancelled',
    reason?: string
  ): void {
    const payload = {
      jsonrpc: '2.0',
      id: permissionRpcId,
      result: {
        decision,
        reason,
        decidedAt: Date.now(),
      },
    };
    this.writeMessage(payload);
  }

  /**
   * Low-level JSON-RPC request sender.
   */
  public async sendRequest<T = any>(method: string, params: any, timeoutMs = 45000): Promise<T> {
    const id = this.requestId++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`ACP request '${method}' (id: ${id}) timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.writeMessage(payload);
    });
  }

  private writeMessage(msg: any): void {
    if (!this.outputStream || !this.isConnected) {
      throw new Error('ACP Client is not connected');
    }
    this.outputStream.write(JSON.stringify(msg) + '\n');
  }

  private handleData(chunk: Buffer | string): void {
    this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');

    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);

      if (line.length > 0) {
        this.dispatchIncomingLine(line);
      }
    }
  }

  private dispatchIncomingLine(line: string): void {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    // 1. Inbound Notification: session/update (Universal ACP & Custom flavors)
    if (msg.method === 'session/update' && msg.params) {
      const updateData: AcpSessionUpdate = msg.params;
      this.emit('update', updateData);

      const sessId = updateData.sessionId || this.currentSessionId;
      const updateObj: any = updateData.update || {};
      const sessionUpdate = updateObj.sessionUpdate;
      const kind = updateObj.kind;

      // A. Text Content Stream
      if (sessionUpdate === 'agent_message_chunk' && updateObj.content?.text) {
        this.emit('text', { sessionId: sessId, delta: updateObj.content.text });
      } else if (kind === 'text_chunk' && updateObj.delta) {
        this.emit('text', { sessionId: sessId, delta: updateObj.delta });
      }

      // B. Thought Process Stream (Accordion)
      else if (sessionUpdate === 'agent_thought_chunk' && updateObj.content?.text) {
        this.emit('thought', { sessionId: sessId, delta: updateObj.content.text });
      } else if (kind === 'thought_chunk' && updateObj.delta) {
        this.emit('thought', { sessionId: sessId, delta: updateObj.delta });
      }

      // C. Tool Execution Start
      else if (sessionUpdate === 'tool_call' || kind === 'tool_call_start') {
        const toolName = typeof updateObj.tool === 'string'
          ? updateObj.tool
          : (updateObj.tool?.name || updateObj.name || updateObj.title || updateObj.tool?.tool);
        const callId = (typeof updateObj.tool === 'object' && (updateObj.tool?.callId || updateObj.tool?.id))
          || updateObj.callId
          || updateObj.toolCallId
          || updateObj.id
          || `call_${Date.now()}`;
        const description = (typeof updateObj.tool === 'object' && (updateObj.tool?.description || updateObj.tool?.args))
          || updateObj.description
          || updateObj.args;

        this.emit('tool_call_start', {
          sessionId: sessId,
          callId,
          tool: toolName,
          description,
        });
      }

      // D. Tool Execution End
      else if (sessionUpdate === 'tool_result' || kind === 'tool_call_end') {
        const toolName = typeof updateObj.tool === 'string'
          ? updateObj.tool
          : (updateObj.tool?.name || updateObj.name || updateObj.title || updateObj.tool?.tool);
        const callId = (typeof updateObj.tool === 'object' && (updateObj.tool?.callId || updateObj.tool?.id))
          || updateObj.callId
          || updateObj.toolCallId
          || updateObj.id;
        const status = (typeof updateObj.tool === 'object' && updateObj.tool?.status)
          || updateObj.status
          || (updateObj.isError ? 'failed' : 'completed');

        this.emit('tool_call_end', {
          sessionId: sessId,
          callId,
          tool: toolName,
          status,
        });
      }

      // E. Usage Update
      else if (sessionUpdate === 'usage_update') {
        this.emit('usage', {
          sessionId: sessId,
          used: updateObj.used || 0,
          size: updateObj.size || 1048576,
        });
      }

      // F. Status Change
      else if (kind === 'status_change') {
        this.emit('status', { sessionId: sessId, ...updateObj });
      }
      return;
    }

    // 2. Inbound Request: session/request_permission (Reverse callback from Agent)
    if (msg.method === 'session/request_permission' && msg.id !== undefined) {
      const request: AcpPermissionRequest = msg.params;
      this.emit('permission_requested', {
        rpcId: msg.id,
        ...request,
        reply: (decision: 'approved' | 'approved_session' | 'denied' | 'cancelled') => {
          this.respondPermission(msg.id, decision);
        },
      });
      return;
    }

    // 3. Inbound Response to our request
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        clearTimeout(pending.timer);

        if (msg.error) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.result);
        }
      }
    }
  }

  public getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * Closes the ACP Client connection and kills child subprocess if spawned.
   */
  public close(): void {
    this.isConnected = false;
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('ACP Client closed'));
    }
    this.pendingRequests.clear();

    if (this.process) {
      try {
        this.process.kill();
      } catch {}
      this.process = null;
    }
  }
}
