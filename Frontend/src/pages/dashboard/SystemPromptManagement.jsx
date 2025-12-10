import React, { useState, useMemo, useEffect } from 'react';
import { Eye, Edit, Save, FileText, Trash2, PlusCircle, X, ChevronLeft, ChevronRight, Filter, Calendar, Copy } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { API_BASE_URL } from '../../config';

const MySwal = withReactContent(Swal);

// System Prompts API URL
const SYSTEM_PROMPTS_API_URL = `${API_BASE_URL}/system-prompts`;

const SystemPromptManagement = () => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(null);
  const [showPromptTable, setShowPromptTable] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    system_prompt: ''
  });

  // Search and pagination states
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Loading states
  const [createLoading, setCreateLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState({});

  // Get token helper
  const getToken = () => {
    return localStorage.getItem('token');
  };

  // Fetch all system prompts
  const fetchPrompts = async () => {
    const token = getToken();
    if (!token) {
      setError('No authentication token found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(SYSTEM_PROMPTS_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success && response.data.data) {
        const transformedData = response.data.data.map(prompt => ({
          id: prompt.id,
          system_prompt: prompt.system_prompt,
          created_at: new Date(prompt.created_at).toLocaleString(),
          updated_at: new Date(prompt.updated_at).toLocaleString(),
        }));
        setPrompts(transformedData);
      } else {
        setPrompts([]);
      }
    } catch (err) {
      console.error('Error fetching system prompts:', err);
      setError('Failed to fetch system prompts.');
      
      if (err.response?.status === 401) {
        MySwal.fire({
          icon: 'error',
          title: 'Authentication Error',
          text: 'Your session has expired. Please login again.',
          confirmButtonColor: '#3085d6',
        }).then(() => {
          localStorage.removeItem('token');
          window.location.href = '/login';
        });
      } else {
        MySwal.fire({
          icon: 'error',
          title: 'Error!',
          text: err.response?.data?.message || 'Failed to fetch system prompts. Please try again later.',
          confirmButtonColor: '#3085d6',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleViewPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setEditMode(false);
    setShowPromptTable(false);
  };

  const handleEditPrompt = () => {
    setEditMode(true);
    setEditedPrompt({ ...selectedPrompt });
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedPrompt(null);
  };

  const handleSaveEdit = async () => {
    if (!editedPrompt.system_prompt || editedPrompt.system_prompt.trim() === '') {
      MySwal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: 'System prompt cannot be empty.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    setUpdateLoading(true);
    try {
      const token = getToken();
      const response = await axios.put(
        `${SYSTEM_PROMPTS_API_URL}/${selectedPrompt.id}`,
        { system_prompt: editedPrompt.system_prompt.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      MySwal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'System prompt updated successfully.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
      });

      setEditMode(false);
      setEditedPrompt(null);
      fetchPrompts();
      setSelectedPrompt(null);
      setShowPromptTable(true);
    } catch (err) {
      console.error('Error updating system prompt:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.message || 'Failed to update system prompt.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditedPrompt(prev => ({ ...prev, [field]: value }));
  };

  const handleDeletePrompt = async (id) => {
    const result = await MySwal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      setDeleteLoading(prev => ({ ...prev, [id]: true }));
      try {
        const token = getToken();
        await axios.delete(`${SYSTEM_PROMPTS_API_URL}/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        MySwal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'System prompt has been deleted.',
          confirmButtonColor: '#3085d6',
          timer: 2000,
        });

        fetchPrompts();
        if (selectedPrompt?.id === id) {
          setSelectedPrompt(null);
          setShowPromptTable(true);
        }
      } catch (err) {
        console.error('Error deleting system prompt:', err);
        MySwal.fire({
          icon: 'error',
          title: 'Error!',
          text: err.response?.data?.message || 'Failed to delete system prompt.',
          confirmButtonColor: '#3085d6',
        });
      } finally {
        setDeleteLoading(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const handleCreatePrompt = async () => {
    if (!newPrompt.system_prompt || newPrompt.system_prompt.trim() === '') {
      MySwal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: 'System prompt is required.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    setCreateLoading(true);
    try {
      const token = getToken();
      const response = await axios.post(
        SYSTEM_PROMPTS_API_URL,
        { system_prompt: newPrompt.system_prompt.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      MySwal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'System prompt created successfully.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
      });

      setNewPrompt({ system_prompt: '' });
      setShowCreateForm(false);
      setShowPromptTable(true);
      fetchPrompts();
    } catch (err) {
      console.error('Error creating system prompt:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.message || 'Failed to create system prompt.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    MySwal.fire({
      icon: 'success',
      title: 'Copied!',
      text: 'Content copied to clipboard.',
      confirmButtonColor: '#3085d6',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  // Search and filter logic
  const filteredPrompts = useMemo(() => {
    return prompts.filter(prompt =>
      prompt.system_prompt.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [prompts, searchValue]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPrompts.length / itemsPerPage);
  const paginatedPrompts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPrompts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPrompts, currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (loading && prompts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading system prompts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                <FileText className="mr-3 text-gray-800" size={32} />
                System Prompt Management
              </h1>
              <p className="text-gray-600 mt-2">Manage system prompts for AI interactions</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {showPromptTable && !showCreateForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateForm(true);
                    setShowPromptTable(false);
                  }}
                  className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg"
                >
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Create New System Prompt
                </button>
              </div>

              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search prompts..."
                    value={searchValue}
                    onChange={(e) => {
                      setSearchValue(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Create New System Prompt</h2>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setShowPromptTable(true);
                  setNewPrompt({ system_prompt: '' });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newPrompt.system_prompt}
                  onChange={(e) => setNewPrompt({ ...newPrompt, system_prompt: e.target.value })}
                  rows={12}
                  placeholder="Enter your system prompt here..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  This prompt will be used as the system message for AI interactions.
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleCreatePrompt}
                disabled={createLoading}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? 'Creating...' : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Create System Prompt
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setShowPromptTable(true);
                  setNewPrompt({ system_prompt: '' });
                }}
                className="px-6 py-3 border border-gray-300 text-base font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Prompts Table */}
        {showPromptTable && !selectedPrompt && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        ID
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      System Prompt (Preview)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Updated At
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
                          <p className="text-gray-600 font-medium">Loading system prompts...</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedPrompts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium text-lg">No system prompts found</p>
                        <p className="text-gray-400 text-sm mt-2">
                          {searchValue ? 'Try adjusting your search criteria' : 'Create your first system prompt to get started'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedPrompts.map((prompt) => (
                      <tr key={prompt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">#{prompt.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-md">
                            {prompt.system_prompt.length > 100
                              ? `${prompt.system_prompt.substring(0, 100)}...`
                              : prompt.system_prompt}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            {prompt.created_at}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            {prompt.updated_at}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewPrompt(prompt)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePrompt(prompt.id)}
                              disabled={deleteLoading[prompt.id]}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                            >
                              {deleteLoading[prompt.id] ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filteredPrompts.length > 0 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-semibold">
                    {Math.min(currentPage * itemsPerPage, filteredPrompts.length)}
                  </span>{' '}
                  of <span className="font-semibold">{filteredPrompts.length}</span> prompts
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </button>
                  <span className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prompt Detail View */}
        {selectedPrompt && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => {
                  setSelectedPrompt(null);
                  setShowPromptTable(true);
                  setEditMode(false);
                  setEditedPrompt(null);
                }}
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold transition-colors"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back to List
              </button>
              <div className="flex gap-3">
                {editMode ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      disabled={updateLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updateLoading ? 'Saving...' : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEditPrompt}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleCopyToClipboard(selectedPrompt.system_prompt)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Content
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ID</label>
                <p className="text-sm font-semibold text-gray-900">#{selectedPrompt.id}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Created At</label>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                  <span className="text-sm text-gray-900">{selectedPrompt.created_at}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Updated At</label>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                  <span className="text-sm text-gray-900">{selectedPrompt.updated_at}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">System Prompt</label>
                {editMode ? (
                  <textarea
                    value={editedPrompt.system_prompt}
                    onChange={(e) => handleInputChange('system_prompt', e.target.value)}
                    rows={15}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="Enter system prompt..."
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap border">
                    {selectedPrompt.system_prompt}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemPromptManagement;

