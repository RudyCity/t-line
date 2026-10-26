import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { bridgeReconnectDelay, shouldResetBridgeRetryBudget } from './bridgeReconnectPolicy';

describe('T-Line desktop bridge reconnect policy', () => {
  it('retries beyond eight attempts with a bounded delay', () => {
    expect(bridgeReconnectDelay(1)).toBe(500);
    expect(bridgeReconnectDelay(9)).toBe(30000);
    expect(bridgeReconnectDelay(10000)).toBe(30000);
  });

  it('keeps staggered clients under the 30 second cap', () => {
    expect(bridgeReconnectDelay(3, 0)).toBe(1600);
    expect(bridgeReconnectDelay(3, 1)).toBe(2400);
    expect(bridgeReconnectDelay(99, 1)).toBe(30000);
  });

  it('does not treat sub-second open/close cycles as recovered', () => {
    expect(shouldResetBridgeRetryBudget(1000, 1600)).toBe(false);
    expect(shouldResetBridgeRetryBudget(1000, 11000)).toBe(true);
    expect(shouldResetBridgeRetryBudget(0, 20000)).toBe(false);
  });

  it('does not let a stale socket close or retry the replacement', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../components/SuperAgentConsole.tsx'), 'utf8');
    expect(source).toContain('if (wsRef.current !== socket) return;');
    expect(source).toContain('socket.onclose = null;');
    expect(source).not.toContain('if (attempts > 8) return;');
    expect(source).toContain('const token = getAuthToken()');
  });
});
