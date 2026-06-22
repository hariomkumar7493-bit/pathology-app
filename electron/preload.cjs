const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - secure bridge between Electron and the web app.
 * Exposes a limited API via `window.electronAPI`.
 * 
 * SECURITY: Only specific IPC channels are exposed. ipcRenderer is never exposed directly.
 * 
 * Usage in React:
 *   if (window.electronAPI) {
 *     const printers = await window.electronAPI.printer.list();
 *   }
 */

// Allowed channels for receiving messages from main process
const RECEIVE_CHANNELS = [
  'update:status',
  'update:available',
  'update:progress',
  'update:downloaded',
];

contextBridge.exposeInMainWorld('electronAPI', {
  // ===== APP INFO =====
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPath: (name) => ipcRenderer.invoke('app:getPath', name),

  // ===== FILE OPERATIONS =====
  file: {
    saveDialog: (options) => ipcRenderer.invoke('file:saveDialog', options || {}),
    openDialog: (options) => ipcRenderer.invoke('file:openDialog', options || {}),
    write: (filePath, data, encoding) => ipcRenderer.invoke('file:write', { filePath, data, encoding: encoding || 'utf8' }),
    read: (filePath, encoding) => ipcRenderer.invoke('file:read', { filePath, encoding: encoding || 'utf8' }),
    exists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
    openInExplorer: (filePath) => ipcRenderer.invoke('file:openInExplorer', filePath),
  },

  // ===== PRINTER ACCESS =====
  printer: {
    list: () => ipcRenderer.invoke('printer:list'),
    print: (options) => ipcRenderer.invoke('printer:print', options || {}),
    printPDF: (options) => ipcRenderer.invoke('printer:printPDF', options),
  },

  // ===== AUTO-UPDATE =====
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('update:status', handler);
      return () => ipcRenderer.removeListener('update:status', handler);
    },
    onAvailable: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('update:available', handler);
      return () => ipcRenderer.removeListener('update:available', handler);
    },
    onProgress: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('update:progress', handler);
      return () => ipcRenderer.removeListener('update:progress', handler);
    },
    onDownloaded: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('update:downloaded', handler);
      return () => ipcRenderer.removeListener('update:downloaded', handler);
    },
  },

  // ===== SHELL =====
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  },
});
