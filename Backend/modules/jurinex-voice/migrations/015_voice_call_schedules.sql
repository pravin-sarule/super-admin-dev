-- Outbound-call scheduler. Admins (or a CSV import) write rows here;
-- the voice-agent runtime polls for due rows, places the Twilio call,
-- and UPDATEs status as it progresses.
--
-- Lifecycle:
--   pending      — admin scheduled the call, not yet picked up
--   queued       — voice-agent picked the row but hasn't dialed yet
--   in_progress  — Twilio is ringing / on the call
--   completed    — call finished successfully
--   failed       — dial / call failed (last_error filled)
--   cancelled    — admin cancelled before pickup
--   no_answer    — Twilio reported no_answer / busy
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS voice_call_schedules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id           UUID NOT NULL,                          -- which agent dials
  recipient_name     TEXT,                                    -- "Vishal Bainade"
  recipient_phone    TEXT NOT NULL,                           -- E.164 preferred
  recipient_email    TEXT,                                    -- optional
  scheduled_at       TIMESTAMPTZ NOT NULL,                    -- when to dial
  timezone           TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status             TEXT NOT NULL DEFAULT 'pending',
  attempts           INT  NOT NULL DEFAULT 0,
  max_attempts       INT  NOT NULL DEFAULT 3,
  last_attempt_at    TIMESTAMPTZ,
  last_error         TEXT,
  twilio_call_sid    TEXT,                                    -- once dialed
  call_id            UUID,                                    -- FK → calls when wired
  notes              TEXT,                                    -- admin notes
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,      -- custom fields per row
  batch_id           UUID,                                    -- shared by all rows in one CSV import
  source             TEXT NOT NULL DEFAULT 'manual',          -- manual|csv|api
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_call_schedules_due_idx
  ON voice_call_schedules (status, scheduled_at)
  WHERE status IN ('pending', 'queued');
CREATE INDEX IF NOT EXISTS voice_call_schedules_agent_idx
  ON voice_call_schedules (agent_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS voice_call_schedules_batch_idx
  ON voice_call_schedules (batch_id);
CREATE INDEX IF NOT EXISTS voice_call_schedules_phone_idx
  ON voice_call_schedules (recipient_phone);
