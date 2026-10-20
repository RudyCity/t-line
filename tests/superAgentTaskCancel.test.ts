import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { forwardTaskCancel, validateTaskCancelInput } from '../backend/src/superAgentTaskCancel';

const base = { workspace: 'D:/project', sessionId: 'sess_owner',
  jobId: 'clj_1792480000000_deadbeef' };
describe('TLine fixed-path cancellation proxy', () => {
  it('only allows strongly typed workspace, job and session fields', () => {
    expect(validateTaskCancelInput('prepare', base)).toBe(true);
    expect(validateTaskCancelInput('confirm', { ...base, challenge: 'a'.repeat(48) })).toBe(true);
    expect(validateTaskCancelInput('confirm', base)).toBe(false);
    expect(validateTaskCancelInput('prepare', { ...base, challenge: 'a'.repeat(48) })).toBe(false);
    expect(validateTaskCancelInput('prepare', { ...base, jobId: '../pid/77' })).toBe(false);
    expect(validateTaskCancelInput('prepare', { ...base, workspace: 'D:/project\nHost: evil' })).toBe(false);
    expect(validateTaskCancelInput('prepare', { ...base, sessionId: 'other space' })).toBe(false);
  });
  it('never sends an unvalidated mutation and fails closed without service token', async () => {
    expect((await forwardTaskCancel('prepare', { ...base, jobId: 'bad' })).status).toBe(400);
    expect((await forwardTaskCancel('prepare', base, { headers: {} })).status).toBe(503);
  });
  it('sends only fixed 2-phase POST paths to loopback with the server-side token', async () => {
    const requests: Array<{ url: string; body: any; bearer: string; mode: string }> = [];
    const server = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      requests.push({ url: String(req.url), body: JSON.parse(body),
        bearer: String(req.headers.authorization), mode: String(req.headers['x-client-mode']) });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, challenge: 'a'.repeat(48), jobId: base.jobId }));
    });
    try {
      await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
      const opts = { port: (server.address() as any).port,
        headers: { Authorization: 'Bearer private-backend' } };
      expect((await forwardTaskCancel('prepare', base, opts)).status).toBe(200);
      expect((await forwardTaskCancel('confirm', { ...base, challenge: 'a'.repeat(48) }, opts)).status).toBe(200);
      expect(requests.map(r => r.url)).toEqual([
        '/api/tline/tasks/cancel/prepare', '/api/tline/tasks/cancel/confirm',
      ]);
      expect(requests.every(r => r.bearer === 'Bearer private-backend' && r.mode === 'tline')).toBe(true);
      expect(requests[1].body.challenge).toBe('a'.repeat(48));
    } finally { await new Promise<void>(r => server.close(() => r())); }
  });
});
