/** Narrow POST bridge for opt-in SuperAgent workspace-operator cancellation. */
import http from 'node:http';
import { getSuperAgentServiceHeaders } from './superAgentAuth';

const SESSION = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const JOB = /^clj_\d{8,17}_[a-f0-9]{8}$/;
const CHALLENGE = /^[a-f0-9]{48}$/;
export type TaskCancelInput = { workspace: string; sessionId: string; jobId: string; challenge?: string };
export function validateTaskCancelInput(action: 'prepare' | 'confirm', input: TaskCancelInput): boolean {
  return typeof input.workspace === 'string' && input.workspace.length > 0 &&
    input.workspace.length <= 4096 && !/[\u0000-\u001f]/.test(input.workspace) &&
    typeof input.sessionId === 'string' && SESSION.test(input.sessionId) &&
    typeof input.jobId === 'string' && JOB.test(input.jobId) &&
    (action === 'prepare' ? input.challenge === undefined : typeof input.challenge === 'string' &&
      CHALLENGE.test(input.challenge));
}
export function forwardTaskCancel(
  action: 'prepare' | 'confirm', input: TaskCancelInput,
  opts: { port?: number; headers?: Record<string, string> } = {},
): Promise<{ status: number; payload: Record<string, unknown> }> {
  if (!validateTaskCancelInput(action, input)) {
    return Promise.resolve({ status: 400, payload: { success: false, error: 'Invalid task control request.' } });
  }
  const headers = opts.headers ?? getSuperAgentServiceHeaders();
  if (!headers.Authorization) {
    return Promise.resolve({ status: 503, payload: { success: false, error: 'SuperAgent authorization unavailable.' } });
  }
  const body = JSON.stringify(input);
  return new Promise(resolve => {
    let ended = false;
    const finish = (result: { status: number; payload: Record<string, unknown> }) => {
      if (ended) return;
      ended = true;
      resolve(result);
    };
    const req = http.request({
      hostname: '127.0.0.1', port: opts.port ?? 7888, method: 'POST',
      path: '/api/tline/tasks/cancel/' + action, timeout: 5000,
      headers: { ...headers, 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body), 'x-workspace-path': input.workspace,
        'x-client-mode': 'tline' },
    }, response => {
      let payload = '';
      response.on('data', (chunk: Buffer) => {
        payload += String(chunk);
        if (payload.length > 8192) req.destroy(new Error('Oversized task control response.'));
      });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(payload);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Invalid response');
          finish({ status: response.statusCode || 502, payload: parsed });
        } catch {
          finish({ status: 502, payload: { success: false, error: 'Invalid SuperAgent task control response.' } });
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Task control timeout.')));
    req.on('error', () => finish({ status: 503, payload: {
      success: false, error: 'SuperAgent task control service unavailable.' } }));
    req.end(body);
  });
}
