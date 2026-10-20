import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { forwardTlineRetry, validRetryRequest } from '../backend/src/superAgentTaskRetry';
const base = { workspace: 'D:/project', sessionId: 'sess_owner',
  jobId: 'clj_1792480000000_deadbeef' };
const prompt = 'Generate a fresh output file after reviewing the result.';
describe('fixed-path backend TLine retry proxy', () => {
  it('rejects arbitrary paths, unsafe sessions and invalid stages without requests', async () => {
    expect(validRetryRequest('prepare', { ...base, prompt })).toBe(true);
    expect(validRetryRequest('confirm', { ...base, challenge: 'a'.repeat(48) })).toBe(true);
    expect(validRetryRequest('prepare', { ...base, prompt: 'short' })).toBe(false);
    expect(validRetryRequest('prepare', { ...base, jobId: '../job', prompt })).toBe(false);
    expect(validRetryRequest('confirm', { ...base, challenge: 'a'.repeat(48), prompt })).toBe(false);
    expect((await forwardTlineRetry('prepare', { ...base, prompt: 'short' })).status).toBe(400);
    expect((await forwardTlineRetry('prepare', { ...base, prompt }, { headers: {} })).status).toBe(503);
  });
  it('forwards only fixed POST actions and server-side credentials', async () => {
    const calls: Array<{ path: string; data: any; mode: string; auth: string }> = [];
    const server = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      calls.push({ path: String(req.url), data: JSON.parse(body),
        mode: String(req.headers['x-client-mode']), auth: String(req.headers.authorization) });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    });
    try {
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const opts = { port: (server.address() as any).port,
        headers: { Authorization: 'Bearer service-secret' } };
      expect((await forwardTlineRetry('prepare', { ...base, prompt }, opts)).status).toBe(200);
      expect((await forwardTlineRetry('confirm', { ...base, challenge: 'a'.repeat(48) }, opts)).status).toBe(200);
      expect(calls.map(c => c.path)).toEqual([
        '/api/tline/tasks/retry/prepare', '/api/tline/tasks/retry/confirm',
      ]);
      expect(calls.every(c => c.mode === 'tline' && c.auth === 'Bearer service-secret')).toBe(true);
      expect(calls[1].data.prompt).toBeUndefined();
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
