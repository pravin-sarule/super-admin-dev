import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import {
  bulkImportScheduledCalls,
  cancelScheduledCall,
  createScheduledCall,
  listScheduledCalls,
  resetStuckScheduledCalls,
  retryScheduledCall,
} from '../api/jurinexVoiceApi';

// A row is "stuck" when the runtime claimed it (queued/in_progress)
// but hasn't updated it within this many minutes. After this window
// either the runtime crashed mid-dial OR the row was never picked up.
const STUCK_THRESHOLD_MINUTES = 10;

// Themed confirmation modal — mirrors the pattern used by every other
// dialog in the Voice Management UI (agent delete, KB picker, etc.)
// instead of the OS-default `window.confirm` we used previously.
const CONFIRM_TONES = {
  red:   { ring: 'border-red-100  bg-red-50',    title: 'text-red-700',    btn: 'bg-red-600 hover:bg-red-700',    iconBg: 'bg-red-100  text-red-600'    },
  amber: { ring: 'border-amber-100 bg-amber-50', title: 'text-amber-800',  btn: 'bg-amber-600 hover:bg-amber-700', iconBg: 'bg-amber-100 text-amber-700' },
  blue:  { ring: 'border-blue-100  bg-blue-50',   title: 'text-blue-700',   btn: 'bg-blue-600 hover:bg-blue-700',   iconBg: 'bg-blue-100  text-blue-700'   },
};

const ConfirmDialog = ({
  open,
  tone = 'red',
  Icon,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onClose,
}) => {
  if (!open) return null;
  const t = CONFIRM_TONES[tone] || CONFIRM_TONES.red;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className={`flex items-center justify-between border-b px-5 py-3 ${t.ring}`}>
          <div className="flex items-center gap-2">
            {Icon ? (
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${t.iconBg}`}>
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <h3 className={`text-base font-semibold ${t.title}`}>{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700">{description}</div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${t.btn}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// How often the table polls the backend. Tunable. 10s feels live
// without hammering the API. The poller is paused when the browser
// tab is hidden so we don't refresh ghost tabs in the background.
const AUTO_REFRESH_INTERVAL_MS = 10_000;
// Maximum concurrent outbound calls the voice-agent runtime can place
// at once (per the hosted service). Shown to the admin so they know
// why some scheduled rows might briefly sit in `queued` even though
// they're due.
const RUNTIME_CONCURRENCY_CAP = Number(
  import.meta?.env?.VITE_VOICE_RUNTIME_CONCURRENCY || 20
);

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

const STATUS_STYLES = {
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  queued: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-violet-50 text-violet-700 border-violet-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  no_answer: 'bg-orange-50 text-orange-700 border-orange-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const StatusPill = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
      STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 border-slate-200'
    }`}
  >
    {status || 'unknown'}
  </span>
);

const formatDateTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const toLocalDatetimeInput = (date) => {
  // Returns the value an <input type="datetime-local"> expects, in the user's local time.
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

const VoiceCallScheduler = ({ agents = [] }) => {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterAgentId, setFilterAgentId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const pageCount = Math.max(1, Math.ceil(calls.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedCalls = useMemo(
    () => calls.slice((safePage - 1) * pageSize, safePage * pageSize),
    [calls, safePage, pageSize]
  );
  const rangeStart = calls.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, calls.length);

  useEffect(() => {
    setPage(1);
  }, [filterAgentId, filterStatus, pageSize, calls.length]);

  // Add-one form state
  const [draft, setDraft] = useState(() => ({
    agent_id: agents[0]?.id || '',
    recipient_name: '',
    recipient_phone: '',
    recipient_email: '',
    scheduled_at: toLocalDatetimeInput(new Date(Date.now() + 60 * 60_000)),
    timezone: TZ,
    notes: '',
  }));
  const [creating, setCreating] = useState(false);

  // CSV import state
  const [importAgentId, setImportAgentId] = useState(agents[0]?.id || '');
  const [importTimezone, setImportTimezone] = useState(TZ);
  const [importDefaultDate, setImportDefaultDate] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const reload = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const data = await listScheduledCalls({
        agent_id: filterAgentId || undefined,
        status: filterStatus || undefined,
        limit: 500,
      });
      setCalls(Array.isArray(data.calls) ? data.calls : []);
      setTotal(data.total || 0);
      setLastRefreshedAt(new Date());
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAgentId, filterStatus]);

  // Auto-refresh while the tab is visible so the table tracks the
  // runtime live. Pauses when the browser tab is hidden — no point
  // hammering the API for a tab nobody is looking at. Resumes
  // immediately on focus + fires an extra refresh on focus return so
  // an admin coming back from another tab sees fresh data instantly.
  useEffect(() => {
    let timer = null;
    const tick = () => {
      if (document.visibilityState === 'visible') reload({ silent: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        reload({ silent: true });
        if (!timer) timer = setInterval(tick, AUTO_REFRESH_INTERVAL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    if (document.visibilityState === 'visible') {
      timer = setInterval(tick, AUTO_REFRESH_INTERVAL_MS);
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAgentId, filterStatus]);

  // Roll the visible rows into per-status counts so the admin can see
  // the pipeline shape at a glance (not just a stuck "queued").
  const statusCounts = useMemo(() => {
    const c = { pending: 0, queued: 0, in_progress: 0, completed: 0, failed: 0, no_answer: 0, cancelled: 0 };
    for (const row of calls) c[row.status] = (c[row.status] || 0) + 1;
    return c;
  }, [calls]);

  const inFlightCount = statusCounts.in_progress + statusCounts.queued;

  // A row is stuck when the runtime claimed it (queued / in_progress)
  // but hasn't touched it within STUCK_THRESHOLD_MINUTES. These are
  // almost always orphans — the runtime crashed mid-dial and never
  // wrote the terminal status. Without this signal, admins see the
  // table sit at "5 in_progress" forever and assume the whole thing
  // is broken.
  const isStuck = (call) => {
    if (call.status !== 'in_progress' && call.status !== 'queued') return false;
    const updatedAt = call.updated_at ? new Date(call.updated_at).getTime() : 0;
    if (!updatedAt) return false;
    const ageMinutes = (Date.now() - updatedAt) / 60_000;
    return ageMinutes > STUCK_THRESHOLD_MINUTES;
  };
  const stuckCount = useMemo(() => calls.filter(isStuck).length, [calls]);

  // One generic confirm-modal state used by all three flows (cancel,
  // retry, reset-stuck) — much tidier than three browser dialogs.
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  // Inline success banner (auto-dismisses after 4s) — replaces
  // window.alert() so the success state matches the app theme.
  const [successBanner, setSuccessBanner] = useState(null);

  useEffect(() => {
    if (!successBanner) return undefined;
    const t = setTimeout(() => setSuccessBanner(null), 4000);
    return () => clearTimeout(t);
  }, [successBanner]);

  const openResetStuckConfirm = () => {
    setConfirmModal({
      type: 'reset_stuck',
      tone: 'amber',
      title: `Reset ${stuckCount} stuck call${stuckCount === 1 ? '' : 's'}?`,
      Icon: Wrench,
      description: (
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            These rows were claimed by the runtime (
            <code className="font-mono text-slate-900">queued</code> /{' '}
            <code className="font-mono text-slate-900">in_progress</code>) but haven&apos;t
            been updated in more than{' '}
            <strong>{STUCK_THRESHOLD_MINUTES} minutes</strong> — almost certainly orphans
            from a crashed runtime worker.
          </p>
          <p className="text-slate-600">
            They&apos;ll flip back to{' '}
            <code className="font-mono text-slate-900">pending</code> and the next poll
            will pick them up. The <code className="font-mono">attempts</code> counter is
            preserved so this still respects{' '}
            <code className="font-mono">max_attempts</code>.
          </p>
        </div>
      ),
      confirmLabel: `Reset ${stuckCount}`,
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          const result = await resetStuckScheduledCalls({
            stuck_threshold_minutes: STUCK_THRESHOLD_MINUTES,
          });
          setError(null);
          setConfirmModal(null);
          reload();
          setSuccessBanner(
            `Reset ${result.reset_count} stuck row${
              result.reset_count === 1 ? '' : 's'
            } back to pending.`
          );
        } catch (err) {
          setError(err.message);
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  };

  // Friendly relative-time formatter for the "last activity" column.
  const formatRelative = (iso) => {
    if (!iso) return '—';
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms)) return '—';
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    return `${day}d ago`;
  };

  // Default the form's agent to the first one when the list arrives.
  useEffect(() => {
    if (!draft.agent_id && agents[0]?.id) setDraft((d) => ({ ...d, agent_id: agents[0].id }));
    if (!importAgentId && agents[0]?.id) setImportAgentId(agents[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.length]);

  const submitOne = async (e) => {
    e.preventDefault();
    if (!draft.agent_id) return;
    setCreating(true);
    setError(null);
    try {
      const scheduledAtIso = new Date(draft.scheduled_at).toISOString();
      await createScheduledCall({
        agent_id: draft.agent_id,
        recipient_name: draft.recipient_name.trim() || null,
        recipient_phone: draft.recipient_phone.trim(),
        recipient_email: draft.recipient_email.trim() || null,
        scheduled_at: scheduledAtIso,
        timezone: draft.timezone || TZ,
        notes: draft.notes.trim() || null,
        source: 'manual',
      });
      setDraft((d) => ({
        ...d,
        recipient_name: '',
        recipient_phone: '',
        recipient_email: '',
        notes: '',
      }));
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!importAgentId) {
      setError('Pick an agent for the imported rows first.');
      return;
    }
    setImportBusy(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await bulkImportScheduledCalls({
        file,
        agent_id: importAgentId,
        timezone: importTimezone || TZ,
        default_scheduled_at: importDefaultDate
          ? new Date(importDefaultDate).toISOString()
          : undefined,
      });
      setImportResult(result);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setImportBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openCancelConfirm = (call) => {
    const who = call.recipient_name || call.recipient_phone;
    setConfirmModal({
      type: 'cancel',
      tone: 'red',
      title: 'Cancel scheduled call?',
      Icon: Trash2,
      description: (
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            This will cancel the scheduled call to{' '}
            <strong className="text-slate-900">{who}</strong>
            {call.recipient_name && (
              <>
                {' '}(<span className="font-mono">{call.recipient_phone}</span>)
              </>
            )}
            .
          </p>
          <p className="text-slate-600">
            Scheduled for{' '}
            <strong className="text-slate-900">{formatDateTime(call.scheduled_at)}</strong>.
            The runtime will not place this call. You can still re-queue it later.
          </p>
        </div>
      ),
      confirmLabel: 'Cancel call',
      cancelLabel: 'Keep it',
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await cancelScheduledCall(call.id);
          setError(null);
          setConfirmModal(null);
          reload();
          setSuccessBanner(`Cancelled scheduled call to ${who}.`);
        } catch (err) {
          setError(err.message);
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  };

  // Manual retry for rows the runtime already gave up on (failed /
  // no_answer / cancelled). Re-queues the row 30 minutes from now by
  // default — gives the recipient breathing room and avoids hammering
  // a number that just rejected the call. attempts counter is
  // preserved by the backend so we never exceed max_attempts.
  const openRetryConfirm = (call) => {
    const who = call.recipient_name || call.recipient_phone;
    setConfirmModal({
      type: 'retry',
      tone: 'blue',
      title: 'Re-queue this call?',
      Icon: RotateCcw,
      description: (
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            Re-queue the call to{' '}
            <strong className="text-slate-900">{who}</strong>
            {call.recipient_name && (
              <>
                {' '}(<span className="font-mono">{call.recipient_phone}</span>)
              </>
            )}
            .
          </p>
          <p className="text-slate-600">
            The runtime will pick it up{' '}
            <strong className="text-slate-900">30 minutes from now</strong>.
          </p>
          <p className="text-xs text-slate-500">
            Attempts so far:{' '}
            <code className="font-mono text-slate-700">
              {call.attempts}/{call.max_attempts}
            </code>
            . The counter is preserved, so this still respects{' '}
            <code className="font-mono">max_attempts</code>.
          </p>
        </div>
      ),
      confirmLabel: 'Re-queue',
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await retryScheduledCall(call.id, 30);
          setError(null);
          setConfirmModal(null);
          reload();
          setSuccessBanner(`Re-queued call to ${who} for 30 minutes from now.`);
        } catch (err) {
          setError(err.message);
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  };

  const downloadTemplate = () => {
    const csv = [
      'recipient_phone,recipient_name,recipient_email,scheduled_at,notes',
      '+917875827090,Vishal Bainade,vishal@example.com,2026-05-10T11:00:00+05:30,Demo follow-up',
      '+919812345678,Asha,,2026-05-10T15:00:00+05:30,Reminder call',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scheduler_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const callableAgents = useMemo(
    () => agents.filter((a) => a.status === 'active'),
    [agents]
  );

  return (
    <div className="space-y-4">
      {/* ── Add one ─────────────────────────────────────── */}
      <form
        onSubmit={submitOne}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">Schedule a single call</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-slate-700">Agent</span>
            <select
              value={draft.agent_id}
              onChange={(e) => setDraft({ ...draft, agent_id: e.target.value })}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select agent</option>
              {callableAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-slate-700">Phone (E.164)</span>
            <input
              type="tel"
              required
              placeholder="+917875827090"
              value={draft.recipient_phone}
              onChange={(e) => setDraft({ ...draft, recipient_phone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-slate-700">Name (optional)</span>
            <input
              type="text"
              placeholder="Vishal Bainade"
              value={draft.recipient_name}
              onChange={(e) => setDraft({ ...draft, recipient_name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-slate-700">Email (optional)</span>
            <input
              type="email"
              placeholder="caller@example.com"
              value={draft.recipient_email}
              onChange={(e) => setDraft({ ...draft, recipient_email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-slate-700">Scheduled at</span>
            <input
              type="datetime-local"
              required
              value={draft.scheduled_at}
              onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm sm:col-span-2 lg:col-span-3">
            <span className="block text-xs font-semibold text-slate-700">Notes (admin-only)</span>
            <input
              type="text"
              placeholder="Reason for the call, any context the agent should know."
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">Timezone: {draft.timezone}</span>
          <button
            type="submit"
            disabled={creating || !draft.agent_id}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? 'Saving…' : 'Schedule call'}
          </button>
        </div>
      </form>

      {/* ── Bulk import ─────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CloudUpload className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">Bulk import (CSV)</h3>
          <button
            type="button"
            onClick={downloadTemplate}
            className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Download template
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-slate-700">Agent for all rows</span>
            <select
              value={importAgentId}
              onChange={(e) => setImportAgentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select agent</option>
              {callableAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-slate-700">Timezone (for rows w/o offset)</span>
            <input
              type="text"
              value={importTimezone}
              onChange={(e) => setImportTimezone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-slate-700">Default scheduled time (for rows w/o one)</span>
            <input
              type="datetime-local"
              value={importDefaultDate}
              onChange={(e) => setImportDefaultDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>

        <div className="mt-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            disabled={importBusy || !importAgentId}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="block w-full text-sm text-slate-700"
          />
          <p className="mt-2 text-xs text-slate-500">
            Required columns: <code className="font-mono">recipient_phone</code>,{' '}
            <code className="font-mono">scheduled_at</code>. Optional:{' '}
            <code className="font-mono">recipient_name</code>,{' '}
            <code className="font-mono">recipient_email</code>,{' '}
            <code className="font-mono">notes</code>.
            {' '}Excel users: save as CSV first.
          </p>
        </div>

        {importResult && (
          <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <p className="font-semibold">
              Imported {importResult.inserted_count} call{importResult.inserted_count === 1 ? '' : 's'}
              {importResult.skipped_count > 0
                ? ` · skipped ${importResult.skipped_count} row${importResult.skipped_count === 1 ? '' : 's'}`
                : ''}
            </p>
            {importResult.skipped_count > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs font-semibold text-emerald-700 hover:underline">
                  Show skipped rows
                </summary>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-emerald-900">
                  {importResult.skipped.map((s, i) => (
                    <li key={i}>
                      Line {s.line}: {s.reason} — <code className="font-mono">{(s.raw || []).join(',')}</code>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-1 text-xs text-emerald-700">
              Batch ID: <span className="font-mono">{importResult.batch_id}</span>
            </p>
          </div>
        )}
      </div>

      {successBanner && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            ✓
          </span>
          <span className="flex-1">{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Filters + table ──────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600">Agent</label>
            <select
              value={filterAgentId}
              onChange={(e) => setFilterAgentId(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Any</option>
              {Object.keys(STATUS_STYLES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-500">
            {loading
              ? 'Loading…'
              : calls.length === 0
              ? '0 shown'
              : `Showing ${rangeStart}–${rangeEnd} of ${calls.length}`}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              Page size
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {stuckCount > 0 && (
              <button
                type="button"
                onClick={openResetStuckConfirm}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                title={`Reset ${stuckCount} stuck row${stuckCount === 1 ? '' : 's'} (queued/in_progress idle > ${STUCK_THRESHOLD_MINUTES} min)`}
              >
                <Wrench className="h-4 w-4" />
                Reset {stuckCount} stuck
              </button>
            )}
            <button
              type="button"
              onClick={() => reload()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {stuckCount > 0 && (
          <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{stuckCount} row{stuckCount === 1 ? ' is' : 's are'} stuck.</strong>{' '}
              The runtime claimed {stuckCount === 1 ? 'it' : 'them'} (queued / in_progress) but hasn&apos;t reported back in over {STUCK_THRESHOLD_MINUTES} minutes — almost certainly a runtime crash mid-dial. Click <em>Reset</em> above to flip them back to <code>pending</code> so a healthy runtime can re-claim and complete (or properly mark <code>no_answer</code>). The <code>attempts</code> counter is preserved, so this still respects <code>max_attempts</code>.
            </span>
          </div>
        )}

        {/* Per-status counts + runtime capacity strip. Makes it
            obvious that what looks like "stuck" rows are actually
            being processed in parallel by the runtime. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-2 text-[11px]">
          {Object.entries(statusCounts).map(([k, v]) =>
            v === 0 ? null : (
              <span
                key={k}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${
                  STATUS_STYLES[k] || 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {k}: {v}
              </span>
            )
          )}
          <span className="ml-auto inline-flex items-center gap-2 text-slate-500">
            <span title="The voice-agent runtime can dial this many calls in parallel">
              Runtime capacity:{' '}
              <strong className="font-semibold text-slate-700">
                {inFlightCount}/{RUNTIME_CONCURRENCY_CAP}
              </strong>{' '}
              in flight
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
              auto-refresh every {AUTO_REFRESH_INTERVAL_MS / 1000}s
            </span>
            {lastRefreshedAt && (
              <span className="text-slate-400">
                · last: {lastRefreshedAt.toLocaleTimeString()}
              </span>
            )}
          </span>
        </div>

        {calls.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No scheduled calls{filterStatus ? ` with status "${filterStatus}"` : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2 font-semibold">Agent</th>
                  <th className="px-4 py-2 font-semibold">Recipient</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Last activity</th>
                  <th className="px-4 py-2 font-semibold">Source</th>
                  <th className="px-4 py-2 font-semibold">Attempts</th>
                  <th className="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedCalls.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2">
                      <div className="font-semibold text-slate-900">
                        {formatDateTime(c.scheduled_at)}
                      </div>
                      <div className="text-xs text-slate-500">{c.timezone}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <div className="font-medium text-slate-900">
                        {c.agent_display_name || c.agent_name || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="space-y-0.5 text-xs">
                        {c.recipient_name && (
                          <div className="inline-flex items-center gap-1 text-slate-700">
                            <User className="h-3 w-3 text-slate-400" /> {c.recipient_name}
                          </div>
                        )}
                        <div className="inline-flex items-center gap-1 font-mono text-slate-800">
                          <Phone className="h-3 w-3 text-slate-400" /> {c.recipient_phone}
                        </div>
                        {c.recipient_email && (
                          <div className="inline-flex items-center gap-1 text-slate-600">
                            <Mail className="h-3 w-3 text-slate-400" /> {c.recipient_email}
                          </div>
                        )}
                        {c.notes && <div className="line-clamp-1 text-[11px] text-slate-500">📝 {c.notes}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="inline-flex items-center gap-1.5">
                        <StatusPill status={c.status} />
                        {isStuck(c) && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                            title={`Runtime claimed this row but hasn't updated it in over ${STUCK_THRESHOLD_MINUTES} minutes. Likely orphaned by a runtime crash. Use "Reset stuck" above.`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            stuck
                          </span>
                        )}
                      </div>
                      {c.last_error && (
                        <div className="mt-1 line-clamp-1 max-w-[220px] text-[11px] text-red-600" title={c.last_error}>
                          {c.last_error}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-xs ${
                        isStuck(c) ? 'font-semibold text-amber-700' : 'text-slate-500'
                      }`}
                      title={
                        c.updated_at
                          ? `Updated at ${new Date(c.updated_at).toLocaleString()}`
                          : 'No updates recorded'
                      }
                    >
                      {formatRelative(c.updated_at)}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{c.source}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {c.attempts}/{c.max_attempts}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {(c.status === 'pending' || c.status === 'queued') && (
                          <button
                            type="button"
                            onClick={() => openCancelConfirm(c)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Cancel scheduled call"
                            aria-label="Cancel"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        {(c.status === 'failed' ||
                          c.status === 'no_answer' ||
                          c.status === 'cancelled') &&
                          c.attempts < c.max_attempts && (
                            <button
                              type="button"
                              onClick={() => openRetryConfirm(c)}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                              title="Re-queue this call (runtime picks up in 30 min)"
                              aria-label="Retry"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        {c.status === 'completed' && (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                        {(c.status === 'failed' ||
                          c.status === 'no_answer' ||
                          c.status === 'cancelled') &&
                          c.attempts >= c.max_attempts && (
                            <span
                              className="text-[11px] text-slate-400"
                              title={`Max attempts (${c.max_attempts}) reached`}
                            >
                              maxed
                            </span>
                          )}
                        {c.status === 'in_progress' && (
                          <span className="inline-flex items-center text-[11px] font-semibold text-violet-600">
                            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                            live
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs">
            <span className="text-slate-500">
              Page <strong className="text-slate-700">{safePage}</strong> of {pageCount}
            </span>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              {(() => {
                const start = Math.max(1, safePage - 2);
                const end = Math.min(pageCount, start + 4);
                const realStart = Math.max(1, end - 4);
                const nums = [];
                for (let i = realStart; i <= end; i += 1) nums.push(i);
                return nums.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`min-w-[28px] rounded-md border px-2 py-1 font-semibold ${
                      n === safePage
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {n}
                  </button>
                ));
              })()}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage === pageCount}
                className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage(pageCount)}
                disabled={safePage === pageCount}
                className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmModal}
        tone={confirmModal?.tone}
        Icon={confirmModal?.Icon}
        title={confirmModal?.title}
        description={confirmModal?.description}
        confirmLabel={confirmModal?.confirmLabel}
        cancelLabel={confirmModal?.cancelLabel}
        busy={confirmBusy}
        onConfirm={confirmModal?.onConfirm}
        onClose={() => !confirmBusy && setConfirmModal(null)}
      />
    </div>
  );
};

export default VoiceCallScheduler;
