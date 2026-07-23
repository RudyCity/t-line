import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import os from 'os';
import { exec, spawn, execSync } from 'child_process';
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
import { previewProxy, purgeTabProxyTarget } from './previewProxy';
import { TLINE_HELPER_CODE } from './tline-helper-code';
import { handleSuperAgentConnection, startSuperAgentEager } from './superAgentBridge';
import superAgentRouter from './superAgentRoutes';
import { closeSessionDb } from './sessionManager';

dotenv.config();

const AUDIT_FILE = path.join(process.cwd(), 'superagent-audit.json');

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
    fs.appendFile(BACKEND_LOG_FILE, logLine, () => {});
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

// Web preview proxy is now imported from ./previewProxy

// Sanitize Origin header before CORS sees it. The Tauri webview (and some
// browsers under privacy modes / sandboxed contexts) can send `Origin: null`
// or other non-URL values. `cors@2.8.5` throws "Origin header is not a valid
// URL" on those, crashing the request pipeline. Drop invalid origins so CORS
// treats the request as a non-CORS / same-origin call.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    try {
      // eslint-disable-next-line no-new
      new URL(origin);
    } catch {
      delete req.headers.origin;
    }
  } else if (origin !== undefined) {
    delete req.headers.origin;
  }
  next();
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

import authRouter, {
  ipRules,
  loginBlocks,
  getClientIp,
  parseUserAgent,
  recentAccesses
} from './authRoutes';

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
  app.use(express.static(frontendDistPath, {
    maxAge: '1d',
    setHeaders: (res, path) => {
      // Monaco assets (/vs) or built JS/CSS files can be cached long-term
      if (path.includes('/vs/') || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.woff2')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  }));
}


app.use('/api', authRouter);

// Workspace & Worktree Endpoints (Protected)
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

app.post('/api/preview-proxy/event', (req, res) => {
  const { type, payload, tabId } = req.body;
  console.log(`[Proxy Event] Received event: ${type}, tabId: ${tabId}, payload keys: ${payload ? Object.keys(payload) : 'none'}`);
  let wsCount = 0;
  for (const ws of activeWebSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      wsCount++;
      ws.send(JSON.stringify({
        type: 'tline-preview-event',
        tabId,
        eventType: type,
        payload
      }));
    }
  }
  console.log(`[Proxy Event] Broadcasted to ${wsCount} active WebSockets`);
  res.json({ ok: true });
});

app.delete('/api/preview-proxy/purge-tab/:tabId', (req, res) => {
  const { tabId } = req.params;
  const purged = purgeTabProxyTarget(tabId);
  res.json({ ok: true, purged });
});

app.use('/api/preview-proxy', previewProxy);

app.get('/tline-helper.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(TLINE_HELPER_CODE);
});

app.use('/api/superagent', superAgentRouter);

app.use('/api', gitRouter);
app.use('/api/fs', fsRouter);

// ----------------------------------------------------
// Cloudflare Tunnel Endpoints (Protected)
// ----------------------------------------------------

app.get('/api/tunnel/status', authMiddleware, (req, res) => {
  res.json(tunnelManager.getStatus());
});

app.post('/api/tunnel/start', authMiddleware, (req, res) => {
  const { type, token, target, port: customPort } = req.body;
  
  if (!tunnelManager.isCloudflaredInstalled()) {
    return res.status(400).json({ 
      error: 'cloudflared is not installed or not in system PATH. Please install it to use tunnels.' 
    });
  }

  const broadcastStatus = () => {
    // Optional WebSocket status broadcast, here we let status API handle queries
  };

  const activeTarget = target === 'custom' ? tunnelManager.getCustomTunnel() : tunnelManager.getTlineTunnel();
  const portToUse = target === 'custom' ? Number(customPort) : Number(port);

  if (target === 'custom' && !customPort && type === 'quick') {
    return res.status(400).json({ error: 'Port is required for custom port tunnel.' });
  }

  if (type === 'quick') {
    activeTarget.startQuick(portToUse, broadcastStatus);
    res.json({ success: true, message: `Quick tunnel starting for ${target || 'tline'}...` });
  } else if (type === 'token') {
    if (!token) {
      return res.status(400).json({ error: 'Token is required for named tunnels.' });
    }
    activeTarget.startToken(token, broadcastStatus);
    res.json({ success: true, message: `Token-based tunnel starting for ${target || 'tline'}...` });
  } else {
    res.status(400).json({ error: 'Invalid tunnel type.' });
  }
});

app.post('/api/tunnel/stop', authMiddleware, (req, res) => {
  const { target } = req.body;
  if (target === 'custom') {
    tunnelManager.getCustomTunnel().stop();
  } else {
    tunnelManager.getTlineTunnel().stop();
  }
  res.json({ success: true, message: `Tunnel for ${target || 'tline'} stopped.` });
});

// Active terminals listing endpoint for remote sync
app.get('/api/terminals/active', authMiddleware, (req, res) => {
  res.json(terminalManager.listTerminals());
});

app.get('/api/system/stats', authMiddleware, (_req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    backend: {
      rss: memoryUsage.rss,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
    },
    system: {
      total: os.totalmem(),
      free: os.freemem(),
      platform: os.platform(),
    }
  });
});

app.get('/api/system/version', (_req, res) => {
  try {
    const pkgPath = path.join(__dirname, '../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return res.json({ version: pkg.version || '1.3.632' });
    }
  } catch (e) {}
  res.json({ version: '1.3.632' });
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

// Fallback handler for unmatched host-relative requests from the preview proxy
app.use((req, res, next) => {
  const referer = req.headers.referer || '';
  const cookies = req.headers.cookie || '';
  const hasProxyCookie = cookies.includes('tline_proxy_target=');
  const isFromPreviewProxy = referer.includes('/api/preview-proxy') || hasProxyCookie;

  if (isFromPreviewProxy && !req.path.startsWith('/api') && req.path !== '/tline-helper.js') {
    req.url = `/api/preview-proxy${req.url}`;
    req.originalUrl = `/api/preview-proxy${req.originalUrl}`;
    return previewProxy(req, res, next);
  }
  next();
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
const agentWss = new WebSocketServer({ noServer: true });

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

  if (pathname === '/api/superagent') {
    agentWss.handleUpgrade(request, socket, head, (ws) => {
      agentWss.emit('connection', ws, request);
    });
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const activeWebSockets = new Set<WebSocket>();
const fsWatchers = new Map<string, fs.FSWatcher>();
const fileChangeDebounceTimers = new Map<string, NodeJS.Timeout>();

function handleFileChange(filename: string) {
  const existingTimer = fileChangeDebounceTimers.get(filename);
  if (existingTimer) clearTimeout(existingTimer);
  
  const timer = setTimeout(() => {
    fileChangeDebounceTimers.delete(filename);
    clearWorkspaceCache();
    const payload = JSON.stringify({ id: 'global', type: 'fs-change', filename });
    for (const ws of activeWebSockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }, 300);
  
  fileChangeDebounceTimers.set(filename, timer);
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
              if (['node_modules', 'dist', 'dist-exe', '.agents', 'superagent-audit.json'].some(p => parts.includes(p))) return;
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

// Session change events (superagent-sessions-changed) are broadcast by SuperAgent
// via its SSE stream and relayed to all WebSocket clients by superAgentBridge.ts.
// No direct fs.watch on ~/.superagent-r needed.


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
      if (terminalManager.isSessionPersisted(termId)) {
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
      if (terminalManager.isSessionPersisted(termId)) {
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

          if (ws.readyState === WebSocket.OPEN) {
            // Send PID immediately
            ws.send(JSON.stringify({ type: 'pid', id, pid: existingTerm.getPid() }));
            
            if (buffer) {
              // Viewport-Only Replay: split buffer at nearest newline near last 4KB to prevent ANSI seq cutting
              let splitIdx = Math.max(0, buffer.length - 4000);
              const nextNewline = buffer.indexOf('\n', splitIdx);
              if (nextNewline !== -1 && nextNewline < buffer.length - 100) {
                splitIdx = nextNewline + 1;
              }

              const scrollback = buffer.slice(0, splitIdx);
              const viewport = buffer.slice(splitIdx);

              // Send viewport first for instant screen render
              ws.send(JSON.stringify({ type: 'replay', id, data: viewport, isViewport: true }));

              // Lazy-load the remaining scrollback history
              if (scrollback) {
                setTimeout(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'replay', id, data: scrollback, isScrollback: true }));
                  }
                }, 60);
              }
            }
            
            // Then show re-attach indicator immediately
            ws.send(JSON.stringify({
              type: 're-attached',
              id
            }));
          }
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
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pid', id, pid: term.getPid() }));
          }
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
      } else if (type === 'prewarm') {
        const term = terminalManager.getTerminal(id);
        if (term) {
          const pid = term.getPid();
          if (pid) {
            getActiveProcessesForPid(pid).catch(() => {});
            try { term.getProcessName(); } catch (e) {}
          }
        }
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

// SuperAgent Agent WebSocket Server handler
agentWss.on('connection', handleSuperAgentConnection);

// Periodic garbage collection to keep memory usage low (triggered if node --expose-gc is enabled)
if (typeof global.gc === 'function') {
  const gcFn = global.gc;
  setInterval(() => {
    try {
      gcFn();
    } catch (e) {}
  }, 60000);
}

// Safety net: prevent backend crash on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception (process kept alive):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection (process kept alive):', reason);
});

// Graceful shutdown: close SQLite DB connection
process.on('SIGINT', () => { closeSessionDb(); process.exit(0); });
process.on('SIGTERM', () => { closeSessionDb(); process.exit(0); });

// Start Server
server.listen(port, () => {
  console.log(`========================================`);
  console.log(`t-line Workspace Server running on port ${port}`);
  console.log(`Bypass Token: ${localBypassToken}`);
  console.log(`========================================`);
  updateWorkspaceWatchers();
  // Pre-warm the SuperAgent server so it is ready before the first WS connection.
  // Uses the global process singleton — subsequent WS handlers will see it's already up.
  startSuperAgentEager();
});
