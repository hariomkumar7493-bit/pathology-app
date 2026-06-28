/**
 * Electron API utilities for the React app.
 * 
 * These functions are safe to call in both web and Electron environments.
 * They check for `window.electronAPI` before attempting native operations.
 * 
 * Usage:
 *   import { isElectron, getPrinters, printPDF, saveFile } from '../utils/electron';
 */

// Check if running inside Electron
export const isElectron = () => !!(window.electronAPI && window.electronAPI.isElectron);

// Get the correct base URL for public assets (works with http://, https://, and file://)
export const getAssetUrl = (fileName) => {
  if (isElectron()) {
    // In Electron, the app is loaded from file:// and assets are in the same folder
    return `./${fileName}`;
  }
  return `${window.location.origin}/${fileName}`;
};

// Get app version (returns null in web)
export const getAppVersion = async () => {
  if (!isElectron()) return null;
  return window.electronAPI.getVersion();
};

// ===== LOCAL PDF GENERATION (instant in Electron, no server roundtrip) =====

// Generate PDF from HTML string — returns base64 PDF data
export const generatePDFLocal = async (html, fileName = 'report.pdf') => {
  if (!isElectron()) return null; // Fallback to server in web
  const result = await window.electronAPI.pdf.generate(html, fileName);
  if (!result.success) throw new Error(result.error);
  // Convert base64 to Blob
  const byteChars = atob(result.data);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  return new File([byteArray], fileName, { type: 'application/pdf' });
};

// Generate PDF and save to Downloads folder — returns file path
export const generateAndSavePDF = async (html, fileName = 'report.pdf') => {
  if (!isElectron()) return null;
  const result = await window.electronAPI.pdf.generateAndSave(html, fileName);
  if (!result.success) throw new Error(result.error);
  return result.filePath;
};

// Print HTML directly to printer (silent, no dialog)
export const printDirect = async (html, options = {}) => {
  if (!isElectron()) {
    // Web fallback: use window.print()
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      setTimeout(() => printWin.print(), 400);
    }
    return { success: true };
  }
  return window.electronAPI.pdf.printDirect(html, options);
};

// ===== PRINTER FUNCTIONS =====

// Get list of available printers
export const getPrinters = async () => {
  if (!isElectron()) return [];
  return window.electronAPI.printer.list();
};

// Print current page to a specific printer
export const printPage = async (options = {}) => {
  if (!isElectron()) {
    window.print();
    return { success: true };
  }
  return window.electronAPI.printer.print(options);
};

// Print a PDF (base64) directly to a printer (e.g., barcode/label printer)
export const printPDF = async ({ pdfBase64, printerName, copies = 1, silent = true }) => {
  if (!isElectron()) return { success: false, errorType: 'Not in Electron' };
  return window.electronAPI.printer.printPDF({ pdfBase64, printerName, copies, silent });
};

// ===== FILE OPERATIONS =====

// Save a file with native dialog
export const saveFile = async (data, options = {}) => {
  if (!isElectron()) {
    // Web fallback: trigger download
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options.defaultPath || 'file';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { success: true, filePath: null };
  }

  const result = await window.electronAPI.file.saveDialog({
    defaultPath: options.defaultPath || '',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    title: options.title || 'Save File',
  });

  if (result.canceled) return { success: false, canceled: true };

  // Write the file
  let fileData = data;
  let encoding = 'utf8';
  if (data instanceof Blob || data instanceof ArrayBuffer) {
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    fileData = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    encoding = 'base64';
  }

  const writeResult = await window.electronAPI.file.write(result.filePath, fileData, encoding);
  if (writeResult.success) {
    return { success: true, filePath: result.filePath };
  }
  return { success: false, error: writeResult.error };
};

// Save a PDF blob to a user-chosen location
export const savePDF = async (pdfBlob, defaultFileName = 'report.pdf') => {
  return saveFile(pdfBlob, {
    defaultPath: defaultFileName,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    title: 'Save PDF Report',
  });
};

// Open file in explorer/finder
export const showInFolder = async (filePath) => {
  if (!isElectron()) return;
  return window.electronAPI.file.openInExplorer(filePath);
};

// ===== AUTO-UPDATE =====

// Check for updates manually
export const checkForUpdates = async () => {
  if (!isElectron()) return { updateAvailable: false };
  return window.electronAPI.update.check();
};

// Install downloaded update (restarts app)
export const installUpdate = () => {
  if (!isElectron()) return;
  window.electronAPI.update.install();
};

// Subscribe to update events (returns cleanup function)
export const onUpdateStatus = (callback) => {
  if (!isElectron()) return () => {};
  return window.electronAPI.update.onStatus(callback);
};

export const onUpdateDownloaded = (callback) => {
  if (!isElectron()) return () => {};
  return window.electronAPI.update.onDownloaded(callback);
};

export const onUpdateProgress = (callback) => {
  if (!isElectron()) return () => {};
  return window.electronAPI.update.onProgress(callback);
};

// ===== SHELL =====

export const openExternal = async (url) => {
  if (!isElectron()) {
    window.open(url, '_blank');
    return;
  }
  return window.electronAPI.shell.openExternal(url);
};
