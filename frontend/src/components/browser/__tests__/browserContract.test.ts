import { describe, expect, it } from 'vitest';
import {
  isBrowserPairing,
  isBrowserSession,
  isBrowserTarget,
  matchingGatewayClaim,
  tabProfileId,
} from '../browserTypes';
import { addressLabel, isHttpUrl, normalizeAddress } from '../browserUrl';

describe('browser address policy', () => {
  it('keeps deep-link query parameters and fragments', () => {
    expect(normalizeAddress('https://example.com/search?q=rust#results'))
      .toBe('https://example.com/search?q=rust#results');
  });

  it('adds the right scheme for bare hosts and localhost', () => {
    expect(normalizeAddress('example.com/docs?x=1')).toBe('https://example.com/docs?x=1');
    expect(normalizeAddress('localhost:3000/app')).toBe('http://localhost:3000/app');
    expect(normalizeAddress('127.0.0.1:8080')).toBe('http://127.0.0.1:8080/');
  });

  it('rejects unsupported schemes, credentials, and empty input', () => {
    expect(normalizeAddress('')).toBeNull();
    expect(normalizeAddress('javascript:alert(1)')).toBeNull();
    expect(normalizeAddress('file:///C:/Windows')).toBeNull();
    expect(normalizeAddress('https://user:pass@example.com/')).toBeNull();
    expect(normalizeAddress('https://example.com/\u0007')).toBeNull();
    expect(isHttpUrl('devtools://devtools/bundled/x.html')).toBe(false);
    expect(isHttpUrl('https://example.com/')).toBe(true);
  });

  it('shortens very long labels but keeps the host readable', () => {
    const label = addressLabel('https://example.com/' + 'a'.repeat(200));
    expect(label.startsWith('example.com/')).toBe(true);
    expect(label.length).toBeLessThanOrEqual(96);
  });
});

describe('browser IPC shape guards', () => {
  const session = {
    profileId: 'pbrowser1700000000000',
    generation: '4242-1730000000000000',
    lifecycle: 'ready',
    debuggingAvailable: true,
    engineId: 'chrome',
    engineName: 'Google Chrome',
    docked: true,
  };

  it('accepts valid sessions and rejects tampered ones', () => {
    expect(isBrowserSession(session)).toBe(true);
    expect(isBrowserSession({ ...session, lifecycle: 'owned' })).toBe(false);
    expect(isBrowserSession({ ...session, profileId: '../escape' })).toBe(false);
    expect(isBrowserSession(null)).toBe(false);
  });

  it('accepts only loopback devtools targets', () => {
    expect(isBrowserTarget({
      id: 'ABC-123_x',
      title: 'Example',
      url: 'https://example.com/?a=1',
      devtoolsUrl: 'http://127.0.0.1:53331/devtools/inspector.html?ws=127.0.0.1:53331/devtools/page/ABC-123_x',
    })).toBe(true);
    expect(isBrowserTarget({
      id: 'ABC',
      title: 'Example',
      url: 'https://example.com/',
      devtoolsUrl: 'http://evil.example/devtools/inspector.html',
    })).toBe(false);
  });

  it('accepts only bounded verified pairings', () => {
    const pairing = { profileId: 'p1', generation: '1-2', port: 53331, targetId: 'ABC', engineId: 'chrome' };
    expect(isBrowserPairing(pairing)).toBe(true);
    expect(isBrowserPairing({ ...pairing, port: 80 })).toBe(false);
    expect(isBrowserPairing({ ...pairing, targetId: '../x' })).toBe(false);
  });

  it('derives stable, valid per-tab profile ids', () => {
    expect(tabProfileId('browser-1700000000000')).toBe('pbrowser1700000000000');
    expect(tabProfileId('browser-1700000000000')).toBe(tabProfileId('browser-1700000000000'));
    expect(tabProfileId('browser-1700000000000')).not.toBe(tabProfileId('browser-1700000000001'));
    expect(tabProfileId('!!!')).toMatch(/^[a-z0-9][a-z0-9_-]{0,39}$/);
  });

  it('matches only the exact gateway claim for the displayed target', () => {
    const payload = {
      sessions: [
        { port: 53331, targetId: 'OTHER', agentId: 'agent-a', mode: 'isolated', participants: [{}, {}] },
        { port: 53331, targetId: 'ABC', agentId: 'agent-b', mode: 'shared', participants: [{}, {}] },
      ],
    };
    expect(matchingGatewayClaim(53331, 'ABC', payload)).toEqual({
      agentId: 'agent-b',
      mode: 'shared',
      participants: 2,
    });
    expect(matchingGatewayClaim(53331, 'MISSING', payload)).toBeNull();
    expect(matchingGatewayClaim(4444, 'ABC', payload)).toBeNull();
    expect(matchingGatewayClaim(53331, 'ABC', null)).toBeNull();
  });
});
