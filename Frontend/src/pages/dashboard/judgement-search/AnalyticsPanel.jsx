import { Activity } from 'lucide-react';
import { formatDate, formatDuration } from '../judgement-service/helpers';

const AnalyticsPanel = ({ analytics = [], analyticsLoading, onRefresh }) => (
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
              analytics.map((item) => (
                <tr key={item.request_id}>
                  <td className="px-5 py-4 align-top">
                    <div className="font-semibold text-slate-900">{item.endpoint}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.request_id}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.success ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
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
  </section>
);

export default AnalyticsPanel;
