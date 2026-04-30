import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarX, Plus, Trash2, X } from 'lucide-react';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
];

const DEFAULT_WORKING_HOURS = () =>
  DAYS.reduce((acc, day) => {
    acc[day.key] =
      day.key === 'sunday'
        ? { enabled: false, start: '00:00', end: '00:00' }
        : day.key === 'saturday'
        ? { enabled: true, start: '10:00', end: '14:00' }
        : { enabled: true, start: '09:00', end: '18:00' };
    return acc;
  }, {});

export const DEFAULT_CALENDAR_TOOL_SETTINGS = {
  calendar_id: '',
  timezone: 'Asia/Kolkata',
  default_meeting_minutes: 30,
  view_only: false,
  working_hours: DEFAULT_WORKING_HOURS(),
  blocked_dates: [],
};

const mergeSettings = (incoming = {}) => ({
  ...DEFAULT_CALENDAR_TOOL_SETTINGS,
  ...incoming,
  working_hours: {
    ...DEFAULT_CALENDAR_TOOL_SETTINGS.working_hours,
    ...(incoming.working_hours || {}),
  },
  blocked_dates: Array.isArray(incoming.blocked_dates) ? [...incoming.blocked_dates] : [],
});

const isValidDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const CalendarFunctionModal = ({ open, mode = 'check', value, onSave, onClose }) => {
  const [draft, setDraft] = useState(() => mergeSettings(value));
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft(mergeSettings(value));
      setNewDate('');
      setError(null);
    }
  }, [open, value]);

  const title = useMemo(
    () =>
      mode === 'book'
        ? 'Book on the Calendar settings'
        : 'Check Calendar Availability settings',
    [mode]
  );

  if (!open) return null;

  const updateField = (patch) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const updateDay = (dayKey, patch) =>
    setDraft((prev) => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [dayKey]: { ...prev.working_hours[dayKey], ...patch },
      },
    }));

  const enabledDayCount = DAYS.filter((day) => draft.working_hours[day.key]?.enabled).length;

  const addBlockedDate = () => {
    const value = newDate.trim();
    if (!value) return;
    if (!isValidDateString(value)) {
      setError('Use YYYY-MM-DD format for blocked dates.');
      return;
    }
    if (draft.blocked_dates.includes(value)) {
      setError('This date is already in the blocked list.');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      blocked_dates: [...prev.blocked_dates, value].sort(),
    }));
    setNewDate('');
    setError(null);
  };

  const removeBlockedDate = (date) =>
    setDraft((prev) => ({
      ...prev,
      blocked_dates: prev.blocked_dates.filter((item) => item !== date),
    }));

  const validateAndSave = () => {
    if (enabledDayCount === 0) {
      setError('At least one working day must be enabled.');
      return;
    }
    for (const day of DAYS) {
      const cfg = draft.working_hours[day.key];
      if (!cfg?.enabled) continue;
      if (cfg.start >= cfg.end) {
        setError(`${day.label}: end time must be after start time.`);
        return;
      }
    }
    onSave?.(draft);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <section>
            <h4 className="text-sm font-semibold text-slate-900">Connection</h4>
            <p className="text-xs text-slate-500">
              These settings are shared by both <strong>Check Calendar Availability</strong> and{' '}
              <strong>Book on the Calendar</strong>. Leave Calendar ID blank to use the server default.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-xs font-semibold text-slate-700">
                  Calendar ID (optional override)
                </span>
                <input
                  type="text"
                  value={draft.calendar_id}
                  onChange={(event) => updateField({ calendar_id: event.target.value.trim() })}
                  placeholder="abc@group.calendar.google.com"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs font-semibold text-slate-700">Time zone</span>
                <select
                  value={draft.timezone}
                  onChange={(event) => updateField({ timezone: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-xs font-semibold text-slate-700">Default meeting length (minutes)</span>
                <select
                  value={String(draft.default_meeting_minutes)}
                  onChange={(event) =>
                    updateField({ default_meeting_minutes: Number(event.target.value) || 30 })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {[15, 20, 30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(draft.view_only)}
                  onChange={(event) => updateField({ view_only: event.target.checked })}
                  className="h-4 w-4 accent-blue-600"
                />
                <span>
                  <span className="font-medium">View-only mode.</span> The agent can read availability but cannot create bookings.
                </span>
              </label>
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-900">Working hours</h4>
            <p className="text-xs text-slate-500">
              The agent will only propose or accept bookings inside these windows. Disable a day to block it entirely.
            </p>
            <div className="mt-3 space-y-2">
              {DAYS.map((day) => {
                const cfg = draft.working_hours[day.key];
                return (
                  <div
                    key={day.key}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <label className="flex w-32 items-center gap-2 text-sm font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={Boolean(cfg.enabled)}
                        onChange={(event) => updateDay(day.key, { enabled: event.target.checked })}
                        className="h-4 w-4 accent-blue-600"
                      />
                      {day.label}
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-500">
                      Start
                      <input
                        type="time"
                        value={cfg.start}
                        disabled={!cfg.enabled}
                        onChange={(event) => updateDay(day.key, { start: event.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-100"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-500">
                      End
                      <input
                        type="time"
                        value={cfg.end}
                        disabled={!cfg.enabled}
                        onChange={(event) => updateDay(day.key, { end: event.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-100"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-900">Blocked dates (holidays)</h4>
            <p className="text-xs text-slate-500">
              Add specific calendar dates where bookings should be refused even if they fall on a working day.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addBlockedDate}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Block date
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.blocked_dates.length === 0 ? (
                <span className="text-xs text-slate-400">No blocked dates yet.</span>
              ) : (
                draft.blocked_dates.map((date) => (
                  <span
                    key={date}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                  >
                    <CalendarX className="h-3 w-3" />
                    {date}
                    <button
                      type="button"
                      onClick={() => removeBlockedDate(date)}
                      className="text-amber-600 hover:text-red-600"
                      aria-label={`Remove ${date}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={validateAndSave}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarFunctionModal;
