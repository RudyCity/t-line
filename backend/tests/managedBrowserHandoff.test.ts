import { describe, expect, it } from 'vitest';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { browserFingerprint, validateHandoffIdentity } from '../src/managedBrowserHandoff';

const BROWSER_PATH = '/devtools/browser/01234567-89ab-cdef-0123-456789abcdef';

async function fixtureServer(
  payload: (port: number) => unknown,
): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer((request, response) => {
    if (request.url === '/json/version') {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(payload(port)));
      return;
    }
    response.writeHead(404);
    response.end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    port: typeof address === 'object' && address ? address.port : 0,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('managed browser handoff identity', () => {
  it('accepts a bounded verified identity', () => {
    expect(validateHandoffIdentity({
      profileId: 'pbrowser1700000000000',
      generation: '4242-1730000000000000',
      port: 53331,
      targetId: 'ABC123_def-9',
    })).toEqual({
      profileId: 'pbrowser1700000000000',
      generation: '4242-1730000000000000',
      port: 53331,
      targetId: 'ABC123_def-9',
    });
  });

  it('rejects malformed, oversized, and out-of-range identities', () => {
    expect(validateHandoffIdentity(null)).toBeNull();
    expect(validateHandoffIdentity('nope')).toBeNull();
    expect(validateHandoffIdentity({ profileId: '../escape', generation: '1-2', port: 53331, targetId: 'A' })).toBeNull();
    expect(validateHandoffIdentity({ profileId: 'p1', generation: '1-2', port: 80, targetId: 'A' })).toBeNull();
    expect(validateHandoffIdentity({ profileId: 'p1', generation: '1-2', port: 53331, targetId: '../x' })).toBeNull();
    expect(validateHandoffIdentity({ profileId: 'p1', generation: '1-2', port: 53331, targetId: 'A'.repeat(129) })).toBeNull();
  });

  it('derives the same sha256 fingerprint as the native supervisor', async () => {
    const fixture = await fixtureServer((port) => ({
      webSocketDebuggerUrl: `ws://127.0.0.1:${port}${BROWSER_PATH}`,
    }));
    try {
      const fingerprint = await browserFingerprint(fixture.port);
      expect(fingerprint).toBe(createHash('sha256').update(BROWSER_PATH).digest('hex'));
      expect(fingerprint).toHaveLength(64);
    } finally {
      await fixture.close();
    }
  });

  it('refuses identities that are not loopback browser endpoints', async () => {
    const wrongPath = await fixtureServer((port) => ({
      webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/abc`,
    }));
    try {
      await expect(browserFingerprint(wrongPath.port)).rejects.toThrow();
    } finally {
      await wrongPath.close();
    }

    const wrongHost = await fixtureServer(() => ({
      webSocketDebuggerUrl: `ws://example.com:53331${BROWSER_PATH}`,
    }));
    try {
      await expect(browserFingerprint(wrongHost.port)).rejects.toThrow();
    } finally {
      await wrongHost.close();
    }
  });
});
