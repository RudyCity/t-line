import { createHmac } from 'node:crypto';
import type { Router } from 'express';

const NONCE = /^[a-f0-9]{32}$/;

/** Challenge/response does not disclose or accept the local bypass bearer token. */
export function backendIdentityProof(nonce: string, token: string): string {
  if (!NONCE.test(nonce)) throw new Error('Invalid backend identity challenge');
  return createHmac('sha256', token).update('tline-backend-v1:' + nonce).digest('hex');
}

export function registerBackendIdentity(router: Router, token: string): void {
  router.get('/desktop/identity', (req, res) => {
    // Identity is only meaningful for the same machine; do not publish a
    // cryptographic proof oracle via a remote-facing backend/tunnel.
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) {
      res.status(403).json({ error: 'Local identity probe only' });
      return;
    }
    const nonce = req.query.nonce;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (typeof nonce !== 'string' || !NONCE.test(nonce)) {
      res.status(400).json({ error: 'Invalid backend identity challenge' });
      return;
    }
    res.json({ protocol: 'tline-backend-v1', proof: backendIdentityProof(nonce, token) });
  });
}
