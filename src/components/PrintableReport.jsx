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
          <tr><td style={{ padding: 0 }}>
            <div style={{ position: 'relative' }}>
              {/* PDF: Letterhead background for header */}
              {isPdf && (
                <img
                  src={letterheadUrl}
                  alt=""
                  style={{
                    position: 'absolute', top: 0, left: '-10mm', right: '-10mm',
                    width: 'calc(100% + 20mm)', height: headerHeight,
                    objectFit: 'cover', objectPosition: 'top',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {/* Spacing for letterhead */}
              <div style={{ height: headerHeight }}></div>
            </div>

            {/* Title */}
            <h2 style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textDecoration: 'underline', letterSpacing: '1px', marginTop: '0' }}>
              LABORATORY INVESTIGATION REPORT
            </h2>

            {/* Patient Info */}
            <table style={{ width: '100%', marginBottom: '8px', fontSize: '11px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '45%' }}><strong>Patient Name</strong> : {report.patient_name || ''}</td>
                  <td style={{ width: '25%', textAlign: 'center' }}><strong>Age/Sex</strong> : {report.age || ''} Yrs/{(report.gender || '')[0] || ''}</td>
                  <td style={{ width: '30%', textAlign: 'right' }}><strong>Date of Collection</strong> : {formatDate(report.date_of_collection)}</td>
                </tr>
                <tr>
                  <td><strong>Ref. by</strong> : {report.referred_by || 'SELF'}</td>
                  <td></td>
                  <td style={{ textAlign: 'right' }}><strong>Date of Reporting</strong> : {formatDate(report.date_of_reporting || report.created_at)}</td>
                </tr>
                <tr>
                  <td><strong>Specimen</strong> : {specimens.join(', ') || report.specimen || 'BLOOD'}</td>
                  <td></td>
                  <td style={{ textAlign: 'right' }}><strong>Ref No</strong> : {report.ref_no || ''}</td>
                </tr>
                <tr>
                  <td colSpan="3"><strong>Investigation</strong> : {report.investigation || ''}</td>
                </tr>
              </tbody>
            </table>

            {/* Column headers */}
            <div style={{ display: 'flex', borderTop: '2px solid #000', borderBottom: '2px solid #000', fontSize: '11px', fontWeight: 'bold' }}>
              <div style={{ width: '45%', padding: '4px 6px' }}>Test Description</div>
              <div style={{ width: '25%', padding: '4px 6px', textAlign: 'center' }}>RESULT/UNIT</div>
              <div style={{ width: '30%', padding: '4px 6px', textAlign: 'center' }}>REF. RANGE</div>
            </div>
          </td></tr>
        </thead>

        {/* ===== REPEATING FOOTER (every page) ===== */}
        <tfoot>
          <tr><td style={{ padding: 0 }}>
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

        {/* ===== MAIN CONTENT (scrollable between header/footer) ===== */}
        <tbody>
          <tr><td style={{ padding: 0 }}>
            {Object.entries(groupedByCategory).map(([catName, groups]) => (
              <Fragment key={catName}>
                {/* Category heading */}
                <div style={{
                  textAlign: 'center', paddingTop: '10px', paddingBottom: '4px',
                  fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #333',
                }}>
                  {catName.toUpperCase()} REPORT
                </div>
                {Object.entries(groups).map(([groupName, params]) => (
                  <Fragment key={groupName}>
                    {groupName && (
                      <div style={{ paddingTop: '6px', paddingLeft: '6px', fontWeight: 'bold', fontSize: '11px', color: '#333' }}>
                        {groupName}
                      </div>
                    )}
                    {params.map((param, idx) => {
                      const isAbn = param.is_abnormal;
                      const resultUnit = [param.result_value, param.unit].filter(Boolean).join(' ');
                      const rowBold = isAbn ? 'bold' : 'normal';
                      const rowColor = isAbn && isPdf ? '#c00' : '#000';
                      return (
                        <div key={idx} style={{
                          display: 'flex', borderBottom: '1px dotted #ccc',
                          fontWeight: rowBold, color: rowColor, fontSize: '11px',
                        }}>
                          <div style={{ width: '45%', padding: '3px 6px 3px 12px' }}>{param.param_name}</div>
                          <div style={{ width: '25%', padding: '3px 6px', textAlign: 'center' }}>{resultUnit}</div>
                          <div style={{ width: '30%', padding: '3px 6px', textAlign: 'center', color: isAbn ? rowColor : '#555' }}>{getRefDisplay(param)}</div>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </Fragment>
            ))}

            {/* End of Report */}
            <p style={{ textAlign: 'center', margin: '16px 0 8px', fontSize: '10px', color: '#666' }}>------End of Report------</p>
          </td></tr>
        </tbody>
      </table>
    </div>
  );
});

PrintableReport.displayName = 'PrintableReport';

export default PrintableReport;
