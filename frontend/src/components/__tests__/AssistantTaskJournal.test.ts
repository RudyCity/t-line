import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAssistantTaskEvents } from '../AssistantTaskDraftApi';

afterEach(() => vi.unstubAllGlobals());
const auth = () => ({ Authorization: 'Bearer example' });
const task = 'c7ba78d0-1719-4a8e-90b4-15832cf48114';
const journal = [
  { seq: 1, taskId: task, status: 'queued', at: 1792960000000, revision: 1 },
  { seq: 2, taskId: task, status: 'planning', at: 1792960010000, revision: 2 },
  { seq: 3, taskId: task, status: 'running', at: 1792960020000, revision: 3 },
];

describe('Core durable assistant task timeline API', () => {
  it('reads a strictly scoped endpoint with no operation mutation', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({
      success: true, sessionId: 'sess_1', events: journal, nextCursor: 3,
    }) }));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await getAssistantTaskEvents('D:/project', 'sess_1', 0, auth);
    expect(result.events).toEqual(journal);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/superagent/assistant/tasks/events?');
    expect(url).toContain('sessionId=sess_1');
    expect(url).toContain('workspace=D%3A%2Fproject');
    expect(url).toContain('cursor=0');
    expect(options.method).toBeUndefined();
    expect(options.headers).toEqual({ Authorization: 'Bearer example' });
  });

  it('refuses invalid cursors before sending any request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(getAssistantTaskEvents('D:/p', 'sess_1', -1, auth)).rejects.toThrow(/cursor/);
    await expect(getAssistantTaskEvents('D:/p', 'sess_1', NaN, auth)).rejects.toThrow(/cursor/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects other-session events rather than mixing timeline histories', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
      success: true, sessionId: 'sess_other', events: journal, nextCursor: 3,
    }) })));
    await expect(getAssistantTaskEvents('D:/project', 'sess_1', 0, auth))
      .rejects.toThrow(/timeline response/);
  });

  it('rejects nonmonotonic, conflicting or invalid Core revisions', async () => {
    const invalid = [
      { events: [journal[1], journal[0]], nextCursor: 1 },
      { events: journal, nextCursor: 999 },
      { events: [{ ...journal[0], revision: 0 }], nextCursor: 1 },
      { events: [{ ...journal[0], taskId: '../other' }], nextCursor: 1 },
      { events: [{ ...journal[0], seq: 0 }], nextCursor: 0 },
    ];
    for (const entry of invalid) {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({
        success: true, sessionId: 'sess_1', ...entry,
      }) })));
      await expect(getAssistantTaskEvents('D:/project', 'sess_1', 0, auth))
        .rejects.toThrow(/timeline response/);
    }
  });
});
