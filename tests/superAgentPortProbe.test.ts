import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { probeSuperAgentPort } from '../backend/src/superAgentPortProbe';

describe('T-Line SuperAgent process identity probe', () => {
  it('accepts only a compatible JSON ping and correctly forwards bearer', async () => {
    const seen: string[] = [];
    const server = createServer((req, res) => {
      seen.push(String(req.headers.authorization));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', version: '1.14.8' }));
    });
    try {
      await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
      expect(await probeSuperAgentPort((server.address() as any).port, { Authorization: 'Bearer local-token' }))
        .toBe('compatible');
      expect(seen).toEqual(['Bearer local-token']);
    } finally { await new Promise<void>(r => server.close(() => r())); }
  });

  it('treats unauthorized, HTML and unrelated HTTP servers as occupied, not as ready', async () => {
    const server = createServer((_req, res) => {
      res.statusCode = 401;
      res.end('Unauthorized');
    });
    try {
      await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
      expect(await probeSuperAgentPort((server.address() as any).port, {})).toBe('occupied');
    } finally { await new Promise<void>(r => server.close(() => r())); }
    const other = createServer((_req, res) => res.end('<html>unexpected service</html>'));
    try {
      await new Promise<void>(r => other.listen(0, '127.0.0.1', r));
      expect(await probeSuperAgentPort((other.address() as any).port, {})).toBe('occupied');
    } finally { await new Promise<void>(r => other.close(() => r())); }
  });

  it('recognizes an explicitly unused local port as free', async () => {
    const server = createServer();
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as any).port;
    await new Promise<void>(r => server.close(() => r()));
    expect(await probeSuperAgentPort(port, {})).toBe('free');
  });
});
