import http from 'node:http';
import { Router, type Request } from 'express';
import { getSuperAgentServiceHeaders } from './superAgentAuth';

/** Read-only, operator-only Core approval reconciliation. Decisions go through
 * the existing live WebSocket path and Core owner check, never through this proxy. */
export function createApprovalStatusProxy(options: {
  port?: number; getServiceHeaders?: () => Record<string,string>;
} = {}) {
  const router = Router();
  router.get('/', (req: Request, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const operator = (req as Request & { user?: {role?: string; source?: string} }).user;
    if (!operator || (operator.role !== 'admin' && operator.source !== 'local')) {
      res.status(403).json({ error: 'Local operator required' }); return;
    }
    const { workspace, sessionId } = req.query;
    if (typeof workspace !== 'string' || !workspace || workspace.length > 4096 ||
        /[\u0000-\u001f]/.test(workspace) || typeof sessionId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) {
      res.status(400).json({ error: 'Invalid approval scope' }); return;
    }
    const headers = (options.getServiceHeaders ?? getSuperAgentServiceHeaders)();
    if (!headers.Authorization) { res.status(503).json({ error: 'Core authorization unavailable' }); return; }
    const query = new URLSearchParams({ workspace, sessionId });
    const upstream = http.request({
      hostname: '127.0.0.1', port: options.port ?? 7888,
      path: '/api/tline/approvals?' + query.toString(), method: 'GET', timeout: 8000,
      headers: { ...headers, 'x-workspace-path': workspace, 'x-client-mode': 'tline' },
    }, response => {
      let data = '';
      response.on('data', chunk => {
        data += String(chunk);
        if (data.length > 64_000) upstream.destroy(new Error('Oversized approvals'));
      });
      response.on('end', () => {
        if (res.headersSent) return;
        try { res.status(response.statusCode || 502).json(JSON.parse(data)); }
        catch { res.status(502).json({ error: 'Invalid Core approval state' }); }
      });
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Core approval timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) res.status(503).json({ error: 'Core approval state unavailable' });
    });
    upstream.end();
  });
  return router;
}
