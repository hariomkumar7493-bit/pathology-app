import { useState, useEffect, useRef } from 'react';
import { Check, Printer, Save, Zap, TestTubes, Search, Download } from 'lucide-react';
import { api } from '../api';
import PrintableReport from '../components/PrintableReport';
import { useToast } from '../context/ToastContext';

export default function QuickReport() {
  const [tests, setTests] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [results, setResults] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedReportId, setSavedReportId] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [testSearch, setTestSearch] = useState('');
  const printRef = useRef();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    patient_name: '',
    age: '',
    gender: '',
    phone: '',
    referred_by: 'SELF',
    date_of_collection: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    api.getTests().then(setTests).catch(console.error);
  }, []);

  // Load parameters when tests are selected
  useEffect(() => {
    if (selectedTests.length === 0) {
      setParameters([]);
      return;
    }
    api.getBulkParameters(selectedTests).then((params) => {
      setParameters(params);
      // Initialize result values
      const init = {};
      params.forEach(p => {
        if (!results[p.id]) init[p.id] = { result_value: '', is_abnormal: false };
      });
      setResults(prev => ({ ...prev, ...init }));
    }).catch(console.error);
  }, [selectedTests]);

  const toggleTest = (testId) => {
    setSelectedTests(prev =>
      prev.includes(testId) ? prev.filter(id => id !== testId) : [...prev, testId]
    );
  };

  // Auto-detect abnormal based on reference range
  function checkAbnormal(value, refRange) {
    if (!value || !refRange) return false;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return false;
    const rangeMatch = refRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
    if (rangeMatch) {
      const low = parseFloat(rangeMatch[1]);
      const high = parseFloat(rangeMatch[2]);
      if (!isNaN(low) && !isNaN(high)) return numVal < low || numVal > high;
    }
    const ltMatch = refRange.match(/<\s*([\d.]+)/);
    if (ltMatch) return numVal >= parseFloat(ltMatch[1]);
    const gtMatch = refRange.match(/>\s*([\d.]+)/);
    if (gtMatch) return numVal <= parseFloat(gtMatch[1]);
    return false;
  }

  const updateResult = (paramId, value, refRangeMale, refRangeFemale) => {
    const refRange = form.gender === 'Female' ? refRangeFemale : refRangeMale;
    const abnormal = checkAbnormal(value, refRange);
    setResults(prev => ({
      ...prev,
      [paramId]: { result_value: value, is_abnormal: abnormal }
    }));
  };

  // Group parameters by category_name then group_name (same category in same box)
  const groupedParams = {};
  parameters.forEach(p => {
    const catKey = p.category_name || p.test_name || 'Test';
    const groupKey = p.group_name || p.test_name || 'Results';
    if (!groupedParams[catKey]) groupedParams[catKey] = {};
    if (!groupedParams[catKey][groupKey]) groupedParams[catKey][groupKey] = [];
    groupedParams[catKey][groupKey].push(p);
  });

  const handleSaveAndPrint = async () => {
    if (!form.patient_name) { addToast('Patient name is required', 'warning'); return; }
    if (selectedTests.length === 0) { addToast('Select at least one test', 'warning'); return; }

    setSaving(true);
    try {
      const resultArr = Object.entries(results).map(([paramId, val]) => ({
        parameter_id: parseInt(paramId),
        result_value: val.result_value,
        is_abnormal: val.is_abnormal,
      }));

      const res = await api.createQuickReport({
        patient_name: form.patient_name,
        age: parseInt(form.age) || 0,
        gender: form.gender,
        phone: form.phone,
        referred_by: form.referred_by,
        test_ids: selectedTests,
        results: resultArr,
        date_of_collection: form.date_of_collection,
      });

      setSavedReportId(res.reportId);

      // Fetch the full report for printing
      const fullReport = await api.getReport(res.reportId);
      setPrintData(fullReport);

      addToast('Report saved successfully', 'success');

      // Print after small delay
      setTimeout(() => {
        handlePrint();
      }, 500);
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
    setSaving(false);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Lab Report</title>
          <style>
            @page { margin: 10mm; size: A4; }
            body { font-family: 'Times New Roman', serif; margin: 0; padding: 10mm; color: #000; font-size: 12px; }
            table { border-collapse: collapse; width: 100%; }
            h2 { text-align: center; font-size: 16px; text-decoration: underline; margin-bottom: 12px; }
            th { text-align: left; padding: 4px 6px; }
            td { padding: 2px 6px; vertical-align: top; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const handleSaveAndDownloadPdf = async () => {
    if (!form.patient_name) { addToast('Patient name is required', 'warning'); return; }
    if (selectedTests.length === 0) { addToast('Select at least one test', 'warning'); return; }

    setSaving(true);
    try {
      const resultArr = Object.entries(results).map(([paramId, val]) => ({
        parameter_id: parseInt(paramId),
        result_value: val.result_value,
        is_abnormal: val.is_abnormal,
      }));

      const res = await api.createQuickReport({
        patient_name: form.patient_name,
        age: parseInt(form.age) || 0,
        gender: form.gender,
        phone: form.phone,
        referred_by: form.referred_by,
        test_ids: selectedTests,
        results: resultArr,
        date_of_collection: form.date_of_collection,
      });

      setSavedReportId(res.reportId);
      const fullReport = await api.getReport(res.reportId);
      setPrintData(fullReport);
      addToast('Report saved successfully', 'success');

      // Download as PDF after render
      setTimeout(() => {
        const printContent = printRef.current;
        if (!printContent) return;
        const dateStr = new Date(form.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        const fileName = `${form.patient_name}_${dateStr}`;
        const pdfWindow = window.open('', '_blank', 'width=800,height=600');
        pdfWindow.document.write(`
          <html><head><title>${fileName}</title>
          <style>
            @page { margin: 10mm; size: A4; }
            body { font-family: 'Times New Roman', serif; margin: 0; padding: 10mm; color: #000; font-size: 12px; }
            table { border-collapse: collapse; width: 100%; }
            h2 { text-align: center; font-size: 16px; text-decoration: underline; margin-bottom: 12px; }
            th { text-align: left; padding: 4px 6px; }
            td { padding: 2px 6px; vertical-align: top; }
          </style></head>
          <body>${printContent.innerHTML}</body></html>
        `);
        pdfWindow.document.close();
        pdfWindow.focus();
        setTimeout(() => { pdfWindow.print(); }, 300);
      }, 500);
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
    setSaving(false);
  };

  const handleReset = () => {
    setForm({ patient_name: '', age: '', gender: '', phone: '', referred_by: 'SELF', date_of_collection: new Date().toISOString().split('T')[0] });
    setSelectedTests([]);
    setParameters([]);
    setResults({});
    setSavedReportId(null);
    setPrintData(null);
  };

  // Group tests by category for selection
  const testsByCategory = tests.reduce((acc, test) => {
    const cat = test.category_name || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(test);
    return acc;
  }, {});

  const filteredTestsByCategory = Object.entries(testsByCategory).reduce((acc, [cat, catTests]) => {
    const filtered = catTests.filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase()));
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Quick Report
          </h1>
          <p className="text-gray-500 text-sm mt-1">Enter patient details, fill results, and print immediately</p>
        </div>
        {savedReportId && (
          <button onClick={handleReset} className="btn-secondary w-fit">New Report</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Patient Info + Test Selection */}
        <div className="space-y-4">
          {/* Patient Details */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Patient Details</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Patient Name *</label>
                <input type="text" className="input-field text-sm" value={form.patient_name} onChange={e => setForm({ ...form, patient_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                  <input type="number" className="input-field text-sm" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                  <select className="input-field text-sm" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input type="tel" className="input-field text-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Referred By</label>
                <input type="text" className="input-field text-sm" value={form.referred_by} onChange={e => setForm({ ...form, referred_by: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date of Collection</label>
                <input type="date" className="input-field text-sm" value={form.date_of_collection} onChange={e => setForm({ ...form, date_of_collection: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Test Selection */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <TestTubes className="w-4 h-4 text-primary-600" />
              Select Tests ({selectedTests.length})
            </h3>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tests..."
                className="input-field text-xs pl-8 py-1.5"
                value={testSearch}
                onChange={e => setTestSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {Object.entries(filteredTestsByCategory).map(([cat, catTests]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{cat}</p>
                  {catTests.map(test => (
                    <button
                      key={test.id}
                      type="button"
                      onClick={() => toggleTest(test.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left mb-0.5 transition-all ${
                        selectedTests.includes(test.id)
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                        selectedTests.includes(test.id) ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                      }`}>
                        {selectedTests.includes(test.id) && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="truncate">{test.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Result Entry */}
        <div className="lg:col-span-2 space-y-4">
          {selectedTests.length === 0 ? (
            <div className="card text-center py-16">
              <TestTubes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select tests from the left to enter results</p>
            </div>
          ) : (
            <>
              {Object.entries(groupedParams).map(([categoryName, groups]) => (
                <div key={categoryName} className="card overflow-hidden p-0">
                  <div className="bg-primary-50 px-3 sm:px-4 py-2 border-b border-primary-100">
                    <span className="text-sm font-bold text-primary-800">{categoryName}</span>
                  </div>
                  <div className="bg-gray-50 px-3 sm:px-4 py-2 border-b border-gray-200 hidden sm:block">
                    <div className="grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase">
                      <div className="col-span-4">Test Description</div>
                      <div className="col-span-3 text-center">Result</div>
                      <div className="col-span-1 text-center">Unit</div>
                      <div className="col-span-3 text-center">Ref. Range</div>
                      <div className="col-span-1 text-center">Abn</div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Object.entries(groups).map(([groupName, params]) => (
                      <div key={groupName}>
                        <div className="px-3 sm:px-4 py-2 bg-gray-50">
                          <span className="text-xs font-bold text-gray-700">{groupName}</span>
                        </div>
                        {params.map(param => {
                          const refRange = form.gender === 'Female' ? param.ref_range_female : param.ref_range_male;
                          const abnFlag = results[param.id]?.is_abnormal || false;
                          return (
                            <div key={param.id} className={`grid grid-cols-12 items-center px-3 sm:px-4 py-1.5 sm:py-2 ${abnFlag ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                              <div className="col-span-4 text-xs text-gray-700 pl-1 sm:pl-2 truncate">{param.param_name}</div>
                              <div className="col-span-3">
                                <input
                                  type="text"
                                  className={`w-full px-2 py-1 border rounded text-xs text-center focus:ring-1 focus:ring-primary-500 outline-none ${abnFlag ? 'border-red-300 text-red-700 font-bold' : 'border-gray-200'}`}
                                  value={results[param.id]?.result_value || ''}
                                  onChange={e => updateResult(param.id, e.target.value, param.ref_range_male, param.ref_range_female)}
                                />
                              </div>
                              <div className="col-span-1 text-xs text-gray-500 text-center hidden sm:block">{param.unit || ''}</div>
                              <div className="col-span-3 text-xs text-gray-500 text-center hidden sm:block">{refRange || ''}</div>
                              <div className="col-span-1 text-center">
                                <span className={`inline-block w-3 h-3 rounded-full ${abnFlag ? 'bg-red-500' : 'bg-green-400'}`} title={abnFlag ? 'Abnormal' : 'Normal'}></span>
                              </div>
                              {/* Mobile-only: show unit and ref range below */}
                              <div className="col-span-12 sm:hidden flex justify-between text-xs text-gray-500 px-1 pb-1">
                                <span>Unit: {param.unit || '-'}</span>
                                <span>Ref: {refRange || '-'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button onClick={handleSaveAndPrint} disabled={saving} className="btn-primary flex items-center gap-2 flex-1 justify-center py-3 disabled:opacity-50">
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      Save & Print Report
                    </>
                  )}
                </button>
                <button onClick={handleSaveAndDownloadPdf} disabled={saving} className="btn-secondary flex items-center gap-2 flex-1 justify-center py-3 disabled:opacity-50">
                  <Download className="w-4 h-4" />
                  Save & Download PDF
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden Print Component */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <PrintableReport ref={printRef} report={printData} />
      </div>
    </div>
  );
}
