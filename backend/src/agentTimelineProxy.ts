import { resolveSuperAgentCorePort } from './superAgentCorePort';
/** Fixed read-only T-Line proxy for the Core per-agent event journal.
 * Authenticated local operator only; no arbitrary destination, raw tools or mutations.
 */
import http from 'node:http';
import { Router, type Request } from 'express';
import { getSuperAgentServiceHeaders } from './superAgentAuth';

export function createAgentTimelineProxy(options: {
  port?: number; getServiceHeaders?: () => Record<string, string>;
} = {}) {
  const router = Router();
  const port = options.port ?? resolveSuperAgentCorePort();
  const getHeaders = options.getServiceHeaders ?? getSuperAgentServiceHeaders;
  router.get('/', (req: Request, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const user = (req as Request & { user?: { role?: string; source?: string } }).user;
    if (!user || (user.role !== 'admin' && user.source !== 'local')) {
      res.status(403).json({ error: 'Local operator authority required' }); return;
    }
    const { workspace, sessionId, cursor = '0' } = req.query;
    if (typeof workspace !== 'string' || !workspace || workspace.length > 4096 ||
        /[\u0000-\u001f]/.test(workspace) || typeof sessionId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId) ||
        typeof cursor !== 'string' || !/^\d{1,15}$/.test(cursor)) {
      res.status(400).json({ error: 'Exact workspace, session and cursor required' }); return;
    }
    const headers = getHeaders();
    if (!headers.Authorization) {
      res.status(503).json({ error: 'Core authorization unavailable' }); return;
    }
    const query = new URLSearchParams({ workspace, sessionId, cursor });
    const upstream = http.request({
      hostname: '127.0.0.1', port,
      path: '/api/tline/agent-timeline?' + query.toString(),
      method: 'GET', timeout: 8000,
      headers: { ...headers, 'x-workspace-path': workspace, 'x-client-mode': 'tline' },
    }, response => {
      let data = '';
      response.on('data', chunk => {
        data += String(chunk);
        if (data.length > 256_000) upstream.destroy(new Error('Oversized Core journal'));
      });
      response.on('end', () => {
        if (res.headersSent) return;
        try { res.status(response.statusCode || 502).json(JSON.parse(data)); }
        catch { res.status(502).json({ error: 'Invalid Core timeline response' }); }
      });
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Core journal timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) res.status(503).json({ error: 'Core timeline unavailable' });
    });
    upstream.end();
  });
  return router;
}
