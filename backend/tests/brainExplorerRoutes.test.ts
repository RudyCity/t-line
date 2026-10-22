import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import { createBrainExplorerRouter } from '../src/brainExplorerRoutes';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tline-brain-'));
  cleanup.push(async () => fs.rmSync(root, { recursive: true, force: true }));
  const ownerHash = crypto.createHash('sha256').update('local-cli').digest('hex').slice(0, 24);
  const session = path.join(root, 'brain', ownerHash, 'sess_local');
  fs.mkdirSync(path.join(session, 'scratch'), { recursive: true });
  fs.mkdirSync(path.join(session, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(session, 'manifest.json'), JSON.stringify({
    schemaVersion: 1, ownerHash, sessionId: 'sess_local',
    createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T02:00:00Z',
  }));
  fs.writeFileSync(path.join(session, 'artifacts', 'result.md'), 'safe brain artifact');
  fs.writeFileSync(path.join(session, 'artifacts', 'huge.txt'), 'a'.repeat(129 * 1024));
  fs.writeFileSync(path.join(session, 'artifacts', 'data.bin'), Buffer.from([1, 0, 2]));
  // A second MCP identity must not be visible from the local desktop explorer.
  const foreign = path.join(root, 'brain', crypto.createHash('sha256').update('oauth:other').digest('hex').slice(0, 24), 'foreign');
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, 'manifest.json'), JSON.stringify({
    schemaVersion: 1, ownerHash: 'different', sessionId: 'foreign', createdAt: '2026-10-22', updatedAt: '2026-10-22',
  }));
  const app = express();
  app.use('/brain', createBrainExplorerRouter({ configRoot: () => root }));
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server not started');
  return { root, session, base: 'http://127.0.0.1:' + address.port + '/brain' };
}

describe('Authenticated T-Line Brain Explorer read model', () => {
  it('exposes only local-cli namespace with bounded file metadata and preview', async () => {
    const { base } = await fixture();
    const listed = await (await fetch(base + '/sessions')).json();
    expect(listed.readOnly).toBe(true);
    expect(listed.sessions.map((item: any) => item.sessionId)).toEqual(['sess_local']);
    expect(JSON.stringify(listed)).not.toContain('foreign');
    expect(JSON.stringify(listed)).not.toContain('ownerHash');
    const files = await (await fetch(base + '/sessions/sess_local/files')).json();
    expect(files.files.map((item: any) => item.path)).toContain('artifacts/result.md');
    const preview = await fetch(base + '/sessions/sess_local/file?path=artifacts%2Fresult.md');
    expect(preview.status).toBe(200);
    expect((await preview.json()).content).toBe('safe brain artifact');
    expect(preview.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects traversal, malformed identifiers, binary and oversized previews', async () => {
    const { base } = await fixture();
    expect((await fetch(base + '/sessions/bad%20id/files')).status).toBe(404);
    for (const file of ['../secret', 'scratch/../artifacts/result.md', 'artifacts/.env', 'C:/temp/file', 'artifacts\\result.md']) {
      expect((await fetch(base + '/sessions/sess_local/file?path=' + encodeURIComponent(file))).status).toBe(404);
    }
    expect((await fetch(base + '/sessions/sess_local/file?path=artifacts%2Fhuge.txt')).status).toBe(415);
    expect((await fetch(base + '/sessions/sess_local/file?path=artifacts%2Fdata.bin')).status).toBe(415);
    expect((await fetch(base + '/sessions', { method: 'POST' })).status).toBe(404);
  });
  it('reads only latest committed delegation status scoped to selected scratch', async () => {
    const { base, root, session } = await fixture();
    const shard = path.join(root, 'cli-bridge', 'delegations', 'jobs.d');
    const writeJob = (id: string, cwd: string, text: string) => {
      const dir = path.join(shard, id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '1792638000000-0000000001-0123456789abcdef.json'), JSON.stringify({
        jobId: id, cwd, cliAlias: 'agy', status: 'succeeded',
        completionState: 'artifacts_verified', startedAt: 1, updatedAt: 2,
        outputTail: text, prompt: 'private instructions', logPath: 'secret.log',
      }));
    };
    const owned = 'clj_1792638000000_deadbeef';
    const foreign = 'clj_1792638000001_deadbeef';
    writeJob(owned, path.join(session, 'scratch'), 'private output');
    writeJob(foreign, root, 'foreign output');
    const response = await fetch(base + '/sessions/sess_local/jobs');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.jobs).toHaveLength(1);
    expect(payload.jobs[0].jobId).toBe(owned);
    expect(payload.jobs[0].status).toBe('succeeded');
    expect(JSON.stringify(payload)).not.toContain('private');
    expect(JSON.stringify(payload)).not.toContain('foreign');
    expect(JSON.stringify(payload)).not.toContain('logPath');
  });

  it('does not follow symlinks to outside files', async () => {
    const { base, session, root } = await fixture();
    const link = path.join(session, 'artifacts', 'external');
    try { fs.symlinkSync(root, link, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (err: any) { if (err.code === 'EPERM' || err.code === 'EACCES') return; throw err; }
    const files = await (await fetch(base + '/sessions/sess_local/files')).json();
    expect(files.files.some((item: any) => item.path.startsWith('artifacts/external'))).toBe(false);
    expect((await fetch(base + '/sessions/sess_local/file?path=' + encodeURIComponent('artifacts/external/manifest.json'))).status).toBe(404);
  });
});
