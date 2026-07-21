import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Shield, LogOut, Settings as SettingsIcon, Info } from 'lucide-react';

const ROLE_LABELS = {
  'super-admin': 'Super Admin',
  'user-admin': 'User Admin',
  'account-admin': 'Account Admin',
  'support-admin': 'Support Admin',
  'marketing-admin': 'Marketing Admin',
  admin: 'Admin',
};

const Settings = () => {
  const navigate = useNavigate();

  // Login stores userName / userEmail / userRole; fall back to legacy keys.
  const name =
    localStorage.getItem('userName') || localStorage.getItem('username') || 'Admin';
  const email = localStorage.getItem('userEmail') || 'N/A';
  const role = localStorage.getItem('userRole') || '';
  const roleLabel = ROLE_LABELS[role] || 'Admin';

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'AD';

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('username');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userRole');
    // navigate + hard reload so App re-reads auth state from storage (matches Header logout).
    navigate('/login');
    window.location.reload();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-blue-600 mb-1">
          <SettingsIcon className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account details and session.</p>
      </div>

      {/* Account Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xl">{initials}</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{name}</h2>
            <p className="text-sm text-gray-500">{roleLabel}</p>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2 mb-4">
          Account Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <div className="flex items-center">
              <User className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-900 truncate">{name}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="flex items-center">
              <Mail className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-900 truncate">{email}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <div className="flex items-center">
              <Shield className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-900">{roleLabel}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            To change your name, email, role, or password, contact a super administrator.
          </p>
        </div>
      </div>

      {/* Session */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2 mb-4">
          Session
        </h3>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-600">Sign out of the admin portal on this device.</p>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
