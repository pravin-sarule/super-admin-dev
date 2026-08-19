import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  Users,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
  ChevronLeft,
  X,
  Download,
  Loader2,
  AlertTriangle,
  SlidersHorizontal,
  Layers,
  Filter,
  Building2,
  Sparkles,
  Bot,
  ScanText,
  Scale,
  Search,
  Cpu,
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

/** Icon + colour per service, so a score card is identifiable before its label is read. */
const SERVICE_ACCENTS = {
  gemini: { Icon: Sparkles, chip: 'bg-blue-50 text-blue-600', bar: 'bg-blue-500' },
  claude: { Icon: Bot, chip: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
  document_ai: { Icon: ScanText, chip: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  india_kanoon: { Icon: Scale, chip: 'bg-indigo-50 text-indigo-600', bar: 'bg-indigo-500' },
  serper: { Icon: Search, chip: 'bg-rose-50 text-rose-600', bar: 'bg-rose-500' },
  openai: { Icon: Cpu, chip: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
};
const DEFAULT_ACCENT = { Icon: Layers, chip: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500' };

function serviceAccent(service) {
  const s = String(service || '').toLowerCase();
  if (IK_ALIASES.includes(s)) return SERVICE_ACCENTS.india_kanoon;
  return SERVICE_ACCENTS[s] || DEFAULT_ACCENT;
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

/**
 * Shared column header styling for both tables.
 * Alignment and padding are passed as whole literal class names — Tailwind scans source
 * text, so an interpolated `text-${align}` would never be generated.
 */
const TH_ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

function Th({ children, align = 'left', pad = 'px-5 py-3', className = '' }) {
  return (
    <th
      className={`${pad} ${TH_ALIGN[align] || TH_ALIGN.left} text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

/** Card header: icon chip + title + one-line description, with room for actions. */
function SectionHeader({ icon, title, description, children }) {
  const Icon = icon;
  return (
    <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
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

  const pagerBtn =
    'w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed';

  return (
    <div className="citation-management min-h-full w-full bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 rounded-2xl p-5 lg:p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <BarChart3 className="w-5 h-5 text-white" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 leading-tight">
              Citation Analytics
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Per-call API cost by service, user and run ·{' '}
              <span className="font-medium text-slate-600">
                {range.from} → {range.to}
              </span>
              <span className="text-slate-400"> (IST) · auto-refreshes every 30s</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
              heartbeat.ok
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}
          >
            {heartbeat.ok ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {heartbeat.ok ? 'Live' : 'Checking…'}
          </span>

          {syncedAt && (
            <span
              className="hidden md:inline-flex items-center px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white/70 text-xs text-slate-500"
              title={lastSyncedMinutesAgo != null ? `${lastSyncedMinutesAgo} min ago` : undefined}
            >
              Synced {formatDateTime(syncedAt)}
              {lastSyncedMinutesAgo != null && (
                <span className="text-slate-400 ml-1">· {lastSyncedMinutesAgo}m ago</span>
              )}
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowRateCard(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
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
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <RefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filter toolbar (range + department apply to every panel below) ── */}
      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm px-3 py-3 lg:px-4 flex flex-col 2xl:flex-row 2xl:items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            Range
          </span>
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                aria-pressed={preset === p.id}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  preset === p.id
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden 2xl:block h-6 w-px bg-slate-200 shrink-0" />

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => {
              setPreset('custom');
              setRange((r) => ({ ...r, from: e.target.value }));
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
          />
          <span className="text-slate-300 text-xs">→</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            max={istToday()}
            onChange={(e) => {
              setPreset('custom');
              setRange((r) => ({ ...r, to: e.target.value }));
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
          />
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            IST
          </span>
        </div>

        <div className="flex items-center gap-2 2xl:ml-auto">
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
            <Building2 className="w-3.5 h-3.5" />
            Dept
          </span>
          <select
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 min-w-[190px] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
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
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {sectionErrors.length > 0 && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Some data could not be loaded:{' '}
            {sectionErrors.map((s) => s.section || String(s)).join(', ')}. Figures below may be
            incomplete.
          </span>
        </div>
      )}

      {unpricedRecords > 0 && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
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
        <div className="flex flex-col justify-center items-center py-24 gap-3">
          <div className="animate-spin rounded-full h-9 w-9 border-2 border-slate-200 border-t-blue-600" />
          <p className="text-sm text-slate-400">Loading cost events…</p>
        </div>
      ) : (
        <>
          {/* ── Cost score cards ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Cost by service
              </h2>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {knownCards.length} service{knownCards.length === 1 ? '' : 's'} · share of total
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 lg:gap-4">
              {/* Platform total — every service, including any the engine adds later */}
              <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm ring-1 ring-blue-500/20 px-4 py-4 text-white flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white/80">
                    Total aggregate
                  </span>
                  <span className="p-1.5 rounded-lg bg-white/15">
                    <Layers className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums leading-none">
                  {formatCurrencyInr(totalInr)}
                </p>
                <p className="mt-1 text-xs text-white/70 tabular-nums">
                  {formatCurrencyUsd(totalUsd)}
                </p>
                <div className="mt-auto pt-3">
                  <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
                    <div className="h-full w-full rounded-full bg-white/80" />
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/70">All services combined</p>
                </div>
              </div>

              {knownCards.map((card) => {
                const { Icon, chip, bar } = serviceAccent(card.service);
                const cost = Number(card.total_cost_inr || 0);
                const share = totalInr > 0 ? Math.min(100, (cost / totalInr) * 100) : 0;
                return (
                  <div
                    key={card.service}
                    className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm px-4 py-4 flex flex-col transition-all hover:shadow-md hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">
                        {card.label}
                      </span>
                      <span className={`p-1.5 rounded-lg shrink-0 ${chip}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-900 tabular-nums leading-none">
                      {formatCurrencyInr(cost)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 tabular-nums">
                      {formatCurrencyUsd(card.total_cost_usd)}
                    </p>
                    <div className="mt-auto pt-3">
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${bar}`}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
                        {share.toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {knownCards.length === 0 && !loading && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 py-10 text-center">
                <p className="text-sm text-slate-500">No service usage in this range.</p>
              </div>
            )}
          </section>

          {/* ── User-wise Usage Detail ── */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <SectionHeader
              icon={Users}
              title="User-wise Usage Detail"
              description="Granular breakdown of cloud consumption per identity."
            >
              {exportError && (
                <span className="text-xs text-red-600 max-w-[240px] truncate" title={exportError}>
                  {exportError}
                </span>
              )}
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-slate-400" />
                )}
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </SectionHeader>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <Th>User</Th>
                    <Th>Department</Th>
                    <Th>Services Used</Th>
                    <Th align="right">Total Requests</Th>
                    <Th align="right">Cumulative Cost</Th>
                    <Th align="right">Last Used</Th>
                    <Th align="right" className="w-px">
                      &nbsp;
                    </Th>
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
                      <tr key={row.user_id} className="transition-colors hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 ring-1 ring-slate-200 flex items-center justify-center text-xs font-semibold shrink-0">
                              {userInitials(row.user_name || row.user_id)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">
                                {row.user_name || row.user_id || '—'}
                              </div>
                              {row.email && (
                                <div className="text-xs text-slate-400 truncate">{row.email}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-slate-50 text-slate-600 border border-slate-200">
                            {row.department || 'Unassigned'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          {shownServices.length ? (
                            <div className="flex flex-wrap gap-1.5">
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
                        <td className="px-5 py-3.5 text-right text-sm text-slate-700 tabular-nums whitespace-nowrap">
                          {formatNumber(row.total_calls ?? row.total_quantity)}
                          <span className="text-xs text-slate-400 ml-1">
                            {row.total_calls != null ? 'calls' : formatUnit(row.unit_summary)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrencyInr(row.total_cost_inr)}
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <span className="text-xs text-slate-500">
                            {formatDateTime(row.last_used_at)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => openUserDetails(row.user_id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                        No usage between {range.from} and {range.to}
                        {department !== 'all' ? ' for this department' : ''}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-medium text-slate-700 tabular-nums">
                  {fromUser}–{toUser}
                </span>{' '}
                of <span className="font-medium text-slate-700 tabular-nums">{totalUsers}</span>{' '}
                users
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className={pagerBtn}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {pagesToRender.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setUserPage(p)}
                    aria-current={p === userPage ? 'page' : undefined}
                    className={`min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-lg border text-xs font-medium tabular-nums transition-colors ${
                      p === userPage
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => setUserPage((p) => Math.min(totalPages, p + 1))}
                  disabled={userPage === totalPages}
                  className={pagerBtn}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Session & Run Cost Breakdown ── */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <SectionHeader
              icon={Layers}
              title="Session & Run Cost Breakdown"
              description="One row per search run — a session accumulates many runs, so each is costed separately. Click a row for the per-model and per-API split."
            >
              {sessionsLoading && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading
                </span>
              )}
            </SectionHeader>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <Th>Run</Th>
                    <Th>Session</Th>
                    <Th>User</Th>
                    <Th>Services</Th>
                    <Th align="right">Calls</Th>
                    <Th align="right">AI Cost</Th>
                    <Th align="right">API Cost</Th>
                    <Th align="right">Total Cost</Th>
                    <Th align="right">Run Time</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => (
                    <tr
                      key={`${s.session_id}|${s.run_id ?? ''}`}
                      onClick={() =>
                        setSelectedSessionId({ sessionId: s.session_id, runId: s.run_id ?? '' })
                      }
                      className="group cursor-pointer transition-colors hover:bg-blue-50/50"
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
                        <div className="text-[11px] font-mono text-slate-400">
                          {String(s.session_id).slice(0, 10)}…
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm text-slate-800">{s.user_name}</div>
                        {s.email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
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
                      <td className="px-5 py-3 text-right text-sm text-slate-700 tabular-nums whitespace-nowrap">
                        {formatNumber(s.total_calls)}
                        {s.cache_hits > 0 && (
                          <div className="text-[11px] text-emerald-600">{s.cache_hits} cached</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-slate-600 tabular-nums whitespace-nowrap">
                        {formatCurrencyInr(s.ai_cost_inr)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-slate-600 tabular-nums whitespace-nowrap">
                        {formatCurrencyInr(s.api_cost_inr)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCurrencyInr(s.total_cost_inr)}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <span className="text-xs text-slate-500">
                          {formatDateTime(s.last_event_at)}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 inline ml-2 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                      </td>
                    </tr>
                  ))}

                  {sessions.length === 0 && !sessionsLoading && (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-500">
                        No runs between {range.from} and {range.to}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-slate-500">
                {sessionMeta.total ? (
                  <>
                    Showing{' '}
                    <span className="font-medium text-slate-700 tabular-nums">
                      {(sessionMeta.page - 1) * SESSION_PAGE_SIZE + 1}–
                      {Math.min(sessionMeta.page * SESSION_PAGE_SIZE, sessionMeta.total)}
                    </span>{' '}
                    of{' '}
                    <span className="font-medium text-slate-700 tabular-nums">
                      {sessionMeta.total}
                    </span>{' '}
                    runs
                  </>
                ) : (
                  '0 runs'
                )}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                  disabled={sessionPage === 1}
                  className={pagerBtn}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 h-8 inline-flex items-center text-xs text-slate-600 tabular-nums">
                  {sessionMeta.page} / {Math.max(1, sessionMeta.totalPages)}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() =>
                    setSessionPage((p) => Math.min(sessionMeta.totalPages || 1, p + 1))
                  }
                  disabled={sessionPage >= (sessionMeta.totalPages || 1)}
                  className={pagerBtn}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── User detail modal ── */}
      {selectedUserId && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 ring-1 ring-slate-200 flex items-center justify-center text-sm font-semibold shrink-0">
                  {userInitials(userDetails?.user_name || selectedUserId)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 truncate">
                    {userDetails?.user_name || selectedUserId}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {userDetails?.email || 'No email'} · {userDetails?.department || 'Unassigned'} ·
                    Last used: {formatDateTime(userDetails?.totals?.last_used_at)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Showing {range.from} → {range.to} (IST)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeUserDetails}
                aria-label="Close"
                className="p-2 rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar space-y-5 bg-slate-50/50">
              {userLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Loading user analytics…
                </div>
              ) : userError ? (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                  {userError}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      ['Total Cost (INR)', formatCurrencyInr(userDetails?.totals?.total_cost_inr)],
                      ['Total Cost (USD)', formatCurrencyUsd(userDetails?.totals?.total_cost_usd)],
                      ['Requests', formatNumber(userDetails?.totals?.total_quantity)],
                      ['Records', formatNumber(userDetails?.totals?.record_count)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {label}
                        </p>
                        <p className="text-lg font-semibold text-slate-900 mt-1 tabular-nums">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
                      Service Breakdown
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50/80">
                          <tr>
                            <Th pad="px-4 py-2.5">Service</Th>
                            <Th align="right" pad="px-4 py-2.5">
                              Quantity
                            </Th>
                            <Th align="right" pad="px-4 py-2.5">
                              INR
                            </Th>
                            <Th align="right" pad="px-4 py-2.5">
                              USD
                            </Th>
                            <Th align="right" pad="px-4 py-2.5">
                              Last Used
                            </Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(userDetails?.service_breakdown || []).map((row) => (
                            <tr key={row.service} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 text-sm text-slate-700">
                                {serviceLabel(row.service)}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-slate-700 text-right tabular-nums">
                                {formatNumber(row.total_quantity)} {formatUnit(row.unit_summary)}
                              </td>
                              <td className="px-4 py-2.5 text-sm font-medium text-slate-900 text-right tabular-nums">
                                {formatCurrencyInr(row.total_cost_inr)}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-slate-500 text-right tabular-nums">
                                {formatCurrencyUsd(row.total_cost_usd)}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-500 text-right">
                                {formatDateTime(row.last_used_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
                      Usage Timeline
                    </div>
                    <div className="overflow-x-auto max-h-80 custom-scrollbar">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50/95 backdrop-blur sticky top-0">
                          <tr>
                            <Th pad="px-4 py-2">When Used</Th>
                            <Th pad="px-4 py-2">Service</Th>
                            <Th pad="px-4 py-2">Operation</Th>
                            <Th align="right" pad="px-4 py-2">
                              Qty
                            </Th>
                            <Th align="right" pad="px-4 py-2">
                              INR
                            </Th>
                            <Th align="right" pad="px-4 py-2">
                              Time (ms)
                            </Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(userDetails?.timeline || []).map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                                {formatDateTime(row.created_at)}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-700">
                                {serviceLabel(row.service)}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-600">
                                {row.operation || '—'}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-700 text-right tabular-nums">
                                {formatNumber(row.quantity)} {formatUnit(row.unit)}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-900 text-right tabular-nums">
                                {formatCurrencyInr(row.cost_inr)}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-400 text-right tabular-nums">
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
