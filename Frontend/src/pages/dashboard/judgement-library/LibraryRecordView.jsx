import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Code2,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { formatDate } from '../judgement-service/helpers';

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400';

/** Same wrapper the service uses for "open in new tab", so the preview matches. */
function wrapFragment(fragment) {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
    'body{font-family:Georgia,"Times New Roman",serif;color:#1a1a1a;background:#fff;margin:0;padding:24px 20px;line-height:1.6}',
    '.doc_title{font-size:1.35rem;line-height:1.3;margin:0 0 12px}',
    '.doc_author,.doc_bench{font-size:0.95rem;font-weight:600;margin:6px 0}',
    '.doc_author a,.doc_bench a{color:#1d4ed8;text-decoration:none}',
    'pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;margin:16px 0}',
    'p{margin:14px 0;text-align:justify;white-space:pre-wrap}',
    'blockquote{margin:14px 24px;padding:8px 16px;border-left:3px solid #cbd5e1;background:#f8fafc;white-space:pre-wrap}',
    '</style></head><body>',
    fragment,
    '</body></html>',
  ].join('');
}

const Tile = ({ label, value, mono = false }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className={`mt-2 break-words text-sm font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>
      {value === null || value === undefined || value === '' ? <span className="text-slate-400">—</span> : value}
    </div>
  </div>
);

const LibraryRecordView = ({
  deleting,
  editDirty,
  editForm,
  feedback,
  onBack,
  onDelete,
  onEditFieldChange,
  onOpenHtml,
  onRefresh,
  onSave,
  record,
  recordLoading,
  saving,
  tid,
}) => {
  const [showSource, setShowSource] = useState(false);
  const html = record?.document?.doc || '';
  const srcDoc = useMemo(() => (html ? wrapFragment(html) : ''), [html]);
  const upload = record?.upload || {};

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Library
            </button>
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              Indian Kanoon-format record
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {record?.title || (recordLoading ? 'Loading…' : 'Judgment')}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="font-mono">tid {tid}</span>
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                In library
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={recordLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${recordLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => onOpenHtml(tid)}
              disabled={!html}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <ExternalLink className="h-4 w-4" />
              Open HTML in new tab
            </button>
            <button
              type="button"
              onClick={() => onDelete(tid)}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            >
              {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove from Library
            </button>
          </div>
        </div>

        {feedback ? (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
              feedback.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Record fields</h3>
          <p className="mt-1 text-sm text-slate-500">
            Saving rebuilds the HTML, the search text and the paragraph rows from the stored document under the same tid.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600 md:col-span-2">
              <span className="mb-2 block font-medium text-slate-800">Title (doc_title)</span>
              <input value={editForm.title} onChange={(e) => onEditFieldChange('title', e.target.value)} className={inputClass} />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-2 block font-medium text-slate-800">Court (docsource)</span>
              <input value={editForm.docsource} onChange={(e) => onEditFieldChange('docsource', e.target.value)} className={inputClass} placeholder="e.g. Supreme Court of India" />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-2 block font-medium text-slate-800">Judgment date (publishdate)</span>
              <input type="date" value={editForm.publishdate} onChange={(e) => onEditFieldChange('publishdate', e.target.value)} className={inputClass} />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-2 block font-medium text-slate-800">Author</span>
              <input value={editForm.author} onChange={(e) => onEditFieldChange('author', e.target.value)} className={inputClass} />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-2 block font-medium text-slate-800">Bench (comma separated)</span>
              <input value={editForm.bench} onChange={(e) => onEditFieldChange('bench', e.target.value)} className={inputClass} />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={!editDirty || saving || recordLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save and re-index
            </button>
            <span className="text-xs text-slate-400">
              {editDirty ? 'Unsaved changes.' : 'No changes.'}
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">What is stored</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Tile label="Paragraph rows" value={record?.paragraphCount ?? 0} />
            <Tile label="Search text" value={record ? `${Number(record.textChars || 0).toLocaleString()} chars` : null} />
            <Tile label="HTML (doc)" value={record ? `${Number(record.htmlChars || 0).toLocaleString()} chars` : null} />
            <Tile label="Source PDF" value={upload.filename} />
            <Tile label="Pages · text source" value={upload.page_count ? `${upload.page_count} · ${upload.text_source === 'ocr' ? 'OCR' : 'text layer'}` : null} />
            <Tile label="Uploaded" value={record?.fetchedAt ? `${formatDate(record.fetchedAt)}${upload.uploaded_by ? ` · ${upload.uploaded_by}` : ''}` : null} />
            <Tile label="numcites · numcitedby" value={record?.document ? `${record.document.numcites} · ${record.document.numcitedby}` : null} mono />
            <Tile label="Metadata extraction" value={upload.extraction_method ? `${upload.extraction_method}${upload.needs_review ? ' · needs review' : ''}` : null} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {showSource ? 'HTML source (the `doc` field)' : 'Rendered document'}
            </h3>
            <p className="text-xs text-slate-500">Exactly what is stored in ik_judgments for this tid.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSource((value) => !value)}
            disabled={!html}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Code2 className="h-4 w-4" />
            {showSource ? 'Show rendered view' : 'Show HTML source'}
          </button>
        </div>
        {recordLoading && !html ? (
          <div className="flex h-[40vh] items-center justify-center text-sm text-slate-500">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Loading record…
          </div>
        ) : showSource ? (
          <pre className="h-[70vh] overflow-auto bg-slate-900 p-4 text-xs leading-5 text-slate-100">{html}</pre>
        ) : (
          <iframe title="Indian Kanoon format" sandbox="" srcDoc={srcDoc} className="h-[70vh] w-full bg-white" />
        )}
      </section>
    </div>
  );
};

export default LibraryRecordView;
