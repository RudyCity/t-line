const { app, BrowserWindow, Menu, ipcMain, dialog, Tray, nativeImage, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Disable hardware acceleration to prevent GPU process crash (error code -1073741819)
app.disableHardwareAcceleration();

let mainWindow = null;
let backendProcess = null;
let backendStatus = 'stopped'; // 'stopped' | 'starting' | 'running'
let tray = null;
let isQuitting = false;
let hasShownMinimizeNotification = false;

function startBackend() {
  if (backendStatus !== 'stopped') return;

  const isDev = !app.isPackaged;
  const projectRoot = path.join(__dirname, '..');
  
  // Decide how to start the backend depending on build state
  let cmd, args;
  
  if (isDev) {
    // In development, spawn the ts-node process using npm workspace run
    cmd = 'npm';
    args = ['run', 'dev:backend'];
  } else {
    // In production, spawn node directly on compiled js
    cmd = 'node';
    args = [path.join(projectRoot, 'backend', 'dist', 'server.js')];
  }

  console.log(`Spawning backend: ${cmd} ${args.join(' ')}`);
  
  backendStatus = 'starting';
  updateTrayMenu();

  backendProcess = spawn(cmd, args, {
    cwd: projectRoot,
    shell: true,
    env: { ...process.env, PORT: '3999' }
  });

  let token = null;

  backendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[backend-stdout] ${output.trim()}`);

    // Parse the bypass token
    const tokenMatch = output.match(/Bypass Token:\s+([a-f0-9]+)/);
    if (tokenMatch) {
      token = tokenMatch[1];
    }

    // Parse when the server is ready
    if (output.includes('Workspace Server running on port') || output.includes('running on port')) {
      backendStatus = 'running';
      updateTrayMenu();
      
      // Delay slightly to ensure server socket is fully listening
      setTimeout(() => {
        const url = token ? `http://localhost:3999/?token=${token}` : 'http://localhost:3999/';
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
    console.error(`[backend-stderr] ${data.toString().trim()}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    backendProcess = null;
    backendStatus = 'stopped';
    updateTrayMenu();
    
    // If window is open, reload with stopped state
    if (mainWindow && !isQuitting) {
      mainWindow.loadURL('data:text/html,<html><body style="background:#0b0f19;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;user-select:none;"><div style="text-align:center;"><h2>Backend is stopped</h2><p>Start the backend from the system tray to continue.</p></div></body></html>');
    }
  });
}

function stopBackend() {
  if (!backendProcess) return;
  console.log('Stopping backend process...');
  
  backendStatus = 'stopped';
  updateTrayMenu();
  
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
    mainWindow.loadURL('data:text/html,<html><body style="background:#0b0f19;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;user-select:none;"><div style="text-align:center;"><h2>Backend is stopped</h2><p>Start the backend from the system tray to continue.</p></div></body></html>');
  }
}

function restartBackend() {
  stopBackend();
  setTimeout(() => {
    startBackend();
  }, 1500);
}

function createWindow(url) {
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

  mainWindow.loadURL(url);

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
  
  const contextMenu = Menu.buildFromTemplate([
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
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

function showWindow() {
  if (!mainWindow) {
    if (backendStatus === 'running') {
      startBackend();
    } else {
      createWindow('data:text/html,<html><body style="background:#0b0f19;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;user-select:none;"><div style="text-align:center;"><h2>Backend is stopped</h2><p>Start the backend from the system tray to continue.</p></div></body></html>');
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

app.on('ready', () => {
  createMenu();
  createTray();
  startBackend();
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
  if (mainWindow === null && backendProcess) {
    // If backend is running, try to open window again
    createWindow('http://localhost:3999/');
  }
});
