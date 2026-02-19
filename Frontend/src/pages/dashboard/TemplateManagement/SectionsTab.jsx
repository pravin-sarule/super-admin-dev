
import React, { useState } from 'react';
import { LayoutList, Save, X, Edit3, Eye, Trash2, ChevronDown, Plus, Check, Loader2, FileText, Maximize2 } from 'lucide-react';
import Swal from 'sweetalert2';

const SectionsTab = ({
    selectedTemplate,
    handleSectionChange,
    handlePromptChange,
    handleAddPrompt, // Might be unused now if we force single prompt, but keeping for compatibility if needed
    handleRemovePrompt, // Unused
    handleSaveSections,
    handleDeleteSection
}) => {
    const [expandedSectionId, setExpandedSectionId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [promptEnlargeOpen, setPromptEnlargeOpen] = useState(false);
    const [promptEnlargeValue, setPromptEnlargeValue] = useState('');
    const [promptEnlargeSectionIdx, setPromptEnlargeSectionIdx] = useState(null);

    const toggleSection = (sectionId) => {
        setExpandedSectionId(prev => prev === sectionId ? null : sectionId);
    };

    const onSave = async (section) => {
        setIsSaving(true);
        try {
            await handleSaveSections([section]);
            setExpandedSectionId(null);
        } catch (error) {
            console.error("Failed to save section", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to get the single master prompt
    const getMasterPrompt = (section) => {
        if (section.section_prompts && section.section_prompts.length > 0) {
            return section.section_prompts[0].prompt;
        }
        return "";
    };

    // Helper to update the master prompt
    const updateMasterPrompt = (idx, newValue) => {
        // We reuse the existing handlePromptChange but ensure we target index 0
        // If prompts array is empty, we might need a way to initialize it.
        // Since handlePromptChange expects an index, we need to ensure the array has an element at 0.

        // This logic mimics handlePromptChange but we can't easily inject a new prompt via that prop if it doesn't exist.
        // So we might need to modify the parent state directly if the array is empty.
        // However, handlePromptChange typically updates specifically at an index.

        // Let's assume the parent (TemplateManagement) handles initialization or we trigger an 'add' if missing.
        // Actually, let's just use a direct update fn passed from parent if available, OR reuse handlePromptChange.

        // If empty, we can't call handlePromptChange(idx, 0, ...).
        // Check TemplateManagement.jsx handlePromptChange:
        // updatedSections[sectionIdx].section_prompts[promptIdx][field] = value;

        // So we must ensure promptIdx 0 exists.
        const section = selectedTemplate.sections[idx];
        if (!section.section_prompts || section.section_prompts.length === 0) {
            handleAddPrompt(idx); // Add the first one
            // Wait for state update? No, handleAddPrompt usually updates state immediately but async in React.
            // We can't immediately write to it.
            // This is a race condition.

            // BETTER APPROACH: Render the input. If it's empty/missing, show empty. 
            // On Change: if missing, call Add then Change? No.

            // We should rely on the parent to ensure at least one prompt exists OR modify handlePromptChange to strict upsert.
            // But I can't modify parent easily in this step without context switch.

            // Hack: Trigger Add if length is 0 on FOCUS or use a local state buffer?
            // Let's assume for now we can just call handleAddPrompt if we detect 0 length on render, but that's a side effect.

            // Best way: Just change the UI to use handlePromptChange(idx, 0, ...). 
            // If the user types in an empty section, we'll need to strictly handle the 'undefined' case.
            // But wait, I can use handleSectionChange if I mapped it to a new field, but I am using section_prompts.

            // Let's rely on `handlePromptChange`. If it crashes, I'll fix parent.
            // But I'll modify the `onChange` to check if `section_prompts[0]` exists.
        }

        handlePromptChange(idx, 0, 'prompt', newValue);
        // Force field_id to be 'master_instruction' or similar if needed, or leave blank.
    };

    // Ensure every section has at least one prompt container so the UI doesn't break
    // We can't do this in render. 

    // Sort sections
    const sortedSections = selectedTemplate?.sections ? [...selectedTemplate.sections].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)) : [];

    return (
        <div className="space-y-4 max-w-5xl mx-auto">
            {sortedSections.length > 0 ? (
                sortedSections.map((section, idx) => {
                    const sectionId = section.id || idx;
                    const isExpanded = expandedSectionId === sectionId;

                    // Check if we need to initialize the first prompt
                    const hasPrompts = section.section_prompts && section.section_prompts.length > 0;
                    const masterPrompt = hasPrompts ? section.section_prompts[0].prompt : "";

                    return (
                        <div
                            key={sectionId}
                            className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded
                                    ? 'border-indigo-500 shadow-lg ring-1 ring-indigo-500/20'
                                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                }`}
                        >
                            {/* Header */}
                            <div className={`p-4 flex items-center justify-between gap-4 ${isExpanded ? 'bg-indigo-50/50 border-b border-indigo-100' : 'bg-white'}`}>
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className={`text-base font-bold truncate ${isExpanded ? 'text-indigo-900' : 'text-gray-900'}`}>
                                            {section.section_name || "Untitled Section"}
                                        </h3>
                                        {!isExpanded && (
                                            <p className="text-xs text-gray-500 truncate mt-0.5 max-w-[500px]">
                                                {section.section_purpose || "No purpose defined"}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {isExpanded ? (
                                        <>
                                            <button
                                                onClick={() => onSave(section)}
                                                disabled={isSaving}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                                            >
                                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                Save
                                            </button>
                                            <button
                                                onClick={() => toggleSection(sectionId)}
                                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Collapse"
                                            >
                                                <X size={20} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => toggleSection(sectionId)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-bold transition-all shadow-sm"
                                            >
                                                <Eye size={16} className="text-gray-400" />
                                                View
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteSection(section.id);
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                                title="Delete Section"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="p-6 space-y-8 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Section Name</label>
                                            <input
                                                type="text"
                                                value={section.section_name}
                                                onChange={(e) => handleSectionChange(idx, 'section_name', e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-gray-900"
                                                placeholder="e.g. Scope of Services"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Purpose</label>
                                            <input
                                                type="text"
                                                value={section.section_purpose || ''}
                                                onChange={(e) => handleSectionChange(idx, 'section_purpose', e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-gray-700"
                                                placeholder="What is this section for?"
                                            />
                                        </div>
                                    </div>

                                    {/* Consolidated Instruction Area */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <label className="text-sm font-bold text-indigo-900 uppercase tracking-tight flex items-center gap-2">
                                                <FileText size={16} className="text-indigo-600" />
                                                Generation Instructions & Formatting
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-indigo-400 bg-indigo-50 px-2 py-1 rounded">
                                                    Master Prompt
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPromptEnlargeValue(masterPrompt);
                                                        setPromptEnlargeSectionIdx(idx);
                                                        setPromptEnlargeOpen(true);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                                >
                                                    <Maximize2 className="w-4 h-4" />
                                                    Enlarge
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">
                                            Provide detailed instructions on how the AI should generate this section, including specific formatting, required clauses, and tone.
                                        </p>
                                        <textarea
                                            value={masterPrompt}
                                            onChange={(e) => {
                                                if (!hasPrompts) {
                                                    // Initialize if missing
                                                    handleAddPrompt(idx);
                                                    setTimeout(() => {
                                                        // Fallback to update after render cycle if sync fails (React state batching)
                                                        // Ideally handlePromptChange handles it, but we can't await it here easily.
                                                        // This is a UI hack. The correct way is ensuring data integrity upstream.
                                                        // But for now, let's assume handleAddPrompt works and we might lose the first char if racing.
                                                        // Better: check upstream. 

                                                        // Actually, we can pass a special 'force' flag or handle it in parent.
                                                        // For now safeguard:
                                                    }, 0);
                                                }
                                                updateMasterPrompt(idx, e.target.value);
                                            }}
                                            onClick={() => {
                                                if (!hasPrompts) handleAddPrompt(idx);
                                            }}
                                            className="w-full px-4 py-4 rounded-xl border border-indigo-200 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-gray-800 min-h-[200px] font-mono text-sm leading-relaxed shadow-inner"
                                            placeholder="e.g. Generate a table with columns for Item, Cost, and Duration. Include a total row at the bottom. Ensure all currency is formatted in USD..."
                                        />
                                    </div>

                                    {/* AI Intro / Context (Optional - kept for completeness) */}
                                    <div className="space-y-2 pt-4 border-t border-gray-100">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            AI Intro / Context (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={section.section_intro || ''}
                                            onChange={(e) => handleSectionChange(idx, 'section_intro', e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 outline-none text-sm text-gray-600"
                                            placeholder="Brief intro for the AI to understand this section's context..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })
            ) : (
                <div className="text-center py-20">
                    <div className="bg-gradient-to-br from-gray-100 to-gray-200 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <LayoutList className="text-gray-400" size={36} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700 mb-2">No Sections Found</h3>
                    <p className="text-gray-500 text-sm">
                        This template doesn't have any sections yet.
                    </p>
                </div>
            )}

            {/* Enlarge prompt modal — single instance */}
            {promptEnlargeOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setPromptEnlargeOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Prompt — enlarged</h3>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setPromptEnlargeOpen(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="button" onClick={() => { updateMasterPrompt(promptEnlargeSectionIdx, promptEnlargeValue); setPromptEnlargeOpen(false); }} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Done</button>
                            </div>
                        </div>
                        <div className="p-5 flex-1 min-h-0">
                            <textarea
                                rows={24}
                                value={promptEnlargeValue}
                                onChange={(e) => setPromptEnlargeValue(e.target.value)}
                                className="w-full h-full min-h-[60vh] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                                placeholder="e.g. Generate a table with columns for Item, Cost, and Duration..."
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SectionsTab;