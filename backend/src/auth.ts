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
  
  saveConfig({
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
  const secret = config?.jwtSecret || 'temp-secret-fallback';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

// Verify JWT token
export function verifyToken(token: string): any {
  const config = loadConfig();
  const secret = config?.jwtSecret || 'temp-secret-fallback';
  try {
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
}

// Express auth middleware
export function authMiddleware(req: any, res: any, next: any) {
  let token = '';
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  // Allow local bypass token (used by desktop app)
  if (token === localBypassToken) {
    req.user = { role: 'admin', source: 'local' };
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

// Verify WS Connection token
export function verifySocketToken(token: string): boolean {
  if (token === localBypassToken) {
    return true;
  }
  const decoded = verifyToken(token);
  return decoded !== null;
}
