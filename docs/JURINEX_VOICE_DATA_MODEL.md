# Jurinex Voice — Data Model, Embeddings, and Chunking Reference

End-to-end reference for the Jurinex Voice admin module. Covers
**which database** is used, **which tables** exist, **which columns**
hold the original file, raw text, chunks, embeddings, search history,
and debug events, and exactly **how** chunks are produced and embedded.

---

## 1. Database

| Item             | Value                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Engine           | PostgreSQL with the `vector` extension (pgvector) and `pgcrypto` (for `gen_random_uuid()`).   |
| Host             | `35.200.202.69:5432`                                                                          |
| Database         | **`Calling_agent_DB`**                                                                        |
| User             | `db_user`                                                                                     |
| Connection URL   | `postgresql://db_user:Nexintelai_43@35.200.202.69:5432/Calling_agent_DB`                      |
| Env var          | `JURINEX_VOICE_DATABASE_URL` (in `Backend/.env`)                                              |
| pg pool          | `Backend/modules/jurinex-voice/db/jurinexVoiceDB.js`                                          |

This is the same Cloud SQL database used by the sibling
`jurinex_call_agent` voice service. The admin module **only writes** to
its own tables (`voice_agents`, `kb_documents`, `kb_chunks`,
`kb_search_logs`, `voice_debug_events`, `voice_call_enrichments`); it never modifies the existing
call-agent tables (`customers`, `calls`, `call_messages`,
`support_tickets`, `escalations`, `agent_tool_events`,
`call_debug_events`).

**Migration runner:**

```bash
cd Backend
npm run migrate:jurinex-voice
# → Backend/modules/jurinex-voice/db/migrate.js
# → Backend/modules/jurinex-voice/migrations/001_jurinex_voice_init.sql
```

The migration creates `CREATE EXTENSION IF NOT EXISTS vector;` and all
tables / indexes shown below; idempotent and safe to re-run.

---

## 2. Original uploaded file (Google Cloud Storage)

The actual uploaded PDF / DOCX / TXT / MD bytes are **never** stored in
PostgreSQL. They live in GCS:

| Item             | Value                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| Bucket           | **`jurinex-voice-docs`** (override with `GCS_VOICE_BUCKET`)                      |
| Region           | recommended `asia-south1`                                                        |
| Object naming    | `voice-agents/{agent_id}/documents/{document_id}/{safe_filename}`                |
| Global docs      | `voice-agents/global/documents/{document_id}/{safe_filename}`                    |
| Service module   | `Backend/modules/jurinex-voice/gcs/gcsStorage.service.js`                        |
| Required role    | `roles/storage.objectAdmin` on the bucket for the backend service account       |
| Credentials      | `GCS_KEY_BASE64` (base64 service-account JSON) → `GOOGLE_APPLICATION_CREDENTIALS` → ADC |

Filename sanitization: NFKD normalization + `[^a-zA-Z0-9._-]` → `_`
(trimmed to 180 chars).

---

## 3. Tables created by this module

### 3.1 `voice_agents`

Catalog of voice agents (e.g. `preeti` — Jurinex customer support bot).

| Column            | Type           | Notes                                                       |
| ----------------- | -------------- | ----------------------------------------------------------- |
| `id`              | UUID PK        | `gen_random_uuid()` default                                 |
| `name`            | TEXT NOT NULL  | Unique; lowercase identifier (e.g. `preeti`)                |
| `display_name`    | TEXT           | UI-friendly label                                           |
| `description`    | TEXT           |                                                             |
| `status`          | TEXT NOT NULL  | `active` \| `inactive` \| `draft` (default `active`)         |
| `language_config` | JSONB          | e.g. `{"languages": ["en","hi","mr"]}`                      |
| `system_prompt`   | TEXT           | Optional persona prompt                                     |
| `created_by`      | TEXT           | User email or auth-method tag                               |
| `created_at`      | TIMESTAMPTZ    | now()                                                       |
| `updated_at`      | TIMESTAMPTZ    | now()                                                       |

Indexes: `voice_agents_name_uq` (UNIQUE on `name`),
`voice_agents_status_idx`.

Seed: a default `preeti` agent (`Preeti — Jurinex Customer Support`,
languages `en/hi/mr`) is inserted on first migration if the table is
empty.

Soft delete: `DELETE /agents/:id` sets `status='inactive'`.

### 3.1.1 `voice_agent_configurations`

One row per voice agent for model, voice, retrieval, and prompt
settings. Created by the Jurinex voice migration if it does not exist.

| Column                     | Type          | Notes                                          |
| -------------------------- | ------------- | ---------------------------------------------- |
| `agent_id`                 | UUID PK/FK    | FK → `voice_agents(id)` `ON DELETE CASCADE`    |
| `text_model`               | TEXT          | Default `gemini-1.5-flash`                    |
| `live_model`               | TEXT          | Default `gemini-3.1-flash-live-preview`       |
| `voice_name`               | TEXT          | Selected voice, e.g. `Puck`, `Leda`            |
| `voice_tag`                | TEXT          | UI category, e.g. `Upbeat`, `Calm`             |
| `temperature`              | NUMERIC(4,2)  | 0 to 2                                         |
| `top_p`                    | NUMERIC(4,2)  | 0 to 1                                         |
| `max_tokens`               | INT           | Output token cap                               |
| `top_k_results`            | INT           | KB retrieval result count                      |
| `text_chat_system_prompt`  | TEXT          | Text/chat prompt                               |
| `audio_live_system_prompt` | TEXT          | Live audio prompt                              |
| `custom_settings`          | JSONB         | Extra forward-compatible settings              |
| `created_at` / `updated_at`| TIMESTAMPTZ   | Audit timestamps                               |

### 3.1.2 `voice_agent_transfer_configs`

One row per voice agent for the `transfer_call` tool and handoff
behavior. Created by the Jurinex voice migration if it does not exist.

| Column                  | Type        | Notes                                                       |
| ----------------------- | ----------- | ----------------------------------------------------------- |
| `agent_id`              | UUID PK/FK  | FK → `voice_agents(id)` `ON DELETE CASCADE`                 |
| `name`                  | TEXT        | Usually `transfer_call`                                    |
| `description`           | TEXT        | Tool description                                            |
| `routing_mode`          | TEXT        | `static` \| `dynamic`                                       |
| `static_destination`    | TEXT        | Static phone destination when used                          |
| `destination_prompt`    | TEXT        | Dynamic routing prompt                                      |
| `e164_format`           | BOOLEAN     | Whether destinations should normalize to E.164              |
| `transfer_type`         | TEXT        | `cold` \| `warm` \| `agentic_warm`                          |
| `on_hold_music`         | TEXT        | e.g. `Ringtone`                                             |
| `ring_duration_seconds` | INT         | Transfer ringing timeout                                    |
| `navigate_ivr`          | BOOLEAN     | Whether the agent should navigate IVR                       |
| `internal_queue`        | BOOLEAN     | Whether to wait for a real agent before debriefing          |
| `agent_wait_seconds`    | INT         | Internal queue/agent wait timeout                           |
| `whisper_debrief`       | BOOLEAN     | Private message to transfer agent                           |
| `whisper_message`       | TEXT        | Optional whisper content                                    |
| `three_way_ring_tone`   | BOOLEAN     | Play bridged-call tone                                      |
| `three_way_debrief`     | BOOLEAN     | Public handoff message for both parties                     |
| `handoff_mode`          | TEXT        | `prompt` \| `static`                                        |
| `handoff_message`       | TEXT        | Handoff prompt/sentence                                     |
| `displayed_caller_id`   | TEXT        | `retell_agent` \| `user`                                    |
| `custom_settings`       | JSONB       | Extra forward-compatible settings                           |
| `created_at` / `updated_at` | TIMESTAMPTZ | Audit timestamps                                      |

---

### 3.2 `kb_documents`

One row per uploaded knowledge document. Holds **document metadata**,
**GCS pointer**, and (optionally) the cached `raw_text`.

| Column              | Type          | Notes                                                                     |
| ------------------- | ------------- | ------------------------------------------------------------------------- |
| `id`                | UUID PK       | also used in the GCS object path                                          |
| `agent_id`          | UUID FK       | → `voice_agents(id)` `ON DELETE SET NULL`. NULL = global doc              |
| `title`             | TEXT NOT NULL | Defaults to filename if not provided                                       |
| `source_type`       | TEXT NOT NULL | `pdf` \| `docx` \| `txt` \| `md` \| `manual` (raw text)                    |
| `source_uri`        | TEXT          | Mirrors `gcs_uri` for file uploads                                         |
| `gcs_bucket`        | TEXT          | `jurinex-voice-docs`                                                       |
| `gcs_object_name`   | TEXT          | `voice-agents/{agent}/documents/{doc}/{filename}`                          |
| `gcs_uri`           | TEXT          | `gs://jurinex-voice-docs/voice-agents/...`                                 |
| `original_filename` | TEXT          |                                                                           |
| `content_type`      | TEXT          | MIME type                                                                  |
| `file_size_bytes`   | BIGINT        |                                                                           |
| `file_hash`         | TEXT          | **sha256 of file bytes** — used for idempotent dedupe                      |
| `raw_text`          | TEXT          | Cached extracted text (truncated to 200 KB for large docs)                 |
| `status`            | TEXT NOT NULL | `processing` \| `ready` \| `failed` (default `processing`)                 |
| `error_message`     | TEXT          | Set when `status='failed'` (prefixed with `[stage]`)                        |
| `chunk_count`       | INT           | Filled on success                                                          |
| `token_count`       | INT           | Sum of approx tokens across chunks                                         |
| `embedding_model`   | TEXT NOT NULL | e.g. `gemini-embedding-001` (column default `text-embedding-004` for compat) |
| `embedding_dim`     | INT NOT NULL  | `768`                                                                      |
| `language`          | TEXT          | `en`/`hi`/`mr`/null                                                        |
| `tags`              | TEXT[]        | Comma-separated input split into array                                     |
| `uploaded_by`       | TEXT          | User email or auth-method tag                                              |
| `created_at`        | TIMESTAMPTZ   | now()                                                                      |
| `updated_at`        | TIMESTAMPTZ   | now()                                                                      |

Indexes: `kb_documents_file_hash_uq` (UNIQUE WHERE NOT NULL),
`kb_documents_status_idx`, `kb_documents_source_idx`,
`kb_documents_agent_idx`, `kb_documents_created_idx (DESC)`.

Idempotency: an upload whose sha256 matches a row with `status='ready'`
is short-circuited and returns the existing `document_id`.

---

### 3.3 `kb_chunks` ← **embeddings live here**

One row per text chunk. The `embedding` column is the pgvector value
that powers similarity search.

| Column         | Type             | Notes                                                              |
| -------------- | ---------------- | ------------------------------------------------------------------ |
| `id`           | UUID PK          | `gen_random_uuid()`                                                |
| `document_id`  | UUID FK          | → `kb_documents(id)` `ON DELETE CASCADE`                           |
| `chunk_index`  | INT NOT NULL     | 0-based; UNIQUE per `(document_id, chunk_index)`                   |
| `text`         | TEXT NOT NULL    | The chunk text itself                                              |
| `token_count`  | INT NOT NULL     | Approx tokens (≈ `Math.ceil(len/4)`)                                |
| `char_start`   | INT              | Offset in source text                                              |
| `char_end`     | INT              | Offset in source text                                              |
| `heading_path` | TEXT             | Most-recent markdown heading path, e.g. `Chapter 1 › Pricing`       |
| `metadata`     | JSONB            | Reserved for future per-chunk metadata                             |
| `embedding`    | **`vector(768)`** | Cosine-normalized embedding, NOT NULL                             |
| `created_at`   | TIMESTAMPTZ      |                                                                   |

Constraints / indexes:

- `kb_chunks_doc_chunk_uq` — `UNIQUE(document_id, chunk_index)`
- `kb_chunks_doc_idx` — `(document_id, chunk_index)`
- **HNSW index** on `embedding` using `vector_cosine_ops`. The migration
  tries HNSW first (pgvector ≥ 0.5) and **falls back to ivfflat with
  `lists=100`** if HNSW is unavailable.

How embeddings are persisted: the Node service formats each
`number[768]` as a pgvector string literal `[0.123,0.456,...]` (six
decimal places) and inserts with an explicit `$N::vector` cast. No
special pg type registration needed.

---

### 3.4 `kb_search_logs`

Audit trail of every KB similarity search (admin tester + voice agent).

| Column          | Type                  | Notes                                          |
| --------------- | --------------------- | ---------------------------------------------- |
| `id`            | UUID PK               |                                                |
| `call_id`       | UUID NULL             | Links to call-agent `calls.id` when available  |
| `agent_id`      | UUID FK               | → `voice_agents(id)` `ON DELETE SET NULL`      |
| `query`         | TEXT NOT NULL         | The user/admin search string                   |
| `top_chunk_ids` | UUID[]                | The chunk IDs that ranked top-k                |
| `top_scores`    | DOUBLE PRECISION[]    | Cosine similarity scores (1 − cosine_distance) |
| `latency_ms`    | INT                   | Embedding + DB scan time                       |
| `source`        | TEXT                  | e.g. `admin_test`, `voice_agent`               |
| `created_at`    | TIMESTAMPTZ           |                                                |

Indexes: `kb_search_logs_call_idx`, `kb_search_logs_agent_idx`,
`kb_search_logs_created_idx (DESC)`.

---

### 3.5 `voice_debug_events`

Persisted dataflow events surfaced from the **Debug Logs** UI tab.

| Column        | Type           | Notes                                                         |
| ------------- | -------------- | ------------------------------------------------------------- |
| `id`          | UUID PK        |                                                               |
| `trace_id`    | TEXT           | UUID v4 generated per search                                   |
| `agent_id`    | UUID NULL      |                                                               |
| `document_id` | UUID NULL      |                                                               |
| `event_type`  | TEXT NOT NULL  | see list below                                                 |
| `event_stage` | TEXT           | `upload` \| `gcs_upload` \| `ingest` \| `extract` \| `chunk` \| `embed` \| `persist` \| `finalize` \| `search` \| `ready` |
| `message`     | TEXT NOT NULL  | Human-readable                                                 |
| `payload`     | JSONB          | Structured details (no secrets, no full text)                  |
| `created_at`  | TIMESTAMPTZ    |                                                               |

Event types: `upload_started`, `gcs_uploaded`, `gcs_failed`,
`ingest_started`, `text_extracted`, `chunks_created`,
`embeddings_created`, `document_ready`, `document_failed`,
`search_started`, `search_completed`.

Indexes: `voice_debug_events_trace_idx`, `voice_debug_events_type_idx`,
`voice_debug_events_created_idx (DESC)`.

### 3.6 `voice_call_enrichments`

Optional one-row-per-call overlay used by the admin **Analytics** and
**Call History** pages. The dashboard already reads existing call-agent
tables and derives duration, latency, transfer events, outcome, and
hangup reason where possible. The user-side call service should upsert
this table when it has exact values.

| Column                  | Type          | Notes                                                               |
| ----------------------- | ------------- | ------------------------------------------------------------------- |
| `call_id`               | UUID PK       | FK → `calls(id)` `ON DELETE CASCADE`                                |
| `agent_id`              | UUID          | Optional FK → `voice_agents(id)`                                    |
| `agent_name`            | TEXT          | UI fallback if no `agent_id`                                        |
| `agent_version`         | TEXT          | Version shown in the detail drawer                                  |
| `channel_type`          | TEXT          | e.g. `phone_call`, `web_call`                                       |
| `session_outcome`       | TEXT          | `successful` \| `unsuccessful` \| `unknown`                         |
| `end_reason`            | TEXT          | e.g. `user_hangup`, `agent_hangup`, `silence_timeout`               |
| `end_to_end_latency_ms` | INT           | Exact call latency metric                                           |
| `average_latency_ms`    | INT           | Optional average response latency                                   |
| `llm_token_count`       | INT           | Token count shown in call detail                                    |
| `cost_usd`              | NUMERIC(12,6) | Exact call/session cost                                             |
| `preferred_language`    | TEXT          | Custom attribute shown as `preferred_language`                      |
| `successful`            | BOOLEAN       | Exact boolean override for success charts                           |
| `picked_up`             | BOOLEAN       | Exact boolean override for pickup rate                              |
| `transfer_requested`    | BOOLEAN       | Exact boolean override for transfer rate                            |
| `voicemail`             | BOOLEAN       | Exact boolean override for voicemail rate                           |
| `recording_url`         | TEXT          | Public/signed playback URL if available                             |
| `recording_gcs_uri`     | TEXT          | GCS recording URI fallback                                          |
| `custom_attributes`     | JSONB         | Any custom analysis fields                                          |
| `analysis`              | JSONB         | Extra analysis, e.g. `{"user_sentiment":"neutral"}`                 |

Recommended user-side write:

```sql
INSERT INTO voice_call_enrichments (
  call_id, agent_name, channel_type, session_outcome, end_reason,
  end_to_end_latency_ms, cost_usd, preferred_language,
  successful, picked_up, transfer_requested, recording_gcs_uri,
  custom_attributes, analysis
)
VALUES (
  $1, $2, $3, $4, $5,
  $6, $7, $8,
  $9, $10, $11, $12,
  $13::jsonb, $14::jsonb
)
ON CONFLICT (call_id) DO UPDATE SET
  agent_name = EXCLUDED.agent_name,
  channel_type = EXCLUDED.channel_type,
  session_outcome = EXCLUDED.session_outcome,
  end_reason = EXCLUDED.end_reason,
  end_to_end_latency_ms = EXCLUDED.end_to_end_latency_ms,
  cost_usd = EXCLUDED.cost_usd,
  preferred_language = EXCLUDED.preferred_language,
  successful = EXCLUDED.successful,
  picked_up = EXCLUDED.picked_up,
  transfer_requested = EXCLUDED.transfer_requested,
  recording_gcs_uri = EXCLUDED.recording_gcs_uri,
  custom_attributes = EXCLUDED.custom_attributes,
  analysis = EXCLUDED.analysis,
  updated_at = now();
```

---

## 4. Embeddings

| Item                          | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Provider                      | Google GenAI (`@google/genai` Node SDK)                            |
| **Production model**          | **`gemini-embedding-001`** (set in `Backend/.env` `EMBEDDING_MODEL`) |
| Originally specified model    | `text-embedding-004` (used as code default if env unset and key has access) |
| Output dimensionality         | **768** (matryoshka-truncated)                                     |
| Distance metric               | Cosine                                                             |
| Document task type            | `RETRIEVAL_DOCUMENT` (when indexing chunks)                        |
| Query task type               | `RETRIEVAL_QUERY` (when searching)                                 |
| Batch size                    | 100 chunks per `embedContent` call                                 |
| Module                        | `Backend/modules/jurinex-voice/kb/embeddings.js`                   |

> **Why `gemini-embedding-001`?** The current GOOGLE_API_KEY in `.env`
> does not have access to `text-embedding-004` on the v1beta endpoint
> (returns 404). `gemini-embedding-001` is the GA replacement, supports
> the same `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY` task types, and
> can be matryoshka-truncated to 768 dims to match our pgvector schema.

### 4.1 Embedding API contract

```js
// Indexing (per chunk batch)
await client.models.embedContent({
  model: 'gemini-embedding-001',
  contents: chunkTexts,                      // string[] of up to 100
  config: {
    taskType: 'RETRIEVAL_DOCUMENT',
    outputDimensionality: 768,
  },
});

// Search (single query)
await client.models.embedContent({
  model: 'gemini-embedding-001',
  contents: [queryString],
  config: {
    taskType: 'RETRIEVAL_QUERY',
    outputDimensionality: 768,
  },
});
```

The result `r.embeddings[i].values` is a `number[768]`, formatted as
`[v0,v1,...,v767]` and inserted into `kb_chunks.embedding` with an
explicit `$N::vector` cast.

### 4.2 Similarity search SQL

```sql
SELECT
  c.id,
  c.text,
  c.heading_path,
  c.document_id,
  c.chunk_index,
  d.title       AS document_title,
  d.gcs_uri,
  d.source_type,
  d.agent_id,
  1 - (c.embedding <=> $1::vector) AS score        -- cosine similarity
FROM kb_chunks c
JOIN kb_documents d ON d.id = c.document_id
WHERE d.status = 'ready'
  AND ($2::uuid IS NULL OR d.agent_id = $2::uuid OR d.agent_id IS NULL)
ORDER BY c.embedding <=> $1::vector              -- cosine distance asc
LIMIT $3;
```

The `<=>` operator is pgvector's cosine distance. `1 - distance` gives
similarity in `[-1, 1]`. The HNSW (or ivfflat) index makes this scan
sub-linear.

---

## 5. Chunking

| Item                       | Value                                            | Source                     |
| -------------------------- | ------------------------------------------------ | -------------------------- |
| Target chunk size          | **500 tokens** (default)                         | `KB_CHUNK_TOKENS`          |
| Overlap between chunks     | **50 tokens** (default)                          | `KB_CHUNK_OVERLAP`         |
| Token approximation        | `Math.ceil(text.length / 4)` — char-based heuristic; no tokenizer dependency | `kb/chunking.js` `approxTokens()` |
| Module                     | `Backend/modules/jurinex-voice/kb/chunking.js`   |                            |

### 5.1 Algorithm (high-level)

1. **Split paragraphs.** The text (with `\r\n` normalized to `\n`) is
   walked line-by-line:
   - Markdown heading lines (`^#{1,6}\s+...$`) update an internal
     **heading stack** so each subsequent paragraph carries a
     `heading_path` like `Pricing › Annual plan`.
   - Blank lines flush the current paragraph buffer.
   - Other lines are concatenated into the current paragraph.
   Each emitted paragraph carries `{ text, char_start, char_end,
   heading_path }`.

2. **Pack paragraphs into chunks** of ≤ `KB_CHUNK_TOKENS`:
   - If a paragraph fits in the remaining budget → append.
   - If a paragraph would overflow → flush the current chunk first.
   - **If the paragraph itself is bigger than the budget** → fall
     back to **sentence splitting** (regex `(?<=[.!?])\s+(?=[A-Z0-9"…])`).
   - **If a single sentence is still bigger than the budget** → hard
     character-stride split (`stride = chunkTokens * 4` chars).

3. **Overlap.** When a chunk is flushed, the last `overlap * 4` chars
   are carried over into the next chunk's buffer. This produces
   ~50-token overlaps at the boundary so embeddings keep continuity.

4. **Output.** Each chunk produces:

   ```js
   {
     chunk_index:  number,   // 0-based, monotonically increasing
     text:         string,   // the chunk content (trimmed)
     token_count:  number,   // approxTokens(text)
     char_start:   number,   // offset into source text
     char_end:     number,   // offset into source text
     heading_path: string,   // most-recent heading stack
     metadata:     null,     // reserved
   }
   ```

The chunk's embedding (`number[768]`) is computed in **5.2** below and
stitched into the same row at insert time.

### 5.2 Why this approach

- **Paragraph-first** preserves semantic boundaries.
- **Sentence fallback** handles long monolithic blocks without
  wrecking grammar.
- **Hard-stride last** guarantees the algorithm always terminates
  even on pathological input.
- **Heading-path tracking** is what lets search results render
  meaningful citations like *"Chapter 3 › Refunds"*.
- **Char offsets** make it possible to highlight or re-render the
  source span later.

---

## 6. End-to-end pipeline (`POST /admin/jurinex-voice/kb/upload`)

```
                                          ┌──────────────────────────┐
multipart upload (PDF/DOCX/TXT/MD)        │ Backend / Express        │
        │                                 │                          │
        ▼                                 │                          │
1. Multer (memoryStorage)  ─── buffer ───►│                          │
2. sha256(buffer)                         │ kb.controller.js         │
3. INSERT kb_documents (status=processing)│                          │
4. uploadFileToGcs() ─────────────────────┼──► GCS jurinex-voice-docs │
5. UPDATE kb_documents (gcs_*)            │                          │
6. respond 202                            │                          │
                                          │                          │
   setImmediate(processDocument(id))      │ kbIngest.service.js      │
        │                                 │                          │
        ▼                                 │                          │
7. downloadFileFromGcs() ◄────────────────┼─── GCS                    │
8. extractText(buffer)  ──── pdf-parse v2 │                          │
   • PDF  → new PDFParse({data}).getText()│                          │
   • DOCX → mammoth.extractRawText        │                          │
   • TXT/MD → utf-8 decode                │                          │
9. chunkText(rawText)  → 500-token chunks │                          │
10. embedDocuments(chunkTexts)            │                          │
    → gemini-embedding-001                │                          │
    → 768 dims, RETRIEVAL_DOCUMENT        │                          │
11. INSERT kb_chunks (vector(768)) batches │                          │
12. UPDATE kb_documents                    │                          │
    SET status='ready', chunk_count=...,  │                          │
        token_count=..., raw_text=...     │                          │
                                          └──────────────────────────┘
```

At every stage, an event is **also** persisted to `voice_debug_events`
with a structured payload (see §3.5) and an ASCII-boxed console line.

On any failure: `kb_documents.status='failed'`,
`error_message='[stage] ...'`, debug event `document_failed`. The
server keeps running.

---

## 7. End-to-end pipeline (`POST /admin/jurinex-voice/kb/search`)

1. `kbSearch.service.js` generates a `trace_id` (uuid).
2. Insert `voice_debug_events: search_started`.
3. `embedQuery(query)` → `gemini-embedding-001` with
   `RETRIEVAL_QUERY`, 768 dims.
4. Run the SQL in §4.2 with parameters `(literal, agent_id, k)`.
5. Insert `kb_search_logs` with the top-k chunk ids, scores, latency.
6. Insert `voice_debug_events: search_completed`.
7. Respond `{ trace_id, latency_ms, results: [{ chunk_id, document_id,
   document_title, heading_path, text, score, gcs_uri, source_type,
   agent_id }, ...] }`.

---

## 8. Environment variables (recap)

```
# Database
JURINEX_VOICE_DATABASE_URL=postgresql://db_user:Nexintelai_43@35.200.202.69:5432/Calling_agent_DB

# GCS
GCS_VOICE_BUCKET=jurinex-voice-docs
GCP_PROJECT_ID=nexintel-ai-summarizer
GCS_KEY_BASE64=<base64 service-account JSON>           # already configured

# Embeddings
GOOGLE_API_KEY=<gemini api key>                         # falls back to GEMINI_API_KEY
EMBEDDING_MODEL=gemini-embedding-001                    # 768-dim matryoshka
EMBEDDING_DIM=768

# Chunking
KB_CHUNK_TOKENS=500
KB_CHUNK_OVERLAP=50

# Auth
ADMIN_API_KEY=<long random string>                      # X-Admin-API-Key header
```

---

## 9. File / data inventory at-a-glance

| Data piece                  | Where it lives                                   |
| --------------------------- | ------------------------------------------------ |
| Original PDF/DOCX/TXT/MD    | GCS `jurinex-voice-docs` (path in `kb_documents.gcs_uri`) |
| Document metadata           | `kb_documents`                                    |
| Cached extracted plain text | `kb_documents.raw_text` (truncated to 200 KB)     |
| Chunks (text + offsets)     | `kb_chunks.text`, `char_start`, `char_end`, `heading_path` |
| **Embeddings (768-dim)**    | **`kb_chunks.embedding` `vector(768)`**           |
| Vector index                | `kb_chunks_embedding_hnsw` (or ivfflat fallback) — cosine ops |
| Voice agents catalog        | `voice_agents`                                    |
| Search history              | `kb_search_logs`                                  |
| Pipeline / debug events     | `voice_debug_events`                              |
| Console dataflow boxes      | stdout (winston + ASCII drawer)                   |

---

## 10. Quick verification

```sql
-- agents
SELECT id, name, display_name, status FROM voice_agents;

-- documents
SELECT id, title, status, chunk_count, gcs_uri
  FROM kb_documents ORDER BY created_at DESC LIMIT 10;

-- spot-check an embedding row
SELECT id, document_id, chunk_index, token_count,
       array_length(embedding::real[], 1) AS dim       -- should be 768
  FROM kb_chunks LIMIT 1;

-- vector index
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE tablename = 'kb_chunks';

-- recent search logs
SELECT created_at, agent_id, query, latency_ms, array_length(top_chunk_ids,1) AS k
  FROM kb_search_logs ORDER BY created_at DESC LIMIT 10;
```

---

## 11. Existing call-agent tables (read-only from this module)

The following tables belong to `jurinex_call_agent` and **must not be
modified** by this module: `customers`, `calls`, `call_messages`,
`support_tickets`, `escalations`, `agent_tool_events`,
`call_debug_events`. The voice service is free to *read* the new KB
tables to answer customers at runtime.
