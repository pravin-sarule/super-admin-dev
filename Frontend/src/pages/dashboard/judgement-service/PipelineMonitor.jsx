import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, Eye, LoaderCircle, RefreshCw, Search, Trash2 } from 'lucide-react';
import { STATUS_STYLES } from './constants';
import { formatDate, prettyStatus } from './helpers';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 200];

const PipelineMonitor = ({
  activeTab,
  counts,
  loading,
  onInspect,
  onArchive,
  onDelete,
  onRefresh,
  onReprocessFailed,
  refreshing,
  reprocessing,
  search,
  selectedDocumentId,
  setActiveTab,
  setSearch,
  uploads,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const tabs = [
    {
      key: 'processing',
      label: 'Current Processing',
      count: counts.processing,
      emptyMessage: 'No judgment documents are currently processing.',
    },
    {
      key: 'completed',
      label: 'Completed',
      count: counts.completed,
      emptyMessage: 'No completed judgments match the current search.',
    },
    {
      key: 'archived',
      label: 'Archived',
      count: counts.archived,
      emptyMessage: 'No archived judgments match the current search.',
    },
    {
      key: 'failed',
      label: 'Failed',
      count: counts.failed,
      emptyMessage: 'No failed judgments match the current search.',
    },
  ];

  const currentTab = tabs.find((tab) => tab.key === activeTab) || tabs[0];

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(uploads.length / pageSize));
  const paginatedUploads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return uploads.slice(startIndex, startIndex + pageSize);
  }, [uploads, currentPage, pageSize]);

  // Reset to first page when data changes (tab or search)
  useEffect(() => {
    setCurrentPage(1);
  }, [uploads.length, activeTab, search]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pipeline Monitor</h2>
            <p className="text-sm text-slate-500">
              Switch between current processing, completed, and failed judgments in one place.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search filename or case name"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-blue-400 md:w-72"
              />
            </div>

            {activeTab === 'failed' && counts.failed > 0 && (
              <button
                type="button"
                onClick={onReprocessFailed}
                disabled={reprocessing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${reprocessing ? 'animate-spin' : ''}`} />
                {reprocessing ? 'Reprocessing...' : 'Reprocess All Failed'}
              </button>
            )}

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

        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-2 md:gap-6">
            {tabs.map((tab) => {
              const isActive = tab.key === currentTab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Document</th>
                <th className="px-5 py-4">Case</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Pages</th>
                <th className="px-5 py-4">Updated</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                    <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
                    Loading judgement uploads...
                  </td>
                </tr>
              ) : paginatedUploads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                    {currentTab.emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedUploads.map((upload) => (
                  <tr
                    key={upload.documentId}
                    className={selectedDocumentId === upload.documentId ? 'bg-blue-50/60' : 'hover:bg-slate-50'}
                  >
                    <td className="px-5 py-4 align-top">
                      <div className="font-semibold text-slate-900">{upload.originalFilename}</div>
                      <div className="mt-1 text-xs text-slate-500">{upload.canonicalId || upload.documentId}</div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="font-medium text-slate-800">{upload.caseName || 'Metadata pending'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {upload.courtCode || 'Court pending'}
                        {upload.year ? ` • ${upload.year}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[upload.status] || STATUS_STYLES.uploaded
                        }`}
                      >
                        {prettyStatus(upload.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-slate-600">
                      <div>Total: {upload.totalPages || 0}</div>
                      <div className="text-xs text-slate-500">
                        Text: {upload.textPagesCount || 0} • OCR: {upload.ocrPagesCount || 0}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-slate-600">
                      {formatDate(upload.updatedAt || upload.processingCompletedAt || upload.createdAt)}
                    </td>
                    <td className="px-5 py-4 align-top text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onInspect(upload.documentId)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          Inspect
                        </button>
                        {activeTab !== 'archived' && onArchive && (
                          <button
                            type="button"
                            onClick={() => onArchive(upload.documentId)}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </button>
                        )}
                        {activeTab === 'archived' && onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(upload.documentId)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && uploads.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 px-5 py-4 md:flex-row">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-medium text-slate-500">per page</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="text-xs text-slate-500">
                Showing {Math.min(uploads.length, (currentPage - 1) * pageSize + 1)}-
                {Math.min(uploads.length, currentPage * pageSize)} of {uploads.length} judgments
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-slate-700">Page {currentPage}</span>
                <span className="text-xs text-slate-500">of {totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PipelineMonitor;
