import React, { useState, useEffect } from 'react';
import { FileText, Users, TrendingUp } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { getBusinessSummary, getBusinessReportsPerDay, getBusinessTopUsers } from '../../../services/citationAdminApi';

function formatNum(n) {
  if (n == null || n === '') return '0';
  const num = Number(n);
  return isNaN(num) ? '0' : num.toLocaleString('en-IN');
}

export default function BusinessMetricsView() {
  const [summary, setSummary] = useState(null);
  const [reportsPerDay, setReportsPerDay] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    Promise.all([
      getBusinessSummary().then((r) => (r?.success ? r.data : null)),
      getBusinessReportsPerDay(30).then((r) => (r?.success && Array.isArray(r.data) ? r.data : r?.data ?? [])),
      getBusinessTopUsers(10).then((r) => (r?.success && Array.isArray(r.data) ? r.data : r?.data ?? [])),
    ])
      .then(([sum, perDay, users]) => {
        setSummary(sum || {});
        setReportsPerDay(Array.isArray(perDay) ? perDay : []);
        setTopUsers(Array.isArray(users) ? users : []);
      })
      .catch((err) => setErrorMsg(err.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  // Real API: [{ date: "2026-03-04T18:30:00.000Z", report_count: 3 }]
  const chartData = reportsPerDay
    .slice(0, 30)
    .map((row) => ({
      date: row.date
        ? new Date(row.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        : row.day || '—',
      reports: Number(row.report_count ?? row.count ?? row.reports ?? 0),
    }))
    .reverse();

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 rounded-2xl p-6 lg:p-7 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Business Metrics</h1>
          <p className="text-sm text-slate-500 mt-1">High‑level view of citation volume and user activity.</p>
        </div>
        {!loading && summary && (
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Last {Math.min(30, chartData.length || 30)} days · {formatNum(summary?.total_reports)} reports
          </p>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">{errorMsg}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Reports</span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="skeleton h-7 w-20 rounded-md" />
            ) : (
              <p className="text-2xl font-semibold text-slate-900">{formatNum(summary?.total_reports)}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">Total citation reports generated across all users.</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg Citations / Report</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="skeleton h-7 w-16 rounded-md" />
            ) : (
              <p className="text-2xl font-semibold text-slate-900">
                {summary?.avg_citations_per_report != null
                  ? parseFloat(summary.avg_citations_per_report).toFixed(1)
                  : '—'}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">Average number of citations included in each report.</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Top Users (shown)</span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="skeleton h-7 w-10 rounded-md" />
            ) : (
              <p className="text-2xl font-semibold text-slate-900">{formatNum(topUsers.length)}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">Users ranked by reports and total citations.</p>
          </div>
        </div>
      </div>

      {/* Charts & lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/90 rounded-xl border border-slate-200 shadow-sm p-5 h-[320px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Reports per day (last 30 days)</h3>
            <span className="text-[11px] text-slate-400 uppercase tracking-wide">Volume trend</span>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="skeleton h-[140px] w-full rounded-lg" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-400 text-sm">No data available for the selected period.</p>
            </div>
          ) : (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="reports"
                    stroke="#22c55e"
                    fill="url(#reportsGradient)"
                    fillOpacity={1}
                    strokeWidth={2}
                    name="Reports"
                  />
                  <defs>
                    <linearGradient id="reportsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white/90 rounded-xl border border-slate-200 shadow-sm p-5 min-h-[320px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Top Users</h3>
            <span className="text-[11px] text-slate-400 uppercase tracking-wide">By reports &amp; citations</span>
          </div>
          {loading ? (
            <div className="flex-1 space-y-2">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="skeleton h-10 w-full rounded-md" />
              ))}
            </div>
          ) : topUsers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-400 text-sm">No user activity recorded yet.</p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
              {topUsers.map((user, i) => {
                // Real API: { user_id, total_reports, total_citations, email (may be null), username (may be null) }
                const displayName =
                  user.email || user.username
                    ? user.email || user.username
                    : user.user_id === 'anonymous'
                      ? 'Anonymous User'
                      : `User ${user.user_id}`;
                return (
                  <li
                    key={user.user_id || i}
                    className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0"
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-medium text-slate-800 truncate">{displayName}</p>
                      <p className="text-xs text-slate-500">
                        {formatNum(user.total_reports)} reports · {formatNum(user.total_citations)} citations
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 flex-shrink-0 bg-blue-50 rounded-full px-2 py-1">
                      #{i + 1}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
