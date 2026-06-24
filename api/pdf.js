import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Build the exact same HTML as the frontend PDF download
function buildReportHtml(report, letterheadUrl, layoutSettings = null) {
  const ls = layoutSettings || {};
  const DEFAULT_LAYOUT = {
    letterheadHeight: 140,
    headerTopPadding: 0,
    headerBottomPadding: 6,
    titleFontSize: 14,
    patientInfoFontSize: 11,
    bodyFontSize: 12,
    resultFontSize: 11,
    bodyPaddingLeft: 10,
    bodyPaddingRight: 10,
    contentTopMargin: 5,
    footerHeight: 130,
    footerBottomOffset: 5,
    showSignature: true,
    signatureHeight: 13,
    doctorName: '',
    doctorDesignation: '',
    footerNote1: 'Result of tests may vary from Lab to Lab and also in some parameters from time to time for the same patient',
    footerNote2: 'The Report is not valid for medico legal purpose',
    showHindiFooter: true,
    hindiFooterText: '(होम कलेक्शन फ्री उपलब्ध है) यहा पर सभी प्रकार पैथोलोजिकल जाँच की सुविधा उपलब्ध है. मो. - 9835310931',
    hindiFooterBgColor: '#8B0000',
    colTestWidth: 45,
    colResultWidth: 25,
    colRefWidth: 30,
  };
  const l = { ...DEFAULT_LAYOUT, ...ls };
  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const groupedByCategory = {};
  (report.results || []).forEach((r) => {
    const catKey = r.category_name || 'General';
    const groupKey = r.group_name || '';
    if (!groupedByCategory[catKey]) groupedByCategory[catKey] = {};
    if (!groupedByCategory[catKey][groupKey]) groupedByCategory[catKey][groupKey] = [];
    groupedByCategory[catKey][groupKey].push(r);
  });

  const specimens = [...new Set((report.results || []).map(r => r.specimen).filter(Boolean))];

  const getRefDisplay = (param) => {
    const m = param.ref_range_male;
    const f = param.ref_range_female;
    if (m && f && m !== f) return `${m} (M) / ${f} (F)`;
    return m || f || '';
  };

  const invLen = (report.investigation || '').length;
  const extraLines = Math.max(0, Math.ceil(invLen / 80) - 1);
  const HEADER_H = l.letterheadHeight + 135 + (extraLines * 14);
  const FOOTER_H = l.footerHeight;

  // Build results HTML
  let resultsHtml = '';
  for (const [catName, groups] of Object.entries(groupedByCategory)) {
    const catHasValues = Object.values(groups).some(params =>
      params.some(p => p.result_value && p.result_value.toString().trim() !== '')
    );
    if (!catHasValues) continue;

    resultsHtml += `<tr><td style="text-align:center;padding-top:10px;padding-bottom:4px;font-weight:bold;font-size:12px;border-bottom:1px solid #333;">${catName.toUpperCase()} REPORT</td></tr>`;

    for (const [groupName, params] of Object.entries(groups)) {
      const filledParams = params.filter(p => p.result_value && p.result_value.toString().trim() !== '');
      if (filledParams.length === 0) continue;

      if (groupName) {
        resultsHtml += `<tr><td style="padding-top:6px;padding-left:6px;font-weight:bold;font-size:11px;color:#333;">${groupName}</td></tr>`;
      }

      for (const param of filledParams) {
        const isAbn = param.is_abnormal;
        const resultUnit = [param.result_value, param.unit].filter(Boolean).join(' ');
        const rowBold = isAbn ? 'bold' : 'normal';
        const rowColor = isAbn ? '#c00' : '#000';
        const refColor = isAbn ? rowColor : '#555';
        resultsHtml += `<tr style="border-bottom:1px dotted #ccc;font-weight:${rowBold};color:${rowColor};font-size:${l.resultFontSize}px;">
          <td style="padding:3px 6px 3px 12px;">
            <div style="display:flex;">
              <span style="width:${l.colTestWidth}%;">${param.param_name}</span>
              <span style="width:${l.colResultWidth}%;text-align:center;">${resultUnit}</span>
              <span style="width:${l.colRefWidth}%;text-align:center;color:${refColor};">${getRefDisplay(param)}</span>
            </div>
          </td>
        </tr>`;
      }
    }
  }

  const signatureUrl = letterheadUrl.replace('/letterhead.png', '/doctor-sign.png');

  return `<!DOCTYPE html>
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap" rel="stylesheet">
<style>
  @page { margin: 0; size: A4; }
  html, body { height: 100%; margin: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; padding: 0 ${l.bodyPaddingLeft}mm 0 ${l.bodyPaddingRight}mm; color: #000; font-size: ${l.bodyFontSize}px; width: 210mm; min-width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  thead td, tfoot td { padding: 0; border: none; }
  .page-header { position: fixed; top: 0; left: 0; right: 0; z-index: 2; }
  .page-footer { position: fixed; bottom: ${l.footerBottomOffset}mm; left: 0; right: 0; z-index: 2; }
  .letterhead-bg { position: fixed; top: 0; left: 0; width: 210mm; height: ${l.letterheadHeight}px; z-index: -1; object-fit: cover; object-position: top; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>
<img class="letterhead-bg" src="${letterheadUrl}" />

<div style="font-family:'Times New Roman',serif;color:#000;font-size:${l.bodyFontSize}px;line-height:1.5;width:100%;">
  <!-- HEADER -->
  <div class="page-header" style="height:${HEADER_H}px;">
    <div style="height:${l.letterheadHeight}px;padding-top:${l.headerTopPadding}px;"></div>
    <div style="text-align:center;font-size:${l.titleFontSize}px;font-weight:bold;margin-bottom:${l.headerBottomPadding}px;text-decoration:underline;letter-spacing:1px;">LABORATORY INVESTIGATION REPORT</div>
    <div style="font-size:${l.patientInfoFontSize}px;margin-bottom:${l.headerBottomPadding}px;">
      <div style="display:flex;justify-content:space-between;">
        <span style="width:${l.colTestWidth}%;"><strong>Patient Name</strong> : ${report.patient_name || ''}</span>
        <span style="width:${l.colResultWidth}%;text-align:center;"><strong>Age/Sex</strong> : ${report.age || ''} Yrs/${(report.gender || '')[0] || ''}</span>
        <span style="width:${l.colRefWidth}%;text-align:left;"><strong>Date of Collection</strong> : ${formatDate(report.date_of_collection)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="width:${l.colTestWidth}%;"><strong>Ref. by</strong> : ${report.referred_by || 'SELF'}</span>
        <span style="width:${l.colResultWidth}%;"></span>
        <span style="width:${l.colRefWidth}%;text-align:left;"><strong>Date of Reporting</strong> : ${formatDate(report.date_of_reporting || report.created_at)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="width:${l.colTestWidth}%;"><strong>Specimen</strong> : ${specimens.join(', ') || report.specimen || 'BLOOD'}</span>
        <span style="width:${l.colResultWidth}%;"></span>
        <span style="width:${l.colRefWidth}%;text-align:left;"><strong>Ref No</strong> : ${report.ref_no || ''}</span>
      </div>
      ${report.investigation ? `<div><strong>Investigation</strong> : ${report.investigation}</div>` : ''}
    </div>
    <div style="display:flex;border-top:2px solid #000;border-bottom:2px solid #000;font-weight:bold;font-size:${l.resultFontSize}px;">
      <div style="width:${l.colTestWidth}%;padding:4px 6px;">Test Description</div>
      <div style="width:${l.colResultWidth}%;padding:4px 6px;text-align:center;">RESULT/UNIT</div>
      <div style="width:${l.colRefWidth}%;padding:4px 6px;text-align:center;">REF. RANGE</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="page-footer" style="height:${FOOTER_H}px;">
    <div style="text-align:right;padding-right:20px;margin-bottom:8px;">
      <div style="display:inline-block;text-align:left;">
        ${l.showSignature ? `<img src="${signatureUrl}" alt="signature" style="height:${l.signatureHeight}px;display:block;margin-left:25px;object-fit:contain;" />` : ''}
        <p style="font-weight:bold;font-size:13px;margin:0;text-decoration:underline;">${l.doctorName || report.doctor_name || 'DR. C. ASHOK'}</p>
        <p style="font-size:11px;margin:0;">${l.doctorDesignation || report.doctor_designation || 'MBBS MD (PATH)'}</p>
        <p style="font-size:11px;margin:0;">(PATHOLOGIST)</p>
      </div>
    </div>
    <div style="border-top:1px solid #999;padding-top:3px;font-size:9px;color:#666;">
      <p style="margin:1px 0;">1. ${l.footerNote1}</p>
      <p style="margin:1px 0;">2. ${l.footerNote2}</p>
    </div>
    ${l.showHindiFooter ? `<div style="margin-top:6px;background:${l.hindiFooterBgColor};color:#fff;padding:4px 10px;font-size:9px;text-align:center;font-family:'Noto Sans Devanagari',sans-serif;">
      ${l.hindiFooterText}
    </div>` : ''}
  </div>

  <!-- TABLE with spacers -->
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr><td style="height:${HEADER_H + 5}px;padding:0;border:none;"></td></tr></thead>
    <tfoot><tr><td style="height:${FOOTER_H}px;padding:0;border:none;"></td></tr></tfoot>
    <tbody>
      ${resultsHtml}
      <tr><td style="text-align:center;padding:16px 0 8px;font-size:10px;color:#666;">------End of Report------</td></tr>
    </tbody>
  </table>
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { report, letterheadUrl, layoutSettings } = req.body;
  if (!report) {
    return res.status(400).json({ error: 'Report data is required' });
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    const html = buildReportHtml(report, letterheadUrl || 'https://placeholder.com/letterhead.png', layoutSettings);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const lsReq = layoutSettings || {};
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: `${lsReq.footerBottomOffset ?? 5}mm`, left: 0 },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.patient_name || 'Report'}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'PDF generation failed: ' + err.message });
  } finally {
    if (browser) await browser.close();
  }
}
