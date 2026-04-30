import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CloudUpload, Search, X } from 'lucide-react';

const KnowledgeDocumentPickerModal = ({
  open,
  documents = [],
  selectedIds = [],
  onClose,
  onApply,
  onNavigateUpload,
}) => {
  const [draft, setDraft] = useState(() => new Set(selectedIds));
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(new Set(selectedIds));
      setQuery('');
    }
  }, [open, selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => {
      const title = String(doc.title || doc.original_filename || '').toLowerCase();
      return title.includes(q);
    });
  }, [documents, query]);

  if (!open) return null;

  const toggle = (id) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ready = (status) => String(status || '').toLowerCase() === 'ready';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-900">Select knowledge documents</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {documents.length === 0 ? 'No documents uploaded yet.' : 'No documents match your search.'}
            </p>
          ) : (
            filtered.map((doc) => {
              const id = doc.id;
              const checked = draft.has(id);
              const docReady = ready(doc.status);
              return (
                <label
                  key={id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 ${
                    !docReady ? 'opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!docReady}
                    onChange={() => toggle(id)}
                    className="mt-1 h-4 w-4 accent-blue-600"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">
                        {doc.title || doc.original_filename || 'Untitled document'}
                      </span>
                      {docReady ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Ready
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          {doc.status || 'pending'}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                      {doc.source_type && <span>{doc.source_type}</span>}
                      {doc.chunk_count != null && <span>{doc.chunk_count} chunks</span>}
                      {doc.original_filename && doc.original_filename !== doc.title && (
                        <span className="truncate">{doc.original_filename}</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              onNavigateUpload?.();
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <CloudUpload className="h-4 w-4" />
            Upload more
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{draft.size} selected</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApply?.(Array.from(draft));
                onClose?.();
              }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeDocumentPickerModal;
