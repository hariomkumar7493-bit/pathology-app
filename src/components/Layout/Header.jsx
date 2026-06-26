import { Menu, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header({ onMenuToggle, sidebarOpen }) {
  const { user } = useAuth();

  return (
    <header className={`fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm transition-all duration-300 ${sidebarOpen ? 'lg:left-64' : 'lg:left-0'}`}>
      <div className="flex items-center gap-3">
        {/* Hamburger — visible on all screen sizes */}
        <button onClick={onMenuToggle} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* User */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.role === 'admin' ? 'Administrator' : 'Staff'}</p>
          </div>
          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary-600" />
          </div>
        </div>
      </div>
    </header>
  );
}
