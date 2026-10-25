import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createAssistantTaskProxy } from '../src/assistantTaskProxy';

const closing: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of closing.splice(0).reverse()) await stop(); });
async function start(handler: http.RequestListener) {
  const server = http.createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  closing.push(() => new Promise(resolve => server.close(() => resolve())));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Listener unavailable');
  return address.port;
}
async function fixture(identity: { role?: string; source?: string }) {
  const observed: { path: string; method: string; body: string; headers: http.IncomingHttpHeaders }[] = [];
  const corePort = await start((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      observed.push({ path: req.url || '', method: req.method || '', body, headers: req.headers });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, executionEnabled: false, tasks: [], body }));
    });
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = identity;
    next();
  });
  app.use('/assistant/tasks', createAssistantTaskProxy({
    port: corePort,
    getServiceHeaders: () => ({ Authorization: 'Bearer test-core-token' }),
  }));
  const port = await start(app);
  return { base: 'http://127.0.0.1:' + port + '/assistant/tasks', observed };
}
describe('desktop assistant task fixed-action proxy', () => {
  it('forwards only scoped list, event cursor and idempotent create', async () => {
    const { base, observed } = await fixture({ role: 'admin' });
    const query = '?sessionId=session123&workspace=' + encodeURIComponent('D:\\project');
    const listing = await fetch(base + query);
    expect(listing.status).toBe(200);
    expect((await listing.json()).executionEnabled).toBe(false);
    const creation = await fetch(base + query, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: 'goal', title: 'Inspect', idempotencyKey: 'req',
        ownerId: 'forged', command: 'rm -rf *' }),
    });
    expect(creation.status).toBe(200);
    expect(JSON.parse(observed[1].body)).toEqual({
      goalId: 'goal', title: 'Inspect', idempotencyKey: 'req',
    });
    expect(observed[0].headers['x-client-mode']).toBe('tline');
    expect(observed[0].headers['x-workspace-path']).toBe('D:\\project');
    expect(observed[0].headers.authorization).toBe('Bearer test-core-token');
    expect(observed[1].method).toBe('POST');
    expect(observed[0].path).toContain('sessionId=session123');
    expect((await fetch(base + '/events' + query + '&cursor=12')).status).toBe(200);
    expect(observed[2].path).toContain('cursor=12');
  });
  it('proxies only fixed start/cancel/result actions with validated revisions', async () => {
    const { base, observed } = await fixture({ role: 'admin' });
    const taskId = 'c7ba78d0-1719-4a8e-90b4-15832cf48114';
    const query = '?sessionId=session123&workspace=' + encodeURIComponent('D:/project');
    expect((await fetch(base + '/' + taskId + '/run' + query, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 2, ownerId: 'forged',
        action: 'exec', shell: 'cmd' }),
    })).status).toBe(200);
    expect(observed[0].path).toContain('/run?');
    expect(observed[0].method).toBe('POST');
    expect(JSON.parse(observed[0].body)).toEqual({ expectedRevision: 2 });
    expect((await fetch(base + '/' + taskId + '/result' + query)).status).toBe(200);
    expect(observed[1].method).toBe('GET');
    expect(observed[1].path).toContain('/result?');
    expect((await fetch(base + '/' + taskId + '/run' + query, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 0 }),
    })).status).toBe(400);
    expect(observed).toHaveLength(2);
  });
  it('rejects nonoperator, unscoped and unknown actions before contacting Core', async () => {
    const denied = await fixture({ role: 'viewer' });
    const path = '?sessionId=session123&workspace=project';
    expect((await fetch(denied.base + path)).status).toBe(403);
    expect(denied.observed).toHaveLength(0);
    const allowed = await fixture({ role: 'admin' });
    expect((await fetch(allowed.base + '?workspace=project')).status).toBe(400);
    expect((await fetch(allowed.base + '/events' + path + '&cursor=oops')).status).toBe(400);
    expect((await fetch(allowed.base + '/not-a-task' + path)).status).toBe(400);
    expect(allowed.observed).toHaveLength(0);
  });
});
