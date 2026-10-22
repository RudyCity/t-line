import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import { createMotionProxyRouter } from '../src/motionProxy';
import { readSuperAgentServiceToken } from '../src/superAgentAuth';

const cleanup: Array<() => Promise<void>> = [];
async function listen(server: http.Server): Promise<number> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('listener missing');
  cleanup.push(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return address.port;
}

afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});

describe('T-Line Motion proxy and service authentication', () => {
  it('rejects invalid service token metadata without disclosing credentials', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tline-motion-token-'));
    cleanup.push(async () => { fs.rmSync(dir, { recursive: true, force: true }); });
    const file = path.join(dir, 'server-info-7888.json');
    expect(readSuperAgentServiceToken(file)).toBeNull();
    fs.writeFileSync(file, JSON.stringify({ port: 7777, authToken: 'a'.repeat(48) }));
    expect(readSuperAgentServiceToken(file)).toBeNull();
    fs.writeFileSync(file, JSON.stringify({ port: 7888, authToken: 'a'.repeat(48) }));
    expect(readSuperAgentServiceToken(file)).toBe('a'.repeat(48));
  });

  it('proxies JSON and bounded video byte-ranges with server-only credentials', async () => {
    const serviceKey = 'b'.repeat(48);
    const upstream = http.createServer((req, res) => {
      if (req.headers.authorization !== 'Bearer ' + serviceKey) {
        res.writeHead(401); res.end(); return;
      }
      if (req.url?.includes('/artifact')) {
        if (req.headers.range === 'bytes=0-3') {
          res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Length': '4', 'Content-Range': 'bytes 0-3/8', 'Accept-Ranges': 'bytes' });
          res.end(Buffer.from('MP4!'));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': '8' });
        res.end(Buffer.from('MP4!FILE'));
        return;
      }
      res.writeHead(req.method === 'POST' ? 201 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: req.url, workspace: req.headers['x-workspace-path'], bodyMethod: req.method }));
    });
    const upstreamPort = await listen(upstream);
    const app = express();
    app.use(express.json());
    app.use('/api/superagent/motion', createMotionProxyRouter({ upstreamPort, serviceToken: () => serviceKey,
      isAuthorizedWorkspace: workspace => workspace === 'allowed-root' || workspace === 'one',
      ensureTrust: async () => {},
    }));
    const server = http.createServer(app);
    const port = await listen(server);
    const base = 'http://127.0.0.1:' + port + '/api/superagent/motion';
    expect((await fetch(base)).status).toBe(400);
    const list = await fetch(base + '/projects?workspace=allowed-root', { headers: { Authorization: 'Bearer FRONTEND_TOKEN' } });
    expect(list.status).toBe(200);
    const metadata = await list.json();
    expect(metadata.workspace).toBe('allowed-root');
    const scheduler = await fetch(base + '/scheduler?workspace=allowed-root');
    expect(scheduler.status).toBe(200);
    expect((await scheduler.json()).url).toContain('/api/motion/scheduler');
    const supervisor = await fetch(base + '/supervisor?workspace=allowed-root');
    expect(supervisor.status).toBe(200);
    expect((await supervisor.json()).url).toContain('/api/motion/supervisor');
    expect((await fetch(base + '/supervisor?workspace=allowed-root', { method: 'POST' })).status).toBe(404);
    expect((await fetch(base + '/supervisor?workspace=foreign')).status).toBe(403);
    const storage = await fetch(base + '/storage?workspace=allowed-root');
    expect(storage.status).toBe(200);
    expect((await storage.json()).url).toContain('/api/motion/storage');
    const queueRecovery = await fetch(base + '/queue-recovery?workspace=allowed-root');
    expect(queueRecovery.status).toBe(200);
    expect((await queueRecovery.json()).url).toContain('/api/motion/queue-recovery');
    expect((await fetch(base + '/queue-recovery?workspace=allowed-root', { method: 'POST' })).status).toBe(404);
    expect((await fetch(base + '/queue-recovery?workspace=unknown')).status).toBe(403);
    expect((await fetch(base + '/storage?workspace=allowed-root', { method: 'POST' })).status).toBe(404);
    expect((await fetch(base + '/storage?workspace=unknown')).status).toBe(403);
    expect(metadata.url).toContain('workspace=allowed-root');
    expect(JSON.stringify(metadata)).not.toContain(serviceKey);
    const assetId = 'asset-' + 'c'.repeat(64);
    const uploaded = await fetch(base + '/assets?workspace=allowed-root', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: 'QUJDREVGR0g=' }),
    });
    expect(uploaded.status).toBe(201);
    expect((await uploaded.json()).url).toContain('/api/motion/assets?workspace=allowed-root');
    const loaded = await fetch(base + '/assets/' + assetId + '?workspace=allowed-root');
    expect(loaded.status).toBe(200);
    const checked = await fetch(base + '/assets/' + assetId + '?workspace=allowed-root', { method: 'HEAD' });
    expect(checked.status).toBe(200);
    expect((await fetch(base + '/assets/' + assetId + '?workspace=unknown')).status).toBe(403);
    const audioId = 'audio-' + 'b'.repeat(64);
    const uploadedAudio = await fetch(base + '/audio?workspace=allowed-root', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: 'QUJDREVGR0g=' }),
    });
    expect(uploadedAudio.status).toBe(201);
    expect((await uploadedAudio.json()).url).toContain('/api/motion/audio?workspace=allowed-root');
    expect((await fetch(base + '/audio/' + audioId + '?workspace=allowed-root')).status).toBe(200);
    expect((await fetch(base + '/audio/' + audioId + '/waveform?workspace=allowed-root')).status).toBe(200);
    expect((await fetch(base + '/audio/' + audioId + '/waveform?workspace=unknown')).status).toBe(403);
    expect((await fetch(base + '/audio/' + audioId + '/waveform?workspace=allowed-root', { method: 'POST' })).status).toBe(404);
    expect((await fetch(base + '/audio/' + audioId + '?workspace=allowed-root', { method: 'HEAD' })).status).toBe(200);
    expect((await fetch(base + '/audio/' + audioId + '?workspace=unknown')).status).toBe(403);
    const created = await fetch(base + '/projects?workspace=allowed-root', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Motion Demo' }),
    });
    expect(created.status).toBe(201);
    const generated = await fetch(base + '/generate?workspace=allowed-root', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Video promo Laris', width: 640 }),
    });
    expect(generated.status).toBe(201);
    expect((await generated.json()).url).toContain('/api/motion/generate?workspace=allowed-root');
    const motionId = 'motion-' + 'a'.repeat(20);
    expect((await fetch(base + '/presets?workspace=allowed-root')).status).toBe(200);
    expect((await fetch(base + '/presets/neon-impact?workspace=allowed-root')).status).toBe(200);
    expect((await fetch(base + '/effects?workspace=allowed-root')).status).toBe(200);
    const paginated = await fetch(base + '/effects?limit=100&offset=100&category=entrance&q=slide&workspace=allowed-root');
    expect(paginated.status).toBe(200);
    const paginatedUrl = new URL('http://localhost' + (await paginated.json()).url);
    expect(paginatedUrl.searchParams.get('offset')).toBe('100');
    expect(paginatedUrl.searchParams.get('limit')).toBe('100');
    expect(paginatedUrl.searchParams.get('category')).toBe('entrance');
    expect(paginatedUrl.searchParams.get('q')).toBe('slide');
    expect(paginatedUrl.searchParams.get('workspace')).toBe('allowed-root');
    expect((await fetch(base + '/effects?limit[]=1&workspace=allowed-root')).status).toBe(400);
    expect((await fetch(base + '/effects?limit=1&limit=2&workspace=allowed-root')).status).toBe(400);
    expect((await fetch(base + '/effects/entrance-fade-in?workspace=allowed-root')).status).toBe(200);
    expect((await fetch(base + '/presets?workspace=forbidden')).status).toBe(403);
    expect((await fetch(base + '/presets?workspace=allowed-root', { method: 'POST' })).status).toBe(404);
    expect((await fetch(base + '/projects/' + motionId + '/presets?workspace=allowed-root')).status).toBe(404);
    expect((await fetch(base + '/projects/' + motionId + '/presets/preview?workspace=allowed-root')).status).toBe(404);
    expect((await fetch(base + '/projects/' + motionId + '/effects/preview?workspace=allowed-root')).status).toBe(404);
    expect((await fetch(base + '/projects/' + motionId + '/effect-stack?workspace=allowed-root')).status).toBe(404);
    for (const suffix of ['/presets', '/presets/preview', '/effects', '/effects/preview', '/effect-stack', '/effect-stack/preview']) {
      const result = await fetch(base + '/projects/' + motionId + suffix + '?workspace=allowed-root', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRevision: 1, presetId: 'neon-impact', targetLayerId: 'title' }),
      });
      expect(result.status).toBe(201);
      expect((await result.json()).url).toContain('/api/motion/projects/' + motionId + suffix);
    }
    const revised = await fetch(base + '/projects/' + motionId + '/revise?workspace=allowed-root', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Make title shorter', width: 640 }),
    });
    expect(revised.status).toBe(201);
    expect((await revised.json()).url).toContain('/api/motion/projects/' + motionId + '/revise');
    expect((await fetch(base + '/generate?workspace=allowed-root')).status).toBe(404);
    expect((await fetch(base + '/projects/' + motionId + '/revise?workspace=allowed-root')).status).toBe(404);
    expect((await fetch(base + '/generate?workspace=foreign', { method: 'POST', body: '{}' })).status).toBe(403);
    const frame = await fetch(base + '/projects/' + motionId + '/frames/45.png?workspace=allowed-root');
    expect(frame.status).toBe(200);
    expect((await frame.json()).url).toContain('/api/motion/projects/' + motionId + '/frames/45.png');
    expect((await fetch(base + '/projects/' + motionId + '/frames/45.png?workspace=foreign')).status).toBe(403);
    expect((await fetch(base + '/projects/' + motionId + '/frames/45.png?workspace=allowed-root', {
      method: 'POST',
    })).status).toBe(404);
    expect((await fetch(base + '/projects/' + motionId + '/frames/45.png?workspace=allowed-root', {
      method: 'HEAD',
    })).status).toBe(404);
    const visionRepair = await fetch(base + '/projects/' + motionId + '/vision-repair?workspace=allowed-root', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseRevision: 1, width: 640 }),
    });
    expect(visionRepair.status).toBe(201);
    expect((await visionRepair.json()).url).toContain('/api/motion/projects/' + motionId + '/vision-repair');
    expect((await fetch(base + '/projects/' + motionId + '/vision-repair?workspace=allowed-root')).status).toBe(404);
    expect((await fetch(base + '/projects/' + motionId + '/vision-repair?workspace=foreign', {
      method: 'POST',
    })).status).toBe(403);
    const reviewed = await fetch(base + '/projects/' + motionId + '/vision-review?workspace=allowed-root', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    expect(reviewed.status).toBe(201);
    expect((await reviewed.json()).url).toContain('/api/motion/projects/' + motionId + '/vision-review');
    expect((await fetch(base + '/projects/' + motionId + '/vision-review?workspace=allowed-root')).status).toBe(404);
    expect((await fetch(base + '/projects/' + motionId + '/vision-review?workspace=foreign', {
      method: 'POST',
    })).status).toBe(403);
    const srt = await fetch(base + '/projects/' + motionId + '/captions.srt?workspace=allowed-root');
    expect(srt.status).toBe(200);
    expect((await srt.json()).url).toContain('/api/motion/projects/' + motionId + '/captions.srt');
    expect((await fetch(base + '/projects/' + motionId + '/captions.srt?workspace=allowed-root', {
      method: 'POST',
    })).status).toBe(404);
    expect((await fetch(base + '/projects/' + motionId + '/captions.srt?workspace=foreign')).status).toBe(403);
    const quality = await fetch(base + '/projects/' + motionId + '/quality?workspace=allowed-root');
    expect(quality.status).toBe(200);
    expect((await quality.json()).url).toContain('/api/motion/projects/' + motionId + '/quality');
    expect((await fetch(base + '/projects/' + motionId + '/quality?workspace=foreign')).status).toBe(403);
    expect((await fetch(base + '/projects/' + motionId + '/quality?workspace=allowed-root', {
      method: 'POST',
    })).status).toBe(404);
    const artifact = '/jobs/motionjob-' + 'a'.repeat(24) + '/artifact?workspace=allowed-root';
    const range = await fetch(base + artifact, { headers: { Range: 'bytes=0-3' } });
    expect(range.status).toBe(206);
    expect(range.headers.get('content-range')).toBe('bytes 0-3/8');
    expect(Buffer.from(await range.arrayBuffer()).toString()).toBe('MP4!');
    const head = await fetch(base + artifact, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('content-type')).toBe('video/mp4');
    expect((await fetch(base + '/projects?workspace=one', { headers: { 'x-workspace-path': 'two' } })).status).toBe(400);
  });

  it('fails closed without service metadata or for a forbidden proxy path', async () => {
    const app = express();
    app.use('/api/superagent/motion', createMotionProxyRouter({ serviceToken: () => null, isAuthorizedWorkspace: () => true }));
    const port = await listen(http.createServer(app));
    const base = 'http://127.0.0.1:' + port + '/api/superagent/motion';
    expect((await fetch(base + '/projects?workspace=local')).status).toBe(503);
    expect((await fetch(base + '/arbitrary?workspace=local')).status).toBe(404);
  });
});
