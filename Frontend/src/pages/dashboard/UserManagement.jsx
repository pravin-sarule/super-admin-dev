import React, { useState, useMemo, useEffect } from 'react';
import { Eye, Lock, Unlock, Edit, Save, User, Mail, Shield, Hash, Filter, ChevronLeft, ChevronRight, Clock, RefreshCw, X, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// API base URL - adjust this to your backend URL
const API_BASE_URL = 'http://localhost:4000/api';

const MySwal = withReactContent(Swal);

// Toast Notification Component (Alternative for non-blocking alerts)
const Toast = ({ isVisible, message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 transform transition-all duration-300 ease-in-out">
      <div className={`flex items-center p-4 rounded-lg border shadow-lg ${getToastStyles()} max-w-sm`}>
        <div className="flex-shrink-0 mr-3">
          {getIcon()}
        </div>
        <div className="flex-1 text-sm font-medium">
          {message}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const UserManagement = () => {
  // State management
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState(null);
  const [showUserTable, setShowUserTable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [userSessions, setUserSessions] = useState([]);
  
  // Toast notification state
  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'info'
  });
  
  // Filter and pagination states
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Toast helper functions
  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({
      isVisible: true,
      message,
      type
    });
    
    setTimeout(() => {
      setToast(prev => ({ ...prev, isVisible: false }));
    }, duration);
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  // Get auth token from localStorage
  const getAuthToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  };

  // API helper function
  const apiCall = async (endpoint, options = {}) => {
    const token = getAuthToken();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  };

  // Fetch users with last session info
  const fetchUsersWithSessions = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/users/sessions');
      console.log('Fetched users:', data);
      
      const transformedUsers = data.map(user => ({
        ...user,
        last_login_at: user.login_time,
        auth_type: user.auth_type || 'manual',
        is_blocked: user.is_blocked || false
      }));
      
      setUsers(transformedUsers);
      showToast('Users loaded successfully', 'success');
    } catch (error) {
      console.error('Fetch users error:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to fetch users: ${error.message}`,
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch specific user sessions
  const fetchUserSessions = async (userId) => {
    try {
      const data = await apiCall(`/users/sessions/${userId}`);
      console.log('Fetched user sessions:', data);
      
      const transformedSessions = data.map((session, index) => ({
        id: index + 1,
        login_at: session.login_time,
        logout_at: session.logout_time,
        created_at: session.login_time
      }));
      
      setUserSessions(transformedSessions);
    } catch (error) {
      console.error('Fetch user sessions error:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to fetch user sessions: ${error.message}`,
        confirmButtonColor: '#3085d6',
      });
    }
  };

  // Toggle block/unblock user
  const handleBlockUser = async (userId) => {
    const user = users.find(u => u.id === userId);
    const action = user.is_blocked ? 'unblock' : 'block';
    
    MySwal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      text: `Are you sure you want to ${action} ${user.username}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: `Yes, ${action}!`,
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await apiCall(`/users/block/${userId}`, {
            method: 'PUT'
          });

          const updatedUsers = users.map(u => 
            u.id === userId 
              ? { ...u, is_blocked: !u.is_blocked }
              : u
          );
          setUsers(updatedUsers);
          
          if (selectedUser && selectedUser.id === userId) {
            const updatedUser = updatedUsers.find(u => u.id === userId);
            setSelectedUser(updatedUser);
            setEditedUser(updatedUser);
          }

          showToast(`User ${action}ed successfully!`, 'success');
        } catch (error) {
          console.error('Block/unblock error:', error);
          MySwal.fire({
            icon: 'error',
            title: 'Error',
            text: `Failed to ${action} user: ${error.message}`,
            confirmButtonColor: '#3085d6',
          });
        }
      }
    });
  };

  // Update user
  const handleSaveUser = async () => {
    try {
      const updateData = {
        username: editedUser.username,
        ...(editedUser.password && { password: editedUser.password })
      };

      await apiCall(`/users/edit/${editedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const updatedUsers = users.map(user =>
        user.id === editedUser.id ? { ...user, ...editedUser } : user
      );
      setUsers(updatedUsers);
      setSelectedUser(editedUser);
      setEditMode(false);

      showToast('User updated successfully!', 'success');
    } catch (error) {
      console.error('Save user error:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to update user: ${error.message}`,
        confirmButtonColor: '#3085d6',
      });
    }
  };

  // Unblock specific user
  const handleUnblockUser = async (userId) => {
    const user = users.find(u => u.id === userId);
    
    if (!user.is_blocked) {
      showToast('User is already unblocked!', 'info');
      return;
    }

    MySwal.fire({
      title: 'Unblock User',
      text: `Are you sure you want to unblock ${user.username}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, unblock!',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await apiCall(`/users/unblock/${userId}`, {
            method: 'PUT'
          });

          const updatedUsers = users.map(u =>
            u.id === userId
              ? { ...u, is_blocked: false }
              : u
          );
          setUsers(updatedUsers);
          
          if (selectedUser && selectedUser.id === userId) {
            const updatedUser = updatedUsers.find(u => u.id === userId);
            setSelectedUser(updatedUser);
            setEditedUser(updatedUser);
          }

          showToast('User unblocked successfully!', 'success');
        } catch (error) {
          console.error('Unblock error:', error);
          MySwal.fire({
            icon: 'error',
            title: 'Error',
            text: `Failed to unblock user: ${error.message}`,
            confirmButtonColor: '#3085d6',
          });
        }
      }
    });
  };

  // Load users on component mount
  useEffect(() => {
    fetchUsersWithSessions();
  }, []);

  const handleViewUser = async (user) => {
    setSelectedUser(user);
    setEditedUser({ ...user });
    setEditMode(false);
    setShowUserTable(false);
    await fetchUserSessions(user.id);
  };

  const handleBackToTable = () => {
    setSelectedUser(null);
    setEditedUser(null);
    setEditMode(false);
    setShowUserTable(true);
    setUserSessions([]);
  };

  // Filter and pagination logic
  const filteredUsers = useMemo(() => {
    if (!searchValue.trim()) {
      return users;
    }
    
    const searchTerm = searchValue.toLowerCase().trim();
    return users.filter(user => {
      return (
        user.id.toString().includes(searchTerm) ||
        (user.username && user.username.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm))
      );
    });
  }, [users, searchValue]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const handleSearchChange = (value) => {
    setSearchValue(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleEditToggle = () => {
    setEditMode(!editMode);
  };

  const handleInputChange = (field, value) => {
    setEditedUser({ ...editedUser, [field]: value });
  };

  const handleRefresh = () => {
    fetchUsersWithSessions();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="relative p-6 bg-white rounded-xl shadow-lg">
      {/* Toast Notification */}
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />

      {showUserTable ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-semibold text-gray-800 flex items-center">
              <User className="mr-3" />
              Manage Users
            </h2>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              <Filter className="w-5 h-5 text-gray-600" />
              <input
                type="text"
                placeholder="Search by ID, Username, or Email..."
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              />
              
              {searchValue && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading users...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">S.No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Auth Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedUsers.length > 0 ? (
                    paginatedUsers.map((user, index) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <Hash className="w-4 h-4 mr-1 text-gray-600" />
                            {user.id}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.username || 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-1 text-gray-600" />
                            {user.email || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                          {user.auth_type || 'manual'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-semibold">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.is_blocked 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {user.is_blocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(user.last_login_at)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewUser(user)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs leading-4 font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </button>
                            <button
                              onClick={() => handleBlockUser(user.id)}
                              className={`inline-flex items-center px-3 py-1.5 border text-xs leading-4 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                                user.is_blocked 
                                  ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100 focus:ring-green-500' 
                                  : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 focus:ring-red-500'
                              }`}
                            >
                              {user.is_blocked ? <Unlock className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                              {user.is_blocked ? 'Unblock' : 'Block'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                        No users found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {filteredUsers.length > 0 && (
            <div className="flex items-center justify-between mt-6 px-2">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredUsers.length)} of {filteredUsers.length} entries
                {searchValue && (
                  <span className="text-gray-500"> (filtered from {users.length} total entries)</span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    currentPage === 1
                      ? 'border-gray-300 text-gray-400 bg-white cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                
                <div className="flex space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        currentPage === page
                          ? 'border-blue-500 text-blue-600 bg-blue-50'
                          : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    currentPage === totalPages
                      ? 'border-gray-300 text-gray-400 bg-white cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <h2 className="text-3xl font-semibold text-gray-800 flex items-center">
              <User className="mr-3" />
              User Details
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleBackToTable}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Back to List
              </button>
              {editMode ? (
                <>
                  <button
                    onClick={handleSaveUser}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </button>
                  <button
                    onClick={handleEditToggle}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEditToggle}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </button>
              )}
              {selectedUser?.is_blocked && (
                <button
                  onClick={() => handleUnblockUser(selectedUser.id)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Unblock User
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                    <div className="flex items-center">
                      <Hash className="w-4 h-4 mr-2 text-gray-600" />
                      <span className="text-sm text-gray-900">{selectedUser?.id}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editedUser?.username || ''}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{selectedUser?.username || 'N/A'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-2 text-gray-600" />
                      <span className="text-sm text-gray-900">{selectedUser?.email || 'N/A'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Authentication Type</label>
                    <div className="flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-gray-600" />
                      <span className="text-sm text-gray-900">{selectedUser?.auth_type || 'manual'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedUser?.is_blocked 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedUser?.is_blocked ? 'Blocked' : 'Active'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <span className="text-sm text-gray-900">{selectedUser?.role || 'N/A'}</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedUser?.created_at)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Updated At</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedUser?.updated_at)}</p>
                  </div>
                </div>
                {editMode && selectedUser?.auth_type === 'manual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      value={editedUser?.password || ''}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="Enter new password (leave empty to keep current)"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                    />
                  </div>
                )}
              </div>
            </div>
            {/* User Sessions */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 border-b pb-2 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Session History
              </h4>
              
              <div className="max-h-96 overflow-y-auto space-y-2">
                {userSessions.length > 0 ? (
                  userSessions.map((session, index) => (
                    <div key={session.id || index} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="font-medium text-gray-900">Session #{session.id}</div>
                      <div className="text-gray-600 mt-1">
                        <div>Login: {formatDate(session.login_at)}</div>
                        <div>Logout: {formatDate(session.logout_at)}</div>
                        <div>Created: {formatDate(session.created_at)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    No session history available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;