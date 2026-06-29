import { Menu, User, Sun, Moon, Wifi, WifiOff, RefreshCw, Upload, CheckCircle, Cloud } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSync } from '../../context/SyncContext';
import { useToast } from '../../context/ToastContext';
import { getAssetUrl, isElectron } from '../../utils/electron';

export default function Header({ onMenuToggle, sidebarCollapsed }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { online, syncing, pendingChanges, triggerSync } = useSync();
  const { addToast } = useToast();
  const showSyncIndicator = isElectron();

  const handleSyncClick = async () => {
    if (!online || syncing) return;
    addToast('Syncing data...', 'info');
    const result = await triggerSync();
    if (!result) return;
    if (result.success) {
      const pushed = result.push?.pushed || 0;
      const errors = result.push?.errors || 0;
      if (errors > 0) {
        addToast(`Sync completed with ${errors} error(s). ${pushed} item(s) pushed.`, 'warning');
      } else if (pushed > 0) {
        addToast(`Sync successful! ${pushed} item(s) pushed.`, 'success');
      } else {
        addToast('Fully synced — all data up to date.', 'success');
      }
    } else {
      addToast(`Sync failed: ${result.error || 'Unknown error'}`, 'error');
    }
  };

  return (
    <header className={`fixed top-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm transition-all duration-300 dark:bg-gray-800 dark:border-gray-700 ${sidebarCollapsed ? 'lg:left-16' : 'lg:left-64'} left-0 lg:left-16`}>
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only (desktop toggle is in sidebar) */}
        <button onClick={onMenuToggle} className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        {/* Logo + Title */}
        <div className="flex items-center gap-2">
          <img src={getAssetUrl('icon.ico')} alt="PathLab Pro" className="w-9 h-9 rounded-lg" onError={(e) => e.target.style.display = 'none'} />
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight dark:text-gray-50">PathLab Pro</h1>
            <p className="text-xs text-gray-500 leading-tight dark:text-gray-50 dark:font-medium">Diagnostics Portal</p>
          </div>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Online/Offline indicator + Sync status (Electron only) */}
        {showSyncIndicator && (
          <div className="flex items-center gap-2">
            {pendingChanges > 0 && (
              <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full" title={`${pendingChanges} pending changes to sync`}>
                <Upload className="w-3.5 h-3.5" />
                {pendingChanges} pending
              </span>
            )}
            <button
              onClick={handleSyncClick}
              disabled={!online || syncing}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                !online
                  ? 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                  : syncing
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 cursor-wait'
                  : pendingChanges > 0
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-semibold'
                  : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50'
              }`}
              title={!online ? 'Offline — changes will sync when online' : syncing ? 'Syncing...' : pendingChanges > 0 ? `Click to sync ${pendingChanges} pending change(s)` : 'All data synced — click to re-sync'}
            >
              {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : !online ? <WifiOff className="w-3.5 h-3.5" /> : pendingChanges > 0 ? <Cloud className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {!online ? 'Offline' : syncing ? 'Syncing...' : pendingChanges > 0 ? 'Sync Now' : 'Synced'}
              </span>
            </button>
          </div>
        )}
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        {/* User */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role === 'admin' ? 'Administrator' : 'Staff'}</p>
          </div>
          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary-600" />
          </div>
        </div>
      </div>
    </header>
  );
}
