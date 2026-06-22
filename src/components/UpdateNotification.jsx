import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';

/**
 * Auto-update notification banner for the Electron desktop app.
 * 
 * States:
 *   checking    → "Checking for updates..."
 *   available   → "Update v1.0.1 available" + progress bar
 *   downloading → Progress bar with speed + percentage
 *   downloaded  → "Restart to install v1.0.1"
 *   upToDate    → "You're on the latest version" (auto-hides)
 *   error       → "Update failed" with retry option
 *   idle        → Hidden
 * 
 * Only renders when running inside Electron (window.electronAPI exists).
 */
export default function UpdateNotification() {
  const [state, setState] = useState('idle');
  // idle | checking | available | downloading | downloaded | upToDate | error
  const [info, setInfo] = useState(null);       // { version, releaseDate, releaseNotes }
  const [progress, setProgress] = useState(null); // { percent, speed, transferred, total }
  const [error, setError] = useState(null);       // { message, retryCount, willRetry }
  const [dismissed, setDismissed] = useState(false);

  const api = typeof window !== 'undefined' && window.electronAPI;

  useEffect(() => {
    if (!api || !api.update) return;

    const unsubs = [];

    unsubs.push(api.update.onChecking(() => {
      setState('checking');
      setDismissed(false);
    }));

    unsubs.push(api.update.onAvailable((data) => {
      setState('available');
      setInfo(data);
      setProgress(null);
      setDismissed(false);
    }));

    unsubs.push(api.update.onNotAvailable((data) => {
      setState('upToDate');
      setInfo(data);
      // Auto-hide after 4 seconds
      setTimeout(() => setState('idle'), 4000);
    }));

    unsubs.push(api.update.onProgress((data) => {
      setState('downloading');
      setProgress(data);
    }));

    unsubs.push(api.update.onDownloaded((data) => {
      setState('downloaded');
      setInfo(data);
      setProgress(null);
      setDismissed(false);
    }));

    unsubs.push(api.update.onError((data) => {
      setState('error');
      setError(data);
    }));

    return () => unsubs.forEach(fn => fn());
  }, [api]);

  const handleRestart = useCallback(() => {
    if (api?.update) api.update.install();
  }, [api]);

  const handleRetry = useCallback(() => {
    if (api?.update) {
      setState('checking');
      api.update.check();
    }
  }, [api]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render in web browser or when idle/dismissed
  if (!api || !api.update) return null;
  if (state === 'idle') return null;
  if (dismissed && state !== 'downloaded') return null; // Never dismiss "restart to install"

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-full animate-in slide-in-from-bottom-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {state === 'checking' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
            {state === 'available' && <Download className="w-4 h-4 text-blue-500" />}
            {state === 'downloading' && <Download className="w-4 h-4 text-blue-500 animate-bounce" />}
            {state === 'downloaded' && <RefreshCw className="w-4 h-4 text-green-600" />}
            {state === 'upToDate' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {state === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}

            <span className="font-semibold text-sm text-gray-800">
              {state === 'checking' && 'Checking for updates...'}
              {state === 'available' && `Update v${info?.version} available`}
              {state === 'downloading' && `Downloading v${info?.version}...`}
              {state === 'downloaded' && `v${info?.version} ready to install`}
              {state === 'upToDate' && "You're on the latest version"}
              {state === 'error' && 'Update failed'}
            </span>
          </div>

          {state !== 'downloaded' && (
            <button onClick={handleDismiss} className="p-1 hover:bg-gray-100 rounded transition-colors">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Progress bar (downloading) */}
        {state === 'downloading' && progress && (
          <div className="px-4 pb-3">
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-gray-400">
              <span>{progress.transferred} / {progress.total} MB</span>
              <span>{progress.speed} MB/s</span>
              <span>{progress.percent}%</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {state === 'downloaded' && (
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-500 mb-2">
              The update will be installed after you restart.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRestart}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restart Now
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-gray-500 text-sm hover:bg-gray-100 rounded-lg transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && error && (
          <div className="px-4 pb-3">
            <p className="text-xs text-red-400 mb-2">
              {error.message}
              {error.willRetry && ` (retrying... attempt ${error.retryCount}/${3})`}
            </p>
            {!error.willRetry && (
              <button
                onClick={handleRetry}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
