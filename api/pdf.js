import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Build the exact same HTML as the frontend PDF download
function buildReportHtml(report, letterheadUrl) {
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
  const HEADER_H = 275 + (extraLines * 14);
  const FOOTER_H = 130;

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
        resultsHtml += `<tr style="border-bottom:1px dotted #ccc;font-weight:${rowBold};color:${rowColor};font-size:11px;">
          <td style="padding:3px 6px 3px 12px;">
            <div style="display:flex;">
              <span style="width:45%;">${param.param_name}</span>
              <span style="width:25%;text-align:center;">${resultUnit}</span>
              <span style="width:30%;text-align:center;color:${refColor};">${getRefDisplay(param)}</span>
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
<style>
  @page { margin: 0; size: A4; }
  html, body { height: 100%; margin: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; padding: 0 10mm; color: #000; font-size: 12px; width: 210mm; min-width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  thead td, tfoot td { padding: 0; border: none; }
  .page-header { position: fixed; top: 0; left: 0; right: 0; z-index: 2; }
  .page-footer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 2; }
  .letterhead-bg { position: fixed; top: 0; left: 0; width: 210mm; height: 140px; z-index: -1; object-fit: cover; object-position: top; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>
<img class="letterhead-bg" src="${letterheadUrl}" />

<div style="font-family:'Times New Roman',serif;color:#000;font-size:12px;line-height:1.5;width:100%;">
  <!-- HEADER -->
  <div class="page-header" style="height:${HEADER_H}px;">
    <div style="height:140px;"></div>
    <div style="text-align:center;font-size:14px;font-weight:bold;margin-bottom:6px;text-decoration:underline;letter-spacing:1px;">LABORATORY INVESTIGATION REPORT</div>
    <div style="font-size:11px;margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;">
        <span style="width:45%;"><strong>Patient Name</strong> : ${report.patient_name || ''}</span>
        <span style="width:25%;text-align:center;"><strong>Age/Sex</strong> : ${report.age || ''} Yrs/${(report.gender || '')[0] || ''}</span>
        <span style="width:30%;text-align:left;"><strong>Date of Collection</strong> : ${formatDate(report.date_of_collection)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="width:45%;"><strong>Ref. by</strong> : ${report.referred_by || 'SELF'}</span>
        <span style="width:25%;"></span>
        <span style="width:30%;text-align:left;"><strong>Date of Reporting</strong> : ${formatDate(report.date_of_reporting || report.created_at)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="width:45%;"><strong>Specimen</strong> : ${specimens.join(', ') || report.specimen || 'BLOOD'}</span>
        <span style="width:25%;"></span>
        <span style="width:30%;text-align:left;"><strong>Ref No</strong> : ${report.ref_no || ''}</span>
      </div>
      ${report.investigation ? `<div><strong>Investigation</strong> : ${report.investigation}</div>` : ''}
    </div>
    <div style="display:flex;border-top:2px solid #000;border-bottom:2px solid #000;font-weight:bold;font-size:11px;">
      <div style="width:45%;padding:4px 6px;">Test Description</div>
      <div style="width:25%;padding:4px 6px;text-align:center;">RESULT/UNIT</div>
      <div style="width:30%;padding:4px 6px;text-align:center;">REF. RANGE</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="page-footer" style="height:${FOOTER_H}px;">
    <div style="text-align:right;padding-right:20px;margin-bottom:8px;">
      <img src="${signatureUrl}" alt="signature" style="height:13px;margin-left:auto;display:block;object-fit:contain;" />
      <p style="font-weight:bold;font-size:13px;margin:0;text-decoration:underline;">${report.doctor_name || 'DR. C. ASHOK'}</p>
      <p style="font-size:11px;margin:0;">${report.doctor_designation || 'MBBS MD (PATH)'}</p>
      <p style="font-size:11px;margin:0;">(PATHOLOGIST)</p>
    </div>
    <div style="border-top:1px solid #999;padding-top:3px;font-size:9px;color:#666;">
      <p style="margin:1px 0;">1. Result of tests may vary from Lab to Lab and also in some parameters from time to time for the same patient</p>
      <p style="margin:1px 0;">2. The Report is not valid for medico legal purpose</p>
    </div>
    <div style="margin-top:6px;background:#8B0000;color:#fff;padding:4px 10px;font-size:9px;text-align:center;">
      (होम कलेक्शन फ्री उपलब्ध है) यहा पर सभी प्रकार पैथोलोजिकल जाँच की सुविधा उपलब्ध है. मो. - 9835310931
    </div>
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

  const { report, letterheadUrl } = req.body;
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
    const html = buildReportHtml(report, letterheadUrl || 'https://placeholder.com/letterhead.png');
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
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
