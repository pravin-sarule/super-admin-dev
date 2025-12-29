

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, MapPin, X, Eye, Edit2, Building2, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

const AddCourt = () => {
  const [activeTab, setActiveTab] = useState('benches');
  
  // Jurisdictions State
  const [jurisdictions, setJurisdictions] = useState([]);
  const [showJurisdictionForm, setShowJurisdictionForm] = useState(false);
  const [jurisdictionFormData, setJurisdictionFormData] = useState({
    id: null,
    name: '',
    description: ''
  });
  const [isEditingJurisdiction, setIsEditingJurisdiction] = useState(false);
  
  // Courts State
  const [courts, setCourts] = useState([]);
  const [showCourtForm, setShowCourtForm] = useState(false);
  const [courtFormData, setCourtFormData] = useState({
    id: null,
    jurisdiction_id: '',
    court_name: ''
  });
  const [isEditingCourt, setIsEditingCourt] = useState(false);
  
  // Benches State
  const [benches, setBenches] = useState([]);
  const [benchesByCourt, setBenchesByCourt] = useState({}); // Store benches by court_id
  const [showBenchForm, setShowBenchForm] = useState(false);
  const [benchFormData, setBenchFormData] = useState({
    id: null,
    court_id: '',
    bench_name: '',
    location: '',
    is_principal: false
  });
  const [isEditingBench, setIsEditingBench] = useState(false);
  const [selectedCourtForBenches, setSelectedCourtForBenches] = useState(null);
  
  // Common State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('');
  const [selectedJurisdictionForBenches, setSelectedJurisdictionForBenches] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  
  // Pagination State
  const [jurisdictionPage, setJurisdictionPage] = useState(1);
  const [courtPage, setCourtPage] = useState(1);
  const [benchPage, setBenchPage] = useState(1);
  const [benchTabCourtPage, setBenchTabCourtPage] = useState(1);
  const itemsPerPage = 10;

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://super-admin-backend-120280829617.asia-south1.run.app/api';

  const getAuthToken = () => {
    return localStorage.getItem('token');
  };

  useEffect(() => {
    fetchJurisdictions();
    fetchCourts();
  }, []);

  // Fetch benches for all courts when benches tab is active
  useEffect(() => {
    if (activeTab === 'benches' && courts.length > 0) {
      fetchAllBenchesForCourts();
    }
  }, [activeTab, courts]);

  // Reset pagination when filters change
  useEffect(() => {
    setJurisdictionPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setCourtPage(1);
  }, [searchTerm, selectedJurisdiction]);

  // Reset bench tab court pagination when tab changes or courts update
  useEffect(() => {
    if (activeTab === 'benches') {
      setBenchTabCourtPage(1);
    }
  }, [activeTab, courts.length]);

  // Reset bench tab pagination when filter changes
  useEffect(() => {
    setBenchTabCourtPage(1);
  }, [selectedJurisdictionForBenches]);

  // ==================== FETCH FUNCTIONS ====================
  const fetchJurisdictions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/contents/jurisdictions`);
      setJurisdictions(response.data);
    } catch (err) {
      console.error('Error fetching jurisdictions:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to fetch jurisdictions.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/contents/courts`);
      setCourts(response.data);
    } catch (err) {
      console.error('Error fetching courts:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to fetch courts.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBenchesByCourt = async (courtId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/contents/benches/court/${courtId}`);
      setBenches(response.data);
    } catch (err) {
      console.error('Error fetching benches:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to fetch benches.',
        confirmButtonColor: '#3B82F6'
      });
    }
  };

  const fetchAllBenchesForCourts = async () => {
    try {
      const benchesMap = {};
      // Fetch benches for all courts in parallel
      const promises = courts.map(async (court) => {
        try {
          const response = await axios.get(`${API_BASE_URL}/contents/benches/court/${court.id}`);
          benchesMap[court.id] = response.data;
        } catch (err) {
          console.error(`Error fetching benches for court ${court.id}:`, err);
          benchesMap[court.id] = [];
        }
      });
      await Promise.all(promises);
      setBenchesByCourt(benchesMap);
    } catch (err) {
      console.error('Error fetching benches for courts:', err);
    }
  };

  // ==================== JURISDICTION HANDLERS ====================
  const handleShowJurisdictionForm = () => {
    setJurisdictionFormData({ id: null, name: '', description: '' });
    setIsEditingJurisdiction(false);
    setShowJurisdictionForm(true);
    setViewItem(null);
  };

  const handleEditJurisdiction = (jurisdiction) => {
    setJurisdictionFormData({
      id: jurisdiction.id,
      name: jurisdiction.name,
      description: jurisdiction.description || ''
    });
    setIsEditingJurisdiction(true);
    setShowJurisdictionForm(true);
    setViewItem(null);
  };

  const handleJurisdictionSubmit = async (e) => {
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

      if (isEditingJurisdiction) {
        const { id, ...updateData } = jurisdictionFormData;
        await axios.put(
          `${API_BASE_URL}/contents/admin/jurisdictions/${id}`,
          { name: updateData.name, description: updateData.description },
          config
        );
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Jurisdiction updated successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      } else {
        await axios.post(
          `${API_BASE_URL}/contents/admin/jurisdictions`,
          { name: jurisdictionFormData.name, description: jurisdictionFormData.description },
          config
        );
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Jurisdiction created successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      }
      
      await fetchJurisdictions();
      setShowJurisdictionForm(false);
      setJurisdictionFormData({ id: null, name: '', description: '' });
    } catch (err) {
      console.error('Error saving jurisdiction:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to save jurisdiction.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJurisdiction = async (id, name) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Delete "${name}"? This will also delete all courts and benches under it.`,
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
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      await axios.delete(`${API_BASE_URL}/contents/admin/jurisdictions/${id}`, config);
      await fetchJurisdictions();
      await fetchCourts();
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Jurisdiction deleted successfully.',
        confirmButtonColor: '#3B82F6',
        timer: 2000
      });
    } catch (err) {
      console.error('Error deleting jurisdiction:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to delete jurisdiction.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  // ==================== COURT HANDLERS ====================
  const handleShowCourtForm = () => {
    setCourtFormData({ id: null, jurisdiction_id: '', court_name: '' });
    setIsEditingCourt(false);
    setShowCourtForm(true);
    setViewItem(null);
  };

  const handleEditCourt = (court) => {
    setCourtFormData({
      id: court.id,
      jurisdiction_id: court.jurisdiction_id,
      court_name: court.court_name
    });
    setIsEditingCourt(true);
    setShowCourtForm(true);
    setViewItem(null);
  };

  const handleCourtSubmit = async (e) => {
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

      if (isEditingCourt) {
        await axios.put(
          `${API_BASE_URL}/contents/admin/courts/${courtFormData.id}`,
          courtFormData,
          config
        );
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Court updated successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      } else {
        await axios.post(
          `${API_BASE_URL}/contents/admin/courts`,
          courtFormData,
          config
        );
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Court created successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      }
      
      await fetchCourts();
      setShowCourtForm(false);
      setCourtFormData({ id: null, jurisdiction_id: '', court_name: '' });
    } catch (err) {
      console.error('Error saving court:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to save court.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourt = async (id, name) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Delete "${name}"? This will also delete all benches under it.`,
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
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      await axios.delete(`${API_BASE_URL}/contents/admin/courts/${id}`, config);
      await fetchCourts();
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Court deleted successfully.',
        confirmButtonColor: '#3B82F6',
        timer: 2000
      });
    } catch (err) {
      console.error('Error deleting court:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to delete court.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  // ==================== BENCH HANDLERS ====================
  const handleShowBenchForm = (court = null) => {
    setBenchFormData({
      id: null,
      court_id: court ? court.id : '',
      bench_name: '',
      location: '',
      is_principal: false
    });
    setSelectedCourtForBenches(court);
    setIsEditingBench(false);
    setShowBenchForm(true);
    setViewItem(null);
  };

  const handleEditBench = (bench) => {
    setBenchFormData({
      id: bench.id,
      court_id: bench.court_id,
      bench_name: bench.bench_name,
      location: bench.location || '',
      is_principal: bench.is_principal
    });
    setIsEditingBench(true);
    setShowBenchForm(true);
    setViewItem(null);
  };

  const handleBenchSubmit = async (e) => {
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

      if (isEditingBench) {
        await axios.put(
          `${API_BASE_URL}/contents/admin/benches/${benchFormData.id}`,
          benchFormData,
          config
        );
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Bench updated successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      } else {
        await axios.post(
          `${API_BASE_URL}/contents/admin/benches`,
          benchFormData,
          config
        );
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Bench created successfully!',
          confirmButtonColor: '#3B82F6',
          timer: 2000
        });
      }
      
      await fetchCourts();
      if (viewItem && viewItem.type === 'court') {
        await fetchBenchesByCourt(viewItem.data.id);
      }
      // Refresh benches for all courts if on benches tab
      if (activeTab === 'benches') {
        await fetchAllBenchesForCourts();
      }
      setShowBenchForm(false);
      setBenchFormData({ id: null, court_id: '', bench_name: '', location: '', is_principal: false });
    } catch (err) {
      console.error('Error saving bench:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to save bench.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBench = async (id, name) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Delete "${name}"?`,
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
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      await axios.delete(`${API_BASE_URL}/contents/admin/benches/${id}`, config);
      await fetchCourts();
      if (viewItem && viewItem.type === 'court') {
        await fetchBenchesByCourt(viewItem.data.id);
      }
      // Refresh benches for all courts if on benches tab
      if (activeTab === 'benches') {
        await fetchAllBenchesForCourts();
      }
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Bench deleted successfully.',
        confirmButtonColor: '#3B82F6',
        timer: 2000
      });
    } catch (err) {
      console.error('Error deleting bench:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to delete bench.',
        confirmButtonColor: '#3B82F6'
      });
    } finally {
      setLoading(false);
    }
  };

  // ==================== VIEW HANDLERS ====================
  const handleViewCourt = async (court) => {
    setViewItem({ type: 'court', data: court });
    await fetchBenchesByCourt(court.id);
    setShowCourtForm(false);
    setShowBenchForm(false);
    setShowJurisdictionForm(false);
  };

  const handleCloseForms = () => {
    setShowJurisdictionForm(false);
    setShowCourtForm(false);
    setShowBenchForm(false);
    setViewItem(null);
    setBenches([]);
    setSelectedJurisdiction('');
    setSelectedJurisdictionForBenches('');
  };

  // ==================== FILTER DATA ====================
  const filteredJurisdictions = jurisdictions.filter(j =>
    j.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCourts = courts.filter(c => {
    const matchesSearch = c.court_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.jurisdiction_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesJurisdiction = !selectedJurisdiction || 
      c.jurisdiction_id?.toString() === selectedJurisdiction || 
      c.jurisdiction_id === parseInt(selectedJurisdiction);
    return matchesSearch && matchesJurisdiction;
  });

  // ==================== PAGINATION HELPERS ====================
  const getPaginatedData = (data, currentPage, itemsPerPage) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (dataLength, itemsPerPage) => {
    return Math.ceil(dataLength / itemsPerPage) || 1;
  };

  // Filter courts for benches tab
  const filteredBenchTabCourts = courts.filter(c => {
    const matchesJurisdiction = !selectedJurisdictionForBenches || 
      c.jurisdiction_id?.toString() === selectedJurisdictionForBenches || 
      c.jurisdiction_id === parseInt(selectedJurisdictionForBenches);
    return matchesJurisdiction;
  });

  // Paginated data
  const paginatedJurisdictions = getPaginatedData(filteredJurisdictions, jurisdictionPage, itemsPerPage);
  const paginatedCourts = getPaginatedData(filteredCourts, courtPage, itemsPerPage);
  const paginatedBenches = getPaginatedData(benches, benchPage, itemsPerPage);
  const paginatedBenchTabCourts = getPaginatedData(filteredBenchTabCourts, benchTabCourtPage, itemsPerPage);

  // Total pages
  const totalJurisdictionPages = getTotalPages(filteredJurisdictions.length, itemsPerPage);
  const totalCourtPages = getTotalPages(filteredCourts.length, itemsPerPage);
  const totalBenchPages = getTotalPages(benches.length, itemsPerPage);
  const totalBenchTabCourtPages = getTotalPages(filteredBenchTabCourts.length, itemsPerPage);

  // Pagination Component
  const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage, startIndex, endIndex }) => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;
      
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) pages.push(i);
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
        } else {
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
          pages.push('...');
          pages.push(totalPages);
        }
      }
      return pages;
    };

    return (
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{endIndex}</span> of{' '}
              <span className="font-medium">{totalItems}</span> results
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              {getPageNumbers().map((page, index) => (
                <button
                  key={index}
                  onClick={() => typeof page === 'number' && onPageChange(page)}
                  disabled={page === '...' || page === currentPage}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    page === currentPage
                      ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : page === '...'
                      ? 'text-gray-700 ring-1 ring-inset ring-gray-300 cursor-default'
                      : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Court Management System</h1>
        <p className="text-gray-600 text-base">Manage jurisdictions, courts, and benches</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => {
                setActiveTab('jurisdictions');
                handleCloseForms();
              }}
              className={`${
                activeTab === 'jurisdictions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Layers className="w-4 h-4 mr-2" />
              Jurisdictions ({jurisdictions.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('courts');
                handleCloseForms();
              }}
              className={`${
                activeTab === 'courts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Courts ({courts.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('benches');
                handleCloseForms();
              }}
              className={`${
                activeTab === 'benches'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Add Benches
            </button>
          </nav>
        </div>
      </div>

      {/* JURISDICTIONS TAB */}
      {activeTab === 'jurisdictions' && (
        <>
          {/* Jurisdiction Form */}
          {showJurisdictionForm && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEditingJurisdiction ? 'Edit Jurisdiction' : 'Add New Jurisdiction'}
                </h2>
                <button onClick={handleCloseForms} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleJurisdictionSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Jurisdiction Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={jurisdictionFormData.name}
                      onChange={(e) => setJurisdictionFormData({ ...jurisdictionFormData, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="e.g., High Court"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={jurisdictionFormData.description}
                      onChange={(e) => setJurisdictionFormData({ ...jurisdictionFormData, description: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Brief description"
                      rows="3"
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseForms}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium text-sm"
                    disabled={loading || !jurisdictionFormData.name.trim()}
                  >
                    {loading ? 'Saving...' : (isEditingJurisdiction ? 'Update' : 'Create')}
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
                placeholder="Search jurisdictions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            {!showJurisdictionForm && (
              <button
                onClick={handleShowJurisdictionForm}
                className="ml-4 flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Jurisdiction
              </button>
            )}
          </div>

          {/* Jurisdictions Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            {filteredJurisdictions.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                {searchTerm ? 'No jurisdictions found.' : 'No jurisdictions available. Add one to get started.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">S.NO</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Courts</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedJurisdictions.map((jurisdiction, index) => (
                      <tr key={jurisdiction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{(jurisdictionPage - 1) * itemsPerPage + index + 1}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{jurisdiction.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{jurisdiction.description || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {jurisdiction.court_count || 0} Courts
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditJurisdiction(jurisdiction)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteJurisdiction(jurisdiction.id, jurisdiction.name)}
                              className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
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
        </>
      )}

      {/* COURTS TAB */}
      {activeTab === 'courts' && (
        <>
          {/* Court Form */}
          {showCourtForm && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEditingCourt ? 'Edit Court' : 'Add New Court'}
                </h2>
                <button onClick={handleCloseForms} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleCourtSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Jurisdiction <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={courtFormData.jurisdiction_id}
                      onChange={(e) => setCourtFormData({ ...courtFormData, jurisdiction_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                      disabled={loading}
                    >
                      <option value="">Select Jurisdiction</option>
                      {jurisdictions.map((jurisdiction) => (
                        <option key={jurisdiction.id} value={jurisdiction.id}>
                          {jurisdiction.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Court Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={courtFormData.court_name}
                      onChange={(e) => setCourtFormData({ ...courtFormData, court_name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="e.g., Bombay High Court"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseForms}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium text-sm"
                    disabled={loading || !courtFormData.jurisdiction_id || !courtFormData.court_name.trim()}
                  >
                    {loading ? 'Saving...' : (isEditingCourt ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* View Court Details */}
          {viewItem && viewItem.type === 'court' && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Court Details</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleEditCourt(viewItem.data)}
                    className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Court
                  </button>
                  <button onClick={handleCloseForms} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Court ID</label>
                  <p className="text-gray-900 font-semibold"># {viewItem.data.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Court Name</label>
                  <p className="text-gray-900 font-semibold">{viewItem.data.court_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Jurisdiction</label>
                  <p className="text-gray-900 font-semibold">
                    <span className="px-3 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                      {viewItem.data.jurisdiction_name}
                    </span>
                  </p>
                </div>
              </div>

              {/* Benches Section */}
              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-gray-600" />
                    Benches ({benches.length})
                  </h3>
                  <button
                    onClick={() => handleShowBenchForm(viewItem.data)}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Bench
                  </button>
                </div>

                {benches.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg">
                    No benches added yet. Click "Add Bench" to create one.
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {paginatedBenches.map((bench) => (
                      <div key={bench.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="font-medium text-gray-900">{bench.bench_name}</h4>
                            {bench.is_principal && (
                              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                                Principal
                              </span>
                            )}
                          </div>
                          {bench.location && (
                            <p className="text-sm text-gray-600 mt-1 flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              {bench.location}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditBench(bench)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBench(bench.id, bench.bench_name)}
                            className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                      ))}
                    </div>
                    {benches.length > itemsPerPage && (
                      <div className="mt-4">
                        <Pagination
                          currentPage={benchPage}
                          totalPages={totalBenchPages}
                          onPageChange={setBenchPage}
                          totalItems={benches.length}
                          itemsPerPage={itemsPerPage}
                          startIndex={(benchPage - 1) * itemsPerPage}
                          endIndex={Math.min(benchPage * itemsPerPage, benches.length)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex flex-1 gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search courts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <select
                value={selectedJurisdiction}
                onChange={(e) => setSelectedJurisdiction(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white min-w-[200px]"
              >
                <option value="">All Jurisdictions</option>
                {jurisdictions.map((jurisdiction) => (
                  <option key={jurisdiction.id} value={jurisdiction.id}>
                    {jurisdiction.name}
                  </option>
                ))}
              </select>
            </div>
            {!showCourtForm && !viewItem && (
              <button
                onClick={handleShowCourtForm}
                className="flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium text-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Court
              </button>
            )}
          </div>

          {/* Courts Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            {(selectedJurisdiction || searchTerm) && (
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-semibold">{filteredCourts.length}</span> of <span className="font-semibold">{courts.length}</span> courts
                  {selectedJurisdiction && (
                    <span className="ml-2">
                      in <span className="font-semibold text-blue-700">
                        {jurisdictions.find(j => j.id.toString() === selectedJurisdiction)?.name || 'selected jurisdiction'}
                      </span>
                    </span>
                  )}
                </div>
                {(selectedJurisdiction || searchTerm) && (
                  <button
                    onClick={() => {
                      setSelectedJurisdiction('');
                      setSearchTerm('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
            {filteredCourts.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                {searchTerm || selectedJurisdiction ? 'No courts found matching your filters.' : 'No courts available. Add one to get started.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">S.NO</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Court Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Jurisdiction</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Benches</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedCourts.map((court, index) => (
                      <tr key={court.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{(courtPage - 1) * itemsPerPage + index + 1}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{court.court_name}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {court.jurisdiction_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {court.bench_count || 0} Benches
                            </span>
                            <button
                              onClick={() => handleShowBenchForm(court)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Add Bench"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleViewCourt(court)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              View
                            </button>
                            <button
                              onClick={() => handleDeleteCourt(court.id, court.court_name)}
                              className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
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
            <Pagination
              currentPage={courtPage}
              totalPages={totalCourtPages}
              onPageChange={setCourtPage}
              totalItems={filteredCourts.length}
              itemsPerPage={itemsPerPage}
              startIndex={(courtPage - 1) * itemsPerPage}
              endIndex={Math.min(courtPage * itemsPerPage, filteredCourts.length)}
            />
          </div>
        </>
      )}

      {/* BENCHES TAB */}
      {activeTab === 'benches' && (
        <>
          {/* Bench Form */}
          {showBenchForm && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isEditingBench ? 'Edit Bench' : 'Add New Bench'}
                  </h2>
                  {selectedCourtForBenches && (
                    <p className="text-sm text-gray-600 mt-1">
                      For: <span className="font-medium">{selectedCourtForBenches.court_name}</span>
                    </p>
                  )}
                </div>
                <button onClick={handleCloseForms} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleBenchSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Court <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={benchFormData.court_id}
                      onChange={(e) => setBenchFormData({ ...benchFormData, court_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                      disabled={loading || selectedCourtForBenches}
                    >
                      <option value="">Select Court</option>
                      {courts.map((court) => (
                        <option key={court.id} value={court.id}>
                          {court.court_name} ({court.jurisdiction_name})
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
                      value={benchFormData.bench_name}
                      onChange={(e) => setBenchFormData({ ...benchFormData, bench_name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="e.g., Mumbai, Nagpur"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location (Optional)
                    </label>
                    <input
                      type="text"
                      value={benchFormData.location}
                      onChange={(e) => setBenchFormData({ ...benchFormData, location: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="e.g., Maharashtra"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={benchFormData.is_principal}
                        onChange={(e) => setBenchFormData({ ...benchFormData, is_principal: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        disabled={loading}
                      />
                      <span className="text-sm font-medium text-gray-700">Principal Bench</span>
                    </label>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseForms}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium text-sm"
                    disabled={loading || !benchFormData.court_id || !benchFormData.bench_name.trim()}
                  >
                    {loading ? 'Saving...' : (isEditingBench ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Court Selection for Adding Benches */}
          {!showBenchForm && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Court to Add Benches</h3>
                  <p className="text-sm text-gray-600">Choose a court from the list below to add benches to it.</p>
                </div>
                <div className="mt-4 sm:mt-0">
                  <select
                    value={selectedJurisdictionForBenches}
                    onChange={(e) => setSelectedJurisdictionForBenches(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white min-w-[200px]"
                  >
                    <option value="">All Jurisdictions</option>
                    {jurisdictions.map((jurisdiction) => (
                      <option key={jurisdiction.id} value={jurisdiction.id}>
                        {jurisdiction.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(selectedJurisdictionForBenches) && (
                <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-semibold">{filteredBenchTabCourts.length}</span> of <span className="font-semibold">{courts.length}</span> courts
                    {selectedJurisdictionForBenches && (
                      <span className="ml-2">
                        in <span className="font-semibold text-blue-700">
                          {jurisdictions.find(j => j.id.toString() === selectedJurisdictionForBenches)?.name || 'selected jurisdiction'}
                        </span>
                      </span>
                    )}
                  </div>
                  {selectedJurisdictionForBenches && (
                    <button
                      onClick={() => setSelectedJurisdictionForBenches('')}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              )}
              
              <div className="space-y-3">
                {paginatedBenchTabCourts.map((court) => {
                  const courtBenches = benchesByCourt[court.id] || [];
                  return (
                    <div
                      key={court.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
                      onClick={() => handleShowBenchForm(court)}
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{court.court_name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mr-2">
                            {court.jurisdiction_name}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {court.bench_count || 0} Benches
                          </span>
                        </p>
                        {courtBenches.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {courtBenches.map((bench) => (
                              <span
                                key={bench.id}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
                              >
                                {bench.bench_name}
                                {bench.is_principal && (
                                  <span className="ml-1 text-amber-600">★</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                        {courtBenches.length === 0 && (
                          <p className="text-xs text-gray-400 mt-1 italic">No benches added yet</p>
                        )}
                      </div>
                      <Plus className="w-5 h-5 text-blue-600 flex-shrink-0 ml-4" />
                    </div>
                  );
                })}
                {filteredBenchTabCourts.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {selectedJurisdictionForBenches 
                      ? 'No courts found in the selected jurisdiction.' 
                      : 'No courts available. Please add courts first from the "Courts" tab.'}
                  </div>
                )}
              </div>
              {filteredBenchTabCourts.length > itemsPerPage && (
                <div className="mt-4">
                  <Pagination
                    currentPage={benchTabCourtPage}
                    totalPages={totalBenchTabCourtPages}
                    onPageChange={setBenchTabCourtPage}
                    totalItems={filteredBenchTabCourts.length}
                    itemsPerPage={itemsPerPage}
                    startIndex={(benchTabCourtPage - 1) * itemsPerPage}
                    endIndex={Math.min(benchTabCourtPage * itemsPerPage, filteredBenchTabCourts.length)}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AddCourt;