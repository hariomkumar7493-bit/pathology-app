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

  // ===== LOCAL DATABASE (offline support) =====
  db: {
    login: (credentials) => ipcRenderer.invoke('db:login', credentials),
    getUsers: () => ipcRenderer.invoke('db:getUsers'),
    createUser: (data) => ipcRenderer.invoke('db:createUser', data),
    updateUser: (data) => ipcRenderer.invoke('db:updateUser', data),
    deleteUser: (data) => ipcRenderer.invoke('db:deleteUser', data),

    getDashboard: () => ipcRenderer.invoke('db:getDashboard'),

    getPatients: () => ipcRenderer.invoke('db:getPatients'),
    getPatient: (id) => ipcRenderer.invoke('db:getPatient', { id }),
    createPatient: (data) => ipcRenderer.invoke('db:createPatient', data),
    updatePatient: (id, data) => ipcRenderer.invoke('db:updatePatient', { id, data }),
    deletePatient: (id) => ipcRenderer.invoke('db:deletePatient', { id }),
    searchPatients: (term) => ipcRenderer.invoke('db:searchPatients', { term }),

    getTests: () => ipcRenderer.invoke('db:getTests'),
    getCategories: () => ipcRenderer.invoke('db:getCategories'),
    getTestParameters: (id) => ipcRenderer.invoke('db:getTestParameters', { id }),
    getBulkParameters: (testIds) => ipcRenderer.invoke('db:getBulkParameters', { testIds }),
    createTest: (data) => ipcRenderer.invoke('db:createTest', data),
    updateTest: (id, data) => ipcRenderer.invoke('db:updateTest', { id, data }),
    deleteTest: (id) => ipcRenderer.invoke('db:deleteTest', { id }),
    createCategory: (data) => ipcRenderer.invoke('db:createCategory', data),
    updateCategory: (id, data) => ipcRenderer.invoke('db:updateCategory', { id, data }),
    deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', { id }),

    getReports: () => ipcRenderer.invoke('db:getReports'),
    getReport: (id) => ipcRenderer.invoke('db:getReport', { id }),
    createReport: (data) => ipcRenderer.invoke('db:createReport', data),
    updateReportResults: (id, data) => ipcRenderer.invoke('db:updateReportResults', { id, ...data }),
    createQuickReport: (data) => ipcRenderer.invoke('db:createQuickReport', data),
    deleteReport: (id) => ipcRenderer.invoke('db:deleteReport', { id }),
    addTestToReport: (reportId, testId) => ipcRenderer.invoke('db:addTestToReport', { reportId, testId }),
    removeTestFromReport: (reportId, testId) => ipcRenderer.invoke('db:removeTestFromReport', { reportId, testId }),

    getReportLayout: () => ipcRenderer.invoke('db:getReportLayout'),
    updateReportLayout: (data) => ipcRenderer.invoke('db:updateReportLayout', data),
    resetReportLayout: () => ipcRenderer.invoke('db:resetReportLayout'),
    getReferringDoctors: () => ipcRenderer.invoke('db:getReferringDoctors'),
    updateReferringDoctors: (doctors) => ipcRenderer.invoke('db:updateReferringDoctors', { doctors }),

    getSyncStatus: () => ipcRenderer.invoke('db:getSyncStatus'),
  },

  // ===== SYNC ENGINE =====
  sync: {
    now: (token) => ipcRenderer.invoke('sync:now', token),
    status: () => ipcRenderer.invoke('sync:status'),
    onStatusChange: (cb) => {
      const h = (e, d) => cb(d);
      ipcRenderer.on('sync:status-change', h);
      return () => ipcRenderer.removeListener('sync:status-change', h);
    },
  },

  // ===== ONLINE STATUS =====
  isOnline: () => ipcRenderer.invoke('sync:status'),

  // ===== ANALYZER (Erba Chem 7) =====
  analyzer: {
    listPorts: () => ipcRenderer.invoke('analyzer:listPorts'),
    start: (port, baudRate) => ipcRenderer.invoke('analyzer:start', { port, baudRate }),
    stop: () => ipcRenderer.invoke('analyzer:stop'),
    status: () => ipcRenderer.invoke('analyzer:status'),
    getUnassigned: () => ipcRenderer.invoke('analyzer:getUnassigned'),
    assign: (unassignedId, reportId) => ipcRenderer.invoke('analyzer:assign', { unassignedId, reportId }),
    getPendingReports: () => ipcRenderer.invoke('analyzer:getPendingReports'),
    saveSettings: (port, baudRate) => ipcRenderer.invoke('analyzer:saveSettings', { port, baudRate }),
    loadSettings: () => ipcRenderer.invoke('analyzer:loadSettings'),
    onResultReceived: (cb) => {
      const h = (e, d) => cb(d);
      ipcRenderer.on('analyzer:resultReceived', h);
      return () => ipcRenderer.removeListener('analyzer:resultReceived', h);
    },
    onStatus: (cb) => {
      const h = (e, d) => cb(d);
      ipcRenderer.on('analyzer:status', h);
      return () => ipcRenderer.removeListener('analyzer:status', h);
    },
    onError: (cb) => {
      const h = (e, d) => cb(d);
      ipcRenderer.on('analyzer:error', h);
      return () => ipcRenderer.removeListener('analyzer:error', h);
    },
  },
});
