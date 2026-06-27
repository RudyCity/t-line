const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Disable hardware acceleration to prevent GPU process crash (error code -1073741819)
app.disableHardwareAcceleration();

let mainWindow = null;
let backendProcess = null;

function startBackend() {
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
  
  backendProcess = spawn(cmd, args, {
    cwd: projectRoot,
    shell: true,
    env: { ...process.env, PORT: '3999' }
  });

  let token = null;
  let serverStarted = false;

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
      serverStarted = true;
      
      // Delay slightly to ensure server socket is fully listening
      setTimeout(() => {
        if (token) {
          createWindow(`http://localhost:3999/?token=${token}`);
        } else {
          // Fallback to setup/login screen if no token parsed
          createWindow('http://localhost:3999/');
        }
      }, 500);
    }
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend-stderr] ${data.toString().trim()}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

function createWindow(url) {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 't-line Workspace Manager',
    backgroundColor: '#0b0f19',
    frame: false, // Make window frameless
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
