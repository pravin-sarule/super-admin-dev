import React from 'react';
import { ChevronLeft, ChevronRight, Eye, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { formatDateTime, prettyStatus } from './helpers';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_STYLES = {
  uploaded: 'border-sky-200 bg-sky-50 text-sky-700',
  indexed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
};

const STORE_BADGE_STYLES = {
  present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  missing: 'border-slate-200 bg-slate-100 text-slate-500',
  qdrant: 'border-violet-200 bg-violet-50 text-violet-700',
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startCount = total === 0 ? 0 : meta.offset + 1;
  const endCount = Math.min(total, meta.offset + judgments.length);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Inserted Judgments</h2>
            <p className="text-sm text-slate-500">
              These are the judgments inserted by the Indian Kanoon fallback pipeline.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search case, canonical id, court"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-blue-400 md:w-72"
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
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Case</th>
                <th className="px-5 py-4">Canonical ID</th>
                <th className="px-5 py-4">Court / Date</th>
                <th className="px-5 py-4">Stores</th>
                <th className="px-5 py-4">Inserted</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-500">
                    <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
                    Loading pipeline judgments...
                  </td>
                </tr>
              ) : judgments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-500">
                    No `ik_pipeline` judgments match the current search.
                  </td>
                </tr>
              ) : (
                judgments.map((judgment) => {
                  const statusStyle = STATUS_STYLES[judgment.status] || 'border-slate-200 bg-slate-100 text-slate-600';

                  return (
                    <tr key={judgment.judgmentUuid} className="hover:bg-slate-50">
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-slate-900">{judgment.caseName || 'Case name missing'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {judgment.year ? `Year ${judgment.year}` : 'Year unavailable'}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="font-medium text-slate-800">{judgment.canonicalId || 'N/A'}</div>
                        <div className="mt-1 text-xs text-slate-500">{judgment.judgmentUuid}</div>
                      </td>
                      <td className="px-5 py-4 align-top text-slate-600">
                        <div>{judgment.courtCode || 'Court unavailable'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {judgment.judgmentDate ? formatDateTime(judgment.judgmentDate) : 'Judgment date unavailable'}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STORE_BADGE_STYLES.present}`}>
                            PG
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                              judgment.stores.elasticsearch ? STORE_BADGE_STYLES.present : STORE_BADGE_STYLES.missing
                            }`}
                          >
                            ES
                          </span>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STORE_BADGE_STYLES.qdrant}`}>
                            Qdrant {judgment.stores.qdrantPoints || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top text-slate-600">
                        <div>{formatDateTime(judgment.createdAt)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Updated {formatDateTime(judgment.updatedAt)}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle}`}>
                          {prettyStatus(judgment.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top text-right">
                        <button
                          type="button"
                          onClick={() => onInspect?.(judgment)}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
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

        {!loading && total > 0 ? (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 px-5 py-4 md:flex-row">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Show</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-medium text-slate-500">per page</span>
              </div>

              <div className="text-xs text-slate-500">
                Showing {startCount}-{endCount} of {total} judgments
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default PipelineJudgmentTable;
