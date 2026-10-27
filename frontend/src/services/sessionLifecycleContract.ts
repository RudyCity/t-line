/**
 * Typed lifecycle contract between SuperAgent bridge (backend) and T-Line frontend.
 *
 * Implements strict lifecycle states:
 *   WS_CONNECTED -> INIT_ACK -> SSE_SUBSCRIBED -> READY
 *
 * Provides typed contract for lifecycle events, metadata warnings, and history warnings.
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
  historyRestoreWarning?: string;
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
  meta?: SessionLifecycleMetadata;
}

/**
 * Extracts and deduplicates history and lifecycle warnings from a session_lifecycle event.
 */
export function extractLifecycleWarnings(payload: SessionLifecycleEvent | any): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const meta: SessionLifecycleMetadata | undefined = payload.metadata || payload.meta;
  if (!meta || typeof meta !== 'object') return [];

  const warnings: string[] = [];

  if (Array.isArray(meta.historyWarnings)) {
    for (const w of meta.historyWarnings) {
      if (typeof w === 'string' && w.trim() && !warnings.includes(w.trim())) {
        warnings.push(w.trim());
      }
    }
  }

  if (Array.isArray(meta.warnings)) {
    for (const w of meta.warnings) {
      if (typeof w === 'string' && w.trim() && !warnings.includes(w.trim())) {
        warnings.push(w.trim());
      }
    }
  }

  if (typeof meta.historyRestoreWarning === 'string' && meta.historyRestoreWarning.trim()) {
    const hw = meta.historyRestoreWarning.trim();
    if (!warnings.includes(hw)) {
      warnings.push(hw);
    }
  }

  return warnings;
}
