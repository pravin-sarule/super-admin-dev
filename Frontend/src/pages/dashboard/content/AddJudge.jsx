
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, X, Eye, Building2, Edit2, Lock } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

const AddJudge = () => {
  const [judges, setJudges] = useState([]);
  const [courts, setCourts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    designation: '',
    court_id: '',
    bench_name: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewJudge, setViewJudge] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://super-admin-backend-120280829617.asia-south1.run.app/api';

  const getAuthToken = () => {
    return localStorage.getItem('token');
  };

  useEffect(() => {
    fetchCourts();
    fetchJudges();
  }, []);

  const fetchCourts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/contents/courts`);
      setCourts(response.data);
    } catch (err) {
      console.error('Error fetching courts:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to fetch courts. Please try again.',
        confirmButtonColor: '#3B82F6'
      });
    }
  };

  const fetchJudges = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/contents/judges`);
      setJudges(response.data);
    } catch (err) {
      console.error('Error fetching judges:', err);
      setJudges([]);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to fetch judges. Please try again.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShowForm = () => {
    setFormData({
      id: null,
      name: '',
      designation: '',
      court_id: '',
      bench_name: ''
    });
    setIsEditing(false);
    setShowForm(true);
    setViewJudge(null);
  };

  const handleEditJudge = (judge) => {
    setFormData({
      id: judge.id,
      name: judge.name,
      designation: judge.designation,
      court_id: judge.court_id,
      bench_name: judge.bench_name
    });
    setIsEditing(true);
    setShowForm(true);
    setViewJudge(null);
  };

  const handleHideForm = () => {
    setShowForm(false);
    setFormData({
      id: null,
      name: '',
      designation: '',
      court_id: '',
      bench_name: ''
    });
    setIsEditing(false);
  };

  const handleViewJudge = (judge) => {
    setViewJudge(judge);
    setShowForm(false);
  };

  const handleCloseView = () => {
    setViewJudge(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = getAuthToken();
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      const payload = {
        name: formData.name,
        designation: formData.designation,
        court_id: parseInt(formData.court_id),
        bench_name: formData.bench_name
      };

      if (isEditing) {
        // Update existing judge
        await axios.put(
          `${API_BASE_URL}/contents/admin/judges/${formData.id}`,
          payload,
          config
        );

        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Judge updated successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      } else {
        // Create new judge
        await axios.post(
          `${API_BASE_URL}/contents/admin/judges`,
          payload,
          config
        );

        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Judge added successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      }
      
      await fetchJudges();
      handleHideForm();
    } catch (err) {
      console.error('Error saving judge:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.message || 'Failed to save judge. Please try again.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, judgeName) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete "${judgeName}"?`,
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
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      await axios.delete(`${API_BASE_URL}/contents/admin/judges/${id}`, config);
      await fetchJudges();
      
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Judge has been deleted.',
        confirmButtonColor: '#3B82F6',
        timer: 2000
      });
    } catch (err) {
      console.error('Error deleting judge:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.message || 'Failed to delete judge. Please try again.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const getCourtName = (courtId) => {
    const court = courts.find(c => c.id === courtId);
    return court ? court.name : 'Unknown Court';
  };

  const getCourtState = (courtId) => {
    const court = courts.find(c => c.id === courtId);
    return court ? court.state : 'N/A';
  };

  const filteredJudges = judges.filter(judge =>
    judge.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    judge.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    judge.bench_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2"> Manage Judges</h1>
        <p className="text-gray-600 text-base">Manage judges and their information</p>
      </div>

      {/* Add/Edit Judge Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Judge' : 'Add New Judge'}
            </h2>
            <button
              onClick={handleHideForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Judge Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="e.g., Justice Ramesh Kumar"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Designation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="e.g., Chief Justice, District Judge"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Court <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.court_id}
                  onChange={(e) => setFormData({ ...formData, court_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                  disabled={loading}
                >
                  <option value="">Select a court</option>
                  {courts.map(court => (
                    <option key={court.id} value={court.id}>
                      {court.name} - {court.state}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bench Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.bench_name}
                  onChange={(e) => setFormData({ ...formData, bench_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="e.g., Principal Bench"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={handleHideForm}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium text-sm transition-colors"
                disabled={loading || !formData.name.trim() || !formData.designation.trim() || !formData.court_id || !formData.bench_name.trim()}
              >
                {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Judge Details */}
      {viewJudge && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Judge Details</h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleEditJudge(viewJudge)}
                className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Judge
              </button>
              <button
                onClick={handleCloseView}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Judge ID</label>
              <p className="text-gray-900 font-semibold"># {viewJudge.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Judge Name</label>
              <p className="text-gray-900 font-semibold">{viewJudge.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Designation</label>
              <p className="text-gray-900 font-semibold">
                <span className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                  {viewJudge.designation}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Court</label>
              <p className="text-gray-900 font-semibold flex items-center">
                <Building2 className="w-4 h-4 mr-1 text-gray-400" />
                {viewJudge.court_name || getCourtName(viewJudge.court_id)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">State</label>
              <p className="text-gray-900 font-semibold">
                {viewJudge.court_state || getCourtState(viewJudge.court_id)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Bench Name</label>
              <p className="text-gray-900 font-semibold">{viewJudge.bench_name}</p>
            </div>
          </div>
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
        {!showForm && !viewJudge && (
          <button
            onClick={handleShowForm}
            className="ml-4 flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
            disabled={loading}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Judge
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        {loading && !showForm && !viewJudge ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 text-sm">Loading judges...</p>
          </div>
        ) : filteredJudges.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            {searchTerm ? 'No judges found matching your search.' : 'No judges available. Add one to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                    Judge Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Court
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Bench
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredJudges.map((judge, index) => (
                  <tr key={judge.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className="font-medium"># {judge.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{judge.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {judge.designation}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {judge.court_name || getCourtName(judge.court_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{judge.bench_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewJudge(judge)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          title="View Judge Details"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          View
                        </button>
                        <button
                          onClick={() => handleDelete(judge.id, judge.name)}
                          className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                          disabled={loading}
                          title="Delete Judge"
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
    </div>
  );
};

export default AddJudge;