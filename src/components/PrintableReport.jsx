import { forwardRef, Fragment } from 'react';

const LOGO_SVG = `<svg width="65" height="65" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <circle cx="40" cy="40" r="38" fill="#f8efc0" stroke="#1a4d8f" stroke-width="2.5"/>
  <circle cx="40" cy="40" r="32" fill="none" stroke="#1a4d8f" stroke-width="1.2"/>
  <text x="40" y="19" text-anchor="middle" font-size="5.2" fill="#1a4d8f" font-weight="bold" font-family="serif">S &amp; S DIAGNOSTIC</text>
  <text x="40" y="26" text-anchor="middle" font-size="5.2" fill="#1a4d8f" font-weight="bold" font-family="serif">CENTER</text>
  <text x="40" y="50" text-anchor="middle" font-size="22" fill="#b22222" font-weight="bold" font-family="serif">S</text>
  <text x="40" y="66" text-anchor="middle" font-size="7.5" fill="#1a4d8f" font-weight="bold" font-family="serif" letter-spacing="2">RANCHI</text>
</svg>`;

const PrintableReport = forwardRef(({ report, mode = 'print' }, ref) => {
  if (!report) return null;

  const isPdf = mode === 'pdf';

  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Group results by category_name, then by group_name within each category
  const groupedByCategory = {};
  (report.results || []).forEach((r) => {
    const catKey = r.category_name || 'General';
    const groupKey = r.group_name || '';
    if (!groupedByCategory[catKey]) groupedByCategory[catKey] = {};
    if (!groupedByCategory[catKey][groupKey]) groupedByCategory[catKey][groupKey] = [];
    groupedByCategory[catKey][groupKey].push(r);
  });

  // Get unique specimens
  const specimens = [...new Set((report.results || []).map(r => r.specimen).filter(Boolean))];

  // Build ref range display
  const getRefDisplay = (param) => {
    const m = param.ref_range_male;
    const f = param.ref_range_female;
    if (m && f && m !== f) return `${m} (M) / ${f} (F)`;
    return m || f || '';
  };

  // Letterhead image URL (served from public folder)
  const letterheadUrl = '/letterhead.png';

  // Header height for spacing
  const headerHeight = '140px';

  return (
    <div ref={ref} style={{
      fontFamily: "'Times New Roman', serif",
      padding: '0', color: '#000', fontSize: '12px', lineHeight: '1.5',
      width: '100%',
    }}>
      {/* 
        Use a table layout so thead/tfoot repeat on every printed page.
        thead = letterhead spacing + patient info
        tfoot = doctor signature + disclaimer + hindi bar
        tbody = test results
      */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {/* ===== REPEATING HEADER (every page) ===== */}
        <thead>
          <tr><td colSpan="3" style={{ padding: 0 }}>
            {/* Spacing for letterhead (print: blank for pre-printed, pdf: letterhead image) */}
            <div style={{ height: headerHeight }}></div>
            {/* Title */}
            <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textDecoration: 'underline', letterSpacing: '1px' }}>
              LABORATORY INVESTIGATION REPORT
            </div>
            {/* Patient Info - using flex rows instead of nested table */}
            <div style={{ fontSize: '11px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ width: '45%' }}><strong>Patient Name</strong> : {report.patient_name || ''}</span>
                <span style={{ width: '25%', textAlign: 'center' }}><strong>Age/Sex</strong> : {report.age || ''} Yrs/{(report.gender || '')[0] || ''}</span>
                <span style={{ width: '30%', textAlign: 'right' }}><strong>Date of Collection</strong> : {formatDate(report.date_of_collection)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ width: '45%' }}><strong>Ref. by</strong> : {report.referred_by || 'SELF'}</span>
                <span style={{ width: '25%' }}></span>
                <span style={{ width: '30%', textAlign: 'right' }}><strong>Date of Reporting</strong> : {formatDate(report.date_of_reporting || report.created_at)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ width: '45%' }}><strong>Specimen</strong> : {specimens.join(', ') || report.specimen || 'BLOOD'}</span>
                <span style={{ width: '25%' }}></span>
                <span style={{ width: '30%', textAlign: 'right' }}><strong>Ref No</strong> : {report.ref_no || ''}</span>
              </div>
              <div><strong>Investigation</strong> : {report.investigation || ''}</div>
            </div>
          </td></tr>
          {/* Column headers row */}
          <tr style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
            <th style={{ width: '45%', padding: '4px 6px', fontSize: '11px', textAlign: 'left' }}>Test Description</th>
            <th style={{ width: '25%', padding: '4px 6px', fontSize: '11px', textAlign: 'center' }}>RESULT/UNIT</th>
            <th style={{ width: '30%', padding: '4px 6px', fontSize: '11px', textAlign: 'center' }}>REF. RANGE</th>
          </tr>
        </thead>

        {/* ===== REPEATING FOOTER (every page) ===== */}
        <tfoot>
          <tr><td colSpan="3" style={{ padding: 0 }}>
            {/* Doctor Signature */}
            <div style={{ textAlign: 'right', paddingRight: '20px', marginBottom: '12px', marginTop: '16px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0, textDecoration: 'underline' }}>{report.doctor_name || 'DR. C. ASHOK'}</p>
              <p style={{ fontSize: '11px', margin: 0 }}>{report.doctor_designation || 'MBBS MD (PATH)'}</p>
              <p style={{ fontSize: '11px', margin: 0 }}>(PATHOLOGIST)</p>
            </div>

            {/* Disclaimer */}
            <div style={{ borderTop: '1px solid #999', paddingTop: '4px', fontSize: '9px', color: '#666' }}>
              <p style={{ margin: '1px 0' }}>1. Result of tests may vary from Lab to Lab and also in some parameters from time to time for the same patient</p>
              <p style={{ margin: '1px 0' }}>2. The Report is not valid for medico legal purpose</p>
            </div>

            {/* PDF Footer Bar */}
            {isPdf && (
              <div style={{ marginTop: '10px', background: '#8B0000', color: '#fff', padding: '5px 10px', fontSize: '9px', textAlign: 'center' }}>
                (होम कलेक्शन फ्री उपलब्ध है) यहा पर सभी प्रकार पैथोलोजिकल जाँच की सुविधा उपलब्ध है. मो. - 9835310931
              </div>
            )}

            {/* Print mode: bottom spacing for pre-printed footer */}
            {!isPdf && <div style={{ height: '80px' }}></div>}
          </td></tr>
        </tfoot>

        {/* ===== MAIN CONTENT - each item is its own <tr> for proper page breaks ===== */}
        <tbody>
          {Object.entries(groupedByCategory).map(([catName, groups]) => (
            <Fragment key={catName}>
              {/* Category heading */}
              <tr>
                <td colSpan="3" style={{
                  textAlign: 'center', paddingTop: '10px', paddingBottom: '4px',
                  fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #333',
                }}>
                  {catName.toUpperCase()} REPORT
                </td>
              </tr>
              {Object.entries(groups).map(([groupName, params]) => (
                <Fragment key={groupName}>
                  {groupName && (
                    <tr>
                      <td colSpan="3" style={{ paddingTop: '6px', paddingLeft: '6px', fontWeight: 'bold', fontSize: '11px', color: '#333' }}>
                        {groupName}
                      </td>
                    </tr>
                  )}
                  {params.map((param, idx) => {
                    const isAbn = param.is_abnormal;
                    const resultUnit = [param.result_value, param.unit].filter(Boolean).join(' ');
                    const rowBold = isAbn ? 'bold' : 'normal';
                    const rowColor = isAbn && isPdf ? '#c00' : '#000';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px dotted #ccc', fontWeight: rowBold, color: rowColor, fontSize: '11px' }}>
                        <td style={{ width: '45%', padding: '3px 6px 3px 12px' }}>{param.param_name}</td>
                        <td style={{ width: '25%', padding: '3px 6px', textAlign: 'center' }}>{resultUnit}</td>
                        <td style={{ width: '30%', padding: '3px 6px', textAlign: 'center', color: isAbn ? rowColor : '#555' }}>{getRefDisplay(param)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </Fragment>
          ))}
          {/* End of Report */}
          <tr>
            <td colSpan="3" style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: '10px', color: '#666' }}>------End of Report------</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

PrintableReport.displayName = 'PrintableReport';

export default PrintableReport;
