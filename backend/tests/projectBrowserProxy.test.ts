import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import superAgentRouter from '../src/superAgentRoutes';
import { localBypassToken } from '../src/auth';

const closing: Array<() => Promise<void>> = [];
let configDir = '';

async function start(handler: http.RequestListener) {
  const server = http.createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  closing.push(() => new Promise(resolve => server.close(() => resolve())));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('listener unavailable');
  return address.port;
}

async function fixture(coreStatus: (url: string, method: string) => number = () => 200) {
  const observed: Array<{ url: string; method: string; body: string; auth?: string; mode?: string }> = [];
  const corePort = await start((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      observed.push({
        url: req.url || '',
        method: req.method || '',
        body,
        auth: req.headers.authorization,
        mode: String(req.headers['x-client-mode'] || ''),
      });
      const status = coreStatus(req.url || '', req.method || '');
      res.writeHead(status, { 'Content-Type': 'application/json' });
      if ((req.url || '').startsWith('/api/projects/browser?')) {
        res.end(JSON.stringify({
          success: true,
          projects: [],
          identities: [],
          selectedIdentityHandle: null,
          total: 0,
          limit: 50,
          offset: 0,
        }));
      } else {
        res.end(JSON.stringify({ success: status < 400, error: status >= 400 ? 'core rejected' : undefined }));
      }
    });
  });

  process.env.TLINE_SUPERAGENT_CORE_PORT = String(corePort);
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'server-info-' + corePort + '.json'),
    JSON.stringify({ port: corePort, authToken: 'a'.repeat(48) }),
  );

  const app = express();
  app.use(express.json());
  app.use('/api/superagent', superAgentRouter);
  const port = await start(app);
  return {
    base: 'http://127.0.0.1:' + port + '/api/superagent/projects/browser',
    observed,
  };
}

function auth(json = false) {
  return {
    Authorization: 'Bearer ' + localBypassToken,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

beforeEach(() => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tline-project-browser-'));
  process.env.SUPERAGENT_CONFIG_DIR = configDir;
});

afterEach(async () => {
  for (const stop of closing.splice(0).reverse()) await stop();
  delete process.env.TLINE_SUPERAGENT_CORE_PORT;
  delete process.env.SUPERAGENT_CONFIG_DIR;
  fs.rmSync(configDir, { recursive: true, force: true });
});

describe('MCP project browser fixed proxy', () => {
  it('fails closed locally when the Core service token is unavailable', async () => {
    const observed: string[] = [];
    const corePort = await start((req, res) => {
      observed.push(String(req.url));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    process.env.TLINE_SUPERAGENT_CORE_PORT = String(corePort);
    // Intentionally do not create server-info-<port>.json.
    const app = express();
    app.use(express.json());
    app.use('/api/superagent', superAgentRouter);
    const port = await start(app);
    const response = await fetch(
      'http://127.0.0.1:' + port + '/api/superagent/projects/browser?filter=all',
      { headers: auth() },
    );
    expect(response.status).toBe(503);
    expect(observed).toHaveLength(0);
    const payload = await response.json() as any;
    expect(payload.error).toContain('authentication');
  });

  it('forwards only allowlisted GET filters and keeps the Core token server-side', async () => {
    const { base, observed } = await fixture();
    const response = await fetch(
      base + '?filter=registered&query=hello&identityHandle=idh_0123456789abcdef&limit=20&offset=4&evil=drop-me',
      { headers: auth() },
    );
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.projects).toEqual([]);
    expect(observed).toHaveLength(1);
    expect(observed[0].method).toBe('GET');
    expect(observed[0].url).toContain('/api/projects/browser?');
    expect(observed[0].url).toContain('filter=registered');
    expect(observed[0].url).toContain('identityHandle=idh_0123456789abcdef');
    expect(observed[0].url).not.toContain('evil=');
    expect(observed[0].auth).toBe('Bearer ' + 'a'.repeat(48));
    expect(observed[0].mode).toBe('tline');
  });

  it('rejects renderer-supplied secret and arbitrary target fields without contacting Core', async () => {
    const { base, observed } = await fixture();
    const response = await fetch(base + '/import', {
      method: 'POST',
      headers: auth(true),
      body: JSON.stringify({
        catalogId: 'cat_0123456789abcdef',
        root: 'D:/forged',
        token: 'must-not-forward',
      }),
    });
    expect(response.status).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it('sanitizes mutation payloads and preserves upstream error statuses', async () => {
    const { base, observed } = await fixture((url) =>
      url === '/api/projects/browser/grant' ? 409 : 403,
    );

    const importResponse = await fetch(base + '/import', {
      method: 'POST',
      headers: auth(true),
      body: JSON.stringify({
        catalogId: 'cat_0123456789abcdef',
        name: 'Example',
        ignored: 'not-forwarded',
      }),
    });
    expect(importResponse.status).toBe(403);
    expect(JSON.parse(observed[0].body)).toEqual({
      catalogId: 'cat_0123456789abcdef',
      name: 'Example',
    });

    const grantResponse = await fetch(base + '/grant', {
      method: 'POST',
      headers: auth(true),
      body: JSON.stringify({
        projectId: 'example',
        identityHandle: 'idh_0123456789abcdef',
        capabilities: ['read', 'read', 'git'],
        command: 'ignored',
      }),
    });
    expect(grantResponse.status).toBe(409);
    expect(JSON.parse(observed[1].body)).toEqual({
      projectId: 'example',
      identityHandle: 'idh_0123456789abcdef',
      capabilities: ['read', 'git'],
    });
  });

  it('uses fixed delete paths and rejects malformed project IDs locally', async () => {
    const { base, observed } = await fixture();
    const invalid = await fetch(base + '/bad%2Fid', { method: 'DELETE', headers: auth() });
    expect(invalid.status).toBe(400);
    expect(observed).toHaveLength(0);

    const valid = await fetch(base + '/project-one', { method: 'DELETE', headers: auth() });
    expect(valid.status).toBe(200);
    expect(observed).toHaveLength(1);
    expect(observed[0].method).toBe('DELETE');
    expect(observed[0].url).toBe('/api/projects/browser/project-one');
  });
});
