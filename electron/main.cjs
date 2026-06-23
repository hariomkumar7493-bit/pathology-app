const { app, BrowserWindow, ipcMain, shell, dialog, globalShortcut, crashReporter } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Production URL - your deployed web application
const PRODUCTION_URL = 'https://patholabpro.online';
// Development URL - local React dev server (matches vite.config.js port)
const DEV_URL = 'http://localhost:3000';

const isDev = !app.isPackaged;

let mainWindow = null;

// ===== LOGGING SYSTEM =====
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB per log file
const MAX_LOG_FILES = 5;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFilePath() {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `app-${date}.log`);
}

function rotateLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .sort()
      .reverse();
    // Remove old log files beyond MAX_LOG_FILES
    for (let i = MAX_LOG_FILES; i < files.length; i++) {
      fs.unlinkSync(path.join(LOG_DIR, files[i]));
    }
  } catch (e) { /* ignore */ }
}

function log(level, message, data = null) {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}\n`;

  // Write to log file
  const logPath = getLogFilePath();
  try {
    fs.appendFileSync(logPath, entry);
    // Rotate if file too large
    const stats = fs.statSync(logPath);
    if (stats.size > MAX_LOG_SIZE) rotateLogs();
  } catch (e) { /* ignore */ }

  // Also log to console in dev
  if (isDev) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(`[${level}]`, message, data || '');
  }
}

// Override console methods to capture all logs
const origConsoleError = console.error;
process.on('uncaughtException', (err) => {
  log('FATAL', 'Uncaught exception', { message: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason) => {
  log('FATAL', 'Unhandled rejection', { reason: String(reason) });
});

// ===== AUTO-UPDATER SETUP =====
let updateRetryCount = 0;
const MAX_UPDATE_RETRIES = 3;
const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
const INITIAL_CHECK_DELAY = 10000; // 10 seconds after launch
const RETRY_DELAY = 60000; // 1 minute between retries

function setupAutoUpdater() {
  if (isDev) {
    log('INFO', 'Auto-updater skipped (dev mode)');
    return;
  }

  // Configure updater
  autoUpdater.autoDownload = true;          // Download immediately when update found
  autoUpdater.autoInstallOnAppQuit = true;  // Install when user quits
  autoUpdater.allowDowngrade = false;       // Never downgrade

  // ----- Event: Checking -----
  autoUpdater.on('checking-for-update', () => {
    log('INFO', 'Checking for updates...');
    sendToRenderer('update:checking', true);
    sendToRenderer('update:status', 'Checking for updates...');
  });

  // ----- Event: Update available -----
  autoUpdater.on('update-available', (info) => {
    updateRetryCount = 0; // Reset retries on success
    log('INFO', 'Update available', { version: info.version, releaseDate: info.releaseDate });
    sendToRenderer('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes || '',
    });
    sendToRenderer('update:status', `Downloading v${info.version}...`);
  });

  // ----- Event: No update -----
  autoUpdater.on('update-not-available', (info) => {
    updateRetryCount = 0;
    log('INFO', 'App is up to date', { version: info.version });
    sendToRenderer('update:not-available', { version: info.version });
    sendToRenderer('update:status', 'App is up to date');
  });

  // ----- Event: Download progress -----
  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    const speedMB = (progress.bytesPerSecond / (1024 * 1024)).toFixed(1);
    const transferredMB = (progress.transferred / (1024 * 1024)).toFixed(1);
    const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
    log('INFO', `Download progress: ${percent}%`, { speedMB, transferredMB, totalMB });
    sendToRenderer('update:progress', {
      percent,
      speed: speedMB,
      transferred: transferredMB,
      total: totalMB,
    });
    sendToRenderer('update:status', `Downloading: ${percent}% (${transferredMB}/${totalMB} MB)`);
  });

  // ----- Event: Downloaded -----
  autoUpdater.on('update-downloaded', (info) => {
    log('INFO', 'Update downloaded, installing automatically', { version: info.version });
    sendToRenderer('update:downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes || '',
    });
    sendToRenderer('update:status', `Update v${info.version} downloaded. Restarting in 5s...`);
    // Auto-install: restart after 5 seconds
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 5000);
  });

  // ----- Event: Error -----
  autoUpdater.on('error', (err) => {
    updateRetryCount++;
    log('ERROR', 'Auto-update error', {
      message: err.message,
      stack: err.stack,
      retryCount: updateRetryCount,
    });
    sendToRenderer('update:error', {
      message: err.message,
      retryCount: updateRetryCount,
      willRetry: updateRetryCount < MAX_UPDATE_RETRIES,
    });
    sendToRenderer('update:status', `Update error: ${err.message}`);

    // Retry with backoff if we haven't exceeded max retries
    if (updateRetryCount < MAX_UPDATE_RETRIES) {
      const delay = RETRY_DELAY * updateRetryCount;
      log('INFO', `Will retry update check in ${delay / 1000}s`);
      setTimeout(() => {
        log('INFO', `Retrying update check (attempt ${updateRetryCount + 1})`);
        autoUpdater.checkForUpdates().catch(() => {});
      }, delay);
    }
  });

  // ----- Periodic checks -----
  setInterval(() => {
    log('INFO', 'Periodic update check');
    autoUpdater.checkForUpdates().catch(() => {});
  }, UPDATE_CHECK_INTERVAL);

  // ----- Initial check after launch -----
  setTimeout(() => {
    log('INFO', 'Initial update check');
    autoUpdater.checkForUpdates().catch(() => {});
  }, INITIAL_CHECK_DELAY);
}

function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

// ===== WINDOW CREATION =====
function createWindow() {
  log('INFO', 'Creating main window', { isDev, version: app.getVersion() });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: `PathLab Pro v${require('../package.json').version}`,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Disabled to allow fs/path in preload for file operations
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false,
    autoHideMenuBar: true,
  });

  // Load the appropriate URL
  const loadURL = isDev ? DEV_URL : PRODUCTION_URL;
  log('INFO', 'Loading URL', { url: loadURL });
  mainWindow.loadURL(loadURL);

  // Log page load errors (network issues on client machines)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log('ERROR', 'Page failed to load', { errorCode, errorDescription, url: validatedURL });
    // Show a user-friendly error page
    mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;">
        <div style="text-align:center;max-width:400px;">
          <h2 style="color:#ef4444;">Connection Error</h2>
          <p style="color:#64748b;">Could not connect to PathLab Pro server.</p>
          <p style="color:#64748b;font-size:14px;">Error: ${errorDescription} (${errorCode})</p>
          <p style="color:#94a3b8;font-size:13px;">Check your internet connection and try again.</p>
          <button onclick="location.href='${loadURL}'" style="margin-top:16px;padding:10px 24px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;">
            Retry
          </button>
          <br/><br/>
          <button onclick="location.href='mailto:support@pathlabpro.com?subject=Connection Error&body=Error: ${errorDescription} (${errorCode})'" style="padding:6px 16px;background:none;color:#3b82f6;border:1px solid #3b82f6;border-radius:6px;cursor:pointer;font-size:13px;">
            Contact Support
          </button>
        </div>
      </body></html>
    `)}`);
  });

  // Capture renderer console errors
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // level: 0=verbose, 1=info, 2=warning, 3=error
    if (level >= 2) {
      const lvl = level === 3 ? 'ERROR' : 'WARN';
      log(lvl, `[Renderer] ${message}`, { line, source: sourceId });
    }
  });

  // Capture renderer crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log('FATAL', 'Renderer process crashed', details);
  });

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    log('INFO', 'Window shown');
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Hidden DevTools shortcut for production debugging (Ctrl+Shift+F12)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      log('INFO', 'DevTools toggled via shortcut');
    }
  });

  // Handle external links and popups
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow whatsapp:// protocol
    if (url.startsWith('whatsapp://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    // Allow popups for app domain (needed for print windows)
    if (url.includes('patholabpro.online') || url.includes('localhost') || url === 'about:blank') {
      return { action: 'allow' };
    }
    // External URLs - open in default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Handle navigation - keep within app domain
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = [PRODUCTION_URL, DEV_URL, 'http://localhost'];
    const isAllowed = allowed.some(base => url.startsWith(base));
    if (!isAllowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    log('INFO', 'Main window closed');
  });

  // Setup auto-updater after window is ready
  setupAutoUpdater();
}

// Single instance lock - prevent multiple windows
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ===== IPC: APP INFO =====
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPath', (event, name) => {
  return app.getPath(name); // 'downloads', 'documents', 'desktop', etc.
});

// ===== IPC: FILE OPERATIONS =====
ipcMain.handle('file:saveDialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options.defaultPath || '',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    title: options.title || 'Save File',
  });
  return result; // { canceled, filePath }
});

ipcMain.handle('file:openDialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: options.defaultPath || '',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: options.properties || ['openFile'],
    title: options.title || 'Open File',
  });
  return result; // { canceled, filePaths }
});

ipcMain.handle('file:write', async (event, { filePath, data, encoding }) => {
  try {
    // data can be a base64 string (for binary) or a utf8 string
    const buffer = encoding === 'base64' ? Buffer.from(data, 'base64') : data;
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:read', async (event, { filePath, encoding }) => {
  try {
    const data = fs.readFileSync(filePath, encoding || 'utf8');
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('file:openInExplorer', async (event, filePath) => {
  shell.showItemInFolder(filePath);
  return true;
});

// ===== IPC: PRINTER ACCESS =====
ipcMain.handle('printer:list', async () => {
  return mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('printer:print', async (event, options) => {
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options.silent || false,
        printBackground: options.printBackground !== false,
        deviceName: options.printerName || '',
        copies: options.copies || 1,
        margins: options.margins || { marginType: 'default' },
        landscape: options.landscape || false,
        pageSize: options.pageSize || 'A4',
        scaleFactor: options.scaleFactor || 100,
      },
      (success, errorType) => {
        resolve({ success, errorType });
      }
    );
  });
});

ipcMain.handle('printer:printPDF', async (event, { pdfBase64, printerName, copies, silent }) => {
  // Print a PDF buffer to a specific printer (for barcode/label printers)
  const tempPath = path.join(app.getPath('temp'), `print_${Date.now()}.pdf`);
  try {
    fs.writeFileSync(tempPath, Buffer.from(pdfBase64, 'base64'));

    // Create a hidden window to print the PDF
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await printWin.loadURL(`file://${tempPath}`);

    return new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: silent !== false,
          deviceName: printerName || '',
          copies: copies || 1,
          printBackground: true,
        },
        (success, errorType) => {
          printWin.close();
          // Clean up temp file
          try { fs.unlinkSync(tempPath); } catch (e) {}
          resolve({ success, errorType });
        }
      );
    });
  } catch (err) {
    try { fs.unlinkSync(tempPath); } catch (e) {}
    return { success: false, errorType: err.message };
  }
});

// ===== IPC: LOCAL PDF GENERATION (instant, no server needed) =====
// Convert image URLs to base64 data URIs so they load in offline/data: context
function embedImagesAsBase64(html) {
  const publicDir = path.join(__dirname, '..', 'dist');
  // Replace src="http://.../<filename>.png" or src="/<filename>.png" with base64
  return html.replace(/src="(?:https?:\/\/[^"]*?\/)?([^"\/]+\.(png|jpg|jpeg|gif|svg))"/gi, (match, filename, ext) => {
    try {
      const imgPath = path.join(publicDir, filename);
      if (fs.existsSync(imgPath)) {
        const data = fs.readFileSync(imgPath);
        const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        return `src="data:${mimeType};base64,${data.toString('base64')}"`;
      }
      // Also check in public folder (for dev)
      const pubPath = path.join(__dirname, '..', 'public', filename);
      if (fs.existsSync(pubPath)) {
        const data = fs.readFileSync(pubPath);
        const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        return `src="data:${mimeType};base64,${data.toString('base64')}"`;
      }
    } catch (e) { /* ignore, keep original */ }
    return match;
  });
}

ipcMain.handle('pdf:generate', async (event, { html, fileName }) => {
  try {
    const processedHtml = embedImagesAsBase64(html);
    const pdfWin = new BrowserWindow({
      show: false,
      width: 794,  // A4 width in px at 96dpi
      height: 1123, // A4 height in px at 96dpi
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    // Load HTML content directly
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(processedHtml)}`);

    // Wait for images/fonts to load
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    pdfWin.close();

    // Return as base64
    return { success: true, data: pdfBuffer.toString('base64'), fileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Generate PDF and save directly to Downloads folder
ipcMain.handle('pdf:generateAndSave', async (event, { html, fileName }) => {
  try {
    const processedHtml = embedImagesAsBase64(html);
    const pdfWin = new BrowserWindow({
      show: false,
      width: 794,
      height: 1123,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(processedHtml)}`);
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    pdfWin.close();

    // Save to Downloads folder
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, fileName || 'report.pdf');
    fs.writeFileSync(filePath, pdfBuffer);

    return { success: true, filePath, data: pdfBuffer.toString('base64') };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Print page directly without dialog
ipcMain.handle('pdf:printDirect', async (event, { html, printerName, copies, silent }) => {
  try {
    const printWin = new BrowserWindow({
      show: false,
      width: 794,
      height: 1123,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise(resolve => setTimeout(resolve, 500));

    return new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: silent !== false,
          printBackground: true,
          deviceName: printerName || '',
          copies: copies || 1,
          pageSize: 'A4',
        },
        (success, errorType) => {
          printWin.close();
          resolve({ success, errorType });
        }
      );
    });
  } catch (err) {
    return { success: false, errorType: err.message };
  }
});

// ===== IPC: AUTO-UPDATE =====
ipcMain.handle('update:check', async () => {
  if (isDev) return { updateAvailable: false, message: 'Updates disabled in dev mode' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { updateAvailable: !!result?.updateInfo, info: result?.updateInfo };
  } catch (err) {
    return { updateAvailable: false, error: err.message };
  }
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ===== IPC: SHELL =====
ipcMain.handle('shell:openExternal', async (event, url) => {
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('shell:openPath', async (event, filePath) => {
  const result = await shell.openPath(filePath);
  return result; // empty string on success, error message on failure
});

// Copy file to Windows clipboard (so user can Ctrl+V in WhatsApp)
ipcMain.handle('shell:copyFileToClipboard', async (event, filePath) => {
  try {
    const { execSync } = require('child_process');
    // PowerShell command to copy file to clipboard
    const psCmd = `Set-Clipboard -Path "${filePath.replace(/"/g, '`"')}"`;
    execSync(`powershell -Command "${psCmd}"`, { timeout: 5000 });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ===== IPC: LOGGING & DIAGNOSTICS =====

// Log from renderer process
ipcMain.handle('log:write', (event, { level, message, data }) => {
  log(level || 'INFO', `[Renderer] ${message}`, data);
  return true;
});

// Get all log files
ipcMain.handle('log:getFiles', () => {
  ensureLogDir();
  try {
    return fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const stats = fs.statSync(path.join(LOG_DIR, f));
        return { name: f, size: stats.size, modified: stats.mtime.toISOString() };
      })
      .sort((a, b) => b.modified.localeCompare(a.modified));
  } catch (e) {
    return [];
  }
});

// Read a specific log file
ipcMain.handle('log:read', (event, fileName) => {
  try {
    const filePath = path.join(LOG_DIR, path.basename(fileName)); // prevent path traversal
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return `Error reading log: ${e.message}`;
  }
});

// Open logs folder in Explorer (client can zip and send)
ipcMain.handle('log:openFolder', () => {
  ensureLogDir();
  shell.openPath(LOG_DIR);
  return LOG_DIR;
});

// Export all logs to a single file on Desktop
ipcMain.handle('log:export', async () => {
  ensureLogDir();
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(app.getPath('desktop'), `PathLabPro-logs-${new Date().toISOString().split('T')[0]}.txt`),
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
      title: 'Export Logs',
    });
    if (result.canceled) return { success: false, canceled: true };

    const logFiles = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .sort();
    let combined = `PathLab Pro Diagnostic Logs\nVersion: ${app.getVersion()}\nExported: ${new Date().toISOString()}\nOS: ${process.platform} ${process.arch}\n${'='.repeat(60)}\n\n`;
    for (const f of logFiles) {
      combined += `\n--- ${f} ---\n`;
      combined += fs.readFileSync(path.join(LOG_DIR, f), 'utf8');
    }
    fs.writeFileSync(result.filePath, combined);
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Get system diagnostics
ipcMain.handle('diagnostics:info', () => {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    osVersion: require('os').release(),
    totalMemory: Math.round(require('os').totalmem() / (1024 * 1024 * 1024) * 10) / 10 + ' GB',
    freeMemory: Math.round(require('os').freemem() / (1024 * 1024 * 1024) * 10) / 10 + ' GB',
    logDir: LOG_DIR,
    userData: app.getPath('userData'),
  };
});
