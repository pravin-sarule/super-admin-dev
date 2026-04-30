-- Jurinex Voice — initial schema.
-- Idempotent: safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── voice_agents ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  display_name    TEXT,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  language_config JSONB,
  system_prompt   TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS voice_agents_name_uq    ON voice_agents (name);
CREATE INDEX        IF NOT EXISTS voice_agents_status_idx ON voice_agents (status);

-- ── voice_agent_configurations ──────────────────────────────────────
-- One row per agent for model, voice, retrieval, and system-prompt settings.
CREATE TABLE IF NOT EXISTS voice_agent_configurations (
  agent_id                 UUID PRIMARY KEY REFERENCES voice_agents(id) ON DELETE CASCADE,
  text_model               TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
  live_model               TEXT NOT NULL DEFAULT 'gemini-3.1-flash-live-preview',
  voice_name               TEXT NOT NULL DEFAULT 'Puck',
  voice_tag                TEXT NOT NULL DEFAULT 'Upbeat',
  temperature              NUMERIC(4, 2) NOT NULL DEFAULT 0.10,
  top_p                    NUMERIC(4, 2) NOT NULL DEFAULT 0.95,
  max_tokens               INT NOT NULL DEFAULT 150,
  top_k_results            INT NOT NULL DEFAULT 5,
  text_chat_system_prompt  TEXT,
  audio_live_system_prompt TEXT,
  custom_settings          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_agent_configurations_temperature_ck CHECK (temperature >= 0 AND temperature <= 2),
  CONSTRAINT voice_agent_configurations_top_p_ck CHECK (top_p >= 0 AND top_p <= 1),
  CONSTRAINT voice_agent_configurations_max_tokens_ck CHECK (max_tokens > 0),
  CONSTRAINT voice_agent_configurations_top_k_ck CHECK (top_k_results > 0)
);

CREATE INDEX IF NOT EXISTS voice_agent_configurations_voice_idx ON voice_agent_configurations (voice_name);

-- ── voice_agent_transfer_configs ───────────────────────────────────
-- One row per agent for the transfer_call tool / handoff behavior.
CREATE TABLE IF NOT EXISTS voice_agent_transfer_configs (
  agent_id              UUID PRIMARY KEY REFERENCES voice_agents(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL DEFAULT 'transfer_call',
  description           TEXT,
  routing_mode          TEXT NOT NULL DEFAULT 'dynamic',
  static_destination    TEXT,
  destination_prompt    TEXT,
  e164_format           BOOLEAN NOT NULL DEFAULT true,
  transfer_type         TEXT NOT NULL DEFAULT 'warm',
  on_hold_music         TEXT NOT NULL DEFAULT 'Ringtone',
  ring_duration_seconds INT NOT NULL DEFAULT 30,
  navigate_ivr          BOOLEAN NOT NULL DEFAULT false,
  internal_queue        BOOLEAN NOT NULL DEFAULT true,
  agent_wait_seconds    INT NOT NULL DEFAULT 30,
  whisper_debrief       BOOLEAN NOT NULL DEFAULT false,
  whisper_message       TEXT,
  three_way_ring_tone   BOOLEAN NOT NULL DEFAULT true,
  three_way_debrief     BOOLEAN NOT NULL DEFAULT true,
  handoff_mode          TEXT NOT NULL DEFAULT 'prompt',
  handoff_message       TEXT,
  displayed_caller_id   TEXT NOT NULL DEFAULT 'retell_agent',
  custom_settings       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_agent_transfer_configs_routing_ck CHECK (routing_mode IN ('static', 'dynamic')),
  CONSTRAINT voice_agent_transfer_configs_type_ck CHECK (transfer_type IN ('cold', 'warm', 'agentic_warm')),
  CONSTRAINT voice_agent_transfer_configs_handoff_ck CHECK (handoff_mode IN ('prompt', 'static')),
  CONSTRAINT voice_agent_transfer_configs_caller_id_ck CHECK (displayed_caller_id IN ('retell_agent', 'user')),
  CONSTRAINT voice_agent_transfer_configs_ring_duration_ck CHECK (ring_duration_seconds > 0),
  CONSTRAINT voice_agent_transfer_configs_wait_ck CHECK (agent_wait_seconds > 0)
);

CREATE INDEX IF NOT EXISTS voice_agent_transfer_configs_type_idx ON voice_agent_transfer_configs (transfer_type);

-- ── kb_documents ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NULL REFERENCES voice_agents(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  source_type       TEXT NOT NULL,
  source_uri        TEXT,
  gcs_bucket        TEXT,
  gcs_object_name   TEXT,
  gcs_uri           TEXT,
  original_filename TEXT,
  content_type      TEXT,
  file_size_bytes   BIGINT,
  file_hash         TEXT,
  raw_text          TEXT,
  status            TEXT NOT NULL DEFAULT 'processing',
  error_message     TEXT,
  chunk_count       INT  NOT NULL DEFAULT 0,
  token_count       INT  NOT NULL DEFAULT 0,
  embedding_model   TEXT NOT NULL DEFAULT 'text-embedding-004',
  embedding_dim     INT  NOT NULL DEFAULT 768,
  language          TEXT,
  tags              TEXT[],
  uploaded_by       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS kb_documents_file_hash_uq   ON kb_documents (file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX        IF NOT EXISTS kb_documents_status_idx     ON kb_documents (status);
CREATE INDEX        IF NOT EXISTS kb_documents_source_idx     ON kb_documents (source_type);
CREATE INDEX        IF NOT EXISTS kb_documents_agent_idx      ON kb_documents (agent_id);
CREATE INDEX        IF NOT EXISTS kb_documents_created_idx    ON kb_documents (created_at DESC);

-- ── kb_chunks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_index  INT  NOT NULL,
  text         TEXT NOT NULL,
  token_count  INT  NOT NULL,
  char_start   INT,
  char_end     INT,
  heading_path TEXT,
  metadata     JSONB,
  embedding    vector(768) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kb_chunks_doc_chunk_uq UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS kb_chunks_doc_idx       ON kb_chunks (document_id, chunk_index);

-- HNSW preferred (pgvector ≥ 0.5). Falls back to ivfflat automatically.
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS kb_chunks_embedding_hnsw
             ON kb_chunks USING hnsw (embedding vector_cosine_ops)';
  EXCEPTION WHEN others THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS kb_chunks_embedding_ivfflat
             ON kb_chunks USING ivfflat (embedding vector_cosine_ops)
             WITH (lists = 100)';
  END;
END$$;

-- ── kb_search_logs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_search_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id        UUID NULL,
  agent_id       UUID NULL REFERENCES voice_agents(id) ON DELETE SET NULL,
  query          TEXT NOT NULL,
  top_chunk_ids  UUID[],
  top_scores     DOUBLE PRECISION[],
  latency_ms     INT,
  source         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_search_logs_call_idx    ON kb_search_logs (call_id);
CREATE INDEX IF NOT EXISTS kb_search_logs_agent_idx   ON kb_search_logs (agent_id);
CREATE INDEX IF NOT EXISTS kb_search_logs_created_idx ON kb_search_logs (created_at DESC);

-- ── voice_debug_events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_debug_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id     TEXT,
  agent_id     UUID NULL,
  document_id  UUID NULL,
  event_type   TEXT NOT NULL,
  event_stage  TEXT,
  message      TEXT NOT NULL,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_debug_events_trace_idx   ON voice_debug_events (trace_id);
CREATE INDEX IF NOT EXISTS voice_debug_events_type_idx    ON voice_debug_events (event_type);
CREATE INDEX IF NOT EXISTS voice_debug_events_created_idx ON voice_debug_events (created_at DESC);

-- ── voice_call_enrichments ─────────────────────────────────────────
-- Optional admin overlay for call analytics fields that the user-side
-- call service may not store in `calls` yet. The analytics/history API
-- works without this table and falls back to derived values, but once the
-- call service writes here the dashboard can show exact cost, outcome,
-- latency, agent metadata, custom attributes, and recording URLs.
CREATE TABLE IF NOT EXISTS voice_call_enrichments (
  call_id               UUID PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  agent_id              UUID NULL REFERENCES voice_agents(id) ON DELETE SET NULL,
  agent_name            TEXT,
  agent_version         TEXT,
  channel_type          TEXT,
  session_outcome       TEXT,
  end_reason            TEXT,
  end_to_end_latency_ms INT,
  average_latency_ms    INT,
  llm_token_count       INT,
  cost_usd              NUMERIC(12, 6),
  preferred_language    TEXT,
  successful            BOOLEAN,
  picked_up             BOOLEAN,
  transfer_requested    BOOLEAN,
  voicemail             BOOLEAN,
  recording_url         TEXT,
  recording_gcs_uri     TEXT,
  custom_attributes     JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_call_enrichments_agent_idx    ON voice_call_enrichments (agent_id);
CREATE INDEX IF NOT EXISTS voice_call_enrichments_outcome_idx  ON voice_call_enrichments (session_outcome);
CREATE INDEX IF NOT EXISTS voice_call_enrichments_language_idx ON voice_call_enrichments (preferred_language);

-- Helpful read-side indexes for call history and detail drawers.
CREATE INDEX IF NOT EXISTS calls_started_at_idx              ON calls (started_at DESC);
CREATE INDEX IF NOT EXISTS calls_status_idx                  ON calls (status);
CREATE INDEX IF NOT EXISTS calls_direction_idx               ON calls (direction);
CREATE INDEX IF NOT EXISTS call_messages_call_timestamp_idx  ON call_messages (call_id, timestamp);
CREATE INDEX IF NOT EXISTS call_debug_events_call_created_idx ON call_debug_events (call_id, created_at);
CREATE INDEX IF NOT EXISTS agent_tool_events_call_created_idx ON agent_tool_events (call_id, created_at);

-- ── seed default agent ────────────────────────────────────────────
INSERT INTO voice_agents (name, display_name, description, status, language_config)
SELECT 'preeti',
       'Preeti - Jurinex Customer Support',
       'Default Jurinex voice agent for customer support.',
       'active',
       '{"languages":["en","hi","mr"]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM voice_agents);

-- Seed/upgrade per-agent configuration rows. Existing JSON config from the
-- first admin UI version is copied into proper columns when present.
INSERT INTO voice_agent_configurations (
  agent_id,
  text_model,
  live_model,
  voice_name,
  voice_tag,
  temperature,
  top_p,
  max_tokens,
  top_k_results,
  text_chat_system_prompt,
  audio_live_system_prompt,
  custom_settings
)
SELECT
  va.id,
  COALESCE(va.language_config #>> '{admin_config,text_model}', 'gemini-1.5-flash'),
  COALESCE(va.language_config #>> '{admin_config,live_model}', 'gemini-3.1-flash-live-preview'),
  COALESCE(va.language_config #>> '{admin_config,voice}', 'Puck'),
  COALESCE(va.language_config #>> '{admin_config,voice_tag}', 'Upbeat'),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,temperature}', '')::numeric, 0.10),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,top_p}', '')::numeric, 0.95),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,max_tokens}', '')::int, 150),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,top_k_results}', '')::int, 5),
  COALESCE(
    va.language_config #>> '{admin_config,system_prompts,text_chat}',
    va.system_prompt,
    'You are the Nexintel AI Support Agent. Provide fast, accurate solutions based ONLY on the provided document context. If the answer is not found, state: "I am sorry, I do not have information on that in our records." Keep responses under 3 sentences.'
  ),
  COALESCE(
    va.language_config #>> '{admin_config,system_prompts,audio_live}',
    'You are the Nexintel AI Support Agent. Provide fast, accurate answers based ONLY on documents retrieved via search_documents. Keep spoken responses under 20 seconds.'
  ),
  COALESCE(va.language_config #> '{admin_config,custom_settings}', '{}'::jsonb)
FROM voice_agents va
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO voice_agent_transfer_configs (
  agent_id,
  name,
  description,
  routing_mode,
  static_destination,
  destination_prompt,
  e164_format,
  transfer_type,
  on_hold_music,
  ring_duration_seconds,
  navigate_ivr,
  internal_queue,
  agent_wait_seconds,
  whisper_debrief,
  whisper_message,
  three_way_ring_tone,
  three_way_debrief,
  handoff_mode,
  handoff_message,
  displayed_caller_id,
  custom_settings
)
SELECT
  va.id,
  COALESCE(va.language_config #>> '{admin_config,transfer_call,name}', 'transfer_call'),
  COALESCE(va.language_config #>> '{admin_config,transfer_call,description}', 'Transfer the call to a human agent'),
  COALESCE(va.language_config #>> '{admin_config,transfer_call,routing_mode}', 'dynamic'),
  va.language_config #>> '{admin_config,transfer_call,static_destination}',
  COALESCE(
    va.language_config #>> '{admin_config,transfer_call,destination_prompt}',
    'If the user wants to reach support, transfer to +1 (925) 222-2222; if the user wants to reach sales, transfer to +1 (925) 333-3333'
  ),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,transfer_call,e164_format}', '')::boolean, true),
  COALESCE(va.language_config #>> '{admin_config,transfer_call,transfer_type}', 'warm'),
  COALESCE(va.language_config #>> '{admin_config,transfer_call,on_hold_music}', 'Ringtone'),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,transfer_call,ring_duration_seconds}', '')::int, 30),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,transfer_call,navigate_ivr}', '')::boolean, false),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,transfer_call,internal_queue}', '')::boolean, true),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,transfer_call,agent_wait_seconds}', '')::int, 30),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,transfer_call,whisper_debrief}', '')::boolean, false),
  va.language_config #>> '{admin_config,transfer_call,whisper_message}',
  COALESCE(NULLIF(va.language_config #>> '{admin_config,transfer_call,three_way_ring_tone}', '')::boolean, true),
  COALESCE(NULLIF(va.language_config #>> '{admin_config,transfer_call,three_way_debrief}', '')::boolean, true),
  COALESCE(va.language_config #>> '{admin_config,transfer_call,handoff_mode}', 'prompt'),
  COALESCE(va.language_config #>> '{admin_config,transfer_call,handoff_message}', 'Continue translating for the customer and the technician'),
  COALESCE(va.language_config #>> '{admin_config,transfer_call,displayed_caller_id}', 'retell_agent'),
  COALESCE(va.language_config #> '{admin_config,transfer_call,custom_settings}', '{}'::jsonb)
FROM voice_agents va
ON CONFLICT (agent_id) DO NOTHING;
