import React, { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom'; // Import Outlet and useOutletContext
import Header from './Header';
import Sidebar from './Sidebar';

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { userRole } = useOutletContext(); // Get userRole from context passed by ProtectedRoute
  console.log('DashboardLayout - userRole from context:', userRole);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} userRole={userRole} /> {/* Pass userRole to Sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;