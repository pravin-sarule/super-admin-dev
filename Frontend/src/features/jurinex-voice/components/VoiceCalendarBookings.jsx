import { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  User,
  Video,
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

// Returns YYYY-MM-DD for a date evaluated in the given timezone. We
// use en-CA because it always emits ISO-style dates and the locale is
// stable across browsers.
const ymdInTz = (date, tz = TZ) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

// Classify a booking relative to "now" so the table can lead with
// today's demos (which is what an admin checking the calendar in the
// morning actually wants to see). "Upcoming" = future but not
// today/tomorrow. "Past" = anything that already ended.
const BOOKING_CATEGORIES = {
  today: { label: 'Today', order: 0, badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  tomorrow: { label: 'Tomorrow', order: 1, badge: 'bg-violet-100 text-violet-700 border-violet-200' },
  upcoming: { label: 'Upcoming', order: 2, badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  past: { label: 'Past', order: 3, badge: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const categorizeBooking = (booking, tz = TZ) => {
  const start = booking?.start_time ? new Date(booking.start_time) : null;
  if (!start || Number.isNaN(start.getTime())) return 'past';
  const todayYmd = ymdInTz(new Date(), tz);
  const tomorrowYmd = ymdInTz(new Date(Date.now() + 86400000), tz);
  const startYmd = ymdInTz(start, tz);
  if (startYmd === todayYmd) return 'today';
  if (startYmd === tomorrowYmd) return 'tomorrow';
  if (start.getTime() > Date.now()) return 'upcoming';
  return 'past';
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

// Small inline action strip for a booking row/card. Renders "Join Meet"
// (only when the Meet link exists), "Open in Calendar", and a copy-
// email button when the attendee has one. Compact + theme-matched so
// it can sit inside both the day-grid card and the table row.
const BookingActions = ({ booking, compact = false }) => {
  const [copied, setCopied] = useState(false);

  const copyEmail = async (email) => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silently no-op */
    }
  };

  const btnBase = compact
    ? 'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition'
    : 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition';

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? '' : 'mt-1'}`}>
      {booking.meeting_link ? (
        <a
          href={booking.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnBase} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
          title="Join the Google Meet for this booking"
          onClick={(e) => e.stopPropagation()}
        >
          <Video className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          Join Meet
        </a>
      ) : null}
      {booking.event_html_link ? (
        <a
          href={booking.event_html_link}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnBase} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
          title="Open this event in Google Calendar"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          Calendar
        </a>
      ) : null}
      {booking.attendee_email ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            copyEmail(booking.attendee_email);
          }}
          className={`${btnBase} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
          title={copied ? 'Copied!' : `Copy ${booking.attendee_email}`}
        >
          <Copy className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          {copied ? 'Copied' : 'Email'}
        </button>
      ) : null}
    </div>
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

  // Quick-filter chips above the table — drive both the row filter and
  // the empty-state copy. Default 'all' so admins land on the smart-
  // sorted list (today → tomorrow → upcoming → past).
  const [viewFilter, setViewFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // Smart-sorted list: today first (chronological), then tomorrow,
  // then upcoming, then past in reverse chronological order. This is
  // what an admin checking the calendar in the morning actually wants
  // — "what do I have today?", not "what's furthest in the future?".
  const decoratedBookings = useMemo(
    () =>
      bookings.map((b) => ({
        ...b,
        _category: categorizeBooking(b, slotsTimeZone),
        _startMs: b.start_time ? new Date(b.start_time).getTime() : 0,
      })),
    [bookings, slotsTimeZone]
  );

  const sortedBookings = useMemo(() => {
    const arr = [...decoratedBookings];
    arr.sort((a, b) => {
      const ao = BOOKING_CATEGORIES[a._category]?.order ?? 99;
      const bo = BOOKING_CATEGORIES[b._category]?.order ?? 99;
      if (ao !== bo) return ao - bo;
      // Within "past", show most-recent first. Within everything else,
      // earliest first so the next demo is at the top of the list.
      if (a._category === 'past') return b._startMs - a._startMs;
      return a._startMs - b._startMs;
    });
    return arr;
  }, [decoratedBookings]);

  const categoryCounts = useMemo(() => {
    const counts = { all: sortedBookings.length, today: 0, tomorrow: 0, upcoming: 0, past: 0 };
    for (const b of sortedBookings) counts[b._category] = (counts[b._category] || 0) + 1;
    return counts;
  }, [sortedBookings]);

  const filteredBookings = useMemo(() => {
    if (viewFilter === 'all') return sortedBookings;
    return sortedBookings.filter((b) => b._category === viewFilter);
  }, [sortedBookings, viewFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedBookings = useMemo(
    () => filteredBookings.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredBookings, safePage, pageSize]
  );
  const rangeStart = filteredBookings.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filteredBookings.length);

  // Snap back to page 1 whenever the filter, page size, or upstream
  // booking set changes — otherwise you can land on an empty page
  // after switching filters.
  useEffect(() => {
    setPage(1);
  }, [viewFilter, pageSize, bookings.length]);

  const FILTER_CHIPS = [
    { key: 'all', label: 'All', activeCls: 'bg-slate-900 text-white border-slate-900' },
    { key: 'today', label: 'Today', activeCls: 'bg-blue-600 text-white border-blue-600' },
    { key: 'tomorrow', label: 'Tomorrow', activeCls: 'bg-violet-600 text-white border-violet-600' },
    { key: 'upcoming', label: 'Upcoming', activeCls: 'bg-emerald-600 text-white border-emerald-600' },
    { key: 'past', label: 'Past', activeCls: 'bg-slate-500 text-white border-slate-500' },
  ];

  // Hide-empty-days toggle for the day-grid. An admin checking the
  // calendar usually only cares about days with bookings — those empty
  // grey cards full of "open" pills are noise. Default ON so the grid
  // opens compact, with an obvious switch to bring them back.
  const [hideEmptyDays, setHideEmptyDays] = useState(true);
  const todayYmdLocal = useMemo(() => ymdInTz(new Date(), slotsTimeZone), [slotsTimeZone]);
  const tomorrowYmdLocal = useMemo(
    () => ymdInTz(new Date(Date.now() + 86400000), slotsTimeZone),
    [slotsTimeZone]
  );
  const visibleDays = useMemo(
    () => (hideEmptyDays ? days.filter((d) => d.bookings.length > 0) : days),
    [days, hideEmptyDays]
  );

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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Day-by-day availability — {agentLabel(agentId)}
            </h3>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={hideEmptyDays}
                  onChange={(e) => setHideEmptyDays(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Only days with bookings
              </label>
              <span className="text-xs text-slate-500">
                {slotsLoading
                  ? 'Loading slots…'
                  : `${visibleDays.length}/${days.length} day${days.length === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>
          {days.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
              No working days in the selected range. Either the agent has no working hours configured or all days are blocked.
            </p>
          ) : visibleDays.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
              No days with bookings in this range. Uncheck &ldquo;Only days with bookings&rdquo; above to see open slots.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleDays.map((day) => {
                const empty = day.free_slots.length;
                const filled = day.bookings.length;
                const isToday = day.date === todayYmdLocal;
                const isTomorrow = day.date === tomorrowYmdLocal;
                const cardCls = isToday
                  ? 'rounded-xl border-2 border-blue-500 bg-blue-50/60 p-3 shadow-sm'
                  : isTomorrow
                  ? 'rounded-xl border border-violet-300 bg-violet-50/40 p-3'
                  : 'rounded-xl border border-slate-200 bg-slate-50 p-3';
                return (
                  <div key={day.date} className={cardCls}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        {day.date}
                        {isToday && (
                          <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Today
                          </span>
                        )}
                        {isTomorrow && (
                          <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Tomorrow
                          </span>
                        )}
                      </span>
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
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-emerald-800">
                              {formatTime(b.start_time, { timeZone: slotsTimeZone })}
                              {' – '}
                              {formatTime(b.end_time, { timeZone: slotsTimeZone })}
                            </span>
                            <StatusBadge status={b.status} />
                          </div>
                          <div className="truncate text-slate-700" title={b.summary}>
                            {b.summary || '(no summary)'}
                          </div>
                          {(b.attendee_name || b.attendee_email) && (
                            <div className="mt-0.5 truncate text-slate-500">
                              {b.attendee_name || ''}{' '}
                              {b.attendee_email ? `<${b.attendee_email}>` : ''}
                              {b.attendee_phone ? ` · ${b.attendee_phone}` : ''}
                            </div>
                          )}
                          {(b.meeting_link || b.event_html_link || b.attendee_email) && (
                            <BookingActions booking={b} compact />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Free slots for this day — collapsed when there are
                        many, so the card stays compact. */}
                    {day.free_slots.length > 0 && (
                      <details className="mt-2" open={filled === 0}>
                        <summary className="cursor-pointer text-[11px] font-semibold text-blue-700 hover:underline">
                          {day.free_slots.length} open slot{day.free_slots.length === 1 ? '' : 's'}
                        </summary>
                        <div className="mt-1 space-y-1">
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
                      </details>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-slate-900">Bookings</h3>
            <span className="text-[11px] text-slate-500">
              Smart sorted: today &rarr; tomorrow &rarr; upcoming &rarr; past.
            </span>
          </div>
          <span className="text-xs text-slate-500">
            {loading
              ? 'Loading…'
              : filteredBookings.length === 0
              ? '0 shown'
              : `Showing ${rangeStart}–${rangeEnd} of ${filteredBookings.length}`}
          </span>
        </div>

        {/* Quick-filter chips */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-2">
          {FILTER_CHIPS.map((chip) => {
            const active = viewFilter === chip.key;
            const count = categoryCounts[chip.key] ?? 0;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setViewFilter(chip.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? chip.activeCls
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {chip.label}
                <span
                  className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-slate-500">
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
        </div>

        {filteredBookings.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            {bookings.length === 0
              ? 'No bookings found for the selected agent + date range.'
              : `No ${
                  BOOKING_CATEGORIES[viewFilter]?.label.toLowerCase() || ''
                } bookings — try a different filter.`}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Date / Time</th>
                    <th className="px-4 py-2 font-semibold">Agent</th>
                    <th className="px-4 py-2 font-semibold">Summary</th>
                    <th className="px-4 py-2 font-semibold">Attendee</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedBookings.map((b) => {
                    const cat = BOOKING_CATEGORIES[b._category];
                    return (
                      <tr
                        key={b.id}
                        className={
                          b._category === 'today'
                            ? 'bg-blue-50/40 hover:bg-blue-50'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-slate-900">
                              {formatDate(b.start_time)}
                            </div>
                            {cat && (
                              <span
                                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${cat.badge}`}
                              >
                                {cat.label}
                              </span>
                            )}
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
                        <td className="px-4 py-2 whitespace-nowrap text-right">
                          {b.meeting_link || b.event_html_link || b.attendee_email ? (
                            <div className="flex justify-end">
                              <BookingActions booking={b} />
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

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
                    // Windowed page list: current ± 2, clamped to bounds.
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
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceCalendarBookings;
