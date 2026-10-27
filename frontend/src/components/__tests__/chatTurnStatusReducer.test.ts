import { describe, expect, it } from 'vitest';
import {
  applyChatTurnStatus,
  isDisplayCompletionEvent,
  type TurnRecord,
  type ChatTurnStatusPayload,
} from '../chatTurnStatusReducer';

describe('chatTurnStatusReducer', () => {
  it('identifies done and goal_done as display completion only', () => {
    expect(isDisplayCompletionEvent('done')).toBe(true);
    expect(isDisplayCompletionEvent('goal_done')).toBe(true);
    expect(isDisplayCompletionEvent('text_delta')).toBe(false);
    expect(isDisplayCompletionEvent('chat_turn_status')).toBe(false);
  });

  it('transitions through running to completed with authoritative outcome', () => {
    const turns = new Map<string, TurnRecord>();

    // 1. Running
    const runningPayload: ChatTurnStatusPayload = {
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_101',
      state: 'running',
    };
    const resRunning = applyChatTurnStatus(turns, runningPayload, 'sess_1');
    expect(resRunning.shouldSetLoading).toBe(true);
    expect(resRunning.progressMessage).toBe('Thinking...');
    expect(resRunning.nextTurns.get('turn_101')?.state).toBe('running');
    expect(resRunning.nextTurns.get('turn_101')?.terminal).toBe(false);

    // 2. Completed
    const completedPayload: ChatTurnStatusPayload = {
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_101',
      state: 'completed',
    };
    const resCompleted = applyChatTurnStatus(resRunning.nextTurns, completedPayload, 'sess_1');
    expect(resCompleted.shouldStopLoading).toBe(true);
    expect(resCompleted.nextTurns.get('turn_101')?.state).toBe('completed');
    expect(resCompleted.nextTurns.get('turn_101')?.outcome).toBe('completed');
    expect(resCompleted.nextTurns.get('turn_101')?.terminal).toBe(true);
  });

  it('preserves failed outcome with notification and prevents duplicate notifications on replay', () => {
    const turns = new Map<string, TurnRecord>();
    const failedPayload: ChatTurnStatusPayload = {
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_fail',
      state: 'failed',
      error: 'Disk quota exceeded',
    };

    // First arrival
    const res1 = applyChatTurnStatus(turns, failedPayload, 'sess_1');
    expect(res1.shouldStopLoading).toBe(true);
    expect(res1.nextTurns.get('turn_fail')?.outcome).toBe('failed');
    expect(res1.systemNotification?.text).toContain('Disk quota exceeded');

    // Replayed event (e.g. after SSE reconnect)
    const res2 = applyChatTurnStatus(res1.nextTurns, failedPayload, 'sess_1');
    expect(res2.ignoredReplay).toBe(true);
    expect(res2.systemNotification).toBeUndefined(); // Exactly-once: NO duplicate notification
  });

  it('preserves interrupted, cancelled, and needs-input outcomes', () => {
    const turns = new Map<string, TurnRecord>();

    // Interrupted
    const resInterrupted = applyChatTurnStatus(turns, {
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 't_int',
      state: 'interrupted',
      error: 'Timeout waiting for response',
    }, 'sess_1');
    expect(resInterrupted.nextTurns.get('t_int')?.outcome).toBe('interrupted');
    expect(resInterrupted.systemNotification?.outcome).toBe('interrupted');

    // Cancelled
    const resCancelled = applyChatTurnStatus(turns, {
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 't_canc',
      state: 'cancelled',
    }, 'sess_1');
    expect(resCancelled.nextTurns.get('t_canc')?.outcome).toBe('cancelled');

    // Needs input
    const resNeedsInput = applyChatTurnStatus(turns, {
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 't_input',
      state: 'needs-input',
    }, 'sess_1');
    expect(resNeedsInput.nextTurns.get('t_input')?.outcome).toBe('needs-input');
    expect(resNeedsInput.shouldStopLoading).toBe(true);
  });

  it('ignores replayed non-terminal states after a turn has reached terminal state', () => {
    const turns = new Map<string, TurnRecord>();
    const completed = applyChatTurnStatus(turns, {
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_done',
      state: 'completed',
    }, 'sess_1');

    // Replayed 'running' from SSE journal gap/reconnect must not regress state
    const replay = applyChatTurnStatus(completed.nextTurns, {
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_done',
      state: 'running',
    }, 'sess_1');

    expect(replay.ignoredReplay).toBe(true);
    expect(replay.nextTurns.get('turn_done')?.state).toBe('completed');
    expect(replay.nextTurns.get('turn_done')?.outcome).toBe('completed');
  });

  it('rejects events from other sessions', () => {
    const turns = new Map<string, TurnRecord>();
    const res = applyChatTurnStatus(turns, {
      type: 'chat_turn_status',
      sessionId: 'sess_OTHER',
      turnId: 'turn_x',
      state: 'completed',
    }, 'sess_ACTIVE');

    expect(res.ignoredReplay).toBe(true);
    expect(res.nextTurns.has('turn_x')).toBe(false);
  });
});
