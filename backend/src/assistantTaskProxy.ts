import http from 'node:http';
import { Router, type Request, type Response } from 'express';
import { getSuperAgentServiceHeaders } from './superAgentAuth';

/**
 * Explicit operator-only proxy to session-scoped Core task drafts.
 * The parent router already runs authMiddleware; never forward arbitrary URLs,
 * client-supplied owner IDs, extra headers, or a shell/worker action.
 */
export function createAssistantTaskProxy(
  options: { port?: number; getServiceHeaders?: () => Record<string, string> } = {},
) {
  const router = Router();
  const port = options.port ?? 7888;
  const getHeaders = options.getServiceHeaders ?? getSuperAgentServiceHeaders;
  router.use((req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const user = (req as Request & { user?: { role?: string; source?: string } }).user;
    if (!user || (user.role !== 'admin' && user.source !== 'local')) {
      res.status(403).json({ error: 'Local operator authority required' });
      return;
    }
    next();
  });

  const forward = (action: 'list' | 'events' | 'inspect' | 'create' | 'cancel') =>
    async (req: Request, res: Response) => {
      const workspace = req.query.workspace;
      const sessionId = req.query.sessionId;
      const taskId = req.params.taskId;
      if (typeof workspace !== 'string' || !workspace || workspace.length > 4096 ||
          typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) {
        res.status(400).json({ error: 'Explicit workspace and sessionId required' });
        return;
      }
      if ((action === 'inspect' || action === 'cancel') &&
          (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId))) {
        res.status(400).json({ error: 'Invalid task ID' });
        return;
      }
      const supplied = req.body;
      const body: Record<string, unknown> | undefined = action === 'create'
        ? {
          goalId: supplied?.goalId, title: supplied?.title, idempotencyKey: supplied?.idempotencyKey,
        }
        : action === 'cancel'
          ? { expectedRevision: supplied?.expectedRevision }
          : undefined;
      if (action === 'create' &&
          (typeof body?.goalId !== 'string' || typeof body?.title !== 'string' ||
           typeof body?.idempotencyKey !== 'string')) {
        res.status(400).json({ error: 'Invalid task draft' });
        return;
      }
      const payload = body ? JSON.stringify(body) : '';
      if (Buffer.byteLength(payload) > 4096) {
        res.status(413).json({ error: 'Task payload too large' });
        return;
      }
      const headers = getHeaders();
      if (!headers.Authorization) {
        res.status(503).json({ error: 'Core service token unavailable' });
        return;
      }
      let route = '/api/assistant/tasks';
      if (action === 'events') route += '/events';
      if (action === 'inspect' || action === 'cancel') route += '/' + taskId;
      if (action === 'cancel') route += '/cancel';
      const cursor = req.query.cursor;
      if (action === 'events' && cursor !== undefined) {
        if (typeof cursor !== 'string' || !/^\d{1,15}$/.test(cursor)) {
          res.status(400).json({ error: 'Invalid event cursor' });
          return;
        }
      }
      const query = new URLSearchParams({ sessionId, workspace });
      if (action === 'events' && typeof cursor === 'string') query.set('cursor', cursor);
      const method = action === 'create' || action === 'cancel' ? 'POST' : 'GET';
      const upstream = http.request({
        hostname: '127.0.0.1', port, path: route + '?' + query.toString(),
        method, timeout: 8000,
        headers: {
          ...headers, 'x-workspace-path': workspace, 'x-client-mode': 'tline',
          ...(body ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) } : {}),
        },
      }, response => {
        let data = '';
        response.on('data', chunk => {
          data += String(chunk);
          if (data.length > 512_000) upstream.destroy(new Error('Oversized core response'));
        });
        response.on('end', () => {
          if (res.headersSent) return;
          try {
            const parsed = JSON.parse(data);
            res.status(response.statusCode || 502).json(parsed);
          } catch {
            res.status(502).json({ error: 'Invalid core task response' });
          }
        });
      });
      upstream.on('timeout', () => upstream.destroy(new Error('Core task request timeout')));
      upstream.on('error', () => {
        if (!res.headersSent) res.status(503).json({ error: 'Core task journal unavailable' });
      });
      if (payload) upstream.write(payload);
      upstream.end();
    };

  router.get('/', forward('list'));
  router.get('/events', forward('events'));
  router.get('/:taskId', forward('inspect'));
  router.post('/', forward('create'));
  router.post('/:taskId/cancel', forward('cancel'));
  return router;
}
