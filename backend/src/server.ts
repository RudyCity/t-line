import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
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
import { 
  getWorkspaces, 
  addWorkspace, 
  removeWorkspace, 
  getWorkspaceInfo, 
  addWorktree, 
  removeWorktree,
  getRepoBranches
} from './gitManager';
import { terminalManager } from './terminalManager';
import { tunnelManager } from './tunnelManager';

dotenv.config();

const app = express();
const port = process.env.PORT || 3999;

app.use(cors());
app.use(express.json());

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
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }
  if (verifyMasterPassword(password)) {
    return res.json({ success: true, token: generateToken({ role: 'admin' }) });
  }
  res.status(401).json({ error: 'Invalid master password.' });
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
  if (!dirPath || !fs.existsSync(dirPath)) {
    return res.status(400).json({ error: 'Valid directory path is required.' });
  }
  const result = addWorkspace(dirPath, defaultShell);
  res.json(result);
});

app.delete('/api/workspaces', authMiddleware, (req, res) => {
  const { path: dirPath } = req.body;
  if (!dirPath) {
    return res.status(400).json({ error: 'Directory path is required.' });
  }
  const result = removeWorkspace(dirPath);
  res.json(result);
});

app.get('/api/workspaces/:id/branches', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const branches = await getRepoBranches(matched.path);
    res.json(branches);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/worktrees/add', authMiddleware, async (req, res) => {
  const { repoPath, worktreePath, branchName, newBranch } = req.body;
  if (!repoPath || !worktreePath || !branchName) {
    return res.status(400).json({ error: 'repoPath, worktreePath, and branchName are required.' });
  }
  
  const result = await addWorktree(repoPath, worktreePath, branchName, !!newBranch);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/worktrees/remove', authMiddleware, async (req, res) => {
  const { repoPath, worktreePath, force } = req.body;
  if (!repoPath || !worktreePath) {
    return res.status(400).json({ error: 'repoPath and worktreePath are required.' });
  }
  
  const result = await removeWorktree(repoPath, worktreePath, !!force);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
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

// File System directory browser endpoint
app.get('/api/fs/list', authMiddleware, (req, res) => {
  const targetPath = req.query.path as string;

  try {
    if (!targetPath) {
      // Return logical drives on Windows, or root on Unix
      if (os.platform() === 'win32') {
        const drives: string[] = [];
        for (let i = 65; i <= 90; i++) {
          const drive = String.fromCharCode(i) + ':\\';
          if (fs.existsSync(drive)) {
            drives.push(drive);
          }
        }
        return res.json({ currentPath: '', parentPath: null, directories: drives.map(d => ({ name: d, path: d })) });
      } else {
        const homePath = os.homedir();
        return res.json({ 
          currentPath: homePath, 
          parentPath: path.dirname(homePath),
          directories: [
            { name: 'Root (/)', path: '/' },
            { name: 'User Home', path: homePath }
          ] 
        });
      }
    }

    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Path does not exist.' });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory.' });
    }

    const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const directories = items
      .filter(item => {
        try {
          return item.isDirectory() && !item.name.startsWith('.');
        } catch (e) {
          return false;
        }
      })
      .map(item => ({
        name: item.name,
        path: path.join(resolvedPath, item.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(resolvedPath);
    
    res.json({
      currentPath: resolvedPath,
      parentPath: parentPath !== resolvedPath ? parentPath : null,
      directories
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
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

wss.on('connection', (ws: WebSocket) => {
  const activeTerminals = new Set<string>();

  ws.on('message', (message: string) => {
    try {
      const payload = JSON.parse(message);
      const { type, id } = payload;

      if (type === 'init') {
        const { cwd, cols, rows, shellType } = payload;
        
        const isPersisted = terminalManager.isSessionPersisted(id);
        
        if (isPersisted) {
          activeTerminals.add(id);
          terminalManager.setSender(
            id,
            (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'data', id, data }));
              }
            },
            (code) => {
              activeTerminals.delete(id);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'exit', id, code }));
              }
            }
          );
          
          // Micro delay, then output confirmation
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ 
                type: 'data', 
                id, 
                data: '\r\n\x1b[1;35m[t-line: Session Re-attached]\x1b[0m\r\n' 
              }));
            }
          }, 100);
          
        } else {
          // Remove old terminal if exists (safety)
          terminalManager.removeTerminal(id);
          
          const term = terminalManager.createTerminal(id, cwd, cols, rows, shellType);
          activeTerminals.add(id);

          terminalManager.setSender(
            id,
            (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'data', id, data }));
              }
            },
            (code) => {
              activeTerminals.delete(id);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'exit', id, code }));
              }
            }
          );
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
      }
    } catch (e) {
      console.error('WS Message parsing error:', e);
    }
  });

  ws.on('close', () => {
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
});
