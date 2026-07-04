import { useState, useEffect, useRef } from 'react';
import {
  Activity, Usb, Wifi, Plug, Unplug, FileUp, Search,
  CheckCircle, XCircle, AlertCircle, Loader2, Cpu, ChevronDown, ChevronRight, Trash2, Download
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { isElectron } from '../utils/electron';

export default function AnalyzerIntegration() {
  const { addToast } = useToast();
  const [analyzers, setAnalyzers] = useState([]);
  const [analyzersByCategory, setAnalyzersByCategory] = useState({});
  const [ports, setPorts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [selectedAnalyzer, setSelectedAnalyzer] = useState(null);
  const [connectConfig, setConnectConfig] = useState({ serialPort: 'COM1', tcpHost: '127.0.0.1', tcpPort: 5000 });
  const [connecting, setConnecting] = useState(false);
  const [receivedResults, setReceivedResults] = useState([]);
  const [showResultsPanel, setShowResultsPanel] = useState(false);
  const unsubResultRef = useRef(null);
  const unsubStatusRef = useRef(null);

  const isElectronApp = isElectron();

  useEffect(() => {
    if (!isElectronApp || !window.electronAPI?.analyzer) return;

    // Load analyzer registry
    window.electronAPI.analyzer.byCategory().then(data => {
      setAnalyzersByCategory(data);
      const all = Object.values(data).flat();
      setAnalyzers(all);
    }).catch(() => {});

    // Load serial ports
    refreshPorts();

    // Subscribe to results
    unsubResultRef.current = window.electronAPI.analyzer.onResult((result) => {
      setReceivedResults(prev => [{ ...result, receivedAt: new Date().toISOString() }, ...prev].slice(0, 50));
      setShowResultsPanel(true);
      addToast(`Received ${result.results?.length || 0} results from ${result.brand} ${result.model}`, 'success');
    });

    unsubStatusRef.current = window.electronAPI.analyzer.onStatus((status) => {
      setConnections(prev => {
        const idx = prev.findIndex(c => c.id === status.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = status;
          return updated;
        }
        return [...prev, status];
      });
    });

    // Load initial status
    window.electronAPI.analyzer.status().then(setConnections).catch(() => {});

    return () => {
      if (unsubResultRef.current) unsubResultRef.current();
      if (unsubStatusRef.current) unsubStatusRef.current();
    };
  }, []);

  const refreshPorts = async () => {
    if (!window.electronAPI?.analyzer) return;
    try {
      const portList = await window.electronAPI.analyzer.listPorts();
      setPorts(portList);
    } catch (e) {
      console.error('Failed to list ports:', e);
    }
  };

  const handleConnect = async () => {
    if (!selectedAnalyzer) {
      addToast('Select an analyzer first', 'warning');
      return;
    }
    setConnecting(true);
    try {
      const config = {
        analyzerId: selectedAnalyzer.id,
        transport: selectedAnalyzer.transport,
        serialPort: connectConfig.serialPort,
        tcpHost: connectConfig.tcpHost,
        tcpPort: connectConfig.tcpPort,
      };
      const result = await window.electronAPI.analyzer.connect(config);
      if (result.success) {
        addToast(`Connecting to ${selectedAnalyzer.brand} ${selectedAnalyzer.model}...`, 'success');
      } else {
        addToast(`Connection failed: ${result.error}`, 'error');
      }
    } catch (e) {
      addToast(`Connection error: ${e.message}`, 'error');
    }
    setConnecting(false);
  };

  const handleDisconnect = async (connId) => {
    await window.electronAPI.analyzer.disconnect(connId);
    setConnections(prev => prev.filter(c => c.id !== connId));
    addToast('Analyzer disconnected', 'info');
  };

  const handleDisconnectAll = async () => {
    await window.electronAPI.analyzer.disconnectAll();
    setConnections([]);
    addToast('All analyzers disconnected', 'info');
  };

  const handleImportFile = async () => {
    const fileResult = await window.electronAPI.analyzer.openFileDialog();
    if (!fileResult.success) return;
    const result = await window.electronAPI.analyzer.importFile(fileResult.filePath);
    if (result.success) {
      addToast(`Imported ${result.result.results?.length || 0} results from file`, 'success');
    } else {
      addToast(`Import failed: ${result.error}`, 'error');
    }
  };

  const filteredCategories = Object.entries(analyzersByCategory).filter(([cat, items]) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return items.some(a =>
      a.brand.toLowerCase().includes(term) ||
      a.model.toLowerCase().includes(term) ||
      cat.toLowerCase().includes(term)
    );
  });

  const statusColors = {
    connected: 'text-green-600 bg-green-50',
    connecting: 'text-yellow-600 bg-yellow-50',
    disconnected: 'text-gray-500 bg-gray-50',
    error: 'text-red-600 bg-red-50',
  };

  const statusIcons = {
    connected: <CheckCircle className="w-3.5 h-3.5" />,
    connecting: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    disconnected: <XCircle className="w-3.5 h-3.5" />,
    error: <AlertCircle className="w-3.5 h-3.5" />,
  };

  if (!isElectronApp) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Cpu className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Analyzer Integration Available on Desktop App Only</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          The analyzer integration requires the Electron desktop app to access serial ports and TCP connections.
          Please use the PathoLab Pro desktop application to connect to lab analyzers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-600" />
            Analyzer Integration
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Connect lab analyzers for automatic result capture</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshPorts} className="btn-secondary flex items-center gap-1 text-xs">
            <Usb className="w-3.5 h-3.5" /> Refresh Ports
          </button>
          <button onClick={handleImportFile} className="btn-secondary flex items-center gap-1 text-xs">
            <FileUp className="w-3.5 h-3.5" /> Import File
          </button>
        </div>
      </div>

      {/* Active Connections */}
      {connections.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Active Connections ({connections.length})</h3>
            <button onClick={handleDisconnectAll} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
              <Unplug className="w-3.5 h-3.5" /> Disconnect All
            </button>
          </div>
          <div className="space-y-2">
            {connections.map(conn => (
              <div key={conn.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[conn.status] || statusColors.disconnected}`}>
                    {statusIcons[conn.status] || statusIcons.disconnected}
                    {conn.status}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{conn.brand} {conn.model}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {conn.transport === 'serial' ? `Serial: ${conn.serialPort}` : `TCP: ${conn.tcpHost}:${conn.tcpPort}`}
                      {' · '}{conn.protocol?.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleDisconnect(conn.id)} className="text-red-600 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                  <Unplug className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Analyzer Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Select Analyzer</h3>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input-field text-xs pl-7 py-1.5 w-40"
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-1">
            {filteredCategories.map(([category, items]) => (
              <div key={category}>
                <button
                  onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  className="w-full flex items-center gap-2 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                >
                  {expandedCategory === category ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {category} ({items.length})
                </button>
                {expandedCategory === category && (
                  <div className="ml-4 space-y-0.5">
                    {items.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAnalyzer(a)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                          selectedAnalyzer?.id === a.id
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{a.brand} {a.model}</span>
                          <div className="flex items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${a.protocol === 'astm' ? 'bg-blue-100 text-blue-600' : a.protocol === 'hl7' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                              {a.protocol?.toUpperCase()}
                            </span>
                            <span className="text-gray-400">{a.transport === 'serial' ? <Usb className="w-3 h-3" /> : a.transport === 'tcp' ? <Wifi className="w-3 h-3" /> : <FileUp className="w-3 h-3" />}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Connection Config */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Connection Settings</h3>

          {!selectedAnalyzer ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Plug className="w-12 h-12 text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">Select an analyzer to configure connection</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <div className="text-sm font-medium text-primary-700 dark:text-primary-300">{selectedAnalyzer.brand} {selectedAnalyzer.model}</div>
                <div className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                  {selectedAnalyzer.category} · {selectedAnalyzer.protocol?.toUpperCase()} · {selectedAnalyzer.direction === 'bi' ? 'Bidirectional' : 'Unidirectional'}
                </div>
              </div>

              {selectedAnalyzer.transport === 'serial' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Serial Port</label>
                    <select
                      value={connectConfig.serialPort}
                      onChange={e => setConnectConfig(prev => ({ ...prev, serialPort: e.target.value }))}
                      className="input-field text-xs"
                    >
                      {ports.length > 0 ? ports.map(p => (
                        <option key={p.path} value={p.path}>{p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}</option>
                      )) : (
                        <option value="COM1">COM1 (default)</option>
                      )}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Baud Rate</label>
                      <div className="text-xs text-gray-500 py-1.5">{selectedAnalyzer.serialSettings?.baudRate || 9600}</div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Data Bits</label>
                      <div className="text-xs text-gray-500 py-1.5">{selectedAnalyzer.serialSettings?.dataBits || 8}</div>
                    </div>
                  </div>
                </>
              )}

              {selectedAnalyzer.transport === 'tcp' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Analyzer IP Address</label>
                    <input
                      type="text"
                      value={connectConfig.tcpHost}
                      onChange={e => setConnectConfig(prev => ({ ...prev, tcpHost: e.target.value }))}
                      className="input-field text-xs"
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">TCP Port</label>
                    <input
                      type="number"
                      value={connectConfig.tcpPort}
                      onChange={e => setConnectConfig(prev => ({ ...prev, tcpPort: parseInt(e.target.value) || 5000 }))}
                      className="input-field text-xs"
                      placeholder="5000"
                    />
                  </div>
                </>
              )}

              {selectedAnalyzer.transport === 'file' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  This analyzer exports results to files (CSV/XML). Use the "Import File" button above to load results.
                </div>
              )}

              {selectedAnalyzer.tests && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Available Tests ({selectedAnalyzer.tests.length})</label>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {selectedAnalyzer.tests.slice(0, 20).map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] rounded">{t}</span>
                    ))}
                    {selectedAnalyzer.tests.length > 20 && (
                      <span className="text-[10px] text-gray-400">+{selectedAnalyzer.tests.length - 20} more</span>
                    )}
                  </div>
                </div>
              )}

              {selectedAnalyzer.transport !== 'file' && (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Received Results Panel */}
      {showResultsPanel && receivedResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Received Results ({receivedResults.length})</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowResultsPanel(false)} className="text-xs text-gray-400 hover:text-gray-600">Hide</button>
              <button onClick={() => setReceivedResults([])} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {receivedResults.map((r, idx) => (
              <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {r.brand} {r.model}
                    {r.patient?.patientName ? ` · ${r.patient.patientName}` : ''}
                    {r.patient?.patientId ? ` (ID: ${r.patient.patientId})` : ''}
                  </span>
                  <span className="text-[10px] text-gray-400">{new Date(r.receivedAt).toLocaleTimeString()}</span>
                </div>
                {r.results && r.results.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                    {r.results.map((res, i) => (
                      <div key={i} className="text-[10px] flex items-center gap-1">
                        <span className="text-gray-500 dark:text-gray-400">{res.testCode || res.testName}:</span>
                        <span className={`font-medium ${res.abnormalFlag ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>{res.value}</span>
                        {res.unit && <span className="text-gray-400">{res.unit}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No results parsed</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-xs text-blue-700 dark:text-blue-300">
        <p className="font-medium mb-1">How Analyzer Integration Works</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
          <li>Select your analyzer model from the list above</li>
          <li>Choose the correct COM port (for serial) or IP address (for TCP)</li>
          <li>Click Connect — the app will listen for results from the analyzer</li>
          <li>When the analyzer completes a test, results appear automatically in the "Received Results" panel</li>
          <li>Review the results and assign them to a patient/report</li>
        </ol>
        <p className="mt-2 text-blue-500">For file-based analyzers (ELISA readers), use "Import File" to load CSV/XML exports.</p>
      </div>
    </div>
  );
}
