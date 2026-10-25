import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createAgentTimelineProxy } from '../src/agentTimelineProxy';

const closing: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of closing.splice(0).reverse()) await stop(); });
async function start(handler: http.RequestListener) {
  const server = http.createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  closing.push(() => new Promise(resolve => server.close(() => resolve())));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Port unavailable');
  return address.port;
}
async function fixture(identity: { role?: string; source?: string }) {
  const observations: Array<{ url: string; headers: http.IncomingHttpHeaders; method: string }> = [];
  const corePort = await start((req, res) => {
    observations.push({ url: req.url || '', headers: req.headers, method: req.method || '' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ schemaVersion: 1, sessionId: 'session_1', success: true, gap: false,
      nextCursor: 1, events: [{ seq: 1, kind: 'tool_start', actor: 'main',
        tool: 'read_files', at: 1792960000000 }] }));
  });
  const app = express();
  app.use((req, _res, next) => { (req as any).user = identity; next(); });
  app.use('/agent-timeline', createAgentTimelineProxy({
    port: corePort, getServiceHeaders: () => ({ Authorization: 'Bearer local-core-token' }),
  }));
  const port = await start(app);
  return { base: 'http://127.0.0.1:' + port + '/agent-timeline', observations };
}

describe('fixed Core timeline proxy', () => {
  it('allows only an authenticated local operator to read exact scoped, bounded history', async () => {
    const { base, observations } = await fixture({ role: 'admin' });
    const result = await fetch(base + '?sessionId=session_1&workspace=D%3A%2Fproject&cursor=0');
    expect(result.status).toBe(200);
    expect((await result.json()).events[0].tool).toBe('read_files');
    expect(observations).toHaveLength(1);
    expect(observations[0].method).toBe('GET');
    expect(observations[0].headers.authorization).toBe('Bearer local-core-token');
    expect(observations[0].headers['x-workspace-path']).toBe('D:/project');
    expect(observations[0].headers['x-client-mode']).toBe('tline');
    expect(observations[0].url).toBe('/api/tline/agent-timeline?workspace=D%3A%2Fproject&sessionId=session_1&cursor=0');
    expect(observations[0].url).not.toContain('command=');
  });
  it('blocks unauthenticated, other-role, missing scope, bad cursor and POST before Core', async () => {
    const denied = await fixture({ role: 'viewer' });
    expect((await fetch(denied.base + '?sessionId=session_1&workspace=D%3A%2Fproject')).status).toBe(403);
    expect(denied.observations).toHaveLength(0);
    const allowed = await fixture({ source: 'local' });
    expect((await fetch(allowed.base + '?sessionId=session_1')).status).toBe(400);
    expect((await fetch(allowed.base + '?workspace=D%3A%2Fproject&sessionId=session_1&cursor=abc')).status).toBe(400);
    expect((await fetch(allowed.base + '?workspace=D%3A%2Fproject&sessionId=session_1',
      { method: 'POST' })).status).toBe(404);
    expect(allowed.observations).toHaveLength(0);
  });
});
