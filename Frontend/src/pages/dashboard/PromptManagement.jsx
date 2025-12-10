


// import React, { useState, useMemo, useEffect } from 'react';
// import { Eye, Edit, Save, FileText, Key, Code, Hash, Filter, ChevronLeft, ChevronRight, Trash2, Copy, Calendar, User, PlusCircle, X, Lock, Unlock } from 'lucide-react';
// import axios from 'axios';
// import Swal from 'sweetalert2';
// import withReactContent from 'sweetalert2-react-content';

// // Helper function to decode JWT token
// const decodeToken = (token) => {
//   try {
//     if (!token) return null;
//     const base64Url = token.split('.')[1];
//     const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
//     const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
//       return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
//     }).join(''));
//     return JSON.parse(jsonPayload);
//   } catch (error) {
//     console.error('Error decoding token:', error);
//     return null;
//   }
// };

// const MySwal = withReactContent(Swal);

// const PromptManagement = () => {
//   const [prompts, setPrompts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [userInfo, setUserInfo] = useState(null);

//   const [selectedPrompt, setSelectedPrompt] = useState(null);
//   const [editMode, setEditMode] = useState(false);
//   const [editedPrompt, setEditedPrompt] = useState(null);
//   const [showPromptTable, setShowPromptTable] = useState(true);
//   const [showCreateForm, setShowCreateForm] = useState(false);
//   const [newPrompt, setNewPrompt] = useState({
//     name: '',
//     description: '',
//     secret_manager_id: '',
//     secret_value: '',
//     template_type: 'system',
//     status: 'active',
//     llm_id: null,
//     chunking_method_id: null,
//   });

//   const [llmModels, setLlmModels] = useState([]);
//   const [showCreateLlmModal, setShowCreateLlmModal] = useState(false);
//   const [newLlmName, setNewLlmName] = useState('');
//   const [llmLoading, setLlmLoading] = useState(false);

//   const [chunkingMethods, setChunkingMethods] = useState([]);
//   const [showCreateChunkingModal, setShowCreateChunkingModal] = useState(false);
//   const [newChunkingName, setNewChunkingName] = useState('');
//   const [chunkingLoading, setChunkingLoading] = useState(false);
  
//   // Search and pagination states
//   const [searchValue, setSearchValue] = useState('');
//   const [currentPage, setCurrentPage] = useState(1);
//   const itemsPerPage = 5;

//   // Loading states
//   const [createLoading, setCreateLoading] = useState(false);
//   const [updateLoading, setUpdateLoading] = useState(false);
//   const [deleteLoading, setDeleteLoading] = useState({});
//   const [fetchValueLoading, setFetchValueLoading] = useState({});

//   // API Base URL
//   const API_BASE_URL = 'http://localhost:4000/api/secrets';
//   const LLM_API_BASE_URL = 'http://localhost:4000/api/llm';
//   const CHUNKING_API_BASE_URL = 'http://localhost:4000/api/chunking-methods';

//   // Get user info from token
//   useEffect(() => {
//     const token = localStorage.getItem('token');
//     if (token) {
//       const decoded = decodeToken(token);
//       if (decoded) {
//         setUserInfo({
//           userId: decoded.id || decoded.userId || decoded.user_id,
//           role: decoded.role || decoded.userRole || decoded.user_role,
//           email: decoded.email,
//           name: decoded.name || decoded.username
//         });
//         console.log('User Info:', decoded);
//       } else {
//         MySwal.fire({
//           icon: 'error',
//           title: 'Authentication Error',
//           text: 'Invalid token. Please login again.',
//           confirmButtonColor: '#3085d6',
//         }).then(() => {
//           localStorage.removeItem('token');
//         });
//       }
//     } else {
//       MySwal.fire({
//         icon: 'warning',
//         title: 'Authentication Required',
//         text: 'Please login to access this page.',
//         confirmButtonColor: '#3085d6',
//       });
//     }
//   }, []);

//   const fetchPrompts = async (includeValues = false) => {
//     const token = localStorage.getItem('token');
//     if (!token) {
//       setError('No authentication token found');
//       setLoading(false);
//       return;
//     }

//     setLoading(true);
//     setError(null);
//     try {
//       console.log('Fetching prompts with token:', token.substring(0, 20) + '...');
//       const url = includeValues ? `${API_BASE_URL}?fetch=true` : API_BASE_URL;
//       const response = await axios.get(url, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
      
//       // Transform the data to match component expectations
//       const transformedData = response.data.map(prompt => {
//         // Parse chunking_method_id properly
//         let chunkingMethodId = null;
//         if (prompt.chunking_method_id !== null && prompt.chunking_method_id !== undefined) {
//           chunkingMethodId = typeof prompt.chunking_method_id === 'string' 
//             ? parseInt(prompt.chunking_method_id, 10) 
//             : prompt.chunking_method_id;
//         }
        
//         console.log(`Prompt "${prompt.name}" chunking_method_id:`, chunkingMethodId, 'Type:', typeof chunkingMethodId);
        
//         return {
//           id: prompt.id,
//           name: prompt.name,
//           description: prompt.description || 'No description available',
//           secret_manager_id: prompt.secret_manager_id,
//           template_type: prompt.template_type,
//           status: prompt.status === 'active' ? 'Active' : 'Draft',
//           usageCount: prompt.usage_count || 0,
//           successRate: prompt.success_rate || 0,
//           avgProcessingTime: prompt.avg_processing_time || 0,
//           createdBy: userInfo?.name || prompt.created_by || 'Admin',
//           createdAt: new Date(prompt.created_at).toLocaleDateString(),
//           lastModified: new Date(prompt.updated_at).toLocaleDateString(),
//           lastUsed: prompt.last_used_at ? new Date(prompt.last_used_at).toLocaleDateString() : 'Never',
//           version: prompt.version,
//           value: prompt.value || null,
//           llm_id: prompt.llm_id || null,
//           chunking_method_id: chunkingMethodId,
//         };
//       });
      
//       setPrompts(transformedData);
//     } catch (err) {
//       console.error('Error fetching prompts:', err);
//       setError('Failed to fetch prompts.');
      
//       if (err.response?.status === 401) {
//         MySwal.fire({
//           icon: 'error',
//           title: 'Authentication Error',
//           text: 'Your session has expired. Please login again.',
//           confirmButtonColor: '#3085d6',
//         }).then(() => {
//           localStorage.removeItem('token');
//         });
//       } else {
//         MySwal.fire({
//           icon: 'error',
//           title: 'Error!',
//           text: err.response?.data?.error || 'Failed to fetch prompts. Please try again later.',
//           confirmButtonColor: '#3085d6',
//         });
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (userInfo) {
//       console.log('🚀 User info loaded, fetching data...');
//       fetchPrompts();
//       fetchLlmModels();
//       fetchChunkingMethods();
//     }
//   }, [userInfo]);

//   // Debug effect to monitor state changes
//   useEffect(() => {
//     console.log('📊 STATE UPDATE - Chunking Methods:', chunkingMethods);
//     console.log('📊 STATE UPDATE - Chunking Methods Count:', chunkingMethods.length);
//     if (chunkingMethods.length > 0) {
//       console.log('📊 First Chunking Method:', chunkingMethods[0]);
//     }
//   }, [chunkingMethods]);

//   useEffect(() => {
//     console.log('📊 STATE UPDATE - Prompts:', prompts);
//     console.log('📊 STATE UPDATE - Prompts Count:', prompts.length);
//     if (prompts.length > 0) {
//       console.log('📊 First Prompt:', prompts[0]);
//       console.log('📊 First Prompt Chunking Method ID:', prompts[0].chunking_method_id);
//     }
//   }, [prompts]);

//   // Fetch LLM Models
//   const fetchLlmModels = async () => {
//     setLlmLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.get(LLM_API_BASE_URL, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       console.log('LLM Models Response:', response.data);
//       setLlmModels(response.data || []);
//     } catch (err) {
//       console.error('Error fetching LLM models:', err);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to fetch LLM models.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setLlmLoading(false);
//     }
//   };

//   // Fetch Chunking Methods
//   const fetchChunkingMethods = async () => {
//     setChunkingLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.get(CHUNKING_API_BASE_URL, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       console.log('Chunking Methods API Response:', response.data);
      
//       // Handle different response structures
//       let methods = [];
//       if (Array.isArray(response.data)) {
//         methods = response.data;
//       } else if (response.data.data && Array.isArray(response.data.data)) {
//         methods = response.data.data;
//       } else if (response.data.chunking_methods && Array.isArray(response.data.chunking_methods)) {
//         methods = response.data.chunking_methods;
//       }
      
//       // Transform to ensure consistent structure with name field
//       // API returns method_name, we need name for consistency
//       const transformedMethods = methods.map(method => ({
//         id: method.id || method.chunking_method_id || method.method_id,
//         name: method.method_name || method.name || method.chunking_name || 'Unknown Method',
//         method_name: method.method_name, // Keep original
//         description: method.description || '',
//         created_at: method.created_at,
//         updated_at: method.updated_at
//       }));
      
//       console.log('Transformed Chunking Methods:', transformedMethods);
//       setChunkingMethods(transformedMethods);
//     } catch (err) {
//       console.error('Error fetching chunking methods:', err);
//       console.error('Error details:', err.response?.data);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to fetch chunking methods.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setChunkingLoading(false);
//     }
//   };

//   // Create new LLM Model
//   const handleCreateLlm = async () => {
//     if (!newLlmName.trim()) {
//       MySwal.fire({
//         icon: 'warning',
//         title: 'Validation Error',
//         text: 'Please enter an LLM model name.',
//         confirmButtonColor: '#3085d6',
//       });
//       return;
//     }

//     setLlmLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.post(
//         LLM_API_BASE_URL,
//         { name: newLlmName.trim() },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             'Content-Type': 'application/json',
//           },
//         }
//       );
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'LLM model created successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//       });
      
//       setNewLlmName('');
//       setShowCreateLlmModal(false);
//       fetchLlmModels();
//     } catch (err) {
//       console.error('Error creating LLM model:', err);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to create LLM model.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setLlmLoading(false);
//     }
//   };

//   // Create new Chunking Method
//   const handleCreateChunkingMethod = async () => {
//     if (!newChunkingName.trim()) {
//       MySwal.fire({
//         icon: 'warning',
//         title: 'Validation Error',
//         text: 'Please enter a chunking method name.',
//         confirmButtonColor: '#3085d6',
//       });
//       return;
//     }

//     setChunkingLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.post(
//         CHUNKING_API_BASE_URL,
//         { name: newChunkingName.trim() },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             'Content-Type': 'application/json',
//           },
//         }
//       );
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'Chunking method created successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//       });
      
//       setNewChunkingName('');
//       setShowCreateChunkingModal(false);
//       fetchChunkingMethods();
//     } catch (err) {
//       console.error('Error creating chunking method:', err);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to create chunking method.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setChunkingLoading(false);
//     }
//   };

//   const fetchSecretValue = async (id) => {
//     setFetchValueLoading(prev => ({ ...prev, [id]: true }));
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.get(`${API_BASE_URL}/${id}?fetch=true`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
      
//       const updatedPrompts = prompts.map(prompt => 
//         prompt.id === id ? { ...prompt, value: response.data.value } : prompt
//       );
//       setPrompts(updatedPrompts);
      
//       if (selectedPrompt?.id === id) {
//         setSelectedPrompt({ ...selectedPrompt, value: response.data.value });
//         if (editMode) {
//           setEditedPrompt({ ...editedPrompt, value: response.data.value });
//         }
//       }
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'Secret content loaded successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//         showConfirmButton: false,
//       });
//     } catch (err) {
//       console.error('Error fetching secret value:', err);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to fetch secret value.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setFetchValueLoading(prev => ({ ...prev, [id]: false }));
//     }
//   };

//   const handleViewPrompt = async (prompt) => {
//     setSelectedPrompt(prompt);
//     setEditMode(false);
//     setShowPromptTable(false);
//   };

//   const handleEditPrompt = () => {
//     setEditMode(true);
//     setEditedPrompt({ ...selectedPrompt });
//   };

//   const handleCancelEdit = () => {
//     setEditMode(false);
//     setEditedPrompt(null);
//   };

//   const handleSaveEdit = async () => {
//     setUpdateLoading(true);
//     try {
//       const token = localStorage.getItem('token');
      
//       // Prepare update data
//       const updateData = {
//         name: editedPrompt.name,
//         description: editedPrompt.description,
//         template_type: editedPrompt.template_type,
//         status: editedPrompt.status === 'Active' ? 'active' : 'draft',
//       };
      
//       // Add llm_id (handle null/undefined/empty string)
//       if (editedPrompt.llm_id !== null && editedPrompt.llm_id !== undefined && editedPrompt.llm_id !== '') {
//         updateData.llm_id = parseInt(editedPrompt.llm_id);
//       } else {
//         updateData.llm_id = null;
//       }
      
//       // Add chunking_method_id (handle null/undefined/empty string)
//       if (editedPrompt.chunking_method_id !== null && editedPrompt.chunking_method_id !== undefined && editedPrompt.chunking_method_id !== '') {
//         updateData.chunking_method_id = parseInt(editedPrompt.chunking_method_id);
//       } else {
//         updateData.chunking_method_id = null;
//       }
      
//       // Add secret_value only if it exists and has been loaded
//       if (editedPrompt.value) {
//         updateData.secret_value = editedPrompt.value;
//       }
      
//       console.log('📤 Updating prompt with data:', updateData);
//       console.log('📤 Updating prompt ID:', selectedPrompt.id);
      
//       const response = await axios.put(`${API_BASE_URL}/${selectedPrompt.id}`, updateData, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
      
//       console.log('✅ Prompt updated successfully:', response.data);
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'Prompt updated successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//       });
      
//       setEditMode(false);
//       setEditedPrompt(null);
//       fetchPrompts();
//       setSelectedPrompt(null);
//       setShowPromptTable(true);
//     } catch (err) {
//       console.error('❌ Error updating prompt:', err);
//       console.error('❌ Error response:', err.response?.data);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || err.response?.data?.message || 'Failed to update prompt.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setUpdateLoading(false);
//     }
//   };

//   const handleInputChange = (field, value) => {
//     setEditedPrompt(prev => ({ ...prev, [field]: value }));
//   };

//   const handleDeletePrompt = async (id) => {
//     const result = await MySwal.fire({
//       title: 'Are you sure?',
//       text: "You won't be able to revert this!",
//       icon: 'warning',
//       showCancelButton: true,
//       confirmButtonColor: '#d33',
//       cancelButtonColor: '#3085d6',
//       confirmButtonText: 'Yes, delete it!',
//     });

//     if (result.isConfirmed) {
//       setDeleteLoading(prev => ({ ...prev, [id]: true }));
//       try {
//         const token = localStorage.getItem('token');
//         await axios.delete(`${API_BASE_URL}/${id}`, {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             'Content-Type': 'application/json',
//           },
//         });
        
//         MySwal.fire({
//           icon: 'success',
//           title: 'Deleted!',
//           text: 'Prompt has been deleted.',
//           confirmButtonColor: '#3085d6',
//           timer: 2000,
//         });
        
//         fetchPrompts();
//         if (selectedPrompt?.id === id) {
//           setSelectedPrompt(null);
//           setShowPromptTable(true);
//         }
//       } catch (err) {
//         console.error('Error deleting prompt:', err);
//         MySwal.fire({
//           icon: 'error',
//           title: 'Error!',
//           text: err.response?.data?.error || 'Failed to delete prompt.',
//           confirmButtonColor: '#3085d6',
//         });
//       } finally {
//         setDeleteLoading(prev => ({ ...prev, [id]: false }));
//       }
//     }
//   };

//   const handleCreatePrompt = async () => {
//     if (!newPrompt.name.trim() || !newPrompt.secret_value.trim()) {
//       MySwal.fire({
//         icon: 'warning',
//         title: 'Validation Error',
//         text: 'Name and Secret Value are required.',
//         confirmButtonColor: '#3085d6',
//       });
//       return;
//     }

//     setCreateLoading(true);
//     try {
//       const token = localStorage.getItem('token');
      
//       // Prepare create data with proper type conversion
//       const createData = {
//         name: newPrompt.name.trim(),
//         description: newPrompt.description.trim(),
//         secret_value: newPrompt.secret_value.trim(),
//         template_type: newPrompt.template_type,
//         status: newPrompt.status,
//       };
      
//       // Add llm_id only if it has a value
//       if (newPrompt.llm_id !== null && newPrompt.llm_id !== undefined && newPrompt.llm_id !== '') {
//         createData.llm_id = parseInt(newPrompt.llm_id);
//       }
      
//       // Add chunking_method_id only if it has a value
//       if (newPrompt.chunking_method_id !== null && newPrompt.chunking_method_id !== undefined && newPrompt.chunking_method_id !== '') {
//         createData.chunking_method_id = parseInt(newPrompt.chunking_method_id);
//       }
      
//       console.log('📤 Creating prompt with data:', createData);
      
//       const response = await axios.post(API_BASE_URL, createData, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
      
//       console.log('✅ Prompt created successfully:', response.data);
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'Prompt created successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//       });
      
//       setNewPrompt({
//         name: '',
//         description: '',
//         secret_manager_id: '',
//         secret_value: '',
//         template_type: 'system',
//         status: 'active',
//         llm_id: null,
//         chunking_method_id: null,
//       });
//       setShowCreateForm(false);
//       setShowPromptTable(true);
//       fetchPrompts();
//     } catch (err) {
//       console.error('❌ Error creating prompt:', err);
//       console.error('❌ Error response:', err.response?.data);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || err.response?.data?.message || 'Failed to create prompt.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setCreateLoading(false);
//     }
//   };

//   const handleCopyToClipboard = (text) => {
//     navigator.clipboard.writeText(text);
//     MySwal.fire({
//       icon: 'success',
//       title: 'Copied!',
//       text: 'Content copied to clipboard.',
//       confirmButtonColor: '#3085d6',
//       timer: 1500,
//       showConfirmButton: false,
//     });
//   };

//   // Search and filter logic
//   const filteredPrompts = useMemo(() => {
//     return prompts.filter(prompt =>
//       prompt.name.toLowerCase().includes(searchValue.toLowerCase()) ||
//       prompt.description.toLowerCase().includes(searchValue.toLowerCase()) ||
//       prompt.template_type.toLowerCase().includes(searchValue.toLowerCase())
//     );
//   }, [prompts, searchValue]);

//   // Pagination logic
//   const totalPages = Math.ceil(filteredPrompts.length / itemsPerPage);
//   const paginatedPrompts = useMemo(() => {
//     const startIndex = (currentPage - 1) * itemsPerPage;
//     return filteredPrompts.slice(startIndex, startIndex + itemsPerPage);
//   }, [filteredPrompts, currentPage]);

//   const handlePageChange = (newPage) => {
//     if (newPage >= 1 && newPage <= totalPages) {
//       setCurrentPage(newPage);
//     }
//   };

//   // Helper function to get chunking method name
//   const getChunkingMethodName = (chunkingMethodId) => {
//     console.log('🔍 getChunkingMethodName called with:', chunkingMethodId);
    
//     if (!chunkingMethodId && chunkingMethodId !== 0) {
//       console.log('❌ No chunking method ID provided');
//       return 'N/A';
//     }
    
//     console.log('🔍 Searching in methods:', chunkingMethods);
//     console.log('🔍 Total methods available:', chunkingMethods.length);
    
//     // Try multiple matching strategies
//     const searchId = typeof chunkingMethodId === 'string' ? parseInt(chunkingMethodId, 10) : chunkingMethodId;
//     console.log('🔍 Parsed search ID:', searchId, 'Type:', typeof searchId);
    
//     // Strategy 1: Exact match
//     let method = chunkingMethods.find(m => m.id === searchId);
//     console.log('🔍 Strategy 1 (exact match) result:', method);
    
//     // Strategy 2: String comparison
//     if (!method) {
//       method = chunkingMethods.find(m => String(m.id) === String(searchId));
//       console.log('🔍 Strategy 2 (string match) result:', method);
//     }
    
//     // Strategy 3: Number comparison with type conversion
//     if (!method) {
//       method = chunkingMethods.find(m => {
//         const methodId = typeof m.id === 'string' ? parseInt(m.id, 10) : m.id;
//         return methodId === searchId;
//       });
//       console.log('🔍 Strategy 3 (type conversion) result:', method);
//     }
    
//     const result = method?.name || 'N/A';
//     console.log('✅ Final result:', result);
//     return result;
//   };

//   // Color helper functions
//   const getStatusColor = (status) => {
//     return status === 'Active' ? 'text-green-600' : 'text-yellow-600';
//   };

//   const getTemplateTypeColor = (type) => {
//     const colors = {
//       system: 'bg-blue-100 text-blue-800',
//       user: 'bg-green-100 text-green-800',
//       assistant: 'bg-purple-100 text-purple-800',
//       function: 'bg-orange-100 text-orange-800',
//     };
//     return colors[type] || 'bg-gray-100 text-gray-800';
//   };

//   if (loading && !userInfo) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-gray-600 font-medium">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
//       <div className="max-w-7xl mx-auto">
//         {/* Header */}
//         <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <h1 className="text-3xl font-bold text-gray-800 flex items-center">
//                 <Code className="mr-3 text-gray-800" size={32} />
//                 Prompt Management System
//               </h1>
//               <p className="text-gray-600 mt-2">Manage and organize your AI prompts efficiently</p>
//             </div>
//             {userInfo && (
//               <div className="text-right">
//                 <p className="text-sm text-gray-600">Logged in as</p>
//                 <p className="font-semibold text-gray-800">{userInfo.name}</p>
//                 <p className="text-xs text-gray-500">{userInfo.role}</p>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Action Buttons */}
//         {showPromptTable && !showCreateForm && (
//           <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
//             <div className="flex flex-wrap gap-4 items-center justify-between">
//               <div className="flex gap-3">
//                 <button
//                   onClick={() => {
//                     setShowCreateForm(true);
//                     setShowPromptTable(false);
//                   }}
//                   className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg"
//                 >
//                   <PlusCircle className="w-5 h-5 mr-2" />
//                   Create New Prompt
//                 </button>
//                 <button
//                   onClick={() => setShowCreateLlmModal(true)}
//                   className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg"
//                 >
//                   <PlusCircle className="w-5 h-5 mr-2" />
//                   Add LLM Model
//                 </button>
//                 <button
//                   onClick={() => setShowCreateChunkingModal(true)}
//                   className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg"
//                 >
//                   <PlusCircle className="w-5 h-5 mr-2" />
//                   Add Chunking Method
//                 </button>
//               </div>
              
//               <div className="flex-1 max-w-md">
//                 <div className="relative">
//                   <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
//                   <input
//                     type="text"
//                     placeholder="Search prompts..."
//                     value={searchValue}
//                     onChange={(e) => {
//                       setSearchValue(e.target.value);
//                       setCurrentPage(1);
//                     }}
//                     className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
//                   />
//                 </div>
//               </div>
              
//               <button
//                 onClick={() => {
//                   console.log('=== DEBUG INFO ===');
//                   console.log('Chunking Methods:', chunkingMethods);
//                   console.log('LLM Models:', llmModels);
//                   console.log('Prompts:', prompts);
//                   console.log('Sample Prompt IDs:', prompts.map(p => ({ 
//                     name: p.name, 
//                     chunking_id: p.chunking_method_id,
//                     chunking_type: typeof p.chunking_method_id,
//                     llm_id: p.llm_id 
//                   })));
//                   MySwal.fire({
//                     icon: 'info',
//                     title: 'Debug Info',
//                     html: `
//                       <div style="text-align: left; font-size: 12px;">
//                         <p><strong>Chunking Methods:</strong> ${chunkingMethods.length} loaded</p>
//                         <p><strong>LLM Models:</strong> ${llmModels.length} loaded</p>
//                         <p><strong>Prompts:</strong> ${prompts.length} loaded</p>
//                         <p style="margin-top: 10px;">Check browser console for detailed data</p>
//                       </div>
//                     `,
//                     confirmButtonColor: '#3085d6',
//                   });
//                 }}
//                 className="inline-flex items-center px-4 py-2.5 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all"
//                 title="Show debug info in console"
//               >
//                 🔍 Debug
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Create LLM Modal */}
//         {showCreateLlmModal && (
//           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//             <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-xl font-bold text-gray-800">Create New LLM Model</h3>
//                 <button
//                   onClick={() => {
//                     setShowCreateLlmModal(false);
//                     setNewLlmName('');
//                   }}
//                   className="text-gray-400 hover:text-gray-600 transition-colors"
//                 >
//                   <X size={24} />
//                 </button>
//               </div>
              
//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     LLM Model Name
//                   </label>
//                   <input
//                     type="text"
//                     value={newLlmName}
//                     onChange={(e) => setNewLlmName(e.target.value)}
//                     placeholder="e.g., GPT-4, Claude-3, Gemini-Pro"
//                     className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
//                   />
//                 </div>
                
//                 <div className="flex gap-3 pt-4">
//                   <button
//                     onClick={handleCreateLlm}
//                     disabled={llmLoading}
//                     className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {llmLoading ? 'Creating...' : 'Create LLM Model'}
//                   </button>
//                   <button
//                     onClick={() => {
//                       setShowCreateLlmModal(false);
//                       setNewLlmName('');
//                     }}
//                     className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
//                   >
//                     Cancel
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Create Chunking Method Modal */}
//         {showCreateChunkingModal && (
//           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//             <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-xl font-bold text-gray-800">Create New Chunking Method</h3>
//                 <button
//                   onClick={() => {
//                     setShowCreateChunkingModal(false);
//                     setNewChunkingName('');
//                   }}
//                   className="text-gray-400 hover:text-gray-600 transition-colors"
//                 >
//                   <X size={24} />
//                 </button>
//               </div>
              
//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Chunking Method Name
//                   </label>
//                   <input
//                     type="text"
//                     value={newChunkingName}
//                     onChange={(e) => setNewChunkingName(e.target.value)}
//                     placeholder="e.g., Fixed-Size, Semantic, Recursive"
//                     className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
//                   />
//                 </div>
                
//                 <div className="flex gap-3 pt-4">
//                   <button
//                     onClick={handleCreateChunkingMethod}
//                     disabled={chunkingLoading}
//                     className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {chunkingLoading ? 'Creating...' : 'Create Chunking Method'}
//                   </button>
//                   <button
//                     onClick={() => {
//                       setShowCreateChunkingModal(false);
//                       setNewChunkingName('');
//                     }}
//                     className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
//                   >
//                     Cancel
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Create Form */}
//         {showCreateForm && (
//           <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
//             <div className="flex items-center justify-between mb-6">
//               <h2 className="text-2xl font-bold text-gray-800">Create New Prompt</h2>
//               <button
//                 onClick={() => {
//                   setShowCreateForm(false);
//                   setShowPromptTable(true);
//                   setNewPrompt({
//                     name: '',
//                     description: '',
//                     secret_manager_id: '',
//                     secret_value: '',
//                     template_type: 'system',
//                     status: 'active',
//                     llm_id: null,
//                     chunking_method_id: null,
//                   });
//                 }}
//                 className="text-gray-400 hover:text-gray-600 transition-colors"
//               >
//                 <X size={24} />
//               </button>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Name <span className="text-red-500">*</span>
//                 </label>
//                 <input
//                   type="text"
//                   value={newPrompt.name}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
//                   placeholder="Enter prompt name"
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Template Type
//                 </label>
//                 <select
//                   value={newPrompt.template_type}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, template_type: e.target.value })}
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   <option value="system">System</option>
//                   <option value="user">User</option>
//                   <option value="assistant">Assistant</option>
//                   <option value="function">Function</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Status
//                 </label>
//                 <select
//                   value={newPrompt.status}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, status: e.target.value })}
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   <option value="active">Active</option>
//                   <option value="draft">Draft</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   LLM Model
//                 </label>
//                 <select
//                   value={newPrompt.llm_id || ''}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, llm_id: e.target.value ? parseInt(e.target.value) : null })}
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   <option value="">Select LLM Model</option>
//                   {llmModels.map(llm => (
//                     <option key={llm.id} value={llm.id}>{llm.name}</option>
//                   ))}
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Chunking Method
//                 </label>
//                 <select
//                   value={newPrompt.chunking_method_id || ''}
//                   onChange={(e) => {
//                     const value = e.target.value ? parseInt(e.target.value) : null;
//                     console.log('📝 Chunking method selected:', value);
//                     console.log('📝 Selected method details:', chunkingMethods.find(m => m.id === value));
//                     setNewPrompt({ ...newPrompt, chunking_method_id: value });
//                   }}
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
//                 >
//                   <option value="">Select Chunking Method</option>
//                   {chunkingMethods.map(method => (
//                     <option key={method.id} value={method.id}>{method.name}</option>
//                   ))}
//                 </select>
//                 {newPrompt.chunking_method_id && (
//                   <p className="text-xs text-gray-500 mt-1">
//                     Selected ID: {newPrompt.chunking_method_id}
//                   </p>
//                 )}
//               </div>

//               <div className="md:col-span-2">
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Description
//                 </label>
//                 <textarea
//                   value={newPrompt.description}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
//                   rows={3}
//                   placeholder="Enter prompt description"
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div className="md:col-span-2">
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Prompt Content <span className="text-red-500">*</span>
//                 </label>
//                 <textarea
//                   value={newPrompt.secret_value}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, secret_value: e.target.value })}
//                   rows={8}
//                   placeholder="Enter your prompt content here..."
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
//                 />
//               </div>
//             </div>

//             <div className="flex gap-4 mt-6">
//               <button
//                 onClick={handleCreatePrompt}
//                 disabled={createLoading}
//                 className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
//               >
//                 {createLoading ? 'Creating...' : (
//                   <>
//                     <Save className="w-5 h-5 mr-2" />
//                     Create Prompt
//                   </>
//                 )}
//               </button>
//               <button
//                 onClick={() => {
//                   setShowCreateForm(false);
//                   setShowPromptTable(true);
//                   setNewPrompt({
//                     name: '',
//                     description: '',
//                     secret_manager_id: '',
//                     secret_value: '',
//                     template_type: 'system',
//                     status: 'active',
//                     llm_id: null,
//                     chunking_method_id: null,
//                   });
//                 }}
//                 className="px-6 py-3 border border-gray-300 text-base font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Prompts Table */}
//         {showPromptTable && !selectedPrompt && (
//           <div className="bg-white rounded-xl shadow-lg overflow-hidden">
//             <div className="overflow-x-auto">
//               <table className="min-w-full divide-y divide-gray-200">
//                 <thead className="bg-gray-50 border-b border-gray-200">
//                   <tr>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       <div className="flex items-center">
//                         <FileText className="w-4 h-4 mr-2" />
//                         Name
//                       </div>
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       <div className="flex items-center">
//                         <Hash className="w-4 h-4 mr-2" />
//                         Type
//                       </div>
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       Status
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       LLM Model
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       Chunking Method
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       Usage
//                     </th>
//                     <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       Actions
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="bg-white divide-y divide-gray-200">
//                   {loading ? (
//                     <tr>
//                       <td colSpan="7" className="px-6 py-12 text-center">
//                         <div className="flex flex-col items-center justify-center">
//                           <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
//                           <p className="text-gray-600 font-medium">Loading prompts...</p>
//                         </div>
//                       </td>
//                     </tr>
//                   ) : paginatedPrompts.length === 0 ? (
//                     <tr>
//                       <td colSpan="7" className="px-6 py-12 text-center">
//                         <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
//                         <p className="text-gray-500 font-medium text-lg">No prompts found</p>
//                         <p className="text-gray-400 text-sm mt-2">
//                           {searchValue ? 'Try adjusting your search criteria' : 'Create your first prompt to get started'}
//                         </p>
//                       </td>
//                     </tr>
//                   ) : (
//                     paginatedPrompts.map((prompt) => (
//                       <tr key={prompt.id} className="hover:bg-gray-50 transition-colors">
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <div className="flex items-center">
//                             <Key className="w-4 h-4 text-gray-400 mr-2" />
//                             <div>
//                               <div className="text-sm font-semibold text-gray-900">{prompt.name}</div>
//                               <div className="text-xs text-gray-500">{prompt.secret_manager_id}</div>
//                             </div>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getTemplateTypeColor(prompt.template_type)}`}>
//                             {prompt.template_type}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <span className={`text-sm font-medium ${getStatusColor(prompt.status)}`}>
//                             {prompt.status}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                           {prompt.llm_id ? llmModels.find(llm => llm.id === prompt.llm_id)?.name || 'N/A' : 'N/A'}
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                           <div>
//                             <div className="font-medium">
//                               {getChunkingMethodName(prompt.chunking_method_id)}
//                             </div>
//                             <div className="text-xs text-gray-500">
//                               ID: {prompt.chunking_method_id !== null && prompt.chunking_method_id !== undefined ? 
//                                 `${prompt.chunking_method_id} (${typeof prompt.chunking_method_id})` : 
//                                 'null'}
//                             </div>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
//                           {prompt.usageCount} uses
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
//                           <div className="flex items-center justify-end gap-2">
//                             <button
//                               onClick={() => handleViewPrompt(prompt)}
//                               className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
//                               title="View Details"
//                             >
//                               <Eye className="w-4 h-4" />
//                             </button>
//                             <button
//                               onClick={() => handleDeletePrompt(prompt.id)}
//                               disabled={deleteLoading[prompt.id]}
//                               className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                               title="Delete"
//                             >
//                               {deleteLoading[prompt.id] ? (
//                                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
//                               ) : (
//                                 <Trash2 className="w-4 h-4" />
//                               )}
//                             </button>
//                           </div>
//                         </td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>

//             {/* Pagination */}
//             {!loading && filteredPrompts.length > 0 && (
//               <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
//                 <div className="text-sm text-gray-700">
//                   Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
//                   <span className="font-semibold">
//                     {Math.min(currentPage * itemsPerPage, filteredPrompts.length)}
//                   </span>{' '}
//                   of <span className="font-semibold">{filteredPrompts.length}</span> prompts
//                 </div>
//                 <div className="flex gap-2">
//                   <button
//                     onClick={() => handlePageChange(currentPage - 1)}
//                     disabled={currentPage === 1}
//                     className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//                   >
//                     <ChevronLeft className="w-4 h-4 mr-1" />
//                     Previous
//                   </button>
//                   <span className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700">
//                     Page {currentPage} of {totalPages}
//                   </span>
//                   <button
//                     onClick={() => handlePageChange(currentPage + 1)}
//                     disabled={currentPage === totalPages}
//                     className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//                   >
//                     Next
//                     <ChevronRight className="w-4 h-4 ml-1" />
//                   </button>
//                 </div>
//               </div>
//             )}
//           </div>
//         )}

//         {/* Prompt Detail View */}
//         {selectedPrompt && (
//           <div className="bg-white rounded-xl shadow-lg p-6">
//             <div className="flex items-center justify-between mb-6">
//               <button
//                 onClick={() => {
//                   setSelectedPrompt(null);
//                   setShowPromptTable(true);
//                   setEditMode(false);
//                   setEditedPrompt(null);
//                 }}
//                 className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold transition-colors"
//               >
//                 <ChevronLeft className="w-5 h-5 mr-1" />
//                 Back to List
//               </button>
//               <div className="flex gap-3">
//                 {editMode ? (
//                   <>
//                     <button
//                       onClick={handleSaveEdit}
//                       disabled={updateLoading}
//                       className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                     >
//                       {updateLoading ? 'Saving...' : (
//                         <>
//                           <Save className="w-4 h-4 mr-2" />
//                           Save Changes
//                         </>
//                       )}
//                     </button>
//                     <button
//                       onClick={handleCancelEdit}
//                       className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
//                     >
//                       Cancel
//                     </button>
//                   </>
//                 ) : (
//                   <>
//                     <button
//                       onClick={handleEditPrompt}
//                       className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
//                     >
//                       <Edit className="w-4 h-4 mr-2" />
//                       Edit
//                     </button>
//                     {selectedPrompt.value && (
//                       <button
//                         onClick={() => handleCopyToClipboard(selectedPrompt.value)}
//                         className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
//                       >
//                         <Copy className="w-4 h-4 mr-2" />
//                         Copy Content
//                       </button>
//                     )}
//                   </>
//                 )}
//               </div>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
//               <div className="space-y-4">
//                 <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Prompt Details</h4>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
//                   {editMode ? (
//                     <input
//                       type="text"
//                       value={editedPrompt.name}
//                       onChange={(e) => handleInputChange('name', e.target.value)}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     />
//                   ) : (
//                     <p className="text-sm font-semibold text-gray-900">{selectedPrompt.name}</p>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Secret Manager ID</label>
//                   <p className="text-sm text-gray-900 font-mono">{selectedPrompt.secret_manager_id}</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Template Type</label>
//                   {editMode ? (
//                     <select
//                       value={editedPrompt.template_type}
//                       onChange={(e) => handleInputChange('template_type', e.target.value)}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     >
//                       <option value="system">System</option>
//                       <option value="user">User</option>
//                       <option value="assistant">Assistant</option>
//                       <option value="function">Function</option>
//                     </select>
//                   ) : (
//                     <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getTemplateTypeColor(selectedPrompt.template_type)}`}>
//                       {selectedPrompt.template_type}
//                     </span>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
//                   {editMode ? (
//                     <select
//                       value={editedPrompt.status}
//                       onChange={(e) => handleInputChange('status', e.target.value)}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     >
//                       <option value="Active">Active</option>
//                       <option value="Draft">Draft</option>
//                     </select>
//                   ) : (
//                     <span className={`text-sm font-medium ${getStatusColor(selectedPrompt.status)}`}>
//                       {selectedPrompt.status}
//                     </span>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
//                   <p className="text-sm text-gray-900">{selectedPrompt.version || 'Not available'}</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">LLM Model</label>
//                   {editMode ? (
//                     <select
//                       value={editedPrompt.llm_id || ''}
//                       onChange={(e) => handleInputChange('llm_id', e.target.value ? parseInt(e.target.value) : null)}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     >
//                       <option value="">Select LLM Model</option>
//                       {llmModels.map(llm => (
//                         <option key={llm.id} value={llm.id}>{llm.name}</option>
//                       ))}
//                     </select>
//                   ) : (
//                     <p className="text-sm text-gray-900">
//                       {selectedPrompt.llm_id ? llmModels.find(llm => llm.id === selectedPrompt.llm_id)?.name || 'N/A' : 'N/A'}
//                     </p>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Chunking Method</label>
//                   {editMode ? (
//                     <div>
//                       <select
//                         value={editedPrompt.chunking_method_id || ''}
//                         onChange={(e) => {
//                           const value = e.target.value ? parseInt(e.target.value) : null;
//                           console.log('✏️ Editing - Chunking method changed to:', value);
//                           console.log('✏️ Selected method details:', chunkingMethods.find(m => m.id === value));
//                           handleInputChange('chunking_method_id', value);
//                         }}
//                         className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-medium"
//                       >
//                         <option value="">Select Chunking Method</option>
//                         {chunkingMethods.map(method => (
//                           <option key={method.id} value={method.id}>{method.name}</option>
//                         ))}
//                       </select>
//                       {editedPrompt.chunking_method_id && (
//                         <p className="text-xs text-gray-500 mt-1">
//                           Selected ID: {editedPrompt.chunking_method_id}
//                         </p>
//                       )}
//                     </div>
//                   ) : (
//                     <p className="text-sm text-gray-900">
//                       {getChunkingMethodName(selectedPrompt.chunking_method_id)}
//                     </p>
//                   )}
//                 </div>
//               </div>

//               <div className="space-y-4">
//                 <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Usage & Metadata</h4>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
//                   {editMode ? (
//                     <textarea
//                       value={editedPrompt.description}
//                       onChange={(e) => handleInputChange('description', e.target.value)}
//                       rows={3}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     />
//                   ) : (
//                     <p className="text-sm text-gray-900">{selectedPrompt.description}</p>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Usage Count</label>
//                   <p className="text-sm text-gray-900">{selectedPrompt.usageCount} times used</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Success Rate</label>
//                   <p className="text-sm text-gray-900">{selectedPrompt.successRate}%</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Avg Processing Time</label>
//                   <p className="text-sm text-gray-900">{selectedPrompt.avgProcessingTime}ms</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
//                   <div className="flex items-center">
//                     <User className="w-4 h-4 mr-2 text-gray-600" />
//                     <span className="text-sm text-gray-900">{selectedPrompt.createdBy}</span>
//                   </div>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
//                   <div className="flex items-center">
//                     <Calendar className="w-4 h-4 mr-2 text-gray-600" />
//                     <span className="text-sm text-gray-900">{selectedPrompt.createdAt}</span>
//                   </div>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Last Used</label>
//                   <div className="flex items-center">
//                     <Calendar className="w-4 h-4 mr-2 text-gray-600" />
//                     <span className="text-sm text-gray-900">{selectedPrompt.lastUsed}</span>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="mt-6 pt-6 border-t border-gray-200">
//               <div className="flex items-center justify-between mb-4">
//                 <h4 className="text-lg font-medium text-gray-900">Prompt Content</h4>
//                 {selectedPrompt.value ? (
//                   <div className="flex items-center text-green-600">
//                     <Unlock className="w-4 h-4 mr-1" />
//                     <span className="text-sm font-medium">Secret Loaded</span>
//                   </div>
//                 ) : (
//                   <div className="flex items-center text-gray-500">
//                     <Lock className="w-4 h-4 mr-1" />
//                     <span className="text-sm font-medium">Secret Protected</span>
//                   </div>
//                 )}
//               </div>
              
//               {selectedPrompt.value ? (
//                 editMode ? (
//                   <textarea
//                     value={editedPrompt.value || ''}
//                     onChange={(e) => handleInputChange('value', e.target.value)}
//                     rows={10}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
//                     placeholder="Enter prompt content..."
//                   />
//                 ) : (
//                   <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap border">
//                     {selectedPrompt.value}
//                   </div>
//                 )
//               ) : (
//                 <div className="bg-gray-100 rounded-lg p-8 text-center">
//                   <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
//                   <p className="text-gray-600 mb-4">Prompt content is secured and not loaded yet.</p>
//                   <button
//                     onClick={() => fetchSecretValue(selectedPrompt.id)}
//                     disabled={fetchValueLoading[selectedPrompt.id]}
//                     className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {fetchValueLoading[selectedPrompt.id] ? 'Loading...' : (
//                       <>
//                         <Unlock className="w-4 h-4 mr-2" />
//                         Load Secret Content
//                       </>
//                     )}
//                   </button>
//                 </div>
//               )}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default PromptManagement;









// import React, { useState, useMemo, useEffect } from 'react';
// import { Eye, Edit, Save, FileText, Key, Code, Hash, Filter, ChevronLeft, ChevronRight, Trash2, Copy, Calendar, User, PlusCircle, X, Lock, Unlock } from 'lucide-react';
// import axios from 'axios';
// import Swal from 'sweetalert2';
// import withReactContent from 'sweetalert2-react-content';

// // Helper function to decode JWT token
// const decodeToken = (token) => {
//   try {
//     if (!token) return null;
//     const base64Url = token.split('.')[1];
//     const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
//     const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
//       return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
//     }).join(''));
//     return JSON.parse(jsonPayload);
//   } catch (error) {
//     console.error('Error decoding token:', error);
//     return null;
//   }
// };

// const MySwal = withReactContent(Swal);

// const PromptManagement = () => {
//   const [prompts, setPrompts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [userInfo, setUserInfo] = useState(null);

//   const [selectedPrompt, setSelectedPrompt] = useState(null);
//   const [editMode, setEditMode] = useState(false);
//   const [editedPrompt, setEditedPrompt] = useState(null);
//   const [showPromptTable, setShowPromptTable] = useState(true);
//   const [showCreateForm, setShowCreateForm] = useState(false);
//   const [newPrompt, setNewPrompt] = useState({
//     name: '',
//     description: '',
//     secret_manager_id: '',
//     secret_value: '',
//     template_type: 'system',
//     status: 'active',
//     llm_id: null,
//     chunking_method_id: null,
//   });

//   const [llmModels, setLlmModels] = useState([]);
//   const [showCreateLlmModal, setShowCreateLlmModal] = useState(false);
//   const [newLlmName, setNewLlmName] = useState('');
//   const [llmLoading, setLlmLoading] = useState(false);

//   const [chunkingMethods, setChunkingMethods] = useState([]);
//   const [showCreateChunkingModal, setShowCreateChunkingModal] = useState(false);
//   const [newChunkingName, setNewChunkingName] = useState('');
//   const [chunkingLoading, setChunkingLoading] = useState(false);
  
//   // Search and pagination states
//   const [searchValue, setSearchValue] = useState('');
//   const [currentPage, setCurrentPage] = useState(1);
//   const itemsPerPage = 5;

//   // Loading states
//   const [createLoading, setCreateLoading] = useState(false);
//   const [updateLoading, setUpdateLoading] = useState(false);
//   const [deleteLoading, setDeleteLoading] = useState({});
//   const [fetchValueLoading, setFetchValueLoading] = useState({});

//   // API Base URL
//   const API_BASE_URL = 'http://localhost:4000/api/secrets';
//   const LLM_API_BASE_URL = 'http://localhost:4000/api/llm';
//   const CHUNKING_API_BASE_URL = 'http://localhost:4000/api/chunking-methods';

//   // Get user info from token
//   useEffect(() => {
//     const token = localStorage.getItem('token');
//     if (token) {
//       const decoded = decodeToken(token);
//       if (decoded) {
//         setUserInfo({
//           userId: decoded.id || decoded.userId || decoded.user_id,
//           role: decoded.role || decoded.userRole || decoded.user_role,
//           email: decoded.email,
//           name: decoded.name || decoded.username
//         });
//         console.log('User Info:', decoded);
//       } else {
//         MySwal.fire({
//           icon: 'error',
//           title: 'Authentication Error',
//           text: 'Invalid token. Please login again.',
//           confirmButtonColor: '#3085d6',
//         }).then(() => {
//           localStorage.removeItem('token');
//         });
//       }
//     } else {
//       MySwal.fire({
//         icon: 'warning',
//         title: 'Authentication Required',
//         text: 'Please login to access this page.',
//         confirmButtonColor: '#3085d6',
//       });
//     }
//   }, []);

//   const fetchPrompts = async (includeValues = false) => {
//     const token = localStorage.getItem('token');
//     if (!token) {
//       setError('No authentication token found');
//       setLoading(false);
//       return;
//     }

//     setLoading(true);
//     setError(null);
//     try {
//       console.log('Fetching prompts with token:', token.substring(0, 20) + '...');
//       const url = includeValues ? `${API_BASE_URL}?fetch=true` : API_BASE_URL;
//       const response = await axios.get(url, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
      
//       // Transform the data to match component expectations
//       const transformedData = response.data.map(prompt => {
//         // Parse chunking_method_id properly
//         let chunkingMethodId = null;
//         if (prompt.chunking_method_id !== null && prompt.chunking_method_id !== undefined) {
//           chunkingMethodId = typeof prompt.chunking_method_id === 'string' 
//             ? parseInt(prompt.chunking_method_id, 10) 
//             : prompt.chunking_method_id;
//         }
        
//         console.log(`Prompt "${prompt.name}" chunking_method_id:`, chunkingMethodId, 'Type:', typeof chunkingMethodId);
        
//         return {
//           id: prompt.id,
//           name: prompt.name,
//           description: prompt.description || 'No description available',
//           secret_manager_id: prompt.secret_manager_id,
//           template_type: prompt.template_type,
//           status: prompt.status === 'active' ? 'Active' : 'Draft',
//           usageCount: prompt.usage_count || 0,
//           successRate: prompt.success_rate || 0,
//           avgProcessingTime: prompt.avg_processing_time || 0,
//           createdBy: userInfo?.name || prompt.created_by || 'Admin',
//           createdAt: new Date(prompt.created_at).toLocaleDateString(),
//           lastModified: new Date(prompt.updated_at).toLocaleDateString(),
//           lastUsed: prompt.last_used_at ? new Date(prompt.last_used_at).toLocaleDateString() : 'Never',
//           version: prompt.version,
//           value: prompt.value || null,
//           llm_id: prompt.llm_id || null,
//           chunking_method_id: chunkingMethodId,
//         };
//       });
      
//       setPrompts(transformedData);
//     } catch (err) {
//       console.error('Error fetching prompts:', err);
//       setError('Failed to fetch prompts.');
      
//       if (err.response?.status === 401) {
//         MySwal.fire({
//           icon: 'error',
//           title: 'Authentication Error',
//           text: 'Your session has expired. Please login again.',
//           confirmButtonColor: '#3085d6',
//         }).then(() => {
//           localStorage.removeItem('token');
//         });
//       } else {
//         MySwal.fire({
//           icon: 'error',
//           title: 'Error!',
//           text: err.response?.data?.error || 'Failed to fetch prompts. Please try again later.',
//           confirmButtonColor: '#3085d6',
//         });
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (userInfo) {
//       console.log('🚀 User info loaded, fetching data...');
//       fetchPrompts();
//       fetchLlmModels();
//       fetchChunkingMethods();
//     }
//   }, [userInfo]);

//   // Debug effect to monitor state changes
//   useEffect(() => {
//     console.log('📊 STATE UPDATE - Chunking Methods:', chunkingMethods);
//     console.log('📊 STATE UPDATE - Chunking Methods Count:', chunkingMethods.length);
//     if (chunkingMethods.length > 0) {
//       console.log('📊 First Chunking Method:', chunkingMethods[0]);
//     }
//   }, [chunkingMethods]);

//   useEffect(() => {
//     console.log('📊 STATE UPDATE - Prompts:', prompts);
//     console.log('📊 STATE UPDATE - Prompts Count:', prompts.length);
//     if (prompts.length > 0) {
//       console.log('📊 First Prompt:', prompts[0]);
//       console.log('📊 First Prompt Chunking Method ID:', prompts[0].chunking_method_id);
//     }
//   }, [prompts]);

//   // Fetch LLM Models
//   const fetchLlmModels = async () => {
//     setLlmLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.get(LLM_API_BASE_URL, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       console.log('LLM Models Response:', response.data);
//       setLlmModels(response.data || []);
//     } catch (err) {
//       console.error('Error fetching LLM models:', err);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to fetch LLM models.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setLlmLoading(false);
//     }
//   };

//   // Fetch Chunking Methods
//   const fetchChunkingMethods = async () => {
//     setChunkingLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.get(CHUNKING_API_BASE_URL, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
//       console.log('Chunking Methods API Response:', response.data);
      
//       // Handle different response structures
//       let methods = [];
//       if (Array.isArray(response.data)) {
//         methods = response.data;
//       } else if (response.data.data && Array.isArray(response.data.data)) {
//         methods = response.data.data;
//       } else if (response.data.chunking_methods && Array.isArray(response.data.chunking_methods)) {
//         methods = response.data.chunking_methods;
//       }
      
//       // Transform to ensure consistent structure with name field
//       // API returns method_name, we need name for consistency
//       const transformedMethods = methods.map(method => ({
//         id: method.id || method.chunking_method_id || method.method_id,
//         name: method.method_name || method.name || method.chunking_name || 'Unknown Method',
//         method_name: method.method_name, // Keep original
//         description: method.description || '',
//         created_at: method.created_at,
//         updated_at: method.updated_at
//       }));
      
//       console.log('Transformed Chunking Methods:', transformedMethods);
//       setChunkingMethods(transformedMethods);
//     } catch (err) {
//       console.error('Error fetching chunking methods:', err);
//       console.error('Error details:', err.response?.data);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to fetch chunking methods.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setChunkingLoading(false);
//     }
//   };

//   // Create new LLM Model
//   const handleCreateLlm = async () => {
//     if (!newLlmName.trim()) {
//       MySwal.fire({
//         icon: 'warning',
//         title: 'Validation Error',
//         text: 'Please enter an LLM model name.',
//         confirmButtonColor: '#3085d6',
//       });
//       return;
//     }

//     setLlmLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.post(
//         LLM_API_BASE_URL,
//         { name: newLlmName.trim() },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             'Content-Type': 'application/json',
//           },
//         }
//       );
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'LLM model created successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//       });
      
//       setNewLlmName('');
//       setShowCreateLlmModal(false);
//       fetchLlmModels();
//     } catch (err) {
//       console.error('Error creating LLM model:', err);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to create LLM model.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setLlmLoading(false);
//     }
//   };

//   // Create new Chunking Method
//   const handleCreateChunkingMethod = async () => {
//     if (!newChunkingName.trim()) {
//       MySwal.fire({
//         icon: 'warning',
//         title: 'Validation Error',
//         text: 'Please enter a chunking method name.',
//         confirmButtonColor: '#3085d6',
//       });
//       return;
//     }

//     setChunkingLoading(true);
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.post(
//         CHUNKING_API_BASE_URL,
//         { name: newChunkingName.trim() },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             'Content-Type': 'application/json',
//           },
//         }
//       );
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'Chunking method created successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//       });
      
//       setNewChunkingName('');
//       setShowCreateChunkingModal(false);
//       fetchChunkingMethods();
//     } catch (err) {
//       console.error('Error creating chunking method:', err);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to create chunking method.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setChunkingLoading(false);
//     }
//   };

//   const fetchSecretValue = async (id) => {
//     setFetchValueLoading(prev => ({ ...prev, [id]: true }));
//     try {
//       const token = localStorage.getItem('token');
//       const response = await axios.get(`${API_BASE_URL}/${id}?fetch=true`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
      
//       const updatedPrompts = prompts.map(prompt => 
//         prompt.id === id ? { ...prompt, value: response.data.value } : prompt
//       );
//       setPrompts(updatedPrompts);
      
//       if (selectedPrompt?.id === id) {
//         setSelectedPrompt({ ...selectedPrompt, value: response.data.value });
//         if (editMode) {
//           setEditedPrompt({ ...editedPrompt, value: response.data.value });
//         }
//       }
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'Secret content loaded successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//         showConfirmButton: false,
//       });
//     } catch (err) {
//       console.error('Error fetching secret value:', err);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || 'Failed to fetch secret value.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setFetchValueLoading(prev => ({ ...prev, [id]: false }));
//     }
//   };

//   const handleViewPrompt = async (prompt) => {
//     setSelectedPrompt(prompt);
//     setEditMode(false);
//     setShowPromptTable(false);
//   };

//   const handleEditPrompt = () => {
//     setEditMode(true);
//     setEditedPrompt({ ...selectedPrompt });
//   };

//   const handleCancelEdit = () => {
//     setEditMode(false);
//     setEditedPrompt(null);
//   };

//   const handleSaveEdit = async () => {
//     setUpdateLoading(true);
//     try {
//       const token = localStorage.getItem('token');
      
//       // Prepare update data
//       const updateData = {
//         name: editedPrompt.name,
//         description: editedPrompt.description,
//         template_type: editedPrompt.template_type,
//         status: editedPrompt.status === 'Active' ? 'active' : 'draft',
//       };
      
//       // Add llm_id (handle null/undefined/empty string)
//       if (editedPrompt.llm_id !== null && editedPrompt.llm_id !== undefined && editedPrompt.llm_id !== '') {
//         updateData.llm_id = parseInt(editedPrompt.llm_id);
//       } else {
//         updateData.llm_id = null;
//       }
      
//       // Add chunking_method_id (handle null/undefined/empty string)
//       if (editedPrompt.chunking_method_id !== null && editedPrompt.chunking_method_id !== undefined && editedPrompt.chunking_method_id !== '') {
//         updateData.chunking_method_id = parseInt(editedPrompt.chunking_method_id);
//       } else {
//         updateData.chunking_method_id = null;
//       }
      
//       // Add secret_value only if it exists and has been loaded
//       if (editedPrompt.value) {
//         updateData.secret_value = editedPrompt.value;
//       }
      
//       console.log('📤 Updating prompt with data:', updateData);
//       console.log('📤 Updating prompt ID:', selectedPrompt.id);
      
//       const response = await axios.put(`${API_BASE_URL}/${selectedPrompt.id}`, updateData, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
      
//       console.log('✅ Prompt updated successfully:', response.data);
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'Prompt updated successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//       });
      
//       setEditMode(false);
//       setEditedPrompt(null);
//       fetchPrompts();
//       setSelectedPrompt(null);
//       setShowPromptTable(true);
//     } catch (err) {
//       console.error('❌ Error updating prompt:', err);
//       console.error('❌ Error response:', err.response?.data);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || err.response?.data?.message || 'Failed to update prompt.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setUpdateLoading(false);
//     }
//   };

//   const handleInputChange = (field, value) => {
//     setEditedPrompt(prev => ({ ...prev, [field]: value }));
//   };

//   const handleDeletePrompt = async (id) => {
//     const result = await MySwal.fire({
//       title: 'Are you sure?',
//       text: "You won't be able to revert this!",
//       icon: 'warning',
//       showCancelButton: true,
//       confirmButtonColor: '#d33',
//       cancelButtonColor: '#3085d6',
//       confirmButtonText: 'Yes, delete it!',
//     });

//     if (result.isConfirmed) {
//       setDeleteLoading(prev => ({ ...prev, [id]: true }));
//       try {
//         const token = localStorage.getItem('token');
//         await axios.delete(`${API_BASE_URL}/${id}`, {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             'Content-Type': 'application/json',
//           },
//         });
        
//         MySwal.fire({
//           icon: 'success',
//           title: 'Deleted!',
//           text: 'Prompt has been deleted.',
//           confirmButtonColor: '#3085d6',
//           timer: 2000,
//         });
        
//         fetchPrompts();
//         if (selectedPrompt?.id === id) {
//           setSelectedPrompt(null);
//           setShowPromptTable(true);
//         }
//       } catch (err) {
//         console.error('Error deleting prompt:', err);
//         MySwal.fire({
//           icon: 'error',
//           title: 'Error!',
//           text: err.response?.data?.error || 'Failed to delete prompt.',
//           confirmButtonColor: '#3085d6',
//         });
//       } finally {
//         setDeleteLoading(prev => ({ ...prev, [id]: false }));
//       }
//     }
//   };

//   const handleCreatePrompt = async () => {
//     if (!newPrompt.name.trim() || !newPrompt.secret_value.trim()) {
//       MySwal.fire({
//         icon: 'warning',
//         title: 'Validation Error',
//         text: 'Name and Secret Value are required.',
//         confirmButtonColor: '#3085d6',
//       });
//       return;
//     }

//     setCreateLoading(true);
//     try {
//       const token = localStorage.getItem('token');
      
//       // Prepare create data with proper type conversion
//       const createData = {
//         name: newPrompt.name.trim(),
//         description: newPrompt.description.trim(),
//         secret_value: newPrompt.secret_value.trim(),
//         template_type: newPrompt.template_type,
//         status: newPrompt.status,
//       };
      
//       // Add llm_id only if it has a value
//       if (newPrompt.llm_id !== null && newPrompt.llm_id !== undefined && newPrompt.llm_id !== '') {
//         createData.llm_id = parseInt(newPrompt.llm_id);
//       }
      
//       // Add chunking_method_id only if it has a value
//       if (newPrompt.chunking_method_id !== null && newPrompt.chunking_method_id !== undefined && newPrompt.chunking_method_id !== '') {
//         createData.chunking_method_id = parseInt(newPrompt.chunking_method_id);
//       }
      
//       console.log('📤 Creating prompt with data:', createData);
      
//       const response = await axios.post(`${API_BASE_URL}/create`, createData, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });
      
//       console.log('✅ Prompt created successfully:', response.data);
      
//       MySwal.fire({
//         icon: 'success',
//         title: 'Success!',
//         text: 'Prompt created successfully.',
//         confirmButtonColor: '#3085d6',
//         timer: 2000,
//       });
      
//       setNewPrompt({
//         name: '',
//         description: '',
//         secret_manager_id: '',
//         secret_value: '',
//         template_type: 'system',
//         status: 'active',
//         llm_id: null,
//         chunking_method_id: null,
//       });
//       setShowCreateForm(false);
//       setShowPromptTable(true);
//       fetchPrompts();
//     } catch (err) {
//       console.error('❌ Error creating prompt:', err);
//       console.error('❌ Error response:', err.response?.data);
//       MySwal.fire({
//         icon: 'error',
//         title: 'Error!',
//         text: err.response?.data?.error || err.response?.data?.message || 'Failed to create prompt.',
//         confirmButtonColor: '#3085d6',
//       });
//     } finally {
//       setCreateLoading(false);
//     }
//   };

//   const handleCopyToClipboard = (text) => {
//     navigator.clipboard.writeText(text);
//     MySwal.fire({
//       icon: 'success',
//       title: 'Copied!',
//       text: 'Content copied to clipboard.',
//       confirmButtonColor: '#3085d6',
//       timer: 1500,
//       showConfirmButton: false,
//     });
//   };

//   // Search and filter logic
//   const filteredPrompts = useMemo(() => {
//     return prompts.filter(prompt =>
//       prompt.name.toLowerCase().includes(searchValue.toLowerCase()) ||
//       prompt.description.toLowerCase().includes(searchValue.toLowerCase()) ||
//       prompt.template_type.toLowerCase().includes(searchValue.toLowerCase())
//     );
//   }, [prompts, searchValue]);

//   // Pagination logic
//   const totalPages = Math.ceil(filteredPrompts.length / itemsPerPage);
//   const paginatedPrompts = useMemo(() => {
//     const startIndex = (currentPage - 1) * itemsPerPage;
//     return filteredPrompts.slice(startIndex, startIndex + itemsPerPage);
//   }, [filteredPrompts, currentPage]);

//   const handlePageChange = (newPage) => {
//     if (newPage >= 1 && newPage <= totalPages) {
//       setCurrentPage(newPage);
//     }
//   };

//   // Helper function to get chunking method name
//   const getChunkingMethodName = (chunkingMethodId) => {
//     console.log('🔍 getChunkingMethodName called with:', chunkingMethodId);
    
//     if (!chunkingMethodId && chunkingMethodId !== 0) {
//       console.log('❌ No chunking method ID provided');
//       return 'N/A';
//     }
    
//     console.log('🔍 Searching in methods:', chunkingMethods);
//     console.log('🔍 Total methods available:', chunkingMethods.length);
    
//     // Try multiple matching strategies
//     const searchId = typeof chunkingMethodId === 'string' ? parseInt(chunkingMethodId, 10) : chunkingMethodId;
//     console.log('🔍 Parsed search ID:', searchId, 'Type:', typeof searchId);
    
//     // Strategy 1: Exact match
//     let method = chunkingMethods.find(m => m.id === searchId);
//     console.log('🔍 Strategy 1 (exact match) result:', method);
    
//     // Strategy 2: String comparison
//     if (!method) {
//       method = chunkingMethods.find(m => String(m.id) === String(searchId));
//       console.log('🔍 Strategy 2 (string match) result:', method);
//     }
    
//     // Strategy 3: Number comparison with type conversion
//     if (!method) {
//       method = chunkingMethods.find(m => {
//         const methodId = typeof m.id === 'string' ? parseInt(m.id, 10) : m.id;
//         return methodId === searchId;
//       });
//       console.log('🔍 Strategy 3 (type conversion) result:', method);
//     }
    
//     const result = method?.name || 'N/A';
//     console.log('✅ Final result:', result);
//     return result;
//   };

//   // Color helper functions
//   const getStatusColor = (status) => {
//     return status === 'Active' ? 'text-green-600' : 'text-yellow-600';
//   };

//   const getTemplateTypeColor = (type) => {
//     const colors = {
//       system: 'bg-blue-100 text-blue-800',
//       user: 'bg-green-100 text-green-800',
//       assistant: 'bg-purple-100 text-purple-800',
//       function: 'bg-orange-100 text-orange-800',
//     };
//     return colors[type] || 'bg-gray-100 text-gray-800';
//   };

//   if (loading && !userInfo) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-gray-600 font-medium">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
//       <div className="max-w-7xl mx-auto">
//         {/* Header */}
//         <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
//           <div className="flex items-center justify-between">
//             <div>
//               <h1 className="text-3xl font-bold text-gray-800 flex items-center">
//                 <Code className="mr-3 text-gray-800" size={32} />
//                 Prompt Management System
//               </h1>
//               <p className="text-gray-600 mt-2">Manage and organize your AI prompts efficiently</p>
//             </div>
//             {userInfo && (
//               <div className="text-right">
//                 <p className="text-sm text-gray-600">Logged in as</p>
//                 <p className="font-semibold text-gray-800">{userInfo.name}</p>
//                 <p className="text-xs text-gray-500">{userInfo.role}</p>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Action Buttons */}
//         {showPromptTable && !showCreateForm && (
//           <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
//             <div className="flex flex-wrap gap-4 items-center justify-between">
//               <div className="flex gap-3">
//                 <button
//                   onClick={() => {
//                     setShowCreateForm(true);
//                     setShowPromptTable(false);
//                   }}
//                   className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg"
//                 >
//                   <PlusCircle className="w-5 h-5 mr-2" />
//                   Create New Prompt
//                 </button>
//                 <button
//                   onClick={() => setShowCreateLlmModal(true)}
//                   className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg"
//                 >
//                   <PlusCircle className="w-5 h-5 mr-2" />
//                   Add LLM Model
//                 </button>
//                 <button
//                   onClick={() => setShowCreateChunkingModal(true)}
//                   className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg"
//                 >
//                   <PlusCircle className="w-5 h-5 mr-2" />
//                   Add Chunking Method
//                 </button>
//               </div>
              
//               <div className="flex-1 max-w-md">
//                 <div className="relative">
//                   <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
//                   <input
//                     type="text"
//                     placeholder="Search prompts..."
//                     value={searchValue}
//                     onChange={(e) => {
//                       setSearchValue(e.target.value);
//                       setCurrentPage(1);
//                     }}
//                     className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
//                   />
//                 </div>
//               </div>
              
//               <button
//                 onClick={() => {
//                   console.log('=== DEBUG INFO ===');
//                   console.log('Chunking Methods:', chunkingMethods);
//                   console.log('LLM Models:', llmModels);
//                   console.log('Prompts:', prompts);
//                   console.log('Sample Prompt IDs:', prompts.map(p => ({ 
//                     name: p.name, 
//                     chunking_id: p.chunking_method_id,
//                     chunking_type: typeof p.chunking_method_id,
//                     llm_id: p.llm_id 
//                   })));
//                   MySwal.fire({
//                     icon: 'info',
//                     title: 'Debug Info',
//                     html: `
//                       <div style="text-align: left; font-size: 12px;">
//                         <p><strong>Chunking Methods:</strong> ${chunkingMethods.length} loaded</p>
//                         <p><strong>LLM Models:</strong> ${llmModels.length} loaded</p>
//                         <p><strong>Prompts:</strong> ${prompts.length} loaded</p>
//                         <p style="margin-top: 10px;">Check browser console for detailed data</p>
//                       </div>
//                     `,
//                     confirmButtonColor: '#3085d6',
//                   });
//                 }}
//                 className="inline-flex items-center px-4 py-2.5 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all"
//                 title="Show debug info in console"
//               >
//                 🔍 Debug
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Create LLM Modal */}
//         {showCreateLlmModal && (
//           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//             <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-xl font-bold text-gray-800">Create New LLM Model</h3>
//                 <button
//                   onClick={() => {
//                     setShowCreateLlmModal(false);
//                     setNewLlmName('');
//                   }}
//                   className="text-gray-400 hover:text-gray-600 transition-colors"
//                 >
//                   <X size={24} />
//                 </button>
//               </div>
              
//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     LLM Model Name
//                   </label>
//                   <input
//                     type="text"
//                     value={newLlmName}
//                     onChange={(e) => setNewLlmName(e.target.value)}
//                     placeholder="e.g., GPT-4, Claude-3, Gemini-Pro"
//                     className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
//                   />
//                 </div>
                
//                 <div className="flex gap-3 pt-4">
//                   <button
//                     onClick={handleCreateLlm}
//                     disabled={llmLoading}
//                     className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {llmLoading ? 'Creating...' : 'Create LLM Model'}
//                   </button>
//                   <button
//                     onClick={() => {
//                       setShowCreateLlmModal(false);
//                       setNewLlmName('');
//                     }}
//                     className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
//                   >
//                     Cancel
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Create Chunking Method Modal */}
//         {showCreateChunkingModal && (
//           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//             <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-xl font-bold text-gray-800">Create New Chunking Method</h3>
//                 <button
//                   onClick={() => {
//                     setShowCreateChunkingModal(false);
//                     setNewChunkingName('');
//                   }}
//                   className="text-gray-400 hover:text-gray-600 transition-colors"
//                 >
//                   <X size={24} />
//                 </button>
//               </div>
              
//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Chunking Method Name
//                   </label>
//                   <input
//                     type="text"
//                     value={newChunkingName}
//                     onChange={(e) => setNewChunkingName(e.target.value)}
//                     placeholder="e.g., Fixed-Size, Semantic, Recursive"
//                     className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
//                   />
//                 </div>
                
//                 <div className="flex gap-3 pt-4">
//                   <button
//                     onClick={handleCreateChunkingMethod}
//                     disabled={chunkingLoading}
//                     className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {chunkingLoading ? 'Creating...' : 'Create Chunking Method'}
//                   </button>
//                   <button
//                     onClick={() => {
//                       setShowCreateChunkingModal(false);
//                       setNewChunkingName('');
//                     }}
//                     className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
//                   >
//                     Cancel
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Create Form */}
//         {showCreateForm && (
//           <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
//             <div className="flex items-center justify-between mb-6">
//               <h2 className="text-2xl font-bold text-gray-800">Create New Prompt</h2>
//               <button
//                 onClick={() => {
//                   setShowCreateForm(false);
//                   setShowPromptTable(true);
//                   setNewPrompt({
//                     name: '',
//                     description: '',
//                     secret_manager_id: '',
//                     secret_value: '',
//                     template_type: 'system',
//                     status: 'active',
//                     llm_id: null,
//                     chunking_method_id: null,
//                   });
//                 }}
//                 className="text-gray-400 hover:text-gray-600 transition-colors"
//               >
//                 <X size={24} />
//               </button>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Name <span className="text-red-500">*</span>
//                 </label>
//                 <input
//                   type="text"
//                   value={newPrompt.name}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
//                   placeholder="Enter prompt name"
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Template Type
//                 </label>
//                 <select
//                   value={newPrompt.template_type}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, template_type: e.target.value })}
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   <option value="system">System</option>
//                   <option value="user">User</option>
//                   <option value="assistant">Assistant</option>
//                   <option value="function">Function</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Status
//                 </label>
//                 <select
//                   value={newPrompt.status}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, status: e.target.value })}
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   <option value="active">Active</option>
//                   <option value="draft">Draft</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   LLM Model
//                 </label>
//                 <select
//                   value={newPrompt.llm_id || ''}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, llm_id: e.target.value ? parseInt(e.target.value) : null })}
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   <option value="">Select LLM Model</option>
//                   {llmModels.map(llm => (
//                     <option key={llm.id} value={llm.id}>{llm.name}</option>
//                   ))}
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Chunking Method
//                 </label>
//                 <select
//                   value={newPrompt.chunking_method_id || ''}
//                   onChange={(e) => {
//                     const value = e.target.value ? parseInt(e.target.value) : null;
//                     console.log('📝 Chunking method selected:', value);
//                     console.log('📝 Selected method details:', chunkingMethods.find(m => m.id === value));
//                     setNewPrompt({ ...newPrompt, chunking_method_id: value });
//                   }}
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
//                 >
//                   <option value="">Select Chunking Method</option>
//                   {chunkingMethods.map(method => (
//                     <option key={method.id} value={method.id}>{method.name}</option>
//                   ))}
//                 </select>
//                 {newPrompt.chunking_method_id && (
//                   <p className="text-xs text-gray-500 mt-1">
//                     Selected ID: {newPrompt.chunking_method_id}
//                   </p>
//                 )}
//               </div>

//               <div className="md:col-span-2">
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Description
//                 </label>
//                 <textarea
//                   value={newPrompt.description}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
//                   rows={3}
//                   placeholder="Enter prompt description"
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div className="md:col-span-2">
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Prompt Content <span className="text-red-500">*</span>
//                 </label>
//                 <textarea
//                   value={newPrompt.secret_value}
//                   onChange={(e) => setNewPrompt({ ...newPrompt, secret_value: e.target.value })}
//                   rows={8}
//                   placeholder="Enter your prompt content here..."
//                   className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
//                 />
//               </div>
//             </div>

//             <div className="flex gap-4 mt-6">
//               <button
//                 onClick={handleCreatePrompt}
//                 disabled={createLoading}
//                 className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
//               >
//                 {createLoading ? 'Creating...' : (
//                   <>
//                     <Save className="w-5 h-5 mr-2" />
//                     Create Prompt
//                   </>
//                 )}
//               </button>
//               <button
//                 onClick={() => {
//                   setShowCreateForm(false);
//                   setShowPromptTable(true);
//                   setNewPrompt({
//                     name: '',
//                     description: '',
//                     secret_manager_id: '',
//                     secret_value: '',
//                     template_type: 'system',
//                     status: 'active',
//                     llm_id: null,
//                     chunking_method_id: null,
//                   });
//                 }}
//                 className="px-6 py-3 border border-gray-300 text-base font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Prompts Table */}
//         {showPromptTable && !selectedPrompt && (
//           <div className="bg-white rounded-xl shadow-lg overflow-hidden">
//             <div className="overflow-x-auto">
//               <table className="min-w-full divide-y divide-gray-200">
//                 <thead className="bg-gray-50 border-b border-gray-200">
//                   <tr>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       <div className="flex items-center">
//                         <FileText className="w-4 h-4 mr-2" />
//                         Name
//                       </div>
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       <div className="flex items-center">
//                         <Hash className="w-4 h-4 mr-2" />
//                         Type
//                       </div>
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       Status
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       LLM Model
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       Chunking Method
//                     </th>
//                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       Usage
//                     </th>
//                     <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
//                       Actions
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="bg-white divide-y divide-gray-200">
//                   {loading ? (
//                     <tr>
//                       <td colSpan="7" className="px-6 py-12 text-center">
//                         <div className="flex flex-col items-center justify-center">
//                           <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
//                           <p className="text-gray-600 font-medium">Loading prompts...</p>
//                         </div>
//                       </td>
//                     </tr>
//                   ) : paginatedPrompts.length === 0 ? (
//                     <tr>
//                       <td colSpan="7" className="px-6 py-12 text-center">
//                         <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
//                         <p className="text-gray-500 font-medium text-lg">No prompts found</p>
//                         <p className="text-gray-400 text-sm mt-2">
//                           {searchValue ? 'Try adjusting your search criteria' : 'Create your first prompt to get started'}
//                         </p>
//                       </td>
//                     </tr>
//                   ) : (
//                     paginatedPrompts.map((prompt) => (
//                       <tr key={prompt.id} className="hover:bg-gray-50 transition-colors">
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <div className="flex items-center">
//                             <Key className="w-4 h-4 text-gray-400 mr-2" />
//                             <div>
//                               <div className="text-sm font-semibold text-gray-900">{prompt.name}</div>
//                               <div className="text-xs text-gray-500">{prompt.secret_manager_id}</div>
//                             </div>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getTemplateTypeColor(prompt.template_type)}`}>
//                             {prompt.template_type}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <span className={`text-sm font-medium ${getStatusColor(prompt.status)}`}>
//                             {prompt.status}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                           {prompt.llm_id ? llmModels.find(llm => llm.id === prompt.llm_id)?.name || 'N/A' : 'N/A'}
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                           <div>
//                             <div className="font-medium">
//                               {getChunkingMethodName(prompt.chunking_method_id)}
//                             </div>
//                             <div className="text-xs text-gray-500">
//                               ID: {prompt.chunking_method_id !== null && prompt.chunking_method_id !== undefined ? 
//                                 `${prompt.chunking_method_id} (${typeof prompt.chunking_method_id})` : 
//                                 'null'}
//                             </div>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
//                           {prompt.usageCount} uses
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
//                           <div className="flex items-center justify-end gap-2">
//                             <button
//                               onClick={() => handleViewPrompt(prompt)}
//                               className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
//                               title="View Details"
//                             >
//                               <Eye className="w-4 h-4" />
//                             </button>
//                             <button
//                               onClick={() => handleDeletePrompt(prompt.id)}
//                               disabled={deleteLoading[prompt.id]}
//                               className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                               title="Delete"
//                             >
//                               {deleteLoading[prompt.id] ? (
//                                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
//                               ) : (
//                                 <Trash2 className="w-4 h-4" />
//                               )}
//                             </button>
//                           </div>
//                         </td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>

//             {/* Pagination */}
//             {!loading && filteredPrompts.length > 0 && (
//               <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
//                 <div className="text-sm text-gray-700">
//                   Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
//                   <span className="font-semibold">
//                     {Math.min(currentPage * itemsPerPage, filteredPrompts.length)}
//                   </span>{' '}
//                   of <span className="font-semibold">{filteredPrompts.length}</span> prompts
//                 </div>
//                 <div className="flex gap-2">
//                   <button
//                     onClick={() => handlePageChange(currentPage - 1)}
//                     disabled={currentPage === 1}
//                     className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//                   >
//                     <ChevronLeft className="w-4 h-4 mr-1" />
//                     Previous
//                   </button>
//                   <span className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700">
//                     Page {currentPage} of {totalPages}
//                   </span>
//                   <button
//                     onClick={() => handlePageChange(currentPage + 1)}
//                     disabled={currentPage === totalPages}
//                     className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//                   >
//                     Next
//                     <ChevronRight className="w-4 h-4 ml-1" />
//                   </button>
//                 </div>
//               </div>
//             )}
//           </div>
//         )}

//         {/* Prompt Detail View */}
//         {selectedPrompt && (
//           <div className="bg-white rounded-xl shadow-lg p-6">
//             <div className="flex items-center justify-between mb-6">
//               <button
//                 onClick={() => {
//                   setSelectedPrompt(null);
//                   setShowPromptTable(true);
//                   setEditMode(false);
//                   setEditedPrompt(null);
//                 }}
//                 className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold transition-colors"
//               >
//                 <ChevronLeft className="w-5 h-5 mr-1" />
//                 Back to List
//               </button>
//               <div className="flex gap-3">
//                 {editMode ? (
//                   <>
//                     <button
//                       onClick={handleSaveEdit}
//                       disabled={updateLoading}
//                       className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                     >
//                       {updateLoading ? 'Saving...' : (
//                         <>
//                           <Save className="w-4 h-4 mr-2" />
//                           Save Changes
//                         </>
//                       )}
//                     </button>
//                     <button
//                       onClick={handleCancelEdit}
//                       className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
//                     >
//                       Cancel
//                     </button>
//                   </>
//                 ) : (
//                   <>
//                     <button
//                       onClick={handleEditPrompt}
//                       className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
//                     >
//                       <Edit className="w-4 h-4 mr-2" />
//                       Edit
//                     </button>
//                     {selectedPrompt.value && (
//                       <button
//                         onClick={() => handleCopyToClipboard(selectedPrompt.value)}
//                         className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
//                       >
//                         <Copy className="w-4 h-4 mr-2" />
//                         Copy Content
//                       </button>
//                     )}
//                   </>
//                 )}
//               </div>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
//               <div className="space-y-4">
//                 <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Prompt Details</h4>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
//                   {editMode ? (
//                     <input
//                       type="text"
//                       value={editedPrompt.name}
//                       onChange={(e) => handleInputChange('name', e.target.value)}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     />
//                   ) : (
//                     <p className="text-sm font-semibold text-gray-900">{selectedPrompt.name}</p>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Secret Manager ID</label>
//                   <p className="text-sm text-gray-900 font-mono">{selectedPrompt.secret_manager_id}</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Template Type</label>
//                   {editMode ? (
//                     <select
//                       value={editedPrompt.template_type}
//                       onChange={(e) => handleInputChange('template_type', e.target.value)}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     >
//                       <option value="system">System</option>
//                       <option value="user">User</option>
//                       <option value="assistant">Assistant</option>
//                       <option value="function">Function</option>
//                     </select>
//                   ) : (
//                     <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getTemplateTypeColor(selectedPrompt.template_type)}`}>
//                       {selectedPrompt.template_type}
//                     </span>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
//                   {editMode ? (
//                     <select
//                       value={editedPrompt.status}
//                       onChange={(e) => handleInputChange('status', e.target.value)}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     >
//                       <option value="Active">Active</option>
//                       <option value="Draft">Draft</option>
//                     </select>
//                   ) : (
//                     <span className={`text-sm font-medium ${getStatusColor(selectedPrompt.status)}`}>
//                       {selectedPrompt.status}
//                     </span>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
//                   <p className="text-sm text-gray-900">{selectedPrompt.version || 'Not available'}</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">LLM Model</label>
//                   {editMode ? (
//                     <select
//                       value={editedPrompt.llm_id || ''}
//                       onChange={(e) => handleInputChange('llm_id', e.target.value ? parseInt(e.target.value) : null)}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     >
//                       <option value="">Select LLM Model</option>
//                       {llmModels.map(llm => (
//                         <option key={llm.id} value={llm.id}>{llm.name}</option>
//                       ))}
//                     </select>
//                   ) : (
//                     <p className="text-sm text-gray-900">
//                       {selectedPrompt.llm_id ? llmModels.find(llm => llm.id === selectedPrompt.llm_id)?.name || 'N/A' : 'N/A'}
//                     </p>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Chunking Method</label>
//                   {editMode ? (
//                     <div>
//                       <select
//                         value={editedPrompt.chunking_method_id || ''}
//                         onChange={(e) => {
//                           const value = e.target.value ? parseInt(e.target.value) : null;
//                           console.log('✏️ Editing - Chunking method changed to:', value);
//                           console.log('✏️ Selected method details:', chunkingMethods.find(m => m.id === value));
//                           handleInputChange('chunking_method_id', value);
//                         }}
//                         className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-medium"
//                       >
//                         <option value="">Select Chunking Method</option>
//                         {chunkingMethods.map(method => (
//                           <option key={method.id} value={method.id}>{method.name}</option>
//                         ))}
//                       </select>
//                       {editedPrompt.chunking_method_id && (
//                         <p className="text-xs text-gray-500 mt-1">
//                           Selected ID: {editedPrompt.chunking_method_id}
//                         </p>
//                       )}
//                     </div>
//                   ) : (
//                     <p className="text-sm text-gray-900">
//                       {getChunkingMethodName(selectedPrompt.chunking_method_id)}
//                     </p>
//                   )}
//                 </div>
//               </div>

//               <div className="space-y-4">
//                 <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Usage & Metadata</h4>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
//                   {editMode ? (
//                     <textarea
//                       value={editedPrompt.description}
//                       onChange={(e) => handleInputChange('description', e.target.value)}
//                       rows={3}
//                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
//                     />
//                   ) : (
//                     <p className="text-sm text-gray-900">{selectedPrompt.description}</p>
//                   )}
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Usage Count</label>
//                   <p className="text-sm text-gray-900">{selectedPrompt.usageCount} times used</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Success Rate</label>
//                   <p className="text-sm text-gray-900">{selectedPrompt.successRate}%</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Avg Processing Time</label>
//                   <p className="text-sm text-gray-900">{selectedPrompt.avgProcessingTime}ms</p>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
//                   <div className="flex items-center">
//                     <User className="w-4 h-4 mr-2 text-gray-600" />
//                     <span className="text-sm text-gray-900">{selectedPrompt.createdBy}</span>
//                   </div>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
//                   <div className="flex items-center">
//                     <Calendar className="w-4 h-4 mr-2 text-gray-600" />
//                     <span className="text-sm text-gray-900">{selectedPrompt.createdAt}</span>
//                   </div>
//                 </div>

//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Last Used</label>
//                   <div className="flex items-center">
//                     <Calendar className="w-4 h-4 mr-2 text-gray-600" />
//                     <span className="text-sm text-gray-900">{selectedPrompt.lastUsed}</span>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="mt-6 pt-6 border-t border-gray-200">
//               <div className="flex items-center justify-between mb-4">
//                 <h4 className="text-lg font-medium text-gray-900">Prompt Content</h4>
//                 {selectedPrompt.value ? (
//                   <div className="flex items-center text-green-600">
//                     <Unlock className="w-4 h-4 mr-1" />
//                     <span className="text-sm font-medium">Secret Loaded</span>
//                   </div>
//                 ) : (
//                   <div className="flex items-center text-gray-500">
//                     <Lock className="w-4 h-4 mr-1" />
//                     <span className="text-sm font-medium">Secret Protected</span>
//                   </div>
//                 )}
//               </div>
              
//               {selectedPrompt.value ? (
//                 editMode ? (
//                   <textarea
//                     value={editedPrompt.value || ''}
//                     onChange={(e) => handleInputChange('value', e.target.value)}
//                     rows={10}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
//                     placeholder="Enter prompt content..."
//                   />
//                 ) : (
//                   <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap border">
//                     {selectedPrompt.value}
//                   </div>
//                 )
//               ) : (
//                 <div className="bg-gray-100 rounded-lg p-8 text-center">
//                   <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
//                   <p className="text-gray-600 mb-4">Prompt content is secured and not loaded yet.</p>
//                   <button
//                     onClick={() => fetchSecretValue(selectedPrompt.id)}
//                     disabled={fetchValueLoading[selectedPrompt.id]}
//                     className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {fetchValueLoading[selectedPrompt.id] ? 'Loading...' : (
//                       <>
//                         <Unlock className="w-4 h-4 mr-2" />
//                         Load Secret Content
//                       </>
//                     )}
//                   </button>
//                 </div>
//               )}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default PromptManagement;








import React, { useState, useMemo, useEffect } from 'react';
import { Eye, Edit, Save, FileText, Key, Code, Hash, Filter, ChevronLeft, ChevronRight, Trash2, Copy, Calendar, User, PlusCircle, X, Lock, Unlock } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// Helper function to decode JWT token
const decodeToken = (token) => {
  try {
    if (!token) return null;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

const MySwal = withReactContent(Swal);

const PromptManagement = () => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(null);
  const [showPromptTable, setShowPromptTable] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    description: '',
    secret_manager_id: '',
    secret_value: '',
    template_type: 'system',
    status: 'active',
    llm_id: null,
    chunking_method_id: null,
    temperature: null,
  });
  const [inputPdfFile, setInputPdfFile] = useState(null);
  const [outputPdfFile, setOutputPdfFile] = useState(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState(null);
  const [pdfModalTitle, setPdfModalTitle] = useState('');
  const [rawResponseModalOpen, setRawResponseModalOpen] = useState(false);
  const [rawResponseData, setRawResponseData] = useState(null);
  const [rawResponseTitle, setRawResponseTitle] = useState('');
  const [showMappedSchema, setShowMappedSchema] = useState(true);

  const [llmModels, setLlmModels] = useState([]);
  const [showCreateLlmModal, setShowCreateLlmModal] = useState(false);
  const [newLlmName, setNewLlmName] = useState('');
  const [llmLoading, setLlmLoading] = useState(false);

  const [chunkingMethods, setChunkingMethods] = useState([]);
  const [showCreateChunkingModal, setShowCreateChunkingModal] = useState(false);
  const [newChunkingName, setNewChunkingName] = useState('');
  const [chunkingLoading, setChunkingLoading] = useState(false);
  
  // Search and pagination states
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Loading states
  const [createLoading, setCreateLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState({});
  const [fetchValueLoading, setFetchValueLoading] = useState({});

  // API Base URL
  const API_BASE_URL = 'http://localhost:4000/api/secrets';
  const LLM_API_BASE_URL = 'http://localhost:4000/api/llm';
  const CHUNKING_API_BASE_URL = 'http://localhost:4000/api/chunking-methods';

  // Get user info from token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUserInfo({
          userId: decoded.id || decoded.userId || decoded.user_id,
          role: decoded.role || decoded.userRole || decoded.user_role,
          email: decoded.email,
          name: decoded.name || decoded.username
        });
        console.log('User Info:', decoded);
      } else {
        MySwal.fire({
          icon: 'error',
          title: 'Authentication Error',
          text: 'Invalid token. Please login again.',
          confirmButtonColor: '#3085d6',
        }).then(() => {
          localStorage.removeItem('token');
        });
      }
    } else {
      MySwal.fire({
        icon: 'warning',
        title: 'Authentication Required',
        text: 'Please login to access this page.',
        confirmButtonColor: '#3085d6',
      });
    }
  }, []);

  const fetchPrompts = async (includeValues = false) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('Fetching prompts with token:', token.substring(0, 20) + '...');
      const url = includeValues ? `${API_BASE_URL}?fetch=true` : API_BASE_URL;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      // Transform the data to match component expectations
      const transformedData = response.data.map(prompt => {
        // Parse chunking_method_id properly
        let chunkingMethodId = null;
        if (prompt.chunking_method_id !== null && prompt.chunking_method_id !== undefined) {
          chunkingMethodId = typeof prompt.chunking_method_id === 'string' 
            ? parseInt(prompt.chunking_method_id, 10) 
            : prompt.chunking_method_id;
        }
        
        console.log(`Prompt "${prompt.name}" chunking_method_id:`, chunkingMethodId, 'Type:', typeof chunkingMethodId);
        
        return {
          id: prompt.id,
          name: prompt.name,
          description: prompt.description || 'No description available',
          secret_manager_id: prompt.secret_manager_id,
          template_type: prompt.template_type,
          status: prompt.status === 'active' ? 'Active' : 'Draft',
          usageCount: prompt.usage_count || 0,
          successRate: prompt.success_rate || 0,
          avgProcessingTime: prompt.avg_processing_time || 0,
          createdBy: userInfo?.name || prompt.created_by || 'Admin',
          createdAt: new Date(prompt.created_at).toLocaleDateString(),
          lastModified: new Date(prompt.updated_at).toLocaleDateString(),
          lastUsed: prompt.last_used_at ? new Date(prompt.last_used_at).toLocaleDateString() : 'Never',
          version: prompt.version,
          value: prompt.value || null,
          llm_id: prompt.llm_id || null,
          chunking_method_id: chunkingMethodId,
          temperature: prompt.temperature !== null && prompt.temperature !== undefined ? parseFloat(prompt.temperature) : null,
        };
      });
      
      setPrompts(transformedData);
    } catch (err) {
      console.error('Error fetching prompts:', err);
      setError('Failed to fetch prompts.');
      
      if (err.response?.status === 401) {
        MySwal.fire({
          icon: 'error',
          title: 'Authentication Error',
          text: 'Your session has expired. Please login again.',
          confirmButtonColor: '#3085d6',
        }).then(() => {
          localStorage.removeItem('token');
        });
      } else {
        MySwal.fire({
          icon: 'error',
          title: 'Error!',
          text: err.response?.data?.error || 'Failed to fetch prompts. Please try again later.',
          confirmButtonColor: '#3085d6',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userInfo) {
      console.log('🚀 User info loaded, fetching data...');
      fetchPrompts();
      fetchLlmModels();
      fetchChunkingMethods();
    }
  }, [userInfo]);

  // Debug effect to monitor state changes
  useEffect(() => {
    console.log('📊 STATE UPDATE - Chunking Methods:', chunkingMethods);
    console.log('📊 STATE UPDATE - Chunking Methods Count:', chunkingMethods.length);
    if (chunkingMethods.length > 0) {
      console.log('📊 First Chunking Method:', chunkingMethods[0]);
    }
  }, [chunkingMethods]);

  useEffect(() => {
    console.log('📊 STATE UPDATE - Prompts:', prompts);
    console.log('📊 STATE UPDATE - Prompts Count:', prompts.length);
    if (prompts.length > 0) {
      console.log('📊 First Prompt:', prompts[0]);
      console.log('📊 First Prompt Chunking Method ID:', prompts[0].chunking_method_id);
    }
  }, [prompts]);

  // Fetch LLM Models
  const fetchLlmModels = async () => {
    setLlmLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(LLM_API_BASE_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('LLM Models Response:', response.data);
      setLlmModels(response.data || []);
    } catch (err) {
      console.error('Error fetching LLM models:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to fetch LLM models.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLlmLoading(false);
    }
  };

  // Fetch Chunking Methods
  const fetchChunkingMethods = async () => {
    setChunkingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(CHUNKING_API_BASE_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Chunking Methods API Response:', response.data);
      
      // Handle different response structures
      let methods = [];
      if (Array.isArray(response.data)) {
        methods = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        methods = response.data.data;
      } else if (response.data.chunking_methods && Array.isArray(response.data.chunking_methods)) {
        methods = response.data.chunking_methods;
      }
      
      // Transform to ensure consistent structure with name field
      // API returns method_name, we need name for consistency
      const transformedMethods = methods.map(method => ({
        id: method.id || method.chunking_method_id || method.method_id,
        name: method.method_name || method.name || method.chunking_name || 'Unknown Method',
        method_name: method.method_name, // Keep original
        description: method.description || '',
        created_at: method.created_at,
        updated_at: method.updated_at
      }));
      
      console.log('Transformed Chunking Methods:', transformedMethods);
      setChunkingMethods(transformedMethods);
    } catch (err) {
      console.error('Error fetching chunking methods:', err);
      console.error('Error details:', err.response?.data);
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to fetch chunking methods.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setChunkingLoading(false);
    }
  };

  // Create new LLM Model
  const handleCreateLlm = async () => {
    if (!newLlmName.trim()) {
      MySwal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: 'Please enter an LLM model name.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    setLlmLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        LLM_API_BASE_URL,
        { name: newLlmName.trim() },
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
        text: 'LLM model created successfully.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
      });
      
      setNewLlmName('');
      setShowCreateLlmModal(false);
      fetchLlmModels();
    } catch (err) {
      console.error('Error creating LLM model:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to create LLM model.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLlmLoading(false);
    }
  };

  // Create new Chunking Method
  const handleCreateChunkingMethod = async () => {
    if (!newChunkingName.trim()) {
      MySwal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: 'Please enter a chunking method name.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    setChunkingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        CHUNKING_API_BASE_URL,
        { name: newChunkingName.trim() },
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
        text: 'Chunking method created successfully.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
      });
      
      setNewChunkingName('');
      setShowCreateChunkingModal(false);
      fetchChunkingMethods();
    } catch (err) {
      console.error('Error creating chunking method:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to create chunking method.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setChunkingLoading(false);
    }
  };

  const fetchSecretValue = async (id) => {
    setFetchValueLoading(prev => ({ ...prev, [id]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const updatedPrompts = prompts.map(prompt => 
        prompt.id === id ? { 
          ...prompt, 
          value: response.data.value,
          templates: response.data.templates 
        } : prompt
      );
      setPrompts(updatedPrompts);
      
      if (selectedPrompt?.id === id) {
        setSelectedPrompt({ 
          ...selectedPrompt, 
          value: response.data.value,
          templates: response.data.templates 
        });
        if (editMode) {
          setEditedPrompt({ 
            ...editedPrompt, 
            value: response.data.value,
            templates: response.data.templates 
          });
        }
      }
      
      MySwal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Secret content and templates loaded successfully.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error('Error fetching secret value:', err);
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || 'Failed to fetch secret value.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setFetchValueLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleViewPrompt = async (prompt) => {
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
    setUpdateLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Prepare update data
      const updateData = {
        name: editedPrompt.name,
        description: editedPrompt.description,
        template_type: editedPrompt.template_type,
        status: editedPrompt.status === 'Active' ? 'active' : 'draft',
      };
      
      // Add llm_id (handle null/undefined/empty string)
      if (editedPrompt.llm_id !== null && editedPrompt.llm_id !== undefined && editedPrompt.llm_id !== '') {
        updateData.llm_id = parseInt(editedPrompt.llm_id);
      } else {
        updateData.llm_id = null;
      }
      
      // Add chunking_method_id (handle null/undefined/empty string)
      if (editedPrompt.chunking_method_id !== null && editedPrompt.chunking_method_id !== undefined && editedPrompt.chunking_method_id !== '') {
        updateData.chunking_method_id = parseInt(editedPrompt.chunking_method_id);
      } else {
        updateData.chunking_method_id = null;
      }
      
      // Add temperature (handle null/undefined/empty string)
      if (editedPrompt.temperature !== null && editedPrompt.temperature !== undefined && editedPrompt.temperature !== '') {
        updateData.temperature = parseFloat(editedPrompt.temperature);
      } else {
        updateData.temperature = null;
      }
      
      // Add secret_value only if it exists and has been loaded
      if (editedPrompt.value) {
        updateData.secret_value = editedPrompt.value;
      }
      
      console.log('📤 Updating prompt with data:', updateData);
      console.log('📤 Updating prompt ID:', selectedPrompt.id);
      
      const response = await axios.put(`${API_BASE_URL}/${selectedPrompt.id}`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('✅ Prompt updated successfully:', response.data);
      
      MySwal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Prompt updated successfully.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
      });
      
      setEditMode(false);
      setEditedPrompt(null);
      fetchPrompts();
      setSelectedPrompt(null);
      setShowPromptTable(true);
    } catch (err) {
      console.error('❌ Error updating prompt:', err);
      console.error('❌ Error response:', err.response?.data);
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || err.response?.data?.message || 'Failed to update prompt.',
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
        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        MySwal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Prompt has been deleted.',
          confirmButtonColor: '#3085d6',
          timer: 2000,
        });
        
        fetchPrompts();
        if (selectedPrompt?.id === id) {
          setSelectedPrompt(null);
          setShowPromptTable(true);
        }
      } catch (err) {
        console.error('Error deleting prompt:', err);
        MySwal.fire({
          icon: 'error',
          title: 'Error!',
          text: err.response?.data?.error || 'Failed to delete prompt.',
          confirmButtonColor: '#3085d6',
        });
      } finally {
        setDeleteLoading(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const handleCreatePrompt = async () => {
    // Validation
    if (!newPrompt.name.trim() || !newPrompt.secret_value.trim()) {
      MySwal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: 'Name and Prompt Content are required.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    if (!inputPdfFile || !outputPdfFile) {
      MySwal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: 'Both Input PDF and Output PDF files are required.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    setCreateLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Create FormData for multipart/form-data
      const formData = new FormData();
      formData.append('name', newPrompt.name.trim());
      formData.append('description', newPrompt.description.trim());
      formData.append('secret_value', newPrompt.secret_value.trim());
      formData.append('template_type', newPrompt.template_type);
      formData.append('status', newPrompt.status);
      
      // Add optional fields
      if (newPrompt.llm_id !== null && newPrompt.llm_id !== undefined && newPrompt.llm_id !== '') {
        formData.append('llm_id', parseInt(newPrompt.llm_id));
      }
      
      if (newPrompt.chunking_method_id !== null && newPrompt.chunking_method_id !== undefined && newPrompt.chunking_method_id !== '') {
        formData.append('chunking_method_id', parseInt(newPrompt.chunking_method_id));
      }
      
      if (newPrompt.temperature !== null && newPrompt.temperature !== undefined && newPrompt.temperature !== '') {
        formData.append('temperature', parseFloat(newPrompt.temperature));
      }
      
      // Append files
      formData.append('input_pdf', inputPdfFile);
      formData.append('output_pdf', outputPdfFile);
      
      console.log('📤 Creating prompt with files...');
      
      const response = await axios.post(API_BASE_URL, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('✅ Prompt created successfully:', response.data);
      
      MySwal.fire({
        icon: 'success',
        title: 'Success!',
        html: `
          <p>Prompt created successfully!</p>
          ${response.data.templates ? `
            <div style="margin-top: 15px; text-align: left;">
              <p><strong>Template Files:</strong></p>
              <p>Input: <a href="${response.data.templates.input.signedUrl}" target="_blank" style="color: #3085d6;">View PDF</a></p>
              <p>Output: <a href="${response.data.templates.output.signedUrl}" target="_blank" style="color: #3085d6;">View PDF</a></p>
            </div>
          ` : ''}
        `,
        confirmButtonColor: '#3085d6',
        timer: 5000,
      });
      
      // Reset form
      setNewPrompt({
        name: '',
        description: '',
        secret_manager_id: '',
        secret_value: '',
        template_type: 'system',
        status: 'active',
        llm_id: null,
        chunking_method_id: null,
        temperature: null,
      });
      setInputPdfFile(null);
      setOutputPdfFile(null);
      setShowCreateForm(false);
      setShowPromptTable(true);
      fetchPrompts();
    } catch (err) {
      console.error('❌ Error creating prompt:', err);
      console.error('❌ Error response:', err.response?.data);
      MySwal.fire({
        icon: 'error',
        title: 'Error!',
        text: err.response?.data?.error || err.response?.data?.message || 'Failed to create prompt.',
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
      prompt.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchValue.toLowerCase()) ||
      prompt.template_type.toLowerCase().includes(searchValue.toLowerCase())
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

  // Helper function to get chunking method name
  const getChunkingMethodName = (chunkingMethodId) => {
    console.log('🔍 getChunkingMethodName called with:', chunkingMethodId);
    
    if (!chunkingMethodId && chunkingMethodId !== 0) {
      console.log('❌ No chunking method ID provided');
      return 'N/A';
    }
    
    console.log('🔍 Searching in methods:', chunkingMethods);
    console.log('🔍 Total methods available:', chunkingMethods.length);
    
    // Try multiple matching strategies
    const searchId = typeof chunkingMethodId === 'string' ? parseInt(chunkingMethodId, 10) : chunkingMethodId;
    console.log('🔍 Parsed search ID:', searchId, 'Type:', typeof searchId);
    
    // Strategy 1: Exact match
    let method = chunkingMethods.find(m => m.id === searchId);
    console.log('🔍 Strategy 1 (exact match) result:', method);
    
    // Strategy 2: String comparison
    if (!method) {
      method = chunkingMethods.find(m => String(m.id) === String(searchId));
      console.log('🔍 Strategy 2 (string match) result:', method);
    }
    
    // Strategy 3: Number comparison with type conversion
    if (!method) {
      method = chunkingMethods.find(m => {
        const methodId = typeof m.id === 'string' ? parseInt(m.id, 10) : m.id;
        return methodId === searchId;
      });
      console.log('🔍 Strategy 3 (type conversion) result:', method);
    }
    
    const result = method?.name || 'N/A';
    console.log('✅ Final result:', result);
    return result;
  };

  // Color helper functions
  const getStatusColor = (status) => {
    return status === 'Active' ? 'text-green-600' : 'text-yellow-600';
  };

  const getTemplateTypeColor = (type) => {
    const colors = {
      system: 'bg-blue-100 text-blue-800',
      user: 'bg-green-100 text-green-800',
      assistant: 'bg-purple-100 text-purple-800',
      function: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading && !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
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
                <Code className="mr-3 text-gray-800" size={32} />
                Prompt Management System
              </h1>
              <p className="text-gray-600 mt-2">Manage and organize your AI prompts efficiently</p>
            </div>
            {userInfo && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Logged in as</p>
                <p className="font-semibold text-gray-800">{userInfo.name}</p>
                <p className="text-xs text-gray-500">{userInfo.role}</p>
              </div>
            )}
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
                  Create New Prompt
                </button>
                <button
                  onClick={() => setShowCreateLlmModal(true)}
                  className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg"
                >
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Add LLM Model
                </button>
                <button
                  onClick={() => setShowCreateChunkingModal(true)}
                  className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-lg"
                >
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Add Chunking Method
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
              
              <button
                onClick={() => {
                  console.log('=== DEBUG INFO ===');
                  console.log('Chunking Methods:', chunkingMethods);
                  console.log('LLM Models:', llmModels);
                  console.log('Prompts:', prompts);
                  console.log('Sample Prompt IDs:', prompts.map(p => ({ 
                    name: p.name, 
                    chunking_id: p.chunking_method_id,
                    chunking_type: typeof p.chunking_method_id,
                    llm_id: p.llm_id 
                  })));
                  MySwal.fire({
                    icon: 'info',
                    title: 'Debug Info',
                    html: `
                      <div style="text-align: left; font-size: 12px;">
                        <p><strong>Chunking Methods:</strong> ${chunkingMethods.length} loaded</p>
                        <p><strong>LLM Models:</strong> ${llmModels.length} loaded</p>
                        <p><strong>Prompts:</strong> ${prompts.length} loaded</p>
                        <p style="margin-top: 10px;">Check browser console for detailed data</p>
                      </div>
                    `,
                    confirmButtonColor: '#3085d6',
                  });
                }}
                className="inline-flex items-center px-4 py-2.5 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all"
                title="Show debug info in console"
              >
                🔍 Debug
              </button>
            </div>
          </div>
        )}

        {/* Create LLM Modal */}
        {showCreateLlmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Create New LLM Model</h3>
                <button
                  onClick={() => {
                    setShowCreateLlmModal(false);
                    setNewLlmName('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    LLM Model Name
                  </label>
                  <input
                    type="text"
                    value={newLlmName}
                    onChange={(e) => setNewLlmName(e.target.value)}
                    placeholder="e.g., GPT-4, Claude-3, Gemini-Pro"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateLlm}
                    disabled={llmLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {llmLoading ? 'Creating...' : 'Create LLM Model'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateLlmModal(false);
                      setNewLlmName('');
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Chunking Method Modal */}
        {showCreateChunkingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Create New Chunking Method</h3>
                <button
                  onClick={() => {
                    setShowCreateChunkingModal(false);
                    setNewChunkingName('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chunking Method Name
                  </label>
                  <input
                    type="text"
                    value={newChunkingName}
                    onChange={(e) => setNewChunkingName(e.target.value)}
                    placeholder="e.g., Fixed-Size, Semantic, Recursive"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateChunkingMethod}
                    disabled={chunkingLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {chunkingLoading ? 'Creating...' : 'Create Chunking Method'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateChunkingModal(false);
                      setNewChunkingName('');
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Create New Prompt</h2>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setShowPromptTable(true);
                  setNewPrompt({
                    name: '',
                    description: '',
                    secret_manager_id: '',
                    secret_value: '',
                    template_type: 'system',
                    status: 'active',
                    llm_id: null,
                    chunking_method_id: null,
                  });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPrompt.name}
                  onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                  placeholder="Enter prompt name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Type
                </label>
                <select
                  value={newPrompt.template_type}
                  onChange={(e) => setNewPrompt({ ...newPrompt, template_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="system">System</option>
                  <option value="user">User</option>
                  <option value="assistant">Assistant</option>
                  <option value="function">Function</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={newPrompt.status}
                  onChange={(e) => setNewPrompt({ ...newPrompt, status: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LLM Model
                </label>
                <select
                  value={newPrompt.llm_id || ''}
                  onChange={(e) => setNewPrompt({ ...newPrompt, llm_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select LLM Model</option>
                  {llmModels.map(llm => (
                    <option key={llm.id} value={llm.id}>{llm.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chunking Method
                </label>
                <select
                  value={newPrompt.chunking_method_id || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null;
                    console.log('📝 Chunking method selected:', value);
                    console.log('📝 Selected method details:', chunkingMethods.find(m => m.id === value));
                    setNewPrompt({ ...newPrompt, chunking_method_id: value });
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select Chunking Method</option>
                  {chunkingMethods.map(method => (
                    <option key={method.id} value={method.id}>{method.name}</option>
                  ))}
                </select>
                {newPrompt.chunking_method_id && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected ID: {newPrompt.chunking_method_id}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={newPrompt.temperature !== null && newPrompt.temperature !== undefined ? newPrompt.temperature : ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : parseFloat(e.target.value);
                    setNewPrompt({ ...newPrompt, temperature: value });
                  }}
                  placeholder="0.0 - 2.0 (e.g., 0.7)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Controls randomness (0.0 = deterministic, 2.0 = very creative)
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newPrompt.description}
                  onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                  rows={3}
                  placeholder="Enter prompt description"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Input PDF Template <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setInputPdfFile(e.target.files[0])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {inputPdfFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {inputPdfFile.name} ({(inputPdfFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Output PDF Template <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setOutputPdfFile(e.target.files[0])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {outputPdfFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {outputPdfFile.name} ({(outputPdfFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newPrompt.secret_value}
                  onChange={(e) => setNewPrompt({ ...newPrompt, secret_value: e.target.value })}
                  rows={8}
                  placeholder="Enter your prompt content here..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
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
                    Create Prompt
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setShowPromptTable(true);
                  setNewPrompt({
                    name: '',
                    description: '',
                    secret_manager_id: '',
                    secret_value: '',
                    template_type: 'system',
                    status: 'active',
                    llm_id: null,
                    chunking_method_id: null,
                    temperature: null,
                  });
                  setInputPdfFile(null);
                  setOutputPdfFile(null);
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
                        Name
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center">
                        <Hash className="w-4 h-4 mr-2" />
                        Type
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      LLM Model
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Chunking Method
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Usage
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
                          <p className="text-gray-600 font-medium">Loading prompts...</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedPrompts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium text-lg">No prompts found</p>
                        <p className="text-gray-400 text-sm mt-2">
                          {searchValue ? 'Try adjusting your search criteria' : 'Create your first prompt to get started'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedPrompts.map((prompt) => (
                      <tr key={prompt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Key className="w-4 h-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{prompt.name}</div>
                              <div className="text-xs text-gray-500">{prompt.secret_manager_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getTemplateTypeColor(prompt.template_type)}`}>
                            {prompt.template_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getStatusColor(prompt.status)}`}>
                            {prompt.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {prompt.llm_id ? llmModels.find(llm => llm.id === prompt.llm_id)?.name || 'N/A' : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">
                              {getChunkingMethodName(prompt.chunking_method_id)}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {prompt.chunking_method_id !== null && prompt.chunking_method_id !== undefined ? 
                                `${prompt.chunking_method_id} (${typeof prompt.chunking_method_id})` : 
                                'null'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {prompt.usageCount} uses
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
                    {selectedPrompt.value && (
                      <button
                        onClick={() => handleCopyToClipboard(selectedPrompt.value)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Content
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Prompt Details</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editedPrompt.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-gray-900">{selectedPrompt.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secret Manager ID</label>
                  <p className="text-sm text-gray-900 font-mono">{selectedPrompt.secret_manager_id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Type</label>
                  {editMode ? (
                    <select
                      value={editedPrompt.template_type}
                      onChange={(e) => handleInputChange('template_type', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                    >
                      <option value="system">System</option>
                      <option value="user">User</option>
                      <option value="assistant">Assistant</option>
                      <option value="function">Function</option>
                    </select>
                  ) : (
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getTemplateTypeColor(selectedPrompt.template_type)}`}>
                      {selectedPrompt.template_type}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {editMode ? (
                    <select
                      value={editedPrompt.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                    >
                      <option value="Active">Active</option>
                      <option value="Draft">Draft</option>
                    </select>
                  ) : (
                    <span className={`text-sm font-medium ${getStatusColor(selectedPrompt.status)}`}>
                      {selectedPrompt.status}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                  <p className="text-sm text-gray-900">{selectedPrompt.version || 'Not available'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LLM Model</label>
                  {editMode ? (
                    <select
                      value={editedPrompt.llm_id || ''}
                      onChange={(e) => handleInputChange('llm_id', e.target.value ? parseInt(e.target.value) : null)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                    >
                      <option value="">Select LLM Model</option>
                      {llmModels.map(llm => (
                        <option key={llm.id} value={llm.id}>{llm.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-900">
                      {selectedPrompt.llm_id ? llmModels.find(llm => llm.id === selectedPrompt.llm_id)?.name || 'N/A' : 'N/A'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chunking Method</label>
                  {editMode ? (
                    <div>
                      <select
                        value={editedPrompt.chunking_method_id || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : null;
                          console.log('✏️ Editing - Chunking method changed to:', value);
                          console.log('✏️ Selected method details:', chunkingMethods.find(m => m.id === value));
                          handleInputChange('chunking_method_id', value);
                        }}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-medium"
                      >
                        <option value="">Select Chunking Method</option>
                        {chunkingMethods.map(method => (
                          <option key={method.id} value={method.id}>{method.name}</option>
                        ))}
                      </select>
                      {editedPrompt.chunking_method_id && (
                        <p className="text-xs text-gray-500 mt-1">
                          Selected ID: {editedPrompt.chunking_method_id}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900">
                      {getChunkingMethodName(selectedPrompt.chunking_method_id)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                  {editMode ? (
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={editedPrompt.temperature !== null && editedPrompt.temperature !== undefined ? editedPrompt.temperature : ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value);
                          handleInputChange('temperature', value);
                        }}
                        placeholder="0.0 - 2.0 (e.g., 0.7)"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Controls randomness (0.0 = deterministic, 2.0 = very creative)
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900">
                      {selectedPrompt.temperature !== null && selectedPrompt.temperature !== undefined 
                        ? selectedPrompt.temperature 
                        : 'Not set'}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Usage & Metadata</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  {editMode ? (
                    <textarea
                      value={editedPrompt.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-medium"
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{selectedPrompt.description}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage Count</label>
                  <p className="text-sm text-gray-900">{selectedPrompt.usageCount} times used</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Success Rate</label>
                  <p className="text-sm text-gray-900">{selectedPrompt.successRate}%</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avg Processing Time</label>
                  <p className="text-sm text-gray-900">{selectedPrompt.avgProcessingTime}ms</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-600" />
                    <span className="text-sm text-gray-900">{selectedPrompt.createdBy}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                    <span className="text-sm text-gray-900">{selectedPrompt.createdAt}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Used</label>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                    <span className="text-sm text-gray-900">{selectedPrompt.lastUsed}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Files Section */}
            {selectedPrompt.templates && (selectedPrompt.templates.input || selectedPrompt.templates.output) && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Template Files</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedPrompt.templates.input && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold text-gray-700">Input Template</h5>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">Input</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{selectedPrompt.templates.input.originalFilename}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setPdfModalUrl(selectedPrompt.templates.input.signedUrl);
                            setPdfModalTitle(`Input Template: ${selectedPrompt.templates.input.originalFilename}`);
                            setPdfModalOpen(true);
                          }}
                          className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View PDF
                        </button>
                        {selectedPrompt.templates.input.extraction && (
                          <button
                            onClick={() => {
                              setRawResponseData(selectedPrompt.templates.input.extraction);
                              setRawResponseTitle(`Input Template - Structured Schema: ${selectedPrompt.templates.input.originalFilename}`);
                              setShowMappedSchema(true);
                              setRawResponseModalOpen(true);
                            }}
                            className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                            title="View structured JSON schema formatted for LLM"
                          >
                            <Code className="w-4 h-4 mr-2" />
                            View Schema
                          </button>
                        )}
                      </div>
                      {selectedPrompt.templates.input.expiresAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          Expires: {new Date(selectedPrompt.templates.input.expiresAt).toLocaleString()}
                        </p>
                      )}
                      {selectedPrompt.templates.input.extraction && (
                        <div className="mt-2 text-xs text-gray-600">
                          <p>Extracted: {selectedPrompt.templates.input.extraction.totalCharacters} chars, {selectedPrompt.templates.input.extraction.totalWords} words</p>
                          <p>Pages: {selectedPrompt.templates.input.extraction.pageCount}</p>
                          {selectedPrompt.templates.input.extraction.confidenceScore && (
                            <p>Confidence: {(selectedPrompt.templates.input.extraction.confidenceScore * 100).toFixed(1)}%</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedPrompt.templates.output && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold text-gray-700">Output Template</h5>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">Output</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{selectedPrompt.templates.output.originalFilename}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setPdfModalUrl(selectedPrompt.templates.output.signedUrl);
                            setPdfModalTitle(`Output Template: ${selectedPrompt.templates.output.originalFilename}`);
                            setPdfModalOpen(true);
                          }}
                          className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View PDF
                        </button>
                        {selectedPrompt.templates.output.extraction && (
                          <button
                            onClick={() => {
                              setRawResponseData(selectedPrompt.templates.output.extraction);
                              setRawResponseTitle(`Output Template - Structured Schema: ${selectedPrompt.templates.output.originalFilename}`);
                              setShowMappedSchema(true);
                              setRawResponseModalOpen(true);
                            }}
                            className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                            title="View structured JSON schema formatted for LLM"
                          >
                            <Code className="w-4 h-4 mr-2" />
                            View Schema
                          </button>
                        )}
                      </div>
                      {selectedPrompt.templates.output.expiresAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          Expires: {new Date(selectedPrompt.templates.output.expiresAt).toLocaleString()}
                        </p>
                      )}
                      {selectedPrompt.templates.output.extraction && (
                        <div className="mt-2 text-xs text-gray-600">
                          <p>Extracted: {selectedPrompt.templates.output.extraction.totalCharacters} chars, {selectedPrompt.templates.output.extraction.totalWords} words</p>
                          <p>Pages: {selectedPrompt.templates.output.extraction.pageCount}</p>
                          {selectedPrompt.templates.output.extraction.confidenceScore && (
                            <p>Confidence: {(selectedPrompt.templates.output.extraction.confidenceScore * 100).toFixed(1)}%</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">Prompt Content</h4>
                {selectedPrompt.value ? (
                  <div className="flex items-center text-green-600">
                    <Unlock className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">Secret Loaded</span>
                  </div>
                ) : (
                  <div className="flex items-center text-gray-500">
                    <Lock className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">Secret Protected</span>
                  </div>
                )}
              </div>
              
              {selectedPrompt.value ? (
                editMode ? (
                  <textarea
                    value={editedPrompt.value || ''}
                    onChange={(e) => handleInputChange('value', e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder="Enter prompt content..."
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap border">
                    {selectedPrompt.value}
                  </div>
                )
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center">
                  <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Prompt content is secured and not loaded yet.</p>
                  <button
                    onClick={() => fetchSecretValue(selectedPrompt.id)}
                    disabled={fetchValueLoading[selectedPrompt.id]}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {fetchValueLoading[selectedPrompt.id] ? 'Loading...' : (
                      <>
                        <Unlock className="w-4 h-4 mr-2" />
                        Load Secret Content
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PDF Preview Modal */}
        {pdfModalOpen && pdfModalUrl && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
            onClick={() => setPdfModalOpen(false)}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border-2 border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">{pdfModalTitle}</h3>
                <button
                  onClick={() => setPdfModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* PDF Viewer */}
              <div className="flex-1 overflow-hidden">
                <iframe
                  src={pdfModalUrl}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                  allow="fullscreen"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                <a
                  href={pdfModalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Open in New Tab
                </a>
                <button
                  onClick={() => setPdfModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Raw Response Modal */}
        {rawResponseModalOpen && rawResponseData && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
            onClick={() => setRawResponseModalOpen(false)}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border-2 border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">{rawResponseTitle}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowMappedSchema(!showMappedSchema)}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {showMappedSchema ? 'Show Raw Response' : 'Show Mapped Schema'}
                  </button>
                  <button
                    onClick={() => setRawResponseModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                    aria-label="Close modal"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6 bg-gray-50">
                {showMappedSchema && (rawResponseData.structuredSchema || rawResponseData.mappedSchema) ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700">Structured Legal Summary Schema (JSON)</h4>
                        <p className="text-xs text-gray-500 mt-1">Formatted for LLM consumption with clean structure</p>
                      </div>
                      <button
                        onClick={() => {
                          const schemaToCopy = rawResponseData.structuredSchema || rawResponseData.mappedSchema;
                          navigator.clipboard.writeText(JSON.stringify(schemaToCopy, null, 2));
                          MySwal.fire({
                            icon: 'success',
                            title: 'Copied!',
                            text: 'Structured schema copied to clipboard',
                            timer: 2000,
                            showConfirmButton: false,
                          });
                        }}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy JSON
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap break-words bg-gray-50 p-4 rounded border">
                      {JSON.stringify(rawResponseData.structuredSchema || rawResponseData.mappedSchema, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700">Document AI Raw Response (Text)</h4>
                      <button
                        onClick={() => {
                          const dataToCopy = typeof rawResponseData.rawResponse === 'string' 
                            ? rawResponseData.rawResponse 
                            : (rawResponseData.rawResponse || rawResponseData);
                          const textToCopy = typeof dataToCopy === 'string' 
                            ? dataToCopy 
                            : JSON.stringify(dataToCopy, null, 2);
                          navigator.clipboard.writeText(textToCopy);
                          MySwal.fire({
                            icon: 'success',
                            title: 'Copied!',
                            text: 'Text copied to clipboard',
                            timer: 2000,
                            showConfirmButton: false,
                          });
                        }}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Text
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap break-words">
                      {typeof rawResponseData.rawResponse === 'string' 
                        ? rawResponseData.rawResponse 
                        : (rawResponseData.rawResponse ? JSON.stringify(rawResponseData.rawResponse, null, 2) : 'No data available')}
                    </pre>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-600">
                  <p>
                    {showMappedSchema && (rawResponseData.structuredSchema || rawResponseData.mappedSchema)
                      ? 'Structured JSON schema formatted for LLM consumption - clean, organized data ready for processing' 
                      : 'Document AI extracted text only (no pixel/image data)'}
                  </p>
                </div>
                <button
                  onClick={() => setRawResponseModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptManagement;
