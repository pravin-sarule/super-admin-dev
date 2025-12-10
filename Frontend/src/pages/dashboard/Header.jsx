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

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Header = ({ toggleSidebar }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleProfileClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole'); // Also remove userRole
    navigate('/login');
    window.location.reload(); // Force a full page reload after navigation
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 p-4 flex justify-between items-center md:px-8">
      <button
        onClick={toggleSidebar}
        className="text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700 transition-colors duration-200"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      <h1 className="text-xl md:text-2xl font-semibold text-gray-800"></h1>
      
      <div className="relative flex items-center">
        <span className="mr-3 text-gray-600 font-medium hidden sm:inline">Welcome,Admin!</span>
        <button
          onClick={handleProfileClick}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
          aria-label="Profile"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 top-full">
            <button
              onClick={handleLogout}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;