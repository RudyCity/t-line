import { describe, expect, it, vi } from 'vitest';
import { TaskSseParser, readTaskSseStream, checkTaskSseCapability } from '../SuperAgentTaskEvents';

const id = 'a'.repeat(16) + '.1';
const task = { schemaVersion: 1, channel: 'cli', taskId: 'example', sessionId: null,
  status: 'running', evidence: 'unverified', authorization: 'workspace_scoped',
  notification: 'not_configured', updatedAt: 10 };
const snap = { success: true, schemaVersion: 1, scope: 'workspace', source: 'bounded-polling',
  replaySupported: false, changed: true, cursor: 'b'.repeat(64),
  tasks: [task], total: 1, incompleteSources: [] };
const raw = `id: ${id}\nevent: snapshot\ndata: ${JSON.stringify(snap)}\n\n`;
const reply = (value: unknown, status = 200) => ({
  ok: status === 200, status, json: async () => value,
}) as Response;

describe('SSE task feed client and parser', () => {
  it('parses split multibyte and CRLF-delimited chunks without dropping event IDs', () => {
    const parser = new TaskSseParser();
    expect(parser.feed(raw.slice(0, 17))).toEqual([]);
    const parsed = parser.feed(raw.slice(17));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('snapshot');
    if (parsed[0].type === 'snapshot') expect(parsed[0].id).toBe(id);
    const reset = parser.feed('event: reset\r\ndata: {"reason":"replay-gap-or-expired"}\r\n\r\n');
    expect(reset).toEqual([{ type: 'reset', reason: 'replay-gap-or-expired' }]);
  });
  it('refuses forged event IDs, malformed snapshot and oversized frames', () => {
    const parser = new TaskSseParser();
    expect(() => parser.feed('id: forged\nevent: snapshot\ndata: ' + JSON.stringify(snap) + '\n\n'))
      .toThrow(/Invalid task SSE snapshot/);
    expect(() => new TaskSseParser().feed('event: weird\ndata: ' + 'x'.repeat(200001))).toThrow(/too large/);
  });
  it('requires server-advertised SSE transport before opening a stream', async () => {
    const manifest = { schemaVersion: 1, server: 'superagent',
      httpActions: [{ id: 'tasks.events', method: 'GET', access: 'read', transport: 'sse' }] };
    const api = vi.fn().mockResolvedValue(reply(manifest));
    await checkTaskSseCapability('D:/work', () => ({}), api);
    expect(api.mock.calls[0][0]).toContain('workspace=D%3A%2Fwork');
    const denied = vi.fn().mockResolvedValue(reply({ ...manifest, httpActions: [] }));
    await expect(checkTaskSseCapability('D:/work', () => ({}), denied)).rejects.toThrow(/does not support/);
  });
  it('uses authenticated fetch with last-event-id and delivers streamed frames', async () => {
    const bytes = new TextEncoder().encode(raw);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 25));
        controller.enqueue(bytes.slice(25));
        controller.close();
      },
    });
    const request = vi.fn().mockResolvedValue({ ok: true, status: 200, body });
    const onEvent = vi.fn();
    await readTaskSseStream('D:/work', 'sess_abc', () => ({ Authorization: 'Bearer protected' }),
      onEvent, { lastEventId: id }, request);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toContain('sessionId=sess_abc');
    expect(request.mock.calls[0][1].headers['Last-Event-ID']).toBe(id);
    expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer protected');
    await expect(readTaskSseStream('D:/work', 'sess_abc', () => ({}), () => {}, {
      lastEventId: '../../other',
    }, request)).rejects.toThrow(/Invalid SSE resume cursor/);
  });
});
