import { useState } from 'react';
import { Save, Building2, User, Bell, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'lab', label: 'Lab Settings', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and lab preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 card">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
              <div className="grid grid-cols-2 gap-4">
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
          )}

          {activeTab === 'lab' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Lab Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lab Name</label>
                  <input type="text" className="input-field" defaultValue="PathLab Pro Diagnostics" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration No.</label>
                  <input type="text" className="input-field" defaultValue="LAB/2024/001234" />
                </div>
                <div className="col-span-2">
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
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
              <div className="space-y-4">
                {[
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
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
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
          )}
        </div>
      </div>
    </div>
  );
}
