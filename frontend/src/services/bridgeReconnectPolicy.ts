/**
 * Read-only bridge reconnect policy. Never enqueue or replay chat, tool or
 * permission POSTs after a transient transport failure.
 */
export function bridgeReconnectDelay(attempt: number, random = 0.5): number {
  const count = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
  const base = Math.min(30000, 500 * 2 ** Math.min(count - 1, 6));
  const jitter = 0.8 + 0.4 * Math.max(0, Math.min(1, random));
  return Math.min(30000, Math.round(base * jitter));
}

/** Short-lived connections must not reset backoff and cause reconnect storms. */
export function shouldResetBridgeRetryBudget(connectedAt: number, now: number): boolean {
  return connectedAt > 0 && now - connectedAt >= 10000;
}
