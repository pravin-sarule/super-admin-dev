import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2, RefreshCw, Eye, Code } from 'lucide-react';
import axios from 'axios';
import { draftToHtmlInBackground } from './draftToHtml';

const DraftPreviewTab = ({
  selectedTemplate,
  analysisApiUrl,
  getAuthHeaders,
}) => {
  const [draftContent, setDraftContent] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [previewMode, setPreviewMode] = useState('html'); // 'html' | 'raw'

  // Generate HTML in background when draft content changes (non-blocking)
  useEffect(() => {
    if (!draftContent) {
      setDraftHtml('');
      return;
    }
    draftToHtmlInBackground(draftContent, setDraftHtml);
  }, [draftContent]);

  const handleGenerateDraft = useCallback(async () => {
    if (!selectedTemplate?.template?.id || !analysisApiUrl) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await axios.post(
        `${analysisApiUrl}/template/${selectedTemplate.template.id}/generate-draft`,
        { field_values: {} },
        { headers: getAuthHeaders(), timeout: 300000 }
      );
      setDraftContent(res.data?.content ?? '');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to generate draft');
      setDraftContent('');
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplate?.template?.id, analysisApiUrl, getAuthHeaders]);

  const templateId = selectedTemplate?.template?.id;
  const hasSections = selectedTemplate?.sections?.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" />
            Draft Preview
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Generate a full draft from this template. HTML preview is built in the background for display.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerateDraft}
          disabled={generating || !templateId || !hasSections}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-sm transition-colors"
        >
          {generating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              Generate draft
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      {draftContent && (
        <>
          <div className="flex gap-2 border-b border-gray-200 pb-2">
            <button
              type="button"
              onClick={() => setPreviewMode('html')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                previewMode === 'html' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eye size={16} />
              HTML preview
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('raw')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                previewMode === 'raw' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Code size={16} />
              Raw text
            </button>
          </div>

          {previewMode === 'html' ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                Rendered from background-generated HTML
              </div>
              <div
                className="p-6 prose prose-slate max-w-none min-h-[200px] text-gray-800"
                dangerouslySetInnerHTML={{ __html: draftHtml || '<p class="text-gray-400">Generating HTML…</p>' }}
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <pre className="p-6 text-sm text-gray-800 whitespace-pre-wrap font-sans max-h-[60vh] overflow-auto">
                {draftContent}
              </pre>
            </div>
          )}
        </>
      )}

      {!draftContent && !generating && !error && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
          <FileText size={40} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 font-medium">No draft yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Click “Generate draft” to create content from this template. HTML will be generated in the background for preview.
          </p>
        </div>
      )}
    </div>
  );
};

export default DraftPreviewTab;
