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
  app.use(express.json());
  app.use('/brain', createBrainExplorerRouter({
    configRoot: () => root,
    authorizeProject: (id, destination) => id === 'allowed-project' && destination === path.join(root, 'allowed-project'),
  }));
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

  it('previews scratch cleanup and retains artifacts, rejecting replay and changed content', async () => {
    const { base, session } = await fixture();
    const headers = { Authorization: 'Bearer test_operator_very_long_token', 'Content-Type': 'application/json' };
    fs.writeFileSync(path.join(session, 'scratch', 'experiment.txt'), 'throwaway');
    const storage = await (await fetch(base + '/sessions/sess_local/storage')).json();
    expect(storage.areas.find((area: any) => area.area === 'scratch').bytes).toBe(9);
    const prepareUrl = base + '/sessions/sess_local/cleanup/prepare';
    const confirmUrl = base + '/sessions/sess_local/cleanup/confirm';
    expect((await fetch(prepareUrl, { method: 'POST' })).status).toBe(409);
    const prepared = await (await fetch(prepareUrl, { method: 'POST', headers })).json();
    expect(prepared.preview.bytes).toBe(9);
    expect(prepared.preview.retained).toContain('artifacts/');
    fs.appendFileSync(path.join(session, 'scratch', 'experiment.txt'), 'more');
    expect((await fetch(confirmUrl, { method: 'POST', headers, body: JSON.stringify({ challenge: prepared.challenge }) })).status).toBe(409);
    const next = await (await fetch(prepareUrl, { method: 'POST', headers })).json();
    const confirmed = await fetch(confirmUrl, { method: 'POST', headers, body: JSON.stringify({ challenge: next.challenge }) });
    expect(confirmed.status).toBe(200);
    expect(fs.existsSync(path.join(session, 'scratch', 'experiment.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(session, 'artifacts', 'result.md'), 'utf8')).toBe('safe brain artifact');
    expect((await fetch(confirmUrl, { method: 'POST', headers, body: JSON.stringify({ challenge: next.challenge }) })).status).toBe(409);
  });

  it('downloads only bounded artifacts and publishes only to dual-registered local projects', async () => {
    const { base, root, session } = await fixture();
    const headers = { Authorization: 'Bearer test_operator_very_long_token', 'Content-Type': 'application/json' };
    const allowed = path.join(root, 'allowed-project');
    fs.mkdirSync(allowed);
    fs.writeFileSync(path.join(root, 'projects.json'), JSON.stringify({
      schemaVersion: 1, projects: [
        { id: 'allowed-project', name: 'Allowed project', enabled: true, type: 'local', root: allowed },
        { id: 'forbidden-project', name: 'Forbidden project', enabled: true, type: 'local', root },
      ],
    }));
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]);
    fs.writeFileSync(path.join(session, 'artifacts', 'image.png'), imageBytes);
    const download = await fetch(base + '/sessions/sess_local/download?path=artifacts%2Fimage.png');
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toContain('attachment');
    expect(download.headers.get('content-disposition')).toContain('image.png');
    expect(Buffer.from(await download.arrayBuffer())).toEqual(imageBytes);
    expect((await fetch(base + '/sessions/sess_local/download?path=scratch%2Fimage.png')).status).toBe(404);
    expect((await fetch(base + '/sessions/sess_local/download?path=artifacts%2Fhuge.txt')).status).toBe(200);
    const list = await (await fetch(base + '/projects')).json();
    expect(list.projects.map((p: any) => p.id)).toEqual(['allowed-project']);
    const prepare = base + '/sessions/sess_local/publish/prepare';
    const confirm = base + '/sessions/sess_local/publish/confirm';
    const body = { projectId: 'allowed-project', filePath: 'artifacts/image.png', destinationPath: 'assets/image.png' };
    expect((await fetch(prepare, { method: 'POST', headers, body: JSON.stringify({ ...body, projectId: 'forbidden-project' }) })).status).toBe(409);
    const prepared = await (await fetch(prepare, { method: 'POST', headers, body: JSON.stringify(body) })).json();
    expect(prepared.preview.overwrite).toBe(false);
    expect((await fetch(confirm, { method: 'POST', headers, body: JSON.stringify({ projectId: 'forbidden-project', challenge: prepared.challenge }) })).status).toBe(409);
    const preparedAgain = await (await fetch(prepare, { method: 'POST', headers, body: JSON.stringify(body) })).json();
    const confirmed = await fetch(confirm, { method: 'POST', headers, body: JSON.stringify({ projectId: 'allowed-project', challenge: preparedAgain.challenge }) });
    expect(confirmed.status).toBe(200);
    expect(fs.readFileSync(path.join(allowed, 'assets', 'image.png'))).toEqual(imageBytes);
    expect((await fetch(prepare, { method: 'POST', headers, body: JSON.stringify(body) })).status).toBe(409);
    expect((await fetch(prepare, { method: 'POST', headers, body: JSON.stringify({ ...body, destinationPath: '../escape.png' }) })).status).toBe(409);
    expect((await fetch(prepare, { method: 'POST', headers, body: JSON.stringify({ ...body, destinationPath: 'reports/bad\nname.png' }) })).status).toBe(409);
    expect((await fetch(confirm, { method: 'POST', headers, body: JSON.stringify({ projectId: 'allowed-project', challenge: preparedAgain.challenge }) })).status).toBe(409);
  });

  it('shows only aged scratch candidates without deleting them automatically', async () => {
    const { base, session } = await fixture();
    const oldFile = path.join(session, 'scratch', 'old.txt');
    fs.writeFileSync(oldFile, 'keep until confirmed');
    const oldTime = new Date(Date.now() - 40 * 86400_000);
    fs.utimesSync(oldFile, oldTime, oldTime);
    const preview = await (await fetch(base + '/retention/preview?days=30')).json();
    expect(preview.dryRun).toBe(true);
    expect(preview.autoDelete).toBe(false);
    expect(preview.candidates.map((item: any) => item.sessionId)).toContain('sess_local');
    expect(fs.readFileSync(oldFile, 'utf8')).toBe('keep until confirmed');
    const shorter = await (await fetch(base + '/retention/preview?days=90')).json();
    expect(shorter.candidates).toHaveLength(0);
    expect((await fetch(base + '/retention/preview?days=1')).status).toBe(400);
  });

  it('refuses scratch cleanup while an AGY/Claude delegation is still active', async () => {
    const { base, root, session } = await fixture();
    const headers = { Authorization: 'Bearer test_operator_very_long_token', 'Content-Type': 'application/json' };
    const jobId = 'clj_1792638000000_aabbccdd';
    const shard = path.join(root, 'cli-bridge', 'delegations', 'jobs.d', jobId);
    fs.mkdirSync(shard, { recursive: true });
    const snapshot = path.join(shard, '1792638000000-0000000001-0123456789abcdef.json');
    fs.writeFileSync(snapshot, JSON.stringify({ jobId, cwd: path.join(session, 'scratch'), status: 'running' }));
    expect((await fetch(base + '/sessions/sess_local/cleanup/prepare', { method: 'POST', headers })).status).toBe(409);
    fs.writeFileSync(snapshot, JSON.stringify({ jobId, cwd: path.join(session, 'scratch'), status: 'succeeded' }));
    expect((await fetch(base + '/sessions/sess_local/cleanup/prepare', { method: 'POST', headers })).status).toBe(200);
  });

  it('imports bounded binary artifacts but never overwrites or accepts traversal', async () => {
    const { base, session } = await fixture();
    const imported = Buffer.from([0x89, 0x50, 0x4e, 0x47, 2, 3, 4]);
    const endpoint = base + '/sessions/sess_local/artifacts/import?name=image-import.png';
    const headers = { Authorization: 'Bearer test_operator_very_long_token', 'Content-Type': 'application/octet-stream' };
    const response = await fetch(endpoint, { method: 'POST', headers, body: imported });
    expect(response.status).toBe(201);
    expect(fs.readFileSync(path.join(session, 'artifacts', 'image-import.png'))).toEqual(imported);
    expect((await fetch(endpoint, { method: 'POST', headers, body: imported })).status).toBe(409);
    expect((await fetch(base + '/sessions/sess_local/artifacts/import?name=..%2Fbad.png', { method: 'POST', headers, body: imported })).status).toBe(409);
    expect((await fetch(base + '/sessions/sess_local/artifacts/import?name=run.exe', { method: 'POST', headers, body: imported })).status).toBe(409);
  });

  it('supports resumable 20 MiB-capable chunk uploads and indexed session resume', async () => {
    const { base, session } = await fixture();
    const body = Buffer.alloc(310000, 0x7a);
    const sha256 = crypto.createHash('sha256').update(body).digest('hex');
    const start = await fetch(base + '/sessions/sess_local/transfers', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ filename:'resumable.zip', totalBytes:body.length, sha256 }),
    });
    expect(start.status).toBe(201);
    const started = await start.json();
    expect(started.transferId).toMatch(/^btx_/);
    const chunk = async (offset: number, bytes: Buffer) => fetch(
      base + '/sessions/sess_local/transfers/' + started.transferId + '/chunk?offset=' + offset,
      { method:'POST', headers:{'Content-Type':'application/octet-stream'}, body:bytes },
    );
    expect((await chunk(0, body.subarray(0,150000))).status).toBe(200);
    expect((await chunk(0, body.subarray(0,100))).status).toBe(409);
    const status = await (await fetch(base + '/sessions/sess_local/transfers/' + started.transferId)).json();
    expect(status.offset).toBe(150000);
    expect((await chunk(150000, body.subarray(150000,300000))).status).toBe(200);
    expect((await chunk(300000, body.subarray(300000))).status).toBe(200);
    const finish = await fetch(base + '/sessions/sess_local/transfers/' + started.transferId + '/finish', {method:'POST'});
    expect(finish.status).toBe(200);
    expect(fs.readFileSync(path.join(session,'artifacts','resumable.zip'))).toEqual(body);
    const annotated = await fetch(base + '/sessions/sess_local/annotate', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({filePath:'artifacts/resumable.zip',summary:'Verified generated archive',tags:['generated']}),
    });
    expect(annotated.status).toBe(200);
    const searched = await (await fetch(base + '/search?q=generated')).json();
    expect(searched.records.map((v:any)=>v.path)).toContain('artifacts/resumable.zip');
    const resume = await (await fetch(base + '/sessions/sess_local/resume')).json();
    expect(resume.records[0].summary).toBe('Verified generated archive');
    const candidate = await (await fetch(base + '/sessions/sess_local/memory-candidate?path=artifacts%2Fresumable.zip')).json();
    expect(candidate.requiresExplicitRMemorySave).toBe(true);
    expect(candidate.content).toContain('Verified generated archive');
    fs.writeFileSync(path.join(session,'artifacts','resumable.zip'),'modified');
    const changed = await fetch(base + '/sessions/sess_local/memory-candidate?path=artifacts%2Fresumable.zip');
    expect(changed.status).toBe(404);
    const recentSearch = await (await fetch(base + '/search?q=generated')).json();
    expect(recentSearch.records).toHaveLength(0);
  });

  it('exposes only scoped operational counters without leaking artifact data', async () => {
    const { base, root } = await fixture();
    const token = 'Bearer scoped_operator_secret';
    const before = await (await fetch(base + '/metrics')).json();
    expect(before.events).toBe(0);
    const headers = { Authorization: token, 'Content-Type': 'application/json' };
    await fetch(base + '/sessions/sess_local/cleanup/prepare', { method: 'POST', headers });
    const metrics = await (await fetch(base + '/metrics')).json();
    expect(metrics.events).toBe(1);
    expect(metrics.types[0].event).toBe('cleanup.prepare');
    const json = JSON.stringify(metrics);
    expect(json).not.toContain(token);
    expect(json).not.toContain(root);
    expect(json).not.toContain('sess_local');
    expect(json).not.toContain('result.md');
  });

  it('coordinates multi-agent tasks with exclusive claims and durable checkpoints through HTTP', async () => {
    const {base,session}=await fixture();
    const create=await fetch(base+'/sessions/sess_local/tasks',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({title:'Review generated output',agentIds:['agy','claude']}),
    });
    expect(create.status).toBe(201);
    const task=await create.json();
    expect(task.taskId).toMatch(/^task_/);
    const taskBase=base+'/sessions/sess_local/tasks/'+task.taskId;
    const jsonPost=(suffix:string,body:unknown)=>fetch(taskBase+suffix,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
    });
    const claimed=await (await jsonPost('/claim',{agentId:'agy'})).json();
    expect(claimed.task.assignedTo).toBe('agy');
    expect((await jsonPost('/claim',{agentId:'claude'})).status).toBe(409);
    fs.writeFileSync(path.join(session,'artifacts','collab.txt'),'prepared');
    const ck=await (await jsonPost('/checkpoint',{
      agentId:'agy',note:'Experiment finished',nextStep:'Claude review',
      artifactPaths:['artifacts/collab.txt'],
    })).json();
    expect(ck.checkpoint.version).toBe(1);
    const handed=await (await jsonPost('/handoff',{agentId:'agy',toAgent:'claude',filePath:'artifacts/collab.txt'})).json();
    expect(handed.record.bytes).toBe(8);
    expect(handed.record.sha256).toBe(crypto.createHash('sha256').update('prepared').digest('hex'));
    expect((await jsonPost('/transfer',{agentId:'claude',toAgent:'agy'})).status).toBe(409);
    expect((await jsonPost('/transfer',{agentId:'agy',toAgent:'claude'})).status).toBe(200);
    const resumed=await (await fetch(taskBase+'/resume')).json();
    expect(resumed.checkpoint.note).toBe('Experiment finished');
    expect(resumed.assignedTo).toBe('claude');
    expect((await jsonPost('/status',{agentId:'claude',status:'completed'})).status).toBe(200);
    expect((await jsonPost('/claim',{agentId:'agy'})).status).toBe(409);
    const list=await (await fetch(base+'/sessions/sess_local/tasks')).json();
    expect(list.tasks).toHaveLength(1);
    expect(list.tasks[0].status).toBe('completed');
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
