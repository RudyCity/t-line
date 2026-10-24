import http from 'node:http';
import { Router, type Request, type Response } from 'express';
import { readSuperAgentServiceToken } from './superAgentAuth';
import { isRegisteredStudioWorkspace, ensureStudioWorkspaceTrusted } from './studioWorkspaceAccess';

const permitted = [
  /^\/$/,
  /^\/projects$/,
  /^\/scheduler$/,
  /^\/generate$/,
  /^\/supervisor$/,
  /^\/storage$/,
  /^\/queue-recovery$/,
  /^\/presets$/,
  /^\/templates$/,
  /^\/storyboard\/(?:plan|preview|render)$/,
  /^\/brand-kit$/,
  /^\/presets\/[a-z][a-z0-9-]{1,63}$/,
  /^\/effects$/,
  /^\/effects\/[a-z][a-z0-9-]{1,63}$/,
  /^\/assets$/,
  /^\/assets\/asset-[a-f0-9]{64}$/,
  /^\/audio$/,
  /^\/audio\/audio-[a-f0-9]{64}$/,
  /^\/audio\/audio-[a-f0-9]{64}\/waveform$/,
  /^\/palettes$/,
  /^\/mockups$/,
  /^\/saas-promo$/,
  /^\/trace-image$/,
  /^\/events$/,
  /^\/tline-bridge$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}(?:\/edits|\/render|\/revise)?$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/(?:presets|effects)$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/presets\/preview$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/effects\/preview$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/effect-stack(?:\/preview)?$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/resize(?:\/preview)?$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/upscale(?:\/(?:preview|targets))?$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/history$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/history\/restore$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/templates(?:\/preview)?$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/variants$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/beat-sync(?:\/preview)?$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/particles(?:\/preview)?$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/typography(?:\/preview)?$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/bundle$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/vectorize$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/mockup$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/chart$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/(?:player|preview)$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/quality$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/vision-review$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/vision-repair$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/captions\.srt$/,
  /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/frames\/\d{1,6}\.png$/,
  /^\/jobs$/,
  /^\/jobs\/(?:studiojob|motionjob)-[a-f0-9]{24}(?:\/cancel|\/recovery|\/artifact|\/upscale)?$/,
  /^\/jobs\/(?:studiojob|motionjob)-[a-f0-9]{24}\/exports\/(?:gif|webm)$/,
];

function allowedRoute(method: string, pathname: string): boolean {
  if (!permitted.some(pattern => pattern.test(pathname))) return false;
  if (method === 'GET') {
    return !pathname.startsWith('/storyboard/') &&
      !/^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/(?:beat-sync|particles|typography|vectorize|mockup|chart)(?:\/preview)?$/.test(pathname) &&
      !pathname.endsWith('/variants') &&
      !pathname.endsWith('/history/restore') &&
      !pathname.endsWith('/vision-review') &&
      !pathname.endsWith('/vision-repair') &&
      !pathname.endsWith('/edits') &&
      !pathname.endsWith('/render') &&
      !pathname.endsWith('/revise') &&
      !/^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/(?:presets|effects|effect-stack|resize|templates)(?:\/preview)?$/.test(pathname) &&
      !/^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/upscale(?:\/preview)?$/.test(pathname) &&
      pathname !== '/generate' &&
      pathname !== '/saas-promo' &&
      pathname !== '/trace-image' &&
      !pathname.endsWith('/cancel');
  }
  if (method === 'HEAD') return pathname.endsWith('/artifact') || /^\/assets\/asset-[a-f0-9]{64}$/.test(pathname) ||
    /^\/audio\/audio-[a-f0-9]{64}$/.test(pathname);
  if (method === 'POST') {
    return pathname === '/projects' || pathname === '/generate' || pathname === '/saas-promo' || pathname === '/trace-image' ||
      /^\/storyboard\/(?:plan|preview|render)$/.test(pathname) || pathname === '/assets' || pathname === '/audio' || pathname === '/brand-kit' ||
      /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/bundle$/.test(pathname) ||
      /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/(?:beat-sync|particles|typography|vectorize|mockup|chart)(?:\/preview)?$/.test(pathname) ||
      pathname.endsWith('/variants') || pathname.endsWith('/history/restore') || pathname.endsWith('/vision-review') || pathname.endsWith('/vision-repair') || pathname.endsWith('/edits') || pathname.endsWith('/render') || pathname.endsWith('/revise') || pathname.endsWith('/cancel') || pathname.endsWith('/upscale') ||
      /^\/projects\/(?:studio|motion)-[a-f0-9]{20}\/(?:presets|effects|effect-stack|resize|upscale|templates)(?:\/preview)?$/.test(pathname);
  }
  return false;
}

const forwardedResponseHeaders = [
  'content-type', 'content-length', 'content-range', 'accept-ranges',
  'etag', 'cache-control', 'x-content-type-options',
] as const;

interface StudioProxyOptions {
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
export function createStudioProxyRouter(options: StudioProxyOptions = {}): Router {
  const router = Router();
  router.use(async (req: Request, res: Response) => {
    const route = req.path || '/';
    if (!allowedRoute(req.method, route)) {
      res.status(404).json({ error: 'Studio route not found' });
      return;
    }
    const queryWorkspace = typeof req.query.workspace === 'string' ? req.query.workspace : '';
    const headerWorkspace = typeof req.headers['x-workspace-path'] === 'string' ? req.headers['x-workspace-path'] : '';
    if (!queryWorkspace && !headerWorkspace) {
      res.status(400).json({ error: 'Studio workspace is required' });
      return;
    }
    if (queryWorkspace && headerWorkspace && queryWorkspace !== headerWorkspace) {
      res.status(400).json({ error: 'Conflicting Studio workspace identifiers' });
      return;
    }
    const workspace = queryWorkspace || headerWorkspace;
    if (!(options.isAuthorizedWorkspace ?? isRegisteredStudioWorkspace)(workspace)) {
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
      res.status(413).json({ error: 'Studio JSON payload too large' });
      return;
    }
    try {
      await (options.ensureTrust ?? ensureStudioWorkspaceTrusted)(workspace, token, options.upstreamPort ?? 7888);
    } catch {
      res.status(503).json({ error: 'Could not authorize the selected workspace in SuperAgent' });
      return;
    }
    const targetQuery = new URLSearchParams({ workspace });
    // Only forward documented catalogue filters; all other renderer query
    // parameters are deliberately excluded from the upstream request.
    if (req.method === 'GET' && route === '/effects') {
      const allowed = ['limit', 'offset', 'category', 'q', 'targetKind', 'tag'] as const;
      for (const key of allowed) {
        const value = req.query[key];
        if (value === undefined) continue;
        if (typeof value !== 'string' || value.length > 120) {
          res.status(400).json({ error: 'Invalid Studio effects filter: ' + key });
          return;
        }
        targetQuery.set(key, value);
      }
    }
    const targetPath = (req.baseUrl.endsWith('/studio') ? '/api/studio' : '/api/motion') + (route === '/' ? '' : route) + '?' + targetQuery.toString();
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
      path: targetPath, method: req.method, headers,
      timeout: route === '/generate' || route === '/saas-promo' || route === '/trace-image' || route.endsWith('/bundle') ||
        route.includes('/upscale') ||
        route === '/storyboard/plan' || route === '/storyboard/render' || route.endsWith('/revise') ||
        route.includes('/exports/') || route.endsWith('/vision-review') || route.endsWith('/vision-repair')
        ? 120_000 : 30_000,
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
    upstream.on('timeout', () => upstream.destroy(new Error('SuperAgent Studio upstream timed out')));
    upstream.on('error', error => {
      if (!res.headersSent) res.status(502).json({ error: 'SuperAgent Studio upstream unavailable' });
      else res.destroy(error);
    });
    res.on('close', () => upstream.destroy());
    if (body) upstream.end(body);
    else upstream.end();
  });
  return router;
}

export default createStudioProxyRouter();
