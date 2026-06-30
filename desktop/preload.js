const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  onMaximizedChange: (callback) => {
    const listener = (event, value) => callback(value);
    ipcRenderer.on('window-maximized-change', listener);
    return () => {
      ipcRenderer.removeListener('window-maximized-change', listener);
    };
  },
  startBackend: () => ipcRenderer.send('start-backend'),
  restartBackend: () => ipcRenderer.send('restart-backend'),
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  getMemoryUsage: () => ipcRenderer.invoke('get-memory-usage'),
  checkConnection: () => ipcRenderer.invoke('check-connection'),
  onBackendStatusChange: (callback) => {
    const listener = (event, value) => callback(value);
    ipcRenderer.on('backend-status-change', listener);
    return () => {
      ipcRenderer.removeListener('backend-status-change', listener);
    };
  },
  // Auto-updater API
  onUpdateStatus: (callback) => {
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on('update-status', listener);
    return () => {
      ipcRenderer.removeListener('update-status', listener);
    };
  },
  saveThemeSettings: (settings) => ipcRenderer.send('save-theme-settings', settings),
  getThemeSettings: () => ipcRenderer.invoke('get-theme-settings'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update')
});
