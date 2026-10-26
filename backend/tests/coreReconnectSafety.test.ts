import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyCoreReconnect, isExplicitResumeRequest } from '../src/coreReconnectSafety';
describe('T-Line Core recovery is user-driven and never replays side effects', () => {
  it('has one outbound chat send and no automatic network-error replay path', () => {
    const source = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/superAgentBridge.ts'), 'utf8');
    const chatBlock = source.split("if (actionType === 'prompt') {")[1]
      ?.split("} else if (actionType === 'approve_permission')")[0] || '';
    expect((chatBlock.match(/sendSuperAgentRequest\('\/api\/chat'/g) || []).length).toBe(1);
    expect(chatBlock).toContain('uncertainWrite: true');
    expect(chatBlock).not.toContain('response = await sendSuperAgentRequest(\'/api/chat\', chatPayload, workspacePath);\n            }');
  });
  it('marks ambiguous outbound POST as an unconfirmed outcome, not an automatic retry', () => {
    const result = classifyCoreReconnect({ sessionId: 'sess_123456', uncertainWrite: true });
    expect(result.phase).toBe('review_required');
    expect(result.code).toBe('UNCONFIRMED_CHAT_OUTCOME');
    expect(result.automaticChatReplayAllowed).toBe(false);
  });
  it('requires explicit action when session worker is gone', () => {
    const result = classifyCoreReconnect({
      sessionId: 'sess_123456', statusCode: 503, upstreamCode: 'SESSION_WORKER_DEAD',
    });
    expect(result.phase).toBe('explicit_resume_required');
    expect(result.automaticChatReplayAllowed).toBe(false);
  });
  it('retries only safe health probes on temporary Core outages', () => {
    const result = classifyCoreReconnect({
      sessionId: 'sess_123456', statusCode: 503, upstreamCode: 'CORE_SUPERVISOR_UNAVAILABLE',
    });
    expect(result.phase).toBe('offline');
    expect(result.automaticChatReplayAllowed).toBe(false);
  });
  it('keeps the read-only SSE recovery active after long outages', () => {
    const source = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/superAgentBridge.ts'), 'utf8');
    expect(source).not.toContain('sseReconnectAttempts >= 8');
    expect(source).toContain('sseReconnectAttempts = Math.min(sseReconnectAttempts + 1, 32)');
  });
  it('refuses cross-session or implicit resume', () => {
    expect(isExplicitResumeRequest({
      channelSessionId: 'sess_123456', requestedSessionId: 'sess_123456', approval: true,
    })).toBe(true);
    expect(isExplicitResumeRequest({
      channelSessionId: 'sess_123456', requestedSessionId: 'another', approval: true,
    })).toBe(false);
    expect(isExplicitResumeRequest({
      channelSessionId: 'sess_123456', requestedSessionId: 'sess_123456', approval: false,
    })).toBe(false);
  });
});
