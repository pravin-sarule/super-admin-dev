
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, LayoutList, Grid } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

import TemplateList from './TemplateList';
import UploadModal from './UploadTemplateModal';
import TemplateDetailsModal from './TemplateDetailsModal';

const MySwal = withReactContent(Swal);

// Template Management Component
const TemplateManagement = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Details Modal State
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('sections'); // 'sections' or 'fields'
    const [editedFields, setEditedFields] = useState(''); // JSON string for editing

    // Section Editing State
    const [isEditingSections, setIsEditingSections] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        subcategory: '',
        description: '',
        file: null,
        image: null
    });

    // API Config – Template Analyzer Agent (Cloud Run default, overridable by env)
    const ANALYSIS_API_URL = import.meta.env?.VITE_ANALYSIS_API_URL || 'https://template-analyzer-agent-120280829617.asia-south1.run.app/analysis';

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            // Token from localStorage: agent uses it to return admin-only (user_id IS NULL) or user-only templates
            const response = await axios.get(`${ANALYSIS_API_URL}/templates`, {
                headers: getAuthHeaders()
            });
            setTemplates(response.data);
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (templateId) => {
        setShowDetailsModal(true);
        setDetailsLoading(true);
        setActiveTab('sections');
        try {
            const response = await axios.get(`${ANALYSIS_API_URL}/template/${templateId}`, {
                headers: getAuthHeaders()
            });
            setSelectedTemplate(response.data);
            // Format fields JSON for editing
            setEditedFields(JSON.stringify(response.data.fields, null, 2));
            setIsEditingSections(false); // Reset edit mode on open
        } catch (error) {
            console.error('Error fetching details:', error);
            MySwal.fire('Error', 'Failed to load template details.', 'error');
            setShowDetailsModal(false);
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleUpdateFields = async () => {
        try {
            const parsedFields = JSON.parse(editedFields);
            await axios.put(`${ANALYSIS_API_URL}/template/${selectedTemplate.template.id}/fields`, {
                template_fields: parsedFields
            }, { headers: getAuthHeaders() });
            MySwal.fire('Success', 'Template fields updated successfully.', 'success');
            // Refresh details
            handleViewDetails(selectedTemplate.template.id);
        } catch (error) {
            console.error('Update error:', error);
            MySwal.fire('Error', 'Invalid JSON or update failed.', 'error');
        }
    };

    // --- Section Editing Handlers ---
    const handleSectionChange = (idx, field, value) => {
        const updatedSections = [...selectedTemplate.sections];
        updatedSections[idx][field] = value;
        setSelectedTemplate(prev => ({ ...prev, sections: updatedSections }));
    };

    const handlePromptChange = (sectionIdx, promptIdx, field, value) => {
        const updatedSections = [...selectedTemplate.sections];
        updatedSections[sectionIdx].section_prompts[promptIdx][field] = value;
        setSelectedTemplate(prev => ({ ...prev, sections: updatedSections }));
    };

    const handleAddPrompt = (sectionIdx) => {
        const updatedSections = [...selectedTemplate.sections];
        if (!updatedSections[sectionIdx].section_prompts) {
            updatedSections[sectionIdx].section_prompts = [];
        }
        updatedSections[sectionIdx].section_prompts.push({ prompt: '', field_id: '' });
        setSelectedTemplate(prev => ({ ...prev, sections: updatedSections }));
    };

    const handleRemovePrompt = (sectionIdx, promptIdx) => {
        const updatedSections = [...selectedTemplate.sections];
        updatedSections[sectionIdx].section_prompts.splice(promptIdx, 1);
        setSelectedTemplate(prev => ({ ...prev, sections: updatedSections }));
    };

    const handleSaveSections = async (sectionsToSave) => {
        try {
            // If sectionsToSave is passed (e.g. from single section save), use it. 
            // Otherwise use all sections from state.
            // But wait, if we pass sectionsToSave, we must ensure it's an array.
            // Also, if we are saving specific sections, we typically want to send just those to the backend 
            // (assuming backend supports partial update of the LIST, which it does - it iterates and upserts).

            // However, the event handler in SectionsTab might pass an event object if we aren't careful.
            // So we check if sectionsToSave is an array or has data.

            let payloadSections = selectedTemplate.sections;
            if (sectionsToSave && Array.isArray(sectionsToSave)) {
                payloadSections = sectionsToSave;
            }

            await axios.put(`${ANALYSIS_API_URL}/template/${selectedTemplate.template.id}/sections`, {
                sections: payloadSections
            }, { headers: getAuthHeaders() });

            MySwal.fire('Success', 'Section(s) updated successfully.', 'success');
            setIsEditingSections(false);

            // Refresh to ensure data sync (especially IDs if new)
            handleViewDetails(selectedTemplate.template.id);
        } catch (error) {
            console.error('Update Sections Error:', error);
            MySwal.fire('Error', 'Failed to update sections.', 'error');
        }
    };

    const handleDeleteSection = async (sectionId) => {
        const result = await MySwal.fire({
            title: 'Delete this section?',
            text: "This cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`${ANALYSIS_API_URL}/template/${selectedTemplate.template.id}/section/${sectionId}`, {
                    headers: getAuthHeaders()
                });
                // Optimistically update UI
                const updatedSections = selectedTemplate.sections.filter(s => s.id !== sectionId);
                setSelectedTemplate(prev => ({ ...prev, sections: updatedSections }));
                MySwal.fire('Deleted!', 'Section has been removed.', 'success');
            } catch (error) {
                console.error('Delete section error:', error);
                MySwal.fire('Error', 'Failed to delete section.', 'error');
            }
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const { name, files } = e.target;
        if (files && files[0]) {
            setFormData(prev => ({ ...prev, [name]: files[0] }));
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!formData.file || !formData.name || !formData.category) {
            MySwal.fire({
                icon: 'warning',
                title: 'Missing Fields',
                text: 'Please fill in Name, Category and select a Template File.'
            });
            return;
        }

        setIsUploading(true);
        const uploadData = new FormData();
        uploadData.append('name', formData.name);
        uploadData.append('category', formData.category);
        uploadData.append('subcategory', formData.subcategory || '');
        uploadData.append('description', formData.description || '');
        uploadData.append('file', formData.file);
        if (formData.image) {
            uploadData.append('image', formData.image);
        }

        // Append user_id from token as fallback (analyzer agent prefers user_id from Bearer token)
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token) {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const decoded = JSON.parse(jsonPayload);
                const userId = decoded.id || decoded.userId || decoded.user_id;
                if (userId) uploadData.append('user_id', userId);
            }
        } catch (error) {
            console.error('Error extracting user_id from token:', error);
        }

        try {
            // Step 1: Upload & start background analysis (returns immediately)
            const response = await axios.post(`${ANALYSIS_API_URL}/upload-template`, uploadData, {
                headers: { 'Content-Type': 'multipart/form-data', ...getAuthHeaders() },
                timeout: 120000  // 2 min for OCR + GCS upload only
            });

            const templateId = response.data.template_id;
            if (!templateId) throw new Error('No template_id returned from server.');

            // Step 2: Close modal, refresh list (shows the template as "processing")
            setShowUploadModal(false);
            setFormData({ name: '', category: '', subcategory: '', description: '', file: null, image: null });
            fetchTemplates();

            // Step 3: Poll for completion in background
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await axios.get(`${ANALYSIS_API_URL}/template/${templateId}/status`, {
                        headers: getAuthHeaders()
                    });
                    const { status, sections_ready } = statusRes.data;

                    if (status === 'active') {
                        clearInterval(pollInterval);
                        setIsUploading(false);
                        fetchTemplates();
                        MySwal.fire({
                            icon: 'success',
                            title: 'Analysis Complete!',
                            text: `Template processed with ${sections_ready} sections ready.`,
                            timer: 3000,
                            showConfirmButton: false
                        });
                    } else if (status === 'error') {
                        clearInterval(pollInterval);
                        setIsUploading(false);
                        MySwal.fire({
                            icon: 'warning',
                            title: 'Analysis Issue',
                            text: 'Template was saved but AI analysis encountered an error. You can still use it.',
                        });
                        fetchTemplates();
                    }
                } catch {
                    // Polling errors are non-fatal, keep trying
                }
            }, 8000); // Poll every 8 seconds

            // Safety: stop polling after 15 minutes
            setTimeout(() => {
                clearInterval(pollInterval);
                setIsUploading(false);
                fetchTemplates();
            }, 900000);

        } catch (error) {
            console.error('Upload error:', error);
            setIsUploading(false);
            MySwal.fire({
                icon: 'error',
                title: 'Upload Failed',
                text: error.response?.data?.detail || 'Something went wrong.'
            });
        }
    };

    const handleDelete = async (id) => {
        const result = await MySwal.fire({
            title: 'Are you sure?',
            text: "This will permanently delete the template.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`${ANALYSIS_API_URL}/template/${id}`, {
                    headers: getAuthHeaders()
                });
                setTemplates(templates.filter(t => t.id !== id));
                MySwal.fire('Deleted!', 'Template has been removed.', 'success');
            } catch (error) {
                MySwal.fire('Error', 'Failed to delete template.', 'error');
            }
        }
    };

    const filteredTemplates = useMemo(() => {
        return templates.filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [templates, searchTerm]);

    return (
        <div className="p-6 bg-[#f8fafc] min-h-screen font-outfit">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Template Management</h1>
                    <p className="text-gray-500 mt-2 text-lg">AI-powered document analysis and template organization</p>
                </div>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                    <Plus size={20} />
                    Create Template
                </button>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('table')}
                        className={`p-3 rounded-xl transition-colors ${viewMode === 'table' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <LayoutList size={20} />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-3 rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <Grid size={20} />
                    </button>
                </div>
            </div>

            {/* Content Display */}
            <TemplateList
                templates={filteredTemplates}
                loading={loading}
                viewMode={viewMode}
                handleViewDetails={handleViewDetails}
                handleDelete={handleDelete}
            />

            {/* DETAILS MODAL */}
            <TemplateDetailsModal
                showDetailsModal={showDetailsModal}
                setShowDetailsModal={setShowDetailsModal}
                detailsLoading={detailsLoading}
                selectedTemplate={selectedTemplate}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                handleViewDetails={handleViewDetails}
                handleUpdateFields={handleUpdateFields}
                editedFields={editedFields}
                setEditedFields={setEditedFields}
                handleSectionChange={handleSectionChange}
                handlePromptChange={handlePromptChange}
                handleAddPrompt={handleAddPrompt}
                handleRemovePrompt={handleRemovePrompt}
                handleSaveSections={handleSaveSections}
                isEditingSections={isEditingSections}
                setIsEditingSections={setIsEditingSections}
                handleDeleteSection={handleDeleteSection}
                analysisApiUrl={ANALYSIS_API_URL}
                getAuthHeaders={getAuthHeaders}
            />

            {/* Upload Modal */}
            <UploadModal
                showUploadModal={showUploadModal}
                setShowUploadModal={setShowUploadModal}
                isUploading={isUploading}
                handleUpload={handleUpload}
                formData={formData}
                handleInputChange={handleInputChange}
                handleFileChange={handleFileChange}
            />

            {/* Tailwind Animations for Progress - Global style injection */}
            <style>{`
        @keyframes progress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(0.95); }
        }
        .animate-progress {
          animation: progress 30s cubic-bezier(0.1, 0, 0.4, 1) infinite;
        }
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}</style>
        </div>
    );
};

export default TemplateManagement;
