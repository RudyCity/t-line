import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAgentEventPayload } from '../SuperAgentConsoleUtils';
import { TurnRecord } from '../chatTurnStatusReducer';

describe('DEEP-06: chat_turn_status production integration through handleAgentEventPayload', () => {
  let loadingState: boolean;
  let toolProgressMsg: string;
  let messages: any[];
  let subagentList: any[];
  let turnRecordsRef: { current: Map<string, TurnRecord> };
  let isAbortedRef: { current: boolean };

  const mockSetLoading = vi.fn((l: boolean) => {
    loadingState = l;
  });
  const mockSetToolProgressMsg = vi.fn((m: string) => {
    toolProgressMsg = m;
  });
  const mockSetMessages = vi.fn((updater: any) => {
    messages = typeof updater === 'function' ? updater(messages) : updater;
  });
  const mockSetSubagentList = vi.fn((updater: any) => {
    subagentList = typeof updater === 'function' ? updater(subagentList) : updater;
  });
  const mockSetPendingPermission = vi.fn();
  const mockSetPendingQuestion = vi.fn();
  const mockSetSelectedQuestionAnswers = vi.fn();
  const mockSetCustomQuestionInput = vi.fn();
  const mockSetPendingPlanApproval = vi.fn();

  beforeEach(() => {
    loadingState = false;
    toolProgressMsg = '';
    messages = [];
    subagentList = [];
    turnRecordsRef = { current: new Map() };
    isAbortedRef = { current: false };
    vi.clearAllMocks();
  });

  const sendEvent = (payload: any, activeSessionId = 'sess_1') => {
    handleAgentEventPayload(
      payload,
      mockSetLoading,
      mockSetToolProgressMsg,
      mockSetMessages,
      mockSetSubagentList,
      mockSetPendingPermission,
      mockSetPendingQuestion,
      mockSetSelectedQuestionAnswers,
      mockSetCustomQuestionInput,
      mockSetPendingPlanApproval,
      isAbortedRef,
      activeSessionId,
      undefined,
      turnRecordsRef
    );
  };

  it('handles queued status by setting loading and progress message', () => {
    sendEvent({
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_q',
      state: 'queued',
    });

    expect(loadingState).toBe(true);
    expect(toolProgressMsg).toBe('Queued...');
    const record = turnRecordsRef.current.get('turn_q');
    expect(record).toBeDefined();
    expect(record?.state).toBe('queued');
    expect(record?.terminal).toBe(false);
  });

  it('handles running status by setting loading and progress message', () => {
    sendEvent({
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_r',
      state: 'running',
    });

    expect(loadingState).toBe(true);
    expect(toolProgressMsg).toBe('Thinking...');
    const record = turnRecordsRef.current.get('turn_r');
    expect(record?.state).toBe('running');
    expect(record?.terminal).toBe(false);
  });

  it('handles completed status and preserves outcome in turnRecordsRef', () => {
    sendEvent({
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_c',
      state: 'completed',
    });

    expect(loadingState).toBe(false);
    expect(toolProgressMsg).toBe('');
    expect(messages).toHaveLength(0); // No error notification for success
    const record = turnRecordsRef.current.get('turn_c');
    expect(record?.state).toBe('completed');
    expect(record?.outcome).toBe('completed');
    expect(record?.terminal).toBe(true);
  });

  it('handles failed status with single system notification', () => {
    sendEvent({
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_f',
      state: 'failed',
      error: 'Model provider quota exceeded',
    });

    expect(loadingState).toBe(false);
    expect(toolProgressMsg).toBe('');
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('system');
    expect(messages[0].text).toContain('❌ Turn failed: Model provider quota exceeded');

    const record = turnRecordsRef.current.get('turn_f');
    expect(record?.outcome).toBe('failed');
    expect(record?.terminal).toBe(true);
    expect(record?.notified).toBe(true);
  });

  it('handles interrupted status with notification', () => {
    sendEvent({
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_i',
      state: 'interrupted',
      error: 'Session worker was aborted by operator',
    });

    expect(loadingState).toBe(false);
    expect(toolProgressMsg).toBe('');
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain('⚠️ Turn interrupted: Session worker was aborted by operator');

    const record = turnRecordsRef.current.get('turn_i');
    expect(record?.outcome).toBe('interrupted');
    expect(record?.terminal).toBe(true);
  });

  it('handles cancelled status with notification', () => {
    sendEvent({
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_x',
      state: 'cancelled',
    });

    expect(loadingState).toBe(false);
    expect(toolProgressMsg).toBe('');
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain('⏹️ Turn cancelled.');

    const record = turnRecordsRef.current.get('turn_x');
    expect(record?.outcome).toBe('cancelled');
    expect(record?.terminal).toBe(true);
  });

  it('idempotently handles replayed terminal events and ignores late non-terminal events', () => {
    // 1. Initial failed event
    sendEvent({
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_replay',
      state: 'failed',
      error: 'Fatal crash in tool execution',
    });

    expect(messages).toHaveLength(1);
    expect(loadingState).toBe(false);
    const callCountAfterFirstFail = mockSetMessages.mock.calls.length;

    // 2. Exact duplicate replay
    sendEvent({
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_replay',
      state: 'failed',
      error: 'Fatal crash in tool execution',
    });

    // Notification must NOT be duplicated
    expect(messages).toHaveLength(1);
    expect(mockSetMessages.mock.calls.length).toBe(callCountAfterFirstFail);

    // 3. Out-of-order replayed 'running' event after turn is already terminal
    sendEvent({
      type: 'chat_turn_status',
      sessionId: 'sess_1',
      turnId: 'turn_replay',
      state: 'running',
    });

    // Spinner must NOT restart on replayed running event
    expect(loadingState).toBe(false);
    expect(messages).toHaveLength(1);
  });

  it('ignores events for a different session', () => {
    sendEvent(
      {
        type: 'chat_turn_status',
        sessionId: 'sess_unrelated',
        turnId: 'turn_other',
        state: 'failed',
        error: 'Should be ignored',
      },
      'sess_active_123'
    );

    expect(turnRecordsRef.current.has('turn_other')).toBe(false);
    expect(messages).toHaveLength(0);
    expect(mockSetLoading).not.toHaveBeenCalled();
  });
});
