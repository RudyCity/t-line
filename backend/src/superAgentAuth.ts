import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * The T-Line backend is a trusted local process; keep the SuperAgent service
 * token server-side. Never send this token to the renderer or include it in URLs.
 */
export function readSuperAgentServiceToken(
  infoFile = path.join(
    process.env.SUPERAGENT_CONFIG_DIR?.trim()
      ? path.resolve(process.env.SUPERAGENT_CONFIG_DIR.trim())
      : path.join(os.homedir(), '.superagent-r'),
    'server-info-7888.json'
  ),
): string | null {
  try {
    const stat = fs.lstatSync(infoFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_384) return null;
    const info = JSON.parse(fs.readFileSync(infoFile, 'utf8')) as { port?: number; authToken?: string };
    if (info.port !== 7888 || typeof info.authToken !== 'string' || !/^[a-f\d]{48}$/i.test(info.authToken)) return null;
    return info.authToken;
  } catch {
    return null;
  }
}

/** Return an empty set if token metadata is unavailable; callers must fail closed. */
export function getSuperAgentServiceHeaders(): Record<string, string> {
  const token = readSuperAgentServiceToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}
