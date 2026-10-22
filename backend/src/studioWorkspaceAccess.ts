import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { getWorkspaces } from './gitManager';

function normalizedLocalPath(input: string): string | null {
  if (!input || /^(?:ssh|chain):/i.test(input)) return null;
  try {
    const real = fs.realpathSync.native(path.resolve(input));
    if (!fs.statSync(real).isDirectory()) return null;
    return process.platform === 'win32' ? real.toLowerCase() : real;
  } catch { return null; }
}

/** A bearer token from T-Line never makes arbitrary caller-supplied paths trustworthy. */
export function isRegisteredStudioWorkspace(requested: string): boolean {
  const wanted = normalizedLocalPath(requested);
  if (!wanted) return false;
  return getWorkspaces().some(registered => normalizedLocalPath(registered.path) === wanted);
}

const trustedInProcess = new Set<string>();

/**
 * T-Line registered workspace -> existing SuperAgent trusted-directory API.
 * The service token stays server-side. SuperAgent must then enforce its own
 * trusted-directory/root allowlist for every /api/motion operation.
 */
export async function ensureStudioWorkspaceTrusted(
  workspace: string, serviceToken: string, upstreamPort = 7888,
): Promise<void> {
  if (!isRegisteredStudioWorkspace(workspace)) throw new Error('Workspace is not registered in T-Line');
  const resolved = fs.realpathSync.native(path.resolve(workspace));
  const key = upstreamPort + ':' + (process.platform === 'win32' ? resolved.toLowerCase() : resolved);
  if (trustedInProcess.has(key)) return;
  const payload = Buffer.from(JSON.stringify({ path: resolved }), 'utf8');
  await new Promise<void>((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1', port: upstreamPort, path: '/api/config/trusted-directory',
      method: 'POST', timeout: 5000,
      headers: {
        Authorization: 'Bearer ' + serviceToken,
        'Content-Type': 'application/json',
        'Content-Length': String(payload.length),
      },
    }, response => {
      let data = '';
      response.on('data', chunk => { if (data.length < 8192) data += String(chunk); });
      response.on('end', () => response.statusCode === 200 ? resolve() :
        reject(new Error('SuperAgent workspace trust rejected (' + response.statusCode + ')')));
    });
    request.once('error', reject);
    request.once('timeout', () => request.destroy(new Error('SuperAgent workspace trust timed out')));
    request.end(payload);
  });
  trustedInProcess.add(key);
}
