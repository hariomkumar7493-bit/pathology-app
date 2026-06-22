const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Production URL - your deployed web application
const PRODUCTION_URL = 'https://app.pathlabpro.com';
// Development URL - local React dev server (matches vite.config.js port)
const DEV_URL = 'http://localhost:3000';

const isDev = !app.isPackaged;

let mainWindow = null;

// ===== AUTO-UPDATER SETUP =====
function setupAutoUpdater() {
  if (isDev) return; // Skip in development

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('update:status', 'Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    sendToRenderer('update:status', `Update available: v${info.version}`);
    sendToRenderer('update:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    sendToRenderer('update:status', 'App is up to date');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('update:status', `Update v${info.version} ready. Restart to install.`);
    sendToRenderer('update:downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    sendToRenderer('update:status', `Update error: ${err.message}`);
  });

  // Check for updates every 4 hours
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
  // Initial check after 10 seconds
  setTimeout(() => autoUpdater.checkForUpdates(), 10000);
}

function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

// ===== WINDOW CREATION =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'PathLab Pro',
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
  mainWindow.loadURL(loadURL);

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Handle external links - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('whatsapp://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!url.includes('pathlabpro.com') && !url.includes('localhost')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
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
