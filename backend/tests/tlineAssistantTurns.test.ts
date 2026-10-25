import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createTlineAssistantTurnsRouter } from '../src/tlineAssistantTurns';
import { isBoundAssistantSession, validAssistantTurnId } from '../src/tlineAssistantSession';

const disposers: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of disposers.splice(0).reverse()) await close(); });
async function listen(handler: http.RequestListener) {
  const server = http.createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  disposers.push(() => new Promise(resolve => server.close(() => resolve())));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Not listening');
  return address.port;
}
async function fixture(role: string) {
  const captures: Array<{ method: string; path: string; headers: http.IncomingHttpHeaders; body: string }> = [];
  const upstream = await listen((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      captures.push({ method: req.method || '', path: req.url || '', headers: req.headers, body });
      const query = new URL(req.url || '/', 'http://127.0.0.1').searchParams;
      res.setHeader('Content-Type', 'application/json');
      if (req.url?.includes('/recover')) {
        res.end(JSON.stringify({ success: true, sessionId: query.get('sessionId'), resumed: 1 }));
        return;
      }
      res.end(JSON.stringify({
        success: true, sessionId: query.get('sessionId'),
        turns: [{ turnId: 'turn_123456', state: 'running', createdAt: 10,
          error: 'secret traceback', message: 'private prompt', digest: 'secret digest' }],
      }));
    });
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { role }; next(); });
  app.use('/assistant/turns', createTlineAssistantTurnsRouter({
    port: upstream, serviceHeaders: () => ({ Authorization: 'Bearer private-core-token' }),
  }));
  const port = await listen(app);
  return { base: 'http://127.0.0.1:' + port + '/assistant/turns', captures };
}

describe('T-Line core assistant chat queue adapter', () => {
  it('uses fixed session-bound inspection with safe metadata projection', async () => {
    const { base, captures } = await fixture('admin');
    const url = base + '?sessionId=session_1&workspace=' + encodeURIComponent('D:\\work');
    const response = await fetch(url);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.turns).toEqual([{
      turnId: 'turn_123456', state: 'running',
      createdAt: 10, startedAt: null, finishedAt: null,
    }]);
    expect(JSON.stringify(result)).not.toContain('private prompt');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(captures[0].path).toContain('sessionId=session_1');
    expect(captures[0].headers['x-client-mode']).toBe('tline');
    expect(captures[0].headers['x-workspace-path']).toBe('D:\\work');
    expect(captures[0].headers.authorization).toBe('Bearer private-core-token');
    const recovered = await fetch(base + '/recover?sessionId=session_1&workspace=' +
      encodeURIComponent('D:\\work'), { method: 'POST' });
    expect((await recovered.json()).resumed).toBe(1);
    expect(JSON.parse(captures[1].body)).toEqual({ sessionId: 'session_1' });
  });
  it('rejects unauthenticated scopes before forwarding', async () => {
    const forbidden = await fixture('viewer');
    expect((await fetch(forbidden.base + '?sessionId=session_1&workspace=here')).status).toBe(403);
    expect(forbidden.captures).toHaveLength(0);
    const allowed = await fixture('admin');
    expect((await fetch(allowed.base + '?workspace=here')).status).toBe(400);
    expect((await fetch(allowed.base + '?sessionId=../escape&workspace=here')).status).toBe(400);
    expect(allowed.captures).toHaveLength(0);
  });
  it('never routes a stale tab prompt to another session', () => {
    expect(isBoundAssistantSession('session_one', 'session_one')).toBe(true);
    expect(isBoundAssistantSession('session_one', 'session_two')).toBe(false);
    expect(isBoundAssistantSession(undefined, 'session_one')).toBe(false);
    expect(isBoundAssistantSession('session_one', undefined)).toBe(false);
    expect(validAssistantTurnId('turn_123456')).toBe(true);
    expect(validAssistantTurnId('../other')).toBe(false);
  });
});
