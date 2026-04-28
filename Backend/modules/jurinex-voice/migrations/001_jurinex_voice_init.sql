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

-- ── seed default agent ────────────────────────────────────────────
INSERT INTO voice_agents (name, display_name, description, status, language_config)
SELECT 'preeti',
       'Preeti - Jurinex Customer Support',
       'Default Jurinex voice agent for customer support.',
       'active',
       '{"languages":["en","hi","mr"]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM voice_agents);
