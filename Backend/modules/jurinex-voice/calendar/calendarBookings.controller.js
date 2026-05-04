/**
 * Read-only admin endpoints for the Calendar tab in the Voice
 * Management UI.
 *
 *   GET /admin/jurinex-voice/calendar/bookings?agent_id=&from=&to=&limit=&offset=
 *   GET /admin/jurinex-voice/calendar/slots?agent_id=&date=
 *
 * The first lists raw bookings with attendee + caller info. The
 * second renders a per-day grid of filled / empty slots based on the
 * agent's configured working hours and existing bookings.
 */

const pool = require('../db/jurinexVoiceDB');
const workingHours = require('../tools/workingHours');

const DEFAULT_TZ = process.env.JURINEX_VOICE_DEFAULT_CALENDAR_TZ || 'Asia/Kolkata';

const parseDateOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const list = async (req, res) => {
  try {
    const agentId = req.query.agent_id || null;
    const from = parseDateOrNull(req.query.from) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = parseDateOrNull(req.query.to) || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const params = [from.toISOString(), to.toISOString()];
    let agentFilter = '';
    if (agentId) {
      params.push(agentId);
      agentFilter = `AND b.agent_id = $${params.length}::uuid`;
    }
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT b.id,
              b.session_id,
              b.agent_id,
              a.name        AS agent_name,
              a.display_name AS agent_display_name,
              b.google_event_id,
              b.google_calendar_id,
              b.summary,
              b.description,
              b.start_time,
              b.end_time,
              b.attendee_name,
              b.attendee_email,
              b.attendee_phone,
              b.status,
              b.created_at
         FROM voice_calendar_bookings b
         LEFT JOIN voice_agents a ON a.id = b.agent_id
        WHERE b.start_time BETWEEN $1::timestamptz AND $2::timestamptz
          ${agentFilter}
        ORDER BY b.start_time DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await pool.query(
      `SELECT count(*)::int AS n
         FROM voice_calendar_bookings b
        WHERE b.start_time BETWEEN $1::timestamptz AND $2::timestamptz
          ${agentFilter}`,
      params.slice(0, agentId ? 3 : 2)
    );

    res.json({
      success: true,
      bookings: rows,
      total: countResult.rows[0]?.n || 0,
      from: from.toISOString(),
      to: to.toISOString(),
      filters: { agent_id: agentId, limit, offset },
    });
  } catch (err) {
    console.error('[calendarBookings.list] failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Returns a per-day timeline (filled vs empty slots) for one agent.
// Default window: today + 13 days (so the UI can show a 2-week grid).
const slots = async (req, res) => {
  try {
    const agentId = req.query.agent_id || null;
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agent_id is required' });
    }
    const from = parseDateOrNull(req.query.from) || new Date();
    const to =
      parseDateOrNull(req.query.to) ||
      new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Pull the agent's calendar tool_settings (working hours, blocked
    // dates, default meeting length, timezone).
    const cfgRow = await pool.query(
      `SELECT custom_settings, tool_settings FROM voice_agent_configurations WHERE agent_id = $1`,
      [agentId]
    );
    const cfg = cfgRow.rows[0] || {};
    const calendarSettings =
      cfg.custom_settings?.agent_builder?.tool_settings?.calendar ||
      cfg.tool_settings?.calendar ||
      {};
    const timeZone = calendarSettings.timezone || DEFAULT_TZ;
    const slotMinutes = Number(calendarSettings.default_meeting_minutes) || 30;

    // Pull bookings in window for the agent.
    const bookingsResult = await pool.query(
      `SELECT id, summary, start_time, end_time, attendee_name, attendee_email,
              attendee_phone, google_event_id, status
         FROM voice_calendar_bookings
        WHERE agent_id = $1::uuid
          AND start_time BETWEEN $2::timestamptz AND $3::timestamptz
        ORDER BY start_time ASC`,
      [agentId, from.toISOString(), to.toISOString()]
    );
    const bookings = bookingsResult.rows.map((b) => ({
      ...b,
      start_time: b.start_time.toISOString(),
      end_time: b.end_time.toISOString(),
    }));

    // Build the allowed working windows in the requested range.
    const allowed = workingHours.buildAllowedWindows({
      startIso: from.toISOString(),
      endIso: to.toISOString(),
      settings: calendarSettings,
      timeZone,
    });

    // Subtract existing bookings to compute free windows.
    const busy = bookings.map((b) => ({ start: b.start_time, end: b.end_time }));
    const freeWindows = workingHours.computeFreeWindows({
      startIso: from.toISOString(),
      endIso: to.toISOString(),
      busy,
      settings: calendarSettings,
      timeZone,
      slotMinutes,
    });

    // Group into per-day entries for easy rendering.
    const dayMap = new Map();
    const ensureDay = (iso) => {
      const ymd = new Date(iso).toISOString().slice(0, 10);
      if (!dayMap.has(ymd)) {
        dayMap.set(ymd, {
          date: ymd,
          working_windows: [],
          bookings: [],
          free_slots: [],
        });
      }
      return dayMap.get(ymd);
    };

    for (const win of allowed) {
      ensureDay(new Date(win.startMs).toISOString()).working_windows.push({
        start: new Date(win.startMs).toISOString(),
        end: new Date(win.endMs).toISOString(),
      });
    }
    for (const b of bookings) ensureDay(b.start_time).bookings.push(b);
    for (const f of freeWindows) ensureDay(f.start).free_slots.push(f);

    const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      agent_id: agentId,
      time_zone: timeZone,
      slot_minutes: slotMinutes,
      working_hours_summary: calendarSettings.working_hours || null,
      blocked_dates: calendarSettings.blocked_dates || [],
      from: from.toISOString(),
      to: to.toISOString(),
      days,
      bookings,
      free_windows: freeWindows,
      summary: {
        days_in_window: days.length,
        bookings_count: bookings.length,
        free_window_count: freeWindows.length,
      },
    });
  } catch (err) {
    console.error('[calendarBookings.slots] failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { list, slots };
