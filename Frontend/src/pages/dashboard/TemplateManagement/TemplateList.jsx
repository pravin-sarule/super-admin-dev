
import React from 'react';
import { FileText, Trash2, Eye, LayoutList, Loader2, Calendar, Globe, Tag, MoreVertical, Edit3, Copy, Star } from 'lucide-react';

// Helper Component for Image Handling with strict "Word-like" fallback
const TemplatePreview = ({ imageUrl, altText, category }) => {
    const [imageError, setImageError] = React.useState(false);
    const [imageLoaded, setImageLoaded] = React.useState(false);

    // If no URL or error, show Word-like document preview
    if (!imageUrl || imageError) {
        return (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center p-4 relative overflow-hidden group-hover:bg-indigo-50/50 transition-colors">
                {/* Document Paper Effect */}
                <div className="relative w-3/4 h-full bg-white shadow-md border border-gray-200 rounded-t-sm flex flex-col items-center pt-6 px-4 space-y-2 transform transition-transform group-hover:-translate-y-1">
                    {/* Header Lines */}
                    <div className="w-full h-2 bg-gray-100 rounded-sm" />
                    <div className="w-2/3 h-2 bg-gray-100 rounded-sm self-start" />

                    {/* Body Lines (Mock Text) */}
                    <div className="w-full space-y-1.5 mt-4">
                        <div className="w-full h-1.5 bg-gray-100 rounded-sm" />
                        <div className="w-full h-1.5 bg-gray-100 rounded-sm" />
                        <div className="w-5/6 h-1.5 bg-gray-100 rounded-sm" />
                        <div className="w-full h-1.5 bg-gray-100 rounded-sm" />
                        <div className="w-4/5 h-1.5 bg-gray-100 rounded-sm" />
                    </div>

                    {/* Word Icon Overlay */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-blue-600 rounded-lg shadow-lg flex items-center justify-center text-white font-bold text-xl border-2 border-white">
                        W
                    </div>
                </div>

                {/* Fallback Text if needed (hidden for clean look) */}
                <span className="sr-only">Document Preview</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative bg-gray-200">
            {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
                    <Loader2 className="animate-spin text-gray-400" />
                </div>
            )}
            <img
                src={imageUrl}
                alt={altText}
                className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                    console.error("Image load error for", imageUrl);
                    e.target.style.display = 'none'; // Ensure broken icon is hidden
                    setImageError(true);
                }}
            />
        </div>
    );
};

const TemplateList = ({ templates, loading, viewMode, handleViewDetails, handleDelete }) => {
    // Loading State
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
                </div>
                <p className="text-gray-600 font-semibold mt-6 text-lg">Loading Templates</p>
                <p className="text-gray-400 text-sm mt-1">Fetching your content...</p>
            </div>
        );
    }

    // Empty State
    if (templates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32 px-4">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                    <LayoutList className="text-indigo-400" size={40} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">No Templates Found</h3>
                <p className="text-gray-500 text-center max-w-md">
                    Start by creating your first template to organize your content and streamline your workflow.
                </p>
                <button className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300">
                    Create Your First Template
                </button>
            </div>
        );
    }

    // Table View
    if (viewMode === 'table') {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                <th className="px-6 py-4 text-left">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Template</span>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left">
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Category</span>
                                </th>
                                <th className="px-6 py-4 text-left">
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Language</span>
                                </th>
                                <th className="px-6 py-4 text-left">
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Status</span>
                                </th>
                                <th className="px-6 py-4 text-left">
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Created</span>
                                </th>
                                <th className="px-6 py-4 text-right">
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {templates.map((template, index) => (
                                <tr
                                    key={template.id}
                                    className="hover:bg-gray-50 transition-colors group"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md overflow-hidden ring-1 ring-black/5">
                                                    {/* Mini Preview for Table */}
                                                    {template.image_url ? (
                                                        <img
                                                            src={template.image_url}
                                                            alt={template.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                                                        />
                                                    ) : null}
                                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100" style={{ display: template.image_url ? 'none' : 'flex' }}>
                                                        <FileText className="text-blue-500" size={20} />
                                                    </div>
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                                                    {template.name}
                                                </h4>
                                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                                    ID: {template.id.slice(0, 8)}...
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Tag size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-700 font-medium">
                                                {template.category}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Globe size={14} className="text-gray-400" />
                                            <span className="text-sm text-gray-700 capitalize">
                                                {template.language}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${template.status === 'active'
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'bg-gray-50 text-gray-600 border border-gray-200'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${template.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                                                }`} />
                                            {template.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Calendar size={14} className="text-gray-400" />
                                            <span>
                                                {template.created_at
                                                    ? new Date(template.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })
                                                    : 'N/A'
                                                }
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleViewDetails(template.id)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all hover:scale-110"
                                                title="View Details"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(template.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all hover:scale-110"
                                                title="Delete Template"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <button
                                                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all"
                                                title="More Options"
                                            >
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        Showing <span className="font-semibold text-gray-900">{templates.length}</span> template{templates.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg border border-gray-200 transition-all disabled:opacity-50" disabled>
                            Previous
                        </button>
                        <button className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all">
                            1
                        </button>
                        <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg border border-gray-200 transition-all">
                            Next
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Grid View (Card Layout)
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {templates.map((template, index) => (
                <div
                    key={template.id}
                    className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl border border-gray-200 transition-all duration-300 hover:-translate-y-2 animate-in fade-in slide-in-from-bottom-4"
                    style={{ animationDelay: `${index * 100}ms` }}
                >
                    {/* Card Header/Image */}
                    <div className="relative h-48 bg-gray-50 overflow-hidden border-b border-gray-100">
                        <TemplatePreview
                            imageUrl={template.image_url}
                            altText={template.name}
                            category={template.category}
                        />

                        {/* Category Badge */}
                        <div className="absolute top-4 left-4">
                            <span className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-sm text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                                <Tag size={12} className="text-indigo-500" />
                                {template.category}
                            </span>
                        </div>

                        {/* Status Badge */}
                        <div className="absolute top-4 right-4">
                            <span className={`inline-flex items-center gap-1.5 backdrop-blur-sm text-xs font-semibold px-3 py-1.5 rounded-full border shadow-sm ${template.status === 'active'
                                    ? 'bg-green-100/90 text-green-700 border-green-200'
                                    : 'bg-gray-100/90 text-gray-700 border-gray-200'
                                }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${template.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                                    }`} />
                                {template.status}
                            </span>
                        </div>

                        {/* Quick Actions Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                            <button
                                onClick={() => handleViewDetails(template.id)}
                                className="p-3 bg-white hover:bg-gray-50 text-indigo-600 rounded-xl transition-all hover:scale-110 shadow-xl"
                                title="View Details"
                            >
                                <Eye size={20} />
                            </button>
                            <button
                                className="p-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl transition-all hover:scale-110 shadow-xl"
                                title="Edit Template"
                            >
                                <Edit3 size={20} />
                            </button>
                            <button
                                onClick={() => handleDelete(template.id)}
                                className="p-3 bg-white hover:bg-gray-50 text-red-500 rounded-xl transition-all hover:scale-110 shadow-xl"
                                title="Delete Template"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5">
                        {/* Title */}
                        <h3 className="text-lg font-bold text-gray-900 mb-2 truncate group-hover:text-indigo-600 transition-colors">
                            {template.name}
                        </h3>

                        {/* Metadata */}
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Globe size={14} className="text-gray-400" />
                                <span className="capitalize">{template.language}</span>
                            </div>
                            {template.created_at && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Calendar size={14} className="text-gray-400" />
                                    <span>
                                        {new Date(template.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <button
                                onClick={() => handleViewDetails(template.id)}
                                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                            >
                                <span>View Details</span>
                                <Eye size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                <button
                                    className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-all"
                                    title="Add to Favorites"
                                >
                                    <Star size={16} />
                                </button>
                                <button
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                    title="More Options"
                                >
                                    <MoreVertical size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Hover Border Effect */}
                    <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-500/0 group-hover:ring-indigo-500/50 transition-all pointer-events-none" />
                </div>
            ))}
        </div>
    );
};

export default TemplateList;