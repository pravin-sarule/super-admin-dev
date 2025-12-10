

import React, { useState, useMemo, useEffect } from 'react';
import { Eye, Lock, Unlock, Edit, Save, Mail, Shield, Hash, Filter, ChevronLeft, ChevronRight, RefreshCw, X, AlertTriangle, CheckCircle, AlertCircle, PlusCircle, User } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import CreateAdmin from './CreateAdmin'; // Import the CreateAdmin component
import { ADMIN_GET_ALL_URL, ADMIN_GET_BY_ID_URL, ADMIN_CREATE_URL } from '../../../config';
import { jwtDecode } from 'jwt-decode'; // Import jwt-decode

const MySwal = withReactContent(Swal);

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

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedAdmin, setEditedAdmin] = useState(null);
  const [showAdminTable, setShowAdminTable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [userRole, setUserRole] = useState(null);

  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'info'
  });
  
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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

  const getAuthToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  };

  const getUserRoleFromToken = () => {
    const token = getAuthToken();
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const decodedToken = JSON.parse(jsonPayload);
        return decodedToken.role;
      } catch (error) {
        console.error('Error decoding token:', error);
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    const role = getUserRoleFromToken();
    setUserRole(role);
    console.log('Current user role:', role);
    if (role) {
      fetchAdmins();
    }
  }, []);

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
      const response = await fetch(endpoint, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const responseData = await apiCall(ADMIN_GET_ALL_URL);
      console.log('Fetched admins response:', responseData);
      
      const adminsArray = responseData.admins || [];

      const transformedAdmins = adminsArray.map(admin => ({
        ...admin,
        username: admin.name || 'N/A',
        is_blocked: admin.is_blocked || false,
        role: admin.role || 'admin',
        createdAt: admin.created_at,
        updatedAt: admin.updated_at
      }));
      
      setAdmins(transformedAdmins);
      showToast('Admins loaded successfully', 'success');
    } catch (error) {
      console.error('Fetch admins error:', error);
      showToast(`Failed to fetch admins: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockAdmin = async (adminId) => {
    const admin = admins.find(a => a.id === adminId);
    const action = admin.is_blocked ? 'unblock' : 'block';
    
    if (window.confirm(`Are you sure you want to ${action} ${admin.username}?`)) {
      try {
        await apiCall(`${ADMIN_GET_BY_ID_URL}/${adminId}/block`, {
          method: 'PUT'
        });

        const updatedAdmins = admins.map(a =>
          a.id === adminId
            ? { ...a, is_blocked: !a.is_blocked }
            : a
        );
        setAdmins(updatedAdmins);
        
        if (selectedAdmin && selectedAdmin.id === adminId) {
          const updatedAdmin = updatedAdmins.find(a => a.id === adminId);
          setSelectedAdmin(updatedAdmin);
          setEditedAdmin(updatedAdmin);
        }

        showToast(`Admin ${action}ed successfully!`, 'success');
      } catch (error) {
        console.error('Block/unblock error:', error);
        showToast(`Failed to ${action} admin: ${error.message}`, 'error');
      }
    }
  };

  const handleSaveAdmin = async () => {
    if (!editedAdmin.username.trim() || !editedAdmin.email.trim()) {
      showToast('Username and email are required', 'warning');
      return;
    }

    try {
      const updateData = {
        name: editedAdmin.username, // Changed to 'name'
        email: editedAdmin.email,
        role_name: editedAdmin.role, // Changed to 'role_name'
        ...(editedAdmin.password && { password: editedAdmin.password })
      };

      await apiCall(`${ADMIN_GET_BY_ID_URL}/${editedAdmin.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const updatedAdmins = admins.map(admin =>
        admin.id === editedAdmin.id ? { ...admin, ...editedAdmin } : admin
      );
      setAdmins(updatedAdmins);
      setSelectedAdmin(editedAdmin);
      setEditMode(false);

      showToast('Admin updated successfully!', 'success');
    } catch (error) {
      console.error('Save admin error:', error);
      showToast(`Failed to update admin: ${error.message}`, 'error');
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    const admin = admins.find(a => a.id === adminId);
    
    if (window.confirm(`Are you sure you want to delete ${admin.username}? This action cannot be undone.`)) {
      try {
        await apiCall(`${ADMIN_GET_BY_ID_URL}/${adminId}`, {
          method: 'DELETE'
        });

        setAdmins(admins.filter(a => a.id !== adminId));
        showToast('Admin deleted successfully!', 'success');
        if (selectedAdmin && selectedAdmin.id === adminId) {
          handleBackToTable();
        }
      } catch (error) {
        console.error('Delete admin error:', error);
        showToast(`Failed to delete admin: ${error.message}`, 'error');
      }
    }
  };

  const handleViewAdmin = (admin) => {
    setSelectedAdmin(admin);
    setEditedAdmin({ ...admin });
    setEditMode(admin.editMode || false); // Set editMode based on the passed admin object
    setShowAdminTable(false);
    setShowCreateAdmin(false);
  };

  const handleBackToTable = () => {
    setSelectedAdmin(null);
    setEditedAdmin(null);
    setEditMode(false);
    setShowAdminTable(true);
    setShowCreateAdmin(false);
    fetchAdmins();
  };

  const handleCreateAdminClick = () => {
    setShowCreateAdmin(true);
    setShowAdminTable(false);
    setSelectedAdmin(null);
    setEditedAdmin(null);
    setEditMode(false);
  };

  const filteredAdmins = useMemo(() => {
    if (!searchValue.trim()) {
      return admins;
    }
    
    const searchTerm = searchValue.toLowerCase().trim();
    return admins.filter(admin => {
      return (
        admin.id.toString().includes(searchTerm) ||
        (admin.username && admin.username.toLowerCase().includes(searchTerm)) ||
        (admin.email && admin.email.toLowerCase().includes(searchTerm)) ||
        (admin.role && admin.role.toLowerCase().includes(searchTerm))
      );
    });
  }, [admins, searchValue]);

  const totalPages = Math.ceil(filteredAdmins.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAdmins = filteredAdmins.slice(startIndex, startIndex + itemsPerPage);

  const handleSearchChange = (value) => {
    setSearchValue(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleEditToggle = () => {
    if (editMode) {
      setEditedAdmin({ ...selectedAdmin });
    }
    setEditMode(!editMode);
    console.log('Edit mode toggled. Current editMode:', !editMode);
  };

  const handleInputChange = (field, value) => {
    setEditedAdmin({ ...editedAdmin, [field]: value });
  };

  const handleRefresh = () => {
    fetchAdmins();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="relative p-6 bg-white rounded-xl shadow-lg">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />

      {showAdminTable && !showCreateAdmin && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-semibold text-gray-800 flex items-center">
              <Shield className="mr-3" />
              Manage Admins
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
              
              <button
                onClick={handleCreateAdminClick}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Admin
              </button>

              <Filter className="w-5 h-5 text-gray-600" />
              <input
                type="text"
                placeholder="Search by ID, Username, Email, or Role..."
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
              <span className="ml-2 text-gray-600">Loading admins...</span>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedAdmins.length > 0 ? (
                    paginatedAdmins.map((admin, index) => (
                      <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <Hash className="w-4 h-4 mr-1 text-gray-600" />
                            {admin.id}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {admin.username || 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-1 text-gray-600" />
                            {admin.email || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <Shield className="w-4 h-4 mr-1 text-gray-600" />
                            {admin.role || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-semibold">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            admin.is_blocked 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {admin.is_blocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewAdmin(admin)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs leading-4 font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </button>
                            <button
                              onClick={() => handleViewAdmin({ ...admin, editMode: true })} // Pass editMode to enable editing directly
                              className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs leading-4 font-semibold rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </button>
                            {userRole === 'super_admin' && (
                              <>
                                <button
                                  onClick={() => handleBlockAdmin(admin.id)}
                                  className={`inline-flex items-center px-3 py-1.5 border text-xs leading-4 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                                    admin.is_blocked
                                      ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100 focus:ring-green-500'
                                      : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 focus:ring-red-500'
                                  }`}
                                >
                                  {admin.is_blocked ? <Unlock className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                                  {admin.is_blocked ? 'Unblock' : 'Block'}
                                </button>
                                <button
                                  onClick={() => handleDeleteAdmin(admin.id)}
                                  className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs leading-4 font-semibold rounded-lg text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        No admins found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {filteredAdmins.length > 0 && (
            <div className="flex items-center justify-between mt-6 px-2">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredAdmins.length)} of {filteredAdmins.length} entries
                {searchValue && (
                  <span className="text-gray-500"> (filtered from {admins.length} total entries)</span>
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
      )}

      {!showAdminTable && !showCreateAdmin && selectedAdmin && (
        <div className="bg-white">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <h2 className="text-3xl font-semibold text-gray-800 flex items-center">
              <Shield className="mr-3" />
              Admin Details
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleBackToTable}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Back to List
              </button>
              {userRole === 'super_admin' && ( // Only super_admin can see edit/save/cancel buttons
                editMode ? (
                  <>
                    <button
                      onClick={handleSaveAdmin}
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
                )
              )}
              {userRole === 'super_admin' && (
                <>
                  <button
                    onClick={() => handleBlockAdmin(selectedAdmin.id)}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                      selectedAdmin?.is_blocked
                        ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                        : 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                    }`}
                  >
                    {selectedAdmin?.is_blocked ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                    {selectedAdmin?.is_blocked ? 'Unblock' : 'Block'}
                  </button>
                  <button
                    onClick={() => handleDeleteAdmin(selectedAdmin.id)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin ID</label>
                    <div className="flex items-center">
                      <Hash className="w-4 h-4 mr-2 text-gray-600" />
                      <span className="text-sm text-gray-900">{selectedAdmin?.id}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    {editMode && userRole === 'super_admin' ? (
                      <input
                        type="text"
                        value={editedAdmin?.username || ''}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                        placeholder="Enter name"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{selectedAdmin?.username || 'N/A'}</p>
                    )}
                    {console.log('Name field - editMode:', editMode, 'userRole:', userRole, 'editedAdmin.username:', editedAdmin?.username)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    {editMode && userRole === 'super_admin' ? (
                      <input
                        type="email"
                        value={editedAdmin?.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                      />
                    ) : (
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-gray-600" />
                        <span className="text-sm text-gray-900">{selectedAdmin?.email || 'N/A'}</span>
                      </div>
                    )}
                    {console.log('Email field - editMode:', editMode, 'userRole:', userRole, 'editedAdmin.email:', editedAdmin?.email)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    {editMode && userRole === 'super_admin' ? (
                      <select
                        value={editedAdmin?.role || ''}
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                        <option value="user-admin">User Admin</option>
                        <option value="support-admin">Support Admin</option>
                        <option value="account-admin">Account Admin</option>
                      </select>
                    ) : (
                      <div className="flex items-center">
                        <Shield className="w-4 h-4 mr-2 text-gray-600" />
                        <span className="text-sm text-gray-900">{selectedAdmin?.role || 'N/A'}</span>
                      </div>
                    )}
                    {console.log('Role field - editMode:', editMode, 'userRole:', userRole, 'editedAdmin.role:', editedAdmin?.role)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedAdmin?.is_blocked
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedAdmin?.is_blocked ? 'Blocked' : 'Active'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedAdmin?.createdAt)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Updated At</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedAdmin?.updatedAt)}</p>
                  </div>
                </div>
                {editMode && userRole === 'super_admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      value={editedAdmin?.password || ''}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="Enter new password (leave empty to keep current)"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                    />
                    {console.log('Password field - editMode:', editMode, 'userRole:', userRole, 'editedAdmin.password:', editedAdmin?.password)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateAdmin && (
        <CreateAdmin onAdminCreated={handleBackToTable} onCancel={handleBackToTable} />
      )}
    </div>
  );
};

export default AdminManagement;