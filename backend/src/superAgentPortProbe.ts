import { resolveSuperAgentCorePort } from './superAgentCorePort';
import http from 'node:http';
import { getSuperAgentServiceHeaders } from './superAgentAuth';

export type SuperAgentPortState = 'compatible' | 'occupied' | 'free';

/**
 * A 401/404/HTML response still means the port is occupied. Never spawn a
 * second process or kill an unowned PID just because an endpoint answered.
 */
export async function probeSuperAgentPort(
  port = resolveSuperAgentCorePort(), headers: Record<string, string> = getSuperAgentServiceHeaders(),
): Promise<SuperAgentPortState> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: SuperAgentPortState) => {
      if (!settled) { settled = true; resolve(value); }
    };
    const req = http.request({
      hostname: '127.0.0.1', port, path: '/api/ping', method: 'GET',
      timeout: 1500, headers,
    }, res => {
      let data = '';
      res.on('data', chunk => {
        data += String(chunk);
        if (data.length > 4096) req.destroy(new Error('SuperAgent ping body too large.'));
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200 && parsed?.status === 'ok' &&
            typeof parsed.version === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(parsed.version)) {
            done('compatible');
          } else done('occupied');
        } catch { done('occupied'); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('SuperAgent port probe timeout')));
    req.on('error', (error: NodeJS.ErrnoException) =>
      done(error.code === 'ECONNREFUSED' ? 'free' : 'occupied'));
    req.end();
  });
}
