/**
 * Agent Client Protocol (ACP) - Desktop Client for T-Line
 * Standardized JSON-RPC 2.0 client that spawns and orchestrates Superagent Core
 * as an autonomous ACP subprocess over line-delimited stdio or streams.
 */

import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import type { Readable, Writable } from 'stream';

export interface AcpClientOptions {
  superAgentCliPath?: string;
  workspacePath?: string;
  bunCommand?: string;
  inputStream?: Readable;
  outputStream?: Writable;
  spawnSubprocess?: boolean;
}

export interface AcpInitializeResult {
  protocolVersion: string;
  agentInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    promptStreaming?: boolean;
    toolExecution?: boolean;
    multiTierAgents?: boolean;
    permissionEscalation?: boolean;
  };
  supportedMethods: string[];
}

export interface AcpSessionUpdate {
  sessionId: string;
  seq: number;
  timestamp: number;
  update: {
    kind: string;
    delta?: string;
    tool?: string;
    actor?: string;
    callId?: string;
    status?: string;
    summary?: string;
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
   * Spawns the Superagent CLI subprocess in ACP mode (`superagent --acp`).
   */
  public async start(): Promise<void> {
    if (this.isConnected) return;

    if (this.options.spawnSubprocess && this.options.superAgentCliPath) {
      const args = [this.options.superAgentCliPath, '--acp'];
      if (this.options.workspacePath) {
        args.push('-w', this.options.workspacePath);
      }

      this.process = spawn(this.options.bunCommand || 'bun', args, {
        cwd: this.options.workspacePath || process.cwd(),
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process.stdout || !this.process.stdin) {
        throw new Error('Failed to attach stdio pipes to Superagent ACP subprocess');
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
    } else if (!this.inputStream || !this.outputStream) {
      throw new Error('SuperAgentAcpClient requires either a cliPath or custom streams');
    }
  }

  /**
   * Sends JSON-RPC `initialize` handshake.
   */
  public async initialize(): Promise<AcpInitializeResult> {
    return this.sendRequest<AcpInitializeResult>('initialize', {
      protocolVersion: '1.0.0',
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
   * Creates an isolated conversation session in Superagent.
   */
  public async newSession(
    workspacePath?: string,
    clientMode: 'tline' | 'zed' | 'generic' = 'tline'
  ): Promise<{ sessionId: string; workspacePath: string }> {
    return this.sendRequest('session/new', {
      workspacePath: workspacePath || this.options.workspacePath || process.cwd(),
      clientMode,
    });
  }

  /**
   * Sends a user prompt to the active session.
   */
  public async sendPrompt(
    sessionId: string,
    prompt: string,
    attachments?: any[],
    context?: any
  ): Promise<{ promptId: string; accepted: boolean }> {
    return this.sendRequest('session/prompt', {
      sessionId,
      prompt,
      attachments,
      context,
    });
  }

  /**
   * Cancels an ongoing task session.
   */
  public async cancelSession(sessionId: string, reason?: string): Promise<{ cancelled: boolean }> {
    return this.sendRequest('session/cancel', {
      sessionId,
      reason,
    });
  }

  /**
   * Responds to an ACP `session/request_permission` callback from Superagent.
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
  public async sendRequest<T = any>(method: string, params: any, timeoutMs = 30000): Promise<T> {
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

    // 1. Inbound Notification: session/update
    if (msg.method === 'session/update' && msg.params) {
      const updateData: AcpSessionUpdate = msg.params;
      this.emit('update', updateData);

      const kind = updateData.update?.kind;
      if (kind === 'text_chunk') {
        this.emit('text', { sessionId: updateData.sessionId, delta: updateData.update.delta });
      } else if (kind === 'thought_chunk') {
        this.emit('thought', { sessionId: updateData.sessionId, delta: updateData.update.delta });
      } else if (kind === 'tool_call_start') {
        this.emit('tool_call_start', { sessionId: updateData.sessionId, ...updateData.update });
      } else if (kind === 'tool_call_end') {
        this.emit('tool_call_end', { sessionId: updateData.sessionId, ...updateData.update });
      } else if (kind === 'status_change') {
        this.emit('status', { sessionId: updateData.sessionId, ...updateData.update });
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

  /**
   * Closes the ACP Client connection and kills child subprocess if spawned.
   */
  public close(): void {
    this.isConnected = false;
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('ACP Client closed'));
    }
    this.pendingRequests.clear();

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
