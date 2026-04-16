import React, { useState } from 'react';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatDuration } from '../judgement-service/helpers';

const ITEMS_PER_PAGE = 5;

const AnalyticsPanel = ({ analytics = [], analyticsLoading, onRefresh }) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const totalPages = Math.ceil(analytics.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedAnalytics = analytics.slice(startIndex, endIndex);
  
  const canGoPrevious = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;
  
  const handlePrevious = () => {
    if (canGoPrevious) {
      setCurrentPage(prev => prev - 1);
    }
  };
  
  const handleNext = () => {
    if (canGoNext) {
      setCurrentPage(prev => prev + 1);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Recent Search Analytics</h2>
          <p className="text-sm text-slate-500">
            Latest judment API requests stored in PostgreSQL with timing and result counts.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={analyticsLoading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Activity className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Endpoint</th>
                <th className="px-5 py-4">Success</th>
                <th className="px-5 py-4">Results</th>
                <th className="px-5 py-4">Duration</th>
                <th className="px-5 py-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
              {analyticsLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    Loading analytics...
                  </td>
                </tr>
              ) : analytics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No analytics rows yet.
                  </td>
                </tr>
              ) : (
                paginatedAnalytics.map((item) => (
                  <tr key={item.request_id}>
                    <td className="px-5 py-4 align-top">
                      <div className="font-semibold text-slate-900">{item.endpoint}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.request_id}</div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        item.success ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {item.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top">{item.result_count || 0}</td>
                    <td className="px-5 py-4 align-top">{formatDuration(item.total_duration_ms)}</td>
                    <td className="px-5 py-4 align-top">{formatDate(item.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-sm text-slate-500">
            Showing {startIndex + 1} to {Math.min(endIndex, analytics.length)} of {analytics.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={!canGoPrevious}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <div className="text-sm text-slate-600 px-3">
              Page {currentPage + 1} of {totalPages}
            </div>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AnalyticsPanel;