import { useState, useEffect, useRef } from 'react';
import { Check, Minus, Printer, Save, Zap, TestTubes, Search, Download, ChevronDown, ChevronUp, ChevronRight, Share2 } from 'lucide-react';
import { api } from '../api';
import PrintableReport from '../components/PrintableReport';
import { useToast } from '../context/ToastContext';
import { isElectron } from '../utils/electron';
import { electronPrint, electronShareWhatsApp, electronSavePDF, renderReportToHTML } from '../utils/electronPrint';

export default function QuickReport() {
  const [tests, setTests] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState({}); // { testId: ['group1', 'group2'] }
  const [expandedTests, setExpandedTests] = useState({}); // { testId: true/false }
  const [parameters, setParameters] = useState([]);
  const [results, setResults] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedReportId, setSavedReportId] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [testSearch, setTestSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [shareReady, setShareReady] = useState(null); // { files: File[], label: string, needsSave: bool, saveData: obj }
  const printRef = useRef();
  const pdfRef = useRef();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    patient_name: '',
    age: '',
    gender: '',
    phone: '',
    referred_by: 'SELF',
    specimen: 'BLOOD',
    date_of_collection: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    api.getTests().then(setTests).catch(console.error);
  }, []);

  // Get unique sub-groups for a test
  const getTestGroups = (test) => {
    const params = test.parameters || [];
    const groups = [...new Set(params.map(p => p.group_name || test.name))];
    return groups;
  };

  // Load parameters when tests are selected
  useEffect(() => {
    if (selectedTests.length === 0) {
      setParameters([]);
      return;
    }
    api.getBulkParameters(selectedTests).then((params) => {
      // Add unique key to each param (test_name + id) to avoid collisions across tests
      const withUid = params.map(p => ({ ...p, uid: `${p.test_name}__${p.id}` }));
      // Filter params to only include selected sub-groups
      const filtered = withUid.filter(p => {
        const testId = selectedTests.find(tid => {
          const t = tests.find(tt => tt._id === tid);
          return t && (t.name === p.test_name || t.name === p.category_name);
        });
        if (!testId) return true; // include if we can't determine
        const selGroups = selectedGroups[testId];
        if (!selGroups || selGroups.length === 0) return true;
        const groupName = p.group_name || p.test_name;
        return selGroups.includes(groupName);
      });
      setParameters(filtered);
      const init = {};
      filtered.forEach(p => {
        if (!results[p.uid]) init[p.uid] = { result_value: '', is_abnormal: false };
      });
      setResults(prev => ({ ...prev, ...init }));
    }).catch(console.error);
  }, [selectedTests, selectedGroups]);

  // Toggle entire test (all sub-groups)
  const toggleTest = (testId) => {
    const test = tests.find(t => t._id === testId);
    const allGroups = test ? getTestGroups(test) : [];
    const isSelected = selectedTests.includes(testId);

    if (isSelected) {
      // Deselect test and all its groups
      setSelectedTests(prev => prev.filter(id => id !== testId));
      setSelectedGroups(prev => { const n = { ...prev }; delete n[testId]; return n; });
    } else {
      // Select test with all groups
      setSelectedTests(prev => [...prev, testId]);
      setSelectedGroups(prev => ({ ...prev, [testId]: [...allGroups] }));
    }
  };

  // Toggle a single sub-group within a test
  const toggleSubGroup = (testId, groupName) => {
    const test = tests.find(t => t._id === testId);
    const allGroups = test ? getTestGroups(test) : [];
    const currentGroups = selectedGroups[testId] || [];
    const isGroupSelected = currentGroups.includes(groupName);

    let newGroups;
    if (isGroupSelected) {
      newGroups = currentGroups.filter(g => g !== groupName);
    } else {
      newGroups = [...currentGroups, groupName];
    }

    if (newGroups.length === 0) {
      // No groups selected -> deselect the test entirely
      setSelectedTests(prev => prev.filter(id => id !== testId));
      setSelectedGroups(prev => { const n = { ...prev }; delete n[testId]; return n; });
    } else {
      // At least one group selected -> ensure test is in selectedTests
      if (!selectedTests.includes(testId)) {
        setSelectedTests(prev => [...prev, testId]);
      }
      setSelectedGroups(prev => ({ ...prev, [testId]: newGroups }));
    }
  };

  // Check state for a test checkbox (all, some, none)
  const getTestCheckState = (testId) => {
    if (!selectedTests.includes(testId)) return 'none';
    const test = tests.find(t => t._id === testId);
    const allGroups = test ? getTestGroups(test) : [];
    const selGroups = selectedGroups[testId] || [];
    if (selGroups.length >= allGroups.length) return 'all';
    return 'partial';
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
      const resultArr = Object.entries(results).map(([uid, val]) => {
        const param = parameters.find(p => p.uid === uid);
        return {
          parameter_id: param?.id || parseInt(uid),
          param_name: param?.param_name || '',
          result_value: val.result_value,
          is_abnormal: val.is_abnormal,
        };
      });

      const res = await api.createQuickReport({
        patient_name: form.patient_name,
        age: parseInt(form.age) || 0,
        gender: form.gender,
        phone: form.phone,
        referred_by: form.referred_by,
        specimen: form.specimen,
        test_ids: selectedTests,
        results: resultArr,
        date_of_collection: form.date_of_collection,
      });

      setSavedReportId(res.reportId);
      // Build printData client-side with full param details for grouping
      const fullPrintData = {
        ...res.report,
        patient_name: form.patient_name,
        age: parseInt(form.age) || 0,
        gender: form.gender,
        referred_by: form.referred_by,
        specimen: form.specimen,
        date_of_collection: form.date_of_collection,
        date_of_reporting: new Date().toISOString(),
        results: Object.entries(results).map(([uid, val]) => {
          const param = parameters.find(p => p.uid === uid);
          return {
            param_name: param?.param_name || '',
            result_value: val.result_value,
            is_abnormal: val.is_abnormal,
            unit: param?.unit || '',
            ref_range_male: param?.ref_range_male || '',
            ref_range_female: param?.ref_range_female || '',
            category_name: param?.category_name || '',
            group_name: param?.group_name || '',
            specimen: param?.specimen || form.specimen || 'BLOOD',
          };
        }),
      };
      setPrintData(fullPrintData);
      addToast('Report saved successfully', 'success');

      // Print directly with report data (no ref/setTimeout needed)
      handlePrint(fullPrintData);
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
    setSaving(false);
  };

  const handlePrint = async (reportData) => {
    const data = reportData || printData;
    if (!data) return;
    const patientName = form.patient_name || 'Report';
    const reportHTML = renderReportToHTML(data, 'print');
    if (!reportHTML) return;

    // Electron: print directly without popup
    if (isElectron()) {
      const success = await electronPrint(reportHTML, { patientName });
      if (success) { addToast('Sent to printer', 'success'); }
      else { addToast('Print failed', 'error'); }
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { window.alert('Popup blocked!\\n\\nTo fix:\\n1. Click the blocked popup icon in the address bar\\n2. Select "Always allow popups"\\n3. Click the button again'); return; }
    printWindow.document.write(`
      <html>
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
            .page-footer { position: fixed; bottom: 25px; left: 0; right: 0; z-index: 2; background: #fff; }
          </style>
        </head>
        <body>${reportHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  const handleSaveAndDownloadPdf = async () => {
    if (!form.patient_name) { addToast('Patient name is required', 'warning'); return; }
    if (selectedTests.length === 0) { addToast('Select at least one test', 'warning'); return; }

    setSaving(true);
    try {
      const resultArr = Object.entries(results).map(([uid, val]) => {
        const param = parameters.find(p => p.uid === uid);
        return {
          parameter_id: param?.id || parseInt(uid),
          param_name: param?.param_name || '',
          result_value: val.result_value,
          is_abnormal: val.is_abnormal,
        };
      });

      const res = await api.createQuickReport({
        patient_name: form.patient_name,
        age: parseInt(form.age) || 0,
        gender: form.gender,
        phone: form.phone,
        referred_by: form.referred_by,
        specimen: form.specimen,
        test_ids: selectedTests,
        results: resultArr,
        date_of_collection: form.date_of_collection,
      });

      setSavedReportId(res.reportId);
      // Build printData client-side with full param details for grouping
      const fullPrintData = {
        ...res.report,
        patient_name: form.patient_name,
        age: parseInt(form.age) || 0,
        gender: form.gender,
        referred_by: form.referred_by,
        specimen: form.specimen,
        date_of_collection: form.date_of_collection,
        date_of_reporting: new Date().toISOString(),
        results: Object.entries(results).map(([uid, val]) => {
          const param = parameters.find(p => p.uid === uid);
          return {
            param_name: param?.param_name || '',
            result_value: val.result_value,
            is_abnormal: val.is_abnormal,
            unit: param?.unit || '',
            ref_range_male: param?.ref_range_male || '',
            ref_range_female: param?.ref_range_female || '',
            category_name: param?.category_name || '',
            group_name: param?.group_name || '',
            specimen: param?.specimen || form.specimen || 'BLOOD',
          };
        }),
      };
      setPrintData(fullPrintData);
      addToast('Report saved successfully', 'success');

      // Generate report HTML directly from data (no ref/setTimeout needed)
      const reportHTML = renderReportToHTML(fullPrintData, 'pdf');
      if (!reportHTML) return;

      const dateStr = new Date(form.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const fileName = `${form.patient_name}_${dateStr}.pdf`;
      const letterheadAbsUrl = `${window.location.origin}/letterhead.png`;

      // Electron: save directly to Downloads with correct filename
      if (isElectron()) {
        const filePath = await electronSavePDF(reportHTML, { patientName: form.patient_name, letterheadUrl: letterheadAbsUrl, fileName });
        if (filePath) {
          addToast(`PDF saved: ${fileName}`, 'success');
          window.electronAPI.file.openInExplorer(filePath);
        } else {
          addToast('PDF generation failed', 'error');
        }
        return;
      }

      // Web: open print dialog
      const pdfWindow = window.open('', '_blank', 'width=800,height=600');
      if (!pdfWindow) { window.alert('Popup blocked!\n\nTo fix:\n1. Click the blocked popup icon in the address bar\n2. Select "Always allow popups"\n3. Click the button again'); return; }
      pdfWindow.document.write(`
        <html><head><title>${fileName}</title>
        <style>
          @page { margin: 0; size: A4; }
          html, body { height: 100%; margin: 0; box-sizing: border-box; }
          body { font-family: 'Times New Roman', serif; padding: 0 10mm; color: #000; font-size: 12px; width: 210mm; min-width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { border-collapse: collapse; width: 100%; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          thead td, tfoot td { padding: 0; }
          .page-footer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 2; }
          .letterhead-bg { position: fixed; top: 0; left: 0; width: 210mm; height: 140px; z-index: -1; object-fit: cover; object-position: top; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        </style></head>
        <body><img class="letterhead-bg" src="${letterheadAbsUrl}" />${reportHTML}</body></html>
      `);
      pdfWindow.document.close();
      pdfWindow.focus();
      // Wait for letterhead image to load before printing
      const imgs = pdfWindow.document.images;
      if (imgs.length > 0) {
        let loaded = 0;
        const tryPrint = () => { loaded++; if (loaded >= imgs.length) setTimeout(() => pdfWindow.print(), 200); };
        for (let i = 0; i < imgs.length; i++) {
          if (imgs[i].complete) { tryPrint(); } else { imgs[i].onload = tryPrint; imgs[i].onerror = tryPrint; }
        }
      } else {
        setTimeout(() => { pdfWindow.print(); }, 400);
      }
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
    setSaving(false);
  };

  const handleReset = () => {
    setForm({ patient_name: '', age: '', gender: '', phone: '', referred_by: 'SELF', specimen: 'BLOOD', date_of_collection: new Date().toISOString().split('T')[0] });
    setSelectedTests([]);
    setSelectedGroups({});
    setExpandedTests({});
    setParameters([]);
    setResults({});
    setSavedReportId(null);
    setPrintData(null);
  };

  const handleShareWhatsApp = async () => {
    if (!form.patient_name) { addToast('Patient name is required', 'warning'); return; }
    if (selectedTests.length === 0) { addToast('Select at least one test', 'warning'); return; }

    setSaving(true);
    try {
      // Build report data from form (don't save yet)
      let reportData = printData;
      const needsSave = !reportData;
      if (needsSave) {
        reportData = {
          patient_name: form.patient_name,
          age: parseInt(form.age) || 0,
          gender: form.gender,
          referred_by: form.referred_by,
          specimen: form.specimen,
          date_of_collection: form.date_of_collection,
          date_of_reporting: new Date().toISOString(),
          created_at: new Date().toISOString(),
          results: Object.entries(results).map(([uid, val]) => {
            const param = parameters.find(p => p.uid === uid);
            return {
              param_name: param?.param_name || '',
              result_value: val.result_value,
              is_abnormal: val.is_abnormal,
              unit: param?.unit || '',
              ref_range_male: param?.ref_range_male || '',
              ref_range_female: param?.ref_range_female || '',
              category_name: param?.category_name || '',
              group_name: param?.group_name || '',
              specimen: param?.specimen || form.specimen || 'BLOOD',
            };
          }),
        };
      }

      const dateStr = new Date(form.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const fileName = `${form.patient_name || 'Report'}_${dateStr}.pdf`;
      const letterheadUrl = `${window.location.origin}/letterhead.png`;

      // Electron: generate PDF locally + save to Downloads + open WhatsApp directly
      if (isElectron()) {
        addToast('Generating PDF...', 'info');
        const reportHTML = renderReportToHTML(reportData);
        const filePath = await electronShareWhatsApp(reportHTML, {
          patientName: form.patient_name,
          letterheadUrl,
          fileName,
          phone: form.phone || '',
        });
        if (!filePath) throw new Error('Local PDF generation failed');
        addToast(`PDF copied! Press Ctrl+V in WhatsApp to attach`, 'success');
        // Save report to DB after share
        if (needsSave) {
          const resultArr = Object.entries(results).map(([uid, val]) => {
            const param = parameters.find(p => p.uid === uid);
            return { parameter_id: param?.id || parseInt(uid), param_name: param?.param_name || '', result_value: val.result_value, is_abnormal: val.is_abnormal };
          });
          const res = await api.createQuickReport({
            patient_name: form.patient_name, age: parseInt(form.age) || 0, gender: form.gender, phone: form.phone,
            referred_by: form.referred_by, specimen: form.specimen, test_ids: selectedTests, results: resultArr, date_of_collection: form.date_of_collection,
          });
          setSavedReportId(res.reportId);
          setPrintData(res.report);
          addToast('Report saved', 'success');
        }
        setSaving(false);
        return;
      }

      // Web: use server endpoint
      addToast('Generating PDF...', 'info');
      const pdfRes = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportData, letterheadUrl }),
      });
      if (!pdfRes.ok) {
        const err = await pdfRes.json().catch(() => ({ error: 'PDF generation failed' }));
        throw new Error(err.error || 'PDF generation failed');
      }
      const pdfBlob = await pdfRes.blob();
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Store file and show "Tap to Share" modal
      setShareReady({ files: [file], label: `Lab Report - ${form.patient_name}`, needsSave });
      addToast('PDF ready! Tap "Tap to Share" to send.', 'success');
    } catch (err) {
      addToast('Share failed: ' + err.message, 'error');
    }
    setSaving(false);
  };

  // Called by the "Tap to Share" button — fresh user gesture
  const handleShareNow = async () => {
    if (!shareReady) return;
    const { files, label, needsSave } = shareReady;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    let shared = false;
    if (isMobile && navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: label, text: label });
        shared = true;
        addToast('Shared successfully', 'success');
      } catch (err) {
        if (err.name === 'AbortError') { setShareReady(null); return; }
        addToast('Share failed: ' + err.message, 'error');
      }
    }
    if (!shared) {
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      window.open(`whatsapp://send?text=${encodeURIComponent(label)}`, '_self');
      addToast('PDF downloaded. Attach it in WhatsApp.', 'info');
      shared = true;
    }

    // Save report after successful share
    if (shared && needsSave) {
      try {
        const resultArr = Object.entries(results).map(([uid, val]) => {
          const param = parameters.find(p => p.uid === uid);
          return { parameter_id: param?.id || parseInt(uid), param_name: param?.param_name || '', result_value: val.result_value, is_abnormal: val.is_abnormal };
        });
        const res = await api.createQuickReport({
          patient_name: form.patient_name, age: parseInt(form.age) || 0, gender: form.gender, phone: form.phone,
          referred_by: form.referred_by, specimen: form.specimen, test_ids: selectedTests, results: resultArr, date_of_collection: form.date_of_collection,
        });
        setSavedReportId(res.reportId);
        setPrintData(res.report);
        addToast('Report saved', 'success');
      } catch (err) {
        addToast('Failed to save report: ' + err.message, 'error');
      }
    }
    setShareReady(null);
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Referred By</label>
                  <input type="text" className="input-field text-sm" value={form.referred_by} onChange={e => setForm({ ...form, referred_by: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Specimen</label>
                  <input type="text" className="input-field text-sm" value={form.specimen} onChange={e => setForm({ ...form, specimen: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date of Collection</label>
                <input type="date" className="input-field text-sm" value={form.date_of_collection} onChange={e => setForm({ ...form, date_of_collection: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Test Selection - Hierarchical Tree */}
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
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
              {Object.entries(filteredTestsByCategory).map(([cat, catTests]) => {
                const isCatCollapsed = collapsedGroups[`cat__${cat}`];
                return (
                <div key={cat} className="mb-1">
                  <div
                    className="flex items-center gap-1 cursor-pointer select-none py-1.5 hover:bg-gray-50 rounded px-1"
                    onClick={() => setCollapsedGroups(prev => ({ ...prev, [`cat__${cat}`]: !prev[`cat__${cat}`] }))}
                  >
                    {isCatCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                    <p className="text-xs font-bold text-gray-700 uppercase">{cat}</p>
                  </div>
                  {!isCatCollapsed && catTests.map(test => {
                    const groups = getTestGroups(test);
                    const hasSubGroups = groups.length > 1;
                    const checkState = getTestCheckState(test._id);
                    const isExpanded = expandedTests[test._id];

                    return (
                    <div key={test._id} className="ml-2">
                      {/* Test Row */}
                      <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-all ${
                        checkState !== 'none' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                      }`}>
                        {/* Expand Arrow */}
                        {hasSubGroups ? (
                          <button
                            type="button"
                            className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); setExpandedTests(prev => ({ ...prev, [test._id]: !prev[test._id] })); }}
                          >
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                        ) : (
                          <span className="w-4" />
                        )}
                        {/* Test Checkbox */}
                        <button
                          type="button"
                          className="flex items-center gap-2 flex-1 text-left"
                          onClick={() => toggleTest(test._id)}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                            checkState === 'all' ? 'bg-primary-600 border-primary-600' :
                            checkState === 'partial' ? 'bg-primary-400 border-primary-400' : 'border-gray-300'
                          }`}>
                            {checkState === 'all' && <Check className="w-2.5 h-2.5 text-white" />}
                            {checkState === 'partial' && <Minus className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="truncate font-medium">{test.name}</span>
                        </button>
                      </div>

                      {/* Sub-groups (expanded) */}
                      {hasSubGroups && isExpanded && (
                        <div className="ml-6 border-l border-gray-200 pl-2 my-0.5">
                          {groups.map(groupName => {
                            const isGroupSelected = (selectedGroups[test._id] || []).includes(groupName);
                            return (
                              <button
                                key={groupName}
                                type="button"
                                onClick={() => toggleSubGroup(test._id, groupName)}
                                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left mb-0.5 transition-all ${
                                  isGroupSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                                  isGroupSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                }`}>
                                  {isGroupSelected && <Check className="w-2 h-2 text-white" />}
                                </div>
                                <span className="truncate">{groupName}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
                );
              })}
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
                    {Object.entries(groups).map(([groupName, params]) => {
                      const groupKey = `${categoryName}__${groupName}`;
                      const isCollapsed = collapsedGroups[groupKey];
                      return (
                      <div key={groupName}>
                        <div
                          className="px-3 sm:px-4 py-2 bg-gray-50 flex items-center justify-between cursor-pointer select-none hover:bg-gray-100 transition-colors"
                          onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                        >
                          <span className="text-xs font-bold text-gray-700">{groupName}</span>
                          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-500" />}
                        </div>
                        {!isCollapsed && params.map(param => {
                          const refRange = form.gender === 'Female' ? param.ref_range_female : param.ref_range_male;
                          const abnFlag = results[param.uid]?.is_abnormal || false;
                          return (
                            <div key={param.uid} className={`grid grid-cols-12 items-center px-3 sm:px-4 py-1.5 sm:py-2 ${abnFlag ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                              <div className="col-span-4 text-xs text-gray-700 pl-1 sm:pl-2 truncate">{param.param_name}</div>
                              <div className="col-span-3">
                                <input
                                  type="text"
                                  className={`w-full px-2 py-1 border rounded text-xs text-center focus:ring-1 focus:ring-primary-500 outline-none ${abnFlag ? 'border-red-300 text-red-700 font-bold' : 'border-gray-200'}`}
                                  value={results[param.uid]?.result_value || ''}
                                  onChange={e => updateResult(param.uid, e.target.value, param.ref_range_male, param.ref_range_female)}
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
                      );
                    })}
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
              <button onClick={handleShareWhatsApp} disabled={saving} className="w-full mt-2 flex items-center gap-2 justify-center py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50">
                <Share2 className="w-4 h-4" />
                Save & Share on WhatsApp
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hidden Print Component */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <PrintableReport ref={printRef} report={printData} mode="print" />
      </div>
      {/* Hidden PDF Component */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <PrintableReport ref={pdfRef} report={printData} mode="pdf" />
      </div>

      {/* Floating "Tap to Share" modal */}
      {shareReady && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center" onClick={() => setShareReady(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-center text-gray-700 font-medium mb-1">
              {shareReady.files.length} PDF{shareReady.files.length > 1 ? 's' : ''} ready
            </p>
            <p className="text-center text-gray-400 text-sm mb-4">Tap below to share via WhatsApp</p>
            <button
              onClick={handleShareNow}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Tap to Share
            </button>
            <button onClick={() => setShareReady(null)} className="w-full mt-2 py-2 text-gray-500 text-sm hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
