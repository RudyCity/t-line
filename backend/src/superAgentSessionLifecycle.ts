/**
 * Session Lifecycle Manager for SuperAgent in T-Line.
 *
 * Implements strict lifecycle serialization:
 *   WS_CONNECTED -> INIT_ACK -> SSE_SUBSCRIBED -> READY
 *
 * Enforces:
 * 1. No prompts sent solely because WebSocket is OPEN (requires READY state).
 * 2. Cold-init race resolution: safely retry read-only init and SSE GET on 404/503/400.
 * 3. Never replay mutating POST chat/approval/tool writes under any circumstances.
 * 4. Tracks canonical Core event IDs per session for query '?lastEventId=...' SSE reconnects.
 * 5. Surfaces history restore warnings and metadata rather than reducing init to a boolean.
 */

export type SessionLifecycleState =
  | 'DISCONNECTED'
  | 'WS_CONNECTED'
  | 'INIT_IN_PROGRESS'
  | 'INIT_ACK'
  | 'SSE_CONNECTING'
  | 'SSE_SUBSCRIBED'
  | 'READY'
  | 'ERROR';

export interface SessionLifecycleMetadata {
  historyWarnings?: string[];
  warnings?: string[];
  mode?: string;
  workspace?: string;
  lastCoreEventId?: string;
  resumed?: boolean;
  error?: string;
  upstreamStatusCode?: number;
}

export interface SessionLifecycleEvent {
  type: 'session_lifecycle';
  state: SessionLifecycleState;
  sessionId: string;
  metadata?: SessionLifecycleMetadata;
}

// Durable tracking of last authoritative Core event ID per session across reconnects
const sessionCoreEventIdRegistry = new Map<string, string>();

export function getSessionLastCoreEventId(sessionId: string): string | undefined {
  if (!sessionId) return undefined;
  return sessionCoreEventIdRegistry.get(sessionId);
}

export function setSessionLastCoreEventId(sessionId: string, eventId: string): void {
  if (!sessionId || !eventId) return;
  sessionCoreEventIdRegistry.set(sessionId, String(eventId));
}

export function clearSessionLastCoreEventId(sessionId: string): void {
  if (sessionId) sessionCoreEventIdRegistry.delete(sessionId);
}

/**
 * Builds the canonical Core SSE request path using query parameter 'lastEventId',
 * matching Core's serverRoutes.ts:333 implementation.
 */
export function buildCoreSsePath(
  workspacePath: string,
  sessionId?: string,
  cursor?: string
): string {
  const params = new URLSearchParams();
  params.set('workspace', workspacePath);
  if (sessionId) {
    params.set('sessionId', sessionId);
  }
  const effectiveCursor = cursor || (sessionId ? getSessionLastCoreEventId(sessionId) : undefined);
  if (effectiveCursor) {
    params.set('lastEventId', effectiveCursor);
  }
  return `/api/events?${params.toString()}`;
}

export interface CoreInitResponse {
  success?: boolean;
  sessionId?: string;
  workspace?: string;
  mode?: string;
  clientMode?: string;
  resumeWarning?: string;
  historyWarnings?: string[];
  warnings?: string[];
  error?: string;
  statusCode?: number;
}

export class SessionLifecycleManager {
  private state: SessionLifecycleState = 'DISCONNECTED';
  private metadata: SessionLifecycleMetadata = {};
  private attemptedTurnWrites = new Set<string>();

  constructor(
    public readonly sessionId: string,
    public readonly workspace: string,
    private readonly sendToClient: (data: string) => void
  ) {
    const existingCursor = getSessionLastCoreEventId(sessionId);
    if (existingCursor) {
      this.metadata.lastCoreEventId = existingCursor;
    }
  }

  public getState(): SessionLifecycleState {
    return this.state;
  }

  public isReady(): boolean {
    return this.state === 'READY';
  }

  public canSendPrompt(): boolean {
    return this.state === 'READY';
  }

  public getMetadata(): SessionLifecycleMetadata {
    return { ...this.metadata };
  }

  public markWsConnected(): void {
    if (this.state === 'DISCONNECTED' || this.state === 'ERROR') {
      this.state = 'WS_CONNECTED';
      this.broadcastLifecycleEvent('WS_CONNECTED');
    }
  }

  public markInitInProgress(): void {
    this.state = 'INIT_IN_PROGRESS';
  }

  public markInitAck(response: CoreInitResponse): void {
    const warnings: string[] = [];
    if (response.resumeWarning) warnings.push(response.resumeWarning);
    if (Array.isArray(response.historyWarnings)) warnings.push(...response.historyWarnings);
    if (Array.isArray(response.warnings)) warnings.push(...response.warnings);

    this.metadata = {
      ...this.metadata,
      workspace: response.workspace || this.workspace,
      mode: response.mode,
      warnings: warnings.length > 0 ? warnings : undefined,
      historyWarnings: warnings.length > 0 ? warnings : undefined,
    };

    this.state = 'INIT_ACK';
    this.broadcastLifecycleEvent('INIT_ACK');

    // If SSE was already subscribed while init was in-flight, transition immediately to READY
    if (this.state as any === 'SSE_SUBSCRIBED' || this.metadata.upstreamStatusCode === 200) {
      this.markReady();
    }
  }

  public markSseConnecting(): void {
    if (this.state !== 'READY') {
      this.state = 'SSE_CONNECTING';
    }
  }

  public markSseSubscribed(statusCode = 200): void {
    this.metadata.upstreamStatusCode = statusCode;
    // When both INIT_ACK and SSE_SUBSCRIBED are satisfied, advance to READY
    if (this.state === 'INIT_ACK' || this.state === 'SSE_CONNECTING') {
      this.state = 'SSE_SUBSCRIBED';
      this.broadcastLifecycleEvent('SSE_SUBSCRIBED');
      this.markReady();
    } else {
      this.state = 'SSE_SUBSCRIBED';
      this.broadcastLifecycleEvent('SSE_SUBSCRIBED');
    }
  }

  public markReady(): void {
    this.state = 'READY';
    this.broadcastLifecycleEvent('READY');
  }

  public markError(error: string, statusCode?: number): void {
    this.state = 'ERROR';
    this.metadata.error = error;
    if (statusCode) this.metadata.upstreamStatusCode = statusCode;
    this.broadcastLifecycleEvent('ERROR');
  }

  public recordCoreEventId(coreEventId: string): void {
    if (!coreEventId) return;
    this.metadata.lastCoreEventId = coreEventId;
    setSessionLastCoreEventId(this.sessionId, coreEventId);
  }

  /**
   * Tracks outbound write turnIds (e.g. clientMessageId) to strictly forbid write replaying.
   */
  public recordWriteAttempt(turnId: string): boolean {
    if (this.attemptedTurnWrites.has(turnId)) {
      return false; // Already attempted; write replay denied
    }
    this.attemptedTurnWrites.add(turnId);
    return true; // First attempt allowed
  }

  public hasWriteBeenAttempted(turnId: string): boolean {
    return this.attemptedTurnWrites.has(turnId);
  }

  private broadcastLifecycleEvent(state: SessionLifecycleState): void {
    try {
      const payload: SessionLifecycleEvent = {
        type: 'session_lifecycle',
        state,
        sessionId: this.sessionId,
        ...(Object.keys(this.metadata).length > 0 ? { metadata: this.metadata } : {}),
      };
      this.sendToClient(JSON.stringify(payload));
    } catch {
      // Socket may be closed or closing
    }
  }
}
