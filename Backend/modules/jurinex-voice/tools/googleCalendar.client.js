/**
 * Thin Google Calendar v3 REST client used by the calendar_check and
 * calendar_book tools. Auth via a Google service-account JSON. The
 * service account must have the calendar shared with it ("Make changes
 * to events" permission) for the chosen calendar id.
 *
 * Required env:
 *   JURINEX_VOICE_CALENDAR_SA_JSON_BASE64   base64'd service-account JSON
 *     (or)
 *   GOOGLE_APPLICATION_CREDENTIALS          path to service-account JSON
 *
 *   JURINEX_VOICE_DEFAULT_CALENDAR_ID       fallback calendar id when an
 *                                           agent has none configured
 *   JURINEX_VOICE_DEFAULT_CALENDAR_TZ       e.g. "Asia/Kolkata"
 */
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

const SCOPE = 'https://www.googleapis.com/auth/calendar';
const BASE = 'https://www.googleapis.com/calendar/v3';

let cachedAuth = null;

const getAuth = () => {
  if (cachedAuth) return cachedAuth;

  const base64 = process.env.JURINEX_VOICE_CALENDAR_SA_JSON_BASE64;
  if (base64) {
    let credentials;
    try {
      credentials = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    } catch (err) {
      throw new Error(
        `JURINEX_VOICE_CALENDAR_SA_JSON_BASE64 is set but cannot be decoded: ${err.message}`
      );
    }
    cachedAuth = new GoogleAuth({ credentials, scopes: [SCOPE] });
    return cachedAuth;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    cachedAuth = new GoogleAuth({ scopes: [SCOPE] });
    return cachedAuth;
  }

  const err = new Error(
    'Google Calendar is not configured. Set JURINEX_VOICE_CALENDAR_SA_JSON_BASE64 (base64 service-account JSON) or GOOGLE_APPLICATION_CREDENTIALS.'
  );
  err.code = 'CALENDAR_NOT_CONFIGURED';
  throw err;
};

const getAuthorizedHeaders = async () => {
  const auth = getAuth();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token?.token) {
    const err = new Error('Failed to mint Google Calendar access token.');
    err.code = 'CALENDAR_AUTH_FAILED';
    throw err;
  }
  return { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' };
};

const isConfigured = () =>
  Boolean(
    process.env.JURINEX_VOICE_CALENDAR_SA_JSON_BASE64 ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );

const queryFreeBusy = async ({ calendarId, startIso, endIso, timeZone }) => {
  const headers = await getAuthorizedHeaders();
  const { data } = await axios.post(
    `${BASE}/freeBusy`,
    {
      timeMin: startIso,
      timeMax: endIso,
      timeZone,
      items: [{ id: calendarId }],
    },
    { headers, timeout: 15_000 }
  );
  const slot = data?.calendars?.[calendarId];
  if (slot?.errors?.length) {
    const err = new Error(
      `Google Calendar refused freeBusy query: ${slot.errors.map((e) => e.reason).join(', ')}`
    );
    err.code = 'CALENDAR_FREEBUSY_ERROR';
    err.detail = slot.errors;
    throw err;
  }
  return Array.isArray(slot?.busy) ? slot.busy : [];
};

const createEvent = async ({
  calendarId,
  summary,
  description,
  startIso,
  endIso,
  timeZone,
  attendees = [],
  sendUpdates = 'all',
}) => {
  const headers = await getAuthorizedHeaders();
  // Google rejects events that include `attendees` when the caller is a
  // plain service account without Domain-Wide Delegation:
  //   403 "Service accounts cannot invite attendees without Domain-Wide
  //   Delegation of Authority."
  // To avoid that gate while still preserving who the booking is for,
  // we omit the attendees array and append a "Booked for" footer to
  // the event description instead. The structured contact info is
  // still persisted to voice_calendar_bookings for audit.
  const inviteeFooterLines = (attendees || [])
    .filter((a) => a?.email || a?.name || a?.phone)
    .map((a) => {
      const parts = [];
      if (a.name) parts.push(a.name);
      if (a.email) parts.push(`<${a.email}>`);
      if (a.phone) parts.push(`📞 ${a.phone}`);
      return `  • ${parts.join(' ')}`;
    });
  const composedDescription = inviteeFooterLines.length
    ? `${description ? `${description}\n\n` : ''}Booked for:\n${inviteeFooterLines.join('\n')}`
    : description;
  const body = {
    summary,
    description: composedDescription,
    start: { dateTime: startIso, timeZone },
    end: { dateTime: endIso, timeZone },
  };
  // Request a Google Meet link unless explicitly disabled. The
  // `createRequest` form works for service accounts without DWD as
  // long as the calendar lives on a Workspace tenant with Meet enabled
  // — the resulting `hangoutLink` is what we surface in the admin UI.
  // Opt out with JURINEX_VOICE_CALENDAR_DISABLE_MEET=true for tenants
  // without Meet, otherwise event creation will 400.
  const wantsMeet = process.env.JURINEX_VOICE_CALENDAR_DISABLE_MEET !== 'true';
  if (wantsMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: `jurinex-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }
  // Allow opt-in to real attendees only when DWD is wired (env override).
  if (process.env.JURINEX_VOICE_CALENDAR_ALLOW_ATTENDEES === 'true' && attendees.length) {
    body.attendees = attendees
      .filter((a) => a?.email)
      .map((a) => ({ email: a.email, displayName: a.name || undefined }));
  }
  const conferenceParam = wantsMeet ? '&conferenceDataVersion=1' : '';
  const url = `${BASE}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=${encodeURIComponent(sendUpdates)}${conferenceParam}`;
  const { data } = await axios.post(url, body, { headers, timeout: 20_000 });
  return data;
};

module.exports = {
  isConfigured,
  queryFreeBusy,
  createEvent,
};
