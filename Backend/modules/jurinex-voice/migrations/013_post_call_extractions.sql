-- Stores the result of running the admin-configured post-call data
-- extraction job after a voice session ends. The admin defines a list of
-- fields in the agent builder (Call Summary / Successful / Sentiment /
-- preferred_language / any custom field they add); on session close, the
-- backend pipes the transcript + that schema into Gemini and persists
-- the structured JSON output here.

CREATE TABLE IF NOT EXISTS voice_post_call_extractions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID,                    -- browser/live-test session
  call_id            UUID,                    -- real Twilio call when wired
  agent_id           UUID,
  status             TEXT NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed|skipped
  extraction_fields  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Snapshot of the admin's field schema at extraction time, e.g.
  --   [
  --     {"key":"call_summary","label":"Call Summary","type":"text","enabled":true},
  --     {"key":"call_successful","label":"Call Successful","type":"boolean","enabled":true},
  --     {"key":"user_sentiment","label":"User Sentiment","type":"enum","enabled":true,
  --      "options":["positive","neutral","negative"]},
  --     {"key":"preferred_language","label":"Preferred Language","type":"string","enabled":true}
  --   ]
  extracted_data     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- The model's structured response keyed by field key, e.g.
  --   {"call_summary":"Caller asked about Smart Case Summarizer pricing...",
  --    "call_successful":true, "user_sentiment":"positive",
  --    "preferred_language":"English"}
  transcript         TEXT,
  extraction_model   TEXT,
  error_message      TEXT,
  latency_ms         INT,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_post_call_extractions_session_idx
  ON voice_post_call_extractions (session_id);
CREATE INDEX IF NOT EXISTS voice_post_call_extractions_agent_idx
  ON voice_post_call_extractions (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_post_call_extractions_status_idx
  ON voice_post_call_extractions (status, created_at DESC);
