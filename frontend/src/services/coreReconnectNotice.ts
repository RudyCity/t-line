/**
 * Wire format for supervised-Core recovery messages from the authenticated
 * local T-Line backend. Nothing in this module resends pending chat/tool POSTs.
 */
export type CoreReconnectPhase =
  'offline' | 'explicit_resume_required' | 'review_required' | 'connected';
export interface CoreReconnectNotice {
  type: 'core_reconnect_state';
  sessionId: string;
  phase: CoreReconnectPhase;
  code: string;
  message: string;
  automaticChatReplayAllowed: false;
}
const phases = ['offline', 'explicit_resume_required', 'review_required', 'connected'];
export function parseCoreReconnectNotice(value: unknown, currentSessionId: string): CoreReconnectNotice | null {
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  if (m.type !== 'core_reconnect_state' || m.sessionId !== currentSessionId ||
      !phases.includes(String(m.phase)) ||
      typeof m.message !== 'string' || m.message.length > 450 ||
      typeof m.code !== 'string' || m.code.length > 60 ||
      m.automaticChatReplayAllowed !== false) return null;
  return value as CoreReconnectNotice;
}
export function reconnectAction(phase: CoreReconnectPhase): 'check' | 'resume' | 'review' {
  return phase === 'explicit_resume_required' ? 'resume' :
    phase === 'review_required' ? 'review' : 'check';
}
