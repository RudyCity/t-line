import { resolveSuperAgentCorePort } from './superAgentCorePort';
import {resolveCoreOwnershipMode,verifyAuthenticatedExternalCoreOwner} from './superAgentCoreOwnership';
import http from 'node:http';
import { getSuperAgentServiceHeaders } from './superAgentAuth';
import { resolveRuntimeTarget } from './superAgentRuntimeTarget';

export type SuperAgentPortState = 'compatible' | 'occupied' | 'free';

/**
 * A 401/404/HTML response still means the port is occupied. Never spawn a
 * second process or kill an unowned PID just because an endpoint answered.
 */
export async function probeSuperAgentPort(
  port = resolveSuperAgentCorePort(), headers: Record<string, string> = getSuperAgentServiceHeaders(),
): Promise<SuperAgentPortState> {
  // Invalid / nonisolated targets are never candidates for auto-spawn.
  // Selection remains fixed for this backend instance (not per request).
  try {
    const target = resolveRuntimeTarget();
    if (target.selected === 'testing' && port !== target.corePort) return 'occupied';
  } catch { return 'occupied'; }
  if (process.env.TLINE_SUPERAGENT_OWNER_MODE==='supervised-external' && port===7888)
    return 'occupied';
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
      res.on('end', async () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200 && parsed?.status === 'ok' &&
            typeof parsed.version === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(parsed.version)) {
            try {
              const mode=resolveCoreOwnershipMode(undefined,port);
              // An authenticated Core ping is insufficient if the external
              // supervisor metadata does not match its actual kernel PID.
              const authorized=mode!=='supervised-external' ||
                await verifyAuthenticatedExternalCoreOwner(port);
              done(authorized?'compatible':'occupied');
            }catch{done('occupied');}
          } else done('occupied');
        } catch { done('occupied'); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('SuperAgent port probe timeout')));
    req.on('error', (error: NodeJS.ErrnoException) =>
      // A supervised-external endpoint is never available for local spawn,
      // even when the OS says the port is currently free.
      done(process.env.TLINE_SUPERAGENT_OWNER_MODE === 'supervised-external'
        ? 'occupied' : error.code === 'ECONNREFUSED' ? 'free' : 'occupied'));
    req.end();
  });
}
