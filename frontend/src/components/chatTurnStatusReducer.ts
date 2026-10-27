/**
 * Authoritative chat turn outcome and status reducer for SuperAgent T-Line console.
 *
 * Enforces:
 * 1. Main chat state consumes authoritative 'chat_turn_status' emitted by Core.
 * 2. 'done' / 'goal_done' is display/streaming lifecycle completion only, NEVER proof of task success.
 * 3. Preserves completed, failed, interrupted, cancelled, and needs-input outcomes in the UX.
 * 4. Ensures exactly-once / idempotent behavior under reconnect and SSE replay.
 */

export type TurnOutcome = 'completed' | 'failed' | 'interrupted' | 'cancelled' | 'needs-input';
export type TurnState =
  | 'accepted'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'interrupted'
  | 'cancelled'
  | 'needs-input';

export interface ChatTurnStatusPayload {
  type: 'chat_turn_status';
  sessionId: string;
  workspace?: string;
  turnId: string;
  state: TurnState;
  error?: string;
}

export interface TurnRecord {
  turnId: string;
  sessionId: string;
  state: TurnState;
  outcome?: TurnOutcome;
  error?: string;
  terminal: boolean;
  notified: boolean;
  updatedAt: number;
}

export const TERMINAL_TURN_STATES = new Set<TurnState>([
  'completed',
  'failed',
  'interrupted',
  'cancelled',
]);

export function isTerminalState(state: TurnState): boolean {
  return TERMINAL_TURN_STATES.has(state);
}

/**
 * Checks whether an incoming SSE agent event is purely lifecycle/display completion.
 * 'done' or 'goal_done' stops streaming indicators, but MUST NOT be interpreted as task completion.
 */
export function isDisplayCompletionEvent(eventType?: string): boolean {
  return eventType === 'done' || eventType === 'goal_done';
}

export interface TurnReducerResult {
  nextTurns: Map<string, TurnRecord>;
  shouldStopLoading: boolean;
  shouldSetLoading: boolean;
  progressMessage?: string;
  systemNotification?: {
    role: 'system';
    text: string;
    turnId: string;
    outcome: TurnOutcome;
  };
  ignoredReplay: boolean;
}

/**
 * Idempotently applies a chat_turn_status event to the turns state.
 */
export function applyChatTurnStatus(
  currentTurns: Map<string, TurnRecord>,
  payload: ChatTurnStatusPayload,
  currentActiveSessionId?: string
): TurnReducerResult {
  const { sessionId, turnId, error } = payload;
  const state: TurnState = payload.state || (payload as any).status;

  // Session check with normalized matching
  if (currentActiveSessionId && sessionId && sessionId !== currentActiveSessionId) {
    const cleanA = sessionId.replace(/^(sess_|session_)/, '').split('::').pop() || sessionId;
    const cleanB = currentActiveSessionId.replace(/^(sess_|session_)/, '').split('::').pop() || currentActiveSessionId;
    if (cleanA !== cleanB) {
      return {
        nextTurns: currentTurns,
        shouldStopLoading: false,
        shouldSetLoading: false,
        ignoredReplay: true,
      };
    }
  }

  const existing = currentTurns.get(turnId);

  // If already reached a terminal state, ignore non-terminal replayed events
  if (existing?.terminal) {
    if (!isTerminalState(state) || existing.state === state) {
      return {
        nextTurns: currentTurns,
        shouldStopLoading: false,
        shouldSetLoading: false,
        ignoredReplay: true,
      };
    }
  }

  const nextTurns = new Map(currentTurns);
  const terminal = isTerminalState(state);
  const now = Date.now();

  let outcome: TurnOutcome | undefined = existing?.outcome;
  let shouldStopLoading = false;
  let shouldSetLoading = false;
  let progressMessage: string | undefined = undefined;
  let systemNotification: TurnReducerResult['systemNotification'] = undefined;

  switch (state) {
    case 'queued':
      shouldSetLoading = true;
      progressMessage = 'Queued...';
      break;
    case 'running':
      shouldSetLoading = true;
      progressMessage = 'Thinking...';
      break;
    case 'completed':
      outcome = 'completed';
      shouldStopLoading = true;
      progressMessage = '';
      break;
    case 'failed':
      outcome = 'failed';
      shouldStopLoading = true;
      progressMessage = '';
      if (!existing?.notified) {
        systemNotification = {
          role: 'system',
          text: `❌ Turn failed: ${error || 'Task execution failed.'}`,
          turnId,
          outcome: 'failed',
        };
      }
      break;
    case 'interrupted':
      outcome = 'interrupted';
      shouldStopLoading = true;
      progressMessage = '';
      if (!existing?.notified) {
        systemNotification = {
          role: 'system',
          text: `⚠️ Turn interrupted: ${error || 'Execution stopped before completion.'}`,
          turnId,
          outcome: 'interrupted',
        };
      }
      break;
    case 'cancelled':
      outcome = 'cancelled';
      shouldStopLoading = true;
      progressMessage = '';
      if (!existing?.notified) {
        systemNotification = {
          role: 'system',
          text: `⏹️ Turn cancelled.`,
          turnId,
          outcome: 'cancelled',
        };
      }
      break;
    case 'needs-input':
      outcome = 'needs-input';
      shouldStopLoading = true;
      progressMessage = 'Awaiting input...';
      break;
  }

  const record: TurnRecord = {
    turnId,
    sessionId,
    state,
    outcome,
    error,
    terminal,
    notified: existing?.notified || Boolean(systemNotification),
    updatedAt: now,
  };

  nextTurns.set(turnId, record);

  return {
    nextTurns,
    shouldStopLoading,
    shouldSetLoading,
    progressMessage,
    systemNotification,
    ignoredReplay: false,
  };
}
