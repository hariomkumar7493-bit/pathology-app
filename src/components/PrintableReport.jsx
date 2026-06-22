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

  return (
    <div ref={ref} style={{
      fontFamily: "'Times New Roman', serif",
      padding: '0', color: '#000', fontSize: '12px', lineHeight: '1.5',
      width: '100%', position: 'relative',
      minHeight: isPdf ? '277mm' : '273mm',
      maxHeight: isPdf ? '277mm' : '273mm',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ===== PDF HEADER with logo ===== */}
      {isPdf && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '3px solid #1a4d8f' }}>
          <div dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1a4d8f', fontStyle: 'italic', margin: '0 0 2px 0', fontFamily: 'Georgia, serif' }}>
              S &amp; S Diagnostic Center
            </h1>
            <p style={{ margin: '1px 0', fontSize: '11px', color: '#333', fontWeight: 'bold' }}>
              C/o Canara Bank, 1st Floor (Near Firing Range)
            </p>
            <p style={{ margin: '1px 0', fontSize: '11px', color: '#333', fontWeight: 'bold' }}>
              Bariatu, Ranchi - 834009 (JHARKHAND)
            </p>
            <p style={{ margin: '1px 0', fontSize: '10px', color: '#555' }}>
              Founded by : Dr. C. Ashok (MBBS MD Path.)
            </p>
          </div>
        </div>
      )}

      {/* Print mode: top spacing for pre-printed header */}
      {!isPdf && <div style={{ height: '110px' }}></div>}

      {/* ===== WATERMARK - PDF only ===== */}
      {isPdf && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%) rotate(-30deg)',
          fontSize: '52px', fontWeight: 'bold',
          color: 'rgba(26, 77, 143, 0.05)',
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 0,
          fontFamily: 'Georgia, serif',
        }}>
          S &amp; S DIAGNOSTIC CENTER
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
        {/* Title */}
        <h2 style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textDecoration: 'underline', letterSpacing: '1px' }}>
          LABORATORY INVESTIGATION REPORT
        </h2>

        {/* Patient Info - 3 column layout matching physical report */}
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

        {/* Results Table - 3 columns matching physical report */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px', width: '45%' }}>Test Description</th>
              <th style={{ textAlign: 'center', padding: '4px 6px', width: '25%' }}>RESULT/UNIT</th>
              <th style={{ textAlign: 'center', padding: '4px 6px', width: '30%' }}>REF. RANGE</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedByCategory).map(([catName, groups]) => (
              <Fragment key={catName}>
                {/* Category heading e.g. "BIOCHEMISTRY REPORT" */}
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
                    {/* Show group sub-header only if group_name is non-empty */}
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
                      return (
                        <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                          <td style={{ padding: '3px 6px 3px 12px' }}>{param.param_name}</td>
                          <td style={{
                            padding: '3px 6px', textAlign: 'center',
                            fontWeight: isAbn ? 'bold' : 'normal',
                            color: isAbn && isPdf ? '#c00' : '#000',
                          }}>
                            {resultUnit}
                          </td>
                          <td style={{ padding: '3px 6px', textAlign: 'center', color: '#555' }}>
                            {getRefDisplay(param)}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>

        {/* End of Report */}
        <p style={{ textAlign: 'center', margin: '16px 0 8px', fontSize: '10px', color: '#666' }}>------End of Report------</p>
      </div>

      {/* ===== FOOTER - always at bottom ===== */}
      <div style={{ marginTop: 'auto', position: 'relative', zIndex: 1 }}>
        {/* Doctor Signature */}
        <div style={{ textAlign: 'right', paddingRight: '20px', marginBottom: '12px' }}>
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
            (होम कलेक्शन की उपलब्ध है) यहा पर सभी प्रकार पैथोलोजिकल जाँच की सुविधा उपलब्ध है. मो. - 9835310931
          </div>
        )}

        {/* Print mode: bottom spacing for pre-printed footer */}
        {!isPdf && <div style={{ height: '80px' }}></div>}
      </div>
    </div>
  );
});

PrintableReport.displayName = 'PrintableReport';

export default PrintableReport;
