export interface QueuedOutboundMessage { text: string; kind?: string; id?: string; }

/**
 * Bounds data buffered across WebSocket reconnects. Only obsolete viewport
 * resize/reattach controls are coalesced; terminal input is never silently
 * discarded. False means the input was refused and callers must notify the user.
 */
export function enqueueOutbound(
  queue: QueuedOutboundMessage[],
  item: QueuedOutboundMessage,
  maxMessages = 512,
  maxCharacters = 1024 * 1024
): boolean {
  if ((item.kind === 'resize' || item.kind === 'init') && item.id) {
    const prior = queue.findIndex(message => message.kind === item.kind && message.id === item.id);
    if (prior !== -1) queue.splice(prior, 1);
  }
  const size = queue.reduce((sum, message) => sum + message.text.length, 0);
  if (queue.length >= maxMessages || size + item.text.length > maxCharacters) return false;
  queue.push(item);
  return true;
}
