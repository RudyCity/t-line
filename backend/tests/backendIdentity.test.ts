import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { backendIdentityProof, registerBackendIdentity } from '../src/backendIdentity';

const token = '7'.repeat(64);
const nonce = 'c'.repeat(32);
let server: Server;
let origin: string;

beforeAll(async () => {
  const router = express.Router();
  registerBackendIdentity(router, token);
  const app = express();
  app.use('/api', router);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('T-Line startup backend identity challenge', () => {
  it('proves possession with HMAC without sending bearer credentials', async () => {
    const response = await fetch(origin + '/api/desktop/identity?nonce=' + nonce);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const data = await response.json() as { protocol: string; proof: string };
    expect(data).toEqual({
      protocol: 'tline-backend-v1',
      proof: createHmac('sha256', token).update('tline-backend-v1:' + nonce).digest('hex'),
    });
    expect(JSON.stringify(data)).not.toContain(token);
    expect(backendIdentityProof(nonce, token)).toBe(data.proof);
  });
  it('rejects missing, malformed and repeated/oversized challenge arguments', async () => {
    for (const search of ['', '?nonce=x', '?nonce=' + nonce + '&nonce=' + nonce,
      '?nonce=' + 'a'.repeat(10000)]) {
      const response = await fetch(origin + '/api/desktop/identity' + search);
      expect(response.status).toBe(400);
    }
    expect(() => backendIdentityProof('wrong', token)).toThrow();
  });
  it('does not accept caller supplied token to change the proof', async () => {
    const response = await fetch(origin + '/api/desktop/identity?nonce=' + nonce + '&token=malicious', {
      headers: { Authorization: 'Bearer malicious' },
    });
    expect((await response.json() as { proof: string }).proof).toBe(backendIdentityProof(nonce, token));
  });
});
