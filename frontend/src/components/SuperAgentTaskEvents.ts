/** Authenticated SSE reader for the bounded task event stream. */
import { validTaskSnapshot, type TaskSnapshot } from './SuperAgentTaskSnapshot';

const EVENT_ID = /^[0-9a-f]{16}\.\d{1,12}$/;
export type TaskEvent =
  | { type: 'snapshot'; id: string; snapshot: TaskSnapshot }
  | { type: 'reset'; reason: string }
  | { type: 'heartbeat' }
  | { type: 'warning'; reason: string };

export class TaskSseParser {
  private buffer = '';
  private fields: string[] = [];
  feed(text: string): TaskEvent[] {
    this.buffer += text;
    if (this.buffer.length > 200_000) throw new Error('Task event buffer too large.');
    const results: TaskEvent[] = [];
    while (true) {
      const pos = this.buffer.indexOf('\n');
      if (pos < 0) break;
      let line = this.buffer.slice(0, pos);
      this.buffer = this.buffer.slice(pos + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line) {
        const e = this.dispatch();
        if (e) results.push(e);
      } else if (!line.startsWith(':')) this.fields.push(line);
      if (this.fields.join('').length > 120_000) throw new Error('Task event too large.');
    }
    return results;
  }
  private dispatch(): TaskEvent | null {
    const lines = this.fields;
    this.fields = [];
    const values = new Map<string, string[]>();
    for (const line of lines) {
      const sep = line.indexOf(':');
      const field = sep < 0 ? line : line.slice(0, sep);
      const value = sep < 0 ? '' : line.slice(sep + 1).replace(/^ /, '');
      if (['event', 'id', 'data'].includes(field)) values.set(field, [...(values.get(field) || []), value]);
    }
    const kind = values.get('event')?.[0] || '';
    if (!kind || !values.has('data')) return null;
    const payload = JSON.parse((values.get('data') || []).join('\n'));
    if (kind === 'snapshot') {
      const id = values.get('id')?.[0] || '';
      if (!EVENT_ID.test(id) || !validTaskSnapshot(payload)) throw new Error('Invalid task SSE snapshot.');
      return { type: 'snapshot', id, snapshot: payload };
    }
    if (kind === 'reset') return { type: 'reset', reason: String(payload?.reason || 'replay-unavailable') };
    if (kind === 'warning') return { type: 'warning', reason: String(payload?.reason || 'unknown') };
    if (kind === 'heartbeat') return { type: 'heartbeat' };
    return null;
  }
}

export async function checkTaskSseCapability(
  workspace: string,
  auth: () => Record<string, string>,
  request: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<void> {
  const response = await request('/api/superagent/parity/capabilities?workspace=' + encodeURIComponent(workspace),
    { headers: auth(), signal });
  if (!response.ok) throw new Error('SuperAgent capability unavailable (HTTP ' + response.status + ').');
  const manifest = await response.json();
  if (manifest?.schemaVersion !== 1 || manifest?.server !== 'superagent' ||
    !Array.isArray(manifest.httpActions) ||
    !manifest.httpActions.some((a: any) => a?.id === 'tasks.events' &&
      a?.method === 'GET' && a?.transport === 'sse' && a?.access === 'read')) {
    throw new Error('Active SuperAgent does not support SSE task events.');
  }
}

export async function readTaskSseStream(
  workspace: string, sessionId: string, auth: () => Record<string, string>,
  onEvent: (event: TaskEvent) => void,
  opts: { lastEventId?: string; signal?: AbortSignal } = {},
  request: typeof fetch = fetch,
): Promise<void> {
  if (!workspace || !sessionId) throw new Error('Task stream needs workspace and session.');
  if (opts.lastEventId && !EVENT_ID.test(opts.lastEventId)) throw new Error('Invalid SSE resume cursor.');
  const url = '/api/superagent/tasks/events?workspace=' + encodeURIComponent(workspace) +
    '&sessionId=' + encodeURIComponent(sessionId);
  const response = await request(url, { headers: {
    ...auth(), Accept: 'text/event-stream',
    ...(opts.lastEventId ? { 'Last-Event-ID': opts.lastEventId } : {}),
  }, signal: opts.signal });
  if (!response.ok || !response.body) {
    throw new Error('SSE task connection failed (HTTP ' + response.status + ').');
  }
  const reader = response.body.getReader();
  const parser = new TaskSseParser();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      for (const frame of parser.feed(decoder.decode(chunk.value, { stream: true }))) onEvent(frame);
    }
    for (const frame of parser.feed(decoder.decode())) onEvent(frame);
  } finally {
    reader.releaseLock();
  }
}
