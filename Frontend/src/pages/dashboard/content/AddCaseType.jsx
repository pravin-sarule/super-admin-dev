

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, ChevronDown, ChevronRight, Eye, X, Lock, Edit2 } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

const AddCaseType = () => {
  const [caseTypes, setCaseTypes] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [subTypes, setSubTypes] = useState({});
  const [showCaseTypeForm, setShowCaseTypeForm] = useState(false);
  const [showSubTypeForm, setShowSubTypeForm] = useState(false);
  const [selectedCaseTypeForSubType, setSelectedCaseTypeForSubType] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ id: null, name: '' });
  const [subTypeFormData, setSubTypeFormData] = useState({ id: null, case_type_id: null, name: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://super-admin-backend-120280829617.asia-south1.run.app/api';

  const getAuthToken = () => localStorage.getItem('token');

  useEffect(() => {
    fetchCaseTypes();
  }, []);

  const fetchCaseTypes = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/contents/case-types`);
      const caseTypesData = response.data;

      const updated = await Promise.all(
        caseTypesData.map(async (ct) => {
          try {
            const subRes = await axios.get(`${API_BASE_URL}/contents/sub-types/${ct.id}`);
            return { ...ct, sub_type_count: subRes.data.length };
          } catch {
            return { ...ct, sub_type_count: 0 };
          }
        })
      );

      setCaseTypes(updated);
    } catch (err) {
      console.error('Error fetching case types:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to fetch case types. Please try again.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubTypes = async (caseTypeId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/contents/sub-types/${caseTypeId}`);
      setSubTypes(prev => ({ ...prev, [caseTypeId]: response.data }));

      setCaseTypes(prev =>
        prev.map(ct =>
          ct.id === caseTypeId ? { ...ct, sub_type_count: response.data.length } : ct
        )
      );
    } catch (err) {
      console.error('Error fetching sub-types:', err);
      setSubTypes(prev => ({ ...prev, [caseTypeId]: [] }));
    }
  };

  const toggleRow = (caseTypeId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(caseTypeId)) {
      newExpanded.delete(caseTypeId);
    } else {
      newExpanded.add(caseTypeId);
      if (!subTypes[caseTypeId]) {
        fetchSubTypes(caseTypeId);
      }
    }
    setExpandedRows(newExpanded);
  };

  // Show form for adding new case type
  const handleShowCaseTypeForm = () => {
    setFormData({ id: null, name: '' });
    setIsEditing(false);
    setShowCaseTypeForm(true);
    setShowSubTypeForm(false);
  };

  // Show form for editing case type
  const handleEditCaseType = (caseType) => {
    setFormData({ id: caseType.id, name: caseType.name });
    setIsEditing(true);
    setShowCaseTypeForm(true);
    setShowSubTypeForm(false);
  };

  const handleHideCaseTypeForm = () => {
    setShowCaseTypeForm(false);
    setFormData({ id: null, name: '' });
    setIsEditing(false);
  };

  // Show form for adding new sub-type
  const handleShowSubTypeForm = (caseTypeId) => {
    setSubTypeFormData({ id: null, case_type_id: caseTypeId, name: '' });
    setSelectedCaseTypeForSubType(caseTypeId);
    setIsEditing(false);
    setShowSubTypeForm(true);
    setShowCaseTypeForm(false);
  };

  // Show form for editing sub-type
  const handleEditSubType = (subType, caseTypeId) => {
    setSubTypeFormData({ id: subType.id, case_type_id: caseTypeId, name: subType.name });
    setSelectedCaseTypeForSubType(caseTypeId);
    setIsEditing(true);
    setShowSubTypeForm(true);
    setShowCaseTypeForm(false);
  };

  const handleHideSubTypeForm = () => {
    setShowSubTypeForm(false);
    setSubTypeFormData({ id: null, case_type_id: null, name: '' });
    setSelectedCaseTypeForSubType(null);
    setIsEditing(false);
  };

  // Submit Case Type (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = getAuthToken();
      const config = {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      };

      if (isEditing) {
        // Update existing case type
        await axios.put(
          `${API_BASE_URL}/contents/admin/case-types/${formData.id}`,
          { name: formData.name },
          config
        );
        
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Case type updated successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      } else {
        // Create new case type
        await axios.post(
          `${API_BASE_URL}/contents/admin/case-types`,
          { name: formData.name },
          config
        );
        
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Case type created successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      }

      await fetchCaseTypes();
      handleHideCaseTypeForm();
    } catch (err) {
      console.error('Error saving case type:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.message || 'Failed to save case type. Please try again.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  // Submit Sub-Type (Create or Update)
  const handleSubTypeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = getAuthToken();
      const config = {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      };

      if (isEditing) {
        // Update existing sub-type
        await axios.put(
          `${API_BASE_URL}/contents/admin/sub-types/${subTypeFormData.id}`,
          {
            name: subTypeFormData.name,
            case_type_id: subTypeFormData.case_type_id
          },
          config
        );

        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Sub-type updated successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      } else {
        // Create new sub-type
        await axios.post(
          `${API_BASE_URL}/contents/admin/sub-types`,
          {
            case_type_id: subTypeFormData.case_type_id,
            name: subTypeFormData.name
          },
          config
        );

        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Sub-type created successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      }

      await fetchSubTypes(subTypeFormData.case_type_id);
      handleHideSubTypeForm();
    } catch (err) {
      console.error('Error saving sub-type:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.message || 'Failed to save sub-type. Please try again.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `This will delete "${name}" and all associated sub-types!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      await axios.delete(`${API_BASE_URL}/contents/admin/case-types/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchCaseTypes();
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Case type has been deleted.',
        confirmButtonColor: '#3B82F6',
        timer: 2000
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.message || 'Failed to delete case type.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubType = async (subTypeId, caseTypeId, subTypeName) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete "${subTypeName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      await axios.delete(`${API_BASE_URL}/contents/admin/sub-types/${subTypeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchSubTypes(caseTypeId);
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Sub-type deleted successfully.',
        confirmButtonColor: '#3B82F6',
        timer: 2000
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.message || 'Failed to delete sub-type.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCaseTypes = caseTypes.filter(ct =>
    ct.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCaseTypeName = (caseTypeId) =>
    caseTypes.find(ct => ct.id === caseTypeId)?.name || 'Unknown';

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2"> Manage Case Types</h1>
        <p className="text-gray-600 text-base">Manage case types and their sub-types</p>
      </div>

      {/* Case Type Form */}
      {showCaseTypeForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Case Type' : 'Add New Case Type'}
            </h2>
            <button onClick={handleHideCaseTypeForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Case Type Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="e.g., Civil, Criminal, Family"
                required
                disabled={loading}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleHideCaseTypeForm}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium text-sm transition-colors"
                disabled={loading || !formData.name.trim()}
              >
                {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-Type Form */}
      {showSubTypeForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Sub-Type' : 'Add New Sub-Type'}
            </h2>
            <button onClick={handleHideSubTypeForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubTypeSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Case Type</label>
              <input
                type="text"
                value={getCaseTypeName(subTypeFormData.case_type_id)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                disabled
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sub-Type Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subTypeFormData.name}
                onChange={(e) => setSubTypeFormData({ ...subTypeFormData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="e.g., Property Dispute, Divorce, Custody"
                required
                disabled={loading}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleHideSubTypeForm}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 font-medium text-sm transition-colors"
                disabled={loading || !subTypeFormData.name.trim()}
              >
                {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by ID, Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        {!showCaseTypeForm && !showSubTypeForm && (
          <button
            onClick={handleShowCaseTypeForm}
            className="ml-4 flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
            disabled={loading}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Case Type
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        {loading && !showCaseTypeForm && !showSubTypeForm ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 text-sm">Loading case types...</p>
          </div>
        ) : filteredCaseTypes.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            {searchTerm
              ? 'No case types found matching your search.'
              : 'No case types available. Add one to get started.'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  S.NO
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Case Type Name
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Sub-Types Count
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredCaseTypes.map((caseType, index) => (
                <React.Fragment key={caseType.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className="font-medium"># {caseType.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <button
                          onClick={() => toggleRow(caseType.id)}
                          className="text-gray-400 hover:text-gray-600 mr-3"
                        >
                          {expandedRows.has(caseType.id)
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <span className="text-sm font-medium text-gray-900">{caseType.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {caseType.sub_type_count ?? subTypes[caseType.id]?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleShowSubTypeForm(caseType.id)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Add Sub-Type
                        </button>
                        <button
                          onClick={() => toggleRow(caseType.id)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          View
                        </button>
                        {/* <button
                          onClick={() => handleDelete(caseType.id, caseType.name)}
                          className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                          disabled={loading}
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5" />
                          Delete
                        </button> */}
                        <button
  onClick={() => handleDelete(caseType.id, caseType.name)}
  className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
  disabled={loading}
>
  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
  Delete
</button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Sub-Types */}
                  {expandedRows.has(caseType.id) && (
                    <tr className="bg-gray-50">
                      <td colSpan="5" className="px-6 py-4">
                        <div className="ml-10">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">
                              Sub-Types for: <span className="text-blue-600">{caseType.name}</span>
                            </h4>
                            {/* Edit button for Case Type */}
                            <button
                              onClick={() => handleEditCaseType(caseType)}
                              className="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                              Edit Case Type
                            </button>
                          </div>
                          {!subTypes[caseType.id] ? (
                            <div className="text-center py-6">
                              <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 mx-auto rounded-full"></div>
                              <p className="mt-2 text-sm text-gray-600">Loading sub-types...</p>
                            </div>
                          ) : subTypes[caseType.id].length === 0 ? (
                            <div className="text-center py-6 text-gray-500 text-sm bg-white rounded-lg border border-gray-200">
                              No sub-types available. Click "Add Sub-Type" to create one.
                            </div>
                          ) : (
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">S.NO</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sub-Type Name</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {subTypes[caseType.id].map((subType, subIndex) => (
                                    <tr key={subType.id} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{subIndex + 1}</td>
                                      <td className="px-4 py-3 text-sm text-gray-600">
                                        <span className="font-medium"># {subType.id}</span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{subType.name}</td>
                                      <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                          <button
                                            onClick={() => handleEditSubType(subType, caseType.id)}
                                            className="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                          >
                                            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                                            Edit
                                          </button>
                                       <button
  onClick={() => handleDelete(caseType.id, caseType.name)}
  className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
  disabled={loading}
>
  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
  Delete
</button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AddCaseType;