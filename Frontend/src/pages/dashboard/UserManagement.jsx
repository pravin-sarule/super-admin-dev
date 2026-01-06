import React, { useState, useMemo, useEffect } from 'react';
import { Eye, Lock, Unlock, Edit, Save, User, Mail, Shield, Hash, Filter, ChevronLeft, ChevronRight, Clock, RefreshCw, X, AlertTriangle, CheckCircle, AlertCircle, Building2, Users, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// API base URL - adjust this to your backend URL
const API_BASE_URL = 'https://super-admin-backend-120280829617.asia-south1.run.app/api';

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
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'solo', 'firms'
  const [users, setUsers] = useState([]);
  const [soloUsers, setSoloUsers] = useState([]);
  const [firms, setFirms] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState(null);
  const [showUserTable, setShowUserTable] = useState(true);
  const [showFirmDetails, setShowFirmDetails] = useState(false);
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

  // Fetch solo users
  const fetchSoloUsers = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/users/solo/all');
      console.log('Fetched solo users:', data);
      
      const transformedUsers = data.map(user => ({
        ...user,
        last_login_at: user.login_time,
        auth_type: user.auth_type || 'manual',
        is_blocked: user.is_blocked || false
      }));
      
      setSoloUsers(transformedUsers);
      showToast('Solo users loaded successfully', 'success');
    } catch (error) {
      console.error('Fetch solo users error:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to fetch solo users: ${error.message}`,
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch all firms
  const fetchFirms = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/users/firms/all');
      console.log('Fetched firms:', data);
      setFirms(data);
      showToast('Firms loaded successfully', 'success');
    } catch (error) {
      console.error('Fetch firms error:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to fetch firms: ${error.message}`,
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch firm details by ID
  const fetchFirmDetails = async (firmId) => {
    setLoading(true);
    try {
      const data = await apiCall(`/users/firms/${firmId}`);
      console.log('Fetched firm details:', data);
      setSelectedFirm(data);
      setShowFirmDetails(true);
    } catch (error) {
      console.error('Fetch firm details error:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to fetch firm details: ${error.message}`,
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLoading(false);
    }
  };

  // Approve firm
  const handleApproveFirm = async (firmId) => {
    MySwal.fire({
      title: 'Approve Firm',
      text: 'Are you sure you want to approve this firm?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, approve!',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await apiCall(`/users/firms/${firmId}/approval`, {
            method: 'PUT',
            body: JSON.stringify({ approval_status: 'APPROVED' })
          });
          showToast('Firm approved successfully!', 'success');
          fetchFirms();
          if (selectedFirm && selectedFirm.id === firmId) {
            setSelectedFirm({ ...selectedFirm, approval_status: 'APPROVED' });
          }
        } catch (error) {
          console.error('Approve firm error:', error);
          MySwal.fire({
            icon: 'error',
            title: 'Error',
            text: `Failed to approve firm: ${error.message}`,
            confirmButtonColor: '#3085d6',
          });
        }
      }
    });
  };

  // Delete firm
  const handleDeleteFirm = async (firmId) => {
    const firm = firms.find(f => f.id === firmId);
    MySwal.fire({
      title: 'Delete Firm',
      text: `Are you sure you want to delete "${firm?.firm_name}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete!',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await apiCall(`/users/firms/${firmId}`, {
            method: 'DELETE'
          });
          showToast('Firm deleted successfully!', 'success');
          fetchFirms();
          if (selectedFirm && selectedFirm.id === firmId) {
            setShowFirmDetails(false);
            setSelectedFirm(null);
          }
        } catch (error) {
          console.error('Delete firm error:', error);
          MySwal.fire({
            icon: 'error',
            title: 'Error',
            text: `Failed to delete firm: ${error.message}`,
            confirmButtonColor: '#3085d6',
          });
        }
      }
    });
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

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'all') {
      fetchUsersWithSessions();
    } else if (activeTab === 'solo') {
      fetchSoloUsers();
    } else if (activeTab === 'firms') {
      fetchFirms();
    }
  }, [activeTab]);

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

  // Filter firms
  const filteredFirms = useMemo(() => {
    if (!searchValue.trim()) {
      return firms;
    }
    const searchTerm = searchValue.toLowerCase().trim();
    return firms.filter(firm => {
      return (
        firm.firm_name?.toLowerCase().includes(searchTerm) ||
        firm.email?.toLowerCase().includes(searchTerm) ||
        firm.admin_email?.toLowerCase().includes(searchTerm) ||
        firm.approval_status?.toLowerCase().includes(searchTerm)
      );
    });
  }, [firms, searchValue]);

  const firmsTotalPages = Math.ceil(filteredFirms.length / itemsPerPage);
  const firmsStartIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFirms = filteredFirms.slice(firmsStartIndex, firmsStartIndex + itemsPerPage);

  // Filter solo users
  const filteredSoloUsers = useMemo(() => {
    if (!searchValue.trim()) {
      return soloUsers;
    }
    const searchTerm = searchValue.toLowerCase().trim();
    return soloUsers.filter(user => {
      return (
        user.id.toString().includes(searchTerm) ||
        (user.username && user.username.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm)) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchTerm))
      );
    });
  }, [soloUsers, searchValue]);

  const soloTotalPages = Math.ceil(filteredSoloUsers.length / itemsPerPage);
  const soloStartIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSoloUsers = filteredSoloUsers.slice(soloStartIndex, soloStartIndex + itemsPerPage);

  const getApprovalStatusBadge = (status) => {
    const statusMap = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'APPROVED': 'bg-green-100 text-green-800',
      'REJECTED': 'bg-red-100 text-red-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="relative p-6 bg-white rounded-xl shadow-lg w-full">
      {/* Toast Notification */}
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => {
              setActiveTab('all');
              setShowUserTable(true);
              setShowFirmDetails(false);
              setSelectedUser(null);
              setSelectedFirm(null);
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="w-5 h-5 inline mr-2" />
            All Users
          </button>
          <button
            onClick={() => {
              setActiveTab('solo');
              setShowUserTable(true);
              setShowFirmDetails(false);
              setSelectedUser(null);
              setSelectedFirm(null);
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'solo'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-5 h-5 inline mr-2" />
            Solo Users
          </button>
          <button
            onClick={() => {
              setActiveTab('firms');
              setShowUserTable(true);
              setShowFirmDetails(false);
              setSelectedUser(null);
              setSelectedFirm(null);
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'firms'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-5 h-5 inline mr-2" />
            Firm Management
          </button>
        </nav>
      </div>

      {/* Firm Details View */}
      {showFirmDetails && selectedFirm ? (
        <div className="bg-white">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <h2 className="text-3xl font-semibold text-gray-800 flex items-center">
              <Building2 className="mr-3" />
              Firm Details
            </h2>
            <button
              onClick={() => {
                setShowFirmDetails(false);
                setSelectedFirm(null);
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to List
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Firm Information</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Firm Name</label>
                  <p className="text-sm text-gray-900">{selectedFirm.firm_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Firm Type</label>
                  <p className="text-sm text-gray-900">{selectedFirm.firm_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Establishment Date</label>
                  <p className="text-sm text-gray-900">{new Date(selectedFirm.establishment_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Approval Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getApprovalStatusBadge(selectedFirm.approval_status)}`}>
                    {selectedFirm.approval_status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin User</label>
                  <p className="text-sm text-gray-900">{selectedFirm.admin_username || selectedFirm.admin_email || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Contact Information</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <p className="text-sm text-gray-900">{selectedFirm.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                  <p className="text-sm text-gray-900">{selectedFirm.mobile}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Landline</label>
                  <p className="text-sm text-gray-900">{selectedFirm.landline || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Office Address</label>
                  <p className="text-sm text-gray-900">{selectedFirm.office_address}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City, State, PIN</label>
                  <p className="text-sm text-gray-900">{selectedFirm.city}, {selectedFirm.state} - {selectedFirm.pin_code}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Legal Information</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registering Advocate</label>
                  <p className="text-sm text-gray-900">{selectedFirm.registering_advocate_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bar Enrollment Number</label>
                  <p className="text-sm text-gray-900">{selectedFirm.bar_enrollment_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date</label>
                  <p className="text-sm text-gray-900">{new Date(selectedFirm.enrollment_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State Bar Council</label>
                  <p className="text-sm text-gray-900">{selectedFirm.state_bar_council}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                  <p className="text-sm text-gray-900">{selectedFirm.pan_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                  <p className="text-sm text-gray-900">{selectedFirm.gst_number || 'N/A'}</p>
                </div>
              </div>
            </div>
            {selectedFirm.users && selectedFirm.users.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Firm Users ({selectedFirm.users.length})</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {selectedFirm.users.map((user) => (
                    <div key={user.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="font-medium text-gray-900">{user.username || user.email}</div>
                      <div className="text-gray-600 mt-1">Role: {user.role} | Status: {user.is_blocked ? 'Blocked' : 'Active'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {selectedFirm.approval_status === 'PENDING' && (
            <div className="mt-6 pt-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => handleApproveFirm(selectedFirm.id)}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve Firm
              </button>
              <button
                onClick={() => handleDeleteFirm(selectedFirm.id)}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Firm
              </button>
            </div>
          )}
        </div>
      ) : showUserTable ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-semibold text-gray-800 flex items-center">
              <User className="mr-3" />
              Manage Users
            </h2>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (activeTab === 'all') fetchUsersWithSessions();
                  else if (activeTab === 'solo') fetchSoloUsers();
                  else if (activeTab === 'firms') fetchFirms();
                }}
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
              <span className="ml-2 text-gray-600">Loading...</span>
            </div>
          ) : activeTab === 'firms' ? (
            // Firms Table
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">S.No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Firm Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Firm Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Admin</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Users</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedFirms.length > 0 ? (
                    paginatedFirms.map((firm, index) => (
                      <tr key={firm.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {firmsStartIndex + index + 1}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {firm.firm_name}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">
                          {firm.firm_type}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">
                          {firm.email}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">
                          {firm.admin_username || firm.admin_email || 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">
                          {firm.total_users || 0}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-semibold">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getApprovalStatusBadge(firm.approval_status)}`}>
                            {firm.approval_status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(firm.created_at)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => fetchFirmDetails(firm.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs leading-4 font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </button>
                            {firm.approval_status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleApproveFirm(firm.id)}
                                  className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs leading-4 font-semibold rounded-lg text-green-700 bg-green-50 hover:bg-green-100"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleDeleteFirm(firm.id)}
                                  className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs leading-4 font-semibold rounded-lg text-red-700 bg-red-50 hover:bg-red-100"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
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
                      <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                        No firms found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            // Users Table (All Users or Solo Users)
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">S.No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    {activeTab === 'solo' && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Full Name</th>}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Auth Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(activeTab === 'all' ? paginatedUsers : paginatedSoloUsers).length > 0 ? (
                    (activeTab === 'all' ? paginatedUsers : paginatedSoloUsers).map((user, index) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                          {(activeTab === 'all' ? startIndex : soloStartIndex) + index + 1}
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
                        {activeTab === 'solo' && (
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">
                            {user.full_name || 'N/A'}
                          </td>
                        )}
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
                      <td colSpan={activeTab === 'solo' ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
                        No users found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {((activeTab === 'firms' && filteredFirms.length > 0) || 
            (activeTab === 'solo' && filteredSoloUsers.length > 0) || 
            (activeTab === 'all' && filteredUsers.length > 0)) && (
            <div className="flex items-center justify-between mt-6 px-2">
              <div className="text-sm text-gray-700">
                {activeTab === 'firms' ? (
                  <>
                    Showing {firmsStartIndex + 1} to {Math.min(firmsStartIndex + itemsPerPage, filteredFirms.length)} of {filteredFirms.length} entries
                    {searchValue && <span className="text-gray-500"> (filtered from {firms.length} total entries)</span>}
                  </>
                ) : activeTab === 'solo' ? (
                  <>
                    Showing {soloStartIndex + 1} to {Math.min(soloStartIndex + itemsPerPage, filteredSoloUsers.length)} of {filteredSoloUsers.length} entries
                    {searchValue && <span className="text-gray-500"> (filtered from {soloUsers.length} total entries)</span>}
                  </>
                ) : (
                  <>
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredUsers.length)} of {filteredUsers.length} entries
                    {searchValue && <span className="text-gray-500"> (filtered from {users.length} total entries)</span>}
                  </>
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
                  {Array.from({ length: activeTab === 'firms' ? firmsTotalPages : activeTab === 'solo' ? soloTotalPages : totalPages }, (_, i) => i + 1).map(page => (
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
                  disabled={currentPage === (activeTab === 'firms' ? firmsTotalPages : activeTab === 'solo' ? soloTotalPages : totalPages)}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    currentPage === (activeTab === 'firms' ? firmsTotalPages : activeTab === 'solo' ? soloTotalPages : totalPages)
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