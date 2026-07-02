const { app, ipcMain, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

let onBeforeQuit = null;

function sendUpdateStatus(payload) {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send('update-status', payload);
  }
}

function initAutoUpdater(onBeforeQuitCb) {
  if (onBeforeQuitCb) {
    onBeforeQuit = onBeforeQuitCb;
  }

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
  if (onBeforeQuit) {
    onBeforeQuit();
  }
  autoUpdater.quitAndInstall(false, true);
});

module.exports = {
  initAutoUpdater
};
