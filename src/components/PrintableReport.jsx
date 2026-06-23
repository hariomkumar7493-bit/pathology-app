import { forwardRef, Fragment } from 'react';

/*
  Pattern: position:fixed applied via CSS class in print windows only (not inline).
  - .page-header / .page-footer: NO inline position:fixed (would break in-app view).
  - Print/PDF windows add CSS: .page-header { position:fixed; top:0; ... }
  - thead/tfoot = invisible spacers to reserve space on each page.
*/

const BASE_HEADER_H = 245;
const FOOTER_H_PDF = 130;
const FOOTER_H_PRINT = 130;

const PrintableReport = forwardRef(({ report, mode = 'print' }, ref) => {
  if (!report) return null;

  const isPdf = mode === 'pdf';
  const footerH = isPdf ? FOOTER_H_PDF : FOOTER_H_PRINT;
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const HEADER_H = BASE_HEADER_H;

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

  return (
    <div ref={ref} style={{ fontFamily: "'Times New Roman', serif", color: '#000', fontSize: '12px', lineHeight: '1.5', width: '100%' }}>

      {/* HEADER - position:fixed applied via CSS class in print window, NOT inline */}
      <div className="page-header" style={{ height: `${HEADER_H}px` }}>
        <div style={{ height: '140px' }}></div>
        <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', textDecoration: 'underline', letterSpacing: '1px' }}>
          LABORATORY INVESTIGATION REPORT
        </div>
        <div style={{ fontSize: '11px', marginBottom: '6px', paddingLeft: '20px', paddingRight: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ width: '45%' }}><strong>Patient Name</strong> : {report.patient_name || ''}</span>
            <span style={{ width: '25%', textAlign: 'center' }}><strong>Age/Sex</strong> : {report.age || ''} Yrs/{(report.gender || '')[0] || ''}</span>
            <span style={{ width: '30%', textAlign: 'left' }}><strong>Date of Collection</strong> : {formatDate(report.date_of_collection)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ width: '45%' }}><strong>Ref. by</strong> : {report.referred_by || 'SELF'}</span>
            <span style={{ width: '25%' }}></span>
            <span style={{ width: '30%', textAlign: 'left' }}><strong>Date of Reporting</strong> : {formatDate(report.date_of_reporting || report.created_at)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ width: '45%' }}><strong>Specimen</strong> : {specimens.join(', ') || report.specimen || 'BLOOD'}</span>
            <span style={{ width: '25%' }}></span>
            <span style={{ width: '30%', textAlign: 'left' }}><strong>Ref No</strong> : {report.ref_no || ''}</span>
          </div>
          {report.investigation && (
            <div><strong>Investigation</strong> : {report.investigation}</div>
          )}
        </div>
      </div>

      {/* FOOTER - position:fixed pins to bottom on desktop; hidden on iOS */}
      {!isIOS && <div className="page-footer" style={{ height: `${footerH}px` }}>
        <div style={{ textAlign: 'right', paddingRight: '20px', marginBottom: '8px' }}>
          {isPdf && <img src={`${window.location.origin}/doctor-sign.png`} alt="signature" style={{ height: '13px', marginLeft: 'auto', display: 'block', objectFit: 'contain' }} />}
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0, textDecoration: 'underline' }}>{report.doctor_name || 'DR. C. ASHOK'}</p>
          <p style={{ fontSize: '11px', margin: 0 }}>{report.doctor_designation || 'MBBS MD (PATH)'}</p>
          <p style={{ fontSize: '11px', margin: 0 }}>(PATHOLOGIST)</p>
        </div>
        <div style={{ borderTop: '1px solid #999', paddingTop: '3px', fontSize: '9px', color: '#666' }}>
          <p style={{ margin: '1px 0' }}>1. Result of tests may vary from Lab to Lab and also in some parameters from time to time for the same patient</p>
          <p style={{ margin: '1px 0' }}>2. The Report is not valid for medico legal purpose</p>
        </div>
        {isPdf && (
          <div style={{ marginTop: '6px', background: '#8B0000', color: '#fff', padding: '4px 10px', fontSize: '9px', textAlign: 'center' }}>
            (होम कलेक्शन फ्री उपलब्ध है) यहा पर सभी प्रकार पैथोलोजिकल जाँच की सुविधा उपलब्ध है. मो. - 9835310931
          </div>
        )}
      </div>}

      {/* One table per category — each gets its own page with repeated header/footer */}
      {Object.entries(groupedByCategory).filter(([, groups]) =>
        Object.values(groups).some(params => params.some(p => p.result_value && p.result_value.toString().trim() !== ''))
      ).map(([catName, groups], catIdx, arr) => (
        <table key={catName} style={{ width: '100%', borderCollapse: 'collapse', pageBreakAfter: catIdx < arr.length - 1 ? 'always' : 'auto' }}>
          <thead>
            <tr><td style={{ height: `${HEADER_H + 5}px`, padding: 0, border: 'none' }}></td></tr>
            <tr>
              <td style={{ padding: 0 }}>
                <div style={{ display: 'flex', borderTop: '2px solid #000', borderBottom: '2px solid #000', fontWeight: 'bold', fontSize: '11px', paddingLeft: '20px', paddingRight: '10px' }}>
                  <div style={{ width: '45%', padding: '4px 6px' }}>Test Description</div>
                  <div style={{ width: '25%', padding: '4px 6px', textAlign: 'center' }}>RESULT/UNIT</div>
                  <div style={{ width: '30%', padding: '4px 6px', textAlign: 'center' }}>REF. RANGE</div>
                </div>
              </td>
            </tr>
          </thead>
          <tfoot>
            <tr>
              <td style={{ padding: 0, border: 'none' }}>
                <div className="tfoot-footer" style={{ height: `${footerH}px` }}>
                  {isIOS ? (
                    <>
                      <div style={{ textAlign: 'right', paddingRight: '20px', marginBottom: '8px' }}>
                        {isPdf && <img src={`${window.location.origin}/doctor-sign.png`} alt="signature" style={{ height: '13px', marginLeft: 'auto', display: 'block', objectFit: 'contain' }} />}
                        <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0, textDecoration: 'underline' }}>{report.doctor_name || 'DR. C. ASHOK'}</p>
                        <p style={{ fontSize: '11px', margin: 0 }}>{report.doctor_designation || 'MBBS MD (PATH)'}</p>
                        <p style={{ fontSize: '11px', margin: 0 }}>(PATHOLOGIST)</p>
                      </div>
                      <div style={{ borderTop: '1px solid #999', paddingTop: '3px', fontSize: '9px', color: '#666' }}>
                        <p style={{ margin: '1px 0' }}>1. Result of tests may vary from Lab to Lab and also in some parameters from time to time for the same patient</p>
                        <p style={{ margin: '1px 0' }}>2. The Report is not valid for medico legal purpose</p>
                      </div>
                      {isPdf && (
                        <div style={{ marginTop: '6px', background: '#8B0000', color: '#fff', padding: '4px 10px', fontSize: '9px', textAlign: 'center' }}>
                          (होम कलेक्शन फ्री उपलब्ध है) यहा पर सभी प्रकार पैथोलोजिकल जाँच की सुविधा उपलब्ध है. मो. - 9835310931
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td style={{
                textAlign: 'center', paddingTop: '10px', paddingBottom: '4px',
                fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #333',
              }}>
                {catName.toUpperCase()} REPORT
              </td>
            </tr>
            {Object.entries(groups).map(([groupName, params]) => {
              const filledParams = params.filter(p => p.result_value && p.result_value.toString().trim() !== '');
              if (filledParams.length === 0) return null;
              return (
              <Fragment key={groupName}>
                {groupName && (
                  <tr>
                    <td style={{ paddingTop: '6px', paddingLeft: '20px', fontWeight: 'bold', fontSize: '11px', color: '#333' }}>
                      {groupName}
                    </td>
                  </tr>
                )}
                {filledParams.map((param, idx) => {
                  const isAbn = param.is_abnormal;
                  const resultUnit = [param.result_value, param.unit].filter(Boolean).join(' ');
                  const rowBold = isAbn ? 'bold' : 'normal';
                  const rowColor = isAbn && isPdf ? '#c00' : '#000';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px dotted #ccc', fontWeight: rowBold, color: rowColor, fontSize: '11px' }}>
                      <td style={{ padding: '3px 10px 3px 20px' }}>
                        <div style={{ display: 'flex' }}>
                          <span style={{ width: '45%' }}>{param.param_name}</span>
                          <span style={{ width: '25%', textAlign: 'center' }}>{resultUnit}</span>
                          <span style={{ width: '30%', textAlign: 'center', color: isAbn ? rowColor : '#555' }}>{getRefDisplay(param)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
              );
            })}
            <tr>
              <td style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: '10px', color: '#666' }}>------End of Report------</td>
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );
});

PrintableReport.displayName = 'PrintableReport';

export default PrintableReport;
