import { describe, expect, it } from 'vitest';
import { takeTerminalWriteBatch } from './terminalWriteBatch';

describe('PTY output rendering budgets', () => {
  it('streams FIFO chunks across frames without losing or reordering output', () => {
    const queue = ['hello', ' world', '!'.repeat(100)];
    const all: string[] = [];
    while (queue.length) {
      const next = takeTerminalWriteBatch(queue, 16);
      expect(next.length).toBeLessThanOrEqual(16);
      expect(next.length).toBeGreaterThan(0);
      all.push(next);
    }
    expect(all.join('')).toBe('hello world' + '!'.repeat(100));
  });
  it('preserves surrogate pairs across write batches', () => {
    const queue = ['a'.repeat(7) + '😀' + 'ok'];
    const chunks: string[] = [];
    while (queue.length) chunks.push(takeTerminalWriteBatch(queue, 8));
    expect(chunks.join('')).toBe('a'.repeat(7) + '😀ok');
    for (const chunk of chunks) {
      const last = chunk.charCodeAt(chunk.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
  });
  it('returns empty for no queued output', () => {
    expect(takeTerminalWriteBatch([], 64 * 1024)).toBe('');
  });
});
