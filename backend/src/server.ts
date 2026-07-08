import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import dotenv from 'dotenv';
import os from 'os';
import { exec } from 'child_process';
import { 
  isSetupRequired, 
  setupMasterPassword, 
  verifyMasterPassword, 
  generateToken, 
  authMiddleware, 
  verifySocketToken,
  localBypassToken
} from './auth';
import { 
  getWorkspaces, 
  addWorkspace, 
  removeWorkspace, 
  updateWorkspace,
  getWorkspaceInfo, 
  clearWorkspaceCache
} from './gitManager';
import { terminalManager, getActiveProcessesForPid } from './terminalManager';
import { tunnelManager } from './tunnelManager';
import gitRouter, { registerWorkspaceChangeCallback } from './gitRoutes';
import fsRouter, { registerFileChangeCallback } from './fsRoutes';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { TLINE_HELPER_CODE } from './tline-helper-code';

dotenv.config();

// Override console methods to write logs to a file in os.homedir()
const BACKEND_LOG_FILE = path.join(os.homedir(), '.tline-backend.log');

function logToFile(level: 'INFO' | 'ERROR', args: any[]) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  try {
    if (fs.existsSync(BACKEND_LOG_FILE) && fs.statSync(BACKEND_LOG_FILE).size > 5 * 1024 * 1024) {
      fs.writeFileSync(BACKEND_LOG_FILE, `[${timestamp}] [INFO] Log file rotated (exceeded 5MB limit)\n`);
    }
    fs.appendFileSync(BACKEND_LOG_FILE, logLine);
  } catch (err) {}
}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]) => {
  originalLog.apply(console, args);
  logToFile('INFO', args);
};

console.error = (...args: any[]) => {
  originalError.apply(console, args);
  logToFile('ERROR', args);
};

console.warn = (...args: any[]) => {
  originalWarn.apply(console, args);
  logToFile('INFO', args);
};

console.log(`[system] Logger initialized. Writing backend logs to: ${BACKEND_LOG_FILE}`);

const app = express();
const port = process.env.PORT || 5779;

let currentProxyTarget = '';

const sanitizeHeaders = (proxyHeaders: any) => {
  const headers = { ...proxyHeaders };
  
  // Case-insensitive deletion of security headers
  for (const key of Object.keys(headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === 'content-security-policy' ||
      lowerKey === 'content-security-policy-report-only' ||
      lowerKey === 'x-frame-options' ||
      lowerKey === 'frame-options'
    ) {
      delete headers[key];
    }
  }

  // Find location redirect header case-insensitively
  let locationKey = 'location';
  let redirectUrl = '';
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'location') {
      locationKey = key;
      redirectUrl = headers[key] as string;
      break;
    }
  }
  
  if (redirectUrl) {
    try {
      // Check if it's an absolute URL
      const parsedRedirect = new URL(redirectUrl);
      const targetOrigin = parsedRedirect.origin;
      const targetPath = parsedRedirect.pathname + parsedRedirect.search + parsedRedirect.hash;
      headers[locationKey] = `/api/preview-proxy${targetPath}${targetPath.includes('?') ? '&' : '?'}target=${encodeURIComponent(targetOrigin)}`;
    } catch (e) {
      // If it's already a relative path, let the browser handle it relative to <base> tag
    }
  }
  return headers;
};

const previewProxy = createProxyMiddleware({
  target: 'http://localhost',
  changeOrigin: true,
  secure: false, // Support self-signed certificates and dev https setups
  ws: true,
  pathRewrite: {
    '^/api/preview-proxy': '',
  },
  router: (req) => {
    const urlParams = new URL(req.url || '', `http://${req.headers.host}`);
    let target = urlParams.searchParams.get('target');
    if (!target) {
      const cookies = req.headers.cookie || '';
      const match = cookies.match(/tline_proxy_target=([^;]+)/);
      if (match) {
        target = decodeURIComponent(match[1]);
      }
    }
    if (target) {
      currentProxyTarget = target.replace(/\/$/, '');
    }
    return currentProxyTarget || 'http://localhost';
  },
  selfHandleResponse: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      const urlParams = new URL(req.url || '', `http://${req.headers.host}`);
      const target = urlParams.searchParams.get('target');
      if (target) {
        res.setHeader('Set-Cookie', `tline_proxy_target=${encodeURIComponent(target)}; Path=/; SameSite=Lax`);
      }
      // Strip the 'target' param before forwarding to avoid confusing the target server
      try {
        const parsedPath = new URL(proxyReq.path, 'http://localhost');
        parsedPath.searchParams.delete('target');
        proxyReq.path = parsedPath.pathname + (parsedPath.search || '');
      } catch (e) {}
      // Force target to send uncompressed content so we can modify the HTML safely
      proxyReq.setHeader('accept-encoding', 'identity');
    },
    proxyRes: (proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        let body = Buffer.from([]);
        proxyRes.on('data', (chunk) => {
          body = Buffer.concat([body, chunk]);
        });
        proxyRes.on('end', () => {
          const contentEncoding = proxyRes.headers['content-encoding'] || '';
          let decompressedBody = body;
          try {
            if (contentEncoding.includes('gzip')) {
              decompressedBody = zlib.gunzipSync(body);
            } else if (contentEncoding.includes('deflate')) {
              decompressedBody = zlib.inflateSync(body);
            } else if (contentEncoding.includes('br')) {
              decompressedBody = zlib.brotliDecompressSync(body);
            }
          } catch (decompressError) {
            console.error('[Preview Proxy] Failed to decompress body:', decompressError);
          }

          let html = decompressedBody.toString('utf8');

          // Strip http-equiv="content-security-policy" meta tags case-insensitively
          html = html.replace(/<meta\s+[^>]*http-equiv=["']content-security-policy["'][^>]*>/gi, '');

          const baseTag = `<base href="/api/preview-proxy/">`;
          // Inject the current proxy target as a global variable so the helper script
          // can correctly resolve relative URLs against the real target origin
          const targetVar = `<script>window.__TLINE_PROXY_TARGET__="${currentProxyTarget}";</script>`;
          const helperScript = `<script src="/api/preview-proxy/tline-helper.js"></script>`;
          
          // Robust case-insensitive head, html, or doctype tag injection
          const headMatch = html.match(/<head\b[^>]*>/i);
          if (headMatch && headMatch.index !== undefined) {
            const insertIndex = headMatch.index + headMatch[0].length;
            html = html.slice(0, insertIndex) + `\n  ${baseTag}\n  ${targetVar}\n  ${helperScript}` + html.slice(insertIndex);
          } else {
            const htmlMatch = html.match(/<html\b[^>]*>/i);
            if (htmlMatch && htmlMatch.index !== undefined) {
              const insertIndex = htmlMatch.index + htmlMatch[0].length;
              html = html.slice(0, insertIndex) + `\n  ${baseTag}\n  ${targetVar}\n  ${helperScript}` + html.slice(insertIndex);
            } else {
              const doctypeMatch = html.match(/<!doctype\s+html[^>]*>/i);
              if (doctypeMatch && doctypeMatch.index !== undefined) {
                const insertIndex = doctypeMatch.index + doctypeMatch[0].length;
                html = html.slice(0, insertIndex) + `\n  ${baseTag}\n  ${targetVar}\n  ${helperScript}` + html.slice(insertIndex);
              } else {
                html = baseTag + targetVar + helperScript + html;
              }
            }
          }
          
          const headers = sanitizeHeaders(proxyRes.headers);
          delete headers['content-length'];
          delete headers['content-encoding'];
          res.writeHead(proxyRes.statusCode || 200, headers);
          res.end(html);
        });
      } else {
        const headers = sanitizeHeaders(proxyRes.headers);
        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);
      }
    },
    error: (err: any, req, res) => {
      // ECONNABORTED / ECONNRESET / EPIPE = browser navigated away mid-request.
      // This is completely normal and expected — silently ignore to avoid log spam.
      if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        return;
      }
      console.error('[Preview Proxy Error]:', err);
      const response = res as any;
      if (response.headersSent) return;
      if (typeof response.writeHead === 'function') {
        response.writeHead(502, { 'Content-Type': 'text/html' });
        response.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Web Preview Offline</title>
            <script>
              try {
                const theme = localStorage.getItem('tline-theme') || 'default';
                const accent = localStorage.getItem('tline-accent-color') || '#6366f1';
                const themes = {
                  default: { bgMain: '#05070c', textMain: '#f8fafc', bgCard: 'rgba(17, 24, 39, 0.45)', border: 'rgba(255, 255, 255, 0.06)', textMuted: '#94a3b8' },
                  dracula: { bgMain: '#1e1f29', textMain: '#f8f8f2', bgCard: 'rgba(40, 42, 54, 0.5)', border: 'rgba(98, 114, 164, 0.2)', textMuted: '#6272a4' },
                  cyberpunk: { bgMain: '#0b0813', textMain: '#f8fafc', bgCard: 'rgba(26, 15, 46, 0.45)', border: 'rgba(50, 24, 85, 0.55)', border: 'rgba(255, 0, 127, 0.15)', textMuted: '#ff007f' },
                  forest: { bgMain: '#070d0a', textMain: '#f0fdf4', bgCard: 'rgba(16, 28, 21, 0.45)', border: 'rgba(16, 185, 129, 0.1)', textMuted: '#86efac' },
                  nord: { bgMain: '#2e3440', textMain: '#eceff4', bgCard: 'rgba(46, 52, 64, 0.5)', border: 'rgba(76, 86, 106, 0.3)', textMuted: '#d8dee9' },
                  light: { bgMain: '#f8fafc', textMain: '#0f172a', bgCard: 'rgba(255, 255, 255, 0.7)', border: 'rgba(0, 0, 0, 0.08)', textMuted: '#64748b' }
                };
                const preset = themes[theme] || themes.default;
                const root = document.documentElement;
                root.style.setProperty('--bg-main', preset.bgMain);
                root.style.setProperty('--text-main', preset.textMain);
                root.style.setProperty('--bg-card', preset.bgCard);
                root.style.setProperty('--border-color', preset.border || preset.borderColor || 'rgba(255,255,255,0.06)');
                root.style.setProperty('--text-muted', preset.textMuted);
                root.style.setProperty('--accent-color', accent);
              } catch(e) {}
            </script>
            <style>
              body { background: var(--bg-main, #0b0f19); color: var(--text-main, #f3f4f6); font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { max-width: 420px; width: 85%; background: var(--bg-card, rgba(17, 24, 39, 0.45)); border: 1px solid var(--border-color, rgba(255, 255, 255, 0.06)); border-radius: 12px; padding: 32px 24px; text-align: center; }
              .icon { font-size: 32px; margin-bottom: 16px; display: inline-block; }
              h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; background: linear-gradient(135deg, var(--accent-color, #a855f7), var(--accent-color, #6366f1)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
              p { color: var(--text-muted, #9ca3af); font-size: 13px; line-height: 1.5; margin: 0 0 20px; }
              code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: var(--accent-color, #e9d5ff); font-family: monospace; }
              .btn { background: linear-gradient(135deg, var(--accent-color, #a855f7), var(--accent-color, #6366f1)); color: white; border: none; padding: 10px 24px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
              .btn:hover { transform: translateY(-1px); }
            </style>
          </head>
          <body>
            <div class="card">
              <span class="icon">🌐</span>
              <h1>Web Preview Offline</h1>
              <p>Pratinjau web saat ini offline di <strong>${currentProxyTarget}</strong>.<br><br>Jalankan server pengembangan Anda (seperti <code>npm run dev</code>) di terminal, lalu klik tombol di bawah.</p>
              <button class="btn" onclick="window.location.reload()">Segarkan Koneksi</button>
            </div>
          </body>
          </html>
        `);
      }
    }
  }
});

app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// Open URL in System Default Browser
// ----------------------------------------------------
app.post('/api/browser/open', (req, res) => {
  const { url } = req.body as { url: string };
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    new URL(url); // Validate URL format
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const { exec } = require('child_process');
  const safeUrl = url.replace(/"/g, '');

  let command: string;
  if (process.platform === 'win32') {
    command = `start "" "${safeUrl}"`;
  } else if (process.platform === 'darwin') {
    command = `open "${safeUrl}"`;
  } else {
    command = `xdg-open "${safeUrl}"`;
  }

  exec(command, (err: any) => {
    if (err) {
      console.error('[Browser] Failed to open URL:', err);
      return res.status(500).json({ error: 'Failed to open browser' });
    }
  });
  res.json({ ok: true });
});

// ----------------------------------------------------
// Cloudflare Tunnel & IP Access Rules Manager
// ----------------------------------------------------
const RULES_FILE = path.join(os.homedir(), '.tline-ip-rules.json');

let ipRules: Record<string, 'allow' | 'block'> = {};
try {
  if (fs.existsSync(RULES_FILE)) {
    ipRules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load IP rules:', e);
}

function saveIpRules() {
  try {
    fs.writeFileSync(RULES_FILE, JSON.stringify(ipRules, null, 2));
  } catch (e) {
    console.error('Failed to save IP rules:', e);
  }
}

const LOGIN_BLOCKS_FILE = path.join(os.homedir(), '.tline-login-blocks.json');
let loginBlocks: Record<string, { blockedAt: number; attempts: number }> = {};

try {
  if (fs.existsSync(LOGIN_BLOCKS_FILE)) {
    loginBlocks = JSON.parse(fs.readFileSync(LOGIN_BLOCKS_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load login blocks:', e);
}

function saveLoginBlocks() {
  try {
    fs.writeFileSync(LOGIN_BLOCKS_FILE, JSON.stringify(loginBlocks, null, 2));
  } catch (e) {
    console.error('Failed to save login blocks:', e);
  }
}

// In-memory tracker for temporary failed attempts
let failedAttempts: Record<string, number> = {};

function isTunnelRequest(req: express.Request): boolean {
  if (req.headers['cf-connecting-ip']) return true;
  const ip = getClientIp(req);
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
  return !isLocal;
}

function getClientIp(req: express.Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && typeof cfIp === 'string') return cfIp;
  
  const forwardIp = req.headers['x-forwarded-for'];
  if (forwardIp && typeof forwardIp === 'string') {
    return forwardIp.split(',')[0].trim();
  }
  
  return req.socket.remoteAddress || 'unknown';
}

function parseUserAgent(ua: string): string {
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

interface AccessLog {
  ip: string;
  userAgent: string;
  deviceType: string;
  lastActive: number;
  path: string;
}

let recentAccesses: AccessLog[] = [];

// Access Logging & Blocking Middleware
app.use((req, res, next) => {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const deviceType = parseUserAgent(ua);
  
  // Log API requests
  if (req.path.startsWith('/api/')) {
    const existingIndex = recentAccesses.findIndex(a => a.ip === ip);
    if (existingIndex > -1) {
      recentAccesses[existingIndex].lastActive = Date.now();
      recentAccesses[existingIndex].path = req.path;
      if (ua) {
        recentAccesses[existingIndex].userAgent = ua;
        recentAccesses[existingIndex].deviceType = deviceType;
      }
    } else {
      recentAccesses.unshift({
        ip,
        userAgent: ua,
        deviceType,
        lastActive: Date.now(),
        path: req.path
      });
      if (recentAccesses.length > 100) recentAccesses.pop();
    }
  }

  // Block check
  if (ipRules[ip] === 'block' || loginBlocks[ip]) {
    return res.status(403).json({ error: 'Access denied: your IP has been blocked.' });
  }

  next();
});

// Serve static frontend in production if available
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}

// ----------------------------------------------------
// Authentication Endpoints
// ----------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/auth/setup-status', (req, res) => {
  res.json({ setupRequired: isSetupRequired() });
});

app.get('/api/system/version', (req, res) => {
  let appVersion = '1.3.227';
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      appVersion = pkg.version || appVersion;
    }
  } catch (e) {}
  res.json({ version: appVersion });
});

app.get('/api/system/stats', authMiddleware, (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    res.json({
      backend: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      system: {
        total: os.totalmem(),
        free: os.freemem(),
        platform: os.platform()
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


app.post('/api/auth/setup', (req, res) => {
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

app.post('/api/auth/login', (req, res) => {
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

app.post('/api/auth/change-password', authMiddleware, (req, res) => {
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

app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ valid: false });
  
  const token = authHeader.split(' ')[1];
  if (token === localBypassToken) {
    return res.json({ valid: true, source: 'local' });
  }
  
  const decoded = verifySocketToken(token);
  res.json({ valid: decoded });
});

// ----------------------------------------------------
// Workspace & Worktree Endpoints (Protected)
// ----------------------------------------------------

app.get('/api/workspaces', authMiddleware, async (req, res) => {
  try {
    const configs = getWorkspaces();
    const workspaceInfos = await Promise.all(configs.map(w => getWorkspaceInfo(w)));
    res.json(workspaceInfos);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workspaces', authMiddleware, (req, res) => {
  const { path: dirPath, defaultShell } = req.body;
  const isSSH = dirPath && dirPath.startsWith('ssh://');
  if (!dirPath || (!isSSH && !fs.existsSync(dirPath))) {
    return res.status(400).json({ error: 'Valid directory path is required.' });
  }
  const result = addWorkspace(dirPath, defaultShell);
  updateWorkspaceWatchers();
  res.json(result);
});

app.delete('/api/workspaces', authMiddleware, (req, res) => {
  const { path: dirPath } = req.body;
  if (!dirPath) {
    return res.status(400).json({ error: 'Directory path is required.' });
  }
  const result = removeWorkspace(dirPath);
  updateWorkspaceWatchers();
  res.json(result);
});

app.put('/api/workspaces', authMiddleware, (req, res) => {
  const { path: dirPath, defaultShell, name } = req.body;
  if (!dirPath) {
    return res.status(400).json({ error: 'Directory path is required.' });
  }
  const result = updateWorkspace(dirPath, { defaultShell, name });
  if (result.success) {
    updateWorkspaceWatchers();
    res.json(result);
  } else {
    res.status(404).json({ error: 'Workspace not found.' });
  }
});

app.get('/api/preview-proxy/tline-helper.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(TLINE_HELPER_CODE);
});

app.use('/api/preview-proxy', previewProxy);

app.get('/tline-helper.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(TLINE_HELPER_CODE);
});

app.use('/api', gitRouter);
app.use('/api/fs', fsRouter);

// ----------------------------------------------------
// Security & Access Control Endpoints (Protected)
// ----------------------------------------------------

app.get('/api/security/connections', authMiddleware, (req, res) => {
  res.json({
    accesses: recentAccesses,
    rules: ipRules,
    loginBlocks: loginBlocks
  });
});

app.post('/api/security/rules', authMiddleware, (req, res) => {
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
    if (loginBlocks[ip]) {
      delete loginBlocks[ip];
      saveLoginBlocks();
    }
    delete failedAttempts[ip];
  }
  saveIpRules();
  res.json({ success: true, rules: ipRules, loginBlocks: loginBlocks });
});

// ----------------------------------------------------
// Cloudflare Tunnel Endpoints (Protected)
// ----------------------------------------------------

app.get('/api/tunnel/status', authMiddleware, (req, res) => {
  res.json(tunnelManager.getStatus());
});

app.post('/api/tunnel/start', authMiddleware, (req, res) => {
  const { type, token } = req.body;
  
  if (!tunnelManager.isCloudflaredInstalled()) {
    return res.status(400).json({ 
      error: 'cloudflared is not installed or not in system PATH. Please install it to use tunnels.' 
    });
  }

  const broadcastStatus = () => {
    // Optional WebSocket status broadcast, here we let status API handle queries
  };

  if (type === 'quick') {
    tunnelManager.startQuickTunnel(Number(port), broadcastStatus);
    res.json({ success: true, message: 'Quick tunnel starting...' });
  } else if (type === 'token') {
    if (!token) {
      return res.status(400).json({ error: 'Token is required for named tunnels.' });
    }
    tunnelManager.startTokenTunnel(token, broadcastStatus);
    res.json({ success: true, message: 'Token-based tunnel starting...' });
  } else {
    res.status(400).json({ error: 'Invalid tunnel type.' });
  }
});

app.post('/api/tunnel/stop', authMiddleware, (req, res) => {
  tunnelManager.stopTunnel();
  res.json({ success: true, message: 'Tunnel stopped.' });
});

// Active terminals listing endpoint for remote sync
app.get('/api/terminals/active', authMiddleware, (req, res) => {
  res.json(terminalManager.listTerminals());
});

// Centralized tab and quick-launch state sync
const SYNC_FILE = path.join(os.homedir(), '.tline-sync.json');

app.get('/api/sync/state', authMiddleware, (req, res) => {
  try {
    if (fs.existsSync(SYNC_FILE)) {
      const data = fs.readFileSync(SYNC_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.tabs && Array.isArray(parsed.tabs)) {
        parsed.tabs = parsed.tabs.map((t: any) => {
          if (t.type === 'browser' && t.url) {
            if (t.url.startsWith('http://localhost:3000')) {
              t.url = t.url.replace('http://localhost:3000', 'http://localhost:4333');
            } else if (t.url.startsWith('http://127.0.0.1:3000')) {
              t.url = t.url.replace('http://127.0.0.1:3000', 'http://localhost:4333');
            }
          }
          return t;
        });
      }
      return res.json(parsed);
    }
    return res.json({ tabs: [], terminalInstances: {}, savedPrompts: [] });
  } catch (err: any) {
    console.error('Failed to read sync file:', err);
    res.status(500).json({ error: 'Failed to read sync state.' });
  }
});

app.post('/api/sync/state', authMiddleware, (req, res) => {
  try {
    const { tabs, terminalInstances, savedPrompts } = req.body;
    const state = {
      tabs: tabs || [],
      terminalInstances: terminalInstances || {},
      savedPrompts: savedPrompts || []
    };
    fs.writeFileSync(SYNC_FILE, JSON.stringify(state, null, 2), 'utf8');

    // Broadcast updated state to all connected clients
    const payload = JSON.stringify({
      id: 'sync_state',
      type: 'sync_update',
      state
    });
    for (const ws of activeWebSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to write sync file:', err);
    res.status(500).json({ error: 'Failed to save sync state.' });
  }
});

// Serve frontend routing fallback in production
if (fs.existsSync(frontendDistPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Create HTTP server
const server = http.createServer(app);

// ----------------------------------------------------
// WebSocket Server (PTY Multiplexer)
// ----------------------------------------------------
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const urlParams = new URL(request.url || '', `http://${request.headers.host}`);
  const pathname = urlParams.pathname;

  // Intercept preview proxy websocket upgrades (for HMR, etc.)
  if (pathname.startsWith('/api/preview-proxy')) {
    (previewProxy as any).upgrade(request, socket, head);
    return;
  }

  // IP block check for WebSocket
  const cfIp = request.headers['cf-connecting-ip'];
  let ip = 'unknown';
  if (cfIp && typeof cfIp === 'string') {
    ip = cfIp;
  } else {
    const forwardIp = request.headers['x-forwarded-for'];
    if (forwardIp && typeof forwardIp === 'string') {
      ip = forwardIp.split(',')[0].trim();
    } else {
      ip = request.socket.remoteAddress || 'unknown';
    }
  }

  if (ipRules[ip] === 'block' || loginBlocks[ip]) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  const token = urlParams.searchParams.get('token');

  if (!token || !verifySocketToken(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const activeWebSockets = new Set<WebSocket>();
const fsWatchers = new Map<string, fs.FSWatcher>();
let fileChangeDebounceTimer: NodeJS.Timeout | null = null;

function handleFileChange(filename: string) {
  if (fileChangeDebounceTimer) clearTimeout(fileChangeDebounceTimer);
  fileChangeDebounceTimer = setTimeout(() => {
    clearWorkspaceCache();
    const payload = JSON.stringify({ id: 'global', type: 'fs-change', filename });
    for (const ws of activeWebSockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }, 300);
}

async function updateWorkspaceWatchers() {
  try {
    const workspaces = getWorkspaces();
    const pathsToKeep = new Set<string>();

    for (const ws of workspaces) {
      if (ws.path.startsWith('ssh://')) continue;
      pathsToKeep.add(path.normalize(ws.path));
      try {
        const info = await getWorkspaceInfo(ws);
        if (info.worktrees) {
          for (const wt of info.worktrees) {
            if (wt.path.startsWith('ssh://')) continue;
            pathsToKeep.add(path.normalize(wt.path));
          }
        }
      } catch (err) {
        console.error(`Failed to get workspace info for ${ws.path}:`, err);
      }
    }

    for (const watchedPath of fsWatchers.keys()) {
      if (!pathsToKeep.has(watchedPath)) {
        fsWatchers.get(watchedPath)?.close();
        fsWatchers.delete(watchedPath);
      }
    }

    for (const normalized of pathsToKeep) {
      if (!fsWatchers.has(normalized) && fs.existsSync(normalized)) {
        try {
          const watcher = fs.watch(normalized, { recursive: true }, (event, filename) => {
            if (filename) {
              const normalizedFilename = filename.replace(/\\/g, '/');
              const parts = normalizedFilename.split('/');
              if (['node_modules', 'dist', 'dist-exe', '.agents'].some(p => parts.includes(p))) return;
              if (parts.includes('.git')) {
                const isGitTrigger = parts.includes('index') || parts.includes('HEAD') || parts.includes('refs');
                if (!isGitTrigger) return;
              }
              handleFileChange(filename);
            }
          });
          fsWatchers.set(normalized, watcher);
        } catch (err) {
          console.error(`Failed to watch path ${normalized}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Error updating workspace watchers:', err);
  }
}

// Register worktree/workspace change callback to update watchers
registerWorkspaceChangeCallback(() => {
  updateWorkspaceWatchers().catch(err => console.error(err));
});

// Register file change callback from filesystem router
registerFileChangeCallback((filename: string) => {
  handleFileChange(filename);
});

wss.on('connection', (ws: WebSocket) => {
  activeWebSockets.add(ws);
  const activeTerminals = new Set<string>();
  console.log(`[WS] Client connection established. Active clients: ${activeWebSockets.size}`);

  // Helper to start process title polling and active process detection
  const startTitlePolling = (termId: string, terminal: any) => {
    let lastProcessName = '';
    let lastActiveStateStr = '';

    const titleInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(titleInterval);
        return;
      }
      try {
        let currentName = terminal.getProcessName();
        if (currentName) {
          // clean it (strip .exe)
          if (currentName.toLowerCase().endsWith('.exe')) {
            currentName = currentName.slice(0, -4);
          }
          if (currentName !== lastProcessName) {
            lastProcessName = currentName;
            ws.send(JSON.stringify({ type: 'title', id: termId, title: currentName }));
          }
        }
      } catch (e) {
        clearInterval(titleInterval);
      }
    }, 5000);

    const processInterval = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(processInterval);
        return;
      }
      try {
        const pid = terminal.getPid();
        if (pid) {
          const activeProcesses = await getActiveProcessesForPid(pid);
          const stateStr = JSON.stringify(activeProcesses);
          if (stateStr !== lastActiveStateStr) {
            lastActiveStateStr = stateStr;
            ws.send(JSON.stringify({
              type: 'activeProcesses',
              id: termId,
              processes: activeProcesses
            }));
          }
        }
      } catch (e) {
        clearInterval(processInterval);
      }
    }, 10000);

    // Return a cleanup function
    return () => {
      clearInterval(titleInterval);
      clearInterval(processInterval);
    };
  };

  ws.on('message', (message: string) => {
    try {
      const payload = JSON.parse(message);
      const { type, id } = payload;

      if (type === 'init') {
        const { cwd, cols, rows, shellType } = payload;
        
        const existingTerm = terminalManager.getTerminal(id);
        
        if (existingTerm) {
          activeTerminals.add(id);
          console.log(`[WS] Re-attaching to existing PTY session: id=${id}, PID=${existingTerm.getPid()}, size=${cols}x${rows}`);

          // Ensure the existing terminal process size matches the client's current grid dimensions
          if (cols && rows) {
            try {
              existingTerm.resize(cols, rows);
            } catch (err) {
              console.error(`Failed to resize existing terminal ${id}:`, err);
            }
          }

          let stopPolling: (() => void) | null = null;
          stopPolling = startTitlePolling(id, existingTerm);

          terminalManager.setSender(
            id,
            ws,
            (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'data', id, data }));
              }
            },
            (code) => {
              activeTerminals.delete(id);
              if (stopPolling) stopPolling();
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'exit', id, code }));
              }
            }
          );

          // Replay output buffer so client sees what was missed while detached
          const buffer = terminalManager.getOutputBuffer(id);

          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              // Send PID
              ws.send(JSON.stringify({ type: 'pid', id, pid: existingTerm.getPid() }));
              // First replay any buffered output
              if (buffer) {
                ws.send(JSON.stringify({ type: 'replay', id, data: buffer }));
              }
              // Then show re-attach indicator
              ws.send(JSON.stringify({
                type: 're-attached',
                id
              }));
            }
          }, 100);
        } else {
          console.log(`[WS] Creating new PTY session: id=${id}, cwd=${cwd}, shellType=${shellType}, size=${cols}x${rows}`);
          const term = terminalManager.createTerminal(id, cwd, cols, rows, shellType);
          activeTerminals.add(id);
          const stopPolling = startTitlePolling(id, term);

          terminalManager.setSender(
            id,
            ws,
            (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'data', id, data }));
              }
            },
            (code) => {
              activeTerminals.delete(id);
              stopPolling();
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'exit', id, code }));
              }
            }
          );

          // Send PID immediately
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pid', id, pid: term.getPid() }));
            }
          }, 50);
        }

      } else if (type === 'data') {
        const { data } = payload;
        const term = terminalManager.getTerminal(id);
        if (term) {
          term.write(data);
        }
      } else if (type === 'resize') {
        const { cols, rows } = payload;
        const resized = terminalManager.resizeTerminal(id, cols, rows);
        if (resized) {
          const session = (terminalManager as any).sessions.get(id);
          if (session) {
            const payloadStr = JSON.stringify({ type: 'resize_broadcast', id, cols, rows });
            for (const [wsKey, sender] of session.senders.entries()) {
              if (wsKey !== ws && wsKey.readyState === WebSocket.OPEN) {
                try {
                  wsKey.send(payloadStr);
                } catch (e) {}
              }
            }
          }
        }
      } else if (type === 'close') {
        console.log(`[WS] Received close command for terminal: id=${id}`);
        terminalManager.removeTerminal(id);
        activeTerminals.delete(id);
      } else if (type === 'suspend') {
        console.log(`[WS] Received suspend command for terminal: id=${id}`);
        terminalManager.setSender(id, ws, null);
      }
    } catch (e) {
      console.error('WS Message parsing error:', e);
    }
  });

  ws.on('close', () => {
    activeWebSockets.delete(ws);
    console.log(`[WS] Client connection closed. Remaining active clients: ${activeWebSockets.size}`);
    // Put active terminals spawned by this connection into detached state (keep-alive)
    for (const termId of activeTerminals) {
      console.log(`[WS] Detaching terminal session: id=${termId}`);
      terminalManager.detachSession(termId, ws);
    }
    activeTerminals.clear();
  });
});

// Periodic garbage collection to keep memory usage low (triggered if node --expose-gc is enabled)
if (typeof global.gc === 'function') {
  const gcFn = global.gc;
  setInterval(() => {
    try {
      gcFn();
    } catch (e) {}
  }, 60000);
}

// Start Server
server.listen(port, () => {
  console.log(`========================================`);
  console.log(`t-line Workspace Server running on port ${port}`);
  console.log(`Bypass Token: ${localBypassToken}`);
  console.log(`========================================`);
  updateWorkspaceWatchers();
});
