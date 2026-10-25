import { describe, expect, it } from 'vitest';
import { parseCoreReconnectNotice, reconnectAction } from '../../services/coreReconnectNotice';
describe('Core reconnect UI payload', () => {
  const sample = {
    type: 'core_reconnect_state', sessionId: 'sess_12345', code: 'SESSION_WORKER_DEAD',
    phase: 'explicit_resume_required', message: 'Saved session requires approval',
    automaticChatReplayAllowed: false,
  };
  it('rejects messages from another session or with replay enabled', () => {
    expect(parseCoreReconnectNotice(sample, 'another')).toBeNull();
    expect(parseCoreReconnectNotice({...sample, automaticChatReplayAllowed: true}, sample.sessionId)).toBeNull();
    expect(parseCoreReconnectNotice({...sample, phase: 'unknown'}, sample.sessionId)).toBeNull();
  });
  it('allows explicit resume UI only for dead-session state', () => {
    expect(parseCoreReconnectNotice(sample, sample.sessionId)).not.toBeNull();
    expect(reconnectAction('explicit_resume_required')).toBe('resume');
    expect(reconnectAction('offline')).toBe('check');
    expect(reconnectAction('review_required')).toBe('review');
  });
});
