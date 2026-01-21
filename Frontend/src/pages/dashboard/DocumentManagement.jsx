import React, { useState, useEffect, useMemo } from 'react';
import { 
  Eye, 
  Trash2, 
  FileText, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Search,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  RefreshCw
} from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import AdminDocumentService from '../../services/adminDocumentService';

const MySwal = withReactContent(Swal);

const DocumentManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentTable, setShowDocumentTable] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [deleteLoading, setDeleteLoading] = useState({});
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const documentService = new AdminDocumentService('https://gateway-service-120280829617.asia-south1.run.app');

  // Fetch all documents
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await documentService.getAll();
      if (response.success && response.documents) {
        setDocuments(response.documents);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err.message || 'Failed to fetch documents');
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.message || 'Failed to fetch documents. Please try again later.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Filter documents based on search and status
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // Search filter
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.originalname?.toLowerCase().includes(searchLower) ||
        doc.id?.toLowerCase().includes(searchLower) ||
        doc.summary?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [documents, searchValue, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDocuments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDocuments, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // View document details
  const handleViewDocument = async (document) => {
    try {
      const response = await documentService.getOne(document.id);
      if (response.success && response.document) {
        setSelectedDocument(response.document);
        setShowDocumentTable(false);
      }
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.message || 'Failed to fetch document details.',
        confirmButtonColor: '#3085d6',
      });
    }
  };

  // Delete document
  const handleDeleteDocument = async (documentId, documentName) => {
    const result = await MySwal.fire({
      title: 'Are you sure?',
      text: `You are about to delete "${documentName}". This action cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      setDeleteLoading({ ...deleteLoading, [documentId]: true });
      try {
        const response = await documentService.delete(documentId);
        if (response.success) {
          MySwal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: `Document "${documentName}" has been deleted successfully.`,
            confirmButtonColor: '#3085d6',
          });
          // Remove from local state
          setDocuments(documents.filter(doc => doc.id !== documentId));
          if (selectedDocument?.id === documentId) {
            setSelectedDocument(null);
            setShowDocumentTable(true);
          }
        }
      } catch (err) {
        MySwal.fire({
          icon: 'error',
          title: 'Error!',
          text: err.message || 'Failed to delete document.',
          confirmButtonColor: '#3085d6',
        });
      } finally {
        setDeleteLoading({ ...deleteLoading, [documentId]: false });
      }
    }
  };

  // Upload document
  const handleUpload = async () => {
    if (!uploadFile) {
      MySwal.fire({
        icon: 'warning',
        title: 'No file selected',
        text: 'Please select a file to upload.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    setUploadLoading(true);
    try {
      const response = await documentService.upload(uploadFile);
      if (response.success) {
        MySwal.fire({
          icon: 'success',
          title: 'Uploaded!',
          text: `Document "${uploadFile.name}" has been uploaded successfully.`,
          confirmButtonColor: '#3085d6',
        });
        setUploadFile(null);
        // Reset file input
        const fileInput = document.getElementById('file-upload');
        if (fileInput) fileInput.value = '';
        // Refresh documents list
        await fetchDocuments();
      }
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Upload Failed!',
        text: err.message || 'Failed to upload document.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    const colors = {
      processed: 'bg-green-100 text-green-800',
      processing: 'bg-blue-100 text-blue-800',
      batch_processing: 'bg-yellow-100 text-yellow-800',
      uploaded: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
      case 'batch_processing':
        return <Clock className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = {
      all: documents.length,
      processed: documents.filter(d => d.status === 'processed').length,
      processing: documents.filter(d => d.status === 'processing').length,
      batch_processing: documents.filter(d => d.status === 'batch_processing').length,
      uploaded: documents.filter(d => d.status === 'uploaded').length,
      error: documents.filter(d => d.status === 'error').length,
    };
    return counts;
  }, [documents]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                <FileText className="mr-3 text-gray-800" size={32} />
                Document Management
              </h1>
              <p className="text-gray-600 mt-2">Manage and view all processed documents</p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        {showDocumentTable && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex-1 min-w-[300px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Document
                </label>
                <div className="flex gap-2">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleUpload}
                    disabled={uploadLoading || !uploadFile}
                    className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </>
                    )}
                  </button>
                </div>
                {uploadFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        {showDocumentTable && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {/* Status Filter Buttons */}
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({statusCounts.all})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('processed');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    statusFilter === 'processed'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Processed ({statusCounts.processed})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('processing');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    statusFilter === 'processing'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Processing ({statusCounts.processing})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('error');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    statusFilter === 'error'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Error ({statusCounts.error})
                </button>
              </div>

              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchValue}
                    onChange={(e) => {
                      setSearchValue(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                onClick={fetchDocuments}
                className="inline-flex items-center px-4 py-2.5 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all"
                title="Refresh documents"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Documents Table */}
        {showDocumentTable && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        Document Name
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Chunks
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Uploaded At
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
                          <p className="text-gray-600 font-medium">Loading documents...</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedDocuments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium text-lg">No documents found</p>
                        <p className="text-gray-400 text-sm mt-2">
                          {searchValue || statusFilter !== 'all'
                            ? 'Try adjusting your search or filter criteria'
                            : 'Upload your first document to get started'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{doc.originalname}</div>
                              <div className="text-xs text-gray-500">{doc.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusColor(doc.status)}`}>
                            {getStatusIcon(doc.status)}
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {doc.processing_progress !== undefined ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${doc.processing_progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">{doc.processing_progress}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">N/A</span>
                          )}
                          {doc.current_operation && (
                            <div className="text-xs text-gray-500 mt-1">{doc.current_operation}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatFileSize(doc.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {doc.chunks_count || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {doc.status === 'processed' && (
                              <button
                                onClick={() => handleViewDocument(doc)}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDocument(doc.id, doc.originalname)}
                              disabled={deleteLoading[doc.id]}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                            >
                              {deleteLoading[doc.id] ? (
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
            {!loading && filteredDocuments.length > 0 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-semibold">
                    {Math.min(currentPage * itemsPerPage, filteredDocuments.length)}
                  </span>{' '}
                  of <span className="font-semibold">{filteredDocuments.length}</span> documents
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

        {/* Document Detail View */}
        {selectedDocument && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Document Details</h2>
              <button
                onClick={() => {
                  setSelectedDocument(null);
                  setShowDocumentTable(true);
                }}
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold transition-colors"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back to List
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Document Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
                  <p className="text-sm font-semibold text-gray-900">{selectedDocument.originalname}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document ID</label>
                  <p className="text-sm text-gray-900 font-mono">{selectedDocument.id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusColor(selectedDocument.status)}`}>
                    {getStatusIcon(selectedDocument.status)}
                    {selectedDocument.status}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File Size</label>
                  <p className="text-sm text-gray-900">{formatFileSize(selectedDocument.size)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MIME Type</label>
                  <p className="text-sm text-gray-900">{selectedDocument.mimetype || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chunks Count</label>
                  <p className="text-sm text-gray-900">{selectedDocument.chunks_count || 0}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Processing Progress</label>
                  {selectedDocument.processing_progress !== undefined ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${selectedDocument.processing_progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{selectedDocument.processing_progress}%</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">N/A</p>
                  )}
                  {selectedDocument.current_operation && (
                    <p className="text-xs text-gray-500 mt-1">{selectedDocument.current_operation}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ready for Chat</label>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    selectedDocument.ready_for_chat ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedDocument.ready_for_chat ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Timestamps</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedDocument.created_at)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Updated At</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedDocument.updated_at)}</p>
                </div>

                {selectedDocument.processed_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Processed At</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedDocument.processed_at)}</p>
                  </div>
                )}

                {selectedDocument.summary && (
                  <>
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-6">Summary</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Document Summary</label>
                      <div className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                        {selectedDocument.summary}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex gap-3">
                <button
                  onClick={() => handleDeleteDocument(selectedDocument.id, selectedDocument.originalname)}
                  disabled={deleteLoading[selectedDocument.id]}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteLoading[selectedDocument.id] ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Document
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentManagement;
