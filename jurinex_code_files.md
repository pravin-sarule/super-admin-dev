# Jurinex Voice — Code File Inventory

A complete file-by-file map of every code asset behind the Jurinex
voice-agent admin platform. Use this as a hand-off bundle for any
engineer joining the project: it tells them **what each file does**,
**where it sits in the dependency graph**, and **why it exists**.

> **Counts at a glance**
>
> - **62** files inside `Backend/modules/jurinex-voice/` (45 JS, 16 SQL, 2 MD)
> - **26** files inside `Frontend/src/features/jurinex-voice/` (24 JSX/JS, 2 utility folders)
> - **2** integration touch-points outside the module (`Backend/server.js`, `Frontend/src/App.jsx`)

---

## Table of contents

1. [Architecture in one diagram](#1-architecture-in-one-diagram)
2. [Backend — module entry & routing](#2-backend--module-entry--routing)
3. [Backend — agents subsystem](#3-backend--agents-subsystem)
4. [Backend — knowledge base subsystem](#4-backend--knowledge-base-subsystem)
5. [Backend — tools (function-calling) subsystem](#5-backend--tools-function-calling-subsystem)
6. [Backend — calendar bookings subsystem](#6-backend--calendar-bookings-subsystem)
7. [Backend — outbound call scheduler](#7-backend--outbound-call-scheduler)
8. [Backend — post-call extraction](#8-backend--post-call-extraction)
9. [Backend — telephony / call analytics](#9-backend--telephony--call-analytics)
10. [Backend — voices & model pricing catalog](#10-backend--voices--model-pricing-catalog)
11. [Backend — live test WebSocket bridge](#11-backend--live-test-websocket-bridge)
12. [Backend — observability & logging](#12-backend--observability--logging)
13. [Backend — DB infrastructure & migrations](#13-backend--db-infrastructure--migrations)
14. [Backend — middleware & GCS](#14-backend--middleware--gcs)
15. [Backend — docs](#15-backend--docs)
16. [Backend — integration points outside the module](#16-backend--integration-points-outside-the-module)
17. [Frontend — page entry](#17-frontend--page-entry)
18. [Frontend — agent builder (Run Test panel + configuration)](#18-frontend--agent-builder-run-test-panel--configuration)
19. [Frontend — top-level voice management components](#19-frontend--top-level-voice-management-components)
20. [Frontend — API helper](#20-frontend--api-helper)
21. [Frontend — utilities](#21-frontend--utilities)
22. [Frontend — integration outside the feature folder](#22-frontend--integration-outside-the-feature-folder)
23. [How a single click flows through the codebase](#23-how-a-single-click-flows-through-the-codebase)

---

## 1. Architecture in one diagram

```
                  ┌──────────────────────────────────────────────┐
                  │  Frontend  (React + Vite)                    │
                  │  Frontend/src/features/jurinex-voice/        │
                  │    pages/VoiceManagementPage.jsx ── 8 tabs   │
                  │    components/*  + agent-builder/*           │
                  │    api/jurinexVoiceApi.js  (single REST hub) │
                  └──────────────────┬───────────────────────────┘
                                     │ fetch + WebSocket
                                     ▼
   ┌────────────────────────────────────────────────────────────────┐
   │  Backend  (Node + Express + ws)                                │
   │  Backend/modules/jurinex-voice/                                │
   │    index.js  →  jurinexVoice.routes.js  (REST router)          │
   │    tests/agentLiveTest.socket.js        (WS /live-test bridge) │
   │                                                                 │
   │  Domain folders:                                                │
   │    agents/         ── voice agent CRUD + configuration          │
   │    kb/             ── upload, chunk, embed, semantic search     │
   │    tools/          ── 6 functions Gemini Live can invoke        │
   │    calendar/       ── bookings list + slots view                │
   │    scheduler/      ── outbound call queue + CSV import          │
   │    postcall/       ── transcript → JSON extraction              │
   │    voices/         ── prebuilt-voice catalog + previews         │
   │    models/         ── live model pricing picker source          │
   │    calls/          ── analytics + history                       │
   │    observability/  ── voiceLogger + persistent dataflow log     │
   │    db/             ── pg pool + idempotent migration runner     │
   │    middleware/     ── admin API key + JWT auth                  │
   │    gcs/            ── Google Cloud Storage helpers              │
   │    migrations/     ── 15 idempotent .sql files                  │
   │    docs/           ── CALL_SCHEDULER.md handoff spec            │
   └──────────────────────────────────────────────────────┬─────────┘
                                                          │
                                                          ▼
                                ┌──────────────────────────────────────┐
                                │  Cloud SQL PostgreSQL                │
                                │  (Calling_agent_DB)  ── 15+ tables   │
                                │  pgvector for KB embeddings          │
                                └──────────────────────────────────────┘
```

---

## 2. Backend — module entry & routing

### `Backend/modules/jurinex-voice/index.js`
**Module entry point.** Exports the router-factory function consumed
by `Backend/server.js`. Two lines: requires `jurinexVoice.routes.js`
and re-exports it. Lets the server mount the whole module with one
call.

### `Backend/modules/jurinex-voice/jurinexVoice.routes.js`
**Master REST router.** Defines every HTTP endpoint under
`/admin/jurinex-voice/*` and `/api/admin/jurinex-voice/*`. Imports each
controller (agents, KB, calendar, scheduler, calls, voices, models,
tests) and binds them to URLs. Also configures the `multer` instance
used by every file-upload endpoint (KB documents, CSV scheduler
import). Auth middleware (`adminApiKey.middleware.js`) is attached
once and reused for every route.

---

## 3. Backend — agents subsystem

> Owns the lifecycle of a voice agent: create, list, configure, edit,
> soft-delete. Anything an admin sees as "an agent" comes from here.

### `Backend/modules/jurinex-voice/agents/voiceAgent.repository.js`
**SQL data layer for `voice_agents`.** Provides `create`, `list`,
`getById`, `getByName`, `update`, `softDelete`. Owns column shape
`{id, name, display_name, description, status, language_config,
system_prompt, created_*}`. Used by the controller plus the live
test socket (which calls `getById` to fetch agent metadata for the
session).

### `Backend/modules/jurinex-voice/agents/voiceAgent.controller.js`
**HTTP handlers for agent CRUD.** `GET /agents`, `POST /agents`,
`GET/PATCH/DELETE /agents/:id`. Validates input, normalises name
slugs, returns shaped responses. Pairs with the repository.

### `Backend/modules/jurinex-voice/agents/voiceAgentConfig.repository.js`
**SQL data layer for `voice_agent_configurations` +
`voice_agent_transfer_configs`.** Owns the 1:1 config rows attached
to every agent: live model, voice name, system prompts, custom
settings JSONB, transfer destination. Auto-creates default rows on
first read so the admin UI never sees nulls. Critical for the live
test socket — every session start calls `agentConfigRepo.get(agentId)`
to load runtime config.

### `Backend/modules/jurinex-voice/agents/voiceAgentConfig.controller.js`
**HTTP handlers for the agent builder save flow.** `GET
/agents/:id/configuration` returns the full builder snapshot
(`{config, transfer_call, agent}`). `PUT /agents/:id/configuration`
accepts the entire builder state from the UI and writes it across
both tables in one request. Plus the test-turn endpoints (`/test-turn`,
`/test-audio-turn`, `/test-audio-turn-stream`) for legacy non-live
audio testing.

---

## 4. Backend — knowledge base subsystem

> Anything related to PDF/DOCX/TXT/MD upload, chunking, embedding,
> and semantic search. The "What is Jurinex?" answers live here.

### `Backend/modules/jurinex-voice/kb/textExtraction.js`
**Decode whatever file the admin uploaded into plain text.** Branches
on MIME type: `pdf-parse` for PDFs, `mammoth` for DOCX, plain UTF-8
for TXT/MD. Returns `{text, charCount, sourceType}`. Pure function,
no DB.

### `Backend/modules/jurinex-voice/kb/chunking.js`
**Split extracted text into ~500-token chunks with 50-token overlap.**
Heading-aware (preserves H1/H2/H3 paths in `heading_path`) so search
results can quote section names. Tunable via env `KB_CHUNK_TOKENS`
and `KB_CHUNK_OVERLAP`.

### `Backend/modules/jurinex-voice/kb/embeddings.js`
**Wraps the Gemini embedding API.** `embedDocuments(texts)` for
ingest (`task_type: 'RETRIEVAL_DOCUMENT'`) and `embedQuery(text)` for
search (`task_type: 'RETRIEVAL_QUERY'`). Both use 768-d vectors.
`toVectorLiteral(vec)` converts a JS array into the `[0.1,0.2,...]`
literal that pgvector expects.

### `Backend/modules/jurinex-voice/kb/kb.repository.js`
**SQL data layer for `kb_documents`, `kb_chunks`, `kb_search_logs`,
`voice_debug_events`.** Insert/update document metadata, batch-insert
chunks with embeddings, run cosine similarity search via the
`embedding <=> $1::vector` operator, and write search-audit rows.
Used by both the ingest pipeline and the live `search_knowledge_base`
tool.

### `Backend/modules/jurinex-voice/kb/kbIngest.service.js`
**End-to-end ingest pipeline.** Orchestrates: GCS upload → text
extraction → chunking → embedding → DB insert → status flip from
`processing` → `ready`. Emits dataflow events at every stage. Catches
errors and parks the document in `status='failed'` with
`error_message` populated.

### `Backend/modules/jurinex-voice/kb/kbSearch.service.js`
**Embedding-backed semantic search service.** Takes a `{query, k,
agent_id}`, embeds the query, runs cosine search, writes a
`kb_search_logs` row, returns ranked results with scores. Used by
the `search_knowledge_base` tool and by the admin "Test Search" tab.

### `Backend/modules/jurinex-voice/kb/kb.controller.js`
**HTTP handlers for the KB.** `POST /kb/upload` (multipart),
`POST /kb/upload-text`, `GET /kb/documents`, `DELETE /kb/documents/:id`,
`POST /kb/documents/:id/reindex`, `POST /kb/search`, `GET /kb/search-logs`,
`GET/POST /debug/events`. Plus per-document fetch with sample chunks
for the admin Documents tab.

---

## 5. Backend — tools (function-calling) subsystem

> Six functions Gemini Live is allowed to call mid-conversation.
> Each is a pure handler with `{name, run(args, context)}`. The
> dispatcher routes incoming `toolCall` frames to the right one.

### `Backend/modules/jurinex-voice/tools/declarations.js`
**Function-declaration list passed to Gemini Live.** Six entries:
`end_call`, `transfer_call`, `agent_transfer`, `calendar_check`,
`calendar_book`, `search_knowledge_base`. Each has a `description`
and JSON Schema `parameters`. `getDeclarationsForAgent(enabledKeys)`
filters down to whatever the agent has enabled in the builder.

### `Backend/modules/jurinex-voice/tools/dispatcher.js`
**Single entry point used by the live socket.** `execute({name, args,
sessionId, agentId, ...})` finds the matching tool handler, writes a
`pending` row to `voice_tool_executions`, runs the handler, captures
output + latency, UPDATEs the row to `completed`/`tool_returned_error`/
`exception`, draws Rich-style boxed console panels, and returns the
result for the caller to wrap in a `toolResponse.functionResponses`
envelope.

### `Backend/modules/jurinex-voice/tools/toolPrompts.repository.js`
**60-second cached read of `voice_tool_system_prompts`.** Renders
Mustache `{{placeholders}}` against runtime variables. Returns the
concatenated tool guidance block that goes into the system instruction.

### `Backend/modules/jurinex-voice/tools/systemPromptFragments.repository.js`
**60-second cached read of `voice_system_prompt_fragments`.** Same
shape as `toolPrompts.repository.js` but for non-tool fragments
(`live_session_base`, `live_session_realtime_rules`,
`knowledge_base_header`, `welcome_turn_template`, etc.).

### `Backend/modules/jurinex-voice/tools/endCall.tool.js`
**`end_call` handler.** Triggers the Live session teardown via the
`endSession` callback the live socket passes in. Returns
`{status: 'ending_call', reason, detail}`.

### `Backend/modules/jurinex-voice/tools/transferCall.tool.js`
**`transfer_call` handler.** Reads destination from
`voice_agent_transfer_configs.static_destination`. In the test
panel: simulates the announcement and ends the session. In
production telephony: calls `context.bridgeTwilioCall` if provided,
which updates the active TwiML to `<Dial>` the destination.

### `Backend/modules/jurinex-voice/tools/agentTransfer.tool.js`
**`agent_transfer` handler.** Looks up the target agent by id or
display name, ends the current session, signals the runtime to
resume the call with the new agent's configuration. Test panel
simulates only.

### `Backend/modules/jurinex-voice/tools/calendarCheck.tool.js`
**`calendar_check` handler.** Reads agent's calendar tool_settings
(working hours, blocked dates, view-only flag), runs Google Calendar
`freeBusy.query`, applies `workingHours.computeFreeWindows()` to
filter to allowed slots only, returns ranked free slots.

### `Backend/modules/jurinex-voice/tools/calendarBook.tool.js`
**`calendar_book` handler.** Validates the requested slot via
`workingHours.validateBookingTarget()` (rejects view-only mode,
blocked dates, disabled days, outside-hours requests), creates the
Google Calendar event, persists a `voice_calendar_bookings` row,
fires the `bookingNotifier` for confirmation email + .ics, returns
`{booked: true, event_id, html_link, confirmation_email}`.

### `Backend/modules/jurinex-voice/tools/searchKnowledgeBase.tool.js`
**`search_knowledge_base` handler.** Wraps `kbSearch.service.search()`.
Applies a confidence floor (`JURINEX_VOICE_KB_MIN_SCORE`, default
0.55). Returns top-K snippets with `confident: true/false` so the
model knows when to admit it doesn't have an answer.

### `Backend/modules/jurinex-voice/tools/workingHours.js`
**Timezone-aware policy helper.** Three exports:
- `buildAllowedWindows()` — yields per-day working windows in a
  date range, skipping disabled days and blocked dates.
- `computeFreeWindows()` — subtracts Google's busy[] and filters by
  slot length.
- `validateBookingTarget()` — returns `null` if a slot is allowed,
  or `{code, detail}` for `view_only_mode` / `date_blocked` /
  `day_disabled` / `outside_working_hours` / `invalid_range`.

Used by both `calendar_check` and `calendar_book`.

### `Backend/modules/jurinex-voice/tools/googleCalendar.client.js`
**Google Calendar v3 REST client.** Auths via service-account JWT
(reads `JURINEX_VOICE_CALENDAR_SA_JSON_BASE64` or
`GOOGLE_APPLICATION_CREDENTIALS`). Two methods: `queryFreeBusy()`
and `createEvent()`. The `createEvent` path conditionally drops the
`attendees` field unless `JURINEX_VOICE_CALENDAR_ALLOW_ATTENDEES=true`
(because plain SA without DWD gets HTTP 403 when inviting attendees).

### `Backend/modules/jurinex-voice/tools/bookingNotifier.js`
**Confirmation email + .ics generator.** Builds a valid RFC 5545
calendar attachment, renders HTML + plain-text body, sends via
nodemailer using the project's existing SMTP env
(`EMAIL_HOST`/`USER`/`PASS`/`FROM`). Fire-and-forget: failures are
logged but never raise into the booking flow. Triggered after
`calendarBook.tool.js` confirms the Google event.

---

## 6. Backend — calendar bookings subsystem

### `Backend/modules/jurinex-voice/calendar/calendarBookings.controller.js`
**Read-only HTTP handlers powering the Calendar tab.** Two endpoints:
- `GET /calendar/bookings` — list rows from `voice_calendar_bookings`
  joined to `voice_agents`, paged, filterable by agent + date range.
- `GET /calendar/slots?agent_id=&from=&to=` — for a single agent,
  computes the per-day grid: working windows, existing bookings,
  empty slots. Reuses `workingHours.buildAllowedWindows` and
  `computeFreeWindows` so the empty-slot logic exactly matches what
  the agent enforces at runtime.

---

## 7. Backend — outbound call scheduler

### `Backend/modules/jurinex-voice/scheduler/callScheduler.controller.js`
**HTTP handlers for the Call Scheduler tab.** Five endpoints:
- `GET /scheduler/calls` — paged list with agent + status filters.
- `POST /scheduler/calls` — create a single scheduled call.
- `PATCH /scheduler/calls/:id` — partial update (allowed fields:
  recipient_*, scheduled_at, timezone, notes, max_attempts, metadata,
  status).
- `DELETE /scheduler/calls/:id` — soft-cancel
  (only if `status IN ('pending','queued')`).
- `POST /scheduler/calls/bulk-import` — multipart CSV. Runs an
  inline quote-aware CSV parser, normalises phones to E.164,
  validates emails, inserts in a transaction with a shared
  `batch_id`, returns `{inserted, skipped}`.

The voice-agent runtime polls this table directly via SQL — it does
NOT call these REST endpoints.

---

## 8. Backend — post-call extraction

### `Backend/modules/jurinex-voice/postcall/postCallExtractor.js`
**Runs Gemini text extraction after every Live session.**
`runExtraction({sessionId, agentId, transcriptTurns, fieldList,
model})`:
1. Builds a JSON Schema from the admin's
   `post_call_extraction[]` field config (text → string, boolean →
   boolean, enum → string with `.enum`, number → number).
2. Concatenates the turn-by-turn transcript.
3. Calls `ai.models.generateContent` with `responseMimeType:
   'application/json'` and the derived schema.
4. Persists `voice_post_call_extractions` (status `running` → `completed`
   / `failed` / `skipped`). Snapshots the field list on the row so
   editing the agent later doesn't break old data.
5. Returns the structured output.

Fire-and-forget — failures never throw into the live socket teardown.

---

## 9. Backend — telephony / call analytics

### `Backend/modules/jurinex-voice/calls/voiceCall.repository.js`
**SQL data layer for the existing `calls` table** (real Twilio
calls, populated by the call-agent runtime). Queries: list with
filters (start_date, end_date, agent_id, direction, status), single
call by id with related transcripts/tool events, and rolled-up
analytics aggregates.

### `Backend/modules/jurinex-voice/calls/voiceCall.controller.js`
**HTTP handlers for the Analytics + Call History tabs.** Three
endpoints: `GET /calls/analytics`, `GET /calls/history`, `GET
/calls/:callId`. Read-only — admin app never modifies real call
data.

---

## 10. Backend — voices & model pricing catalog

### `Backend/modules/jurinex-voice/voices/platformVoice.repository.js`
**SQL data layer for `platform_voices` + `platform_voice_preview_audios`.**
Returns the catalog of Gemini prebuilt voices (Aoede, Kore, Leda,
Puck, Zephyr, etc.) with metadata (style, gender, accent,
language_codes) and links to admin-recorded preview WAV clips.

### `Backend/modules/jurinex-voice/voices/platformVoicePreview.service.js`
**Generates and caches voice preview audio.** When an admin clicks
"Preview" on a voice, this service uses a Gemini TTS model to
synthesize a short clip (default 12 seconds) speaking the configured
preview prompt, uploads to GCS, and writes a row to
`platform_voice_preview_audios`. Subsequent previews reuse the
cached clip.

### `Backend/modules/jurinex-voice/voices/platformVoice.controller.js`
**HTTP handlers for the voice picker.** `GET /platform-voices`
returns the catalog. `POST /platform-voices/:voiceKey/preview`
returns base64 audio (cached or freshly generated).

### `Backend/modules/jurinex-voice/models/modelPricing.repository.js`
**SQL data layer for `voice_model_pricing`.** The single source of
truth for which Gemini Live models the admin can pick. Returns
active rows ordered by `sort_order` with badges (Recommended /
Pinned / Alternative) and INR-per-minute pricing.

### `Backend/modules/jurinex-voice/models/modelPricing.controller.js`
**HTTP handler.** `GET /models/pricing`. Read-only.

---

## 11. Backend — live test WebSocket bridge

### `Backend/modules/jurinex-voice/tests/agentLiveTest.socket.js`
**THE master file. ~1500 lines.**

When the admin clicks **Run Test**, the browser opens a WebSocket
to `/admin/jurinex-voice/agents/:agentId/live-test`. This file
attaches the WS server, authenticates the admin (api-key or JWT),
and for each session:

1. Loads agent + config + transfer config from DB.
2. Resolves enabled function keys (auto-adds `search_knowledge_base`
   if KB docs are selected).
3. Pulls all DB-driven prompt fragments (`live_session_base`,
   `live_session_realtime_rules`, KB header, welcome template, +
   per-tool fragments) and renders Mustache placeholders with
   runtime variables.
4. Concatenates the system instruction in the documented order
   (persona → base → rules → KB block → tool block).
5. Opens a Gemini Live `bidiGenerateContent` WebSocket via
   `@google/genai` SDK.
6. Sends the welcome turn via `realtimeInput.text` (NOT
   `clientContent` — that's a documented 1008 trap).
7. Streams browser PCM (16 kHz mono LE) → Gemini, and Gemini's PCM
   (24 kHz mono LE) → browser, looping over every `modelTurn.parts[]`.
8. Handles `toolCall` frames by dispatching through
   `tools/dispatcher.js` and replying with `toolResponse`.
9. On WS 1011 ("Internal error occurred"), auto-resumes with the
   latest `sessionResumptionUpdate.newHandle` (max 3 attempts,
   gated by `audio_chunks_out > 0`).
10. Accumulates input/output transcript turns into a per-session
    array; on browser close, fires `postCallExtractor.runExtraction()`
    with the agent's configured fields.

Plus a Rich-style pipeline tracer that emits ASCII-boxed console
panels at every stage transition, persists each event to
`voice_debug_events` for replay, and ships a circular-safe stringifier
to keep a logging bug from ever crashing the Node process.

### `Backend/modules/jurinex-voice/tests/agentTest.service.js`
**Shared Gemini client + non-live audio paths.** Used by the live
socket for:
- `createClient(opts)` — single-place GoogleGenAI SDK construction
  with API-key fallback chain.
- `LANGUAGE_LABELS` and `normalizeLanguageCode()` — language
  resolution helpers.
- `buildSystemInstruction()` — minimal scaffolding when DB
  fragments are unavailable.

Also contains legacy non-live audio paths (`generateAgentReply`,
`generateFastAudioReply`, `transcribeUserAudio`) — kept for the
text-based test endpoints, not used by the Live flow.

### `Backend/modules/jurinex-voice/tests/agentTest.controller.js`
**HTTP handlers for non-live test endpoints.** `POST
/agents/:id/test-turn`, `/test-audio-turn`, `/test-audio-turn-stream`.
Mostly legacy — the Live WS in `agentLiveTest.socket.js` is the
modern path.

---

## 12. Backend — observability & logging

### `Backend/modules/jurinex-voice/observability/voiceLogger.js`
**Thin wrapper around the project's winston logger.** Forces
`layer: 'JURINEX_VOICE'` on every log message so the whole feature
is greppable across the shared log stream. Exposes `info / warn /
error / debug / flow / errorWithContext`.

### `Backend/modules/jurinex-voice/observability/dataflowLogger.js`
**Beginner-friendly ASCII-boxed dataflow logs + persistent event
sink.** Every important transition (upload started, GCS uploaded,
chunks created, embeddings done, KB search started/completed, tool
dispatch, live-pipeline stage) goes through `logVoiceEvent()` —
writes a Rich-style box to console AND inserts a row to
`voice_debug_events` for after-the-fact replay from the Debug Logs
tab.

---

## 13. Backend — DB infrastructure & migrations

### `Backend/modules/jurinex-voice/db/jurinexVoiceDB.js`
**Dedicated `pg.Pool` for the module.** Connects to
`JURINEX_VOICE_DATABASE_URL` (the shared Cloud SQL instance). On
boot, logs a banner with host:port/db so the engineer instantly
knows which DB they hit. Exported as a singleton pool used by every
repository.

### `Backend/modules/jurinex-voice/db/migrate.js`
**Idempotent migration runner.** `node migrate.js` reads every
`.sql` file under `migrations/` in filename order and runs them in a
single transaction. Each `.sql` is itself idempotent (`CREATE TABLE
IF NOT EXISTS`, `ON CONFLICT DO UPDATE`), so re-running on every
deploy is safe and re-seeds default rows. Prints a checklist of
expected tables at the end.

### `Backend/modules/jurinex-voice/migrations/*.sql`

| File | Adds |
|---|---|
| `001_jurinex_voice_init.sql` | `voice_agents`, `voice_agent_configurations`, `voice_agent_transfer_configs`, `kb_documents`, `kb_chunks`, `kb_search_logs`, `voice_debug_events`, pgvector extension; seeds `preeti` agent. |
| `002_platform_voices.sql` | `platform_voices` catalog + seed rows. |
| `003_platform_voice_preview_audios.sql` | `platform_voice_preview_audios` table for cached preview WAVs. |
| `004_voice_model_pricing.sql` | `voice_model_pricing` table + initial Gemini live + TTS rows. |
| `005_voice_model_native_audio.sql` | Adds `gemini-2.5-flash-native-audio-latest` and migrates Preeti onto it. |
| `006_voice_model_native_audio_variants.sql` | Adds 09-2025 + 12-2025 dated previews. |
| `007_voice_model_picker_only_three.sql` | Restricts picker to the three approved live models, deactivates `latest`. |
| `008_voice_model_real_pricing.sql` | Replaces placeholder pricing with real Google rates from the public pricing page. |
| `009_remove_tts_models.sql` | Removes standalone TTS rows from the picker. |
| `010_tool_execution.sql` | `voice_tool_executions` audit table + `voice_calendar_bookings` + `tool_settings` JSONB column on `voice_agent_configurations`. |
| `011_voice_tool_system_prompts.sql` | DB-driven per-tool prompt fragments — 6 seed rows (one per tool). |
| `012_voice_system_prompt_fragments.sql` | DB-driven non-tool fragments (live base, realtime rules, KB header, welcome template, fallback). |
| `013_post_call_extractions.sql` | `voice_post_call_extractions` table for analyst output. |
| `014_post_call_text_model.sql` | Adds `gemini-2.5-flash` as the default `post_call_text` model and backfills agent rows. |
| `015_voice_call_schedules.sql` | Outbound call scheduler table + indexes (the spec doc lives at `docs/CALL_SCHEDULER.md`). |

---

## 14. Backend — middleware & GCS

### `Backend/modules/jurinex-voice/middleware/adminApiKey.middleware.js`
**Hybrid auth middleware.** Accepts either:
- `X-Admin-API-Key: $ADMIN_API_KEY` header (machine-to-machine),
- or `Authorization: Bearer <jwt>` validating against `super_admins`
  table (admin UI session).

Attaches `req.user` for downstream handlers when JWT auth is used.
Pool reference is curried at router build time so this middleware
can hit the auth DB.

### `Backend/modules/jurinex-voice/gcs/gcsStorage.service.js`
**Google Cloud Storage helper.** `uploadBuffer(buffer, opts)`,
`deleteObject(uri)`, `getSignedUrl(uri)`. Reads service-account
credentials from `GCS_KEY_BASE64` (base64 JSON) or
`GOOGLE_APPLICATION_CREDENTIALS`. Used by KB ingest (original PDF
upload) and the voice-preview service (TTS WAV uploads).

---

## 15. Backend — docs

### `Backend/modules/jurinex-voice/README.md`
**Master integration spec for the call-agent engineer.** 11
sections: architecture, full DB schema, UI→DB mapping, prompt
assembly recipe, integration recipe, tool dispatch contract,
post-call lifecycle, models / voices / pricing, env vars, HTTP
endpoints, run instructions.

### `Backend/modules/jurinex-voice/docs/CALL_SCHEDULER.md`
**Sister doc dedicated to the outbound call scheduler.** 15
sections: state machine, polling pattern with `FOR UPDATE SKIP
LOCKED`, per-stage UPDATE recipes, retry policy, CSV import format,
worked example, analytics queries.

---

## 16. Backend — integration points outside the module

### `Backend/server.js`
**Express app bootstrap.** Imports the jurinex-voice router factory
(`require('./modules/jurinex-voice')`) and mounts it at both
`/admin/jurinex-voice` and `/api/admin/jurinex-voice`. Also calls
`attachAgentLiveTestSocket(server, {pool})` after `app.listen()` so
the WS bridge piggybacks on the same HTTP server. Without this
wiring, the module is dark.

### `Backend/config/env.js`
**Project-wide env exports.** The jurinex-voice module imports
`JWT_SECRET` from here for the WS auth path. Listed because the
module's `tests/agentLiveTest.socket.js` requires it.

### `Backend/config/logger.js`
**Project-wide winston logger.** Wrapped by
`observability/voiceLogger.js`. Listed because every voice-module
log line ultimately routes through this transport stack.

---

## 17. Frontend — page entry

### `Frontend/src/features/jurinex-voice/pages/VoiceManagementPage.jsx`
**Single page, 8 tabs.** Top-level component for the entire feature.
The tab bar:

| key | label | renders |
|---|---|---|
| `analytics` | Analytics | `VoiceAnalytics.jsx` |
| `history` | Call History | `VoiceCallHistory.jsx` |
| `agents` | Agents | `VoiceAgentList.jsx` |
| `calendar` | Calendar | `VoiceCalendarBookings.jsx` |
| `scheduler` | Call Scheduler | `VoiceCallScheduler.jsx` |
| `documents` | Documents | `VoiceDocumentList.jsx` |
| `upload` | Upload Document | `VoiceDocumentUpload.jsx` |
| `search` | Test Search | `VoiceKbSearchTester.jsx` |
| `debug` | Debug Logs | `VoiceDebugLogs.jsx` |

Pre-loads the agent list once via `listVoiceAgents()` and passes it
down to children so each tab has the agent dropdown options.

---

## 18. Frontend — agent builder (Run Test panel + configuration)

> What you see when you click an agent's row. Three side-by-side
> columns: prompt editor, settings accordion, live test panel.

### `Frontend/src/features/jurinex-voice/components/agent-builder/AgentBuilderPage.jsx`
**The configuration screen orchestrator.** Loads agent +
configuration + documents + model pricing in parallel on mount.
Owns the full builder state (`builderSettings`, `audioPrompt`,
`liveModel`, `voiceName`, `transferCall`). On Save, builds the save
payload and calls `updateVoiceAgentConfiguration`. Coordinates the
voice picker modal and the navigate-to-upload callback.

### `Frontend/src/features/jurinex-voice/components/agent-builder/AgentBuilderHeader.jsx`
**The sticky header.** Agent name + Agent ID + Live Model ID + cost
chip + Publish button + unsaved-changes badge. Shows last-saved
timestamp.

### `Frontend/src/features/jurinex-voice/components/agent-builder/AgentPromptPanel.jsx`
**Left column — prompt editor + top model/voice/language pickers.**
Filters the model picker to `category === 'live_audio'` only (so the
post-call text model doesn't pollute the live picker). Hosts the
language popover (currently locked to "Multilingual" mode). Renders
the agent's persona prompt textarea and the welcome message
configuration.

### `Frontend/src/features/jurinex-voice/components/agent-builder/AgentSettingsPanel.jsx`
**Middle column — accordion sections.** Functions, Knowledge Base,
Speech Settings, Realtime Transcription Settings, Call Settings,
Post-Call Data Extraction, Security & Fallback Settings. Hosts the
function pencil-modals (`EndCallModal`, `TransferCallModal`,
`CalendarFunctionModal`) and the KB document picker
(`KnowledgeDocumentPickerModal`).

### `Frontend/src/features/jurinex-voice/components/agent-builder/AgentTestPanel.jsx`
**Right column — Run Test panel.** Manages the entire browser-side
audio pipeline: getUserMedia, downsample 48k → 16k, ScriptProcessor
→ PCM bytes → base64 → WS, plus the reverse path (Gemini PCM
chunks → AudioContext playback). Owns all the live-test state
(socket, capture, playback, transcripts, phase). Also runs the
client-side pipeline tracer that emits per-stage timeline summaries
to the browser console.

### `Frontend/src/features/jurinex-voice/components/agent-builder/CalendarFunctionModal.jsx`
**Modal opened by clicking the pencil on `calendar_check` or
`calendar_book`.** Configures calendar id, timezone, default meeting
length, view-only switch, working hours per day-of-week, blocked
dates. Saves to `builderSettings.tool_settings.calendar`.

### `Frontend/src/features/jurinex-voice/components/agent-builder/KnowledgeDocumentPickerModal.jsx`
**Modal opened from the Knowledge Base "+ Add" button.** Searchable
checkbox list of all uploaded documents. Saves selected document
ids to `builderSettings.knowledge_base.document_ids`. Has an
"Upload more" button that switches the parent tab to Upload
Document.

### `Frontend/src/features/jurinex-voice/components/agent-builder/VoiceSelectModal.jsx`
**Voice catalog browser.** Lists every row from `platform_voices`
filtered by the agent's languages, with category chips (Live /
Audio / etc.) and an inline 12-second preview play button.

### `Frontend/src/features/jurinex-voice/components/agent-builder/agentBuilderConstants.js`
**Module-level constants.** `LIVE_MODELS` fallback list (used when
the API doesn't return pricing), `FUNCTION_OPTIONS` (5 toggleable
function keys), `LANGUAGE_OPTIONS`, `PLATFORM_VOICES` fallback,
`DEFAULT_AGENT_BUILDER_SETTINGS` (the entire shape of
`builderSettings` with sensible defaults).

### `Frontend/src/features/jurinex-voice/components/agent-builder/agentBuilderUtils.js`
**Pure helpers.** `mergeDeep`, `getBuilderSettings(config, agent)`
extracts the saved builder JSONB and merges with defaults,
`buildSavePayload(...)` serialises everything for the PUT call,
`normalizeModelOption()`, `getVoiceMeta()`, `getModelMeta()`,
`compactId()`, `deriveWelcomeMessage()`, `formatTransferType()`,
`getEnabledFunctions()`.

### `Frontend/src/features/jurinex-voice/components/agent-builder/platformVoiceSeed.js`
**Static fallback voice catalog.** Used when the
`/platform-voices` API call fails — keeps the voice picker working
in offline / dev mode.

---

## 19. Frontend — top-level voice management components

### `Frontend/src/features/jurinex-voice/components/VoiceAgentList.jsx`
**Agents tab.** Lists `voice_agents` with status pill, language
chip, document count, last-updated. Per-row pencil opens the **Edit**
modal (rename + display_name + description). Per-row trash opens
the **Delete confirmation** modal that requires typing the agent's
internal name to enable the destructive button. Top-bar **+ New
agent** opens the create form. Click a row → routes to the
`AgentBuilderPage`.

### `Frontend/src/features/jurinex-voice/components/VoiceAgentConfiguration.jsx`
**Thin re-export of `AgentBuilderPage`.** Exists for legacy import
paths.

### `Frontend/src/features/jurinex-voice/components/VoiceAnalytics.jsx`
**Analytics tab.** Date range picker + KPI cards (total calls, avg
duration, success rate, top agents). Reads from `/calls/analytics`.

### `Frontend/src/features/jurinex-voice/components/VoiceCallHistory.jsx`
**Call History tab.** Paged table of real Twilio calls (`calls`
table). Filters: agent, direction, status, date range. Click a row
opens `VoiceCallDetailDrawer`.

### `Frontend/src/features/jurinex-voice/components/VoiceCallDetailDrawer.jsx`
**Right-side drawer for a single call.** Transcript, tool events,
post-call extraction JSON, recording audio player (when available),
debug events timeline.

### `Frontend/src/features/jurinex-voice/components/VoiceCalendarBookings.jsx`
**Calendar tab.** Filters (agent, date range), per-day grid of
working windows / bookings / open slots when an agent is selected,
plus a master table of all bookings with attendee details. Reads
`/calendar/bookings` and `/calendar/slots`.

### `Frontend/src/features/jurinex-voice/components/VoiceCallScheduler.jsx`
**Call Scheduler tab.** Three sections: schedule-one form, CSV
bulk-import drop zone with template-download button, filterable
table of scheduled rows with cancel buttons. Reads/writes
`/scheduler/calls/*`.

### `Frontend/src/features/jurinex-voice/components/VoiceDocumentList.jsx`
**Documents tab.** Lists `kb_documents` per agent with status pill,
chunk count, source type, upload date. Actions: view detail,
reindex, delete.

### `Frontend/src/features/jurinex-voice/components/VoiceDocumentUpload.jsx`
**Upload Document tab.** Multipart upload form (file + agent +
title + language + tags) and a JSON-text alternative for raw text
uploads. Reads `/kb/upload` and `/kb/upload-text`. Reports per-stage
progress through the ingest pipeline by polling
`/debug/events?document_id=…`.

### `Frontend/src/features/jurinex-voice/components/VoiceKbSearchTester.jsx`
**Test Search tab.** A single text input + agent filter that calls
`/kb/search`. Renders ranked results with score, document title,
heading path, and snippet so the admin can validate KB quality
before exposing it to the agent.

### `Frontend/src/features/jurinex-voice/components/VoiceDebugLogs.jsx`
**Debug Logs tab.** Tails `voice_debug_events` with live-style
formatting. Filters by event_type, document_id, agent_id. Used to
debug KB ingest, live-test sessions, tool dispatches.

### `Frontend/src/features/jurinex-voice/components/voiceCallUtils.js`
**Shared helpers for the calls pages.** Date/duration formatting,
status colour mapping, transcript line rendering.

---

## 20. Frontend — API helper

### `Frontend/src/features/jurinex-voice/api/jurinexVoiceApi.js`
**The single REST hub for the entire frontend feature.** Every
`fetch` to the backend goes through here. ~50 named exports grouped
by subsystem:
- Agents: `listVoiceAgents`, `createVoiceAgent`, `getVoiceAgent`,
  `updateVoiceAgent`, `deleteVoiceAgent`,
  `getVoiceAgentConfiguration`, `updateVoiceAgentConfiguration`.
- Test turns: `runVoiceTestTurn`, `runVoiceAudioTurn`.
- Live test WS URL: `getVoiceAgentLiveTestUrl(agentId)`.
- KB: `uploadVoiceDocument`, `uploadVoiceText`, `listVoiceDocuments`,
  `getVoiceDocument`, `deleteVoiceDocument`, `reindexVoiceDocument`,
  `searchVoiceKb`, `listVoiceSearchLogs`.
- Debug: `listVoiceDebugEvents`, `recordVoiceDebugEvent`.
- Calendar: `listCalendarBookings`, `getCalendarSlots`.
- Scheduler: `listScheduledCalls`, `createScheduledCall`,
  `updateScheduledCall`, `cancelScheduledCall`,
  `bulkImportScheduledCalls`.
- Calls: `getCallsAnalytics`, `listCalls`, `getCall`.
- Voices / models: `listPlatformVoices`, `previewPlatformVoice`,
  `listVoiceModelPricing`.

Centralises the auth header, the API base URL, and JSON
parse/error-throw boilerplate.

---

## 21. Frontend — utilities

### `Frontend/src/features/jurinex-voice/utils/voiceDataflowLogger.js`
**Browser-side analogue of the backend `dataflowLogger`.** Sends
significant UI events (agent_builder_opened, live_test_started,
publish_completed, etc.) to `/debug/events` so the same Debug Logs
table holds both server- and client-side timelines for a single
session.

---

## 22. Frontend — integration outside the feature folder

### `Frontend/src/App.jsx`
**App router.** Imports `VoiceManagementPage` and routes the
`/dashboard/voice-management` path to it. The sidebar's "Voice
Management" entry triggers this route.

---

## 23. How a single click flows through the codebase

To make all of this concrete, here's what runs end-to-end when an
admin clicks **Run Test** in the Voice Management UI:

```
[browser] AgentTestPanel.jsx
          ▼ click "Run Test"
          ▼ getUserMedia → AudioContext
          ▼ open WebSocket(getVoiceAgentLiveTestUrl(agentId))

[backend] Backend/server.js
          ▼ ws "upgrade" event matches /admin/jurinex-voice/agents/:id/live-test
          ▼ tests/agentLiveTest.socket.js attachAgentLiveTestSocket()

          ▼ adminApiKey.middleware verifies key/JWT
          ▼ agents/voiceAgent.repository.js   getById(agentId)
          ▼ agents/voiceAgentConfig.repository.js   get(agentId)
          ▼ kb/kb.repository.js   getDocument()/getDocumentChunks() (only if no KB tool)
          ▼ tools/declarations.js   getDeclarationsForAgent(enabledKeys)
          ▼ tools/systemPromptFragments.repository.js   renderFragment(...)
          ▼ tools/toolPrompts.repository.js   renderForEnabledTools(...)
          ▼ tests/agentTest.service.js   createClient() + buildSystemInstruction()
          ▼ ai.live.connect({ model, callbacks, config })

[Gemini Live] WS ──── audio frames ────── tools/dispatcher.js
                                          ├── searchKnowledgeBase.tool.js → kbSearch.service.js
                                          ├── calendarCheck.tool.js → workingHours.js → googleCalendar.client.js
                                          ├── calendarBook.tool.js → googleCalendar.client.js + bookingNotifier.js
                                          ├── transferCall.tool.js
                                          ├── agentTransfer.tool.js
                                          └── endCall.tool.js
                                          ▼ writes voice_tool_executions

[backend] tests/agentLiveTest.socket.js
          ▼ on browser close, postcall/postCallExtractor.js   runExtraction(transcript, fields, model)
          ▼ writes voice_post_call_extractions
          ▼ pipeline tracer writes voice_debug_events

[browser] AgentTestPanel.jsx
          ▼ onclose → cleanupAudioTest → release mic
          ▼ utils/voiceDataflowLogger.js   logVoiceBuilderFlow('live_test_ended')
```

Every box in that flow is one of the files documented above. If a
new engineer needs to extend any step, this file tells them exactly
which folder to open and what neighbouring files to read first.

---

## File counts — final tally

| Layer | JS / JSX | SQL | MD | Total |
|---|---|---|---|---|
| Backend (`Backend/modules/jurinex-voice/`) | 45 | 16 | 2 | **63** |
| Backend integration (`Backend/server.js`, `config/env.js`, `config/logger.js`) | 3 | 0 | 0 | 3 |
| Frontend (`Frontend/src/features/jurinex-voice/`) | 26 | 0 | 0 | 26 |
| Frontend integration (`App.jsx`) | 1 | 0 | 0 | 1 |
| **Grand total** | **75** | **16** | **2** | **93** |

Add this file (`jurinex_code_files.md`) and you're at **94** documents
that, together, define the entire feature.
