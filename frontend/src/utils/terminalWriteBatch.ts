/**
 * Take at most maxChars of PTY output without allocating a giant multi-MB
 * string on one animation frame. Mutates the FIFO queue in-place.
 */
export function takeTerminalWriteBatch(queue: string[], maxChars: number): string {
  if (maxChars < 2 || queue.length === 0) return '';
  const parts: string[] = [];
  let remaining = maxChars;
  while (queue.length && remaining > 1) {
    const head = queue[0];
    if (!head) {
      queue.shift();
      continue;
    }
    if (head.length <= remaining) {
      parts.push(head);
      remaining -= head.length;
      queue.shift();
      continue;
    }
    // Do not split a UTF-16 surrogate pair between successive xterm writes.
    let count = remaining;
    const code = head.charCodeAt(count - 1);
    if (code >= 0xd800 && code <= 0xdbff) count--;
    if (count < 1) break;
    parts.push(head.slice(0, count));
    queue[0] = head.slice(count);
    remaining -= count;
  }
  return parts.join('');
}
