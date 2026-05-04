import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  CloudUpload,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  bulkImportScheduledCalls,
  cancelScheduledCall,
  createScheduledCall,
  listScheduledCalls,
} from '../api/jurinexVoiceApi';

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

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listScheduledCalls({
        agent_id: filterAgentId || undefined,
        status: filterStatus || undefined,
        limit: 200,
      });
      setCalls(Array.isArray(data.calls) ? data.calls : []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAgentId, filterStatus]);

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

  const handleCancel = async (call) => {
    if (!window.confirm(`Cancel scheduled call to ${call.recipient_name || call.recipient_phone}?`))
      return;
    try {
      await cancelScheduledCall(call.id);
      reload();
    } catch (err) {
      setError(err.message);
    }
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
            {loading ? 'Loading…' : `${total} scheduled call${total === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            onClick={reload}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
                  <th className="px-4 py-2 font-semibold">Source</th>
                  <th className="px-4 py-2 font-semibold">Attempts</th>
                  <th className="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((c) => (
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
                      <StatusPill status={c.status} />
                      {c.last_error && (
                        <div className="mt-1 line-clamp-1 max-w-[220px] text-[11px] text-red-600" title={c.last_error}>
                          {c.last_error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{c.source}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {c.attempts}/{c.max_attempts}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {(c.status === 'pending' || c.status === 'queued') ? (
                        <button
                          type="button"
                          onClick={() => handleCancel(c)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="Cancel scheduled call"
                          aria-label="Cancel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceCallScheduler;
