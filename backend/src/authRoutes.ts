import { Router, Request } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  isSetupRequired,
  setupMasterPassword,
  verifyMasterPassword,
  generateToken,
  authMiddleware,
  verifySocketToken,
  localBypassToken
} from './auth';

const router = Router();

// IP Rules & Login blocks management
const RULES_FILE = path.join(os.homedir(), '.tline-ip-rules.json');
export let ipRules: Record<string, 'allow' | 'block'> = {};
try {
  if (fs.existsSync(RULES_FILE)) {
    ipRules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load IP rules:', e);
}

export function saveIpRules() {
  try {
    fs.writeFileSync(RULES_FILE, JSON.stringify(ipRules, null, 2));
  } catch (e) {
    console.error('Failed to save IP rules:', e);
  }
}

const LOGIN_BLOCKS_FILE = path.join(os.homedir(), '.tline-login-blocks.json');
export let loginBlocks: Record<string, { blockedAt: number; attempts: number }> = {};
try {
  if (fs.existsSync(LOGIN_BLOCKS_FILE)) {
    loginBlocks = JSON.parse(fs.readFileSync(LOGIN_BLOCKS_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load login blocks:', e);
}

export function saveLoginBlocks() {
  try {
    fs.writeFileSync(LOGIN_BLOCKS_FILE, JSON.stringify(loginBlocks, null, 2));
  } catch (e) {
    console.error('Failed to save login blocks:', e);
  }
}

export let failedAttempts: Record<string, number> = {};

export function getClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && typeof cfIp === 'string') return cfIp;
  
  const forwardIp = req.headers['x-forwarded-for'];
  if (forwardIp && typeof forwardIp === 'string') {
    return forwardIp.split(',')[0].trim();
  }
  
  return req.socket.remoteAddress || 'unknown';
}

export function isTunnelRequest(req: Request): boolean {
  if (req.headers['cf-connecting-ip']) return true;
  const ip = getClientIp(req);
  return !(ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost');
}

export function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown Device';
  const uaLower = ua.toLowerCase();
  if (uaLower.includes('windows')) return 'Windows PC';
  if (uaLower.includes('macintosh') || uaLower.includes('mac os')) return 'Mac';
  if (uaLower.includes('iphone')) return 'iPhone';
  if (uaLower.includes('ipad')) return 'iPad';
  if (uaLower.includes('android')) {
    if (uaLower.includes('mobile')) return 'Android Mobile';
    return 'Android Tablet';
  }
  if (uaLower.includes('linux')) return 'Linux PC';
  return 'Web Client';
}

export interface AccessLog {
  ip: string;
  userAgent: string;
  deviceType: string;
  lastActive: number;
  path: string;
}

export let recentAccesses: AccessLog[] = [];

// Auth API Endpoints
router.get('/auth/setup-status', (req, res) => {
  res.json({ setupRequired: isSetupRequired() });
});

router.post('/auth/setup', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }
  if (!isSetupRequired()) {
    return res.status(400).json({ error: 'Setup is already completed.' });
  }
  setupMasterPassword(password);
  res.json({ success: true, token: generateToken({ role: 'admin' }) });
});

router.post('/auth/login', (req, res) => {
  const { password } = req.body;
  const ip = getClientIp(req);

  if (loginBlocks[ip]) {
    return res.status(403).json({ error: 'Your IP has been blocked due to too many failed login attempts.' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (verifyMasterPassword(password)) {
    delete failedAttempts[ip];
    return res.json({ success: true, token: generateToken({ role: 'admin' }) });
  }

  if (isTunnelRequest(req)) {
    failedAttempts[ip] = (failedAttempts[ip] || 0) + 1;
    const remaining = 3 - failedAttempts[ip];

    if (failedAttempts[ip] >= 3) {
      loginBlocks[ip] = {
        blockedAt: Date.now(),
        attempts: failedAttempts[ip]
      };
      saveLoginBlocks();

      ipRules[ip] = 'block';
      saveIpRules();

      delete failedAttempts[ip];

      return res.status(403).json({ error: 'Too many failed login attempts. Your IP has been blocked.' });
    }

    return res.status(401).json({ error: `Invalid master password. ${remaining} attempts remaining.` });
  }

  res.status(401).json({ error: 'Invalid master password.' });
});

router.post('/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }
  if (!verifyMasterPassword(currentPassword)) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }
  setupMasterPassword(newPassword);
  res.json({ success: true, token: generateToken({ role: 'admin' }) });
});

router.get('/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ valid: false });
  
  const token = authHeader.split(' ')[1];
  if (token === localBypassToken) {
    return res.json({ valid: true, source: 'local' });
  }
  
  const decoded = verifySocketToken(token);
  res.json({ valid: decoded });
});

// Security & access management endpoints (Protected)
router.get('/security/connections', authMiddleware, (req, res) => {
  res.json({
    accesses: recentAccesses,
    rules: ipRules,
    loginBlocks: loginBlocks
  });
});

router.post('/security/rules', authMiddleware, (req, res) => {
  const { ip, rule } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP address is required.' });
  }
  
  const currentIp = getClientIp(req);
  if (ip === currentIp && rule === 'block') {
    return res.status(400).json({ error: 'You cannot block your own current IP address.' });
  }
  
  if (rule === 'block') {
    ipRules[ip] = 'block';
  } else {
    delete ipRules[ip];
    delete loginBlocks[ip];
    saveLoginBlocks();
  }
  
  saveIpRules();
  res.json({ success: true });
});

router.post('/security/rules/reset', authMiddleware, (req, res) => {
  ipRules = {};
  saveIpRules();
  loginBlocks = {};
  saveLoginBlocks();
  res.json({ success: true });
});

export default router;
