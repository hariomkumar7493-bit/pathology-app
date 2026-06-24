import { forwardRef, Fragment } from 'react';

/*
  Each category gets its own <table> with full header in <thead> and footer spacer in <tfoot>.
  - <thead> repeats on every page via display:table-header-group (set in print CSS).
  - .page-footer remains position:fixed to pin at page bottom.
  - Letterhead image is added by the print/PDF wrapper (not in this component).
  - Investigation is per-category, shown in <thead>.
*/

const FOOTER_H_PDF = 130;
const FOOTER_H_PRINT = 130;

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

const PrintableReport = forwardRef(({ report, mode = 'print', layoutSettings }, ref) => {
  if (!report) return null;

  const l = { ...DEFAULT_LAYOUT, ...layoutSettings };
  const isPdf = mode === 'pdf';
  const footerH = l.footerHeight;
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

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

  const filledCategories = Object.entries(groupedByCategory).filter(([, groups]) =>
    Object.values(groups).some(params => params.some(p => p.result_value && p.result_value.toString().trim() !== ''))
  );

  const specimens = [...new Set((report.results || []).map(r => r.specimen).filter(Boolean))];

  const getCatInvestigation = (groups) =>
    Object.values(groups).flat().map(p => p.param_name).filter(Boolean).join(', ');

  const getRefDisplay = (param) => {
    const m = param.ref_range_male;
    const f = param.ref_range_female;
    if (m && f && m !== f) return `${m} (M) / ${f} (F)`;
    return m || f || '';
  };

  // Shared header builder (rendered inside each table's thead)
  const renderHeader = (investigationText) => (
    <>
      <tr><td style={{ height: `${l.letterheadHeight}px`, paddingTop: `${l.headerTopPadding}px`, padding: 0, border: 'none' }}></td></tr>
      <tr>
        <td style={{ textAlign: 'center', fontSize: `${l.titleFontSize}px`, fontWeight: 'bold', paddingBottom: `${l.headerBottomPadding}px`, textDecoration: 'underline', letterSpacing: '1px' }}>
          LABORATORY INVESTIGATION REPORT
        </td>
      </tr>
      <tr>
        <td style={{ fontSize: `${l.patientInfoFontSize}px`, paddingBottom: `${l.headerBottomPadding}px`, paddingLeft: '20px', paddingRight: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ width: `${l.colTestWidth}%` }}><strong>Patient Name</strong> : {report.patient_name || ''}</span>
            <span style={{ width: `${l.colResultWidth}%`, textAlign: 'center' }}><strong>Age/Sex</strong> : {report.age || ''} Yrs/{(report.gender || '')[0] || ''}</span>
            <span style={{ width: `${l.colRefWidth}%`, textAlign: 'left' }}><strong>Date of Collection</strong> : {formatDate(report.date_of_collection)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ width: `${l.colTestWidth}%` }}><strong>Ref. by</strong> : {report.referred_by || 'SELF'}</span>
            <span style={{ width: `${l.colResultWidth}%` }}></span>
            <span style={{ width: `${l.colRefWidth}%`, textAlign: 'left' }}><strong>Date of Reporting</strong> : {formatDate(report.date_of_reporting || report.created_at)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ width: `${l.colTestWidth}%` }}><strong>Specimen</strong> : {specimens.join(', ') || report.specimen || 'BLOOD'}</span>
            <span style={{ width: `${l.colResultWidth}%` }}></span>
            <span style={{ width: `${l.colRefWidth}%`, textAlign: 'left' }}><strong>Ref No</strong> : {report.ref_no || ''}</span>
          </div>
          {investigationText && (
            <div><strong>Investigation</strong> : {investigationText}</div>
          )}
        </td>
      </tr>
      <tr>
        <td style={{ padding: 0 }}>
          <div style={{ display: 'flex', borderTop: '2px solid #000', borderBottom: '2px solid #000', fontWeight: 'bold', fontSize: `${l.resultFontSize}px`, paddingLeft: '20px', paddingRight: '10px' }}>
            <div style={{ width: `${l.colTestWidth}%`, padding: '4px 6px' }}>Test Description</div>
            <div style={{ width: `${l.colResultWidth}%`, padding: '4px 6px', textAlign: 'center' }}>RESULT/UNIT</div>
            <div style={{ width: `${l.colRefWidth}%`, padding: '4px 6px', textAlign: 'center' }}>REF. RANGE</div>
          </div>
        </td>
      </tr>
    </>
  );

  // Shared footer builder (rendered inside each table's tfoot)
  const renderFooter = () => (
    <tr>
      <td style={{ padding: 0, border: 'none' }}>
        <div style={{ height: `${footerH}px` }}>
          {isIOS ? (
            <>
              <div style={{ textAlign: 'right', paddingRight: '20px', marginBottom: '8px' }}>
                {isPdf && l.showSignature && <img src={`${window.location.origin}/doctor-sign.png`} alt="signature" style={{ height: `${l.signatureHeight}px`, marginLeft: 'auto', display: 'block', objectFit: 'contain' }} />}
                <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0, textDecoration: 'underline' }}>{l.doctorName || report.doctor_name || 'DR. C. ASHOK'}</p>
                <p style={{ fontSize: '11px', margin: 0 }}>{l.doctorDesignation || report.doctor_designation || 'MBBS MD (PATH)'}</p>
                <p style={{ fontSize: '11px', margin: 0 }}>(PATHOLOGIST)</p>
              </div>
              <div style={{ borderTop: '1px solid #999', paddingTop: '3px', fontSize: '9px', color: '#666' }}>
                <p style={{ margin: '1px 0' }}>1. {l.footerNote1}</p>
                <p style={{ margin: '1px 0' }}>2. {l.footerNote2}</p>
              </div>
              {isPdf && l.showHindiFooter && (
                <div className="hindi-footer" style={{ marginTop: '6px', background: l.hindiFooterBgColor, color: '#fff', padding: '4px 10px', fontSize: '9px', textAlign: 'center', fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
                  {l.hindiFooterText}
                </div>
              )}
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );

  return (
    <div ref={ref} style={{ fontFamily: "'Times New Roman', serif", color: '#000', fontSize: `${l.bodyFontSize}px`, lineHeight: '1.5', width: '100%' }}>

      {/* FOOTER - position:fixed pins to bottom on desktop; hidden on iOS */}
      {!isIOS && <div className="page-footer" style={{ height: `${footerH}px` }}>
        <div style={{ textAlign: 'right', paddingRight: '20px', marginBottom: '8px' }}>
          {isPdf && l.showSignature && <img src={`${window.location.origin}/doctor-sign.png`} alt="signature" style={{ height: `${l.signatureHeight}px`, marginLeft: 'auto', display: 'block', objectFit: 'contain' }} />}
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0, textDecoration: 'underline' }}>{l.doctorName || report.doctor_name || 'DR. C. ASHOK'}</p>
          <p style={{ fontSize: '11px', margin: 0 }}>{l.doctorDesignation || report.doctor_designation || 'MBBS MD (PATH)'}</p>
          <p style={{ fontSize: '11px', margin: 0 }}>(PATHOLOGIST)</p>
        </div>
        <div style={{ borderTop: '1px solid #999', paddingTop: '3px', fontSize: '9px', color: '#666' }}>
          <p style={{ margin: '1px 0' }}>1. {l.footerNote1}</p>
          <p style={{ margin: '1px 0' }}>2. {l.footerNote2}</p>
        </div>
        {isPdf && l.showHindiFooter && (
          <div className="hindi-footer" style={{ marginTop: '6px', background: l.hindiFooterBgColor, color: '#fff', padding: '4px 10px', fontSize: '9px', textAlign: 'center', fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
            {l.hindiFooterText}
          </div>
        )}
      </div>}

      {/* One table per category — each has full header (with per-category investigation) in thead */}
      {filledCategories.map(([catName, groups], catIdx) => (
        <table key={catName} style={{ width: '100%', borderCollapse: 'collapse', pageBreakAfter: catIdx < filledCategories.length - 1 ? 'always' : 'auto' }}>
          <thead>{renderHeader(getCatInvestigation(groups))}</thead>
          <tfoot>{renderFooter()}</tfoot>
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
                    <tr key={idx} style={{ borderBottom: '1px dotted #ccc', fontWeight: rowBold, color: rowColor, fontSize: `${l.resultFontSize}px` }}>
                      <td style={{ padding: '3px 10px 3px 20px' }}>
                        <div style={{ display: 'flex' }}>
                          <span style={{ width: `${l.colTestWidth}%` }}>{param.param_name}</span>
                          <span style={{ width: `${l.colResultWidth}%`, textAlign: 'center' }}>{resultUnit}</span>
                          <span style={{ width: `${l.colRefWidth}%`, textAlign: 'center', color: isAbn ? rowColor : '#555' }}>{getRefDisplay(param)}</span>
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
