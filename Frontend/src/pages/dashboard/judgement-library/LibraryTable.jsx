import React from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, LoaderCircle, RefreshCw, Search, Trash2 } from 'lucide-react';
import { formatDate } from '../judgement-service/helpers';

const LibraryTable = ({
  deletingTid,
  loading,
  onDelete,
  onOpenHtml,
  onOpenRecord,
  onRefresh,
  page,
  pageSize,
  refreshing,
  rows,
  search,
  setPage,
  total,
  updateSearch,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Uploaded Judgments in the Library</h2>
          <p className="text-sm text-slate-500">
            {total} record{total === 1 ? '' : 's'} stored from admin uploads (tids starting with 9).
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search title, court, judge, text or tid"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-blue-400 md:w-80"
            />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Judgment</th>
                <th className="px-5 py-4">Court · Date</th>
                <th className="px-5 py-4">Judges</th>
                <th className="px-5 py-4">Library tid</th>
                <th className="px-5 py-4">Uploaded</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                    <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
                    Loading the judgment library…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                    {search ? 'No uploaded judgments match your search.' : 'No judgments have been uploaded to the library yet.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.tid} className="hover:bg-slate-50">
                    <td className="px-5 py-4 align-top">
                      <div className="font-semibold text-slate-900">{row.title || 'Untitled judgment'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.upload?.filename || '—'}
                        {row.upload?.page_count ? ` · ${row.upload.page_count} pages` : ''}
                        {row.upload?.text_source === 'ocr' ? ' · OCR' : ''}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="font-medium text-slate-800">{row.docsource || 'Court unknown'}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.publishdate || 'No date'}</div>
                    </td>
                    <td className="px-5 py-4 align-top text-slate-600">
                      <div>{row.bench || row.author || '—'}</div>
                    </td>
                    <td className="px-5 py-4 align-top font-mono text-xs text-slate-600">{row.tid}</td>
                    <td className="px-5 py-4 align-top text-slate-600">
                      <div>{formatDate(row.fetched_at)}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.upload?.uploaded_by || ''}</div>
                    </td>
                    <td className="px-5 py-4 align-top text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenRecord(row.tid)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenHtml(row.tid)}
                          title="Open the Indian Kanoon-format HTML in a new tab"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <ExternalLink className="h-4 w-4" />
                          HTML
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row.tid)}
                          disabled={deletingTid === row.tid}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                        >
                          {deletingTid === row.tid ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > pageSize ? (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-sm text-slate-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default LibraryTable;
