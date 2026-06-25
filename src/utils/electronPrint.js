/**
 * Electron-optimized print and PDF utilities.
 * 
 * When running in Electron:
 *   - Print: sends HTML to main process → prints directly (no popup)
 *   - PDF: generates locally via printToPDF → instant File object
 *   - WhatsApp: generates PDF locally → saves to Downloads → opens WhatsApp
 * 
 * When running in web browser:
 *   - Falls back to existing popup-based print/PDF logic
 *   - Falls back to /api/pdf server endpoint for WhatsApp sharing
 */

import { isElectron, generatePDFLocal, generateAndSavePDF } from './electron';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import PrintableReport from '../components/PrintableReport';

// Render report data to HTML string (no DOM ref needed)
export function renderReportToHTML(reportData, mode = 'pdf', layoutSettings = null) {
  if (!reportData) return null;
  return renderToStaticMarkup(createElement(PrintableReport, { report: reportData, mode, layoutSettings }));
}

// Build the full HTML document for print/PDF
// Accepts EITHER a DOM element (reportElement) OR raw HTML string (rawHTML)
export function buildPrintHTML(reportElementOrHTML, { patientName = 'Report', mode = 'print', letterheadUrl = '', layoutSettings = null } = {}) {
  // Get the inner HTML content
  let bodyContent;
  if (typeof reportElementOrHTML === 'string') {
    bodyContent = reportElementOrHTML;
  } else if (reportElementOrHTML && reportElementOrHTML.outerHTML) {
    bodyContent = reportElementOrHTML.outerHTML;
  } else {
    return null;
  }

  const isPdf = mode === 'pdf';
  const ls = layoutSettings || {};
  const padL = ls.bodyPaddingLeft ?? 10;
  const padR = ls.bodyPaddingRight ?? 10;
  const lhHeight = ls.letterheadHeight ?? 140;
  const footerBottom = isPdf ? `${ls.footerBottomOffset ?? 5}mm` : '25px';
  const bodyFontSize = ls.bodyFontSize ?? 12;
  const letterheadImg = letterheadUrl
    ? `<img class="letterhead-bg" src="${letterheadUrl}" />`
    : '';

  return `<html>
    <head>
      <title>${patientName} - Lab Report</title>
      <meta charset="utf-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        @page { margin: 0; size: A4; }
        html, body { height: 100%; margin: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; padding: 0 ${padL}mm 0 ${padR}mm; color: #000; font-size: ${bodyFontSize}px; width: 210mm; min-width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        table { border-collapse: collapse; width: 100%; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        thead td, tfoot td { padding: 0; }
        .page-footer { position: fixed; bottom: ${footerBottom}; left: 0; right: 0; z-index: 2; background: #fff; }
        .hindi-footer { font-family: 'Noto Sans Devanagari', sans-serif !important; }
        ${letterheadUrl ? `.letterhead-bg { position: fixed; top: 0; left: 0; width: 210mm; height: ${lhHeight}px; z-index: -1; object-fit: cover; object-position: top; -webkit-print-color-adjust: exact; print-color-adjust: exact; }` : ''}
      </style>
    </head>
    <body>${letterheadImg}${bodyContent}</body>
  </html>`;
}

// Print directly in Electron (no popup needed)
export async function electronPrint(reportElement, { patientName = 'Report' } = {}) {
  if (!isElectron()) return false;
  const html = buildPrintHTML(reportElement, { patientName, mode: 'print' });
  if (!html) return false;
  const result = await window.electronAPI.pdf.printDirect(html, { silent: false });
  return result.success;
}

// Generate PDF file locally in Electron (returns File object)
// Accepts DOM element OR raw HTML string
export async function electronGeneratePDF(reportElementOrHTML, { patientName = 'Report', letterheadUrl = '', fileName = 'report.pdf', layoutSettings = null } = {}) {
  if (!isElectron()) return null;
  const html = buildPrintHTML(reportElementOrHTML, { patientName, mode: 'pdf', letterheadUrl, layoutSettings });
  if (!html) return null;
  return generatePDFLocal(html, fileName);
}

// Generate PDF and save to Downloads folder (returns file path)
// Accepts DOM element OR raw HTML string
export async function electronSavePDF(reportElementOrHTML, { patientName = 'Report', letterheadUrl = '', fileName = 'report.pdf', layoutSettings = null } = {}) {
  if (!isElectron()) return null;
  const html = buildPrintHTML(reportElementOrHTML, { patientName, mode: 'pdf', letterheadUrl, layoutSettings });
  if (!html) return null;
  return generateAndSavePDF(html, fileName);
}

// WhatsApp share in Electron: generate PDF → copy to clipboard → open WhatsApp
// User presses Ctrl+V in WhatsApp chat to attach the PDF (closest to mobile share on desktop)
export async function electronShareWhatsApp(reportElementOrHTML, { patientName = 'Report', letterheadUrl = '', fileName = 'report.pdf', phone = '', layoutSettings = null } = {}) {
  if (!isElectron()) return null;
  // Generate and save PDF to Downloads
  const filePath = await electronSavePDF(reportElementOrHTML, { patientName, letterheadUrl, fileName, layoutSettings });
  if (!filePath) return null;

  // Copy PDF to clipboard so user can Ctrl+V in WhatsApp
  let clipboardOk = false;
  if (window.electronAPI.shell.copyFileToClipboard) {
    const result = await window.electronAPI.shell.copyFileToClipboard(filePath);
    clipboardOk = result?.success;
  }

  // Format phone: strip spaces/dashes, ensure country code (default +91 for India)
  let cleanPhone = (phone || '').replace(/[\s\-()]/g, '');
  if (cleanPhone && !cleanPhone.startsWith('+') && !cleanPhone.startsWith('00')) {
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone; // India country code
    }
  }

  // Open WhatsApp with contact — try desktop app first, then web
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}`
    : `https://web.whatsapp.com/`;
  window.electronAPI.shell.openExternal(whatsappUrl);

  return { filePath, clipboardOk };
}
