import { resolveSuperAgentCorePort } from './superAgentCorePort';
import { Router, type Request, type Response } from 'express';
import http from 'node:http';
import { getSuperAgentServiceHeaders } from './superAgentAuth';

/** Session-bound view of Core's existing durable chat-turn queue.
 * No agent, provider, prompt or workspace mutation is performed here. */
export function createTlineAssistantTurnsRouter(
  options: { port?: number; serviceHeaders?: () => Record<string, string> } = {},
) {
  const router = Router();
  const port = options.port ?? resolveSuperAgentCorePort();
  const serviceHeaders = options.serviceHeaders ?? getSuperAgentServiceHeaders;

  const forward = (action: 'list' | 'recover') => (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const principal = (req as Request & { user?: { role?: string; source?: string } }).user;
    if (!principal || (principal.role !== 'admin' && principal.source !== 'local')) {
      res.status(403).json({ error: 'Local operator authority required' });
      return;
    }
    const { workspace, sessionId } = req.query;
    if (typeof workspace !== 'string' || !workspace || workspace.length > 4096 ||
        typeof sessionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(sessionId)) {
      res.status(400).json({ error: 'Explicit workspace/session required' });
      return;
    }
    const headers = serviceHeaders();
    if (!headers.Authorization) {
      res.status(503).json({ error: 'Core authentication unavailable' });
      return;
    }
    const body = action === 'recover' ? JSON.stringify({ sessionId }) : '';
    const method = action === 'recover' ? 'POST' : 'GET';
    const path = action === 'recover' ? '/api/chat/turns/recover' : '/api/chat/turns';
    const url = path + '?' + new URLSearchParams({ workspace, sessionId }).toString();
    const upstream = http.request({
      hostname: '127.0.0.1', port, method, path: url,
      timeout: 6000,
      headers: {
        ...headers, 'x-workspace-path': workspace, 'x-client-mode': 'tline',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) } : {}),
      },
    }, reply => {
      let data = '';
      reply.on('data', chunk => {
        data += String(chunk);
        if (data.length > 96_000) upstream.destroy(new Error('Oversized response'));
      });
      reply.on('end', () => {
        if (res.headersSent) return;
        try {
          const response = JSON.parse(data);
          if (action === 'list' && (reply.statusCode || 500) < 300) {
            // Explicit projection; never leak prompts, internal errors, tokens or credentials.
            if (!Array.isArray(response.turns) || response.sessionId !== sessionId ||
                response.turns.length > 100) throw Error('Invalid turn snapshot');
            const states = new Set(['accepted', 'queued', 'recoverable', 'running',
              'completed', 'failed', 'cancelled', 'interrupted']);
            const turns = response.turns.map((turn: any) => {
              if (typeof turn?.turnId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(turn.turnId) ||
                  !states.has(turn.state)) throw Error('Invalid turn record');
              return {
                turnId: turn.turnId, state: turn.state,
                createdAt: typeof turn.createdAt === 'number' ? turn.createdAt : 0,
                startedAt: typeof turn.startedAt === 'number' ? turn.startedAt : null,
                finishedAt: typeof turn.finishedAt === 'number' ? turn.finishedAt : null,
              };
            });
            res.status(200).json({ success: true, sessionId, turns });
          } else if (action === 'recover' && (reply.statusCode || 500) < 300) {
            if (response.sessionId !== sessionId || response.success !== true ||
                !Number.isSafeInteger(response.resumed)) throw Error('Invalid recovery result');
            res.status(200).json({ success: true, sessionId, resumed: response.resumed });
          } else {
            res.status(reply.statusCode || 502).json({
              error: (reply.statusCode || 500) === 400 ? 'Chat session not initialized' : 'Core request rejected',
            });
          }
        } catch {
          res.status(502).json({ error: 'Invalid Core turn metadata' });
        }
      });
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Core timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) res.status(503).json({ error: 'Core turn service unavailable' });
    });
    if (body) upstream.write(body);
    upstream.end();
  };

  router.get('/', forward('list'));
  // Explicit operator action. Running/interrupted turns are NEVER replayed.
  router.post('/recover', forward('recover'));
  return router;
}
