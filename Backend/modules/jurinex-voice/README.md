# Jurinex Voice — admin module

Self-contained Node.js / Express module that lets admins:

- Manage **voice agents** (e.g. `preeti` — Jurinex customer support bot).
- Upload **knowledge-base documents** (PDF / DOCX / TXT / MD) — the
  original file is stored in GCS, the extracted text, chunks, and
  pgvector embeddings live in PostgreSQL.
- Run KB **similarity searches** (Google `text-embedding-004`, 768-dim,
  cosine over pgvector).
- Inspect **debug events** for the upload / ingest / search pipeline.

The voice call agent (`jurinex_call_agent`) reads the same KB tables at
runtime to answer customers — this module is the **writer** side.

## Layout

```
modules/jurinex-voice/
  index.js                 → exports router factory
  jurinexVoice.routes.js   → all /admin/jurinex-voice/* routes
  middleware/
    adminApiKey.middleware.js
  agents/
    voiceAgent.repository.js
    voiceAgent.controller.js
  kb/
    kb.repository.js
    kb.controller.js
    kbIngest.service.js
    kbSearch.service.js
    textExtraction.js
    chunking.js
    embeddings.js
  gcs/
    gcsStorage.service.js
  observability/
    voiceLogger.js
    dataflowLogger.js
  db/
    jurinexVoiceDB.js      → dedicated pg pool
    migrate.js             → runs migrations/001_jurinex_voice_init.sql
  migrations/
    001_jurinex_voice_init.sql
```

## Endpoints

All routes are gated by either `X-Admin-API-Key` (matching
`process.env.ADMIN_API_KEY`) **or** the existing `Authorization: Bearer
<JWT|ADMIN_TOKEN>` used by the rest of the dashboard.

Mounted at both:

- `/admin/jurinex-voice/*`
- `/api/admin/jurinex-voice/*`   ← used by the React app

```
GET    /agents
POST   /agents
GET    /agents/:agentId
PATCH  /agents/:agentId
DELETE /agents/:agentId            (soft-delete: status='inactive')

POST   /kb/upload                  multipart: file, agent_id?, title?, language?, tags?
POST   /kb/upload-text             json:      title, text, agent_id?, language?, tags?
GET    /kb/documents               ?agent_id&status&source_type&limit&offset
GET    /kb/documents/:documentId   returns sample_chunks (first 5)
DELETE /kb/documents/:documentId   removes chunks + GCS object
POST   /kb/documents/:documentId/reindex

POST   /kb/search                  body: { query, k=5, agent_id?, source? }
GET    /kb/search-logs

GET    /debug/events               ?event_type&document_id&agent_id&limit
GET    /health                     (no auth)
```

## Tables created

`voice_agents`, `kb_documents`, `kb_chunks`, `kb_search_logs`,
`voice_debug_events` — see `migrations/001_jurinex_voice_init.sql`.

Existing call-agent tables (`customers`, `calls`, `call_messages`,
`support_tickets`, `escalations`, `agent_tool_events`,
`call_debug_events`) are **not** modified.

## Run

```bash
# 1. install new dependencies (mammoth was added)
cd Backend && npm install

# 2. run the migration (creates pgvector extension + tables, seeds 'preeti')
npm run migrate:jurinex-voice

# 3. start the backend as usual
npm run dev
```

## Required env vars

```
JURINEX_VOICE_DATABASE_URL   = postgresql://db_user:...@host:5432/Calling_agent_DB
GCS_VOICE_BUCKET             = jurinex-voice-docs
GCP_PROJECT_ID               = nexintel-ai-summarizer
GCS_KEY_BASE64               = <base64 service-account JSON> (existing)
GOOGLE_API_KEY               = <Gemini API key>     (or GEMINI_API_KEY)
EMBEDDING_MODEL              = text-embedding-004
EMBEDDING_DIM                = 768
KB_CHUNK_TOKENS              = 500
KB_CHUNK_OVERLAP             = 50
ADMIN_API_KEY                = <long random string>
```

## Test from curl

```bash
KEY=$ADMIN_API_KEY

# List agents
curl -s -H "X-Admin-API-Key: $KEY" \
  http://localhost:4000/admin/jurinex-voice/agents

# Upload a PDF
curl -s -X POST -H "X-Admin-API-Key: $KEY" \
  -F "file=@./jurinex-faq.pdf" \
  -F "title=Jurinex FAQ" \
  -F "language=en" \
  -F "tags=faq,support" \
  http://localhost:4000/admin/jurinex-voice/kb/upload

# Search
curl -s -X POST -H "X-Admin-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"query":"What documents are needed for consultation?","k":5}' \
  http://localhost:4000/admin/jurinex-voice/kb/search
```

## Dataflow logs

The pipeline emits ASCII-boxed console logs at every major stage, e.g.

```
╭────────────────────────────────────────────╮
│ 🎙️  JURINEX VOICE DOCUMENT UPLOAD STARTED │
│ Document ID  7e7b…                         │
│ Agent ID     preeti                        │
│ Filename     jurinex-faq.pdf               │
│ Bucket       jurinex-voice-docs            │
╰────────────────────────────────────────────╯
```

Each event is also persisted to `voice_debug_events` and surfaced from
the **Debug Logs** tab of the Voice Management UI.
