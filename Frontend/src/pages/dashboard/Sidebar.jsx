import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Shield,
  LifeBuoy,
  CreditCard,
  Bot,
  MessageSquare,
  Edit,
  X
} from 'lucide-react';

const Sidebar = ({ isOpen, userRole, toggleSidebar }) => {
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState(null);

  const handleMenuToggle = (menuName) => {
    setOpenMenu(openMenu === menuName ? null : menuName);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const allMenuItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['super-admin', 'user-admin', 'account-admin', 'support-admin']
    },
    {
      name: 'User Management',
      path: '/dashboard/users',
      icon: Users,
      roles: ['super-admin', 'user-admin']
    },
    {
      name: 'Admin Management',
      path: '/dashboard/admins',
      icon: Shield,
      roles: ['super-admin']
    },
    {
      name: 'Prompt Management',
      path: '/dashboard/prompts',
      icon: Edit,
      roles: ['super-admin']
    },
    {
      name: 'System Prompt Management',
      path: '/dashboard/system-prompts',
      icon: MessageSquare,
      roles: ['super-admin']
    },
    {
      name: 'LLM Management',
      path: '/dashboard/llm-management',
      icon: Bot,
      roles: ['super-admin']
    },
    {
      name: 'Content Management',
      path: '/dashboard/content', // Assuming a path for content management
      icon: FileText,
      roles: ['super-admin', 'user-admin']
    },
    {
      name: 'Subscription Management',
      path: '/dashboard/subscriptions', // Assuming a path for subscription management
      icon: CreditCard,
      roles: ['super-admin', 'account-admin']
    },
    {
      name: 'Support & Help',
      path: '/dashboard/support', // Assuming a path for support and help
      icon: LifeBuoy,
      roles: ['super-admin', 'support-admin']
    },
    {
      name: 'Settings',
      path: '/dashboard/settings',
      icon: Settings,
      roles: ['super-admin', 'user-admin', 'account-admin', 'support-admin']
    }
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`bg-gradient-to-b from-slate-50 to-white text-gray-700 h-screen transition-all duration-300 ease-in-out ${
          isOpen ? 'w-72' : 'w-20'
        } flex flex-col shadow-2xl border-r border-gray-200/50 fixed md:relative z-40`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-gray-200/50 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mr-3 flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-sm">SA</span>
              </div>
              {isOpen && (
                <div className="flex-1 min-w-0">
                  <h2 className="text-gray-800 font-bold text-lg whitespace-nowrap overflow-hidden truncate">
                    {userRole ? userRole.replace('-', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Super Admin'}
                  </h2>
                  <p className="text-xs text-gray-500 truncate">Admin Portal</p>
                </div>
              )}
            </div>
            {isOpen && (
              <button
                onClick={toggleSidebar}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-grow py-4 overflow-y-auto custom-scrollbar px-3">
          {menuItems.map((item, index) => {
            const active = isActive(item.path);
            return (
              <div key={index} className="mb-1">
                {item.path ? (
                  <Link
                    to={item.path}
                    className={`w-full flex items-center px-4 py-3 mb-1 text-sm rounded-xl transition-all duration-200 group relative ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                    }`}
                    title={!isOpen ? item.name : ''}
                  >
                    {active && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full" />
                    )}
                    <item.icon
                      className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                        active
                          ? 'text-white'
                          : 'text-gray-500 group-hover:text-gray-700'
                      } ${isOpen ? 'mr-3' : 'mx-auto'}`}
                    />
                    {isOpen && (
                      <span
                        className={`font-medium whitespace-nowrap overflow-hidden ${
                          active ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {item.name}
                      </span>
                    )}
                    {active && isOpen && (
                      <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />
                    )}
                  </Link>
                ) : (
                  <>
                    <button
                      className={`w-full flex items-center px-4 py-3 mb-1 text-sm rounded-xl transition-all duration-200 group ${
                        openMenu === item.key
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                      }`}
                      onClick={() => isOpen && handleMenuToggle(item.key)}
                      title={!isOpen ? item.name : ''}
                    >
                      <item.icon
                        className={`w-5 h-5 flex-shrink-0 ${
                          isOpen ? 'mr-3' : 'mx-auto'
                        } text-gray-500 group-hover:text-gray-700`}
                      />
                      {isOpen && (
                        <>
                          <span className="font-medium flex-grow text-left whitespace-nowrap overflow-hidden">
                            {item.name}
                          </span>
                          <div className="transition-transform duration-200 flex-shrink-0">
                            {openMenu === item.key ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </>
                      )}
                    </button>

                    {/* Submenu */}
                    {isOpen && openMenu === item.key && item.subItems && (
                      <div className="ml-6 mb-2 border-l-2 border-gray-200 pl-4 space-y-1 animate-fadeIn">
                        {item.subItems.map((subItem, subIndex) => (
                          <Link
                            key={subIndex}
                            to={subItem.path}
                            className="flex items-center w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-all duration-200"
                          >
                            <subItem.icon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="whitespace-nowrap overflow-hidden">
                              {subItem.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200/50 bg-white/50 backdrop-blur-sm">
          {isOpen ? (
            <div className="text-center">
              <div className="text-xs text-gray-500 font-medium">
                © 2025 Nexintel Admin
              </div>
              <div className="text-xs text-gray-400 mt-1">
                v1.0.0
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">N</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;