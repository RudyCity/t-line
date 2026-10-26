import type { CoreAgentTimelineEvent } from './CoreAgentTimelineApi';
const allowedKeys = new Set(['seq','at','actor','kind','tool','status','callId','parent']);
const actor = /^(main|sub:[a-f0-9]{20})$/;
const kinds = new Set(['tool_start','tool_end','subagent_status','permission_requested',
  'permission_decided','agent_done']);
/** Authenticated, bounded SSE stream. Cursor replay and duplicate checks remain
 * client-side; only event metadata is accepted, never action payloads. */
export function validateCoreAgentEvent(ev: any): ev is CoreAgentTimelineEvent {
  return !!ev && typeof ev === 'object' && !Array.isArray(ev) &&
    Object.keys(ev).every(key => allowedKeys.has(key)) &&
    Number.isSafeInteger(ev.seq) && ev.seq > 0 &&
    Number.isSafeInteger(ev.at) && ev.at > 0 && actor.test(ev.actor) &&
    kinds.has(ev.kind) &&
    (ev.tool === undefined || (typeof ev.tool === 'string' &&
      /^[a-zA-Z][a-zA-Z0-9._-]{0,79}$/.test(ev.tool))) &&
    (ev.status === undefined || (typeof ev.status === 'string' &&
      /^[a-z_]{1,40}$/.test(ev.status))) &&
    (ev.callId === undefined || /^[a-f0-9]{20}$/.test(ev.callId)) &&
    (ev.parent === undefined || ev.parent === 'main' || /^sub:[a-f0-9]{20}$/.test(ev.parent));
}
export async function streamCoreAgentTimeline(
  workspace: string, sessionId: string, cursor: number,
  auth: () => Record<string,string>, signal: AbortSignal,
  onEvent: (event: CoreAgentTimelineEvent) => void,
  onGap: () => void,
  onOpen?: () => void,
): Promise<void> {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw Error('Invalid streaming cursor');
  const params = new URLSearchParams({ workspace, sessionId, cursor: String(cursor) });
  const response = await fetch('/api/superagent/assistant/agent-stream?' + params, {
    headers: { ...auth(), Accept:'text/event-stream' }, signal, cache:'no-store',
  });
  if (!response.ok || !response.body ||
      !String(response.headers.get('content-type') || '').includes('text/event-stream'))
    throw Error('Core journal stream unavailable');
  onOpen?.();
  let buffer = '';
  let latest = cursor;
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  try {
    while (!signal.aborted) {
      const {done,value} = await reader.read();
      if (done) break;
      // Normalize after concatenation: CR and LF may arrive in separate chunks.
      buffer += decoder.decode(value, {stream:true});
      buffer = buffer.replace(/\r\n/g, '\n');
      if (buffer.length > 65536) throw Error('Oversized event frame');
      let end = buffer.indexOf('\n\n');
      while (end !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (/^event: gap$/m.test(frame)) onGap();
        else if (/^event: unavailable$/m.test(frame)) throw Error('Core journal stream interrupted');
        else {
          const line = frame.split('\n').find(part => part.startsWith('data: '));
          if (line) {
            let payload: unknown;
            try { payload = JSON.parse(line.slice(6)); } catch { throw Error('Invalid agent event JSON'); }
            if (!validateCoreAgentEvent(payload)) throw Error('Invalid Core stream event');
            const event = payload as CoreAgentTimelineEvent;
            if (event.seq > latest) {
              const id = frame.split('\n').find(part => part.startsWith('id: '));
              if (id && String(event.seq) !== id.slice(4)) throw Error('Core event ID mismatch');
              if (event.seq > latest + 1) onGap();
              latest = event.seq; onEvent(event);
            }
          }
        }
        end = buffer.indexOf('\n\n');
      }
    }
  } finally {
    try { await reader.cancel(); } catch {}
    reader.releaseLock();
  }
}
