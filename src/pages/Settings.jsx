import { useState, useEffect } from 'react';
import { Save, Building2, User, Bell, Shield, ChevronDown, Download, Monitor, Smartphone, Plus, Trash2, Stethoscope, Activity, Usb, Play, Square, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { isMobileApp, updateNotificationPreference } from '../utils/mobileNotifications';
import { isElectron } from '../utils/electron';

export default function Settings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [openSection, setOpenSection] = useState(null);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [exeDownloadUrl, setExeDownloadUrl] = useState(null);
  const [doctors, setDoctors] = useState(['SELF']);
  const [newDoctor, setNewDoctor] = useState('');
  const [savingDoctors, setSavingDoctors] = useState(false);
  const mobileApp = isMobileApp();
  const electron = isElectron();

  // Analyzer state
  const [analyzerPorts, setAnalyzerPorts] = useState([]);
  const [analyzerPort, setAnalyzerPort] = useState('');
  const [analyzerBaud, setAnalyzerBaud] = useState(9600);
  const [analyzerStatus, setAnalyzerStatus] = useState('disconnected');
  const [analyzerListening, setAnalyzerListening] = useState(false);
  const [analyzerUnassigned, setAnalyzerUnassigned] = useState([]);
  const [analyzerPendingReports, setAnalyzerPendingReports] = useState([]);
  const [analyzerResults, setAnalyzerResults] = useState([]);
  const [assigningResult, setAssigningResult] = useState(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/hariomkumar7493-bit/pathology-app/releases/latest')
      .then(res => res.json())
      .then(data => {
        const asset = data.assets?.find(a => a.name.includes('Setup') && a.name.endsWith('.exe'));
        if (asset) setExeDownloadUrl(asset.browser_download_url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mobileApp) {
      const saved = localStorage.getItem('notifications_enabled');
      setNotifEnabled(saved !== 'false');
    }
  }, [mobileApp]);

  useEffect(() => {
    api.getReferringDoctors().then(data => setDoctors(data.doctors || ['SELF'])).catch(() => {});
  }, []);

  const handleNotifToggle = async (enabled) => {
    setNotifEnabled(enabled);
    await updateNotificationPreference(enabled);
  };

  const toggleSection = (id) => {
    setOpenSection(openSection === id ? null : id);
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'lab', label: 'Lab Settings', icon: Building2 },
    { id: 'doctors', label: 'Referring Doctors', icon: Stethoscope },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    ...(!electron && !mobileApp ? [{ id: 'download', label: 'Download Apps', icon: Download }] : []),
    ...(electron ? [{ id: 'analyzer', label: 'Analyzer (Erba Chem 7)', icon: Activity }] : []),
  ];

  const renderContent = (id) => {
    if (id === 'profile') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" className="input-field" defaultValue={user?.name} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" className="input-field" defaultValue={user?.phone} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input type="text" className="input-field bg-gray-50" defaultValue={user?.role} disabled />
            </div>
          </div>
          <button className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      );
    }
    if (id === 'lab') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lab Name</label>
              <input type="text" className="input-field" defaultValue="PathLab Pro Diagnostics" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration No.</label>
              <input type="text" className="input-field" defaultValue="LAB/2024/001234" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea className="input-field" rows="2" defaultValue="123, Healthcare Plaza, Sector 18, Noida, UP - 201301"></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
              <input type="tel" className="input-field" defaultValue="+91 120 4567890" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input-field" defaultValue="info@pathlabpro.com" />
            </div>
          </div>
          <button className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      );
    }
    if (id === 'doctors') {
      const handleAddDoctor = () => {
        const name = newDoctor.trim();
        if (!name) return;
        if (doctors.includes(name)) { addToast('Doctor already exists', 'warning'); return; }
        setDoctors([...doctors, name]);
        setNewDoctor('');
      };
      const handleRemoveDoctor = (name) => {
        if (name === 'SELF') { addToast('Cannot remove SELF', 'warning'); return; }
        setDoctors(doctors.filter(d => d !== name));
      };
      const handleSaveDoctors = async () => {
        setSavingDoctors(true);
        try {
          const res = await api.updateReferringDoctors(doctors);
          setDoctors(res.doctors);
          addToast('Referring doctors saved', 'success');
        } catch (err) {
          addToast('Failed to save: ' + err.message, 'error');
        }
        setSavingDoctors(false);
      };
      return (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="Enter doctor name (e.g. Dr. Sharma)"
              value={newDoctor}
              onChange={e => setNewDoctor(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDoctor(); } }}
            />
            <button onClick={handleAddDoctor} className="btn-secondary flex items-center gap-1 px-3">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {doctors.map(doc => (
              <div key={doc} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{doc}</span>
                {doc !== 'SELF' && (
                  <button onClick={() => handleRemoveDoctor(doc)} className="p-1 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">These doctors will appear in the "Referred By" dropdown when creating quick reports. SELF cannot be removed.</p>
          </div>
          <button onClick={handleSaveDoctors} disabled={savingDoctors} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {savingDoctors ? 'Saving...' : 'Save Doctors'}
          </button>
        </div>
      );
    }
    if (id === 'notifications') {
      return (
        <div className="space-y-4">
          {mobileApp ? (
            <>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Push Notifications</p>
                  <p className="text-xs text-gray-500">Get notified on this device when new reports or patients are created</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={notifEnabled} onChange={(e) => handleNotifToggle(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  When enabled, you'll receive push notifications on this device whenever a new report or patient is created from any device (web, desktop, or mobile).
                </p>
              </div>
            </>
          ) : (
            [
              { label: 'Report Ready Notifications', desc: 'Get notified when a report is ready' },
              { label: 'Sample Status Updates', desc: 'Track sample processing updates' },
              { label: 'New Patient Registration', desc: 'Notification for new patient registrations' },
              { label: 'Payment Alerts', desc: 'Get alerts for payment received or pending' },
              { label: 'SMS Notifications', desc: 'Send SMS to patients for report updates' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={i < 3} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            ))
          )}
        </div>
      );
    }
    if (id === 'security') {
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input type="password" className="input-field" placeholder="Enter current password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" className="input-field" placeholder="Enter new password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input type="password" className="input-field" placeholder="Confirm new password" />
            </div>
          </div>
          <button className="btn-primary flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Update Password
          </button>
        </div>
      );
    }
    if (id === 'download') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Windows / Electron */}
            <a
              href={exeDownloadUrl || '#'}
              download
              className={`flex items-center gap-3 p-4 border border-gray-200 rounded-xl transition-all group ${exeDownloadUrl ? 'hover:border-primary-300 hover:bg-primary-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
              onClick={e => { if (!exeDownloadUrl) e.preventDefault(); }}
            >
              <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Monitor className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Windows Desktop App</p>
                <p className="text-xs text-gray-500">{exeDownloadUrl ? 'Download the installer directly' : 'Checking latest release...'}</p>
              </div>
              <Download className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
            </a>

            {/* Android */}
            <a
              href="/PathLabPro.apk"
              download
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all group"
            >
              <div className="w-11 h-11 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Android Mobile App</p>
                <p className="text-xs text-gray-500">Download the APK directly</p>
              </div>
              <Download className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
            </a>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              Both apps work offline and sync with your data when online.
            </p>
          </div>
        </div>
      );
    }
    if (id === 'analyzer') {
      return renderAnalyzerContent();
    }
    return null;
  };

  // ===== ANALYZER SECTION =====
  const refreshPorts = async () => {
    if (!electron) return;
    const ports = await window.electronAPI.analyzer.listPorts();
    setAnalyzerPorts(ports);
    if (ports.length > 0 && !analyzerPort) setAnalyzerPort(ports[0].path);
  };

  const loadAnalyzerSettings = async () => {
    if (!electron) return;
    const settings = await window.electronAPI.analyzer.loadSettings();
    if (settings.port) setAnalyzerPort(settings.port);
    if (settings.baudRate) setAnalyzerBaud(settings.baudRate);
    const status = await window.electronAPI.analyzer.status();
    setAnalyzerListening(status.listening);
    setAnalyzerUnassigned(await window.electronAPI.analyzer.getUnassigned());
  };

  useEffect(() => {
    if (electron && openSection === 'analyzer') {
      refreshPorts();
      loadAnalyzerSettings();
    }
  }, [electron, openSection]);

  useEffect(() => {
    if (!electron) return;
    const unsubResult = window.electronAPI.analyzer.onResultReceived((data) => {
      setAnalyzerResults(prev => [{ ...data, id: Date.now() }, ...prev].slice(0, 20));
      if (data.matched) {
        addToast(`Results auto-applied to ${data.patientName || 'report'}`, 'success');
      } else {
        addToast(`Unassigned results for sample ${data.sampleId || 'unknown'}`, 'warning');
        window.electronAPI.analyzer.getUnassigned().then(setAnalyzerUnassigned);
      }
    });
    const unsubStatus = window.electronAPI.analyzer.onStatus((status) => {
      setAnalyzerStatus(status);
      if (status === 'connected') setAnalyzerListening(true);
      if (status === 'disconnected' || status === 'error') setAnalyzerListening(false);
    });
    const unsubError = window.electronAPI.analyzer.onError((err) => {
      addToast('Analyzer error: ' + err, 'error');
    });
    return () => { unsubResult(); unsubStatus(); unsubError(); };
  }, [electron]);

  const handleStartAnalyzer = async () => {
    if (!analyzerPort) { addToast('Select a COM port first', 'warning'); return; }
    await window.electronAPI.analyzer.saveSettings(analyzerPort, analyzerBaud);
    const result = await window.electronAPI.analyzer.start(analyzerPort, analyzerBaud);
    if (result.success) {
      setAnalyzerListening(true);
      addToast(`Listening on ${analyzerPort} at ${analyzerBaud} baud`, 'success');
    }
  };

  const handleStopAnalyzer = async () => {
    await window.electronAPI.analyzer.stop();
    setAnalyzerListening(false);
    addToast('Analyzer stopped', 'info');
  };

  const handleAssignResult = async (unassignedId, reportId) => {
    setAssigningResult(unassignedId);
    const result = await window.electronAPI.analyzer.assign(unassignedId, reportId);
    if (result.success) {
      addToast(`Results applied to report (${result.updatedCount} tests updated)`, 'success');
      setAnalyzerUnassigned(await window.electronAPI.analyzer.getUnassigned());
    } else {
      addToast('Failed to assign: ' + (result.error || 'Unknown error'), 'error');
    }
    setAssigningResult(null);
  };

  const renderAnalyzerContent = () => {
    return (
      <div className="space-y-6">
        {/* Connection settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Usb className="w-5 h-5 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Connection Settings</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">COM Port</label>
              <div className="flex gap-2">
                <select
                  className="input-field flex-1"
                  value={analyzerPort}
                  onChange={e => setAnalyzerPort(e.target.value)}
                  disabled={analyzerListening}
                >
                  <option value="">Select port...</option>
                  {analyzerPorts.map(p => (
                    <option key={p.path} value={p.path}>{p.path} — {p.manufacturer}</option>
                  ))}
                </select>
                <button
                  onClick={refreshPorts}
                  className="btn-secondary px-3"
                  disabled={analyzerListening}
                  title="Refresh ports"
                >Refresh</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Baud Rate</label>
              <select
                className="input-field"
                value={analyzerBaud}
                onChange={e => setAnalyzerBaud(Number(e.target.value))}
                disabled={analyzerListening}
              >
                <option value={9600}>9600</option>
                <option value={4800}>4800</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={115200}>115200</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!analyzerListening ? (
              <button onClick={handleStartAnalyzer} className="btn-primary flex items-center gap-2">
                <Play className="w-4 h-4" /> Start Listening
              </button>
            ) : (
              <button onClick={handleStopAnalyzer} className="btn-secondary flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50">
                <Square className="w-4 h-4" /> Stop
              </button>
            )}
            {analyzerListening && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Listening on {analyzerPort}
              </span>
            )}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              Connect the Erba Chem 7 via RS-232 cable or USB-to-Serial adapter. Default settings: 9600 baud, 8 data bits, no parity, 1 stop bit. Enter the sample ID on the analyzer matching the one assigned in the report for auto-matching.
            </p>
          </div>
        </div>

        {/* Recent results */}
        {analyzerResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Recent Results</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {analyzerResults.map(r => (
                <div key={r.id} className={`p-3 rounded-lg border ${r.matched ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {r.matched ? (
                        <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> {r.patientName} (Sample {r.sampleId})</span>
                      ) : (
                        <span className="flex items-center gap-1"><AlertCircle className="w-4 h-4 text-amber-500" /> Sample {r.sampleId || 'Unknown'} — {r.patientName || 'No patient name'}</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(r.timestamp || r.id).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.results?.map((res, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-white rounded border border-gray-200">
                        <span className="font-medium">{res.testName}</span>: {res.value} {res.unit}
                        {res.isAbnormal && <span className="text-red-500 ml-1">[{res.flag}]</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unassigned results */}
        {analyzerUnassigned.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Unassigned Results ({analyzerUnassigned.length})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {analyzerUnassigned.map(u => (
                <UnassignedResultCard
                  key={u.id}
                  result={u}
                  pendingReports={analyzerPendingReports}
                  onAssign={handleAssignResult}
                  loading={assigningResult === u.id}
                  onRefreshReports={async () => setAnalyzerPendingReports(await window.electronAPI.analyzer.getPendingReports())}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Settings</h1>
        <p className="text-gray-500 text-sm mt-1 dark:text-gray-50 dark:font-medium">Manage your account and lab preferences</p>
      </div>

      {/* Accordion sections - one open at a time */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div key={section.id} className="card overflow-hidden">
              {/* Header button */}
              <button
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center justify-between px-5 py-4 transition-all ${
                  isOpen ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    isOpen ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-sm font-semibold ${isOpen ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200'}`}>
                    {section.label}
                  </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Content - only render when open */}
              {isOpen && (
                <div className="px-5 py-5 border-t border-gray-100 dark:border-gray-700">
                  {renderContent(section.id)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UnassignedResultCard({ result, pendingReports, onAssign, loading, onRefreshReports }) {
  const [selectedReport, setSelectedReport] = useState('');
  const [showReports, setShowReports] = useState(false);

  const handleAssign = () => {
    if (!selectedReport) return;
    onAssign(result.id, selectedReport);
  };

  return (
    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Sample {result.sampleId || 'Unknown'} — {result.patientName || 'No name'}
        </span>
        <span className="text-xs text-gray-400">{new Date(result.timestamp).toLocaleTimeString()}</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {result.results?.map((res, i) => (
          <span key={i} className="text-xs px-2 py-1 bg-white rounded border border-gray-200">
            <span className="font-medium">{res.testName}</span>: {res.value} {res.unit}
            {res.isAbnormal && <span className="text-red-500 ml-1">[{res.flag}]</span>}
          </span>
        ))}
      </div>
      {showReports ? (
        <div className="flex gap-2">
          <select
            className="input-field flex-1 text-sm"
            value={selectedReport}
            onChange={e => setSelectedReport(e.target.value)}
          >
            <option value="">Select report...</option>
            {pendingReports.map(r => (
              <option key={r._id} value={r._id}>
                {r.patient_name} — {r.investigation || 'No investigation'} ({new Date(r.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!selectedReport || loading}
            className="btn-primary text-sm px-3 disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Assign
          </button>
        </div>
      ) : (
        <button
          onClick={async () => { await onRefreshReports(); setShowReports(true); }}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Assign to report →
        </button>
      )}
    </div>
  );
}
