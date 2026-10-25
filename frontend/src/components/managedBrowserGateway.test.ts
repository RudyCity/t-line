import { describe, expect, it } from 'vitest';
import { gatewayPairingInstructions, type ManagedBrowserGatewayPairing } from './managedBrowserGateway';
const valid: ManagedBrowserGatewayPairing = {
  profileId: 'default-managed',
  generation: '1234-1792922652117000000',
  targetId: 'TARGET_12345',
  port: 54419,
  transport: 'superagent_browser_gateway',
};
describe('managed browser native pairing contract', () => {
  it('uses exact local gateway target and contains no bearer, cookies or raw WS endpoint', () => {
    const text = gatewayPairingInstructions(valid);
    expect(text).toContain('action=discover, port=54419');
    expect(text).toContain('action=claim, port=54419, targetId=TARGET_12345');
    expect(text).toContain('superagent_browser_gateway');
    expect(text).not.toContain('sessionToken');
    expect(text).not.toContain('ws://');
  });
  it('rejects forged or malformed port, target, runtime generation and profile', () => {
    for (const value of [
      { port: 80 }, { port: 70000 }, { port: Number.NaN }, { port: 54419.5 },
      { targetId: '../another-target' }, { targetId: '' },
      { generation: '../../other' }, { profileId: '../personal' },
      { transport: 'untrusted-remote-gateway' },
    ]) {
      expect(() => gatewayPairingInstructions({ ...valid, ...value } as ManagedBrowserGatewayPairing)).toThrow();
    }
  });
});
