import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, User, LogOut, Settings, ChevronDown } from 'lucide-react';

const formatRoleLabel = (role = '') => {
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'support-admin') return 'Support Admin';
  if (normalized === 'user-admin') return 'User Admin';
  if (normalized === 'account-admin') return 'Account Admin';
  if (normalized === 'marketing-admin') return 'Marketing Admin';
  if (normalized === 'super-admin') return 'Super Admin';
  return String(role)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Admin';
};

const Header = ({ toggleSidebar }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notifications] = useState(3);
  const [searchValue, setSearchValue] = useState('');
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const userRole = localStorage.getItem('userRole') || 'Admin';
  const username = localStorage.getItem('username') || 'Admin';
  const roleLabel = formatRoleLabel(userRole);
  const initials = username
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'A';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userRole');
    navigate('/login');
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-20 border-b-2 border-blue-100 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
        {/* Left */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-black hover:bg-slate-50 hover:text-black focus:outline-none focus:ring-2 focus:ring-blue-600/25"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>

          <label className="relative hidden min-w-0 max-w-lg flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search pages, users, tickets..."
              className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition hover:border-slate-500 focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </label>
        </div>

        {/* Right */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-black hover:bg-slate-50"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-black hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/25"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notifications > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                {notifications > 9 ? '9+' : notifications}
              </span>
            ) : null}
          </button>

          <div className="mx-0.5 hidden h-7 w-px bg-black/20 sm:block" />

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((open) => !open)}
              className="inline-flex items-center gap-2.5 rounded-md border border-slate-300 bg-white px-2 py-1.5 transition hover:border-black hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600/25"
              aria-expanded={isDropdownOpen}
              aria-haspopup="menu"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white ring-1 ring-black/10">
                {initials}
              </div>
              <div className="hidden min-w-0 text-left md:block">
                <p className="truncate text-sm font-semibold leading-tight text-slate-950">{username}</p>
                <p className="truncate text-[11px] font-medium leading-tight text-slate-500">{roleLabel}</p>
              </div>
              <ChevronDown
                className={`hidden h-4 w-4 text-slate-600 transition-transform md:block ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isDropdownOpen ? (
              <div
                className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border-2 border-black bg-white shadow-xl"
                role="menu"
              >
                <div className="border-b-2 border-black/10 bg-slate-50 px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{username}</p>
                      <p className="truncate text-xs font-medium text-slate-500">{roleLabel}</p>
                    </div>
                  </div>
                </div>

                <div className="p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate('/dashboard/settings');
                    }}
                  >
                    <User className="h-4 w-4 text-slate-500" />
                    Account settings
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate('/dashboard/settings');
                    }}
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    Preferences
                  </button>
                </div>

                <div className="border-t-2 border-black/10 p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
