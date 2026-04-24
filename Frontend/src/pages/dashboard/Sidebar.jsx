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
  X,
  Gavel, // Added for Case Type
  Building2, // Added for Court
  UserCheck, // Added for Judge
  FileCheck, // Added for Document Management
  BookMarked, // Added for Citation Management
  FileUp,
  Search,
} from 'lucide-react';

const Sidebar = ({ isOpen, userRole, toggleSidebar }) => {
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState(null);
  const username = localStorage.getItem('username') || 'Admin';
  const roleLabel =
    userRole === 'support-admin'
      ? 'Support Admin'
      : userRole === 'user-admin'
        ? 'User Admin'
        : userRole === 'account-admin'
          ? 'Account Admin'
          : 'Super Admin';
  const initials = username
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'AD';

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
      name: 'Citation Management',
      path: '/dashboard/citation-management',
      icon: BookMarked,
      roles: ['super-admin']
    },
    {
      name: 'Agent Prompt Management',
      path: '/dashboard/agent-prompts',
      icon: Bot,
      roles: ['super-admin']
    },
    {
      name: 'Template Management',
      path: '/dashboard/templates',
      icon: FileText,
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
      name: 'Document Management',
      path: '/dashboard/documents',
      icon: FileCheck,
      roles: ['super-admin']
    },
    {
      name: 'Judgement Upload',
      path: '/dashboard/judgements',
      icon: FileUp,
      roles: ['super-admin']
    },
    {
      name: 'Judgement Search',
      path: '/dashboard/judgement-search',
      icon: Search,
      roles: ['super-admin']
    },
    // {
    //   name: 'Content Management',
    //   path: '/dashboard/content', // Assuming a path for content management
    //   icon: FileText,
    //   roles: ['super-admin', 'user-admin']
    // },
    {
      name: 'Content Management',
      key: 'content',
      icon: FileText,
      roles: ['super-admin', 'user-admin'],
      subItems: [
        {
          name: 'Add Case Type',
          path: '/dashboard/content/case-type',
          icon: Gavel
        },
        {
          name: 'Add Court',
          path: '/dashboard/content/court',
          icon: Building2
        },
        {
          name: 'Add Judge',
          path: '/dashboard/content/judge',
          icon: UserCheck
        }
      ]
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

      {/* Sidebar - dark theme matching reference */}
      <div
        className={`bg-slate-800 text-slate-200 h-screen transition-all duration-300 ease-in-out ${isOpen ? 'w-72' : 'w-20'
          } flex flex-col shadow-2xl border-r border-slate-700/50 fixed md:relative z-40`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1 min-w-0">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                <span className="text-white font-bold text-sm">{initials}</span>
              </div>
              {isOpen && (
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-bold text-base whitespace-nowrap overflow-hidden truncate">
                    {username}
                  </h2>
                  <p className="text-xs text-slate-400 truncate">{roleLabel} Portal</p>
                </div>
              )}
            </div>
            {isOpen && (
              <button
                onClick={toggleSidebar}
                className="md:hidden p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-grow py-4 overflow-y-auto custom-scrollbar px-3">
          {menuItems.map((item, index) => {
            const active = item.path ? isActive(item.path) : false;
            return (
              <div key={index} className="mb-1">
                {item.path ? (
                  <Link
                    to={item.path}
                    className={`w-full flex items-center px-4 py-3 mb-1 text-sm rounded-lg transition-all duration-200 group relative ${active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                      }`}
                    title={!isOpen ? item.name : ''}
                  >
                    <item.icon
                      className={`w-5 h-5 flex-shrink-0 ${active
                          ? 'text-white'
                          : 'text-slate-400 group-hover:text-slate-200'
                        } ${isOpen ? 'mr-3' : 'mx-auto'}`}
                    />
                    {isOpen && (
                      <span className="font-medium whitespace-nowrap overflow-hidden flex-1">
                        {item.name}
                      </span>
                    )}
                    {active && isOpen && (
                      <div className="w-2 h-2 bg-white rounded-full flex-shrink-0" />
                    )}
                  </Link>
                ) : (
                  <>
                    <button
                      className={`w-full flex items-center px-4 py-3 mb-1 text-sm rounded-lg transition-all duration-200 group ${openMenu === item.key
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                        }`}
                      onClick={() => isOpen && handleMenuToggle(item.key)}
                      title={!isOpen ? item.name : ''}
                    >
                      <item.icon
                        className={`w-5 h-5 flex-shrink-0 ${isOpen ? 'mr-3' : 'mx-auto'
                          } text-slate-400 group-hover:text-slate-200`}
                      />
                      {isOpen && (
                        <>
                          <span className="font-medium flex-grow text-left whitespace-nowrap overflow-hidden">
                            {item.name}
                          </span>
                          <div className="transition-transform duration-200 flex-shrink-0">
                            {openMenu === item.key ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </>
                      )}
                    </button>

                    {/* Submenu */}
                    {isOpen && openMenu === item.key && item.subItems && (
                      <div className="ml-6 mb-2 border-l-2 border-slate-600 pl-4 space-y-1 animate-fadeIn">
                        {item.subItems.map((subItem, subIndex) => (
                          <Link
                            key={subIndex}
                            to={subItem.path}
                            className="flex items-center w-full px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/40 rounded-lg transition-all duration-200"
                          >
                            <subItem.icon className="w-4 h-4 mr-2 text-slate-500 flex-shrink-0" />
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
        <div className="p-4 border-t border-slate-700/50">
          {isOpen ? (
            <div className="text-center">
              <div className="text-xs text-slate-500">
                © 2025 Nexintel Admin v1.0.0
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
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
