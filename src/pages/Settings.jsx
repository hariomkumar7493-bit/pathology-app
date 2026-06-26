import { useState, useEffect } from 'react';
import { Save, Building2, User, Bell, Shield, ChevronDown, Download, Monitor, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isMobileApp, updateNotificationPreference } from '../utils/mobileNotifications';
import { isElectron } from '../utils/electron';

export default function Settings() {
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState(null);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const mobileApp = isMobileApp();

  useEffect(() => {
    if (mobileApp) {
      const saved = localStorage.getItem('notifications_enabled');
      setNotifEnabled(saved !== 'false');
    }
  }, [mobileApp]);

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
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    ...(!isElectron() && !mobileApp ? [{ id: 'download', label: 'Download Apps', icon: Download }] : []),
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input-field" defaultValue={user?.email} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" className="input-field" defaultValue="+91 9876543210" />
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
      const ghReleases = 'https://github.com/hariomkumar7493-bit/pathology-app/releases/latest';
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Windows / Electron */}
            <a
              href={ghReleases}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all group"
            >
              <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Monitor className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Windows Desktop App</p>
                <p className="text-xs text-gray-500">Download the Electron installer for Windows</p>
              </div>
              <Download className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
            </a>

            {/* Android */}
            <a
              href={`${ghReleases}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all group"
            >
              <div className="w-11 h-11 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Android Mobile App</p>
                <p className="text-xs text-gray-500">Download the APK from GitHub Releases</p>
              </div>
              <Download className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
            </a>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              Both apps work offline and sync with your data when online. Download from GitHub Releases page.
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and lab preferences</p>
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
                  isOpen ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    isOpen ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-sm font-semibold ${isOpen ? 'text-primary-700' : 'text-gray-700'}`}>
                    {section.label}
                  </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Content - only render when open */}
              {isOpen && (
                <div className="px-5 py-5 border-t border-gray-100">
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
