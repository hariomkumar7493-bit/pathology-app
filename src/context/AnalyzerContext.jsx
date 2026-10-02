import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isElectron } from '../utils/electron';
import { useToast } from './ToastContext';
import { getAnalyzerSampleId } from '../utils/analyzerParamMap';

const AnalyzerContext = createContext(null);

/**
 * Global store for analyzer results received via Electron IPC.
 * Mounts once near the app root so results are captured no matter
 * which page the technician is on.
 */
export function AnalyzerProvider({ children }) {
  const { addToast } = useToast();
  const [pendingResults, setPendingResults] = useState([]); // newest first

  useEffect(() => {
    if (!isElectron() || !window.electronAPI?.analyzer?.onResult) return;

    const unsub = window.electronAPI.analyzer.onResult((result) => {
      const entry = {
        ...result,
        _key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        receivedAt: new Date().toISOString(),
      };
      setPendingResults(prev => [entry, ...prev].slice(0, 20));
      const sid = getAnalyzerSampleId(result);
      const count = result.results?.length || 0;
      addToast(
        `Analyzer: ${count} result${count !== 1 ? 's' : ''} received from ${result.brand || ''} ${result.model || ''}${sid ? ` — Sample ${sid}` : ''}`,
        'info'
      );
    });

    return () => { if (unsub) unsub(); };
  }, [addToast]);

  const removeResult = useCallback((key) => {
    setPendingResults(prev => prev.filter(r => r._key !== key));
  }, []);

  const clearAll = useCallback(() => setPendingResults([]), []);

  return (
    <AnalyzerContext.Provider value={{ pendingResults, removeResult, clearAll }}>
      {children}
    </AnalyzerContext.Provider>
  );
}

export function useAnalyzer() {
  return useContext(AnalyzerContext);
}
