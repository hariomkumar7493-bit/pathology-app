import { useState, useEffect, useRef } from 'react';
import { Search, Download, Eye, FileText, CheckCircle, Clock, AlertCircle, Printer, X, Save, Trash2, Edit3, Plus, TestTubes, Share2 } from 'lucide-react';
import { api } from '../api';
import PrintableReport from '../components/PrintableReport';
import { useToast } from '../context/ToastContext';
import { isElectron } from '../utils/electron';
import { electronPrint, electronShareWhatsApp, electronSavePDF, renderReportToHTML } from '../utils/electronPrint';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [viewReport, setViewReport] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editResults, setEditResults] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPrintData, setBulkPrintData] = useState([]);
  const [showAddTest, setShowAddTest] = useState(false);
  const [allTests, setAllTests] = useState([]);
  const [addTestSearch, setAddTestSearch] = useState('');
  const [shareReady, setShareReady] = useState(null); // { files: File[], label: string }
  const [layoutSettings, setLayoutSettings] = useState(null);
  const bulkPrintRef = useRef();
  const printRef = useRef();
  const pdfRef = useRef();
  const { addToast } = useToast();

  useEffect(() => {
    loadReports();
    api.getReportLayout().then(setLayoutSettings).catch(() => {});
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const data = await api.getReports();
      setReports(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.investigation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.ref_no?.includes(searchTerm);
    const matchesStatus = statusFilter === 'All' || report.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleViewReport = async (reportId) => {
    setViewLoading(true);
    try {
      const full = await api.getReport(reportId);
      setViewReport(full);
      // Initialize edit results
      const init = {};
      (full.results || []).forEach((r, idx) => {
        init[idx] = { result_value: r.result_value || '', is_abnormal: r.is_abnormal };
      });
      setEditResults(init);
    } catch (err) {
      alert('Failed to load report: ' + err.message);
    }
    setViewLoading(false);
  };

  // Auto-detect abnormal based on reference range
  function isAbnormal(value, refRange) {
    if (!value || !refRange) return false;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return false;

    // Try patterns like "4.0 - 10.0", "0.2 - 1.2", "150000 - 400000"
    const rangeMatch = refRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
    if (rangeMatch) {
      const low = parseFloat(rangeMatch[1]);
      const high = parseFloat(rangeMatch[2]);
      if (!isNaN(low) && !isNaN(high)) {
        return numVal < low || numVal > high;
      }
    }
    // Try "< 200" or "< 150"
    const ltMatch = refRange.match(/<\s*([\d.]+)/);
    if (ltMatch) {
      return numVal >= parseFloat(ltMatch[1]);
    }
    // Try "> 40" or "> 20"
    const gtMatch = refRange.match(/>\s*([\d.]+)/);
    if (gtMatch) {
      return numVal <= parseFloat(gtMatch[1]);
    }
    return false;
  }

  const handleResultChange = (resultId, value, refRangeMale, refRangeFemale) => {
    const refRange = viewReport?.gender === 'Female' ? refRangeFemale : refRangeMale;
    const abnormal = isAbnormal(value, refRange);
    setEditResults(prev => ({ ...prev, [resultId]: { result_value: value, is_abnormal: abnormal } }));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredReports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReports.map(r => r._id));
    }
  };

  const handleBulkPrint = async () => {
    if (selectedIds.length === 0) { addToast('Select at least one report', 'warning'); return; }
    try {
      const reports = await Promise.all(selectedIds.map(id => api.getReport(id)));
      setBulkPrintData(reports);
      // Generate HTML directly from data (no ref/setTimeout needed)
      const bulkHTML = reports.map(r => renderReportToHTML(r, 'print', layoutSettings?.print)).filter(Boolean).join('<div class="page-break"></div>');
      if (!bulkHTML) return;
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) { window.alert('Popup blocked!\n\nTo fix:\n1. Click the blocked popup icon in the address bar\n2. Select "Always allow popups"\n3. Click the button again'); return; }
      const lsBulk = layoutSettings?.print || {};
      printWindow.document.write(`
        <html><head><title>Lab Reports - Bulk Print</title>
        <style>
          @page { margin: 0; size: A4; }
          html, body { height: 100%; margin: 0; box-sizing: border-box; }
          body { font-family: 'Times New Roman', serif; padding: 0 ${lsBulk.bodyPaddingLeft ?? 10}mm 0 ${lsBulk.bodyPaddingRight ?? 10}mm; color: #000; font-size: ${lsBulk.bodyFontSize ?? 12}px; width: 210mm; min-width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { border-collapse: collapse; width: 100%; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          thead td, tfoot td { padding: 0; }
          .page-footer { position: fixed; bottom: 25px; left: 0; right: 0; z-index: 2; background: #fff; }
          .page-break { page-break-after: always; }
        </style></head>
        <body>${bulkHTML}</body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
    } catch (err) {
      addToast('Failed to load reports: ' + err.message, 'error');
    }
  };

  const handleBulkShare = async () => {
    if (selectedIds.length === 0) { addToast('Select at least one report', 'warning'); return; }
    setSaving(true);
    try {
      addToast('Generating PDFs...', 'info');
      const reportsData = await Promise.all(selectedIds.map(id => api.getReport(id)));
      const letterheadUrl = `${window.location.origin}/letterhead.png`;
      const files = [];

      if (isElectron()) {
        // Electron: generate PDFs locally (instant, no server)
        const { generatePDFLocal } = await import('../utils/electron');
        const { buildPrintHTML } = await import('../utils/electronPrint');
        for (const report of reportsData) {
          const dateStr = new Date(report.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
          const fileName = `${report.patient_name || 'Report'}_${dateStr}.pdf`;
          const reportHTML = renderReportToHTML(report, 'pdf', layoutSettings?.pdf);
          const html = buildPrintHTML(reportHTML, { patientName: report.patient_name, mode: 'pdf', letterheadUrl });
          const file = await generatePDFLocal(html, fileName);
          if (file) files.push(file);
        }
      } else {
        // Web: use server endpoint
        for (const report of reportsData) {
          const pdfRes = await fetch('/api/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report, letterheadUrl }),
          });
          if (!pdfRes.ok) continue;
          const pdfBlob = await pdfRes.blob();
          const dateStr = new Date(report.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
          const fileName = `${report.patient_name || 'Report'}_${dateStr}.pdf`;
          files.push(new File([pdfBlob], fileName, { type: 'application/pdf' }));
        }
      }

      if (files.length === 0) { addToast('Failed to generate PDFs', 'error'); setSaving(false); return; }

      // Store files and show "Tap to Share" button (fresh user gesture needed)
      setShareReady({ files, label: `Lab Reports (${files.length})` });
      addToast('PDFs ready! Tap "Tap to Share" to send.', 'success');
    } catch (err) {
      addToast('Share failed: ' + err.message, 'error');
    }
    setSaving(false);
  };

  // Called by the "Tap to Share" button — fresh user gesture
  const handleShareNow = async () => {
    if (!shareReady) return;
    const { files, label } = shareReady;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: label, text: label });
        addToast('Shared successfully', 'success');
      } catch (err) {
        if (err.name === 'AbortError') { setShareReady(null); return; }
        addToast('Share failed: ' + err.message, 'error');
      }
    } else {
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      window.open(`whatsapp://send?text=${encodeURIComponent(label)}`, '_self');
      addToast('PDF(s) downloaded. Attach in WhatsApp.', 'info');
    }
    setShareReady(null);
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      await api.deleteReport(reportId);
      loadReports();
      if (viewReport?._id === reportId) setViewReport(null);
      addToast('Report deleted successfully', 'success');
    } catch (err) {
      addToast('Failed to delete: ' + err.message, 'error');
    }
  };

  const handlePrint = async () => {
    if (!viewReport) return;
    const patientName = viewReport?.patient_name || 'Report';
    const reportHTML = renderReportToHTML(viewReport, 'print', layoutSettings?.print);
    if (!reportHTML) return;

    // Electron: print directly without popup
    if (isElectron()) {
      const success = await electronPrint(reportHTML, { patientName });
      if (success) { addToast('Sent to printer', 'success'); }
      else { addToast('Print failed', 'error'); }
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { window.alert('Popup blocked!\n\nTo fix:\n1. Click the blocked popup icon in the address bar\n2. Select "Always allow popups"\n3. Click the button again'); return; }
    const lsPrint = layoutSettings?.print || {};
    printWindow.document.write(`
      <html>
        <head>
          <title>${patientName} - Lab Report</title>
          <style>
            @page { margin: 0; size: A4; }
            html, body { height: 100%; margin: 0; box-sizing: border-box; }
            body { font-family: 'Times New Roman', serif; padding: 0 ${lsPrint.bodyPaddingLeft ?? 10}mm 0 ${lsPrint.bodyPaddingRight ?? 10}mm; color: #000; font-size: ${lsPrint.bodyFontSize ?? 12}px; width: 210mm; min-width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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

  const handleDownloadPdf = (report) => {
    if (!report) return;
    const reportHTML = renderReportToHTML(report, 'pdf', layoutSettings?.pdf);
    if (!reportHTML) return;

    const dateStr = new Date(report.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const fileName = `${report.patient_name}_${dateStr}`;

    const pdfWindow = window.open('', '_blank', 'width=800,height=600');
    if (!pdfWindow) { window.alert('Popup blocked!\n\nTo fix:\n1. Click the blocked popup icon in the address bar\n2. Select "Always allow popups"\n3. Click the button again'); return; }
    const letterheadAbsUrl = `${window.location.origin}/letterhead.png`;
    const lsDl = layoutSettings?.pdf || {};
    pdfWindow.document.write(`
      <html>
        <head>
          <title>${fileName}</title>
          <style>
            @page { margin: 0; size: A4; }
            html, body { height: 100%; margin: 0; box-sizing: border-box; }
            body { font-family: 'Times New Roman', serif; padding: 0 ${lsDl.bodyPaddingLeft ?? 10}mm 0 ${lsDl.bodyPaddingRight ?? 10}mm; color: #000; font-size: ${lsDl.bodyFontSize ?? 12}px; width: 210mm; min-width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table { border-collapse: collapse; width: 100%; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            thead td, tfoot td { padding: 0; }
            .page-footer { position: fixed; bottom: ${lsDl.footerBottomOffset ?? 5}mm; left: 0; right: 0; z-index: 2; }
            .letterhead-bg { position: fixed; top: 0; left: 0; width: 210mm; height: ${lsDl.letterheadHeight ?? 140}px; z-index: -1; object-fit: cover; object-position: top; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body><img class="letterhead-bg" src="${letterheadAbsUrl}" />${reportHTML}</body>
      </html>
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
  };

  const handleShareWhatsApp = async (report) => {
    if (!report) return;
    try {
      addToast('Generating PDF...', 'info');
      const letterheadUrl = `${window.location.origin}/letterhead.png`;
      const dateStr = new Date(report.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const fileName = `${report.patient_name || 'Report'}_${dateStr}.pdf`;

      // Electron: generate PDF locally using renderReportToHTML (same as Download PDF)
      if (isElectron()) {
        const reportHTML = renderReportToHTML(report, 'pdf', layoutSettings?.pdf);
        if (!reportHTML) { throw new Error('Failed to render report HTML'); }
        const filePath = await electronShareWhatsApp(reportHTML, {
          patientName: report.patient_name,
          letterheadUrl,
          fileName,
          phone: report.phone || '',
          layoutSettings: layoutSettings?.pdf,
        });
        if (!filePath) throw new Error('Local PDF generation failed');
        addToast(`PDF copied! Press Ctrl+V in WhatsApp to attach`, 'success');
        return;
      }

      // Web: use server endpoint
      const pdfRes = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, letterheadUrl, layoutSettings: layoutSettings?.pdf }),
      });
      if (!pdfRes.ok) {
        const err = await pdfRes.json().catch(() => ({ error: 'PDF generation failed' }));
        throw new Error(err.error || 'PDF generation failed');
      }
      const pdfBlob = await pdfRes.blob();
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Store file and show "Tap to Share" button
      setShareReady({ files: [file], label: `Lab Report - ${report.patient_name}` });
      addToast('PDF ready! Tap "Tap to Share" to send.', 'success');
    } catch (err) {
      addToast('Share failed: ' + err.message, 'error');
    }
  };

  const handleSaveResults = async () => {
    setSaving(true);
    try {
      const resultsArr = Object.entries(editResults).map(([id, val]) => ({
        id: parseInt(id),
        result_value: val.result_value,
        is_abnormal: val.is_abnormal,
      }));
      await api.updateReportResults(viewReport._id, { results: resultsArr, status: 'Completed' });
      // Refresh report
      const updated = await api.getReport(viewReport._id);
      setViewReport(updated);
      setEditMode(false);
      loadReports();
      addToast('Results saved successfully', 'success');
    } catch (err) {
      addToast('Failed to save: ' + err.message, 'error');
    }
    setSaving(false);
  };

  const handleAddTest = async (testId) => {
    try {
      await api.addTestToReport(viewReport._id, testId);
      const updated = await api.getReport(viewReport._id);
      setViewReport(updated);
      setShowAddTest(false);
      setAddTestSearch('');
      addToast('Test added successfully', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleRemoveTest = async (testId) => {
    if (!window.confirm('Remove this test and all its results from the report?')) return;
    try {
      await api.removeTestFromReport(viewReport._id, testId);
      const updated = await api.getReport(viewReport._id);
      setViewReport(updated);
      addToast('Test removed successfully', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const openAddTest = async () => {
    if (allTests.length === 0) {
      const tests = await api.getTests();
      setAllTests(tests);
    }
    setShowAddTest(true);
  };

  const statusCounts = {
    Completed: reports.filter(r => r.status === 'Completed').length,
    Pending: reports.filter(r => r.status === 'Pending').length,
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-1">View, edit, and print test reports</p>
        </div>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={handleBulkPrint} className="btn-primary flex items-center gap-2 w-fit">
              <Printer className="w-4 h-4" />
              Print ({selectedIds.length})
            </button>
            <button onClick={handleBulkShare} disabled={saving} className="flex items-center gap-2 w-fit px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
              <Share2 className="w-4 h-4" />
              {saving ? 'Sharing...' : `WhatsApp (${selectedIds.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
            <p className="text-sm text-gray-500">Total Reports</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{statusCounts.Completed}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{statusCounts.Pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, test, or ref no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="All">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked={selectedIds.length === filteredReports.length && filteredReports.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ref No</th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Patient</th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Investigation</th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReports.map((report) => (
                <tr key={report._id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(report._id) ? 'bg-primary-50' : ''}`}>
                  <td className="px-4 py-4">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked={selectedIds.includes(report._id)} onChange={() => toggleSelect(report._id)} />
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-mono font-medium text-gray-700">{report.ref_no}</span>
                    <p className="text-xs text-gray-500 sm:hidden">{report.patient_name}</p>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary-700">
                          {report.patient_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-900">{report.patient_name}</span>
                        <p className="text-xs text-gray-500">{report.age} / {report.gender}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-sm text-gray-700 truncate block max-w-xs">{report.investigation || '-'}</span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-600">
                      {new Date(report.date_of_collection).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      report.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {report.status === 'Completed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleViewReport(report._id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View / Print"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => { handleViewReport(report._id); setTimeout(() => setEditMode(true), 500); }}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Results"
                      >
                        <Edit3 className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteReport(report._id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Report"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredReports.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No reports found.</p>
          </div>
        )}
      </div>

      {/* View/Edit/Print Report Modal */}
      {(viewReport || viewLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl p-6 m-4 max-h-[95vh] overflow-y-auto">
            {viewLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">
                    Report #{viewReport.ref_no} - {viewReport.patient_name}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {!editMode && (
                      <button onClick={() => setEditMode(true)} className="btn-secondary flex items-center gap-1 text-xs">
                        <Edit3 className="w-3.5 h-3.5" /> Edit Results
                      </button>
                    )}
                    {editMode && (
                      <>
                        <button onClick={() => setEditMode(false)} className="btn-secondary flex items-center gap-1 text-xs">
                          Cancel
                        </button>
                        <button onClick={handleSaveResults} disabled={saving} className="btn-primary flex items-center gap-1 text-xs disabled:opacity-50">
                          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDownloadPdf(viewReport)} className="btn-secondary flex items-center gap-1 text-xs">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button onClick={() => handleShareWhatsApp(viewReport)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors">
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                    <button onClick={handlePrint} className="btn-primary flex items-center gap-1 text-xs">
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                    <button onClick={() => { setViewReport(null); setEditMode(false); }} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Patient Info Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm bg-gray-50 p-4 rounded-lg">
                  <div><span className="text-gray-500">Patient:</span> <span className="font-medium">{viewReport.patient_name}</span></div>
                  <div><span className="text-gray-500">Age/Sex:</span> <span className="font-medium">{viewReport.age} / {viewReport.gender}</span></div>
                  <div><span className="text-gray-500">Ref By:</span> <span className="font-medium">{viewReport.referred_by || 'SELF'}</span></div>
                  <div><span className="text-gray-500">Status:</span> <span className={`font-medium ${viewReport.status === 'Completed' ? 'text-green-600' : 'text-yellow-600'}`}>{viewReport.status}</span></div>
                </div>

                {/* Manage Tests */}
                {editMode && (
                  <div className="mb-4 border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <TestTubes className="w-4 h-4 text-primary-600" /> Tests in Report
                      </h4>
                      <button onClick={openAddTest} className="btn-secondary flex items-center gap-1 text-xs py-1 px-2">
                        <Plus className="w-3.5 h-3.5" /> Add Test
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(viewReport.tests || []).map(t => (
                        <div key={t.test_id} className="flex items-center gap-1.5 bg-primary-50 text-primary-700 text-xs font-medium px-2.5 py-1.5 rounded-full">
                          <span>{t.test_name}</span>
                          <button
                            onClick={() => handleRemoveTest(t.test_id)}
                            className="hover:bg-primary-200 rounded-full p-0.5 transition-colors"
                            title="Remove test"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Add Test Dropdown */}
                    {showAddTest && (
                      <div className="mt-3 border rounded-lg p-2 bg-white shadow-sm">
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search tests..."
                            className="input-field text-xs pl-7 py-1.5"
                            value={addTestSearch}
                            onChange={e => setAddTestSearch(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-0.5">
                          {allTests
                            .filter(t => t.name.toLowerCase().includes(addTestSearch.toLowerCase()))
                            .filter(t => !(viewReport.tests || []).find(rt => rt.test_id === t._id))
                            .map(t => (
                              <button
                                key={t._id}
                                onClick={() => handleAddTest(t._id)}
                                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-primary-50 hover:text-primary-700 transition-colors"
                              >
                                {t.name}
                              </button>
                            ))}
                        </div>
                        <button onClick={() => { setShowAddTest(false); setAddTestSearch(''); }} className="mt-2 text-xs text-gray-500 hover:text-gray-700">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Results Table */}
                {editMode ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase">
                      <div className="col-span-4">Parameter</div>
                      <div className="col-span-3 text-center">Result</div>
                      <div className="col-span-1 text-center">Unit</div>
                      <div className="col-span-3 text-center">Ref Range</div>
                      <div className="col-span-1 text-center">Abn</div>
                    </div>
                    {(viewReport.results || []).map((r, idx) => {
                      const refRange = viewReport.gender === 'Female' ? r.ref_range_female : r.ref_range_male;
                      const abnFlag = editResults[idx]?.is_abnormal || false;
                      return (
                        <div key={idx} className={`grid grid-cols-12 items-center px-4 py-1.5 border-b border-gray-100 last:border-0 ${abnFlag ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                          <div className="col-span-4 text-xs text-gray-700">{r.param_name}</div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              className={`w-full px-2 py-1 border rounded text-xs text-center focus:ring-1 focus:ring-primary-500 outline-none ${abnFlag ? 'border-red-300 text-red-700 font-bold' : 'border-gray-200'}`}
                              value={editResults[idx]?.result_value || ''}
                              onChange={e => handleResultChange(idx, e.target.value, r.ref_range_male, r.ref_range_female)}
                            />
                          </div>
                          <div className="col-span-1 text-xs text-gray-500 text-center">{r.unit || ''}</div>
                          <div className="col-span-3 text-xs text-gray-500 text-center">{refRange || ''}</div>
                          <div className="col-span-1 text-center">
                            <span className={`inline-block w-3 h-3 rounded-full ${abnFlag ? 'bg-red-500' : 'bg-green-400'}`} title={abnFlag ? 'Abnormal' : 'Normal'}></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Read-only preview */
                  <PrintableReport ref={printRef} report={viewReport} layoutSettings={layoutSettings?.print} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden print ref for non-edit mode */}
      {viewReport && editMode && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <PrintableReport ref={printRef} report={viewReport} mode="print" layoutSettings={layoutSettings?.print} />
        </div>
      )}

      {/* Hidden PDF ref */}
      {viewReport && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <PrintableReport ref={pdfRef} report={viewReport} mode="pdf" layoutSettings={layoutSettings?.pdf} />
        </div>
      )}

      {/* Hidden bulk print container */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }} ref={bulkPrintRef}>
        {bulkPrintData.map((rpt, idx) => (
          <div key={rpt._id || idx} className={idx < bulkPrintData.length - 1 ? 'page-break' : ''}>
            <PrintableReport report={rpt} layoutSettings={layoutSettings?.print} />
          </div>
        ))}
      </div>

      {/* Floating "Tap to Share" button */}
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
