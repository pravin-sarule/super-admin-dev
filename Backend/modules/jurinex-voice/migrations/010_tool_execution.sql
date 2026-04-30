-- Tables backing real tool execution from the voice agent.
-- Idempotent: safe to re-run.

-- Audit log: every tool call the agent issues, success or fail.
CREATE TABLE IF NOT EXISTS voice_tool_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID,
  agent_id        UUID,
  trace_id        UUID,
  function_call_id TEXT,
  tool_name       TEXT NOT NULL,
  input_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json     JSONB,
  status          TEXT NOT NULL DEFAULT 'pending',
  error_message   TEXT,
  latency_ms      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS voice_tool_executions_agent_idx
  ON voice_tool_executions (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_tool_executions_session_idx
  ON voice_tool_executions (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_tool_executions_tool_idx
  ON voice_tool_executions (tool_name, status, created_at DESC);

-- Calendar bookings created by an agent through the calendar_book tool.
CREATE TABLE IF NOT EXISTS voice_calendar_bookings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID,
  agent_id             UUID,
  tool_execution_id    UUID REFERENCES voice_tool_executions(id) ON DELETE SET NULL,
  google_event_id      TEXT,
  google_calendar_id   TEXT NOT NULL,
  summary              TEXT,
  description          TEXT,
  start_time           TIMESTAMPTZ NOT NULL,
  end_time             TIMESTAMPTZ NOT NULL,
  attendee_name        TEXT,
  attendee_email       TEXT,
  attendee_phone       TEXT,
  status               TEXT NOT NULL DEFAULT 'confirmed',
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_calendar_bookings_agent_idx
  ON voice_calendar_bookings (agent_id, start_time DESC);
CREATE INDEX IF NOT EXISTS voice_calendar_bookings_session_idx
  ON voice_calendar_bookings (session_id);

-- Per-agent tool configuration (calendar id, agent transfer targets, etc.)
-- Keys we store in custom_settings as JSON: { calendar_id, calendar_timezone,
-- meeting_duration_minutes, agent_transfer_targets: [{agent_id, label}] }
ALTER TABLE voice_agent_configurations
  ADD COLUMN IF NOT EXISTS tool_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
