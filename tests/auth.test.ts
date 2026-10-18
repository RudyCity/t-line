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
});
