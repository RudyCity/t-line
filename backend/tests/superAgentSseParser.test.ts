import { describe, expect, it } from 'bun:test';
import { SseStreamParser, type ParsedSseMessage } from '../src/superAgentSseParser';

describe('SseStreamParser', () => {
  it('parses single complete SSE event with id and data', () => {
    const messages: ParsedSseMessage[] = [];
    const parser = new SseStreamParser((msg) => messages.push(msg));

    parser.feed('id: event-101\ndata: {"type":"text_delta","text":"Hello"}\n\n');

    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('event-101');
    expect(messages[0].data).toBe('{"type":"text_delta","text":"Hello"}');
    expect(parser.getLastEventId()).toBe('event-101');
  });

  it('parses multiple SSE events across multiple chunks', () => {
    const messages: ParsedSseMessage[] = [];
    const parser = new SseStreamParser((msg) => messages.push(msg));

    parser.feed('id: 1\ndata: first\n\n');
    parser.feed('id: 2\nd');
    parser.feed('ata: sec');
    parser.feed('ond\n\n');

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ id: '1', data: 'first' });
    expect(messages[1]).toEqual({ id: '2', data: 'second' });
    expect(parser.getLastEventId()).toBe('2');
  });

  it('handles multiline data fields properly joined by newlines', () => {
    const messages: ParsedSseMessage[] = [];
    const parser = new SseStreamParser((msg) => messages.push(msg));

    parser.feed('data: line 1\ndata: line 2\ndata: line 3\n\n');

    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('line 1\nline 2\nline 3');
  });

  it('ignores comments and keep-alive lines starting with colon', () => {
    const messages: ParsedSseMessage[] = [];
    const parser = new SseStreamParser((msg) => messages.push(msg));

    parser.feed(': connected\n\n');
    parser.feed(': keepalive ping\n\n');
    parser.feed('id: 42\ndata: actual payload\n\n');

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ id: '42', data: 'actual payload' });
    expect(parser.getLastEventId()).toBe('42');
  });

  it('handles CRLF line endings as well as LF', () => {
    const messages: ParsedSseMessage[] = [];
    const parser = new SseStreamParser((msg) => messages.push(msg));

    parser.feed('id: 99\r\nevent: custom_event\r\ndata: windows newline\r\n\r\n');

    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('99');
    expect(messages[0].event).toBe('custom_event');
    expect(messages[0].data).toBe('windows newline');
  });

  it('persists lastEventId across events without an id field', () => {
    const messages: ParsedSseMessage[] = [];
    const parser = new SseStreamParser((msg) => messages.push(msg));

    parser.feed('id: anchor-1\ndata: one\n\n');
    parser.feed('data: two\n\n');

    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe('anchor-1');
    expect(messages[1].id).toBeUndefined();
    expect(parser.getLastEventId()).toBe('anchor-1');
  });
});
