import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Zap,
  Settings,
  LogOut,
  Menu,
  X,
  FlaskConical,
  SlidersHorizontal,
  UserCog
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/patients', icon: Users, label: 'Patients' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/quick-report', icon: Zap, label: 'Quick Report' },
];

const adminNavItems = [
  { path: '/test-management', icon: FlaskConical, label: 'Test Management' },
  { path: '/report-layout', icon: SlidersHorizontal, label: 'Report Layout' },
  { path: '/staff-management', icon: UserCog, label: 'Staff Management' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { logout, user } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onMobileClose} />
      )}

      {/* Desktop sidebar — always visible, collapses to icons */}
      <aside className={`hidden lg:flex fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-50 flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        {/* Toggle button — replaces logo */}
        <div className={`p-4 border-b border-gray-100 flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
          <button onClick={onToggle} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : ''}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              {!collapsed && (
                <div className="mt-4 mb-2 px-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
                </div>
              )}
              {collapsed && <div className="mt-4 mb-2 border-t border-gray-100 mx-2" />}
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : ''}
                  className={({ isActive }) =>
                    `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-gray-100 space-y-1">
          <NavLink
            to="/settings"
            title={collapsed ? 'Settings' : ''}
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!collapsed && 'Settings'}
          </NavLink>
          <button
            onClick={logout}
            title={collapsed ? 'Logout' : ''}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar — slide in/out */}
      <aside className={`lg:hidden fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-50 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Toggle button */}
        <div className="p-4 border-b border-gray-100 flex justify-end">
          <button onClick={onMobileClose} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="mt-4 mb-2 px-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
              </div>
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 space-y-1">
          <NavLink
            to="/settings"
            onClick={onMobileClose}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200"
          >
            <Settings className="w-5 h-5" />
            Settings
          </NavLink>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
