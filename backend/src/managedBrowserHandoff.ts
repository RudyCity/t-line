/**
 * Authenticated T-Line proxy for the SuperAgent managed-browser handoff.
 *
 * The renderer only proves which tab it owns; the browser-level CDP fingerprint
 * is computed here from the live loopback endpoint, so a compromised or buggy
 * renderer can never register a forged browser identity. Credentials for Core
 * stay in the backend, and the selected runtime target is resolved by the
 * existing proxy helper (no hardcoded port anywhere).
 */
import { Router } from 'express';
import http from 'node:http';
import { createHash } from 'node:crypto';

type ProxyResult = { status: number; payload: any };
type HandoffProxy = (
  pathName: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
  timeoutMs?: number,
) => Promise<ProxyResult>;

const PROFILE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const GENERATION = /^[A-Za-z0-9-]{1,96}$/;
const TARGET = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_IDENTITY_BYTES = 4096;

export type HandoffIdentity = {
  profileId: string;
  generation: string;
  port: number;
  targetId: string;
};

export function validateHandoffIdentity(body: unknown): HandoffIdentity | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (JSON.stringify(body).length > MAX_IDENTITY_BYTES) return null;
  const value = body as Record<string, unknown>;
  if (typeof value.profileId !== 'string' || !PROFILE.test(value.profileId)) return null;
  if (typeof value.generation !== 'string' || !GENERATION.test(value.generation)) return null;
  if (!Number.isSafeInteger(value.port) || (value.port as number) < 1024 || (value.port as number) > 65535) {
    return null;
  }
  if (typeof value.targetId !== 'string' || !TARGET.test(value.targetId)) return null;
  return {
    profileId: value.profileId,
    generation: value.generation,
    port: value.port as number,
    targetId: value.targetId,
  };
}

function getJson(port: number, path: string, timeoutMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path, method: 'GET', timeout: timeoutMs }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
        if (body.length > 65_536) request.destroy();
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Invalid browser endpoint response.'));
        }
      });
    });
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Browser endpoint timed out.'));
    });
    request.end();
  });
}

/** SHA-256 of the browser-level CDP path, matching the native fingerprint. */
export async function browserFingerprint(port: number): Promise<string> {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Invalid browser port.');
  }
  const version = await getJson(port, '/json/version');
  const websocket = version?.webSocketDebuggerUrl;
  if (typeof websocket !== 'string' || websocket.length > 512) {
    throw new Error('Missing browser identity.');
  }
  const url = new URL(websocket);
  if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || url.port !== String(port) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Untrusted browser identity.');
  }
  if (!/^\/devtools\/browser\/[a-f0-9-]{36}$/i.test(url.pathname)) {
    throw new Error('Invalid browser identity path.');
  }
  return createHash('sha256').update(url.pathname).digest('hex');
}

function registerPayload(identity: HandoffIdentity, fingerprint: string) {
  return {
    profileId: identity.profileId,
    generation: identity.generation,
    port: identity.port,
    targetId: identity.targetId,
    browserFingerprint: fingerprint,
  };
}

export function createManagedBrowserHandoffRouter(proxy: HandoffProxy): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const identity = validateHandoffIdentity(req.body);
    if (!identity) {
      res.status(400).json({ success: false, error: 'Invalid browser handoff identity.' });
      return;
    }
    let fingerprint: string;
    try {
      fingerprint = await browserFingerprint(identity.port);
    } catch {
      res.status(409).json({ success: false, error: 'The owned browser debugging endpoint is unavailable.' });
      return;
    }
    const result = await proxy('/api/browser/managed/register', 'POST', registerPayload(identity, fingerprint), 5000);
    const ok = result.payload?.success === true;
    res.status(ok ? 200 : 409).json(result.payload);
  });

  router.post('/control', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const identity = validateHandoffIdentity(req.body);
    const mode = (req.body as Record<string, unknown> | undefined)?.mode;
    if (!identity || (mode !== 'human' && mode !== 'agent')) {
      res.status(400).json({ success: false, error: 'Invalid browser control request.' });
      return;
    }
    let fingerprint: string;
    try {
      fingerprint = await browserFingerprint(identity.port);
    } catch {
      res.status(409).json({ success: false, error: 'The owned browser debugging endpoint is unavailable.' });
      return;
    }
    const registration = await proxy('/api/browser/managed/register', 'POST', registerPayload(identity, fingerprint), 5000);
    if (registration.payload?.success !== true) {
      res.status(409).json(registration.payload);
      return;
    }
    const result = await proxy('/api/browser/managed/control', 'POST', {
      ...registerPayload(identity, fingerprint),
      mode,
    }, 6000);
    const ok = result.payload?.success === true && result.payload?.mode === mode;
    res.status(ok ? 200 : 409).json(result.payload);
  });

  return router;
}
