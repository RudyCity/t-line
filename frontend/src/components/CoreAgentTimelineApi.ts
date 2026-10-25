/** Validated, read-only Core agent timeline: never contains prompts, tool args or results. */
export type CoreAgentTimelineEvent = {
  seq: number; at: number; actor: string;
  kind: 'tool_start' | 'tool_end' | 'subagent_status' |
    'permission_requested' | 'permission_decided' | 'agent_done';
  tool?: string; status?: string;
};
const kinds = new Set(['tool_start', 'tool_end', 'subagent_status',
  'permission_requested', 'permission_decided', 'agent_done']);
const actor = /^(main|sub:[a-f0-9]{20})$/;
export async function getCoreAgentTimeline(
  workspace: string, sessionId: string, cursor: number,
  auth: () => Record<string, string>, signal?: AbortSignal,
): Promise<{ events: CoreAgentTimelineEvent[]; nextCursor: number; gap: boolean }> {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw Error('Invalid agent timeline cursor');
  const query = new URLSearchParams({ workspace, sessionId, cursor: String(cursor) });
  const res = await fetch('/api/superagent/assistant/agent-timeline?' + query.toString(), {
    method: 'GET', headers: auth(), signal, cache: 'no-store',
  });
  const payload = await res.json();
  if (!res.ok || payload?.error) throw Error(payload?.error || 'Core agent history unavailable');
  const events: CoreAgentTimelineEvent[] = payload?.events;
  if (payload?.success !== true || payload.schemaVersion !== 1 ||
      payload.sessionId !== sessionId || !Array.isArray(events) || events.length > 100 ||
      typeof payload.gap !== 'boolean' ||
      !Number.isSafeInteger(payload.nextCursor) || payload.nextCursor < cursor ||
      events.some((ev, i) => !ev || !Number.isSafeInteger(ev.seq) ||
        ev.seq <= cursor || (i > 0 && ev.seq <= events[i-1].seq) ||
        !Number.isSafeInteger(ev.at) || ev.at < 1 ||
        !actor.test(ev.actor) || !kinds.has(ev.kind) ||
        (ev.tool !== undefined && (typeof ev.tool !== 'string' || !/^[a-zA-Z][a-zA-Z0-9._-]{0,79}$/.test(ev.tool))) ||
        (ev.status !== undefined && (typeof ev.status !== 'string' ||
          !/^[a-z_]{1,40}$/.test(ev.status)))) ||
      (events.length > 0 && payload.nextCursor !== events[events.length - 1].seq)) {
    throw Error('Invalid Core agent timeline response');
  }
  return { events, nextCursor: payload.nextCursor, gap: payload.gap };
}
