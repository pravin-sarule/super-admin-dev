import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Users,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
  X,
} from 'lucide-react';
import { getAnalytics, getAnalyticsHeartbeat, getAnalyticsUserDetails } from '../../../services/citationAdminApi';

const POLL_INTERVAL_MS = 10000; // 10 seconds

function formatNumber(n) {
  if (n == null) return '0';
  const x = Number(n);
  if (x >= 1e6) return `${(x / 1e6).toFixed(2)}M`;
  if (x >= 1e3) return `${(x / 1e3).toFixed(2)}K`;
  return x.toLocaleString();
}

function formatUnit(u) {
  if (!u) return '';
  return String(u).replace(/_/g, ' ');
}

function formatCurrencyInr(n) {
  if (n == null) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyUsd(n) {
  if (n == null) return '$0';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function serviceLabel(service) {
  const s = String(service || '').toLowerCase();
  if (s === 'gemini') return 'Gemini';
  if (s === 'claude') return 'Claude';
  if (s === 'document_ai') return 'Doc AI';
  if (s === 'india_kanoon' || s === 'indian_kanoon' || s === 'indiakanoon' || s === 'inidia_kanoon') return 'IK';
  return s ? s.replace(/_/g, ' ') : '—';
}

function serviceTagClass(service) {
  const s = String(service || '').toLowerCase();
  if (s === 'gemini') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (s === 'claude') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (s === 'document_ai') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'india_kanoon' || s === 'indian_kanoon' || s === 'indiakanoon' || s === 'inidia_kanoon') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function userInitials(userId) {
  const s = String(userId ?? '').trim();
  if (!s) return '—';
  return s.slice(0, 2).toUpperCase();
}

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

export default function CitationAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [heartbeat, setHeartbeat] = useState({ ok: false, lastCheck: null });
  const [lastRefresh, setLastRefresh] = useState(null);
  const [userPage, setUserPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await getAnalytics();
      if (res?.success && res?.data) {
        setData(res.data);
        setLastRefresh(new Date());
      } else {
        setError('Invalid response from analytics API');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHeartbeat = useCallback(async () => {
    try {
      const res = await getAnalyticsHeartbeat();
      setHeartbeat({
        ok: res?.success === true && res?.data?.ok === true,
        lastCheck: new Date(),
      });
    } catch {
      setHeartbeat({ ok: false, lastCheck: new Date() });
    }
  }, []);

  const openUserDetails = useCallback(async (userId) => {
    setSelectedUserId(String(userId));
    setUserError(null);
    setUserLoading(true);
    try {
      const res = await getAnalyticsUserDetails(userId);
      if (res?.success && res?.data) {
        setUserDetails(res.data);
      } else {
        setUserError('Invalid response for user analytics');
      }
    } catch (err) {
      setUserError(err?.response?.data?.error?.message || err.message || 'Failed to load user analytics');
    } finally {
      setUserLoading(false);
    }
  }, []);

  const closeUserDetails = useCallback(() => {
    setSelectedUserId(null);
    setUserDetails(null);
    setUserError(null);
    setUserLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => {
      fetchData();
      checkHeartbeat();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [fetchData, checkHeartbeat]);

  useEffect(() => {
    checkHeartbeat();
  }, [checkHeartbeat]);

  useEffect(() => {
    setUserPage(1);
  }, [data]);

  const scoreCards = data?.score_cards ?? [];
  const knownServices = ['gemini', 'claude', 'document_ai', 'india_kanoon'];
  const knownCards = scoreCards.filter((c) => knownServices.includes(c.service));
  const totalInr = data?.total_known_cost_inr ?? data?.total_platform_cost_inr ?? 0;
  const totalUsd = data?.total_known_cost_usd ?? data?.total_platform_cost_usd ?? 0;
  const userBreakdown = data?.user_breakdown ?? [];
  const syncedAt = data?.synced_at || (lastRefresh ? lastRefresh.toISOString() : null);
  /** Minutes since last successful sync (for optional UI / avoids stray ReferenceError if referenced) */
  const lastSyncedMinutesAgo =
    syncedAt != null
      ? Math.max(0, Math.round((Date.now() - new Date(syncedAt).getTime()) / 60000))
      : null;

  const PAGE_SIZE = 4;
  const totalUsers = userBreakdown.length;
  const totalPages = totalUsers ? Math.ceil(totalUsers / PAGE_SIZE) : 1;

  const pagedUsers = userBreakdown.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);
  const fromUser = totalUsers ? (userPage - 1) * PAGE_SIZE + 1 : 0;
  const toUser = totalUsers ? Math.min(userPage * PAGE_SIZE, totalUsers) : 0;
  const pagesToRender = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : [1, userPage - 1, userPage, userPage + 1, totalPages].filter(
        (p, idx, arr) => p >= 1 && p <= totalPages && arr.indexOf(p) === idx
      );

  return (
    <div className="citation-management p-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            Citation Analytics
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            API usage, costs by service, and user breakdown · Auto-refreshes every 10s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
              heartbeat.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {heartbeat.ok ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span>{heartbeat.ok ? 'Live' : 'Checking...'}</span>
          </div>
          {syncedAt && (
            <span className="text-xs text-slate-500" title={lastSyncedMinutesAgo != null ? `${lastSyncedMinutesAgo} min ago` : undefined}>
              Last synced: {formatDateTime(syncedAt)}
              {lastSyncedMinutesAgo != null && (
                <span className="text-slate-400"> · {lastSyncedMinutesAgo} min ago</span>
              )}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchData();
              checkHeartbeat();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Score cards (cost per service + total) */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Cost Score Cards (Gemini, Claude, Document AI, India Kanoon)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Total of the above 4 (aggregate) */}
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-600 p-4 shadow-sm text-white">
                <p className="text-xs font-semibold uppercase text-white/90">TOTAL AGGREGATE COST</p>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrencyInr(totalInr)}
                </p>
                <p className="text-xs text-white/80 mt-1">{formatCurrencyUsd(totalUsd)}</p>
              </div>

              {knownCards.map((card) => (
                <div
                  key={card.service}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="text-sm font-medium text-slate-600">{card.label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {formatCurrencyInr(card.total_cost_inr)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatCurrencyUsd(card.total_cost_usd)}
                  </p>
                </div>
              ))}
            </div>

            {knownCards.length === 0 && !loading && (
              <p className="mt-4 text-slate-500 text-sm">No service usage data yet.</p>
            )}
          </div>

          {/* User-wise Usage Detail */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  User-wise Usage Detail
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Granular breakdown of cloud consumption per identity.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
                  defaultValue="all"
                >
                  <option value="all">All Departments</option>
                </select>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      User Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Services Used
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Total Requests
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Cumulative Cost
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      Last Used
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                      &nbsp;
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {pagedUsers.map((row) => {
                    const servicesArr = Array.isArray(row.services_used) ? row.services_used : [];
                    const knownServicesArr = servicesArr
                      .filter((s) =>
                        ['gemini', 'claude', 'document_ai', 'india_kanoon', 'indian_kanoon', 'indiakanoon'].includes(
                          String(s || '').toLowerCase()
                        )
                      )
                      .slice(0, 3);
                    return (
                      <tr key={row.user_id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">
                              {userInitials(row.user_name || row.user_id)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">
                                {row.user_name || row.user_id || '—'}
                              </div>
                              {row.email && <div className="text-xs text-slate-500 truncate">{row.email}</div>}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          {knownServicesArr.length ? (
                            <div className="flex flex-wrap gap-2">
                              {knownServicesArr.map((svc) => (
                                <span
                                  key={svc}
                                  className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border ${serviceTagClass(svc)}`}
                                >
                                  {serviceLabel(svc)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right text-sm text-slate-700">
                          {formatNumber(row.total_quantity)} {formatUnit(row.unit_summary)}
                        </td>

                        <td className="px-6 py-4 text-right text-sm text-slate-700">
                          {formatCurrencyInr(row.total_cost_inr)}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span className="text-xs text-slate-500">{formatDateTime(row.last_used_at)}</span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openUserDetails(row.user_id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            View
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {pagedUsers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-500 text-sm">
                        No user data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-500">
                Showing {fromUser} to {toUser} of {totalUsers} users
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  &lt;
                </button>

                {pagesToRender.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setUserPage(p)}
                    className={`px-3 py-2 rounded-lg border text-sm ${
                      p === userPage
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setUserPage((p) => Math.min(totalPages, p + 1))}
                  disabled={userPage === totalPages}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* User detail modal */}
      {selectedUserId && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  User Analytics: {userDetails?.user_name || selectedUserId}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {userDetails?.email || 'No email'} · Last used: {formatDateTime(userDetails?.totals?.last_used_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeUserDetails}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {userLoading ? (
                <div className="py-10 text-center text-slate-500">Loading user analytics...</div>
              ) : userError ? (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{userError}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase">Total Cost (INR)</p>
                      <p className="text-lg font-semibold text-slate-900 mt-1">
                        {formatCurrencyInr(userDetails?.totals?.total_cost_inr)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase">Total Cost (USD)</p>
                      <p className="text-lg font-semibold text-slate-900 mt-1">
                        {formatCurrencyUsd(userDetails?.totals?.total_cost_usd)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase">Requests</p>
                      <p className="text-lg font-semibold text-slate-900 mt-1">
                        {formatNumber(userDetails?.totals?.total_quantity)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase">Records</p>
                      <p className="text-lg font-semibold text-slate-900 mt-1">
                        {formatNumber(userDetails?.totals?.record_count)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-800">
                      Service Breakdown (Gemini / Claude / Document AI / India Kanoon)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Service</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Quantity</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">INR</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">USD</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Last Used</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(userDetails?.service_breakdown || []).map((row) => (
                            <tr key={row.service}>
                              <td className="px-4 py-2 text-sm text-slate-700">{serviceLabel(row.service)}</td>
                              <td className="px-4 py-2 text-sm text-slate-700 text-right">
                                {formatNumber(row.total_quantity)} {formatUnit(row.unit_summary)}
                              </td>
                              <td className="px-4 py-2 text-sm text-slate-700 text-right">{formatCurrencyInr(row.total_cost_inr)}</td>
                              <td className="px-4 py-2 text-sm text-slate-700 text-right">{formatCurrencyUsd(row.total_cost_usd)}</td>
                              <td className="px-4 py-2 text-sm text-slate-500 text-right">{formatDateTime(row.last_used_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-800">
                      Usage Timeline
                    </div>
                    <div className="overflow-x-auto max-h-80">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-white sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">When Used</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Service</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Operation</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Qty</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">INR</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Time (ms)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(userDetails?.timeline || []).map((row) => (
                            <tr key={row.id}>
                              <td className="px-4 py-2 text-xs text-slate-700">{formatDateTime(row.created_at)}</td>
                              <td className="px-4 py-2 text-xs text-slate-700">{serviceLabel(row.service)}</td>
                              <td className="px-4 py-2 text-xs text-slate-600">{row.operation || '—'}</td>
                              <td className="px-4 py-2 text-xs text-slate-700 text-right">{formatNumber(row.quantity)} {formatUnit(row.unit)}</td>
                              <td className="px-4 py-2 text-xs text-slate-700 text-right">{formatCurrencyInr(row.cost_inr)}</td>
                              <td className="px-4 py-2 text-xs text-slate-500 text-right">
                                {row.usage_time_ms != null ? formatNumber(row.usage_time_ms) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
