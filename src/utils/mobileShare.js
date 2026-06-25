import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export function isMobileApp() {
  return Capacitor.isNativePlatform();
}

// Convert a Blob/File to base64 string
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Share PDF files via WhatsApp on mobile (Capacitor)
export async function mobileSharePDF(files, label) {
  if (!isMobileApp()) return false;

  try {
    const file = files[0]; // Handle first file (single report share)
    const base64Data = await blobToBase64(file);
    const fileName = file.name || 'report.pdf';

    // Write file to temporary directory
    const writeFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    // Share the file
    await Share.share({
      title: label || 'Lab Report',
      text: label || 'Lab Report',
      url: writeFile.uri,
      dialogTitle: 'Share Report',
    });

    return true;
  } catch (err) {
    if (err.message?.includes('cancel') || err.message?.includes('Abort')) {
      return true; // User cancelled, not an error
    }
    console.error('mobileSharePDF error:', err);
    throw err;
  }
}

// Share multiple PDF files via WhatsApp on mobile
export async function mobileShareMultiplePDFs(files, label) {
  if (!isMobileApp()) return false;

  try {
    // For multiple files, share them one by one (Capacitor Share doesn't support arrays)
    // Or just share the first one with a note
    if (files.length === 1) {
      return mobileSharePDF(files, label);
    }

    // Multiple files: share first, user can share rest later
    // Capacitor doesn't support sharing multiple files at once
    for (const file of files) {
      const base64Data = await blobToBase64(file);
      const fileName = file.name || 'report.pdf';

      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });
    }

    // Share first file
    const firstFile = files[0];
    const base64Data = await blobToBase64(firstFile);
    const fileName = firstFile.name || 'report.pdf';
    const writeFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    await Share.share({
      title: label || 'Lab Reports',
      text: `${label || 'Lab Reports'} (1 of ${files.length})`,
      url: writeFile.uri,
      dialogTitle: 'Share Report',
    });

    return true;
  } catch (err) {
    if (err.message?.includes('cancel') || err.message?.includes('Abort')) {
      return true;
    }
    console.error('mobileShareMultiplePDFs error:', err);
    throw err;
  }
}

// Download PDF and open with external app on mobile
export async function mobileOpenPDF(blob, fileName) {
  if (!isMobileApp()) return false;

  try {
    const base64Data = await blobToBase64(blob);
    fileName = fileName || 'report.pdf';

    const writeFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    // Use Share API to open the file — shows app chooser (PDF viewer, printer, etc.)
    await Share.share({
      title: fileName,
      url: writeFile.uri,
      dialogTitle: 'Open PDF with',
    });

    return true;
  } catch (err) {
    if (err.message?.includes('cancel') || err.message?.includes('Abort')) {
      return true;
    }
    console.error('mobileOpenPDF error:', err);
    throw err;
  }
}
