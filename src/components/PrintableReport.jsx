import { forwardRef, Fragment } from 'react';

const PrintableReport = forwardRef(({ report, mode = 'print' }, ref) => {
  if (!report) return null;

  const isPdf = mode === 'pdf';

  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Group results by test_name, then by group_name
  const groupedResults = {};
  (report.results || []).forEach((r) => {
    const testKey = r.test_name || 'Test';
    const groupKey = r.group_name || 'Results';
    if (!groupedResults[testKey]) groupedResults[testKey] = {};
    if (!groupedResults[testKey][groupKey]) groupedResults[testKey][groupKey] = [];
    groupedResults[testKey][groupKey].push(r);
  });

  return (
    <div ref={ref} style={{ fontFamily: 'Times New Roman, serif', padding: '0', color: '#000', fontSize: '12px', lineHeight: '1.5', width: '100%', position: 'relative' }}>

      {/* PDF Header - only shown in PDF mode */}
      {isPdf && (
        <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #1a4d8f' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a4d8f', fontStyle: 'italic', margin: '0 0 4px 0', fontFamily: 'Georgia, serif' }}>
            S &amp; S Diagnostic Center
          </h1>
          <p style={{ margin: '2px 0', fontSize: '11px', color: '#333' }}>
            C/o Canara Bank, 1st Floor (Near Firing Range)
          </p>
          <p style={{ margin: '2px 0', fontSize: '11px', color: '#333' }}>
            Bariatu, Ranchi - 834009 (JHARKHAND)
          </p>
          <p style={{ margin: '2px 0', fontSize: '11px', color: '#555' }}>
            Founded by : Dr. C. Ashok (MBBS MD Path.)
          </p>
        </div>
      )}

      {/* Print mode: top spacing for pre-printed header */}
      {!isPdf && (
        <div style={{ height: '100px' }}></div>
      )}

      {/* Watermark - only in PDF mode */}
      {isPdf && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-30deg)',
          fontSize: '48px',
          fontWeight: 'bold',
          color: 'rgba(26, 77, 143, 0.06)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 0,
          fontFamily: 'Georgia, serif',
        }}>
          S &amp; S DIAGNOSTIC CENTER
        </div>
      )}

      {/* Content wrapper */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Title */}
        <h2 style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', textDecoration: 'underline' }}>
          LABORATORY INVESTIGATION REPORT
        </h2>

        {/* Patient Info */}
        <table style={{ width: '100%', marginBottom: '10px', fontSize: '11px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td><strong>Patient Name</strong> : {report.patient_name || ''}</td>
              <td style={{ textAlign: 'right' }}><strong>Date of Collection</strong> : {formatDate(report.date_of_collection)}</td>
            </tr>
            <tr>
              <td><strong>Ref. by</strong> : {report.referred_by || 'SELF'}</td>
              <td style={{ textAlign: 'right' }}><strong>Date of Reporting</strong> : {formatDate(report.date_of_reporting)}</td>
            </tr>
            <tr>
              <td><strong>Specimen</strong> : {report.specimen || 'BLOOD'}</td>
              <td style={{ textAlign: 'right' }}><strong>Ref No</strong> : {report.ref_no || ''}</td>
            </tr>
            <tr>
              <td><strong>Age/Sex</strong> : {report.age || ''} Yrs / {report.gender || ''}</td>
              <td style={{ textAlign: 'right' }}></td>
            </tr>
            <tr>
              <td colSpan="2"><strong>Investigation</strong> : {report.investigation || ''}</td>
            </tr>
          </tbody>
        </table>

        {/* Results table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px', width: '40%' }}>Test Description</th>
              <th style={{ textAlign: 'center', padding: '4px 6px', width: '20%' }}>Result</th>
              <th style={{ textAlign: 'center', padding: '4px 6px', width: '10%' }}>Unit</th>
              <th style={{ textAlign: 'center', padding: '4px 6px', width: '30%' }}>Reference Range</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedResults).map(([testName, groups]) => (
              <Fragment key={testName}>
                {Object.entries(groups).map(([groupName, params]) => (
                  <Fragment key={groupName}>
                    <tr>
                      <td colSpan="4" style={{ paddingTop: '8px', fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #333' }}>
                        {groupName}
                      </td>
                    </tr>
                    {params.map((param, idx) => {
                      const refRange = report.gender === 'Female' ? param.ref_range_female : param.ref_range_male;
                      const isAbn = param.is_abnormal;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                          <td style={{ padding: '2px 6px 2px 12px' }}>{param.param_name}</td>
                          <td style={{ padding: '2px 6px', textAlign: 'center', fontWeight: isAbn ? 'bold' : 'normal', color: isAbn ? '#c00' : '#000' }}>
                            {param.result_value || ''}
                          </td>
                          <td style={{ padding: '2px 6px', textAlign: 'center', color: '#555' }}>{param.unit || ''}</td>
                          <td style={{ padding: '2px 6px', textAlign: 'center', color: '#555' }}>{refRange || ''}</td>
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
        <p style={{ textAlign: 'center', margin: '20px 0 10px', fontSize: '10px', color: '#666' }}>------End of Report------</p>

        {/* Footer - Doctor Signature */}
        <div style={{ marginTop: '30px', textAlign: 'right', paddingRight: '20px' }}>
          <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0, textDecoration: 'underline' }}>{report.doctor_name || 'DR. C. ASHOK'}</p>
          <p style={{ fontSize: '11px', margin: 0 }}>{report.doctor_designation || 'MBBS MD (PATH)'}</p>
          <p style={{ fontSize: '11px', margin: 0 }}>(PATHOLOGIST)</p>
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #999', paddingTop: '6px', fontSize: '9px', color: '#666' }}>
          <p style={{ margin: '2px 0' }}>1. Result of tests may vary from Lab to Lab and also in some parameters from time to time for the same patient</p>
          <p style={{ margin: '2px 0' }}>2. The Report is not valid for medico legal purpose</p>
        </div>

        {/* PDF Footer Bar */}
        {isPdf && (
          <div style={{ marginTop: '16px', background: '#8B0000', color: '#fff', padding: '6px 12px', fontSize: '9px', textAlign: 'center', borderRadius: '2px' }}>
            (होम कलेक्शन की उपलब्ध है) यहा पर सभी प्रकार पैथोलोजिकल जाँच की सुविधा उपलब्ध है. मो. - 9835310931
          </div>
        )}

        {/* Print mode: bottom spacing for pre-printed footer */}
        {!isPdf && (
          <div style={{ height: '80px' }}></div>
        )}
      </div>
    </div>
  );
});

PrintableReport.displayName = 'PrintableReport';

export default PrintableReport;
