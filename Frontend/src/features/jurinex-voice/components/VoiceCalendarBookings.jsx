import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Clock,
  Mail,
  Phone,
  RefreshCw,
  User,
} from 'lucide-react';
import { listCalendarBookings, getCalendarSlots } from '../api/jurinexVoiceApi';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

const formatDate = (iso, opts = {}) => {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: opts.timeZone || TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatTime = (iso, opts = {}) => {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: opts.timeZone || TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const StatusBadge = ({ status }) => {
  const cls =
    status === 'confirmed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'cancelled'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {status || 'unknown'}
    </span>
  );
};

const VoiceCalendarBookings = ({ agents = [] }) => {
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [agentId, setAgentId] = useState('');
  const [days, setDays] = useState([]);
  const [slotsTimeZone, setSlotsTimeZone] = useState(TZ);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10));

  const reloadBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCalendarBookings({
        agent_id: agentId || undefined,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        limit: 200,
      });
      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reloadSlots = async () => {
    if (!agentId) {
      setDays([]);
      return;
    }
    setSlotsLoading(true);
    try {
      const data = await getCalendarSlots({
        agent_id: agentId,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      });
      setDays(Array.isArray(data.days) ? data.days : []);
      setSlotsTimeZone(data.time_zone || TZ);
    } catch (err) {
      setError((current) => current || err.message);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    reloadBookings();
    reloadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, from, to]);

  const agentLabel = (id) => {
    const a = agents.find((row) => row.id === id);
    return a?.display_name || a?.name || (id ? `${String(id).slice(0, 8)}…` : '—');
  };

  return (
    <div className="space-y-4">
      {/* ── Filters ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600">Agent</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <label className="block text-xs font-semibold text-slate-600">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              reloadBookings();
              reloadSlots();
            }}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading || slotsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
            {total} booking{total === 1 ? '' : 's'} in window
          </span>
          {agentId && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Time zone: <span className="font-mono">{slotsTimeZone}</span>
            </span>
          )}
          <span>Today: {todayIso}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Per-day grid (only when an agent is selected) ─── */}
      {agentId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Day-by-day availability — {agentLabel(agentId)}
            </h3>
            <span className="text-xs text-slate-500">
              {slotsLoading ? 'Loading slots…' : `${days.length} day${days.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {days.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
              No working days in the selected range. Either the agent has no working hours configured or all days are blocked.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {days.map((day) => {
                const empty = day.free_slots.length;
                const filled = day.bookings.length;
                return (
                  <div key={day.date} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{day.date}</span>
                      <span className="flex items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                          <CalendarCheck className="h-3 w-3" /> {filled} booked
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
                          <CalendarClock className="h-3 w-3" /> {empty} open
                        </span>
                      </span>
                    </div>

                    {/* Bookings for this day */}
                    <div className="mt-2 space-y-1.5">
                      {day.bookings.map((b) => (
                        <div
                          key={b.id}
                          className="rounded-md bg-white px-2 py-1.5 text-xs ring-1 ring-emerald-200"
                          title={b.summary}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-emerald-800">
                              {formatTime(b.start_time, { timeZone: slotsTimeZone })}
                              {' – '}
                              {formatTime(b.end_time, { timeZone: slotsTimeZone })}
                            </span>
                            <StatusBadge status={b.status} />
                          </div>
                          <div className="truncate text-slate-700">{b.summary || '(no summary)'}</div>
                          {(b.attendee_name || b.attendee_email) && (
                            <div className="mt-0.5 truncate text-slate-500">
                              {b.attendee_name || ''}{' '}
                              {b.attendee_email ? `<${b.attendee_email}>` : ''}
                              {b.attendee_phone ? ` · ${b.attendee_phone}` : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Free slots for this day */}
                    {day.free_slots.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {day.free_slots.map((slot, idx) => (
                          <div
                            key={idx}
                            className="rounded-md bg-blue-50 px-2 py-1 text-[11px] text-blue-800 ring-1 ring-blue-100"
                          >
                            <span className="font-mono font-semibold">
                              {formatTime(slot.start, { timeZone: slotsTimeZone })}
                              {' – '}
                              {formatTime(slot.end, { timeZone: slotsTimeZone })}
                            </span>
                            <span className="ml-2 text-blue-500">open</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {filled === 0 && empty === 0 && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                        <CalendarX className="h-3 w-3" />
                        No working window on this day
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Booking list ─────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">All bookings in window</h3>
          <span className="text-xs text-slate-500">{loading ? 'Loading…' : `${bookings.length} shown`}</span>
        </div>
        {bookings.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No bookings found for the selected agent + date range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Date / Time</th>
                  <th className="px-4 py-2 font-semibold">Agent</th>
                  <th className="px-4 py-2 font-semibold">Summary</th>
                  <th className="px-4 py-2 font-semibold">Attendee</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        {formatDate(b.start_time)}
                      </div>
                      <div className="text-xs text-slate-500">
                        until {formatTime(b.end_time)}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        {b.agent_display_name || b.agent_name || agentLabel(b.agent_id)}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {b.agent_id ? String(b.agent_id).slice(0, 8) + '…' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">{b.summary || '(no summary)'}</div>
                      {b.description && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{b.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="space-y-0.5 text-xs">
                        {b.attendee_name && (
                          <div className="inline-flex items-center gap-1 text-slate-700">
                            <User className="h-3 w-3 text-slate-400" /> {b.attendee_name}
                          </div>
                        )}
                        {b.attendee_email && (
                          <div className="inline-flex items-center gap-1 text-slate-600">
                            <Mail className="h-3 w-3 text-slate-400" /> {b.attendee_email}
                          </div>
                        )}
                        {b.attendee_phone && (
                          <div className="inline-flex items-center gap-1 text-slate-600">
                            <Phone className="h-3 w-3 text-slate-400" /> {b.attendee_phone}
                          </div>
                        )}
                        {!b.attendee_name && !b.attendee_email && !b.attendee_phone && (
                          <div className="text-slate-400">—</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <StatusBadge status={b.status} />
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

export default VoiceCalendarBookings;
