/**
 * Sends a confirmation email with an .ics calendar attachment after
 * calendar_book successfully creates a Google Calendar event.
 *
 * Reads SMTP credentials from the existing project env (same vars used
 * by Backend/utils/sendEmail.js):
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 *
 * Optional override (lets you use a dedicated mailbox for bookings):
 *   JURINEX_VOICE_BOOKING_EMAIL_FROM
 *
 * The notifier never throws into the calendar tool — failures are
 * logged so a flaky SMTP can't fail an otherwise successful booking.
 */

const nodemailer = require('nodemailer');

const escapeIcs = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

const formatIcsDate = (iso) => {
  // Convert any ISO date to UTC basic format YYYYMMDDTHHMMSSZ
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
};

const buildIcsFile = ({
  uid,
  startIso,
  endIso,
  summary,
  description,
  attendeeEmail,
  attendeeName,
  organizerEmail,
}) => {
  const dtStart = formatIcsDate(startIso);
  const dtEnd = formatIcsDate(endIso);
  const dtStamp = formatIcsDate(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jurinex Voice Agent//Booking Notifier//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description || '')}`,
    organizerEmail ? `ORGANIZER;CN=Jurinex Voice Agent:mailto:${organizerEmail}` : '',
    attendeeEmail
      ? `ATTENDEE;CN=${escapeIcs(attendeeName || attendeeEmail)};RSVP=TRUE:mailto:${attendeeEmail}`
      : '',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
};

const formatHumanTime = (iso, timeZone = 'Asia/Kolkata') => {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const buildEmailBody = ({
  attendeeName,
  attendeeEmail,
  attendeePhone,
  startIso,
  endIso,
  summary,
  description,
  htmlLink,
  meetingLink,
  timeZone,
}) => {
  const start = formatHumanTime(startIso, timeZone);
  const end = formatHumanTime(endIso, timeZone);
  const greeting = attendeeName ? `Hi ${attendeeName},` : 'Hi,';
  const phoneLine = attendeePhone ? `\nPhone: ${attendeePhone}` : '';

  const html = `<!DOCTYPE html><html><body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937;">
  <p>${greeting}</p>
  <p>Your booking has been confirmed.</p>
  <table style="border-collapse: collapse; margin: 12px 0;">
    <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Title</td><td style="padding: 4px 0; font-weight: 600;">${summary}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Starts</td><td style="padding: 4px 0;">${start}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Ends</td><td style="padding: 4px 0;">${end}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Email</td><td style="padding: 4px 0;">${attendeeEmail || '-'}</td></tr>
    ${attendeePhone ? `<tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Phone</td><td style="padding: 4px 0;">${attendeePhone}</td></tr>` : ''}
  </table>
  ${meetingLink ? `<p style="margin: 16px 0;"><a href="${meetingLink}" style="display: inline-block; background: #1a73e8; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600;">Join Google Meet</a> <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">${meetingLink}</span></p>` : ''}
  ${description ? `<p style="color: #4b5563;"><strong>Notes:</strong><br/>${String(description).replace(/\n/g, '<br/>')}</p>` : ''}
  ${htmlLink ? `<p><a href="${htmlLink}" style="color: #2563eb;">Open the meeting in Google Calendar</a></p>` : ''}
  <p>The .ics attachment will add this directly to your calendar app.</p>
  <p style="color: #9ca3af; font-size: 12px;">— Jurinex voice support</p>
  </body></html>`;

  const text =
    `${greeting}\n\nYour booking has been confirmed.\n\n` +
    `Title: ${summary}\nStarts: ${start}\nEnds: ${end}\n` +
    `Email: ${attendeeEmail || '-'}${phoneLine}\n` +
    (meetingLink ? `\nJoin Google Meet: ${meetingLink}\n` : '') +
    (description ? `\nNotes:\n${description}\n` : '') +
    (htmlLink ? `\nOpen in Google Calendar: ${htmlLink}\n` : '') +
    '\n— Jurinex voice support\n';

  return { html, text };
};

let cachedTransporter = null;
const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!host || !user || !pass) {
    const err = new Error(
      'Booking email skipped: SMTP env (EMAIL_HOST / EMAIL_USER / EMAIL_PASS) is not configured.'
    );
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
  return cachedTransporter;
};

const sendBookingConfirmation = async ({
  attendeeName,
  attendeeEmail,
  attendeePhone,
  startIso,
  endIso,
  summary,
  description,
  htmlLink,
  meetingLink,
  timeZone,
  googleEventId,
  organizerEmailOverride,
}) => {
  if (!attendeeEmail) {
    console.log('[BOOKING_NOTIFIER] no attendee_email — skipping confirmation email', {
      googleEventId,
    });
    return { sent: false, reason: 'no_email' };
  }
  const from =
    process.env.JURINEX_VOICE_BOOKING_EMAIL_FROM ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER;
  if (!from) {
    console.warn('[BOOKING_NOTIFIER] EMAIL_FROM/EMAIL_USER not set — cannot send', {
      googleEventId,
    });
    return { sent: false, reason: 'no_from' };
  }

  let transporter;
  try {
    transporter = getTransporter();
  } catch (err) {
    console.warn('[BOOKING_NOTIFIER] transporter unavailable', {
      googleEventId,
      error: err.message,
    });
    return { sent: false, reason: err.code || 'transport_unavailable', error: err.message };
  }

  const ics = buildIcsFile({
    uid: googleEventId || `${Date.now()}@jurinex-voice`,
    startIso,
    endIso,
    summary,
    description,
    attendeeEmail,
    attendeeName,
    organizerEmail: organizerEmailOverride || from,
  });

  const { html, text } = buildEmailBody({
    attendeeName,
    attendeeEmail,
    attendeePhone,
    startIso,
    endIso,
    summary,
    description,
    htmlLink,
    meetingLink,
    timeZone,
  });

  const mailOptions = {
    from,
    to: attendeeEmail,
    subject: `Confirmed: ${summary}`,
    text,
    html,
    icalEvent: {
      filename: 'booking.ics',
      method: 'REQUEST',
      content: ics,
    },
    attachments: [
      {
        filename: 'booking.ics',
        content: ics,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[BOOKING_NOTIFIER] confirmation email sent', {
      googleEventId,
      to: attendeeEmail,
      messageId: info.messageId,
      response: info.response,
    });
    return { sent: true, message_id: info.messageId, to: attendeeEmail };
  } catch (err) {
    console.error('[BOOKING_NOTIFIER] sendMail failed', {
      googleEventId,
      to: attendeeEmail,
      error: err.message,
    });
    return { sent: false, reason: 'sendmail_failed', error: err.message };
  }
};

module.exports = {
  sendBookingConfirmation,
  buildIcsFile,
  buildEmailBody,
};
