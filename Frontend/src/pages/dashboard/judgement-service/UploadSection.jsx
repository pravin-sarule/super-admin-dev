import React from 'react';
import { FileUp, LoaderCircle, Sparkles } from 'lucide-react';

const UploadSection = ({
  feedback,
  maxUploadFiles,
  onUpload,
  setUploadFiles,
  uploadFiles,
  uploading,
}) => {
  const uploadSelectionKey = uploadFiles.length
    ? uploadFiles.map((file) => `${file.name}:${file.size}`).join('|')
    : 'empty-upload-selection';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Judgement Upload Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Upload court PDFs, track OCR and indexing stages, review extracted metadata, and re-run the pipeline from one admin workspace.
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-3 md:grid-cols-[1fr,auto]">
          <label className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <span className="mb-2 flex items-center gap-2 font-semibold text-slate-800">
              <FileUp className="h-4 w-4" />
              Choose PDFs
            </span>
            <input
              key={uploadSelectionKey}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="block w-full text-sm text-slate-600"
              onChange={(event) => setUploadFiles(Array.from(event.target.files || []))}
            />
            <span className="mt-2 block text-xs text-slate-500">
              {uploadFiles.length
                ? `${uploadFiles.length} file${uploadFiles.length === 1 ? '' : 's'} selected`
                : 'No files selected'}
            </span>
            <span className="mt-1 block text-xs text-slate-400">
              Upload up to {maxUploadFiles} PDF files in one batch.
            </span>
            {!!uploadFiles.length && (
              <span className="mt-2 block max-h-20 overflow-y-auto text-xs text-slate-500">
                {uploadFiles.slice(0, 5).map((file) => file.name).join(', ')}
                {uploadFiles.length > 5 ? `, +${uploadFiles.length - 5} more` : ''}
              </span>
            )}
          </label>

          <button
            type="button"
            onClick={onUpload}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {uploading ? 'Uploading...' : 'Upload Judgments'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      )}
    </section>
  );
};

export default UploadSection;
