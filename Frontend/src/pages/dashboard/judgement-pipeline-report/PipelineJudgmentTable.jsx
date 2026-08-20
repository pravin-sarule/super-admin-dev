import React from 'react';
import { ChevronLeft, ChevronRight, Eye, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { formatDateTime, prettyStatus } from './helpers';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

const STATUS_STYLES = {
  uploaded: 'bg-sky-50 text-sky-700',
  indexed: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700',
};

const STORE_BADGE_STYLES = {
  present: 'bg-emerald-50 text-emerald-700',
  missing: 'bg-slate-100 text-slate-500',
  qdrant: 'bg-violet-50 text-violet-700',
};

const PipelineJudgmentTable = ({
  currentPage,
  judgments,
  loading,
  meta,
  onInspect,
  onRefresh,
  pageSize,
  refreshing,
  searchInput,
  setCurrentPage,
  setPageSize,
  setSearchInput,
}) => {
  const total = Number(meta?.total || 0);
  const offset = Number(meta?.offset || 0);
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const startCount = total === 0 ? 0 : offset + 1;
  const endCount = Math.min(total, offset + judgments.length);
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const showPagination = total > 0 || judgments.length > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Inserted Judgments</h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            Documents currently stored in Elasticsearch index `ik_judgments`.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search title, IK id, court"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 sm:w-64"
            />
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5">Case</th>
              <th className="px-4 py-2.5">IK ID</th>
              <th className="px-4 py-2.5">Court / Date</th>
              <th className="px-4 py-2.5">Stores</th>
              <th className="px-4 py-2.5">Inserted</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                  <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />
                  Loading pipeline judgments...
                </td>
              </tr>
            ) : judgments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                  No `ik_judgments` documents match the current search.
                </td>
              </tr>
            ) : (
              judgments.map((judgment) => {
                const statusStyle = STATUS_STYLES[judgment.status] || 'bg-slate-100 text-slate-600';
                const secondaryId = judgment.judgmentUuid && judgment.judgmentUuid !== judgment.canonicalId
                  ? judgment.judgmentUuid
                  : null;

                return (
                  <tr
                    key={judgment.judgmentUuid || judgment.canonicalId}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => onInspect?.(judgment)}
                  >
                    <td className="px-4 py-2.5 align-middle">
                      <button
                        type="button"
                        onClick={() => onInspect?.(judgment)}
                        className="text-left text-sm font-medium text-blue-700 hover:underline"
                      >
                        {judgment.caseName || 'Case name missing'}
                      </button>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {judgment.year ? `Year ${judgment.year}` : 'Year unavailable'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-800">{judgment.canonicalId || 'N/A'}</div>
                      {secondaryId ? (
                        <div className="mt-0.5 text-[11px] text-slate-500">{secondaryId}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 align-middle text-slate-600">
                      <div className="text-sm">{judgment.courtCode || 'Court unavailable'}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {judgment.judgmentDate ? formatDateTime(judgment.judgmentDate) : 'Date unavailable'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            judgment.stores?.postgres ? STORE_BADGE_STYLES.present : STORE_BADGE_STYLES.missing
                          }`}
                        >
                          PG
                        </span>
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            judgment.stores?.elasticsearch ? STORE_BADGE_STYLES.present : STORE_BADGE_STYLES.missing
                          }`}
                        >
                          ES
                        </span>
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${STORE_BADGE_STYLES.qdrant}`}>
                          Qdrant {judgment.stores?.qdrantPoints || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-middle whitespace-nowrap text-slate-600">
                      <div className="text-sm">{formatDateTime(judgment.createdAt)}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Updated {formatDateTime(judgment.updatedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle}`}>
                        {prettyStatus(judgment.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-middle text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onInspect?.(judgment);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showPagination ? (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:flex-row">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500">Show</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                disabled={loading}
                className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400 disabled:opacity-50"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className="text-[11px] font-medium text-slate-500">per page</span>
            </div>

            <div className="text-[11px] text-slate-500">
              Showing {startCount}-{endCount} of {total}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={loading || currentPage === 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {visiblePages.map((pageNumber, index) => {
              const previous = visiblePages[index - 1];
              const showEllipsis = previous && pageNumber - previous > 1;

              return (
                <React.Fragment key={pageNumber}>
                  {showEllipsis ? (
                    <span className="px-0.5 text-[11px] text-slate-400">…</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(pageNumber)}
                    disabled={loading}
                    className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold transition disabled:opacity-60 ${
                      pageNumber === currentPage
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pageNumber}
                  </button>
                </React.Fragment>
              );
            })}

            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={loading || currentPage === totalPages}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default PipelineJudgmentTable;
