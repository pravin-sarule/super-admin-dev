/**
 * Helpers that apply the per-agent calendar tool_settings (working hours
 * + blocked dates) on top of Google Calendar's freeBusy result.
 *
 * Settings shape (saved by CalendarFunctionModal.jsx):
 *   {
 *     timezone: 'Asia/Kolkata',
 *     default_meeting_minutes: 30,
 *     working_hours: {
 *       monday:    { enabled: true,  start: '09:00', end: '18:00' },
 *       ...
 *     },
 *     blocked_dates: ['2026-05-01', ...],
 *     view_only: false,
 *   }
 */

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const parseHm = (value, fallback = '00:00') => {
  const text = String(value || fallback).trim();
  const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

// Convert a Date into {year, month, day, weekday, ymd} as observed in
// the configured timezone. Uses Intl.DateTimeFormat 'en-CA' locale because
// it formats as YYYY-MM-DD (stable across runtimes).
const partsInTimezone = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const weekdayShort = String(parts.weekday || '').toLowerCase().slice(0, 3);
  const weekdayMap = {
    sun: 'sunday',
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    fri: 'friday',
    sat: 'saturday',
  };
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdayMap[weekdayShort] || null,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
};

// Approximate timezone offset (in minutes) for a moment in a given zone.
// Only used to anchor day boundaries — within ~1 minute is fine.
const timezoneOffsetMinutes = (instantMs, timeZone) => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(instantMs)).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUTC - instantMs) / 60000);
};

// Build the UTC instant for `YYYY-MM-DD HH:MM` interpreted in the given
// timezone. Iterates once because of DST/offset feedback (cheap, exact).
const localToInstant = ({ ymd, hour, minute }, timeZone) => {
  const [y, m, d] = ymd.split('-').map(Number);
  let candidate = Date.UTC(y, m - 1, d, hour, minute, 0);
  const offset1 = timezoneOffsetMinutes(candidate, timeZone);
  candidate -= offset1 * 60000;
  const offset2 = timezoneOffsetMinutes(candidate, timeZone);
  if (offset2 !== offset1) candidate -= (offset2 - offset1) * 60000;
  return candidate;
};

const buildWorkingWindowsForDay = ({ ymd, weekday, settings, timeZone }) => {
  const cfg = settings?.working_hours?.[weekday];
  if (!cfg?.enabled) return [];
  if (Array.isArray(settings.blocked_dates) && settings.blocked_dates.includes(ymd)) return [];
  const start = parseHm(cfg.start, '00:00');
  const end = parseHm(cfg.end, '23:59');
  if (!start || !end) return [];
  if (start.hour > end.hour || (start.hour === end.hour && start.minute >= end.minute)) return [];
  const startMs = localToInstant({ ymd, hour: start.hour, minute: start.minute }, timeZone);
  const endMs = localToInstant({ ymd, hour: end.hour, minute: end.minute }, timeZone);
  return [{ startMs, endMs }];
};

// All (start, end) windows in the search range that fall inside the
// agent's configured working hours and aren't on a blocked date.
const buildAllowedWindows = ({ startIso, endIso, settings, timeZone }) => {
  if (!settings?.working_hours) return [{ startMs: new Date(startIso).getTime(), endMs: new Date(endIso).getTime() }];

  const rangeStart = new Date(startIso).getTime();
  const rangeEnd = new Date(endIso).getTime();
  const out = [];
  const seenYmds = new Set();

  // Enumerate distinct YMDs in the range by stepping by 12h (covers DST
  // transitions safely) and dedup. Cap at 60 unique days so a malformed
  // call can't run away.
  for (let cursor = rangeStart; cursor <= rangeEnd; cursor += 12 * 60 * 60 * 1000) {
    const { ymd, weekday } = partsInTimezone(new Date(cursor), timeZone);
    if (seenYmds.has(ymd)) continue;
    seenYmds.add(ymd);
    if (seenYmds.size > 60) break;

    const dayWindows = buildWorkingWindowsForDay({ ymd, weekday, settings, timeZone });
    for (const win of dayWindows) {
      const clippedStart = Math.max(win.startMs, rangeStart);
      const clippedEnd = Math.min(win.endMs, rangeEnd);
      if (clippedStart < clippedEnd) out.push({ startMs: clippedStart, endMs: clippedEnd });
    }
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
};

const subtractBusy = (windows, busy = []) => {
  const sortedBusy = [...busy]
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end))
    .sort((a, b) => a.start - b.start);

  const result = [];
  for (const win of windows) {
    let cursor = win.startMs;
    for (const block of sortedBusy) {
      if (block.end <= cursor || block.start >= win.endMs) continue;
      if (block.start > cursor) {
        result.push({ startMs: cursor, endMs: Math.min(block.start, win.endMs) });
      }
      cursor = Math.max(cursor, block.end);
      if (cursor >= win.endMs) break;
    }
    if (cursor < win.endMs) result.push({ startMs: cursor, endMs: win.endMs });
  }
  return result;
};

const filterBySlotLength = (windows, slotMinutes) => {
  const min = Math.max(5, Number(slotMinutes) || 30) * 60_000;
  return windows.filter((w) => w.endMs - w.startMs >= min);
};

const computeFreeWindows = ({ startIso, endIso, busy, settings, timeZone, slotMinutes }) => {
  const allowed = buildAllowedWindows({ startIso, endIso, settings, timeZone });
  const subtracted = subtractBusy(allowed, busy);
  const filtered = filterBySlotLength(subtracted, slotMinutes);
  return filtered.map((w) => ({
    start: new Date(w.startMs).toISOString(),
    end: new Date(w.endMs).toISOString(),
  }));
};

// Reject a target booking that falls outside the configured policy.
// Returns null if allowed, or { code, detail } if not allowed.
const validateBookingTarget = ({ startIso, endIso, settings, timeZone }) => {
  if (settings?.view_only) {
    return {
      code: 'view_only_mode',
      detail: 'This calendar is configured as view-only. Booking is disabled — apologize and offer to take a callback.',
    };
  }
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { code: 'invalid_range', detail: 'Booking start/end timestamps are invalid.' };
  }
  // Build the allowed windows just for this slot's day(s) and check the
  // requested slot is fully contained in one of them.
  const buffer = 60 * 1000;
  const allowed = buildAllowedWindows({
    startIso: new Date(startMs - buffer).toISOString(),
    endIso: new Date(endMs + buffer).toISOString(),
    settings,
    timeZone,
  });
  const fits = allowed.some((w) => startMs >= w.startMs && endMs <= w.endMs);
  if (!fits) {
    const { ymd, weekday } = partsInTimezone(new Date(startMs), timeZone);
    const blocked = Array.isArray(settings?.blocked_dates) && settings.blocked_dates.includes(ymd);
    if (blocked) {
      return {
        code: 'date_blocked',
        detail: `${ymd} is marked as a blocked date for this agent — propose a different day.`,
      };
    }
    const cfg = settings?.working_hours?.[weekday];
    if (!cfg?.enabled) {
      return {
        code: 'day_disabled',
        detail: `${weekday} is not a working day for this agent — propose a working day.`,
      };
    }
    return {
      code: 'outside_working_hours',
      detail: `Requested time is outside the configured working hours (${cfg.start}–${cfg.end}). Propose a slot inside that window.`,
    };
  }
  return null;
};

module.exports = {
  computeFreeWindows,
  validateBookingTarget,
  buildAllowedWindows,
  partsInTimezone,
};
