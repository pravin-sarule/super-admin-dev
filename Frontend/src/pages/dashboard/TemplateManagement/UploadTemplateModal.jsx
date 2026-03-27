
import React from 'react';
import { Upload, Plus, AlertCircle, CheckCircle, Loader2, X, Image as ImageIcon } from 'lucide-react';

const UploadModal = ({
    showUploadModal,
    setShowUploadModal,
    isUploading,
    handleUpload,
    formData,
    handleInputChange,
    handleFileChange
}) => {
    if (!showUploadModal) return null;

    return (
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
                                        Uploading & starting analysis...
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

            {/* Tailwind Animations for Progress - Can be global, but included here for completeness of component if needed */}
            <style>{`
                @keyframes progress {
                0% { transform: scaleX(0); }
                50% { transform: scaleX(0.7); }
                100% { transform: scaleX(0.95); }
                }
                .animate-progress {
                animation: progress 30s cubic-bezier(0.1, 0, 0.4, 1) infinite;
                }
            `}</style>
        </div>
    );
};

export default UploadModal;
