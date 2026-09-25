import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Eye, FileText, CheckCircle, Clock, Printer, X, Download, Share2,
  CalendarDays, ArrowUp, ArrowDown, ArrowUpDown, Stethoscope, Calendar, History,
} from 'lucide-react';
import { api } from '../api';
import PrintableReport from '../components/PrintableReport';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { isElectron, getAssetUrl } from '../utils/electron';
import { electronPrint, electronShareWhatsApp, electronSavePDF, renderReportToHTML } from '../utils/electronPrint';
import { isMobileApp, mobileSharePDF, mobileOpenPDF } from '../utils/mobileShare';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('today'); // 'today' | 'history'
  const [searchTerm, setSearchTerm] = useState('');
  const [viewReport, setViewReport] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [layoutSettings, setLayoutSettings] = useState(null);
  const [shareReady, setShareReady] = useState(null);
  const [sortField, setSortField] = useState('date_of_collection');
  const [sortDir, setSortDir] = useState('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const printRef = useRef();
  const pdfRef = useRef();
  const { addToast } = useToast();
  const { registerCommands } = useVoice();

  useEffect(() => {
    loadReports();
    api.getReportLayout().then(setLayoutSettings).catch((err) => console.error('Layout load failed:', err));
  }, []);

  // Voice command handler for Doctor Dashboard (intent-based)
  useEffect(() => {
    const handler = (intent) => {
      if (intent.intent === 'search') {
        setSearchTerm(intent.query);
        return `Searching for ${intent.query}`;
      }
      if (intent.intent === 'view_tab') {
        setView(intent.value);
        return intent.value === 'today' ? "Showing today's reports" : 'Showing report history';
      }
      return null;
    };
    return registerCommands('doctor-dashboard', handler);
  }, [registerCommands]);

  async function loadReports() {
    setLoading(true);
    try {
      const data = await api.getReports();
      // Doctor sees only reports referred by their linked referring doctor name
      const doctorName = user?.referring_doctor_name;
      const filtered = doctorName ? data.filter(r => r.referred_by === doctorName) : data;
      setReports(filtered);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const todayReports = useMemo(
    () => reports.filter((r) => (r.date_of_collection || '').slice(0, 10) === todayStr),
    [reports, todayStr]
  );

  const filteredReports = useMemo(() => {
    let pool = view === 'today' ? todayReports : reports;
    const filtered = pool.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.investigation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ref_no?.includes(searchTerm);
      const rowDate = r.date_of_collection ? r.date_of_collection.slice(0, 10) : '';
      const matchesFrom = !dateFrom || rowDate >= dateFrom;
      const matchesTo = !dateTo || rowDate <= dateTo;
      return matchesSearch && matchesFrom && matchesTo;
    });
    return [...filtered].sort((a, b) => {
      let aVal = a[sortField] ?? '';
      let bVal = b[sortField] ?? '';
      if (sortField === 'ref_no') { aVal = parseInt(aVal) || 0; bVal = parseInt(bVal) || 0; }
      else { aVal = String(aVal).toLowerCase(); bVal = String(bVal).toLowerCase(); }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [view, todayReports, reports, searchTerm, dateFrom, dateTo, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 ml-1 text-primary-600" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1 text-primary-600" />;
  };

  const handleViewReport = async (reportId) => {
    setViewLoading(true);
    try {
      const full = await api.getReport(reportId);
      setViewReport(full);
    } catch (err) {
      addToast('Failed to load report: ' + err.message, 'error');
    }
    setViewLoading(false);
  };

  const handlePrint = async () => {
    if (!viewReport) return;
    const patientName = viewReport?.patient_name || 'Report';
    const reportHTML = renderReportToHTML(viewReport, 'print', layoutSettings?.print);
    if (!reportHTML) return;

    if (isElectron()) {
      const success = await electronPrint(reportHTML, { patientName });
      if (success) addToast('Sent to printer', 'success');
      else addToast('Print failed', 'error');
      return;
    }

    if (isMobileApp()) {
      addToast('Generating PDF...', 'info');
      const letterheadUrl = getAssetUrl('letterhead.png');
      const dateStr = new Date(viewReport.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const fileName = `${viewReport.patient_name || 'Report'}_${dateStr}.pdf`;
      const pdfRes = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: viewReport, letterheadUrl, layoutSettings: layoutSettings?.pdf }),
      });
      if (!pdfRes.ok) throw new Error('PDF generation failed');
      const pdfBlob = await pdfRes.blob();
      await mobileOpenPDF(pdfBlob, fileName);
      addToast('PDF opened - use your printer app', 'success');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { window.alert('Popup blocked! Allow popups for this site.'); return; }
    const lsPrint = layoutSettings?.print || {};
    printWindow.document.write(`
      <html><head><title>${patientName} - Lab Report</title>
      <style>
        @page { margin: 0; size: A4; }
        html, body { height: 100%; margin: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; padding: 0 ${lsPrint.bodyPaddingLeft ?? 10}mm 0 ${lsPrint.bodyPaddingRight ?? 10}mm; color: #000; font-size: ${lsPrint.bodyFontSize ?? 12}px; width: 210mm; min-width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        table { border-collapse: collapse; width: 100%; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        thead td, tfoot td { padding: 0; }
        .page-footer { position: fixed; bottom: 25px; left: 0; right: 0; z-index: 2; background: #fff; }
      </style></head>
      <body>${reportHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  const handleDownloadPdf = async (report) => {
    if (!report) return;
    const dateStr = new Date(report.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const fileName = `${report.patient_name}_${dateStr}.pdf`;
    const letterheadAbsUrl = getAssetUrl('letterhead.png');

    if (isElectron()) {
      const reportHTML = renderReportToHTML(report, 'pdf', layoutSettings?.pdf);
      if (!reportHTML) return;
      const filePath = await electronSavePDF(reportHTML, { patientName: report.patient_name, letterheadUrl: letterheadAbsUrl, fileName, layoutSettings: layoutSettings?.pdf });
      if (filePath) {
        addToast(`PDF saved: ${fileName}`, 'success');
        window.electronAPI.file.openInExplorer(filePath);
      } else {
        addToast('PDF generation failed', 'error');
      }
      return;
    }

    if (isMobileApp()) {
      addToast('Generating PDF...', 'info');
      const pdfRes = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, letterheadUrl: letterheadAbsUrl, layoutSettings: layoutSettings?.pdf }),
      });
      if (!pdfRes.ok) throw new Error('PDF generation failed');
      const pdfBlob = await pdfRes.blob();
      await mobileOpenPDF(pdfBlob, fileName);
      addToast('PDF saved and opened', 'success');
      return;
    }

    const reportHTML = renderReportToHTML(report, 'pdf', layoutSettings?.pdf);
    if (!reportHTML) return;
    const pdfWindow = window.open('', '_blank', 'width=800,height=600');
    if (!pdfWindow) { window.alert('Popup blocked! Allow popups for this site.'); return; }
    const lsDl = layoutSettings?.pdf || {};
    pdfWindow.document.write(`
      <html><head><title>${fileName}</title>
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
      </style></head>
      <body><img class="letterhead-bg" src="${letterheadAbsUrl}" />${reportHTML}</body></html>
    `);
    pdfWindow.document.close();
    pdfWindow.focus();
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
      const letterheadUrl = getAssetUrl('letterhead.png');
      const dateStr = new Date(report.date_of_collection || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const fileName = `${report.patient_name || 'Report'}_${dateStr}.pdf`;

      if (isElectron()) {
        const reportHTML = renderReportToHTML(report, 'pdf', layoutSettings?.pdf);
        if (!reportHTML) throw new Error('Failed to render report HTML');
        const result = await electronShareWhatsApp(reportHTML, {
          patientName: report.patient_name,
          letterheadUrl,
          fileName,
          phone: report.patient_phone || '',
          layoutSettings: layoutSettings?.pdf,
        });
        if (!result) throw new Error('Local PDF generation failed');
        if (result.autoPasted) addToast('PDF auto-attached in WhatsApp! Select contact and press Send', 'success');
        else if (result.clipboardOk) addToast('PDF copied! Press Ctrl+V in WhatsApp to attach', 'success');
        else addToast('PDF saved to Downloads. Attach it manually in WhatsApp', 'info');
        return;
      }

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

      if (isMobileApp()) {
        try {
          await mobileSharePDF([file], `Lab Report - ${report.patient_name}`);
          addToast('Shared successfully', 'success');
        } catch (err) {
          addToast('Share failed: ' + err.message, 'error');
        }
        return;
      }

      setShareReady({ files: [file], label: `Lab Report - ${report.patient_name}` });
      addToast('PDF ready! Tap "Tap to Share" to send.', 'success');
    } catch (err) {
      addToast('Share failed: ' + err.message, 'error');
    }
  };

  const handleShareNow = async () => {
    if (!shareReady) return;
    const { files, label } = shareReady;
    if (isMobileApp()) {
      try {
        const { mobileShareMultiplePDFs } = await import('../utils/mobileShare');
        await mobileShareMultiplePDFs(files, label);
        addToast('Shared successfully', 'success');
      } catch (err) {
        if (err.message?.includes('cancel') || err.message?.includes('Abort')) { setShareReady(null); return; }
        addToast('Share failed: ' + err.message, 'error');
      }
      setShareReady(null);
      return;
    }
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

  const statusCounts = {
    Completed: reports.filter((r) => r.status === 'Completed').length,
    Pending: reports.filter((r) => r.status === 'Pending').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
          <Stethoscope className="w-7 h-7 text-primary-600" />
          Doctor Dashboard
        </h1>
        <p className="text-gray-500 text-sm mt-1 dark:text-gray-50 dark:font-medium">
          View and review patient lab reports
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{todayReports.length}</p>
            <p className="text-sm text-gray-500 dark:text-gray-50 dark:font-medium">Today's Reports</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{statusCounts.Completed}</p>
            <p className="text-sm text-gray-500 dark:text-gray-50 dark:font-medium">Completed (all)</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{statusCounts.Pending}</p>
            <p className="text-sm text-gray-500 dark:text-gray-50 dark:font-medium">Pending (all)</p>
          </div>
        </div>
      </div>

      {/* View toggle + filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-3 flex-wrap items-start md:items-center">
          {/* Today / History toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 dark:bg-gray-700">
            <button
              onClick={() => { setView('today'); setSearchTerm(''); setDateFrom(''); setDateTo(''); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'today' ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-800 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Today
            </button>
            <button
              onClick={() => setView('history')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'history' ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-800 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <History className="w-4 h-4" />
              History
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, test, or ref no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Date range (history only) */}
          {view === 'history' && (
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field w-auto text-sm"
                title="From date"
              />
              <span className="text-gray-400 text-sm">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field w-auto text-sm"
                title="To date"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear dates"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reports list */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('ref_no')} className="flex items-center hover:text-gray-700 transition-colors">
                    Ref No <SortIcon field="ref_no" />
                  </button>
                </th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sample ID</th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  <button onClick={() => handleSort('patient_name')} className="flex items-center hover:text-gray-700 transition-colors">
                    Patient <SortIcon field="patient_name" />
                  </button>
                </th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Investigation</th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  <button onClick={() => handleSort('date_of_collection')} className="flex items-center hover:text-gray-700 transition-colors">
                    Date <SortIcon field="date_of_collection" />
                  </button>
                </th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('status')} className="flex items-center hover:text-gray-700 transition-colors">
                    Status <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-left px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReports.map((report) => (
                <tr key={report._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <span className="text-sm font-mono font-medium text-gray-700">{report.ref_no}</span>
                    <p className="text-xs text-gray-500 sm:hidden">{report.patient_name}</p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm font-mono text-primary-700 font-medium">{report.sample_id || '-'}</span>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary-700">
                          {report.patient_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
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
                        title="View Report"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(report)}
                        className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                        title="Share on WhatsApp"
                      >
                        <Share2 className="w-4 h-4 text-green-600" />
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
            <p className="text-gray-500">
              {view === 'today' ? 'No reports collected today.' : 'No reports found for the selected filters.'}
            </p>
          </div>
        )}
      </div>

      {/* View / Print Report Modal — PDF-style with header & footer */}
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
                    {viewReport.sample_id && <span className="ml-2 text-sm font-mono text-primary-700">({viewReport.sample_id})</span>}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button onClick={() => handleDownloadPdf(viewReport)} className="btn-secondary flex items-center gap-1 text-xs">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button onClick={() => handleShareWhatsApp(viewReport)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors">
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                    <button onClick={handlePrint} className="btn-primary flex items-center gap-1 text-xs">
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                    <button onClick={() => setViewReport(null)} className="p-2 hover:bg-gray-100 rounded-lg">
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

                {/* PDF-style report preview with letterhead, inline header/footer */}
                <div className="border rounded-lg overflow-hidden bg-white">
                  <PrintableReport ref={printRef} report={viewReport} mode="preview" layoutSettings={layoutSettings?.pdf || layoutSettings?.print} letterheadUrl={getAssetUrl('letterhead.png')} />
                </div>
              </>
            )}
          </div>
          {isMobileApp() && !viewLoading && (
            <button
              onClick={() => setViewReport(null)}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 hover:bg-red-600 text-white font-medium px-8 py-3 rounded-full shadow-lg text-sm flex items-center gap-2"
            >
              <X className="w-5 h-5" /> Close Preview
            </button>
          )}
        </div>
      )}

      {/* Hidden PDF ref */}
      {viewReport && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <PrintableReport ref={pdfRef} report={viewReport} mode="pdf" layoutSettings={layoutSettings?.pdf} />
        </div>
      )}

      {/* Floating "Tap to Share" button */}
      {shareReady && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center" onClick={() => setShareReady(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}
    </div>
  );
}
