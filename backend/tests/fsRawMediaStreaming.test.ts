import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import fsRouter from '../src/fsRoutes';

const closing: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const stop of closing.splice(0).reverse()) await stop();
});

async function startServer(): Promise<{ base: string; tmpDir: string }> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-media-test-'));
  closing.push(async () => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  const app = express();
  // Bypass auth for test
  app.use((req, _res, next) => {
    (req as any).user = { role: 'admin', source: 'local' };
    next();
  });
  app.use('/api/fs', fsRouter);

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  closing.push(() => new Promise(resolve => server.close(() => resolve())));

  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Port unavailable');
  return { base: `http://127.0.0.1:${address.port}/api/fs`, tmpDir };
}

describe('/api/fs/raw Media and Document Streaming', () => {
  it('serves video files with video/mp4 Content-Type, inline Content-Disposition and Accept-Ranges', async () => {
    const { base, tmpDir } = await startServer();
    const testVideo = path.join(tmpDir, 'sample.mp4');
    fs.writeFileSync(testVideo, Buffer.from('FAKE-MP4-STREAM-CONTENT-0123456789'));

    const res = await fetch(`${base}/raw?path=${encodeURIComponent(testVideo)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('content-disposition')).toContain('inline');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(await res.text()).toBe('FAKE-MP4-STREAM-CONTENT-0123456789');
  });

  it('serves HTTP Range partial content (206) for video seeking', async () => {
    const { base, tmpDir } = await startServer();
    const testVideo = path.join(tmpDir, 'sample_range.mp4');
    const content = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    fs.writeFileSync(testVideo, Buffer.from(content));

    const res = await fetch(`${base}/raw?path=${encodeURIComponent(testVideo)}`, {
      headers: { Range: 'bytes=5-14' }
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('content-range')).toBe(`bytes 5-14/${content.length}`);
    expect(res.headers.get('content-length')).toBe('10');
    expect(await res.text()).toBe('56789ABCDE');
  });

  it('serves PDF with application/pdf and inline disposition', async () => {
    const { base, tmpDir } = await startServer();
    const testPdf = path.join(tmpDir, 'sample.pdf');
    fs.writeFileSync(testPdf, Buffer.from('%PDF-1.4 sample content'));

    const res = await fetch(`${base}/raw?path=${encodeURIComponent(testPdf)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('inline');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
  });

  it('serves audio with audio/mpeg and images with image/png', async () => {
    const { base, tmpDir } = await startServer();
    const testMp3 = path.join(tmpDir, 'sample.mp3');
    fs.writeFileSync(testMp3, Buffer.from('AUDIO-DATA'));
    const testPng = path.join(tmpDir, 'sample.png');
    fs.writeFileSync(testPng, Buffer.from('PNG-DATA'));

    const resMp3 = await fetch(`${base}/raw?path=${encodeURIComponent(testMp3)}`);
    expect(resMp3.status).toBe(200);
    expect(resMp3.headers.get('content-type')).toBe('audio/mpeg');

    const resPng = await fetch(`${base}/raw?path=${encodeURIComponent(testPng)}`);
    expect(resPng.status).toBe(200);
    expect(resPng.headers.get('content-type')).toBe('image/png');
  });
});
