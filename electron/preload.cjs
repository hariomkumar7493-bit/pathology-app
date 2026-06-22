const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - runs in a sandboxed environment before the web page loads.
 * Exposes a safe, limited API to the renderer process via `window.electronAPI`.
 * 
 * SECURITY: Only expose specific IPC channels. Never expose ipcRenderer directly.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  isElectron: true,

  // File dialogs
  showSaveDialog: (options) => ipcRenderer.invoke('app:showSaveDialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('app:showOpenDialog', options),

  // Printing (for future barcode/label printer support)
  getPrinters: () => ipcRenderer.invoke('app:getPrinters'),
  print: (options) => ipcRenderer.invoke('app:print', options),

  // Platform info
  platform: process.platform,
});
