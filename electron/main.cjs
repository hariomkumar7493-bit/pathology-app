const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');

// Production URL - your deployed web application
const PRODUCTION_URL = 'https://app.pathlabpro.com';
// Development URL - local React dev server (matches vite.config.js port)
const DEV_URL = 'http://localhost:3000';

const isDev = !app.isPackaged;

let mainWindow = null;

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
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false, // Show after ready-to-show to avoid flash
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
    // Allow whatsapp:// protocol
    if (url.startsWith('whatsapp://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    // Open external URLs in default browser
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

// ===== IPC Handlers (for future desktop-only features) =====

// Example: Get app version
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Example: Show save dialog (for future local file operations)
ipcMain.handle('app:showSaveDialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// Example: Show open dialog
ipcMain.handle('app:showOpenDialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Example: Get printers list (for future printer access)
ipcMain.handle('app:getPrinters', () => {
  return mainWindow.webContents.getPrintersAsync();
});

// Example: Print to specific printer (for future barcode/label printing)
ipcMain.handle('app:print', async (event, options) => {
  return new Promise((resolve) => {
    mainWindow.webContents.print(options, (success, errorType) => {
      resolve({ success, errorType });
    });
  });
});
