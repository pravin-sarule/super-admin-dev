-- Adds Meet + Google-Calendar-event-link columns to voice_calendar_bookings
-- so the admin Calendar tab can show a "Join Meet" / "Open in Calendar"
-- button on every booking without hitting the Google API on render.
-- Idempotent: safe to re-run.

ALTER TABLE voice_calendar_bookings
  ADD COLUMN IF NOT EXISTS meeting_link    TEXT,
  ADD COLUMN IF NOT EXISTS event_html_link TEXT;
