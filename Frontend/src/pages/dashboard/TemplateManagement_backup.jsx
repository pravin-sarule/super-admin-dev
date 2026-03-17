import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText, Upload, Plus, Trash2, Search, Filter,
    ChevronLeft, ChevronRight, Image as ImageIcon,
    CheckCircle, AlertCircle, Loader2, X, Eye, LayoutList, Grid, Save, Edit3
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

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

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        subcategory: '',
        description: '',
        file: null,
        image: null
    });

    // API Config
    const ANALYSIS_API_URL = 'https://template-analyzer-agent-120280829617.asia-south1.run.app/analysis';

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${ANALYSIS_API_URL}/templates`);
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
            const response = await axios.get(`${ANALYSIS_API_URL}/template/${templateId}`);
            setSelectedTemplate(response.data);
            // Format fields JSON for editing
            setEditedFields(JSON.stringify(response.data.fields, null, 2));
        } catch (error) {
            console.error('Error fetching details:', error);
            MySwal.fire('Error', 'Failed to load template details.', 'error');
            setShowDetailsModal(false);
        } finally {
            setDetailsLoading(false);
        }
    };

    const [isEditingSections, setIsEditingSections] = useState(false);

    const handleUpdateFields = async () => {
        try {
            const parsedFields = JSON.parse(editedFields);
            await axios.put(`${ANALYSIS_API_URL}/template/${selectedTemplate.template.id}/fields`, {
                template_fields: parsedFields
            });
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

    const handleSaveSections = async () => {
        try {
            // Validate required fields if necessary
            await axios.put(`${ANALYSIS_API_URL}/template/${selectedTemplate.template.id}/sections`, {
                sections: selectedTemplate.sections
            });
            MySwal.fire('Success', 'Sections updated successfully.', 'success');
            setIsEditingSections(false);
            // Optionally refresh to ensure data sync
            handleViewDetails(selectedTemplate.template.id);
        } catch (error) {
            console.error('Update Sections Error:', error);
            MySwal.fire('Error', 'Failed to update sections.', 'error');
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

        try {
            const response = await axios.post(`${ANALYSIS_API_URL}/upload-template`, uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000
            });

            if (response.data.status === 'success') {
                MySwal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Template uploaded and processed successfully.',
                    timer: 3000
                });
                setShowUploadModal(false);
                setFormData({ name: '', category: '', subcategory: '', description: '', file: null, image: null });
                fetchTemplates();
            }
        } catch (error) {
            console.error('Upload error:', error);
            MySwal.fire({
                icon: 'error',
                title: 'Upload Failed',
                text: error.response?.data?.detail || 'Something went wrong.'
            });
        } finally {
            setIsUploading(false);
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
                await axios.delete(`${ANALYSIS_API_URL}/template/${id}`);
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
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
                    <p className="text-gray-500 font-medium">Fetching templates...</p>
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-20 text-gray-500">No templates found.</div>
            ) : viewMode === 'table' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 font-semibold text-sm uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Template Name</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Language</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTemplates.map((template) => (
                                <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                            {template.image_url ? (
                                                <img src={template.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                                            ) : (
                                                <FileText size={20} />
                                            )}
                                        </div>
                                        {template.name}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{template.category}</td>
                                    <td className="px-6 py-4 text-gray-600 capitalize">{template.language}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 uppercase">
                                            {template.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleViewDetails(template.id)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="View Details"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(template.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map(template => (
                        <div key={template.id} className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-all hover:-translate-y-1">
                            {/* Card Content ... (Keep existing card design if needed, simplified here) */}
                            <div className="h-40 bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
                                {template.image_url ? (
                                    <img src={template.image_url} alt={template.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-white/20">
                                        <FileText size={80} />
                                    </div>
                                )}
                                <div className="absolute top-4 right-4">
                                    <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-white/30">
                                        {template.category}
                                    </span>
                                </div>
                            </div>
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-2 truncate">{template.name}</h3>
                                <div className="flex justify-between mt-4">
                                    <button onClick={() => handleViewDetails(template.id)} className="text-indigo-600 font-semibold text-sm hover:underline">View Details</button>
                                    <button onClick={() => handleDelete(template.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* DETAILS MODAL */}
            {showDetailsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowDetailsModal(false)}></div>
                    <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] shadow-2xl relative overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-2xl font-extrabold text-gray-900">
                                    {selectedTemplate?.template?.name || 'Template Details'}
                                </h2>
                                <p className="text-gray-500 text-sm mt-1">{selectedTemplate?.template?.id}</p>
                            </div>
                            <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-400">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            {detailsLoading ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <Loader2 className="animate-spin text-indigo-500" size={48} />
                                </div>
                            ) : (
                                <>
                                    {/* Tabs */}
                                    <div className="flex border-b border-gray-200 px-6">
                                        <button
                                            onClick={() => setActiveTab('sections')}
                                            className={`px-6 py-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'sections' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <LayoutList size={18} />
                                                Prompts & Sections
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('fields')}
                                            className={`px-6 py-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'fields' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Grid size={18} />
                                                Variables & Fields
                                            </div>
                                        </button>
                                    </div>

                                    {/* Tab Content */}
                                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                                        {activeTab === 'sections' && (
                                            <div className="space-y-6 max-w-5xl mx-auto">
                                                {selectedTemplate?.sections?.length > 0 ? (
                                                    selectedTemplate.sections.map((section, idx) => (
                                                        <div key={section.id || idx} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-50">
                                                                <div className="flex items-center gap-4">
                                                                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <div>
                                                                        <h3 className="text-lg font-bold text-gray-900 leading-tight">{section.section_name}</h3>
                                                                        {section.section_purpose && (
                                                                            <p className="text-xs text-gray-500 mt-1">{section.section_purpose}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {section.section_intro && (
                                                                    <div className="px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-100 w-1/3">
                                                                        <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">AI Intro</span>
                                                                        <p className="text-sm text-indigo-900 italic">"{section.section_intro}"</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="space-y-3">
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">User Prompts</h4>
                                                                {section.section_prompts && section.section_prompts.length > 0 ? (
                                                                    <div className="grid gap-3">
                                                                        {section.section_prompts.map((prompt, pIdx) => (
                                                                            <div key={pIdx} className="group flex items-start gap-4 p-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-white hover:border-indigo-200 transition-colors">
                                                                                <div className="mt-1">
                                                                                    <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <p className="text-gray-800 font-medium">{prompt.prompt}</p>
                                                                                    {prompt.field_id && (
                                                                                        <p className="text-xs text-gray-400 font-mono mt-1">Ref: {prompt.field_id}</p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-4 bg-gray-50 rounded-lg text-gray-400 italic">
                                                                        No specific prompts generated for this section.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-20">
                                                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                                            <LayoutList className="text-gray-400" size={32} />
                                                        </div>
                                                        <h3 className="text-lg font-bold text-gray-700">No Sections Found</h3>
                                                        <p className="text-gray-500">The AI didn't return any structured sections for this template.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'fields' && (
                                            <div className="max-w-6xl mx-auto">
                                                {/* Fields Visualization */}
                                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                                                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                                            <Grid size={18} className="text-indigo-600" />
                                                            Extracted Variables
                                                        </h3>
                                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">
                                                            JSON Source
                                                        </span>
                                                    </div>

                                                    {/* If fields exist, try to render a table, else show raw JSON or Empty */}
                                                    {selectedTemplate?.fields?.sections ? (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm text-left">
                                                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                                                    <tr>
                                                                        <th className="px-6 py-3 font-medium">Variable Name (Key)</th>
                                                                        <th className="px-6 py-3 font-medium">Label</th>
                                                                        <th className="px-6 py-3 font-medium">Type</th>
                                                                        <th className="px-6 py-3 font-medium text-center">Required</th>
                                                                        <th className="px-6 py-3 font-medium">Description</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {selectedTemplate.fields.sections.flatMap(s => s.fields || []).map((field, fIdx) => (
                                                                        <tr key={field.key || field.id || fIdx} className="hover:bg-indigo-50/30 transition-colors">
                                                                            <td className="px-6 py-3 font-mono text-indigo-600 font-medium">
                                                                                {field.key || field.id || 'N/A'}
                                                                            </td>
                                                                            <td className="px-6 py-3 text-gray-900 font-medium">
                                                                                {field.label}
                                                                            </td>
                                                                            <td className="px-6 py-3">
                                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                                                                                    ${field.type === 'date' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                                        field.type === 'currency' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                                            field.type === 'number' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                                                                'bg-gray-100 text-gray-800 border-gray-200'}`}>
                                                                                    {field.type}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-6 py-3 text-center">
                                                                                {field.required ? (
                                                                                    <CheckCircle size={16} className="text-green-500 mx-auto" />
                                                                                ) : (
                                                                                    <span className="text-gray-300">-</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-6 py-3 text-gray-500 max-w-xs truncate">
                                                                                {field.description || '-'}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="p-8 text-center text-gray-500 italic">
                                                            No structured field definitions found.
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Raw JSON Editor (Collapsible or Secondary) */}
                                                <div className="mt-8">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Advanced: Edit Schema (JSON)</label>
                                                        <button
                                                            onClick={handleUpdateFields}
                                                            className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                                                        >
                                                            <Save size={16} />
                                                            Apply JSON Changes
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        className="w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs p-4 rounded-xl shadow-inner focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-64 leading-relaxed"
                                                        value={editedFields}
                                                        onChange={(e) => setEditedFields(e.target.value)}
                                                        spellCheck="false"
                                                    ></textarea>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Modal - (Kept same as before but hidden state managed) */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => !isUploading && setShowUploadModal(false)}></div>
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-3xl font-extrabold text-gray-900">Upload Template</h2>
                                    <p className="text-gray-500 mt-1">Our Document AI will process your file in parallel.</p>
                                </div>
                                {!isUploading && (
                                    <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                                        <X size={24} />
                                    </button>
                                )}
                            </div>

                            <form onSubmit={handleUpload} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">Template Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            placeholder="e.g. Master Service Agreement"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            disabled={isUploading}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">Category</label>
                                        <select
                                            name="category"
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                                            value={formData.category}
                                            onChange={handleInputChange}
                                            disabled={isUploading}
                                        >
                                            <option value="">Select Category</option>
                                            <option value="Legal">Legal</option>
                                            <option value="HR">HR</option>
                                            <option value="Finance">Finance</option>
                                            <option value="Sales">Sales</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">Subcategory</label>
                                    <input
                                        type="text"
                                        name="subcategory"
                                        placeholder="e.g. Employment Contract"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={formData.subcategory}
                                        onChange={handleInputChange}
                                        disabled={isUploading}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">Description</label>
                                    <textarea
                                        name="description"
                                        rows="3"
                                        placeholder="Describe the purpose of this template..."
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        disabled={isUploading}
                                    ></textarea>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">Template File (PDF/TXT)</label>
                                        <div className="relative group/file">
                                            <input
                                                type="file"
                                                name="file"
                                                accept=".pdf,.txt"
                                                className="hidden"
                                                id="template-file"
                                                onChange={handleFileChange}
                                                disabled={isUploading}
                                            />
                                            <label
                                                htmlFor="template-file"
                                                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all ${formData.file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                                                    }`}
                                            >
                                                {formData.file ? (
                                                    <>
                                                        <CheckCircle className="text-green-500 mb-2" size={32} />
                                                        <span className="text-sm font-medium text-green-700 truncate w-full text-center px-4">{formData.file.name}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="text-gray-400 mb-2 group-hover/file:text-indigo-500 transition-colors" size={32} />
                                                        <span className="text-sm font-medium text-gray-500">Pick a PDF/Text file</span>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">Cover Image (Optional)</label>
                                        <div className="relative group/img">
                                            <input
                                                type="file"
                                                name="image"
                                                accept="image/*"
                                                className="hidden"
                                                id="template-image"
                                                onChange={handleFileChange}
                                                disabled={isUploading}
                                            />
                                            <label
                                                htmlFor="template-image"
                                                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all ${formData.image ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                                                    }`}
                                            >
                                                {formData.image ? (
                                                    <>
                                                        <ImageIcon className="text-indigo-500 mb-2" size={32} />
                                                        <span className="text-sm font-medium text-indigo-700 truncate w-full text-center px-4">{formData.image.name}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ImageIcon className="text-gray-400 mb-2 group-hover/img:text-indigo-500 transition-colors" size={32} />
                                                        <span className="text-sm font-medium text-gray-500">Pick an image</span>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 mt-6">
                                    <button
                                        type="submit"
                                        disabled={isUploading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={24} />
                                                Processing via Document AI...
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={24} />
                                                Analyze & Create Template
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                        {isUploading && (
                            <div className="h-2 bg-gray-100 overflow-hidden">
                                <div className="h-full bg-indigo-500 animate-progress origin-left"></div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tailwind Animations for Progress */}
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
