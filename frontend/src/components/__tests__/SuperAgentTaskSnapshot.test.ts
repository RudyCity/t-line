import { describe, expect, it, vi } from 'vitest';
import { fetchTlineTaskSnapshot, validTaskSnapshot } from '../SuperAgentTaskSnapshot';
import { parseParityCommand, runParityCommand } from '../SuperAgentParityActions';

const cursor = 'a'.repeat(64);
const second = 'b'.repeat(64);
const manifest = {
  server: 'superagent', schemaVersion: 1,
  httpActions: [{ id: 'tasks.snapshot', method: 'GET', access: 'read' }],
};
const task = {
  schemaVersion: 1, channel: 'cli', taskId: 'job-one', sessionId: null,
  status: 'running', evidence: 'unverified', authorization: 'workspace_scoped',
  notification: 'not_configured', updatedAt: 10,
};
const snapshot = {
  success: true, schemaVersion: 1, scope: 'workspace', source: 'bounded-polling',
  cursor, changed: true, tasks: [task], total: 1,
  incompleteSources: [], replaySupported: false,
};
const reply = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
}) as Response;

describe('workspace task snapshot client', () => {
  it('negotates once, then uses bounded cursor on subsequent polls', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(reply(manifest))
      .mockResolvedValueOnce(reply(snapshot))
      .mockResolvedValueOnce(reply({
        ...snapshot, cursor, changed: false, tasks: undefined,
      }));
    const auth = () => ({ Authorization: 'Bearer desktop' });
    const first = await fetchTlineTaskSnapshot('D:/my project', auth, {}, request);
    expect(first.snapshot.tasks?.[0].taskId).toBe('job-one');
    expect(request.mock.calls[1][0]).toBe('/api/superagent/parity/tasks.snapshot?workspace=D%3A%2Fmy%20project');
    const unchanged = await fetchTlineTaskSnapshot('D:/my project', auth,
      { cursor, negotiated: first.negotiated }, request);
    expect(unchanged.snapshot.changed).toBe(false);
    expect(unchanged.snapshot.tasks).toBeUndefined();
    expect(request.mock.calls[2][0]).toContain('&cursor=' + cursor);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('refuses unadvertised commands, forged scope and mismatched cursor', async () => {
    const request = vi.fn().mockResolvedValueOnce(reply({
      ...manifest, httpActions: [],
    }));
    await expect(fetchTlineTaskSnapshot('D:/mine', () => ({}), {}, request))
      .rejects.toThrow(/does not advertise/);
    expect(request).toHaveBeenCalledTimes(1);
    expect(validTaskSnapshot({ ...snapshot, scope: 'global' })).toBe(false);
    expect(validTaskSnapshot({ ...snapshot, changed: false, tasks: undefined, cursor: second }, cursor)).toBe(false);
    expect(validTaskSnapshot({ ...snapshot, replaySupported: true })).toBe(false);
    expect(validTaskSnapshot({ ...snapshot, tasks: [task, task] })).toBe(false);
  });

  it('rejects unsafe cursor and applies real abort signal to both requests', async () => {
    const request = vi.fn().mockResolvedValue(reply(manifest));
    await expect(fetchTlineTaskSnapshot('D:/one', () => ({}), { cursor: '../secret' }, request))
      .rejects.toThrow(/Invalid task cursor/);
    expect(request).not.toHaveBeenCalled();
    const abort = new AbortController();
    const calls = vi.fn()
      .mockResolvedValueOnce(reply(manifest))
      .mockResolvedValueOnce(reply(snapshot));
    await fetchTlineTaskSnapshot('D:/one', () => ({}), { signal: abort.signal }, calls);
    expect(calls.mock.calls[0][1].signal).toBe(abort.signal);
    expect(calls.mock.calls[1][1].signal).toBe(abort.signal);
  });

  it('offers /tasks status without treating task cancellation as chat prompt', async () => {
    expect(parseParityCommand('/tasks status')?.action).toBe('tasks.snapshot');
    const request = vi.fn();
    const denied = await runParityCommand('/tasks cancel job-one', 'D:/mine', () => ({}), request);
    expect(denied).toContain('Only read-only');
    expect(request).not.toHaveBeenCalled();
    const request2 = vi.fn().mockResolvedValueOnce(reply(manifest))
      .mockResolvedValueOnce(reply(snapshot));
    const output = await runParityCommand('/tasks status', 'D:/mine', () => ({}), request2);
    expect(output).toContain('job-one: running');
    expect(output).toContain('no event replay');
  });
});
