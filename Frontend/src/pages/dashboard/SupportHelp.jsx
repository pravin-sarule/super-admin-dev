
import React, { useState, useEffect } from 'react';
import {
  Eye, Edit, Save, MessageCircle, Filter, ChevronLeft, ChevronRight,
  Trash2, PlusCircle, X, Mail, Clock, CheckCircle, AlertCircle,
  User, Calendar, Phone, MessageSquare, Send, RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

// Custom Sweet Alert Component (same as subscription management)
const SweetAlert = ({ isOpen, onClose, onConfirm, title, text, type = 'info', showCancel = false }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success': return 'bg-green-600 hover:bg-green-700';
      case 'error': return 'bg-red-600 hover:bg-red-700';
      case 'warning': return 'bg-yellow-600 hover:bg-yellow-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="text-4xl mb-4">{getIcon()}</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          {text && <p className="text-gray-600 mb-6">{text}</p>}
          <div className="flex justify-center space-x-3">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-lg ${getButtonColor()}`}
            >
              {showCancel ? 'Confirm' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// API Service for Support Queries
const supportApiService = {
  baseURL: `${API_BASE_URL}/support-queries`,
  
  getAuthToken() {
    // Get token from localStorage - adjust the key name as per your storage
    return localStorage.getItem('token');
  },
  
  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  },
  
  async fetchQueries() {
    const response = await fetch(`${this.baseURL}/all`, { // Assuming /all for fetching all queries
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },
  
  async createQuery(data) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },
  
  async getQuery(id) {
    const response = await fetch(`${this.baseURL}/${id}`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },
  
  async updateQuery(id, data) {
    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  },
  
  async deleteQuery(id) {
    const response = await fetch(`${this.baseURL}/${id}`, { 
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return { success: true };
  }
};

// Query Form Component
const QueryForm = ({ query, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState(query || {
    subject: '',
    message: '',
    priority: 'medium',
    category: 'general',
    user_email: '',
    user_name: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <div className="bg-white p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <h2 className="text-2xl font-semibold flex items-center">
          <PlusCircle className="mr-3" />
          {query ? 'Edit Support Query' : 'Create New Support Query'}
        </h2>
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <h4 className="font-medium border-b pb-2">Query Information</h4>
          
          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the issue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Message *</label>
            <textarea
              value={formData.message}
              onChange={(e) => handleChange('message', e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Detailed description of the issue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="general">General</option>
              <option value="technical">Technical</option>
              <option value="billing">Billing</option>
              <option value="account">Account</option>
              <option value="feature_request">Feature Request</option>
            </select>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <h4 className="font-medium border-b pb-2">User Information</h4>

          <div>
            <label className="block text-sm font-medium mb-1">User Name *</label>
            <input
              type="text"
              value={formData.user_name}
              onChange={(e) => handleChange('user_name', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="User's full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">User Email *</label>
            <input
              type="email"
              value={formData.user_email}
              onChange={(e) => handleChange('user_email', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
        >
          {loading ? 'Saving...' : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Query
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Query Details Component
const QueryDetails = ({ query, onEdit, onBack, onSave, editMode, loading }) => {
  const [editData, setEditData] = useState(query);
  const [responseMessage, setResponseMessage] = useState('');

  useEffect(() => {
    if (query) {
      setEditData(query);
    }
  }, [query]);

  const handleChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!editData || !editData.id) {
      alert('Query ID is missing. Please refresh and try again.');
      return;
    }
    onSave(editData);
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!query || !query.id) return;
    
    const updateData = {
      status: newStatus,
      admin_message: responseMessage || `Status updated to ${newStatus}`
    };
    
    try {
      await supportApiService.updateQuery(query.id, updateData);
      // Refresh the query data
      onSave({ ...query, ...updateData });
      setResponseMessage('');
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
      case 'in_progress': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'resolved': return 'bg-green-50 text-green-600 border-green-200';
      case 'closed': return 'bg-gray-50 text-gray-600 border-gray-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'bg-green-50 text-green-600';
      case 'medium': return 'bg-yellow-50 text-yellow-600';
      case 'high': return 'bg-orange-50 text-orange-600';
      case 'urgent': return 'bg-red-50 text-red-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  if (!query) return null;

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <h2 className="text-2xl font-semibold flex items-center">
          <MessageCircle className="mr-3" />
          Query Details
        </h2>
        <div className="flex space-x-2">
          <button onClick={onBack} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Back to List
          </button>
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                {loading ? 'Saving...' : <><Save className="w-4 h-4 mr-1" />Save</>}
              </button>
              <button onClick={() => onEdit(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => onEdit(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
              <Edit className="w-4 h-4 mr-1" />Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{query.subject}</h3>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <span className="flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {query.user_name}
                  </span>
                  <span className="flex items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    {query.user_email}
                  </span>
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(query.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusColor(query.status)}`}>
                  {query.status || 'pending'}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(query.priority)}`}>
                  {query.priority || 'medium'}
                </span>
              </div>
            </div>
            
            <div className="mb-4">
              <h4 className="font-medium mb-2">Message:</h4>
              <p className="text-gray-700 bg-white rounded p-3 border">
                {query.message}
              </p>
            </div>

            {query.admin_message && (
              <div className="mb-4">
                <h4 className="font-medium mb-2 text-blue-600">Admin Response:</h4>
                <p className="text-gray-700 bg-blue-50 rounded p-3 border border-blue-200">
                  {query.admin_message}
                </p>
              </div>
            )}
          </div>

          {/* Quick Response Section */}
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium mb-4 flex items-center">
              <Send className="w-4 h-4 mr-2" />
              Send Response & Update Status
            </h4>
            
            <div className="space-y-4">
              <textarea
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Type your response message here..."
              />
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleStatusUpdate('in_progress')}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-sm"
                  disabled={loading}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Mark In Progress
                </button>
                <button
                  onClick={() => handleStatusUpdate('resolved')}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center text-sm"
                  disabled={loading}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Mark Resolved
                </button>
                <button
                  onClick={() => handleStatusUpdate('closed')}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center text-sm"
                  disabled={loading}
                >
                  <X className="w-4 h-4 mr-1" />
                  Close Query
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Query Information</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">ID:</span>
                <span>#{query.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Category:</span>
                <span className="capitalize">{query.category || 'general'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span>{new Date(query.created_at || Date.now()).toLocaleDateString()}</span>
              </div>
              {query.updated_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Updated:</span>
                  <span>{new Date(query.updated_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Helpful Resources</h4>
            <div className="space-y-2 text-sm">
              <a href="#" className="block text-blue-600 hover:text-blue-800">
                Password Reset Guide
              </a>
              <a href="#" className="block text-blue-600 hover:text-blue-800">
                Subscription Management
              </a>
              <a href="#" className="block text-blue-600 hover:text-blue-800">
                Technical Troubleshooting
              </a>
              <a href="#" className="block text-blue-600 hover:text-blue-800">
                Contact Information
              </a>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Contact Information</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-2 text-gray-600" />
                <span>support@nexintel.com</span>
              </div>
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-2 text-gray-600" />
                <span>+1 (123) 456-7890</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Support Help Component
const SupportHelp = () => {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('list');
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [apiLoading, setApiLoading] = useState(false);
  
  // Sweet Alert State
  const [alert, setAlert] = useState({
    isOpen: false,
    title: '',
    text: '',
    type: 'info',
    showCancel: false,
    onConfirm: () => {}
  });

  const itemsPerPage = 5;

  const showAlert = (config) => {
    setAlert({
      isOpen: true,
      onConfirm: () => {
        config.onConfirm?.();
        setAlert(prev => ({ ...prev, isOpen: false }));
      },
      ...config
    });
  };

  const closeAlert = () => {
    setAlert(prev => ({ ...prev, isOpen: false }));
  };

  // Load queries
  const loadQueries = async () => {
    setLoading(true);
    try {
      const response = await supportApiService.fetchQueries();
      const queriesData = response.data || response;
      setQueries(Array.isArray(queriesData) ? queriesData : []);
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        text: 'Failed to load support queries'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueries();
  }, []);

  // Create query
  const handleCreate = async (data) => {
    setApiLoading(true);
    try {
      await supportApiService.createQuery(data);
      showAlert({
        type: 'success',
        title: 'Success!',
        text: 'Support query created successfully'
      });
      setCurrentView('list');
      loadQueries();
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        text: 'Failed to create support query'
      });
    } finally {
      setApiLoading(false);
    }
  };

  // View query details
  const handleView = async (query) => {
    try {
      const response = await supportApiService.getQuery(query.id);
      const queryData = response.data || response;
      setSelectedQuery(queryData);
      setCurrentView('details');
      setEditMode(false);
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        text: 'Failed to load query details'
      });
    }
  };

  // Update query
  const handleUpdate = async (data) => {
    if (!selectedQuery || !selectedQuery.id) {
      showAlert({
        type: 'error',
        title: 'Error',
        text: 'Query ID is missing. Please refresh and try again.'
      });
      return;
    }

    setApiLoading(true);
    try {
      await supportApiService.updateQuery(selectedQuery.id, data);
      showAlert({
        type: 'success',
        title: 'Success!',
        text: 'Query updated successfully'
      });
      setEditMode(false);
      loadQueries();
      // Refresh current query
      const response = await supportApiService.getQuery(selectedQuery.id);
      const queryData = response.data || response;
      setSelectedQuery(queryData);
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        text: 'Failed to update query'
      });
    } finally {
      setApiLoading(false);
    }
  };

  // Delete query
  const handleDelete = (query) => {
    showAlert({
      type: 'warning',
      title: 'Are you sure?',
      text: `This will permanently delete the query "${query.subject}".`,
      showCancel: true,
      onConfirm: async () => {
        setApiLoading(true);
        try {
          await supportApiService.deleteQuery(query.id);
          showAlert({
            type: 'success',
            title: 'Deleted!',
            text: 'Query deleted successfully'
          });
          loadQueries();
        } catch (error) {
          showAlert({
            type: 'error',
            title: 'Error',
            text: 'Failed to delete query'
          });
        } finally {
          setApiLoading(false);
        }
      }
    });
  };

  // Filter and paginate
  const filteredQueries = queries.filter(query => {
    const matchesSearch = query.subject?.toLowerCase().includes(search.toLowerCase()) ||
                         query.user_name?.toLowerCase().includes(search.toLowerCase()) ||
                         query.user_email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || query.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || query.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalPages = Math.ceil(filteredQueries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedQueries = filteredQueries.slice(startIndex, startIndex + itemsPerPage);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
      case 'in_progress': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'resolved': return 'bg-green-50 text-green-600 border-green-200';
      case 'closed': return 'bg-gray-50 text-gray-600 border-gray-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'bg-green-50 text-green-600';
      case 'medium': return 'bg-yellow-50 text-yellow-600';
      case 'high': return 'bg-orange-50 text-orange-600';
      case 'urgent': return 'bg-red-50 text-red-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading support queries...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg">
      <SweetAlert {...alert} onClose={closeAlert} />
      
      {currentView === 'create' && (
        <QueryForm
          onSave={handleCreate}
          onCancel={() => setCurrentView('list')}
          loading={apiLoading}
        />
      )}

      {currentView === 'details' && (
        <QueryDetails
          query={selectedQuery}
          onEdit={setEditMode}
          onBack={() => setCurrentView('list')}
          onSave={handleUpdate}
          editMode={editMode}
          loading={apiLoading}
        />
      )}

      {currentView === 'list' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold flex items-center">
              <MessageCircle className="mr-3" />
              Support & Help Management
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <input
                  type="text"
                  placeholder="Search queries..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <button
                onClick={() => setCurrentView('create')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Query
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedQueries.map((query) => (
                  <tr key={query.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">#{query.id}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate" title={query.subject}>
                        {query.subject}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium">{query.user_name}</div>
                        <div className="text-gray-500 text-xs">{query.user_email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusColor(query.status)}`}>
                        {(query.status || 'pending').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(query.priority)}`}>
                        {query.priority || 'medium'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize">{query.category || 'general'}</td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(query.created_at || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleView(query)}
                          className="p-1 border rounded hover:bg-gray-50"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(query)}
                          className="p-1 border border-red-300 text-red-600 rounded hover:bg-red-50"
                          disabled={apiLoading}
                          title="Delete Query"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedQueries.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      No queries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredQueries.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredQueries.length)} of {filteredQueries.length} entries
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`flex items-center px-3 py-2 text-sm border rounded-lg ${
                    currentPage === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                
                <div className="flex space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 text-sm border rounded-lg ${
                        currentPage === page
                          ? 'bg-blue-50 border-blue-500 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`flex items-center px-3 py-2 text-sm border rounded-lg ${
                    currentPage === totalPages
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50'
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
    </div>
  );
};

export default SupportHelp;