import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCoreAgentTimeline } from '../CoreAgentTimelineApi';
afterEach(() => { vi.unstubAllGlobals(); });
const event = { seq: 1, kind: 'tool_start', actor: 'main', tool: 'read_files', at: 1792960000000, status: 'running' };
const auth = () => ({ Authorization: 'Bearer tline' });
describe('Core execution journal client', () => {
  it('reads only the session and workspace-scoped GET route', async () => {
    const fetcher = vi.fn(async (_url: string, _opts: RequestInit) => ({
      ok: true, json: async () => ({ schemaVersion: 1, success: true, sessionId: 'session_1',
        events: [event], nextCursor: 1, gap: false }),
    }));
    vi.stubGlobal('fetch', fetcher);
    const result = await getCoreAgentTimeline('D:/project', 'session_1', 0, auth);
    expect(result.events).toEqual([event]);
    expect(fetcher.mock.calls[0][0]).toBe(
      '/api/superagent/assistant/agent-timeline?workspace=D%3A%2Fproject&sessionId=session_1&cursor=0');
    expect(fetcher.mock.calls[0][1].method).toBe('GET');
    expect(fetcher.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer tline' });
  });
  it('rejects cross-session, nonmonotonic and extraneous sensitive fields', async () => {
    const invalid = [
      { sessionId: 'other', events: [event], nextCursor: 1 },
      { sessionId: 'session_1', events: [event, { ...event, seq: 1 }], nextCursor: 1 },
      { sessionId: 'session_1', events: [{ ...event, actor: 'sub:D:/secret' }], nextCursor: 1 },
      { sessionId: 'session_1', events: [{ ...event, tool: 'cmd /secret' }], nextCursor: 1 },
      { sessionId: 'session_1', events: [{ ...event, seq: 0 }], nextCursor: 0 },
    ];
    for (const row of invalid) {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
        schemaVersion: 1, success: true, gap: false, ...row,
      }) })));
      await expect(getCoreAgentTimeline('D:/project', 'session_1', 0, auth))
        .rejects.toThrow(/Invalid Core agent timeline response/);
    }
  });
  it('rejects cursor errors before request and detects gap flag from journal', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(getCoreAgentTimeline('D:/project', 'session_1', -1, auth)).rejects.toThrow(/cursor/);
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      schemaVersion: 1, success: true, sessionId: 'session_1', events: [],
      nextCursor: 100, gap: true,
    }) })));
    expect((await getCoreAgentTimeline('D:/project', 'session_1', 100, auth)).gap).toBe(true);
  });
});
