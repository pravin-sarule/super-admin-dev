/**
 * calendar_check tool — runs a Google Calendar freeBusy query and returns
 * a list of busy windows so the agent can suggest a free slot. The
 * dispatcher decorates the context with `toolSettings` from the agent
 * configuration row (calendar_id, calendar_timezone, meeting_duration_minutes).
 */

const calendar = require('./googleCalendar.client');
const workingHours = require('./workingHours');

const DEFAULT_TZ = process.env.JURINEX_VOICE_DEFAULT_CALENDAR_TZ || 'Asia/Kolkata';
const DEFAULT_DURATION = 30;

const isoOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const run = async (args = {}, context = {}) => {
  const startIso = isoOrNull(args.start_iso);
  const endIso = isoOrNull(args.end_iso);
  const calendarSettings = context.toolSettings?.calendar || context.toolSettings || {};
  const slotMinutes =
    Number(args.slot_duration_minutes) ||
    Number(calendarSettings.default_meeting_minutes) ||
    DEFAULT_DURATION;

  if (!startIso || !endIso) {
    return {
      status: 'invalid_arguments',
      detail: 'Both start_iso and end_iso must be valid ISO 8601 timestamps with timezone.',
    };
  }
  if (!calendar.isConfigured()) {
    return {
      status: 'calendar_not_configured',
      detail:
        'Google Calendar credentials are missing on the server. Set JURINEX_VOICE_CALENDAR_SA_JSON_BASE64 (base64 service-account JSON) and share the calendar with that service account.',
    };
  }

  const calendarId =
    calendarSettings.calendar_id ||
    process.env.JURINEX_VOICE_DEFAULT_CALENDAR_ID ||
    null;
  if (!calendarId) {
    return {
      status: 'calendar_not_configured',
      detail:
        'No calendar id is configured for this agent. Open the agent settings → Functions → Check Calendar Availability → Calendar ID, or set JURINEX_VOICE_DEFAULT_CALENDAR_ID.',
    };
  }
  const timeZone = calendarSettings.timezone || DEFAULT_TZ;

  console.log('[VOICE_TOOL][calendar_check] querying freeBusy', {
    sessionId: context.sessionId,
    agentId: context.agentId,
    calendarId,
    startIso,
    endIso,
    timeZone,
    slotMinutes,
    workingHoursEnabledDays: calendarSettings.working_hours
      ? Object.entries(calendarSettings.working_hours)
          .filter(([, cfg]) => cfg?.enabled)
          .map(([day]) => day)
      : 'unrestricted',
    blockedDates: calendarSettings.blocked_dates || [],
  });

  let busy;
  try {
    busy = await calendar.queryFreeBusy({ calendarId, startIso, endIso, timeZone });
  } catch (err) {
    console.error('[VOICE_TOOL][calendar_check] freeBusy failed', {
      sessionId: context.sessionId,
      error: err.message,
      code: err.code,
    });
    return {
      status: 'calendar_error',
      detail: `Calendar lookup failed: ${err.message}. Apologize and offer to take a callback.`,
    };
  }

  const free = workingHours.computeFreeWindows({
    startIso,
    endIso,
    busy,
    settings: calendarSettings,
    timeZone,
    slotMinutes,
  });
  console.log('[VOICE_TOOL][calendar_check] freeBusy result', {
    sessionId: context.sessionId,
    busyCount: busy.length,
    freeWindows: free.length,
    constrainedByWorkingHours: Boolean(calendarSettings.working_hours),
  });

  return {
    status: 'ok',
    calendar_id: calendarId,
    time_zone: timeZone,
    slot_duration_minutes: slotMinutes,
    busy,
    free_windows: free,
    blocked_dates: calendarSettings.blocked_dates || [],
    view_only: Boolean(calendarSettings.view_only),
    detail:
      free.length === 0
        ? 'No free slots inside the configured working hours. Suggest a different day or a shorter meeting.'
        : 'Pick one of the free_windows entries and confirm it with the caller before calling calendar_book.',
  };
};

module.exports = { name: 'calendar_check', run };
