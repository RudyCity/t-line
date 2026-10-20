import { createServer } from 'node:http';
import { describe, it, expect } from 'vitest';
import { fetchParityReadAction, PARITY_READ_ACTIONS } from '../backend/src/superAgentParityBridge';

describe('authenticated T-Line read-only parity bridge', () => {
  it('allowlists only declared GET endpoints and rejects unknown action/workspace', async () => {
    expect(Object.keys(PARITY_READ_ACTIONS).sort()).toEqual([
      'capabilities', 'daemon.status', 'gateway.status', 'mcp.status',
      'muse.status', 'selfdev.status', 'tasks.snapshot', 'tools.catalog',
    ]);
    const unknown = await fetchParityReadAction('shell.exec' as any, 'C:/project', { headers: { Authorization: 'Bearer fake' } });
    expect(unknown.status).toBe(400);
    const empty = await fetchParityReadAction('capabilities', '', { headers: { Authorization: 'Bearer fake' } });
    expect(empty.status).toBe(400);
    const missingAuth = await fetchParityReadAction('capabilities', 'C:/project', { headers: {} });
    expect(missingAuth.status).toBe(503);
  });

  it('transmits server-side token, workspace and exact endpoint while preserving upstream response codes', async () => {
    const seen: Array<{ url: string; method: string; auth: string; workspace: string }> = [];
    const server = createServer((req, res) => {
      seen.push({ url: String(req.url), method: String(req.method),
        auth: String(req.headers.authorization || ''), workspace: String(req.headers['x-workspace-path'] || '') });
      res.setHeader('Content-Type', 'application/json');
      if (req.url?.startsWith('/api/gateway/status')) {
        res.statusCode = 403; res.end(JSON.stringify({ error: 'denied' }));
      } else {
        res.end(JSON.stringify({ schemaVersion: 1, server: 'superagent', commands: [], httpActions: [] }));
      }
    });
    try {
      await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
      const port = (server.address() as any).port;
      const opts = { port, headers: { Authorization: 'Bearer private-server-token' } };
      const cap = await fetchParityReadAction('capabilities', 'D:/alpha beta', opts);
      expect(cap.status).toBe(200);
      const gateway = await fetchParityReadAction('gateway.status', 'D:/alpha beta', opts);
      expect(gateway.status).toBe(403);
      expect(seen.map(s => s.url.split('?')[0]))
        .toEqual(['/api/tline/capabilities', '/api/gateway/status']);
      expect(seen.every(s => s.method === 'GET' && s.workspace === 'D:/alpha beta' && s.auth === 'Bearer private-server-token'))
        .toBe(true);
    } finally {
      await new Promise<void>(r => server.close(() => r()));
    }
  });
  it('forwards only a validated opaque cursor to the fixed tasks.snapshot route', async () => {
    const captured: string[] = [];
    const server = createServer((req, res) => {
      captured.push(String(req.url));
      res.end(JSON.stringify({ success: true, schemaVersion: 1, scope: 'workspace' }));
    });
    try {
      await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
      const opts = { port: (server.address() as any).port,
        headers: { Authorization: 'Bearer backend' }, cursor: 'a'.repeat(64) };
      const ok = await fetchParityReadAction('tasks.snapshot', 'D:/workspace', opts);
      expect(ok.status).toBe(200);
      expect(captured[0]).toBe('/api/tline/inspect/tasks.snapshot?workspace=D%3A%2Fworkspace&cursor=' + opts.cursor);
      const invalid = await fetchParityReadAction('tasks.snapshot', 'D:/workspace',
        { ...opts, cursor: 'junk/../leak' });
      expect(invalid.status).toBe(400);
      const injected = await fetchParityReadAction('daemon.status', 'D:/workspace', opts);
      expect(injected.status).toBe(400);
      expect(captured).toHaveLength(1);
    } finally { await new Promise<void>(r => server.close(() => r())); }
  });

  it('fails closed if capability endpoint returns a different product or unsupported schema', async () => {
    const server = createServer((_req, res) => res.end(JSON.stringify({ server: 'not-superagent', schemaVersion: 1, commands: [] })));
    try {
      await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
      const got = await fetchParityReadAction('capabilities', 'D:/abc', {
        port: (server.address() as any).port, headers: { Authorization: 'Bearer token' },
      });
      expect(got.status).toBe(502);
    } finally { await new Promise<void>(r => server.close(() => r())); }
  });
});
