import { describe, expect, it } from 'vitest';
import { matchingGatewayClaim } from './managedGatewaySessions';
import type { ManagedBrowserGatewayPairing } from './managedBrowserGateway';
const paired: ManagedBrowserGatewayPairing = {
  profileId: 'default-managed', generation: '1-2',
  port: 59333, targetId: 'EXACT_TAB', transport: 'superagent_browser_gateway',
};
describe('managed gateway read-only claim projection', () => {
  it('shows only an exact, unexpired claimed tab (no capability or token)', () => {
    const result = matchingGatewayClaim(paired, { sessions: [
      { targetId: 'OTHER', port: 59333, agentId: 'wrong', mode: 'shared', expiresAt: 2000 },
      { targetId: 'EXACT_TAB', port: 59333, agentId: 'right', mode: 'shared',
        expiresAt: 2000, sessionToken: 'never-copy', participants: [{ agentId: 'right', role: 'owner', tokenHash: 'sensitive' }] },
    ] }, 1000);
    expect(result).toEqual({
      port: 59333, targetId: 'EXACT_TAB', agentId: 'right', mode: 'shared',
      expiresAt: 2000, participants: [{ agentId: 'right', role: 'owner' }],
    });
    expect(JSON.stringify(result)).not.toContain('never-copy');
    expect(JSON.stringify(result)).not.toContain('sensitive');
  });
  it('does not mistake a stale claim or foreign port for a connection', () => {
    expect(matchingGatewayClaim(paired, { sessions: [
      { targetId: 'EXACT_TAB', port: 59333, agentId: 'stale', mode: 'isolated', expiresAt: 1000 },
      { targetId: 'EXACT_TAB', port: 9222, agentId: 'foreign', mode: 'isolated', expiresAt: 9000 },
    ] }, 1100)).toBeNull();
    expect(matchingGatewayClaim(paired, { sessions: null })).toBeNull();
  });
});
