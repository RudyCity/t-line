import httpProxy from 'http-proxy';
import type { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import type { RequestHandler } from 'express';

/**
 * Dedicated preview HTTP/WS proxy. No glob-based routing or micromatch/braces
 * dependency. It deliberately exposes only the narrow subset used by T-Line.
 */
type PreviewRequest = IncomingMessage & { originalUrl?: string };
type PreviewOptions = {
  pathFilter: (url: string, req: PreviewRequest) => boolean;
  target: string;
  changeOrigin?: boolean;
  secure?: boolean;
  ws?: boolean;
  selfHandleResponse?: boolean;
  pathRewrite?: Record<string, string>;
  router: (req: PreviewRequest) => string;
  on: {
    proxyReq?: (outgoing: ClientRequest, req: PreviewRequest, res: ServerResponse) => void;
    proxyRes?: (incoming: IncomingMessage, req: PreviewRequest, res: ServerResponse) => void;
    error?: (error: Error & { code?: string }, req: PreviewRequest, res: ServerResponse | Socket) => void;
  };
};
export type PreviewProxyHandler = RequestHandler & {
  upgrade(req: IncomingMessage, socket: Socket, head: Buffer): void;
};

export function createPreviewProxy(options: PreviewOptions): PreviewProxyHandler {
  const proxy = httpProxy.createProxyServer({
    changeOrigin: options.changeOrigin, secure: options.secure,
    ws: options.ws, selfHandleResponse: options.selfHandleResponse,
  });
  if (options.on.proxyReq) proxy.on('proxyReq', options.on.proxyReq);
  if (options.on.proxyRes) proxy.on('proxyRes', options.on.proxyRes);
  // http-proxy calls the per-request callback on network failure. We do not
  // also register an error event to avoid sending duplicate 502 responses.
  function targetFor(req: PreviewRequest): string {
    const target = options.router(req);
    const address = new URL(target);
    if (!['http:', 'https:'].includes(address.protocol) || !address.hostname) {
      throw new Error('Preview proxy target must be HTTP(S)');
    }
    return address.origin;
  }
  function pathFor(req: PreviewRequest): void {
    const original = req.url || '/';
    let normalized = original.replace(/^\/api\/preview-proxy(?=\/|\?|$)/, '') || '/';
    if (normalized.startsWith('?')) normalized = '/' + normalized;
    const path = new URL(normalized, 'http://preview.local');
    path.searchParams.delete('target');
    path.searchParams.delete('tabId');
    req.url = path.pathname + path.search;
  }
  function failed(err: Error & { code?: string }, req: PreviewRequest, response: ServerResponse | Socket) {
    if (options.on.error) options.on.error(err, req, response);
    if (response instanceof Socket && !response.destroyed) response.destroy();
    else if ('headersSent' in response && !response.headersSent && !response.writableEnded) {
      response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Preview proxy upstream unavailable');
    }
  }
  const middleware = ((req: PreviewRequest, res: ServerResponse, next: (error?: any) => void) => {
    if (!options.pathFilter(req.originalUrl || req.url || '/', req)) return next();
    try {
      const target = targetFor(req);
      pathFor(req);
      proxy.web(req, res, { target }, (err) => failed(err, req, res));
    } catch (error) {
      next(error);
    }
  }) as unknown as PreviewProxyHandler;
  middleware.upgrade = (req, socket, head) => {
    const request = req as PreviewRequest;
    if (!options.pathFilter(request.url || '/', request)) {
      socket.destroy();
      return;
    }
    try {
      const target = targetFor(request);
      pathFor(request);
      proxy.ws(request, socket, head, { target }, (err) => failed(err, request, socket));
    } catch {
      socket.destroy();
    }
  };
  return middleware;
}
