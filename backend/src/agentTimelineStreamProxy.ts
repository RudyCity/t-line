import http from 'node:http';
import { Router, type Request } from 'express';
import { getSuperAgentServiceHeaders } from './superAgentAuth';

/** Local-only, fixed Core SSE journal proxy. Never forwards cookies, arbitrary
 * headers, user-provided hosts or tool commands. */
export function createAgentTimelineStreamProxy(options: {
  port?: number; getServiceHeaders?: () => Record<string,string>;
} = {}) {
  const router = Router();
  router.get('/', (req: Request, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const user = (req as Request & { user?: {role?: string;source?: string} }).user;
    if (!user || (user.role !== 'admin' && user.source !== 'local')) {
      res.status(403).json({error:'Local operator required'}); return;
    }
    const { workspace, sessionId, cursor = '0' } = req.query;
    if (typeof workspace !== 'string' || !workspace || workspace.length > 4096 ||
        /[\u0000-\u001f]/.test(workspace) || typeof sessionId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId) ||
        typeof cursor !== 'string' || !/^\d{1,15}$/.test(cursor)) {
      res.status(400).json({error:'Exact journal scope required'}); return;
    }
    const headers = (options.getServiceHeaders ?? getSuperAgentServiceHeaders)();
    if (!headers.Authorization) { res.status(503).json({error:'Core authorization unavailable'}); return; }
    const q = new URLSearchParams({workspace,sessionId,cursor});
    const upstream = http.request({
      hostname:'127.0.0.1',port:options.port ?? 7888,
      path:'/api/tline/agent-timeline/stream?' + q.toString(),
      method:'GET', headers:{...headers,'x-client-mode':'tline','x-workspace-path':workspace,
        Accept:'text/event-stream'}, timeout: 45000,
    }, response => {
      if (response.statusCode !== 200 ||
          !String(response.headers['content-type'] || '').includes('text/event-stream')) {
        res.status(response.statusCode || 502).json({error:'Core timeline stream refused'});
        upstream.destroy(); return;
      }
      res.writeHead(200, { 'Content-Type':'text/event-stream; charset=utf-8',
        'Cache-Control':'no-store, no-transform',Connection:'keep-alive',
        'X-Accel-Buffering':'no' });
      response.on('data', chunk => {
        if (!res.destroyed && !res.writableEnded) res.write(chunk);
      });
      response.on('end', () => { if (!res.writableEnded) res.end(); });
      response.on('error', () => { if (!res.writableEnded) res.end(); });
    });
    res.on('close', () => upstream.destroy());
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) res.status(503).json({error:'Core stream unavailable'});
      else if (!res.writableEnded) res.end();
    });
    upstream.end();
  });
  return router;
}
