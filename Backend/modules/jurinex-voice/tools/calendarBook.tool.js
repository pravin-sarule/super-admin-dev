/**
 * calendar_book tool — creates a Google Calendar event for the caller.
 * Persists a row to voice_calendar_bookings so admins can audit what
 * the agent scheduled.
 */

const calendar = require('./googleCalendar.client');
const workingHours = require('./workingHours');
const bookingNotifier = require('./bookingNotifier');
const pool = require('../db/jurinexVoiceDB');

const DEFAULT_TZ = process.env.JURINEX_VOICE_DEFAULT_CALENDAR_TZ || 'Asia/Kolkata';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isoOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const persistBooking = async ({
  sessionId,
  agentId,
  toolExecutionId,
  googleEventId,
  calendarId,
  summary,
  description,
  startIso,
  endIso,
  attendeeName,
  attendeeEmail,
  attendeePhone,
  meetingLink,
  eventHtmlLink,
}) => {
  await pool.query(
    `INSERT INTO voice_calendar_bookings
       (session_id, agent_id, tool_execution_id, google_event_id, google_calendar_id,
        summary, description, start_time, end_time,
        attendee_name, attendee_email, attendee_phone, status,
        meeting_link, event_html_link)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'confirmed',$13,$14)`,
    [
      sessionId || null,
      agentId || null,
      toolExecutionId || null,
      googleEventId || null,
      calendarId,
      summary,
      description || null,
      startIso,
      endIso,
      attendeeName || null,
      attendeeEmail || null,
      attendeePhone || null,
      meetingLink || null,
      eventHtmlLink || null,
    ]
  );
};

const run = async (args = {}, context = {}) => {
  const startIso = isoOrNull(args.start_iso);
  const endIso = isoOrNull(args.end_iso);
  const summary = String(args.summary || '').trim().slice(0, 200);
  const description = String(args.description || '').trim().slice(0, 2000);
  const attendeeName = String(args.attendee_name || '').trim().slice(0, 120);
  const attendeeEmail = String(args.attendee_email || '').trim();
  const attendeePhone = String(args.attendee_phone || '').trim();

  if (!startIso || !endIso || !summary) {
    return {
      status: 'invalid_arguments',
      booked: false,
      success: false,
      detail: 'BOOKING NOT MADE. start_iso, end_iso, and summary are required. Confirm the time and reason with the caller before calling.',
      instruction_to_agent:
        'The booking did NOT happen. Do not claim success. Ask the caller for the missing detail and try again.',
    };
  }
  if (new Date(startIso).getTime() >= new Date(endIso).getTime()) {
    return {
      status: 'invalid_arguments',
      booked: false,
      success: false,
      detail: 'BOOKING NOT MADE. end_iso must be after start_iso.',
      instruction_to_agent: 'The booking did NOT happen. Do not claim success.',
    };
  }
  if (attendeeEmail && !EMAIL_RE.test(attendeeEmail)) {
    return {
      status: 'invalid_arguments',
      booked: false,
      success: false,
      detail: 'BOOKING NOT MADE. attendee_email looks malformed. Ask the caller to spell it out and try again.',
      instruction_to_agent: 'The booking did NOT happen. Do not claim success. Ask the caller to spell their email letter by letter.',
    };
  }
  if (!calendar.isConfigured()) {
    return {
      status: 'calendar_not_configured',
      booked: false,
      success: false,
      detail:
        'BOOKING NOT MADE. Google Calendar is not configured on the server. Set JURINEX_VOICE_CALENDAR_SA_JSON_BASE64 and share the target calendar with the service account.',
      instruction_to_agent:
        'The booking did NOT happen — calendar is not configured. Apologize and offer to take a callback instead.',
    };
  }

  const calendarSettings = context.toolSettings?.calendar || context.toolSettings || {};
  const calendarId =
    calendarSettings.calendar_id ||
    process.env.JURINEX_VOICE_DEFAULT_CALENDAR_ID ||
    null;
  if (!calendarId) {
    return {
      status: 'calendar_not_configured',
      detail: 'No calendar id is configured for this agent.',
    };
  }
  const timeZone = calendarSettings.timezone || DEFAULT_TZ;

  // Enforce working-hours / blocked-dates / view-only policy before
  // touching Google. The model will see the structured reason and can
  // verbally apologize / propose a different slot.
  const policyError = workingHours.validateBookingTarget({
    startIso,
    endIso,
    settings: calendarSettings,
    timeZone,
  });
  if (policyError) {
    console.warn('[VOICE_TOOL][calendar_book] policy rejected booking', {
      sessionId: context.sessionId,
      agentId: context.agentId,
      code: policyError.code,
      startIso,
      endIso,
    });
    return {
      status: policyError.code,
      booked: false,
      success: false,
      detail: `BOOKING NOT MADE. ${policyError.detail}`,
      instruction_to_agent:
        'The booking did NOT happen. Apologize, explain the slot is not allowed, and propose another time inside the configured working hours.',
    };
  }

  console.log('[VOICE_TOOL][calendar_book] creating event', {
    sessionId: context.sessionId,
    agentId: context.agentId,
    calendarId,
    timeZone,
    startIso,
    endIso,
    attendeeEmail,
  });

  let event;
  try {
    event = await calendar.createEvent({
      calendarId,
      summary,
      description,
      startIso,
      endIso,
      timeZone,
      attendees: attendeeEmail ? [{ email: attendeeEmail, name: attendeeName }] : [],
    });
  } catch (err) {
    console.error('[VOICE_TOOL][calendar_book] event create failed', {
      sessionId: context.sessionId,
      error: err.message,
      response: err.response?.data,
    });
    const apiReason =
      err?.response?.data?.error?.message || err?.message || 'unknown error';
    return {
      status: 'calendar_error',
      booked: false,
      success: false,
      event_id: null,
      detail: `BOOKING FAILED. The Google Calendar API returned: ${apiReason}.`,
      instruction_to_agent:
        'IMPORTANT: the booking did NOT happen. You MUST tell the caller, in their language, that the booking failed and ask if they want to try a different time. DO NOT say it was successful. DO NOT pretend an event was created. There is no event in the calendar.',
    };
  }

  // Google returns the Meet link as either `event.hangoutLink` or the
  // first videoEntryPoint URI on `event.conferenceData.entryPoints`.
  // Prefer hangoutLink — it's the canonical "meet.google.com/abc" form
  // every Workspace user recognises.
  const meetingLink =
    event?.hangoutLink ||
    (Array.isArray(event?.conferenceData?.entryPoints)
      ? event.conferenceData.entryPoints.find((ep) => ep?.entryPointType === 'video')?.uri || null
      : null);

  await persistBooking({
    sessionId: context.sessionId,
    agentId: context.agentId,
    toolExecutionId: context.toolExecutionId,
    googleEventId: event?.id,
    calendarId,
    summary,
    description,
    startIso,
    endIso,
    attendeeName,
    attendeeEmail,
    attendeePhone,
    meetingLink,
    eventHtmlLink: event?.htmlLink || null,
  }).catch((err) => {
    console.warn('[VOICE_TOOL][calendar_book] booking persist failed (event still created on Google)', {
      sessionId: context.sessionId,
      googleEventId: event?.id,
      error: err.message,
    });
  });

  console.log('[VOICE_TOOL][calendar_book] event created', {
    sessionId: context.sessionId,
    googleEventId: event?.id,
    htmlLink: event?.htmlLink,
  });

  // Send confirmation email + .ics attachment. Awaited so the model can
  // truthfully tell the caller whether the email actually went out.
  // Failures are reported as { sent: false, reason } and never throw.
  let emailResult = { sent: false, reason: 'not_attempted' };
  if (attendeeEmail) {
    emailResult = await bookingNotifier
      .sendBookingConfirmation({
        attendeeName,
        attendeeEmail,
        attendeePhone,
        startIso,
        endIso,
        summary,
        description,
        htmlLink: event?.htmlLink,
        meetingLink,
        timeZone,
        googleEventId: event?.id,
      })
      .catch((err) => ({ sent: false, reason: 'notifier_threw', error: err.message }));
  }

  return {
    status: 'booked',
    booked: true,
    success: true,
    event_id: event?.id,
    html_link: event?.htmlLink,
    meeting_link: meetingLink,
    start_iso: startIso,
    end_iso: endIso,
    summary,
    attendee_name: attendeeName || null,
    attendee_email: attendeeEmail || null,
    attendee_phone: attendeePhone || null,
    confirmation_email: emailResult,
    detail:
      emailResult?.sent
        ? 'BOOKING CONFIRMED in Google Calendar AND a confirmation email with calendar attachment has been sent to the caller. Read back the date and time, and tell them to check their inbox.'
        : 'BOOKING CONFIRMED in Google Calendar. The confirmation email could not be sent right now — read back the date and time and tell the caller they are on the calendar; an email will follow if SMTP is configured.',
    instruction_to_agent:
      emailResult?.sent
        ? 'You may now confirm the booking aloud. Mention that a calendar invite has been emailed to the address you confirmed.'
        : 'You may now confirm the booking aloud, but DO NOT promise an email — say "you are on the calendar" instead.',
  };
};

module.exports = { name: 'calendar_book', run };
