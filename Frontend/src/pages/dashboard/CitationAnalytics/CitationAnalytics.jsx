import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  Users,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
  X,
  Download,
  Loader2,
  AlertTriangle,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import {
  getAnalytics,
  getAnalyticsHeartbeat,
  getAnalyticsUserDetails,
  getAnalyticsDepartments,
  getAnalyticsSessions,
  downloadAnalyticsCsv,
} from '../../../services/citationAdminApi';
import RateCardPanel from './RateCardPanel';
import SessionCostModal from './SessionCostModal';

const SESSION_PAGE_SIZE = 10;

// Each poll now runs range-scoped aggregates over an append-only table that grows with
// every API call, so 10s (fine against the old dormant table) is too eager.
const POLL_INTERVAL_MS = 30000; // 30 seconds
const PAGE_SIZE = 4;

/**
 * All filtering is in IST — the table renders with toLocaleString('en-IN') and the
 * backend buckets on Asia/Kolkata. 'en-CA' formats as YYYY-MM-DD, so this avoids the
 * off-by-one that toISOString() would cause on a UTC server for 5.5 hours a day.
 */
const IST_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
const istToday = () => IST_DATE.format(new Date());
const istDaysAgo = (n) => IST_DATE.format(new Date(Date.now() - n * 86400000));

const RANGE_PRESETS = [
  { id: 'today', label: 'Today', from: () => istToday() },
  { id: '7d', label: '7 days', from: () => istDaysAgo(6) },
  { id: '30d', label: '30 days', from: () => istDaysAgo(29) },
  { id: '90d', label: '90 days', from: () => istDaysAgo(89) },
  { id: 'mtd', label: 'Month to date', from: () => `${istToday().slice(0, 7)}-01` },
  { id: 'all', label: 'All time', from: () => '2024-01-01' },
];

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

const IK_ALIASES = ['india_kanoon', 'indian_kanoon', 'indiakanoon', 'inidia_kanoon'];

function serviceLabel(service) {
  const s = String(service || '').toLowerCase();
  if (s === 'gemini') return 'Gemini';
  if (s === 'claude') return 'Claude';
  if (s === 'document_ai') return 'Doc AI';
  if (s === 'serper') return 'Serper';
  if (s === 'openai') return 'OpenAI';
  if (IK_ALIASES.includes(s)) return 'IK';
  return s ? s.replace(/_/g, ' ') : '—';
}

function serviceTagClass(service) {
  const s = String(service || '').toLowerCase();
  if (s === 'gemini') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (s === 'claude') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (s === 'document_ai') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'serper') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (IK_ALIASES.includes(s)) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function userInitials(userId) {
  const s = String(userId ?? '').trim();
  if (!s || s.toLowerCase() === 'unknown / anonymous') return '?';
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

  // Filters
  const [preset, setPreset] = useState('30d');
  const [range, setRange] = useState({ from: istDaysAgo(29), to: istToday() });
  const [department, setDepartment] = useState('all');
  const [departments, setDepartments] = useState([{ id: 'all', name: 'All Departments' }]);

  // Export + rate card
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [showRateCard, setShowRateCard] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [sessionMeta, setSessionMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // Poll indicator, distinct from the full-page `loading` spinner
  const [refreshing, setRefreshing] = useState(false);
  // Drops out-of-order responses: a filter change and a poll can be in flight together,
  // and a slow wide-range response landing after a fast narrow one would render stale data.
  const reqSeq = useRef(0);

  const fetchData = useCallback(async () => {
    const seq = reqSeq.current + 1;
    reqSeq.current = seq;
    try {
      setError(null);
      setRefreshing(true);
      const res = await getAnalytics({
        from: range.from,
        to: range.to,
        department,
        page: userPage,
        pageSize: PAGE_SIZE,
      });
      if (seq !== reqSeq.current) return; // a newer request already answered
      if (res?.success && res?.data) {
        setData(res.data);
        setLastRefresh(new Date());
      } else {
        setError('Invalid response from analytics API');
      }
    } catch (err) {
      if (seq !== reqSeq.current) return;
      setError(err.response?.data?.error?.message || err.message || 'Failed to load analytics');
      setData(null);
    } finally {
      if (seq === reqSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range.from, range.to, department, userPage]);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await getAnalyticsSessions({
        from: range.from,
        to: range.to,
        department,
        page: sessionPage,
        pageSize: SESSION_PAGE_SIZE,
      });
      if (res?.success && res?.data) {
        setSessions(res.data.sessions || []);
        setSessionMeta(res.data.pagination || { page: 1, total: 0, totalPages: 1 });
      }
    } catch {
      setSessions([]);
      setSessionMeta({ page: 1, total: 0, totalPages: 1 });
    } finally {
      setSessionsLoading(false);
    }
  }, [range.from, range.to, department, sessionPage]);

  const applyPreset = useCallback((p) => {
    setPreset(p.id);
    setRange({ from: p.from(), to: istToday() });
  }, []);

  const handleExportCsv = useCallback(async () => {
    setExportError(null);
    setExporting(true);
    try {
      const { blob, filename } = await downloadAnalyticsCsv({
        from: range.from,
        to: range.to,
        department,
        scope: 'users',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // With responseType 'blob' an error body arrives as a Blob, so the message is generic.
      setExportError(err?.response?.data?.error?.message || err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [range.from, range.to, department]);

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
      const res = await getAnalyticsUserDetails(userId, { from: range.from, to: range.to });
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
  }, [range.from, range.to]);

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
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    // Pause polling while the rate card panel or a session modal is open, or a refresh
    // will fight the form / swap the data under the reader.
    if (showRateCard || selectedSessionId) return undefined;
    const t = setInterval(() => {
      fetchData();
      fetchSessions();
      checkHeartbeat();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [fetchData, fetchSessions, checkHeartbeat, showRateCard, selectedSessionId]);

  useEffect(() => {
    checkHeartbeat();
  }, [checkHeartbeat]);

  // Load the department dropdown once. Failure leaves it at "All Departments".
  useEffect(() => {
    let alive = true;
    getAnalyticsDepartments()
      .then((res) => {
        if (alive && res?.success && Array.isArray(res.data?.departments)) {
          setDepartments(res.data.departments);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Reset to page 1 when the FILTERS change — not on every `data` change.
   * The previous `[data]` dependency fired on every poll (setData always makes a new
   * object), so anyone browsing page 2 was bounced back to page 1 every 10 seconds.
   */
  useEffect(() => {
    setUserPage(1);
    setSessionPage(1);
  }, [range.from, range.to, department]);

  // Server-side paging can leave us on a page that no longer exists.
  useEffect(() => {
    const tp = data?.pagination?.totalPages;
    if (tp && userPage > tp) setUserPage(tp);
  }, [data?.pagination?.totalPages, userPage]);

  const scoreCards = data?.score_cards ?? [];
  const knownCards = scoreCards; // backend already returns the 4 known + any extras, cost-ordered
  // Use the PLATFORM total, not total_known_*. The latter sums only gemini/claude/document_ai/
  // india_kanoon, so any other service the engine emits (judgement_ai, serper) renders as its
  // own card while being silently excluded from the aggregate — the cards then don't add up.
  const totalInr = data?.total_platform_cost_inr ?? 0;
  const totalUsd = data?.total_platform_cost_usd ?? 0;
  const userBreakdown = data?.user_breakdown ?? [];
  const sectionErrors = data?.section_errors ?? [];
  const unpricedRecords = Number(data?.unpriced_records ?? 0);
  const syncedAt = data?.synced_at || (lastRefresh ? lastRefresh.toISOString() : null);
  /** Minutes since last successful sync (for optional UI / avoids stray ReferenceError if referenced) */
  const lastSyncedMinutesAgo =
    syncedAt != null
      ? Math.max(0, Math.round((Date.now() - new Date(syncedAt).getTime()) / 60000))
      : null;

  // Pagination is server-side now: `userBreakdown` IS the current page.
  const pageMeta = data?.pagination ?? {
    page: userPage,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };
  const totalUsers = pageMeta.total;
  const totalPages = Math.max(1, pageMeta.totalPages || 1);
  const pagedUsers = userBreakdown;
  const fromUser = totalUsers ? (pageMeta.page - 1) * pageMeta.pageSize + 1 : 0;
  const toUser = totalUsers ? Math.min(pageMeta.page * pageMeta.pageSize, totalUsers) : 0;
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
            Per-call API cost by service and user · {range.from} → {range.to} (IST) ·
            Auto-refreshes every 30s
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
            onClick={() => setShowRateCard(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            Rate Card
          </button>
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
            <RefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date range filter */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                preset === p.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => {
              setPreset('custom');
              setRange((r) => ({ ...r, from: e.target.value }));
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-slate-400 text-sm">→</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            max={istToday()}
            onChange={(e) => {
              setPreset('custom');
              setRange((r) => ({ ...r, to: e.target.value }));
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-400">IST</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {sectionErrors.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Some data could not be loaded:{' '}
            {sectionErrors.map((s) => s.section || String(s)).join(', ')}. Figures below may be
            incomplete.
          </span>
        </div>
      )}

      {unpricedRecords > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>{unpricedRecords.toLocaleString('en-IN')}</strong> event(s) in this range have
            no matching rate card entry and are counted at ₹0. Open{' '}
            <button
              type="button"
              onClick={() => setShowRateCard(true)}
              className="underline font-medium hover:text-amber-900"
            >
              Rate Card
            </button>{' '}
            to add the missing model or operation.
          </span>
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
                {exportError && (
                  <p className="text-xs text-red-600 mt-1">{exportError}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <select
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.user_count != null ? ` (${d.user_count})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-slate-500" />
                  )}
                  {exporting ? 'Exporting…' : 'Export CSV'}
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
                      Department
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
                    // Show every service the backend reports — the old hard-coded allow-list
                    // rendered an empty cell for serper / embedding rows.
                    const shownServices = servicesArr.slice(0, 3);
                    const extraServices = servicesArr.length - shownServices.length;
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
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-slate-50 text-slate-600 border border-slate-200">
                            {row.department || 'Unassigned'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {shownServices.length ? (
                            <div className="flex flex-wrap gap-2">
                              {shownServices.map((svc) => (
                                <span
                                  key={svc}
                                  className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border ${serviceTagClass(svc)}`}
                                >
                                  {serviceLabel(svc)}
                                </span>
                              ))}
                              {extraServices > 0 && (
                                <span
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border bg-slate-50 text-slate-600 border-slate-200"
                                  title={servicesArr.map(serviceLabel).join(', ')}
                                >
                                  +{extraServices}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>

                        {/* Requests = call count. total_quantity on a Gemini row is a TOKEN
                            count, which read as "10.35K calls" under this header. */}
                        <td className="px-6 py-4 text-right text-sm text-slate-700">
                          {formatNumber(row.total_calls ?? row.total_quantity)}
                          <span className="text-xs text-slate-400 ml-1">
                            {row.total_calls != null ? 'calls' : formatUnit(row.unit_summary)}
                          </span>
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
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-sm">
                        No usage between {range.from} and {range.to}
                        {department !== 'all' ? ' for this department' : ''}.
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

          {/* Session Cost Breakdown */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Session &amp; Run Cost Breakdown
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                One row per search run. A session accumulates many runs, so each run is
                costed separately. Click a row for the per-model and per-API split.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      ['Run', 'left'],
                      ['Session', 'left'],
                      ['User', 'left'],
                      ['Services', 'left'],
                      ['Calls', 'right'],
                      ['AI Cost', 'right'],
                      ['API Cost', 'right'],
                      ['Total Cost', 'right'],
                      ['Run Time', 'right'],
                    ].map(([h, align]) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-${align} text-xs font-semibold text-slate-600 uppercase whitespace-nowrap`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => (
                    <tr
                      key={`${s.session_id}|${s.run_id ?? ''}`}
                      onClick={() =>
                        setSelectedSessionId({ sessionId: s.session_id, runId: s.run_id ?? '' })
                      }
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="text-xs font-mono text-slate-700">
                          {s.run_id ? `${String(s.run_id).slice(0, 12)}…` : '—'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {s.case_id ? `case ${s.case_id} · ` : ''}
                          {s.event_count} events
                          {s.unpriced_count > 0 && (
                            <span className="text-amber-600"> · {s.unpriced_count} unpriced</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-[11px] font-mono text-slate-500">
                          {String(s.session_id).slice(0, 10)}…
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm text-slate-800">{s.user_name}</div>
                        {s.email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {s.email}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(s.services_used || []).slice(0, 3).map((svc) => (
                            <span
                              key={svc}
                              className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${serviceTagClass(svc)}`}
                            >
                              {serviceLabel(svc)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-slate-700">
                        {formatNumber(s.total_calls)}
                        {s.cache_hits > 0 && (
                          <div className="text-[11px] text-emerald-600">
                            {s.cache_hits} cached
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-slate-600">
                        {formatCurrencyInr(s.ai_cost_inr)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-slate-600">
                        {formatCurrencyInr(s.api_cost_inr)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                        {formatCurrencyInr(s.total_cost_inr)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs text-slate-500">
                          {formatDateTime(s.last_event_at)}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 inline ml-2" />
                      </td>
                    </tr>
                  ))}

                  {sessions.length === 0 && !sessionsLoading && (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-slate-500 text-sm">
                        No runs between {range.from} and {range.to}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-500">
                {sessionMeta.total
                  ? `Showing ${(sessionMeta.page - 1) * SESSION_PAGE_SIZE + 1} to ${Math.min(
                      sessionMeta.page * SESSION_PAGE_SIZE,
                      sessionMeta.total
                    )} of ${sessionMeta.total} runs`
                  : '0 runs'}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                  disabled={sessionPage === 1}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  &lt;
                </button>
                <span className="px-3 py-2 text-sm text-slate-600">
                  {sessionMeta.page} / {Math.max(1, sessionMeta.totalPages)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSessionPage((p) => Math.min(sessionMeta.totalPages || 1, p + 1))
                  }
                  disabled={sessionPage >= (sessionMeta.totalPages || 1)}
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
                  {userDetails?.email || 'No email'} · {userDetails?.department || 'Unassigned'} ·
                  Last used: {formatDateTime(userDetails?.totals?.last_used_at)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {range.from} → {range.to} (IST)
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

      {/* Run / session cost breakdown modal */}
      {selectedSessionId && (
        <SessionCostModal
          sessionId={selectedSessionId.sessionId}
          runId={selectedSessionId.runId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}

      {/* Rate card admin panel */}
      {showRateCard && (
        <RateCardPanel
          onClose={() => {
            setShowRateCard(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
