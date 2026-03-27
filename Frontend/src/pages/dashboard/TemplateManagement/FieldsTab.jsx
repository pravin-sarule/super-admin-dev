
// import React from 'react';
// import { Grid, CheckCircle, Save } from 'lucide-react';

// const FieldsTab = ({ selectedTemplate, handleUpdateFields, editedFields, setEditedFields }) => {
//     return (
//         <div className="max-w-6xl mx-auto">
//             {/* Fields Visualization */}
//             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
//                 <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
//                     <h3 className="font-bold text-gray-800 flex items-center gap-2">
//                         <Grid size={18} className="text-indigo-600" />
//                         Extracted Variables
//                     </h3>
//                     <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">
//                         JSON Source
//                     </span>
//                 </div>

//                 {/* If fields exist, try to render a table, else show raw JSON or Empty */}
//                 {selectedTemplate?.fields?.sections ? (
//                     <div className="overflow-x-auto">
//                         <table className="w-full text-sm text-left">
//                             <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
//                                 <tr>
//                                     <th className="px-6 py-3 font-medium">Variable Name (Key)</th>
//                                     <th className="px-6 py-3 font-medium">Label</th>
//                                     <th className="px-6 py-3 font-medium">Type</th>
//                                     <th className="px-6 py-3 font-medium text-center">Required</th>
//                                     <th className="px-6 py-3 font-medium">Description</th>
//                                 </tr>
//                             </thead>
//                             <tbody className="divide-y divide-gray-100">
//                                 {selectedTemplate.fields.sections.flatMap(s => s.fields || []).map((field, fIdx) => (
//                                     <tr key={field.key || field.id || fIdx} className="hover:bg-indigo-50/30 transition-colors">
//                                         <td className="px-6 py-3 font-mono text-indigo-600 font-medium">
//                                             {field.key || field.id || 'N/A'}
//                                         </td>
//                                         <td className="px-6 py-3 text-gray-900 font-medium">
//                                             {field.label}
//                                         </td>
//                                         <td className="px-6 py-3">
//                                             <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
//                                                 ${field.type === 'date' ? 'bg-blue-50 text-blue-700 border-blue-200' :
//                                                     field.type === 'currency' ? 'bg-green-50 text-green-700 border-green-200' :
//                                                         field.type === 'number' ? 'bg-orange-50 text-orange-700 border-orange-200' :
//                                                             'bg-gray-100 text-gray-800 border-gray-200'}`}>
//                                                 {field.type}
//                                             </span>
//                                         </td>
//                                         <td className="px-6 py-3 text-center">
//                                             {field.required ? (
//                                                 <CheckCircle size={16} className="text-green-500 mx-auto" />
//                                             ) : (
//                                                 <span className="text-gray-300">-</span>
//                                             )}
//                                         </td>
//                                         <td className="px-6 py-3 text-gray-500 max-w-xs truncate">
//                                             {field.description || '-'}
//                                         </td>
//                                     </tr>
//                                 ))}
//                             </tbody>
//                         </table>
//                     </div>
//                 ) : (
//                     <div className="p-8 text-center text-gray-500 italic">
//                         No structured field definitions found.
//                     </div>
//                 )}
//             </div>

//             {/* Raw JSON Editor (Collapsible or Secondary) */}
//             <div className="mt-8">
//                 <div className="flex items-center justify-between mb-2">
//                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Advanced: Edit Schema (JSON)</label>
//                     <button
//                         onClick={handleUpdateFields}
//                         className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
//                     >
//                         <Save size={16} />
//                         Apply JSON Changes
//                     </button>
//                 </div>
//                 <textarea
//                     className="w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs p-4 rounded-xl shadow-inner focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-64 leading-relaxed"
//                     value={editedFields}
//                     onChange={(e) => setEditedFields(e.target.value)}
//                     spellCheck="false"
//                 ></textarea>
//             </div>
//         </div>
//     );
// };

// export default FieldsTab;



import React, { useState, useEffect } from 'react';
import { Grid, CheckCircle, Save, Plus, Trash2, Edit3, X, ChevronDown, ChevronRight, Code, Table, AlertCircle } from 'lucide-react';

const FieldsTab = ({ selectedTemplate, handleUpdateFields, editedFields, setEditedFields }) => {
    const [fields, setFields] = useState([]);
    const [expandedSections, setExpandedSections] = useState({});
    const [editingField, setEditingField] = useState(null);
    const [showJsonEditor, setShowJsonEditor] = useState(false);
    const [viewMode, setViewMode] = useState('ui'); // 'ui' or 'json'

    // Parse fields from JSON on mount and when editedFields changes
    useEffect(() => {
        try {
            const parsed = JSON.parse(editedFields);
            if (parsed.sections || Array.isArray(parsed.all_fields)) {
                // Build a map: section_id -> fields from top-level all_fields
                const allFieldsMap = {};
                if (Array.isArray(parsed.all_fields)) {
                    parsed.all_fields.forEach(f => {
                        const sid = f.section_id || '__unassigned__';
                        if (!allFieldsMap[sid]) allFieldsMap[sid] = [];
                        allFieldsMap[sid].push(f);
                    });
                }

                // Track which section_ids from all_fields were consumed
                const consumedSectionIds = new Set();

                // Merge: combine section.fields + all_fields (by section_id), deduplicating by key
                const mergedSections = (parsed.sections || []).map(section => {
                    const sid = section.section_id;
                    const fromSection = Array.isArray(section.fields) ? section.fields : [];
                    const fromAllFields = sid ? (allFieldsMap[sid] || []) : [];
                    const seen = new Set(fromSection.map(f => f.key).filter(Boolean));
                    const sectionFields = [
                        ...fromSection,
                        ...fromAllFields.filter(f => f.key && !seen.has(f.key))
                    ];
                    if (sid) consumedSectionIds.add(sid);
                    return { ...section, fields: sectionFields };
                });

                // Add extra sections for any all_fields entries whose section_id
                // didn't match any of the stored sections (common when AI produces
                // more sections in all_fields than are stored in the sections array)
                Object.entries(allFieldsMap).forEach(([sid, sidFields]) => {
                    if (consumedSectionIds.has(sid)) return; // already merged above

                    // Deduplicate against keys already present in mergedSections
                    const allExistingKeys = new Set(
                        mergedSections.flatMap(s => (s.fields || []).map(f => f.key).filter(Boolean))
                    );
                    const newFields = sidFields.filter(f => f.key && !allExistingKeys.has(f.key));
                    if (newFields.length === 0) return;

                    const sectionName = sid === '__unassigned__'
                        ? 'Other Fields'
                        : (sidFields[0]?.section_name || sid);

                    mergedSections.push({
                        section_id: sid,
                        section_name: sectionName,
                        fields: newFields,
                    });
                });

                setFields(mergedSections);
                // Expand all sections by default
                const expanded = {};
                mergedSections.forEach((_, idx) => { expanded[idx] = true; });
                setExpandedSections(expanded);
            }
        } catch (e) {
            console.error('Failed to parse fields:', e);
        }
    }, [editedFields]);

    // Toggle section expansion
    const toggleSection = (sectionIdx) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionIdx]: !prev[sectionIdx]
        }));
    };

    // Add new field to section
    const handleAddField = (sectionIdx) => {
        const newField = {
            id: `field_${Date.now()}`,
            key: '',
            label: '',
            type: 'text',
            required: false,
            description: ''
        };
        
        const updatedFields = [...fields];
        if (!updatedFields[sectionIdx].fields) {
            updatedFields[sectionIdx].fields = [];
        }
        updatedFields[sectionIdx].fields.push(newField);
        
        setFields(updatedFields);
        updateJSON(updatedFields);
        setEditingField({ sectionIdx, fieldIdx: updatedFields[sectionIdx].fields.length - 1 });
    };

    // Delete field
    const handleDeleteField = (sectionIdx, fieldIdx) => {
        const updatedFields = [...fields];
        updatedFields[sectionIdx].fields.splice(fieldIdx, 1);
        setFields(updatedFields);
        updateJSON(updatedFields);
    };

    // Update field property
    const handleFieldChange = (sectionIdx, fieldIdx, property, value) => {
        const updatedFields = [...fields];
        updatedFields[sectionIdx].fields[fieldIdx][property] = value;
        setFields(updatedFields);
        updateJSON(updatedFields);
    };

    // Update JSON from fields - preserve the full structure
    const updateJSON = (updatedFields) => {
        try {
            const existing = JSON.parse(editedFields);
            // Rebuild all_fields from updated sections
            const allFields = [];
            const seen = new Set();
            updatedFields.forEach(section => {
                (section.fields || []).forEach(f => {
                    if (f.key && !seen.has(f.key)) {
                        seen.add(f.key);
                        allFields.push({ ...f, section_id: section.section_id });
                    }
                });
            });
            const jsonData = { ...existing, sections: updatedFields, all_fields: allFields };
            setEditedFields(JSON.stringify(jsonData, null, 2));
        } catch {
            setEditedFields(JSON.stringify({ sections: updatedFields }, null, 2));
        }
    };

    // Save all changes
    const handleSave = () => {
        handleUpdateFields();
        setEditingField(null);
    };

    // Field type options
    const fieldTypes = [
        { value: 'text', label: 'Text', color: 'gray' },
        { value: 'number', label: 'Number', color: 'orange' },
        { value: 'date', label: 'Date', color: 'blue' },
        { value: 'currency', label: 'Currency', color: 'green' },
        { value: 'email', label: 'Email', color: 'purple' },
        { value: 'phone', label: 'Phone', color: 'teal' },
        { value: 'url', label: 'URL', color: 'indigo' },
        { value: 'textarea', label: 'Long Text', color: 'pink' }
    ];

    const getTypeColor = (type) => {
        const typeObj = fieldTypes.find(t => t.value === type);
        return typeObj?.color || 'gray';
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header Controls */}
            <div className="flex items-center justify-between mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Grid className="text-indigo-600" size={20} />
                        <h3 className="text-lg font-bold text-gray-900">Field Management</h3>
                    </div>
                    <div className="h-6 w-px bg-gray-300" />
                    <span className="text-sm text-gray-600">
                        {fields.reduce((acc, section) => acc + (section.fields?.length || 0), 0)} total fields
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('ui')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'ui'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Table size={16} />
                            <span>UI Editor</span>
                        </button>
                        <button
                            onClick={() => setViewMode('json')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'json'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Code size={16} />
                            <span>JSON</span>
                        </button>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-indigo-200 transition-all hover:shadow-xl"
                    >
                        <Save size={16} />
                        Save Changes
                    </button>
                </div>
            </div>

            {/* UI Editor View */}
            {viewMode === 'ui' ? (
                <div className="space-y-4">
                    {fields.length === 0 ? (
                        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Grid className="text-gray-400" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-700 mb-2">No Fields Defined</h3>
                            <p className="text-gray-500 mb-4">Start by adding fields to structure your template data.</p>
                            <button className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-indigo-200">
                                Add First Field
                            </button>
                        </div>
                    ) : (
                        fields.map((section, sectionIdx) => (
                            <div
                                key={sectionIdx}
                                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md"
                            >
                                {/* Section Header */}
                                <div
                                    className="bg-gradient-to-r from-gray-50 to-white p-4 border-b border-gray-200 cursor-pointer hover:from-gray-100 hover:to-gray-50 transition-all"
                                    onClick={() => toggleSection(sectionIdx)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <button className="p-1 hover:bg-gray-200 rounded transition-all">
                                                {expandedSections[sectionIdx] ? (
                                                    <ChevronDown size={20} className="text-gray-600" />
                                                ) : (
                                                    <ChevronRight size={20} className="text-gray-600" />
                                                )}
                                            </button>
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-lg">
                                                    {section.section_name || section.title || `Section ${sectionIdx + 1}`}
                                                </h4>
                                                <p className="text-sm text-gray-500">
                                                    {section.fields?.length || 0} field{section.fields?.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddField(sectionIdx);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
                                        >
                                            <Plus size={16} />
                                            Add Field
                                        </button>
                                    </div>
                                </div>

                                {/* Section Fields */}
                                {expandedSections[sectionIdx] && (
                                    <div className="p-4">
                                        {section.fields && section.fields.length > 0 ? (
                                            <div className="space-y-3">
                                                {section.fields.map((field, fieldIdx) => {
                                                    const isEditing = editingField?.sectionIdx === sectionIdx && editingField?.fieldIdx === fieldIdx;
                                                    const typeColor = getTypeColor(field.type);

                                                    return (
                                                        <div
                                                            key={field.id || fieldIdx}
                                                            className={`group relative bg-gray-50 rounded-lg border-2 transition-all ${
                                                                isEditing
                                                                    ? 'border-indigo-300 bg-indigo-50/50 shadow-lg'
                                                                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                                                            }`}
                                                        >
                                                            <div className="p-4">
                                                                {isEditing ? (
                                                                    // Edit Mode
                                                                    <div className="space-y-4">
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            {/* Field Key */}
                                                                            <div>
                                                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                                                                                    Field Key (Variable Name)
                                                                                </label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={field.key || ''}
                                                                                    onChange={(e) => handleFieldChange(sectionIdx, fieldIdx, 'key', e.target.value)}
                                                                                    placeholder="e.g., business_name"
                                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
                                                                                />
                                                                            </div>

                                                                            {/* Field Label */}
                                                                            <div>
                                                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                                                                                    Display Label
                                                                                </label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={field.label || ''}
                                                                                    onChange={(e) => handleFieldChange(sectionIdx, fieldIdx, 'label', e.target.value)}
                                                                                    placeholder="e.g., Business Name"
                                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            {/* Field Type */}
                                                                            <div>
                                                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                                                                                    Field Type
                                                                                </label>
                                                                                <select
                                                                                    value={field.type || 'text'}
                                                                                    onChange={(e) => handleFieldChange(sectionIdx, fieldIdx, 'type', e.target.value)}
                                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                                                                                >
                                                                                    {fieldTypes.map(type => (
                                                                                        <option key={type.value} value={type.value}>
                                                                                            {type.label}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>

                                                                            {/* Required Toggle */}
                                                                            <div>
                                                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                                                                                    Required Field
                                                                                </label>
                                                                                <div className="flex items-center h-10">
                                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={field.required || false}
                                                                                            onChange={(e) => handleFieldChange(sectionIdx, fieldIdx, 'required', e.target.checked)}
                                                                                            className="sr-only peer"
                                                                                        />
                                                                                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                                                        <span className="ml-3 text-sm font-medium text-gray-700">
                                                                                            {field.required ? 'Yes' : 'No'}
                                                                                        </span>
                                                                                    </label>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Description */}
                                                                        <div>
                                                                            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                                                                                Description / Help Text
                                                                            </label>
                                                                            <textarea
                                                                                value={field.description || ''}
                                                                                onChange={(e) => handleFieldChange(sectionIdx, fieldIdx, 'description', e.target.value)}
                                                                                placeholder="Provide additional context or instructions for this field..."
                                                                                rows={2}
                                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm resize-none"
                                                                            />
                                                                        </div>

                                                                        {/* Action Buttons */}
                                                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                                                                            <button
                                                                                onClick={() => setEditingField(null)}
                                                                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition-all"
                                                                            >
                                                                                Done
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    // View Mode
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="flex-1 min-w-0 space-y-2">
                                                                            <div className="flex items-center gap-3">
                                                                                <code className="px-2 py-1 bg-gray-900 text-emerald-400 rounded text-xs font-mono font-semibold">
                                                                                    {field.key || 'unnamed'}
                                                                                </code>
                                                                                <span className={`px-2 py-1 rounded-md text-xs font-semibold bg-${typeColor}-100 text-${typeColor}-700 border border-${typeColor}-200`}>
                                                                                    {field.type}
                                                                                </span>
                                                                                {field.required && (
                                                                                    <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-md text-xs font-semibold border border-red-200">
                                                                                        <AlertCircle size={12} />
                                                                                        Required
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <h5 className="font-bold text-gray-900 text-base">
                                                                                {field.label || 'Untitled Field'}
                                                                            </h5>
                                                                            {field.description && (
                                                                                <p className="text-sm text-gray-600 leading-relaxed">
                                                                                    {field.description}
                                                                                </p>
                                                                            )}
                                                                        </div>

                                                                        {/* Action Buttons */}
                                                                        <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <button
                                                                                onClick={() => setEditingField({ sectionIdx, fieldIdx })}
                                                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                                title="Edit Field"
                                                                            >
                                                                                <Edit3 size={16} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteField(sectionIdx, fieldIdx)}
                                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                title="Delete Field"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                                                <p className="text-gray-500 mb-3">No fields in this section</p>
                                                <button
                                                    onClick={() => handleAddField(sectionIdx)}
                                                    className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
                                                >
                                                    + Add your first field
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            ) : (
                // JSON Editor View
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                            <Code size={18} />
                            <span className="font-semibold">Advanced JSON Editor</span>
                        </div>
                        <span className="text-xs bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full font-semibold border border-yellow-500/30">
                            Expert Mode
                        </span>
                    </div>
                    <textarea
                        className="w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-6 outline-none resize-none leading-relaxed"
                        value={editedFields}
                        onChange={(e) => setEditedFields(e.target.value)}
                        spellCheck="false"
                        rows={25}
                        style={{
                            tabSize: 2,
                            fontFamily: "'Fira Code', 'Consolas', monospace"
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default FieldsTab;