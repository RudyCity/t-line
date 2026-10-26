import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamCoreAgentTimeline } from '../CoreAgentTimelineStream';
const good = (seq:number) => ({ seq, at:1792960000000+seq, actor:'main',
  kind: seq%2 ? 'tool_start':'tool_end', tool:'read_files', callId:'a'.repeat(20) });
function stream(parts:string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    }
  });
}
function response(body:ReadableStream<Uint8Array>) {
  return {ok:true,body,headers:{get:()=> 'text/event-stream; charset=utf-8'}};
}
afterEach(() => {vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('authenticated agent SSE delivery', () => {
  it('handles chunk boundaries, dedup, source ids and ordering without replaying tools', async () => {
    const events:string[]=[];
    const payload=good(3);
    const sse='id: 3\ndata: '+JSON.stringify(payload)+'\n\n';
    vi.stubGlobal('fetch',vi.fn(async () => response(stream([
      'id: 1\ndata: '+JSON.stringify(good(1))+'\n\n',
      'id: 1\ndata: '+JSON.stringify(good(1))+'\n\n',
      sse.slice(0,13),sse.slice(13),
    ]))));
    const gap=vi.fn();
    await streamCoreAgentTimeline('D:/project','session_1',0,()=>({Authorization:'Bearer local'}),
      new AbortController().signal,ev=>events.push(String(ev.seq)),gap);
    expect(events).toEqual(['1','3']);
    expect(gap).toHaveBeenCalledOnce();
    const args=(fetch as any).mock.calls[0];
    expect(args[0]).toContain('sessionId=session_1');
    expect(args[0]).toContain('cursor=0');
    expect(args[1].headers.Authorization).toBe('Bearer local');
    expect(args[1].method).toBeUndefined();
  });
  it('honors server gap and rejects forged tool args and mismatched event ids', async () => {
    const bad:any={...good(1),args:{token:'secret'}};
    // The schema explicitly permits only safe metadata; no unrecognized payload keys.
    const responses=[
      'id: 1\ndata: '+JSON.stringify(bad)+'\n\n',
      'id: 3\ndata: '+JSON.stringify(good(1))+'\n\n',
      'id: 1\ndata: '+JSON.stringify({...good(1),actor:'sub:my-private-id'})+'\n\n',
    ];
    for (const data of responses) {
      vi.stubGlobal('fetch',vi.fn(async()=>response(stream([data]))));
      await expect(streamCoreAgentTimeline('D:/project','session_1',0,()=>({}),
        new AbortController().signal,vi.fn(),vi.fn())).rejects.toThrow();
    }
    // Bad payload must never become an actionable event.
    expect(bad.args.token).toBe('secret');
    vi.stubGlobal('fetch',vi.fn(async()=>response(stream(['event: gap\ndata: {}\n\n']))));
    const gap=vi.fn();
    await streamCoreAgentTimeline('D:/project','session_1',0,()=>({}),
      new AbortController().signal,vi.fn(),gap);
    expect(gap).toHaveBeenCalledOnce();
  });
  it('normalizes CRLF even when CR and LF arrive in separate network chunks', async () => {
    const line = 'id: 1\r\ndata: ' + JSON.stringify(good(1)) + '\r\n\r\n';
    vi.stubGlobal('fetch', vi.fn(async () => response(stream([...line]))));
    const received:number[]=[];
    await streamCoreAgentTimeline('D:/project','session_1',0,()=>({}),
      new AbortController().signal,ev=>received.push(ev.seq),vi.fn());
    expect(received).toEqual([1]);
  });
});
