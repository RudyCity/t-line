import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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

dotenv.config();

const app = express();
const port = process.env.PORT || 3999;

app.use(cors());
app.use(express.json());

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

app.get('/api/auth/setup-status', (req, res) => {
  res.json({ setupRequired: isSetupRequired() });
});

app.get('/api/system/version', (req, res) => {
  let appVersion = '1.3.201';
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

  const urlParams = new URL(request.url || '', `http://${request.headers.host}`);
  const pathname = urlParams.pathname;
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
              const parts = filename.split(path.sep);
              if (['node_modules', '.git', 'dist', 'dist-exe', '.agents'].some(p => parts.includes(p))) return;
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
    }, 1000);

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
    }, 2500);

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
          const term = terminalManager.createTerminal(id, cwd, cols, rows, shellType);
          activeTerminals.add(id);
          const stopPolling = startTitlePolling(id, term);

          terminalManager.setSender(
            id,
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
        const term = terminalManager.getTerminal(id);
        if (term) {
          term.resize(cols, rows);
        }
      } else if (type === 'close') {
        terminalManager.removeTerminal(id);
        activeTerminals.delete(id);
      } else if (type === 'suspend') {
        terminalManager.setSender(id, null);
      }
    } catch (e) {
      console.error('WS Message parsing error:', e);
    }
  });

  ws.on('close', () => {
    activeWebSockets.delete(ws);
    // Put active terminals spawned by this connection into detached state (keep-alive)
    for (const termId of activeTerminals) {
      terminalManager.detachSession(termId);
    }
    activeTerminals.clear();
  });
});

// Start Server
server.listen(port, () => {
  console.log(`========================================`);
  console.log(`t-line Workspace Server running on port ${port}`);
  console.log(`Bypass Token: ${localBypassToken}`);
  console.log(`========================================`);
  updateWorkspaceWatchers();
});
