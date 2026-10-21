import { describe, expect, it } from 'vitest';
import { enqueueOutbound, type QueuedOutboundMessage } from './outboundQueue';

describe('offline terminal WebSocket backpressure', () => {
  it('coalesces obsolete resize commands without touching typed input', () => {
    const queue: QueuedOutboundMessage[] = [];
    expect(enqueueOutbound(queue, {kind:'resize',id:'a',text:'80x20'})).toBe(true);
    expect(enqueueOutbound(queue, {kind:'data',id:'a',text:'typed input'})).toBe(true);
    expect(enqueueOutbound(queue, {kind:'resize',id:'a',text:'120x40'})).toBe(true);
    expect(queue.map(item => item.text)).toEqual(['typed input','120x40']);
  });
  it('refuses overflowing user input without silently evicting old input', () => {
    const queue: QueuedOutboundMessage[] = [];
    expect(enqueueOutbound(queue,{kind:'data',text:'abc'},2,6)).toBe(true);
    expect(enqueueOutbound(queue,{kind:'data',text:'xyz'},2,6)).toBe(true);
    expect(enqueueOutbound(queue,{kind:'data',text:'overflow'},2,6)).toBe(false);
    expect(queue.map(item => item.text)).toEqual(['abc','xyz']);
  });
});
