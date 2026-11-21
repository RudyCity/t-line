import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('JWT secret fail-closed behaviour', () => {
  let testHome = '';
  const originalUserProfile = process.env.USERPROFILE;
  const originalHome = process.env.HOME;

  beforeEach(() => {
    testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tline-auth-test-'));
    process.env.USERPROFILE = testHome;
    process.env.HOME = testHome;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    fs.rmSync(testHome, { recursive: true, force: true });
  });

  it('rejects token creation and verification when no JWT secret is configured', async () => {
    const auth = await import('../backend/src/auth');

    expect(auth.verifyToken('header.payload.signature')).toBeNull();
    expect(() => auth.generateToken({ sub: 'test-user' })).toThrow(/JWT secret is not configured/);
  });

  it('rejects weak secrets and accepts a configured random-length secret', async () => {
    fs.writeFileSync(
      path.join(testHome, '.tline-config.json'),
      JSON.stringify({ jwtSecret: 'weak-secret' }),
      'utf8'
    );

    const auth = await import('../backend/src/auth');
    expect(auth.verifyToken('header.payload.signature')).toBeNull();
    expect(() => auth.generateToken({ sub: 'test-user' })).toThrow(/JWT secret is not configured/);

    vi.resetModules();
    fs.writeFileSync(
      path.join(testHome, '.tline-config.json'),
      JSON.stringify({ jwtSecret: 'S'.repeat(64) }),
      'utf8'
    );

    const configuredAuth = await import('../backend/src/auth');
    const token = configuredAuth.generateToken({ sub: 'test-user' });
    expect(configuredAuth.verifyToken(token)).toMatchObject({ sub: 'test-user' });
  });

  it('differentiates local desktop running instance from remote/tunnel access', async () => {
    const auth = await import('../backend/src/auth');

    // Local loopback requests
    const localReq1 = { socket: { remoteAddress: '127.0.0.1' }, headers: {} };
    const localReq2 = { socket: { remoteAddress: '::1' }, headers: {} };
    const localReq3 = { socket: { remoteAddress: '::ffff:127.0.0.1' }, headers: {} };
    expect(auth.isTunnelRequest(localReq1)).toBe(false);
    expect(auth.isTunnelRequest(localReq2)).toBe(false);
    expect(auth.isTunnelRequest(localReq3)).toBe(false);
    expect(auth.isLocalDesktopRequest(localReq1)).toBe(true);

    // Remote network / Cloudflare tunnel requests
    const tunnelReq1 = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'cf-connecting-ip': '203.0.113.195' } };
    const tunnelReq2 = { socket: { remoteAddress: '192.168.1.50' }, headers: {} };
    const tunnelReq3 = { socket: { remoteAddress: '10.0.0.2' }, headers: {} };
    expect(auth.isTunnelRequest(tunnelReq1)).toBe(true);
    expect(auth.isTunnelRequest(tunnelReq2)).toBe(true);
    expect(auth.isTunnelRequest(tunnelReq3)).toBe(true);
    expect(auth.isLocalDesktopRequest(tunnelReq1)).toBe(false);
  });

  it('allows local desktop without token, but strictly requires valid JWT for remote tunnel access', async () => {
    fs.writeFileSync(
      path.join(testHome, '.tline-config.json'),
      JSON.stringify({ jwtSecret: 'K'.repeat(64), masterPasswordHash: 'fakehash' }),
      'utf8'
    );

    const auth = await import('../backend/src/auth');
    const validJwt = auth.generateToken({ role: 'admin' });

    // 1. Local desktop request without token -> allowed
    let nextCalled = false;
    const localReq: any = { socket: { remoteAddress: '127.0.0.1' }, headers: {} };
    const resMock: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    auth.authMiddleware(localReq, resMock, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(localReq.user).toEqual({ role: 'admin', source: 'local' });

    // 2. Local desktop request with localBypassToken -> allowed
    nextCalled = false;
    const localBypassReq: any = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { authorization: `Bearer ${auth.localBypassToken}` }
    };
    auth.authMiddleware(localBypassReq, resMock, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);

    // 3. Remote tunnel request without token -> rejected 401
    nextCalled = false;
    const remoteReqNoToken: any = {
      socket: { remoteAddress: '192.168.1.100' },
      headers: {}
    };
    auth.authMiddleware(remoteReqNoToken, resMock, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(resMock.status).toHaveBeenCalledWith(401);

    // 4. Remote tunnel request trying to use localBypassToken -> rejected 401
    nextCalled = false;
    const remoteReqBypass: any = {
      socket: { remoteAddress: '192.168.1.100' },
      headers: { authorization: `Bearer ${auth.localBypassToken}` }
    };
    auth.authMiddleware(remoteReqBypass, resMock, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(resMock.status).toHaveBeenCalledWith(401);

    // 5. Remote tunnel request with valid master-password JWT -> allowed
    nextCalled = false;
    const remoteReqValidJwt: any = {
      socket: { remoteAddress: '192.168.1.100' },
      headers: { authorization: `Bearer ${validJwt}` }
    };
    auth.authMiddleware(remoteReqValidJwt, resMock, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(remoteReqValidJwt.user).toMatchObject({ role: 'admin' });
  });

  it('enforces WebSocket token verification policies between local and tunnel access', async () => {
    fs.writeFileSync(
      path.join(testHome, '.tline-config.json'),
      JSON.stringify({ jwtSecret: 'W'.repeat(64) }),
      'utf8'
    );

    const auth = await import('../backend/src/auth');
    const validJwt = auth.generateToken({ role: 'admin' });

    // Local connection (isTunnel = false) allows local bypass token and empty token
    expect(auth.verifySocketToken(auth.localBypassToken, false)).toBe(true);
    expect(auth.verifySocketToken('', false)).toBe(true);

    // Remote tunnel connection (isTunnel = true) rejects bypass token and invalid tokens
    expect(auth.verifySocketToken(auth.localBypassToken, true)).toBe(false);
    expect(auth.verifySocketToken('', true)).toBe(false);
    expect(auth.verifySocketToken('invalid.token.here', true)).toBe(false);

    // Remote tunnel connection accepts valid JWT
    expect(auth.verifySocketToken(validJwt, true)).toBe(true);
  });
});
