import http from 'node:http';
import { Router, type Request, type Response } from 'express';
import { readSuperAgentServiceToken } from './superAgentAuth';
import { isRegisteredMotionWorkspace, ensureMotionWorkspaceTrusted } from './motionWorkspaceAccess';

const permitted = [
  /^\/$/,
  /^\/projects$/,
  /^\/scheduler$/,
  /^\/assets$/,
  /^\/assets\/asset-[a-f0-9]{64}$/,
  /^\/audio$/,
  /^\/audio\/audio-[a-f0-9]{64}$/,
  /^\/projects\/motion-[a-f0-9]{20}(?:\/edits|\/render)?$/,
  /^\/jobs$/,
  /^\/jobs\/motionjob-[a-f0-9]{24}(?:\/cancel|\/recovery|\/artifact)?$/,
];

function allowedRoute(method: string, pathname: string): boolean {
  if (!permitted.some(pattern => pattern.test(pathname))) return false;
  if (method === 'GET') return !pathname.endsWith('/edits') && !pathname.endsWith('/render') && !pathname.endsWith('/cancel');
  if (method === 'HEAD') return pathname.endsWith('/artifact') || /^\/assets\/asset-[a-f0-9]{64}$/.test(pathname) ||
    /^\/audio\/audio-[a-f0-9]{64}$/.test(pathname);
  if (method === 'POST') {
    return pathname === '/projects' || pathname === '/assets' || pathname === '/audio' ||
      pathname.endsWith('/edits') || pathname.endsWith('/render') || pathname.endsWith('/cancel');
  }
  return false;
}

const forwardedResponseHeaders = [
  'content-type', 'content-length', 'content-range', 'accept-ranges',
  'etag', 'cache-control', 'x-content-type-options',
] as const;

interface MotionProxyOptions {
  upstreamPort?: number;
  serviceToken?: () => string | null;
  isAuthorizedWorkspace?: (workspace: string) => boolean;
  ensureTrust?: (workspace: string, token: string, port: number) => Promise<void>;
}

/**
 * Must be mounted under superAgentRouter AFTER T-Line authMiddleware.
 * Never exposes SuperAgent credentials to the browser or forwards renderer
 * Authorization headers to the trusted upstream service.
 */
export function createMotionProxyRouter(options: MotionProxyOptions = {}): Router {
  const router = Router();
  router.use(async (req: Request, res: Response) => {
    const route = req.path || '/';
    if (!allowedRoute(req.method, route)) {
      res.status(404).json({ error: 'Motion route not found' });
      return;
    }
    const queryWorkspace = typeof req.query.workspace === 'string' ? req.query.workspace : '';
    const headerWorkspace = typeof req.headers['x-workspace-path'] === 'string' ? req.headers['x-workspace-path'] : '';
    if (!queryWorkspace && !headerWorkspace) {
      res.status(400).json({ error: 'Motion workspace is required' });
      return;
    }
    if (queryWorkspace && headerWorkspace && queryWorkspace !== headerWorkspace) {
      res.status(400).json({ error: 'Conflicting Motion workspace identifiers' });
      return;
    }
    const workspace = queryWorkspace || headerWorkspace;
    if (!(options.isAuthorizedWorkspace ?? isRegisteredMotionWorkspace)(workspace)) {
      res.status(403).json({ error: 'Workspace is not registered as a local T-Line workspace' });
      return;
    }
    const token = (options.serviceToken ?? readSuperAgentServiceToken)();
    if (!token) {
      res.status(503).json({ error: 'SuperAgent service token unavailable' });
      return;
    }
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? Buffer.from(JSON.stringify(req.body ?? {}), 'utf8') : null;
    if (body && body.length > (route === '/audio' ? 3_000_000 : route === '/assets' ? 1_600_000 : 1_000_000)) {
      res.status(413).json({ error: 'Motion JSON payload too large' });
      return;
    }
    try {
      await (options.ensureTrust ?? ensureMotionWorkspaceTrusted)(workspace, token, options.upstreamPort ?? 7888);
    } catch {
      res.status(503).json({ error: 'Could not authorize the selected workspace in SuperAgent' });
      return;
    }
    const targetPath = '/api/motion' + (route === '/' ? '' : route) + '?workspace=' + encodeURIComponent(workspace);
    const headers: Record<string, string> = {
      Authorization: 'Bearer ' + token,
      'x-workspace-path': workspace,
      'x-client-mode': 'tline',
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(body.length);
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && typeof req.headers.range === 'string' && req.headers.range.length <= 120 && route.endsWith('/artifact')) {
      headers.Range = req.headers.range;
    }
    const upstream = http.request({
      hostname: '127.0.0.1', port: options.upstreamPort ?? 7888,
      path: targetPath, method: req.method, headers, timeout: 30_000,
    }, reply => {
      const safeHeaders: Record<string, string> = {};
      for (const name of forwardedResponseHeaders) {
        const value = reply.headers[name];
        if (typeof value === 'string') safeHeaders[name] = value;
      }
      res.writeHead(reply.statusCode ?? 502, safeHeaders);
      if (req.method === 'HEAD') { reply.resume(); res.end(); return; }
      reply.on('error', error => res.destroy(error));
      reply.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('SuperAgent Motion upstream timed out')));
    upstream.on('error', error => {
      if (!res.headersSent) res.status(502).json({ error: 'SuperAgent Motion upstream unavailable' });
      else res.destroy(error);
    });
    res.on('close', () => upstream.destroy());
    if (body) upstream.end(body);
    else upstream.end();
  });
  return router;
}

export default createMotionProxyRouter();
