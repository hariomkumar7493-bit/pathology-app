import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { isElectron } from '../utils/electron';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [online, setOnline] = useState(!isElectron()); // web is always online
  const [syncing, setSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  useEffect(() => {
    if (!isElectron() || !window.electronAPI.sync) return;

    // Listen to sync status changes from main process
    const unsubscribe = window.electronAPI.sync.onStatusChange((data) => {
      if (data.online !== undefined) setOnline(data.online);
      if (data.syncing !== undefined) setSyncing(data.syncing);
      if (data.result) setLastSyncResult(data.result);
    });

    // Initial status check
    window.electronAPI.sync.status().then((status) => {
      setOnline(status.online);
      if (status.lastSync) setLastSyncResult(status.lastSync);
    });

    // Poll pending changes count every 10s
    const pollPending = setInterval(async () => {
      try {
        if (window.electronAPI.db?.getSyncStatus) {
          const result = await window.electronAPI.db.getSyncStatus();
          setPendingChanges(result?.pendingChanges || 0);
        }
      } catch {}
    }, 10000);

    // Also check on window focus
    const onFocus = () => {
      window.electronAPI.sync.status().then((status) => {
        setOnline(status.online);
      }).catch(() => {});
    };
    window.addEventListener('focus', onFocus);

    return () => {
      unsubscribe();
      clearInterval(pollPending);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (isElectron() && window.electronAPI.sync) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const result = await window.electronAPI.sync.now(token);
          setLastSyncResult(result);
          return result;
        } catch (err) {
          return { success: false, error: err.message };
        }
      }
    }
    return null;
  }, []);

  return (
    <SyncContext.Provider value={{ online, syncing, pendingChanges, lastSyncResult, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) return { online: true, syncing: false, pendingChanges: 0, lastSyncResult: null, triggerSync: () => {} };
  return ctx;
}
