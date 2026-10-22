import { afterEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const registered: Array<{ path: string }> = [];
vi.mock('../src/gitManager', () => ({
  getWorkspaces: () => registered,
}));

import { isRegisteredStudioWorkspace, ensureStudioWorkspaceTrusted } from '../src/studioWorkspaceAccess';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  registered.length = 0;
  for (const fn of cleanups.splice(0).reverse()) await fn();
});
function workspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-allowed-root-'));
  cleanups.push(async () => { fs.rmSync(dir, { recursive: true, force: true }); });
  return dir;
}
async function listen(server: http.Server): Promise<number> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  cleanups.push(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  return address.port;
}

describe('Studio workspace authorization handshake', () => {
  it('requires an existing exact registered T-Line local workspace', () => {
    const root = workspace();
    const sibling = workspace();
    registered.push({ path: root });
    expect(isRegisteredStudioWorkspace(root)).toBe(true);
    expect(isRegisteredStudioWorkspace(sibling)).toBe(false);
    expect(isRegisteredStudioWorkspace('ssh://example/dir')).toBe(false);
    expect(isRegisteredStudioWorkspace(path.join(root, '..'))).toBe(false);
    expect(isRegisteredStudioWorkspace('does-not-exist')).toBe(false);
  });

  it('sends a server-only bearer token and exact trusted workspace; rejects unknown workspaces', async () => {
    const root = workspace();
    const unregistered = workspace();
    registered.push({ path: root });
    const token = 'c'.repeat(48);
    let called = 0;
    const server = http.createServer((request, response) => {
      called++;
      expect(request.headers.authorization).toBe('Bearer ' + token);
      expect(request.url).toBe('/api/config/trusted-directory');
      expect(request.headers['x-workspace-path']).toBeUndefined();
      let body = '';
      request.on('data', chunk => body += String(chunk));
      request.on('end', () => {
        expect(JSON.parse(body)).toEqual({ path: fs.realpathSync.native(root) });
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{}');
      });
    });
    const port = await listen(server);
    await expect(ensureStudioWorkspaceTrusted(unregistered, token, port)).rejects.toThrow('not registered');
    expect(called).toBe(0);
    await ensureStudioWorkspaceTrusted(root, token, port);
    await ensureStudioWorkspaceTrusted(root, token, port);
    expect(called).toBe(1);
  });

  it('fails closed if SuperAgent rejects workspace trust', async () => {
    const root = workspace();
    registered.push({ path: root });
    const server = http.createServer((_request, response) => {
      response.writeHead(403); response.end('Forbidden');
    });
    const port = await listen(server);
    await expect(ensureStudioWorkspaceTrusted(root, 'b'.repeat(48), port)).rejects.toThrow('rejected (403)');
  });
});
