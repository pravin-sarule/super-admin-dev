import React, { useState, useEffect } from 'react';
import { Building2, Link2, Globe, Database } from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { getRoutesDbSummary, getRoutesDbTopCited, getRoutesDbCourtsBreakdown } from '../../../services/citationAdminApi';

function formatNum(n) {
  if (n == null || n === '') return '0';
  const num = Number(n);
  return isNaN(num) ? '0' : num.toLocaleString('en-IN');
}

export default function RoutesDBView() {
  const [summary, setSummary] = useState(null);
  const [topCited, setTopCited] = useState([]);
  const [courtsBreakdown, setCourtsBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    Promise.all([
      getRoutesDbSummary().then((r) => (r?.success ? r.data : null)),
      getRoutesDbTopCited(10).then((r) => (r?.success && Array.isArray(r.data) ? r.data : r?.data ?? [])),
      getRoutesDbCourtsBreakdown().then((r) => (r?.success && Array.isArray(r.data) ? r.data : r?.data ?? [])),
    ])
      .then(([sum, top, courts]) => {
        setSummary(sum || {});
        setTopCited(Array.isArray(top) ? top : []);
        setCourtsBreakdown(Array.isArray(courts) ? courts : []);
      })
      .catch((err) => setErrorMsg(err.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  // Real API: { court_tier: "unknown", court_code: "SC", count: 8 }
  // court_tier is "unknown" for all rows — use court_code as the meaningful label.
  const chartData = courtsBreakdown.slice(0, 10).map((row) => ({
    name: row.court_code || row.court_name || row.court_tier || '—',
    count: Number(row.count ?? row.total ?? 0),
  }));

  return (
    <div className="min-h-full bg-gray-100/80 rounded-2xl p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Route Performance & Citation DB</h1>
          <p className="text-sm text-gray-500 mt-0.5">Database insights and citation analytics</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{errorMsg}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="p-2 rounded-lg bg-gray-100 w-fit">
            <Database className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">
            {loading ? '—' : formatNum(summary?.total_judgments)}
          </p>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Total Judgments</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="p-2 rounded-lg bg-gray-100 w-fit">
            <Link2 className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">
            {loading ? '—' : formatNum(summary?.total_aliases)}
          </p>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Total Aliases</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="p-2 rounded-lg bg-gray-100 w-fit">
            <Building2 className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-2xl font-bold text-green-600 mt-3">
            {loading ? '—' : formatNum(summary?.verified_count)}
          </p>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Verified</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="p-2 rounded-lg bg-gray-100 w-fit">
            <Globe className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-3">
            {loading ? '—' : formatNum(summary?.unverified_count)}
          </p>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Unverified</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 min-h-[320px]">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Courts / Hierarchy</h3>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : chartData.length === 0 ? (
            <p className="text-gray-500 text-sm">No data</p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Legend />
                  <Bar dataKey="count" name="Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 min-h-[320px]">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Top Cited</h3>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : topCited.length === 0 ? (
            <p className="text-gray-500 text-sm">No data</p>
          ) : (
            <ul className="space-y-2 max-h-[280px] overflow-y-auto">
              {topCited.slice(0, 15).map((item, i) => {
                // Real API: { canonical_id, court_code, citation_frequency, verification_status }
                const label = item.canonical_id || item.citation_string || item.name || '—';
                const freq = Number(item.citation_frequency ?? item.count ?? 0);
                const vs = item.verification_status || '';
                const vsColor =
                  vs === 'VERIFIED' ? 'text-green-600' :
                    vs === 'VERIFIED_WARN' ? 'text-amber-600' :
                      'text-gray-400';
                return (
                  <li key={item.judgment_uuid || i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-slate-800 truncate font-medium">{label}</p>
                      {item.court_code && (
                        <p className={`text-xs truncate mt-0.5 ${vsColor}`}>
                          {item.court_code}{vs ? ` · ${vs}` : ''}
                        </p>
                      )}
                    </div>
                    <span className="text-blue-600 font-semibold flex-shrink-0">
                      {freq.toLocaleString()}
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
