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
export function renderReportToHTML(reportData) {
  if (!reportData) return null;
  return renderToStaticMarkup(createElement(PrintableReport, { report: reportData, mode: 'pdf' }));
}

// Build the full HTML document for print/PDF
// Accepts EITHER a DOM element (reportElement) OR raw HTML string (rawHTML)
export function buildPrintHTML(reportElementOrHTML, { patientName = 'Report', mode = 'print', letterheadUrl = '' } = {}) {
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
  const letterheadImg = letterheadUrl
    ? `<img class="letterhead-bg" src="${letterheadUrl}" />`
    : '';

  return `<html>
    <head>
      <title>${patientName} - Lab Report</title>
      <style>
        @page { margin: 0; size: A4; }
        html, body { height: 100%; margin: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; padding: 0 10mm; color: #000; font-size: 12px; width: 210mm; min-width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        table { border-collapse: collapse; width: 100%; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        thead td, tfoot td { padding: 0; }
        .page-header { position: fixed; top: 0; left: 0; right: 0; z-index: 2; background: #fff; }
        .page-footer { position: fixed; bottom: ${isPdf ? '0' : '25px'}; left: 0; right: 0; z-index: 2; background: #fff; }
        ${letterheadUrl ? `.letterhead-bg { position: fixed; top: 0; left: 0; width: 210mm; height: 140px; z-index: -1; object-fit: cover; object-position: top; -webkit-print-color-adjust: exact; print-color-adjust: exact; }` : ''}
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
export async function electronGeneratePDF(reportElementOrHTML, { patientName = 'Report', letterheadUrl = '', fileName = 'report.pdf' } = {}) {
  if (!isElectron()) return null;
  const html = buildPrintHTML(reportElementOrHTML, { patientName, mode: 'pdf', letterheadUrl });
  if (!html) return null;
  return generatePDFLocal(html, fileName);
}

// Generate PDF and save to Downloads folder (returns file path)
// Accepts DOM element OR raw HTML string
export async function electronSavePDF(reportElementOrHTML, { patientName = 'Report', letterheadUrl = '', fileName = 'report.pdf' } = {}) {
  if (!isElectron()) return null;
  const html = buildPrintHTML(reportElementOrHTML, { patientName, mode: 'pdf', letterheadUrl });
  if (!html) return null;
  return generateAndSavePDF(html, fileName);
}

// WhatsApp share in Electron: save PDF to Downloads → open WhatsApp
export async function electronShareWhatsApp(reportElementOrHTML, { patientName = 'Report', letterheadUrl = '', fileName = 'report.pdf', phone = '' } = {}) {
  if (!isElectron()) return null;
  // Generate and save PDF to Downloads
  const filePath = await electronSavePDF(reportElementOrHTML, { patientName, letterheadUrl, fileName });
  if (!filePath) return null;
  // Open WhatsApp with message
  const label = `Lab Report - ${patientName}`;
  const whatsappUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(label)}`
    : `whatsapp://send?text=${encodeURIComponent(label + '\n\nPDF saved to: ' + filePath)}`;
  window.electronAPI.shell.openExternal(whatsappUrl);
  // Open the Downloads folder so they can drag the file into WhatsApp
  window.electronAPI.shell.openPath(filePath.substring(0, filePath.lastIndexOf('\\')));
  return filePath;
}
