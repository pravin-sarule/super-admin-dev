import React, { useState, useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Check localStorage for sidebar state preference
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : window.innerWidth >= 768;
  });
  const { userRole } = useOutletContext();

  useEffect(() => {
    // Save sidebar state to localStorage
    localStorage.setItem('sidebarOpen', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    // Handle window resize
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} userRole={userRole} toggleSidebar={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 animate-fadeIn">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;