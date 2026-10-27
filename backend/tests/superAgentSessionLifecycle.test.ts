import { describe, expect, it } from 'bun:test';
import {
  SessionLifecycleManager,
  buildCoreSsePath,
  setSessionLastCoreEventId,
  getSessionLastCoreEventId,
  clearSessionLastCoreEventId,
  type SessionLifecycleEvent,
} from '../src/superAgentSessionLifecycle';

describe('superAgentSessionLifecycle', () => {
  it('serializes lifecycle transitions: WS_CONNECTED -> INIT_ACK -> SSE_SUBSCRIBED -> READY', () => {
    const emitted: SessionLifecycleEvent[] = [];
    const client = (msg: string) => emitted.push(JSON.parse(msg));
    const manager = new SessionLifecycleManager('sess_1', '/workspace/demo', client);

    expect(manager.getState()).toBe('DISCONNECTED');
    expect(manager.canSendPrompt()).toBe(false);

    manager.markWsConnected();
    expect(manager.getState()).toBe('WS_CONNECTED');
    expect(manager.canSendPrompt()).toBe(false);

    manager.markInitAck({
      success: true,
      sessionId: 'sess_1',
      mode: 'single',
      resumeWarning: 'Warning: 1 turn restored with partial state',
    });
    expect(manager.getState()).toBe('INIT_ACK');
    expect(manager.canSendPrompt()).toBe(false);

    manager.markSseSubscribed(200);
    expect(manager.getState()).toBe('READY');
    expect(manager.canSendPrompt()).toBe(true);

    const states = emitted.map((e) => e.state);
    expect(states).toEqual(['WS_CONNECTED', 'INIT_ACK', 'SSE_SUBSCRIBED', 'READY']);

    const readyEvent = emitted.find((e) => e.state === 'READY');
    expect(readyEvent?.metadata?.warnings).toEqual(['Warning: 1 turn restored with partial state']);
    expect(readyEvent?.metadata?.historyWarnings).toEqual(['Warning: 1 turn restored with partial state']);
  });

  it('blocks cold first send while only WS_CONNECTED and not yet READY', () => {
    const emitted: SessionLifecycleEvent[] = [];
    const manager = new SessionLifecycleManager('sess_cold', '/workspace/demo', (msg) => emitted.push(JSON.parse(msg)));

    manager.markWsConnected();
    expect(manager.isReady()).toBe(false);
    expect(manager.canSendPrompt()).toBe(false);

    // Prompt dispatch must be gated until READY
    manager.markInitAck({ success: true, sessionId: 'sess_cold' });
    expect(manager.canSendPrompt()).toBe(false);

    manager.markSseSubscribed(200);
    expect(manager.canSendPrompt()).toBe(true);
  });

  it('persists Core event ID per session and reconnects with ?lastEventId= query parameter', () => {
    clearSessionLastCoreEventId('sess_cursor');
    const manager = new SessionLifecycleManager('sess_cursor', '/workspace/demo', () => {});

    // Initially no cursor
    expect(buildCoreSsePath('/workspace/demo', 'sess_cursor')).toBe(
      '/api/events?workspace=%2Fworkspace%2Fdemo&sessionId=sess_cursor'
    );

    // Core emits event with id: 'evt_98765'
    manager.recordCoreEventId('evt_98765');
    expect(getSessionLastCoreEventId('sess_cursor')).toBe('evt_98765');

    // On reconnect, the path contains &lastEventId=evt_98765 matching Core serverRoutes.ts:333
    const path = buildCoreSsePath('/workspace/demo', 'sess_cursor');
    expect(path).toContain('lastEventId=evt_98765');
    expect(path).toContain('sessionId=sess_cursor');
  });

  it('isolates state across session switches', () => {
    clearSessionLastCoreEventId('sess_A');
    clearSessionLastCoreEventId('sess_B');

    setSessionLastCoreEventId('sess_A', 'id_A');
    expect(getSessionLastCoreEventId('sess_A')).toBe('id_A');
    expect(getSessionLastCoreEventId('sess_B')).toBeUndefined();

    const pathA = buildCoreSsePath('/ws', 'sess_A');
    const pathB = buildCoreSsePath('/ws', 'sess_B');

    expect(pathA).toContain('lastEventId=id_A');
    expect(pathB).not.toContain('lastEventId');
  });

  it('enforces exactly-once write attempt and strictly forbids write replay', () => {
    const manager = new SessionLifecycleManager('sess_write', '/workspace/demo', () => {});
    const turnId = 'turn_msg_123456';

    expect(manager.hasWriteBeenAttempted(turnId)).toBe(false);

    // First attempt allowed
    const firstAllowed = manager.recordWriteAttempt(turnId);
    expect(firstAllowed).toBe(true);
    expect(manager.hasWriteBeenAttempted(turnId)).toBe(true);

    // Replay attempt rejected
    const replayAllowed = manager.recordWriteAttempt(turnId);
    expect(replayAllowed).toBe(false);
  });
});
