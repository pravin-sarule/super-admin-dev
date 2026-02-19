
// import React from 'react';
// import { LayoutList, Grid, Loader2, X } from 'lucide-react';
// import SectionsTab from './SectionsTab';
// import FieldsTab from './FieldsTab';

// const TemplateDetailsModal = ({
//     showDetailsModal,
//     setShowDetailsModal,
//     detailsLoading,
//     selectedTemplate,
//     activeTab,
//     setActiveTab,
//     handleViewDetails,
//     handleUpdateFields,
//     editedFields,
//     setEditedFields,
//     handleSectionChange,
//     handlePromptChange,
//     handleAddPrompt,
//     handleRemovePrompt,
//     handleSaveSections,
//     isEditingSections,
//     setIsEditingSections,
//     handleDeleteSection
// }) => {
//     if (!showDetailsModal) return null;

//     return (
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
//             <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowDetailsModal(false)}></div>
//             <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] shadow-2xl relative overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
//                 {/* Modal Header */}
//                 <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
//                     <div>
//                         <h2 className="text-2xl font-extrabold text-gray-900">
//                             {selectedTemplate?.template?.name || 'Template Details'}
//                         </h2>
//                         <p className="text-gray-500 text-sm mt-1">{selectedTemplate?.template?.id}</p>
//                     </div>
//                     <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-400">
//                         <X size={24} />
//                     </button>
//                 </div>

//                 {/* Modal Content */}
//                 <div className="flex-1 overflow-hidden flex flex-col">
//                     {detailsLoading ? (
//                         <div className="flex-1 flex items-center justify-center">
//                             <Loader2 className="animate-spin text-indigo-500" size={48} />
//                         </div>
//                     ) : (
//                         <>
//                             {/* Tabs */}
//                             <div className="flex border-b border-gray-200 px-6">
//                                 <button
//                                     onClick={() => setActiveTab('sections')}
//                                     className={`px-6 py-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'sections' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
//                                 >
//                                     <div className="flex items-center gap-2">
//                                         <LayoutList size={18} />
//                                         Prompts & Sections
//                                     </div>
//                                 </button>
//                                 <button
//                                     onClick={() => setActiveTab('fields')}
//                                     className={`px-6 py-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'fields' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
//                                 >
//                                     <div className="flex items-center gap-2">
//                                         <Grid size={18} />
//                                         Variables & Fields
//                                     </div>
//                                 </button>
//                             </div>

//                             {/* Tab Content */}
//                             <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
//                                 {activeTab === 'sections' && (
//                                     <SectionsTab
//                                         selectedTemplate={selectedTemplate}
//                                         isEditingSections={isEditingSections}
//                                         setIsEditingSections={setIsEditingSections}
//                                         handleSectionChange={handleSectionChange}
//                                         handlePromptChange={handlePromptChange}
//                                         handleAddPrompt={handleAddPrompt}
//                                         handleRemovePrompt={handleRemovePrompt}
//                                         handleSaveSections={handleSaveSections}
//                                         handleViewDetails={handleViewDetails}
//                                         handleDeleteSection={handleDeleteSection}
//                                     />
//                                 )}

//                                 {activeTab === 'fields' && (
//                                     <FieldsTab
//                                         selectedTemplate={selectedTemplate}
//                                         handleUpdateFields={handleUpdateFields}
//                                         editedFields={editedFields}
//                                         setEditedFields={setEditedFields}
//                                     />
//                                 )}
//                             </div>
//                         </>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default TemplateDetailsModal;


import React from 'react';
import { LayoutList, Grid, Loader2, X, FileText, FileCode } from 'lucide-react';
import SectionsTab from './SectionsTab';
import FieldsTab from './FieldsTab';
import DraftPreviewTab from './DraftPreviewTab';

const TemplateDetailsModal = ({
    showDetailsModal,
    setShowDetailsModal,
    detailsLoading,
    selectedTemplate,
    activeTab,
    setActiveTab,
    handleViewDetails,
    handleUpdateFields,
    editedFields,
    setEditedFields,
    handleSectionChange,
    handlePromptChange,
    handleAddPrompt,
    handleRemovePrompt,
    handleSaveSections,
    isEditingSections,
    setIsEditingSections,
    handleDeleteSection,
    analysisApiUrl,
    getAuthHeaders,
}) => {
    if (!showDetailsModal) return null;

    const handleClose = () => {
        setShowDetailsModal(false);
        setActiveTab('sections'); // Reset to default tab on close
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-gradient-to-br from-gray-900/70 via-gray-900/60 to-gray-900/70 backdrop-blur-md transition-opacity" 
                onClick={handleClose}
            />
            
            {/* Modal Container */}
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl relative z-10 flex flex-col animate-in fade-in zoom-in-95 duration-300 overflow-hidden border border-gray-200">
                
                {/* Header Section */}
                <div className="relative bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-8 py-6">
                    {/* Decorative Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                            backgroundSize: '32px 32px'
                        }} />
                    </div>
                    
                    <div className="relative flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                            {/* Icon */}
                            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30">
                                <FileText className="text-white" size={24} />
                            </div>
                            
                            {/* Title and Info */}
                            <div className="flex-1 min-w-0">
                                <h2 className="text-2xl font-bold text-white mb-1 truncate">
                                    {selectedTemplate?.template?.name || 'Template Details'}
                                </h2>
                                <div className="flex items-center gap-3 text-white/80">
                                    <span className="text-sm font-medium">
                                        ID: {selectedTemplate?.template?.id || 'N/A'}
                                    </span>
                                    {selectedTemplate?.sections?.length > 0 && (
                                        <>
                                            <span className="text-white/40">•</span>
                                            <span className="text-sm">
                                                {selectedTemplate.sections.length} {selectedTemplate.sections.length === 1 ? 'Section' : 'Sections'}
                                            </span>
                                        </>
                                    )}
                                    {selectedTemplate?.fields?.length > 0 && (
                                        <>
                                            <span className="text-white/40">•</span>
                                            <span className="text-sm">
                                                {selectedTemplate.fields.length} {selectedTemplate.fields.length === 1 ? 'Field' : 'Fields'}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button 
                            onClick={handleClose}
                            className="p-2 hover:bg-white/20 rounded-lg text-white transition-all shrink-0 ml-4"
                            aria-label="Close modal"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
                    {detailsLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
                            <div className="relative">
                                <Loader2 className="animate-spin text-indigo-600" size={56} />
                                <div className="absolute inset-0 blur-xl bg-indigo-600/30 animate-pulse" />
                            </div>
                            <div className="text-center">
                                <p className="text-gray-700 font-semibold text-lg">Loading Template Details</p>
                                <p className="text-gray-500 text-sm mt-1">Please wait a moment...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Tab Navigation */}
                            <div className="bg-white border-b border-gray-200 shadow-sm">
                                <div className="flex px-8 gap-1">
                                    <button
                                        onClick={() => setActiveTab('sections')}
                                        className={`relative px-6 py-4 font-semibold text-sm transition-all ${
                                            activeTab === 'sections'
                                                ? 'text-indigo-600'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <LayoutList size={18} />
                                            <span>Prompts & Sections</span>
                                            {selectedTemplate?.sections?.length > 0 && (
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    activeTab === 'sections'
                                                        ? 'bg-indigo-100 text-indigo-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {selectedTemplate.sections.length}
                                                </span>
                                            )}
                                        </div>
                                        {activeTab === 'sections' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('fields')}
                                        className={`relative px-6 py-4 font-semibold text-sm transition-all ${
                                            activeTab === 'fields'
                                                ? 'text-indigo-600'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Grid size={18} />
                                            <span>Variables & Fields</span>
                                            {selectedTemplate?.fields?.length > 0 && (
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    activeTab === 'fields'
                                                        ? 'bg-indigo-100 text-indigo-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {selectedTemplate.fields.length}
                                                </span>
                                            )}
                                        </div>
                                        {activeTab === 'fields' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('draft')}
                                        className={`relative px-6 py-4 font-semibold text-sm transition-all ${
                                            activeTab === 'draft'
                                                ? 'text-indigo-600'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <FileCode size={18} />
                                            <span>Draft preview</span>
                                        </div>
                                        {activeTab === 'draft' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Tab Content Area */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="p-8">
                                    {activeTab === 'sections' && (
                                        <SectionsTab
                                            selectedTemplate={selectedTemplate}
                                            isEditingSections={isEditingSections}
                                            setIsEditingSections={setIsEditingSections}
                                            handleSectionChange={handleSectionChange}
                                            handlePromptChange={handlePromptChange}
                                            handleAddPrompt={handleAddPrompt}
                                            handleRemovePrompt={handleRemovePrompt}
                                            handleSaveSections={handleSaveSections}
                                            handleViewDetails={handleViewDetails}
                                            handleDeleteSection={handleDeleteSection}
                                        />
                                    )}
                                    {activeTab === 'fields' && (
                                        <FieldsTab
                                            selectedTemplate={selectedTemplate}
                                            handleUpdateFields={handleUpdateFields}
                                            editedFields={editedFields}
                                            setEditedFields={setEditedFields}
                                        />
                                    )}
                                    {activeTab === 'draft' && analysisApiUrl && getAuthHeaders && (
                                        <DraftPreviewTab
                                            selectedTemplate={selectedTemplate}
                                            analysisApiUrl={analysisApiUrl}
                                            getAuthHeaders={getAuthHeaders}
                                        />
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer (Optional - for actions) */}
                {!detailsLoading && (
                    <div className="bg-white border-t border-gray-200 px-8 py-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                                Last updated: {new Date().toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TemplateDetailsModal;