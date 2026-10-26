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
  it('forwards only a supported task domain and rejects forged capabilities', async () => {
    const { base, observed } = await fixture({ role: 'admin' });
    const query = '?sessionId=session123&workspace=' + encodeURIComponent('D:/project');
    const response = await fetch(base + query, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalId: 'g', title: 'Research news', idempotencyKey: 'key',
        domain: 'research', toolNames: ['execute_command'], permission: 'full',
      }),
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(observed[0].body)).toEqual({
      goalId: 'g', title: 'Research news', idempotencyKey: 'key', domain: 'research',
    });
    const rejected = await fetch(base + query, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: 'g2', title: 'Unsupported',
        idempotencyKey: 'key2', domain: 'browser' }),
    });
    expect(rejected.status).toBe(400);
    expect(observed).toHaveLength(1);
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
  it('forwards only fixed patch proposal and reconciliation operations', async () => {
    const { base, observed } = await fixture({ role: 'admin' });
    const taskId = 'c7ba78d0-1719-4a8e-90b4-15832cf48114';
    const query = '?sessionId=session123&workspace=' + encodeURIComponent('D:/project');
    for (const action of ['prepare', 'reconcile']) {
      const reply = await fetch(base + '/' + taskId + '/' + action + query, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: 3, secret: 'leak', ownerId: 'another' }),
      });
      expect(reply.status).toBe(200);
    }
    const patchReply = await fetch(base + '/' + taskId + '/patch' + query);
    expect(patchReply.status).toBe(200);
    expect(observed.map(o => o.method)).toEqual(['POST', 'POST', 'GET']);
    expect(observed.map(o => o.path.split('?')[0])).toEqual([
      '/api/assistant/tasks/' + taskId + '/prepare',
      '/api/assistant/tasks/' + taskId + '/reconcile',
      '/api/assistant/tasks/' + taskId + '/patch',
    ]);
    expect(JSON.parse(observed[0].body)).toEqual({ expectedRevision: 3 });
    expect(JSON.parse(observed[1].body)).toEqual({ expectedRevision: 3 });
    expect(observed[2].body).toBe('');
  });
  it('proxies pause/resume/checkpoint and retry draft without arbitrary execution options', async () => {
    const { base, observed } = await fixture({ role: 'admin' });
    const taskId = 'c7ba78d0-1719-4a8e-90b4-15832cf48114';
    const query = '?sessionId=session123&workspace=D%3A%2Fproject';
    for (const action of ['pause','resume']) {
      expect((await fetch(base + '/' + taskId + '/' + action + query, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({expectedRevision:4,command:'execute-dangerous'}),
      })).status).toBe(200);
    }
    expect((await fetch(base + '/' + taskId + '/checkpoint' + query)).status).toBe(200);
    expect((await fetch(base + '/' + taskId + '/retry' + query, {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expectedRevision:4,idempotencyKey:'retry_once',
        toolNames:['execute_command'],approval:true}),
    })).status).toBe(200);
    expect(observed.map(x=>x.method)).toEqual(['POST','POST','GET','POST']);
    expect(observed.map(x=>x.path.split('?')[0])).toEqual([
      '/api/assistant/tasks/'+taskId+'/pause','/api/assistant/tasks/'+taskId+'/resume',
      '/api/assistant/tasks/'+taskId+'/checkpoint','/api/assistant/tasks/'+taskId+'/retry',
    ]);
    expect(JSON.parse(observed[0].body)).toEqual({expectedRevision:4});
    expect(JSON.parse(observed[3].body)).toEqual({expectedRevision:4,idempotencyKey:'retry_once'});
    expect((await fetch(base + '/' + taskId + '/retry' + query, {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expectedRevision:4,idempotencyKey:'../bad'}),
    })).status).toBe(400);
    expect(observed).toHaveLength(4);
  });
  it('forwards only scoped checkpoint review acknowledgement for retry', async () => {
    const { base, observed } = await fixture({role:'admin'});
    const id='c7ba78d0-1719-4a8e-90b4-15832cf48114';
    const url=base+'/'+id+'/retry?sessionId=session123&workspace=D%3A%2Fproject';
    const result=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expectedRevision:4,idempotencyKey:'retry1',
        acknowledgeUnverifiedEffects:true,expectedEvidenceSeq:2,
        toolArguments:{apiKey:'LEAK'},runImmediately:true}),
    });
    expect(result.status).toBe(200);
    expect(JSON.parse(observed[0].body)).toEqual({
      expectedRevision:4,idempotencyKey:'retry1',
      acknowledgeUnverifiedEffects:true,expectedEvidenceSeq:2,
    });
    expect((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expectedRevision:4,idempotencyKey:'retry2',
        acknowledgeUnverifiedEffects:'true',expectedEvidenceSeq:2}),
    })).status).toBe(400);
    expect((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expectedRevision:4,idempotencyKey:'retry3',
        acknowledgeUnverifiedEffects:true,expectedEvidenceSeq:-1}),
    })).status).toBe(400);
    expect(observed).toHaveLength(1);
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
