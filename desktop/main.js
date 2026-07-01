const { app, BrowserWindow, Menu, ipcMain, dialog, Tray, nativeImage, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { autoUpdater } = require('electron-updater');

// Disable hardware acceleration to prevent GPU process crash (error code -1073741819)
app.disableHardwareAcceleration();

// Limit V8 heap memory usage for main and renderer processes to prevent memory bloat (forces GC earlier)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=384');
// Prune GPU resources and command buffers when idle to free memory
app.commandLine.appendSwitch('prune-gpu-command-buffer');

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  showWindow();
});

let mainWindow = null;
let backendProcess = null;
let backendStatus = 'stopped'; // 'stopped' | 'starting' | 'running'
let tray = null;
let isQuitting = false;
let hasShownMinimizeNotification = false;
let bypassToken = null;
let activeSessions = [];
let workspaces = [];

function updateBackendStatus(newStatus) {
  if (backendStatus !== newStatus) {
    backendStatus = newStatus;
    updateTrayMenu();
    if (mainWindow) {
      mainWindow.webContents.send('backend-status-change', backendStatus);
    }
  }
}

const BYPASS_TOKEN_FILE = path.join(os.homedir(), '.tline-bypass-token');

function isBackendRunning(port) {
  return new Promise((resolve) => {
    const check = (host) => {
      const req = http.request({
        host: host,
        port: port,
        path: '/api/auth/setup-status',
        method: 'GET',
        timeout: 800
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed && typeof parsed.setupRequired === 'boolean') {
              resolve(true);
            } else {
              resolve(false);
            }
          } catch (e) {
            resolve(false);
          }
        });
      });

      req.on('error', () => {
        if (host === 'localhost') {
          check('127.0.0.1');
        } else {
          resolve(false);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (host === 'localhost') {
          check('127.0.0.1');
        } else {
          resolve(false);
        }
      });
      req.end();
    };

    check('localhost');
  });
}

function getActiveTerminals(port) {
  return new Promise((resolve) => {
    if (!bypassToken) {
      try {
        if (fs.existsSync(BYPASS_TOKEN_FILE)) {
          bypassToken = fs.readFileSync(BYPASS_TOKEN_FILE, 'utf8').trim();
        }
      } catch (e) {}
    }

    const headers = {};
    if (bypassToken) {
      headers['Authorization'] = `Bearer ${bypassToken}`;
    }

    const check = (host) => {
      const req = http.request({
        host: host,
        port: port,
        path: '/api/terminals/active',
        method: 'GET',
        headers: headers,
        timeout: 800
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              resolve(parsed);
            } else {
              resolve([]);
            }
          } catch (e) {
            resolve([]);
          }
        });
      });

      req.on('error', () => {
        if (host === 'localhost') {
          check('127.0.0.1');
        } else {
          resolve([]);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (host === 'localhost') {
          check('127.0.0.1');
        } else {
          resolve([]);
        }
      });
      req.end();
    };

    check('localhost');
  });
}

function getWorkspaces(port) {
  return new Promise((resolve) => {
    if (!bypassToken) {
      try {
        if (fs.existsSync(BYPASS_TOKEN_FILE)) {
          bypassToken = fs.readFileSync(BYPASS_TOKEN_FILE, 'utf8').trim();
        }
      } catch (e) {}
    }

    const headers = {};
    if (bypassToken) {
      headers['Authorization'] = `Bearer ${bypassToken}`;
    }

    const check = (host) => {
      const req = http.request({
        host: host,
        port: port,
        path: '/api/workspaces',
        method: 'GET',
        headers: headers,
        timeout: 800
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              resolve(parsed);
            } else {
              resolve([]);
            }
          } catch (e) {
            resolve([]);
          }
        });
      });

      req.on('error', () => {
        if (host === 'localhost') {
          check('127.0.0.1');
        } else {
          resolve([]);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (host === 'localhost') {
          check('127.0.0.1');
        } else {
          resolve([]);
        }
      });
      req.end();
    };

    check('localhost');
  });
}

function getWorkspaceForPath(workspacesList, cwd) {
  if (!cwd) return null;
  const normCwd = cwd.toLowerCase().replace(/\\/g, '/');
  
  let bestMatch = null;
  let maxLen = 0;
  
  for (const ws of workspacesList) {
    if (!ws || !ws.path) continue;
    
    // Check main workspace path
    const normWS = ws.path.toLowerCase().replace(/\\/g, '/');
    if (normCwd === normWS || normCwd.startsWith(normWS + '/')) {
      if (ws.path.length > maxLen) {
        maxLen = ws.path.length;
        bestMatch = ws;
      }
    }
    
    // Check worktrees
    if (Array.isArray(ws.worktrees)) {
      for (const wt of ws.worktrees) {
        if (!wt || !wt.path) continue;
        const normWT = wt.path.toLowerCase().replace(/\\/g, '/');
        if (normCwd === normWT || normCwd.startsWith(normWT + '/')) {
          if (wt.path.length > maxLen) {
            maxLen = wt.path.length;
            bestMatch = ws;
          }
        }
      }
    }
  }
  return bestMatch;
}

function startBackend() {
  if (backendStatus !== 'stopped') return;

  const isDev = !app.isPackaged;
  const projectRoot = isDev 
    ? path.join(app.getAppPath(), '..') 
    : app.getAppPath();
  
  updateBackendStatus('starting');

  const spawnEnv = { ...process.env, PORT: '5779' };

  if (isDev) {
    // In development, spawn the ts-node process using npm workspace run
    const cmd = 'npm';
    const args = ['run', 'dev:backend'];
    console.log(`Spawning backend: ${cmd} ${args.join(' ')}`);

    backendProcess = spawn(cmd, args, {
      cwd: projectRoot,
      shell: true,
      env: spawnEnv
    });
  } else {
    // In production, spawn using Electron's utilityProcess to guarantee compatibility and portability
    const scriptPath = path.join(projectRoot, 'backend', 'dist', 'server.js');
    console.log(`Spawning backend (production utilityProcess): ${scriptPath}`);

    const { utilityProcess } = require('electron');
    backendProcess = utilityProcess.fork(scriptPath, [], {
      env: spawnEnv,
      stdio: 'pipe',
      execArgv: ['--max-old-space-size=192']
    });
  }

  let token = null;
  const logFile = path.join(app.getPath('userData'), 'backend_run.log');
  try {
    fs.writeFileSync(logFile, `Backend Spawn Log - ${new Date().toISOString()}\n`);
  } catch (err) {}

  backendProcess.on('spawn', () => {
    try {
      fs.appendFileSync(logFile, `[spawned]\n`);
    } catch (e) {}
  });

  backendProcess.on('error', (err) => {
    try {
      fs.appendFileSync(logFile, `[error] ${err.message}\n${err.stack}\n`);
    } catch (e) {}
  });

  backendProcess.stdout.on('data', (data) => {
    try {
      fs.appendFileSync(logFile, `[stdout] ${data.toString()}`);
    } catch (err) {}

    const output = data.toString();
    console.log(`[backend-stdout] ${output.trim()}`);

    // Parse the bypass token
    const tokenMatch = output.match(/Bypass Token:\s+([a-f0-9]+)/);
    if (tokenMatch) {
      token = tokenMatch[1];
      bypassToken = token;
    }

    // Parse when the server is ready
    if (output.includes('Workspace Server running on port') || output.includes('running on port')) {
      updateBackendStatus('running');
      
      // Delay slightly to ensure server socket is fully listening
      setTimeout(() => {
        const url = token ? `http://localhost:5779/?token=${token}` : 'http://localhost:5779/';
        if (mainWindow) {
          mainWindow.loadURL(url);
          mainWindow.show();
        } else {
          createWindow(url);
        }
      }, 500);
    }
  });

  backendProcess.stderr.on('data', (data) => {
    try {
      fs.appendFileSync(logFile, `[stderr] ${data.toString()}`);
    } catch (err) {}
    console.error(`[backend-stderr] ${data.toString().trim()}`);
  });

  backendProcess.on('close', (code) => {
    try {
      fs.appendFileSync(logFile, `[close] exited with code ${code}\n`);
    } catch (err) {}
    console.log(`Backend process exited with code ${code}`);
    backendProcess = null;
    updateBackendStatus('stopped');
    
    // If window is open, reload with stopped state
    if (mainWindow && !isQuitting) {
      mainWindow.loadFile(path.join(__dirname, 'connection-error.html'));
    }
  });
}

function stopBackend() {
  if (!backendProcess) return;
  console.log('Stopping backend process...');
  
  updateBackendStatus('stopped');
  
  try {
    if (process.platform === 'win32') {
      // Use taskkill to kill the entire process tree on Windows
      spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
    } else {
      backendProcess.kill();
    }
  } catch (e) {
    console.error('Failed to kill backend process:', e);
  }
  
  backendProcess = null;
  
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'connection-error.html'));
  }
}

function restartBackend() {
  stopBackend();
  setTimeout(() => {
    startBackend();
  }, 1500);
}

function createWindow(urlOrPath) {
  if (mainWindow) return;

  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 't-line Workspace Manager',
    backgroundColor: '#0b0f19',
    frame: false, // Make window frameless
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Handle connection or loading failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL.startsWith('http://localhost:5779') || validatedURL.startsWith('http://127.0.0.1:5779')) {
      console.log(`Failed to load backend URL ${validatedURL} (${errorDescription}). Loading local reconnect page.`);
      mainWindow.loadFile(path.join(__dirname, 'connection-error.html'));
    }
  });

  if (urlOrPath.startsWith('http:') || urlOrPath.startsWith('https:') || urlOrPath.startsWith('data:')) {
    mainWindow.loadURL(urlOrPath);
  } else {
    mainWindow.loadFile(urlOrPath);
  }
  mainWindow.maximize();

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      showMinimizeNotification();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-change', false);
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('t-line Workspace Manager');
  
  tray.on('double-click', () => {
    showWindow();
  });
  
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  
  let statusText = 'Unknown';
  if (backendStatus === 'running') statusText = 'Running';
  else if (backendStatus === 'starting') statusText = 'Starting...';
  else if (backendStatus === 'stopped') statusText = 'Stopped';
  
  const menuTemplate = [
    { label: `t-line: ${statusText}`, enabled: false },
    { type: 'separator' },
    { label: 'Show Dashboard', click: () => showWindow() },
    { type: 'separator' },
    { 
      label: 'Start Backend', 
      enabled: backendStatus === 'stopped',
      click: () => startBackend() 
    },
    { 
      label: 'Stop Backend', 
      enabled: backendStatus === 'running',
      click: () => stopBackend() 
    },
    { 
      label: 'Restart Backend', 
      enabled: backendStatus === 'running',
      click: () => restartBackend() 
    }
  ];

  // Group and list active terminal PTY sessions by workspace
  if (backendStatus === 'running' && Array.isArray(workspaces) && Array.isArray(activeSessions) && activeSessions.length > 0) {
    menuTemplate.push({ type: 'separator' });
    menuTemplate.push({ label: 'Active PTY Sessions:', enabled: false });

    workspaces.forEach(ws => {
      if (!ws || !ws.path) return;
      const wsTerms = activeSessions.filter(t => {
        if (!t || !t.cwd) return false;
        const match = getWorkspaceForPath(workspaces, t.cwd);
        return match && match.path === ws.path;
      });

      if (wsTerms.length > 0) {
        const submenuItems = wsTerms.map(t => {
          const separatorChar = process.platform === 'win32' ? '\\' : '/';
          const folderName = t.cwd ? t.cwd.substring(t.cwd.lastIndexOf(separatorChar) + 1) : '';
          
          let labelSuffix = folderName || 'Root';
          if (ws.worktrees && t.cwd) {
            const normCwd = t.cwd.toLowerCase().replace(/\\/g, '/');
            const matchedWt = ws.worktrees.find(wt => {
              if (!wt || !wt.path) return false;
              const normWT = wt.path.toLowerCase().replace(/\\/g, '/');
              return normCwd === normWT || normCwd.startsWith(normWT + '/');
            });
            if (matchedWt) {
              labelSuffix = matchedWt.branch ? `wt: ${matchedWt.branch}` : `wt: ${folderName}`;
            }
          }

          return {
            label: `[PID ${t.pid}] ${t.shellType} (${labelSuffix})`,
            click: () => showWindow()
          };
        });

        menuTemplate.push({
          label: `${ws.name} (${wsTerms.length})`,
          submenu: submenuItems
        });
      }
    });

    const orphanTerms = activeSessions.filter(t => {
      if (!t || !t.cwd) return false;
      return !getWorkspaceForPath(workspaces, t.cwd);
    });
    if (orphanTerms.length > 0) {
      const submenuItems = orphanTerms.map(t => ({
        label: `[PID ${t.pid}] ${t.shellType}`,
        click: () => showWindow()
      }));
      menuTemplate.push({
        label: `Other Sessions (${orphanTerms.length})`,
        submenu: submenuItems
      });
    }
  }

  menuTemplate.push({ type: 'separator' });
  menuTemplate.push({ 
    label: 'Restart Desktop', 
    click: () => {
      isQuitting = true;
      app.relaunch();
      app.quit();
    } 
  });
  menuTemplate.push({ 
    label: 'Quit', 
    click: () => {
      isQuitting = true;
      app.quit();
    } 
  });

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
}

function showWindow() {
  if (!mainWindow) {
    if (backendStatus === 'running') {
      const url = bypassToken ? `http://localhost:5779/?token=${bypassToken}` : 'http://localhost:5779/';
      createWindow(url);
    } else {
      createWindow(path.join(__dirname, 'connection-error.html'));
    }
    return;
  }
  
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showMinimizeNotification() {
  if (hasShownMinimizeNotification) return;
  
  if (Notification.isSupported()) {
    const iconPath = path.join(__dirname, 'icon.png');
    const notification = new Notification({
      title: 't-line Workspace Manager',
      body: 't-line is running in the background. Access it from the system tray.',
      icon: iconPath,
      silent: true
    });
    notification.show();
    hasShownMinimizeNotification = true;
  }
}

function createMenu() {
  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for custom frame controls and native file dialogs
ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('open-folder', async (_, folderPath) => {
  const { shell } = require('electron');
  await shell.openPath(folderPath);
});

ipcMain.handle('is-window-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('start-backend', () => {
  startBackend();
});

ipcMain.on('restart-backend', () => {
  restartBackend();
});

ipcMain.handle('get-backend-status', () => {
  return backendStatus;
});

ipcMain.handle('get-memory-usage', async () => {
  try {
    const metrics = app.getAppMetrics();
    let totalMemoryKB = 0;
    metrics.forEach(metric => {
      totalMemoryKB += (metric.memory.workingSetSize || 0);
    });
    
    const memoryUsage = process.memoryUsage();
    return {
      desktopRss: memoryUsage.rss,
      desktopTotal: totalMemoryKB * 1024
    };
  } catch (e) {
    console.error('Error fetching desktop memory metrics:', e);
    return null;
  }
});

// ─── Auto-Updater ────────────────────────────────────────────────────────────

function sendUpdateStatus(payload) {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', payload);
  }
}

function initAutoUpdater() {
  // Only run in packaged production builds
  if (!app.isPackaged) {
    console.log('[updater] Skipped — running in dev mode.');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for update...');
    sendUpdateStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
    sendUpdateStatus({ status: 'available', version: info.version, releaseNotes: info.releaseNotes || null });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] Up to date:', info.version);
    sendUpdateStatus({ status: 'not-available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] Download progress: ${Math.round(progress.percent)}%`);
    sendUpdateStatus({
      status: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Update downloaded:', info.version);
    sendUpdateStatus({ status: 'ready', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
    sendUpdateStatus({ status: 'error', message: err.message });
  });

  // Check 5 seconds after startup, then every 4 hours
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[updater] checkForUpdates failed:', err.message);
    });
  }, 5000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[updater] Periodic checkForUpdates failed:', err.message);
    });
  }, 4 * 60 * 60 * 1000);
}

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) return { status: 'dev' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: 'ok', updateInfo: result?.updateInfo || null };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

ipcMain.on('install-update', () => {
  if (!app.isPackaged) return;
  isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
});

// ─── Theme Sync ──────────────────────────────────────────────────────────────

function getThemeSettingsPath() {
  return path.join(app.getPath('userData'), 'theme_settings.json');
}

ipcMain.on('save-theme-settings', (_, settings) => {
  try {
    fs.writeFileSync(getThemeSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save theme settings:', err);
  }
});

ipcMain.handle('get-theme-settings', () => {
  try {
    const filePath = getThemeSettingsPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read theme settings:', err);
  }
  return null;
});

// ─────────────────────────────────────────────────────────────────────────────

ipcMain.handle('check-connection', async () => {
  const port = 5779;
  const running = await isBackendRunning(port);
  if (running) {
    updateBackendStatus('running');
    try {
      if (fs.existsSync(BYPASS_TOKEN_FILE)) {
        bypassToken = fs.readFileSync(BYPASS_TOKEN_FILE, 'utf8').trim();
      }
    } catch (e) {}
    const url = bypassToken ? `http://localhost:5779/?token=${bypassToken}` : 'http://localhost:5779/';
    if (mainWindow) {
      const currentUrl = mainWindow.webContents.getURL();
      if (!currentUrl.startsWith('http')) {
        mainWindow.loadURL(url);
      }
    }
    return true;
  }
  return false;
});

app.on('ready', async () => {
  createMenu();
  createTray();
  initAutoUpdater();
  
  const port = 5779;
  const alreadyRunning = await isBackendRunning(port);
  if (alreadyRunning) {
    console.log(`Backend is already running on port ${port}. Connecting directly...`);
    updateBackendStatus('running');
    
    try {
      if (fs.existsSync(BYPASS_TOKEN_FILE)) {
        bypassToken = fs.readFileSync(BYPASS_TOKEN_FILE, 'utf8').trim();
      }
    } catch (err) {
      console.error('Error reading external bypass token:', err);
    }
    
    const url = bypassToken ? `http://localhost:5779/?token=${bypassToken}` : 'http://localhost:5779/';
    createWindow(url);
  } else {
    startBackend();
  }

  // Periodic polling check to update status in real-time
  setInterval(async () => {
    const running = await isBackendRunning(port);
    const newStatus = running ? 'running' : 'stopped';
    
    let sessionsChanged = false;
    if (running) {
      try {
        const [terms, wsList] = await Promise.all([
          getActiveTerminals(port),
          getWorkspaces(port)
        ]);
        const oldState = JSON.stringify({ activeSessions, workspaces });
        const newState = JSON.stringify({ activeSessions: terms, workspaces: wsList });
        if (oldState !== newState) {
          activeSessions = terms;
          workspaces = wsList;
          sessionsChanged = true;
        }
      } catch (e) {
        console.error('Error fetching tray terminals:', e);
      }
    } else {
      if (activeSessions.length > 0 || workspaces.length > 0) {
        activeSessions = [];
        workspaces = [];
        sessionsChanged = true;
      }
    }

    // Only update if not starting (to avoid conflict during startup phase)
    if (backendStatus !== 'starting') {
      if (newStatus !== backendStatus || sessionsChanged) {
        const statusTransition = (newStatus !== backendStatus);
        updateBackendStatus(newStatus);
        
        if (sessionsChanged && !statusTransition) {
          updateTrayMenu();
        }
        
        if (statusTransition) {
          // If it transitioned to stopped, show the stopped message
          if (backendStatus === 'stopped') {
            if (mainWindow) {
              mainWindow.loadFile(path.join(__dirname, 'connection-error.html'));
            }
          }
          
          // If it transitioned to running, reload/open window
          if (backendStatus === 'running') {
            try {
              if (fs.existsSync(BYPASS_TOKEN_FILE)) {
                bypassToken = fs.readFileSync(BYPASS_TOKEN_FILE, 'utf8').trim();
              }
            } catch (e) {}
            
            const url = bypassToken ? `http://localhost:5779/?token=${bypassToken}` : 'http://localhost:5779/';
            if (mainWindow) {
              mainWindow.loadURL(url);
            } else {
              createWindow(url);
            }
          }
        }
      }
    } else {
      // If we are starting, but the backend is now detected as running, update state
      if (running) {
        updateBackendStatus('running');
      }
    }
  }, 5000);
});

app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  // Gracefully kill backend process on app quit
  if (backendProcess) {
    console.log('Terminating backend process...');
    try {
      if (process.platform === 'win32') {
        // Use taskkill to kill the entire process tree on Windows
        spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
      } else {
        backendProcess.kill();
      }
    } catch (e) {
      console.error('Failed to kill backend process:', e);
    }
  }
});

app.on('activate', () => {
  if (mainWindow === null && backendStatus === 'running') {
    // If backend is running, try to open window again
    const url = bypassToken ? `http://localhost:5779/?token=${bypassToken}` : 'http://localhost:5779/';
    createWindow(url);
  }
});
