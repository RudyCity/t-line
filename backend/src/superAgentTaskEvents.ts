/** Authenticated, strictly scoped SSE relay; no generic upstream proxy. */
import http from 'node:http';
import type { Request, Response } from 'express';
import { getSuperAgentServiceHeaders } from './superAgentAuth';

const EVENT_ID = /^[0-9a-f]{16}\.\d{1,12}$/;
const SESSION_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
export function validTlineStreamParams(workspace: unknown, sessionId: unknown, lastId?: unknown): boolean {
  return typeof workspace === 'string' && workspace.length > 0 && workspace.length <= 4096 &&
    !/[\u0000-\u001f]/.test(workspace) && typeof sessionId === 'string' && SESSION_ID.test(sessionId) &&
    (lastId === undefined || (typeof lastId === 'string' && EVENT_ID.test(lastId)));
}
export function streamTlineTaskEvents(req: Request, res: Response): void {
  const workspace = req.query.workspace;
  const sessionId = req.query.sessionId;
  const rawLast = req.headers['last-event-id'];
  const lastId = typeof rawLast === 'string' ? rawLast : req.query.lastEventId;
  if (!validTlineStreamParams(workspace, sessionId, lastId)) {
    res.status(400).json({ error: 'Valid workspace, sessionId and optional SSE event ID required.' });
    return;
  }
  const headers = getSuperAgentServiceHeaders();
  if (!headers.Authorization) {
    res.status(503).json({ error: 'SuperAgent service authorization unavailable.' });
    return;
  }
  const path = '/api/tline/tasks/events?workspace=' + encodeURIComponent(workspace as string) +
    '&sessionId=' + encodeURIComponent(sessionId as string);
  const upstream = http.request({
    hostname: '127.0.0.1', port: 7888, path, method: 'GET',
    headers: { ...headers, 'x-workspace-path': workspace as string, 'x-client-mode': 'tline',
      'Accept': 'text/event-stream', ...(lastId ? { 'Last-Event-ID': lastId as string } : {}) },
    timeout: 7000,
  }, response => {
    if (response.statusCode !== 200 || !String(response.headers['content-type'] || '').includes('text/event-stream')) {
      response.resume();
      if (!res.headersSent) res.status(response.statusCode === 403 ? 403 : 502)
        .json({ error: 'SuperAgent task event stream unavailable.' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.on('data', (chunk: Buffer) => {
      if (!res.write(chunk)) response.pause();
    });
    res.on('drain', () => response.resume());
    response.on('end', () => { if (!res.writableEnded) res.end(); });
    response.on('error', () => { if (!res.writableEnded) res.end(); });
  });
  upstream.on('timeout', () => upstream.destroy(new Error('Task stream handshake timeout.')));
  upstream.on('error', () => {
    if (!res.headersSent) res.status(503).json({ error: 'Task stream disconnected.' });
    else if (!res.writableEnded) res.end();
  });
  res.on('close', () => upstream.destroy());
  req.on('aborted', () => upstream.destroy());
  upstream.end();
}
