// import React from 'react';

// const Header = ({ toggleSidebar }) => {
//   return (
//     <header className="bg-white shadow p-4 flex justify-between items-center md:px-8">
//       <button onClick={toggleSidebar} className="text-gray-600 focus:outline-none focus:text-gray-900">
//         <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
//         </svg>
//       </button>
//       <h1 className="text-xl md:text-2xl font-bold text-gray-800">Admin Dashboard</h1>
//       <div className="flex items-center">
//         <span className="mr-2 text-gray-700">Welcome, Admin!</span>
//         <img
//           src="https://via.placeholder.com/40" // Placeholder for user profile image
//           alt="User Profile"
//           className="w-10 h-10 rounded-full border-2 border-blue-500"
//         />
//       </div>
//     </header>
//   );
// };

// export default Header;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, User, LogOut, Settings, ChevronDown } from 'lucide-react';

const Header = ({ toggleSidebar }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState(3); // Mock notification count
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Get user info from localStorage
  const userRole = localStorage.getItem('userRole') || 'Admin';
  const username = localStorage.getItem('username') || 'Admin';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfileClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    navigate('/login');
    window.location.reload();
  };

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 sticky top-0 z-20">
      <div className="px-4 md:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleSidebar}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Search Bar */}
            <div className="hidden md:flex items-center relative">
              <Search className="absolute left-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Notifications"
            >
              <Bell className="w-6 h-6" />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {notifications}
                </span>
              )}
            </button>

            {/* User Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleProfileClick}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-semibold text-sm">
                    {username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-gray-900">{username}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {userRole.replace('-', ' ')}
                  </p>
                </div>
                <ChevronDown
                  className={`hidden md:block w-4 h-4 text-gray-500 transition-transform duration-200 ${
                    isDropdownOpen ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{username}</p>
                    <p className="text-xs text-gray-500 capitalize mt-1">
                      {userRole.replace('-', ' ')}
                    </p>
                  </div>
                  <button
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      // Navigate to settings if you have a settings page
                    }}
                  >
                    <User className="w-4 h-4 mr-3 text-gray-500" />
                    Profile
                  </button>
                  <button
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      // Navigate to settings if you have a settings page
                    }}
                  >
                    <Settings className="w-4 h-4 mr-3 text-gray-500" />
                    Settings
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;