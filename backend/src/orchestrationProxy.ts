import { resolveSuperAgentCorePort } from './superAgentCorePort';
import http from 'node:http';
import { Router, type Request, type Response } from 'express';
import { getSuperAgentServiceHeaders } from './superAgentAuth';
import { authMiddleware } from './auth';

/**
 * T-Line proxy for SuperAgent Multi-Agent Orchestration APIs.
 * Connects T-Line dashboard directly to SuperAgent dynamic scheduler,
 * slot capacities, priority queues, and durable DAG workflows.
 */
export function createOrchestrationProxy(options: {
  port?: number;
  getServiceHeaders?: () => Record<string, string>;
} = {}): Router {
  const router = Router();
  const port = options.port ?? resolveSuperAgentCorePort();
  const getHeaders = options.getServiceHeaders ?? getSuperAgentServiceHeaders;

  router.use(authMiddleware);

  const forwardGet = (pathName: string) => (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const headers = getHeaders();
    const ws = typeof req.query.workspace === 'string' ? req.query.workspace : undefined;
    const query = new URLSearchParams();
    if (ws) query.set('workspace', ws);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `${pathName}${queryString}`,
        method: 'GET',
        timeout: 10000,
        headers: {
          ...headers,
          'x-client-mode': 'tline',
          ...(ws ? { 'x-workspace-path': ws } : {}),
        },
      },
      (upstreamRes) => {
        let body = '';
        upstreamRes.on('data', (chunk) => {
          body += String(chunk);
          if (body.length > 512_000) {
            upstream.destroy(new Error('Oversized response from SuperAgent orchestration'));
          }
        });
        upstreamRes.on('end', () => {
          if (res.headersSent) return;
          try {
            res.status(upstreamRes.statusCode || 200).json(JSON.parse(body));
          } catch {
            res.status(upstreamRes.statusCode || 200).send(body);
          }
        });
      }
    );

    upstream.on('timeout', () => {
      upstream.destroy(new Error('SuperAgent orchestration request timed out'));
    });

    upstream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(503).json({ success: false, error: `Orchestration service unreachable: ${err.message}` });
      }
    });

    upstream.end();
  };

  const forwardPost = (pathName: string) => (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const headers = getHeaders();
    const ws = typeof req.query.workspace === 'string'
      ? req.query.workspace
      : (typeof req.body?.workspaceRoot === 'string'
        ? req.body.workspaceRoot
        : (typeof req.body?.workspace === 'string' ? req.body.workspace : undefined));
    const query = new URLSearchParams();
    if (ws) query.set('workspace', ws);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const postData = JSON.stringify({
      ...(req.body ?? {}),
      ...(ws && !req.body?.workspaceRoot ? { workspaceRoot: ws } : {}),
    });

    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `${pathName}${queryString}`,
        method: 'POST',
        timeout: 15000,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'x-client-mode': 'tline',
          ...(ws ? { 'x-workspace-path': ws, 'x-superagent-workspace': ws } : {}),
        },
      },
      (upstreamRes) => {
        let body = '';
        upstreamRes.on('data', (chunk) => {
          body += String(chunk);
          if (body.length > 512_000) {
            upstream.destroy(new Error('Oversized response from SuperAgent orchestration'));
          }
        });
        upstreamRes.on('end', () => {
          if (res.headersSent) return;
          try {
            res.status(upstreamRes.statusCode || 200).json(JSON.parse(body));
          } catch {
            res.status(upstreamRes.statusCode || 200).send(body);
          }
        });
      }
    );

    upstream.on('timeout', () => {
      upstream.destroy(new Error('SuperAgent orchestration request timed out'));
    });

    upstream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(503).json({ success: false, error: `Orchestration service unreachable: ${err.message}` });
      }
    });

    upstream.write(postData);
    upstream.end();
  };

  router.get('/status', forwardGet('/api/orchestration/status'));
  router.get('/metrics', forwardGet('/api/orchestration/metrics'));
  router.get('/dags', forwardGet('/api/orchestration/dags'));
  router.post('/dag', forwardPost('/api/orchestration/dag'));
  router.post('/dag/cancel', forwardPost('/api/orchestration/dag/cancel'));

  return router;
}
