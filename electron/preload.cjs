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

  // ===== LOCAL PDF (instant, no server needed) =====
  pdf: {
    generate: (html, fileName) => ipcRenderer.invoke('pdf:generate', { html, fileName }),
    generateAndSave: (html, fileName) => ipcRenderer.invoke('pdf:generateAndSave', { html, fileName }),
    printDirect: (html, options) => ipcRenderer.invoke('pdf:printDirect', { html, ...options }),
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
    // Subscribe to events (each returns an unsubscribe function)
    onChecking: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('update:checking', h); return () => ipcRenderer.removeListener('update:checking', h); },
    onAvailable: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('update:available', h); return () => ipcRenderer.removeListener('update:available', h); },
    onNotAvailable: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('update:not-available', h); return () => ipcRenderer.removeListener('update:not-available', h); },
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('update:progress', h); return () => ipcRenderer.removeListener('update:progress', h); },
    onDownloaded: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('update:downloaded', h); return () => ipcRenderer.removeListener('update:downloaded', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('update:error', h); return () => ipcRenderer.removeListener('update:error', h); },
    onStatus: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('update:status', h); return () => ipcRenderer.removeListener('update:status', h); },
  },

  // ===== SHELL =====
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
    copyFileToClipboard: (filePath) => ipcRenderer.invoke('shell:copyFileToClipboard', filePath),
    shareToWhatsApp: (opts) => ipcRenderer.invoke('shell:shareToWhatsApp', opts),
  },

  // ===== LOGGING & DIAGNOSTICS =====
  log: {
    write: (level, message, data) => ipcRenderer.invoke('log:write', { level, message, data }),
    getFiles: () => ipcRenderer.invoke('log:getFiles'),
    read: (fileName) => ipcRenderer.invoke('log:read', fileName),
    openFolder: () => ipcRenderer.invoke('log:openFolder'),
    export: () => ipcRenderer.invoke('log:export'),
  },
  diagnostics: () => ipcRenderer.invoke('diagnostics:info'),
});
