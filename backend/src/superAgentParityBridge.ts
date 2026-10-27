import { resolveSuperAgentCorePort } from './superAgentCorePort';
import http from 'node:http';
import { getSuperAgentServiceHeaders } from './superAgentAuth';

/**
 * Narrow read-only parity bridge. Every upstream path is a trusted constant;
 * neither renderer nor slash input can supply URLs, methods or shell commands.
 */
export const PARITY_READ_ACTIONS = {
  capabilities: '/api/tline/capabilities',
  'daemon.status': '/api/daemon/status',

  'gateway.status': '/api/gateway/status',
  'mcp.status': '/api/tline/inspect/mcp.status',
  'tools.catalog': '/api/tline/inspect/tools.catalog',
  'selfdev.status': '/api/tline/inspect/selfdev.status',
  'muse.status': '/api/tline/inspect/muse.status',
  'tasks.snapshot': '/api/tline/inspect/tasks.snapshot',
  'studio.status': '/api/motion',
  'studio.projects': '/api/motion/projects',
} as const;
export type ParityReadAction = keyof typeof PARITY_READ_ACTIONS;

export interface ParityReadResponse {
  status: number;
  payload: Record<string, unknown>;
}

export async function fetchParityReadAction(
  action: ParityReadAction,
  workspace: string,
  options: { port?: number; headers?: Record<string, string>; cursor?: string } = {},
): Promise<ParityReadResponse> {
  const pathname = PARITY_READ_ACTIONS[action];
  if (!pathname) return { status: 400, payload: { error: 'Unsupported parity action.' } };
  if (!workspace || workspace.length > 4096 || /[\u0000-\u001f]/.test(workspace)) {
    return { status: 400, payload: { error: 'A valid workspace is required.' } };
  }
  const headers = options.headers ?? getSuperAgentServiceHeaders();
  if (!headers.Authorization) {
    return { status: 503, payload: { error: 'SuperAgent service token unavailable. Authenticated desktop capabilities cannot be queried.' } };
  }
  const port = options.port ?? resolveSuperAgentCorePort();
  if (options.cursor && (action !== 'tasks.snapshot' || !/^[0-9a-f]{64}$/.test(options.cursor))) {
    return { status: 400, payload: { error: 'Invalid task cursor.' } };
  }
  const url = pathname + '?workspace=' + encodeURIComponent(workspace) +
    (options.cursor ? '&cursor=' + encodeURIComponent(options.cursor) : '');
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: ParityReadResponse) => { if (!settled) { settled = true; resolve(v); } };
    const req = http.request({
      hostname: '127.0.0.1', port, method: 'GET', path: url,
      timeout: 4000, headers: { ...headers, 'x-workspace-path': workspace, 'x-client-mode': 'tline' },
    }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        body += String(chunk);
        if (body.length > 1024 * 1024) req.destroy(new Error('Capability response exceeds 1 MiB.'));
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON object');
          if (action === 'capabilities' && res.statusCode === 200 &&
            (parsed.server !== 'superagent' || parsed.schemaVersion !== 1 || !Array.isArray(parsed.commands))) {
            done({ status: 502, payload: { error: 'Upstream is not a compatible SuperAgent capability server.' } });
            return;
          }
          done({ status: res.statusCode || 502, payload: parsed });
        } catch {
          done({ status: 502, payload: { error: 'Invalid JSON response from SuperAgent.' } });
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('SuperAgent capability request timed out.')));
    req.on('error', (error: Error) => done({ status: 503, payload: { error: error.message } }));
    req.end();
  });
}
