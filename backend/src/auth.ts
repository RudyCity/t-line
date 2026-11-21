import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const CONFIG_FILE = path.join(os.homedir(), '.tline-config.json');

interface AppConfig {
  masterPasswordHash: string;
  jwtSecret: string;
  [key: string]: any;
}

// Generate an ephemeral bypass token for the local Electron instance on each startup
export const localBypassToken = crypto.randomBytes(32).toString('hex');

// Write the bypass token to a file with owner-only read/write permissions
const BYPASS_TOKEN_FILE = path.join(os.homedir(), '.tline-bypass-token');
try {
  fs.writeFileSync(BYPASS_TOKEN_FILE, localBypassToken, { encoding: 'utf8', mode: 0o600 });
} catch (e) {
  console.error('Failed to write bypass token file:', e);
}

// Cleanup the bypass token file on shutdown/exit
const cleanupBypassToken = () => {
  try {
    if (fs.existsSync(BYPASS_TOKEN_FILE)) {
      fs.unlinkSync(BYPASS_TOKEN_FILE);
    }
  } catch (e) {}
};

process.on('exit', cleanupBypassToken);
process.on('SIGINT', () => {
  cleanupBypassToken();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupBypassToken();
  process.exit(0);
});

let appConfig: AppConfig | null = null;

// Load configuration
export function loadConfig(): AppConfig | null {
  if (appConfig) return appConfig;
  
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      appConfig = JSON.parse(data);
      return appConfig;
    } catch (e) {
      console.error('Failed to read config file:', e);
    }
  }
  return null;
}

// Save configuration
export function saveConfig(config: AppConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    appConfig = config;
  } catch (e) {
    console.error('Failed to write config file:', e);
  }
}

// Check if setup is needed (i.e. no password configured)
export function isSetupRequired(): boolean {
  const config = loadConfig();
  return !config || !config.masterPasswordHash;
}

// Initialize password and JWT secret
export function setupMasterPassword(password: string): boolean {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  
  const existingConfig = loadConfig() || {};
  saveConfig({
    ...existingConfig,
    masterPasswordHash: hash,
    jwtSecret
  });
  
  return true;
}

// Verify the master password
export function verifyMasterPassword(password: string): boolean {
  const config = loadConfig();
  if (!config) return false;
  return bcrypt.compareSync(password, config.masterPasswordHash);
}

// Generate JWT token
export function generateToken(payload: object): string {
  const config = loadConfig();
  const secret = config?.jwtSecret;
  if (!secret || secret.trim().length < 32) {
    throw new Error('JWT secret is not configured. Complete setup before issuing tokens.');
  }
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

// Verify JWT token
export function verifyToken(token: string): any {
  const config = loadConfig();
  const secret = config?.jwtSecret;
  if (!secret || secret.trim().length < 32) {
    return null;
  }
  try {
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
}

// Helper to extract client IP from Express request or HTTP IncomingMessage
export function getClientIp(req: any): string {
  const cfIp = req.headers?.['cf-connecting-ip'];
  if (cfIp && typeof cfIp === 'string') return cfIp;
  
  const forwardIp = req.headers?.['x-forwarded-for'];
  if (forwardIp && typeof forwardIp === 'string') {
    return forwardIp.split(',')[0].trim();
  }
  
  return req.socket?.remoteAddress || 'unknown';
}

// Determines if request is coming from outside (Cloudflare Tunnel, remote IP, LAN/WAN)
export function isTunnelRequest(req: any): boolean {
  if (req.headers?.['cf-connecting-ip']) return true;
  const ip = getClientIp(req);
  return !(ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost');
}

// Determines if request is originating directly from local desktop running instance
export function isLocalDesktopRequest(req: any): boolean {
  return !isTunnelRequest(req);
}

// Express auth middleware
export function authMiddleware(req: any, res: any, next: any) {
  let token = '';
  if (req.headers?.authorization) {
    const authHeader = req.headers.authorization;
    token = authHeader.split(' ')[1];
  } else if (req.query?.token) {
    token = req.query.token as string;
  }

  const isTunnel = isTunnelRequest(req);

  // Desktop running locally: master password is NOT active/required.
  // Allow local desktop requests (with bypass token or direct loopback access)
  if (!isTunnel) {
    req.user = { role: 'admin', source: 'local' };
    return next();
  }

  // Outside / remote access: master password IS active and enforced.
  // Reject requests without token
  if (!token) {
    return res.status(401).json({ error: 'Token required for remote access.' });
  }

  // Local bypass token is NEVER valid for remote/tunnel connections
  if (token === localBypassToken) {
    return res.status(401).json({ error: 'Local bypass token is not allowed for remote access.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

// Verify WS Connection token
export function verifySocketToken(token: string, isTunnel: boolean = false): boolean {
  if (!isTunnel) {
    // Desktop running locally: connection is allowed without master password
    return true;
  }

  // Outside / remote access: local bypass token is NEVER allowed
  if (!token || token === localBypassToken) {
    return false;
  }

  const decoded = verifyToken(token);
  return decoded !== null;
}
