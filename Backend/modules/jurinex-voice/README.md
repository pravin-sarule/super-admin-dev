# Jurinex Voice — Admin module + Call-agent integration spec

This module is the **writer side** of the Jurinex voice-agent platform.
Admins use the Voice Management UI in this app to:

1. Create and configure voice agents (e.g. `preeti` — the Jurinex
   support bot).
2. Upload a knowledge base (PDF / DOCX / TXT / MD) — original file in
   GCS, extracted text + chunks + 768-d pgvector embeddings in
   PostgreSQL.
3. Wire each agent's behaviour: persona prompt, languages, voice, live
   model, enabled functions (end_call / transfer_call / agent_transfer
   / calendar_check / calendar_book / search_knowledge_base), calendar
   working hours, post-call extraction fields.
4. Test the agent live in the browser (mic ↔ Gemini Live audio) before
   handing it to the call-agent runtime.

The **call-agent** runtime — a separate Node.js / Python service that
takes Twilio media-stream calls — is the **reader side**. It reads
every row this module writes and never modifies agent or KB tables. The
call-agent is responsible for:

- Bridging Twilio Media Streams ↔ Gemini Live audio.
- Assembling the system instruction at session start from the rows
  documented below.
- Dispatching `toolCall` frames against the same tool handlers in
  `tools/` (or its own re-implementation matching the same DB
  contracts).
- Recording the live transcript, persisting tool executions, calendar
  bookings, and post-call extractions to the same tables.

> **Status (2026-04-30):** Admin side is **complete and stable**. Every
> database surface the call-agent needs to consume is documented below
> with exact column types, JSON shapes, and read/write rules. Scroll to
> [§5 Call-agent integration recipe](#5-call-agent-integration-recipe)
> for the runtime checklist.

---

## Table of contents

1. [Architecture & scope split](#1-architecture--scope-split)
2. [Database schema (every relevant table)](#2-database-schema)
3. [Agent builder UI → database mapping](#3-agent-builder-ui--database-mapping)
4. [Prompt assembly recipe (DB-driven)](#4-prompt-assembly-recipe)
5. [Call-agent integration recipe](#5-call-agent-integration-recipe)
6. [Tool dispatch contract](#6-tool-dispatch-contract)
7. [Post-call lifecycle (what to write and when)](#7-post-call-lifecycle)
8. [Models, voices, pricing](#8-models-voices-pricing)
9. [Env vars](#9-env-vars)
10. [HTTP endpoints (admin-only)](#10-http-endpoints)

---

## 1. Architecture & scope split

```
   ┌───────────────────────────────┐
   │  Admin UI (this app)          │      writes
   │  Voice Management page        │ ─────────────────►   Cloud SQL DB
   │  • create agents              │                       (Calling_agent_DB)
   │  • upload KB docs             │                       
   │  • configure functions        │                       
   │  • run live test (browser)    │                       
   └───────────────────────────────┘                       
                                                           
   ┌───────────────────────────────┐         reads         
   │  Call-agent runtime           │ ◄─────────────────────
   │  (Twilio Media Streams)       │                       
   │  • answer real phone calls    │                       
   │  • bridge to Gemini Live      │      writes (audit)   
   │  • dispatch tools             │ ──────────────────────►
   │  • persist transcripts +      │                       
   │    tool exec rows             │                       
   └───────────────────────────────┘
```

### What the call agent must NOT modify
| Table | Why |
|---|---|
| `voice_agents` | Owned by admin. Read agent metadata only. |
| `voice_agent_configurations` | Owned by admin. Read at session start. Never UPDATE. |
| `voice_agent_transfer_configs` | Owned by admin. Read at session start. |
| `kb_documents` / `kb_chunks` | Owned by admin upload + ingest pipeline. |
| `voice_tool_system_prompts` | Owned by admin. Read at session start (cache 60s). |
| `voice_system_prompt_fragments` | Owned by admin. Read at session start (cache 60s). |
| `voice_model_pricing` | Owned by admin. Read for display. |
| `platform_voices` / `platform_voice_preview_audios` | Owned by admin. Read for voice metadata. |

### What the call agent MUST write to
| Table | When |
|---|---|
| `voice_debug_events` | Every pipeline stage transition for replay/debugging. |
| `kb_search_logs` | Every `search_knowledge_base` invocation. |
| `voice_tool_executions` | Every tool call (pending → completed / failed). |
| `voice_calendar_bookings` | Every successful `calendar_book`. |
| `voice_post_call_extractions` | Once per call after teardown (status `pending` → `completed` / `failed` / `skipped`). |
| `voice_call_enrichments` (existing telephony table) | One row per real Twilio call, joining `calls.id`. |

---

## 2. Database schema

Schema lives in `migrations/`. Run everything in order with
`npm run migrate:jurinex-voice` — the runner is idempotent.

### 2.1 `voice_agents` — agent identity

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | The `agent_id` referenced everywhere. |
| `name` | TEXT NOT NULL | Slug, e.g. `preeti`. Unique. |
| `display_name` | TEXT | Human label shown in UI. |
| `description` | TEXT | Free-form. |
| `status` | TEXT NOT NULL DEFAULT `active` | `active` / `inactive` (soft delete). Call-agent should refuse to start a session if an agent is `inactive`. |
| `language_config` | JSONB | `{ languages: [...], admin_config: { live_model, voice, ... } }` — convenience denormalised view; the canonical config is in `voice_agent_configurations`. |
| `system_prompt` | TEXT | Legacy field — **prefer** `voice_agent_configurations.audio_live_system_prompt`. |
| `created_by` / `created_at` / `updated_at` | TEXT / TIMESTAMPTZ | |

### 2.2 `voice_agent_configurations` — runtime configuration (1:1 with `voice_agents`)

| Column | Type | Used at runtime by call-agent? |
|---|---|---|
| `agent_id` | UUID NOT NULL (PK, FK → `voice_agents.id`) | yes |
| `text_model` | TEXT, default `gemini-1.5-flash` | text-only paths (rare) |
| `live_model` | TEXT, default `gemini-3.1-flash-live-preview` | **yes — the Gemini Live model id** |
| `voice_name` | TEXT, default `Puck` | **yes — pass to `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`** |
| `voice_tag` | TEXT, default `Upbeat` | display only |
| `temperature` / `top_p` / `max_tokens` / `top_k_results` | NUMERIC / INT | LLM tuning if needed |
| `text_chat_system_prompt` | TEXT | text-chat fallback (rare) |
| `audio_live_system_prompt` | TEXT | **YES — Preeti's persona prompt; injected at the top of the system instruction** |
| `tool_settings` | JSONB | reserved (currently the canonical `tool_settings` lives in `custom_settings.agent_builder.tool_settings` — see §3.6) |
| `custom_settings` | JSONB DEFAULT `{}` | **YES — this holds everything the agent builder UI saves; structure detailed in §3** |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### 2.3 `voice_agent_transfer_configs` — per-agent transfer settings (1:1)

Used by the `transfer_call` tool. Most fields are Twilio-specific.

| Column | Type | Notes |
|---|---|---|
| `agent_id` | UUID NOT NULL (PK, FK → `voice_agents.id`) | |
| `name` | TEXT, default `transfer_call` | |
| `description` | TEXT | |
| `routing_mode` | TEXT, default `dynamic` | `dynamic` / `static` |
| `static_destination` | TEXT | E.164 phone number to dial. |
| `destination_prompt` | TEXT | Optional model hint (`"For sales transfer to +91…, for support to +91…"`) |
| `e164_format` | BOOL, default true | |
| `transfer_type` | TEXT, default `warm` | `warm` / `cold`. Warm = announce caller before connecting. |
| `on_hold_music` | TEXT, default `Ringtone` | |
| `ring_duration_seconds` | INT, default 30 | Twilio Dial timeout. |
| `navigate_ivr` / `internal_queue` / `agent_wait_seconds` / `whisper_*` / `three_way_*` / `handoff_*` / `displayed_caller_id` | various | Twilio bridging knobs (mostly UI-saved; call-agent uses what it needs) |
| `custom_settings` | JSONB | |

### 2.4 `kb_documents` — knowledge-base file metadata

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `agent_id` | UUID FK | NULL = global doc visible to every agent. |
| `title` | TEXT NOT NULL | |
| `source_type` | TEXT NOT NULL | `pdf` / `docx` / `txt` / `md` / `html` / `text`. |
| `source_uri` | TEXT | Original source URL if uploaded by URL. |
| `gcs_bucket` / `gcs_object_name` / `gcs_uri` | TEXT | Original file on GCS. |
| `original_filename` / `content_type` / `file_size_bytes` / `file_hash` | various | Deduplication via `file_hash`. |
| `raw_text` | TEXT | Full extracted text (kept for re-chunking). |
| `status` | TEXT, default `processing` | `processing` / `ready` / `failed`. **Call-agent must only consume documents where `status='ready'`.** |
| `error_message` | TEXT | Populated when `status='failed'`. |
| `chunk_count` | INT | Convenience denorm; authoritative count is `SELECT count(*) FROM kb_chunks WHERE document_id = ?`. |
| `token_count` | INT | |
| `embedding_model` | TEXT, default `text-embedding-004` | (newer ingests use `gemini-embedding-001` 768-d) |
| `embedding_dim` | INT, default 768 | |
| `language` | TEXT | ISO-ish language hint. |
| `tags` | TEXT[] | |
| `uploaded_by` / `created_at` / `updated_at` | | |

### 2.5 `kb_chunks` — embedded snippets

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `document_id` | UUID NOT NULL FK | |
| `chunk_index` | INT NOT NULL | Stable order within doc. |
| `text` | TEXT NOT NULL | The snippet itself. |
| `token_count` | INT NOT NULL | |
| `char_start` / `char_end` | INT | Slice into `kb_documents.raw_text`. |
| `heading_path` | TEXT[] (stored as `text` in some envs — read with `Array.isArray()` guard) | |
| `metadata` | JSONB | |
| `embedding` | `vector(768)` (pgvector) NOT NULL | Cosine search via `<=>` operator. |
| `created_at` | | |

### 2.6 `kb_search_logs` — audit trail of every KB search

Written every time `search_knowledge_base` runs. Read-only for analytics.

| Column | Type |
|---|---|
| `id` | UUID PK |
| `call_id` | UUID FK (nullable) |
| `agent_id` | UUID FK (nullable) |
| `query` | TEXT NOT NULL |
| `top_chunk_ids` | TEXT[] |
| `top_scores` | NUMERIC[] |
| `latency_ms` | INT |
| `source` | TEXT — e.g. `voice_agent_live`, `admin_test` |
| `created_at` | |

### 2.7 `voice_debug_events` — pipeline event log

Generic dataflow log. Persist key transitions (Gemini setup_complete, welcome_sent, mic_first_packet, audio_out_first, tool_call_received, tool_response_sent, gemini_socket_close, browser_socket_close, etc.) for after-the-fact replay.

| Column | Type |
|---|---|
| `id` | UUID PK |
| `trace_id` | TEXT |
| `agent_id` / `document_id` | UUID FK |
| `event_type` | TEXT NOT NULL |
| `event_stage` | TEXT |
| `message` | TEXT NOT NULL |
| `payload` | JSONB |
| `created_at` | |

### 2.8 `voice_tool_executions` — every tool call

Write a `pending` row immediately on dispatch, UPDATE it to `completed` / `tool_returned_error` / `exception` when the handler finishes. Latency captured for monitoring.

| Column | Type |
|---|---|
| `id` | UUID PK |
| `session_id` | UUID — voice session id |
| `agent_id` | UUID |
| `trace_id` | UUID |
| `function_call_id` | TEXT — Gemini's `toolCall.functionCalls[].id` |
| `tool_name` | TEXT NOT NULL |
| `input_json` | JSONB DEFAULT `{}` |
| `output_json` | JSONB |
| `status` | TEXT DEFAULT `pending` (`pending` / `running` / `completed` / `tool_returned_error` / `exception`) |
| `error_message` | TEXT |
| `latency_ms` | INT |
| `created_at` / `completed_at` | |

### 2.9 `voice_calendar_bookings` — appointments created by the agent

Write one row whenever `calendar_book` succeeds (after Google `events.insert` returns 200).

| Column | Type |
|---|---|
| `id` | UUID PK |
| `session_id` | UUID |
| `agent_id` | UUID |
| `tool_execution_id` | UUID FK → `voice_tool_executions.id` |
| `google_event_id` | TEXT |
| `google_calendar_id` | TEXT NOT NULL |
| `summary` / `description` | TEXT |
| `start_time` / `end_time` | TIMESTAMPTZ NOT NULL |
| `attendee_name` / `attendee_email` / `attendee_phone` | TEXT |
| `status` | TEXT DEFAULT `confirmed` |
| `metadata` | JSONB DEFAULT `{}` |
| `created_at` | |

### 2.10 `voice_tool_system_prompts` — per-tool guidance (DB-driven)

One row per tool. Mustache `{{placeholders}}` are rendered at session start. Cached 60s in the admin app (`tools/toolPrompts.repository.js`); replicate or re-implement that cache in the call-agent.

| Column | Type |
|---|---|
| `id` | UUID PK |
| `tool_name` | TEXT NOT NULL UNIQUE |
| `display_name` | TEXT NOT NULL |
| `description` | TEXT |
| `prompt_template` | TEXT NOT NULL |
| `is_active` | BOOL DEFAULT true — skip rows where false |
| `sort_order` | INT DEFAULT 100 — controls render order in the system prompt |
| `created_at` / `updated_at` | |

Currently seeded rows:
- `end_call`
- `transfer_call`
- `agent_transfer`
- `calendar_check`
- `calendar_book`
- `search_knowledge_base`

Available placeholders (substituted by the renderer): `{{language_label}}`, `{{timezone}}`, `{{default_meeting_minutes}}`, `{{working_hours_block}}`, `{{disabled_days}}`, `{{blocked_dates}}`, `{{view_only_warning}}`, `{{transfer_destination}}`, `{{transfer_type}}`. Unknown placeholders are left in place so admins can spot typos.

### 2.11 `voice_system_prompt_fragments` — non-tool prompt fragments (DB-driven)

Same shape as `voice_tool_system_prompts` but keyed by `fragment_key`.

Seeded keys:
| `fragment_key` | Purpose | Placeholders |
|---|---|---|
| `live_session_base` | Generic instructions appended after the agent persona prompt | `{{language_label}}` |
| `live_session_realtime_rules` | Realtime phone-call rules | (none) |
| `knowledge_base_header` | Header + rules wrapping the KB chunks (used only when the `search_knowledge_base` tool is **not** enabled — see §4) | `{{kb_sections_block}}`, `{{kb_truncated_note}}` |
| `knowledge_base_truncated_note` | "[truncated]" notice | (none) |
| `welcome_turn_template` | First AI utterance, sent via `realtimeInput.text` | `{{language_label}}`, `{{welcome_message}}` |
| `fallback_phrase` | What to say when the agent has no answer (seeded; not yet auto-injected) | (none) |

### 2.12 `voice_post_call_extractions` — analyst output per session

After every voice session, the call-agent runs a Gemini text job against the transcript to extract the admin-configured fields and writes a row here.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | UUID | live session id |
| `call_id` | UUID | real Twilio call id (when wired) |
| `agent_id` | UUID | |
| `status` | TEXT DEFAULT `pending` | `pending` / `running` / `completed` / `failed` / `skipped` |
| `extraction_fields` | JSONB DEFAULT `[]` | Snapshot of `custom_settings.agent_builder.post_call_extraction` at extraction time. Editing the agent later doesn't break old rows. |
| `extracted_data` | JSONB DEFAULT `{}` | Model output keyed by `field.key`, e.g. `{"call_summary":"…","user_sentiment":"positive","preferred_language":"English"}`. |
| `transcript` | TEXT | Full transcript fed to Gemini. |
| `extraction_model` | TEXT | The model id used. |
| `error_message` | TEXT | Populated on failure. |
| `latency_ms` | INT | |
| `started_at` / `completed_at` / `created_at` | | |

### 2.13 `voice_call_enrichments` — telephony-side enrichment (existing)

Pre-existing call-agent table. Schema is wider (`successful`, `picked_up`, `voicemail`, `recording_url`, `analysis JSONB`, etc.). The call-agent should keep using this table for telephony enrichment; `voice_post_call_extractions` is the **language-model** extraction layer that complements it.

### 2.14 `voice_model_pricing` — model picker source

Drives the Voice Management dropdowns. Read-only for the call-agent.

| Category | Models currently active |
|---|---|
| `live_audio` | `gemini-2.5-flash-native-audio-preview-12-2025` (Recommended), `gemini-2.5-flash-native-audio-preview-09-2025` (Pinned), `gemini-3.1-flash-live-preview` (Alternative) |
| `post_call_text` | `gemini-2.5-flash` (Recommended) |

### 2.15 `platform_voices` / `platform_voice_preview_audios`

Catalog of prebuilt Gemini voices (`Aoede`, `Kore`, `Leda`, `Puck`, `Zephyr`, etc.) with admin-recorded previews. The call-agent reads only `voice_name` from `voice_agent_configurations`.

---

## 3. Agent builder UI → database mapping

When the admin clicks **Publish**, the entire agent-builder state is
serialised into `voice_agent_configurations.custom_settings.agent_builder`
(JSONB) plus normalised columns. Below is the exact mapping the call
agent needs.

### 3.1 Top-level columns on `voice_agent_configurations`

| UI field | DB location | Wired at runtime? |
|---|---|---|
| Persona / system prompt textarea | `audio_live_system_prompt` | ✅ Injected first into the live system instruction. |
| Voice (Aoede / Leda / Kore / etc.) | `voice_name` | ✅ Sent to Gemini Live `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`. |
| Live model dropdown | `live_model` | ✅ Used as `models/<id>` for `ai.live.connect`. |

### 3.2 Languages, welcome, voice meta

Stored in `custom_settings.agent_builder` JSONB (root keys):

```json
{
  "languages": ["en", "hi", "mr"],
  "language_mode": "multiselect",
  "welcome": {
    "speaker": "ai_first",          // or "user_first"
    "mode": "dynamic",
    "pause_seconds": 0,
    "message": "नमस्ते, Jurinex support से..."
  },
  "voice_profile": {
    "name": "Aoede",
    "style": "Warm",
    "accent": "Indian",
    "gender": "female"
  }
}
```

| UI field | JSONB path | Wired? |
|---|---|---|
| Language chip selector | `languages[]` | ✅ Used to build `language_label` for prompt fragments. |
| Welcome speaker (AI-first / user-first) | `welcome.speaker` | ✅ When `ai_first`, the agent speaks `welcome.message` first via `realtimeInput.text` (template `welcome_turn_template`). When `user_first`, no welcome turn is sent. |
| Welcome message textarea | `welcome.message` | ✅ Substituted into the welcome template. |
| Welcome pause-before-speaking | `welcome.pause_seconds` | ⚠️ Saved, **not yet** consumed at runtime. |

### 3.3 Functions (the tools the model can call)

```json
{
  "functions": [
    { "key": "end_call",              "enabled": true },
    { "key": "transfer_call",         "enabled": true },
    { "key": "agent_transfer",        "enabled": false },
    { "key": "calendar_check",        "enabled": true },
    { "key": "calendar_book",         "enabled": true }
  ]
}
```

| Function key | DB-side handler in this app | Call-agent must implement |
|---|---|---|
| `end_call` | [tools/endCall.tool.js](tools/endCall.tool.js) | Close the Twilio leg gracefully after the farewell finishes streaming. |
| `transfer_call` | [tools/transferCall.tool.js](tools/transferCall.tool.js) | Update the active TwiML with `<Dial>` to `voice_agent_transfer_configs.static_destination`. |
| `agent_transfer` | [tools/agentTransfer.tool.js](tools/agentTransfer.tool.js) | End current Live session and start a new one with the target agent's config. |
| `calendar_check` | [tools/calendarCheck.tool.js](tools/calendarCheck.tool.js) | Reuse this file as-is (it has no Twilio dependency). |
| `calendar_book` | [tools/calendarBook.tool.js](tools/calendarBook.tool.js) | Reuse as-is. Writes to `voice_calendar_bookings` and sends a Nodemailer + .ics confirmation. |
| `search_knowledge_base` | [tools/searchKnowledgeBase.tool.js](tools/searchKnowledgeBase.tool.js) | Reuse as-is. Uses pgvector cosine search. |

> **Auto-enable rule:** `search_knowledge_base` is auto-added to
> `enabledFunctionKeys` whenever the agent has at least one document
> selected (see §4). The admin UI does NOT have to add it explicitly.

### 3.4 Knowledge Base

```json
{
  "knowledge_base": {
    "document_ids": ["f253d17c-4953-4518-82fd-4fb9fbb7a540"],
    "retrieval_chunks": 5,
    "similarity_threshold": 0.72,
    "instructions": "Use the Jurinex knowledge base first..."
  }
}
```

| UI field | JSONB path | Wired? |
|---|---|---|
| Selected documents (modal) | `knowledge_base.document_ids[]` | ✅ Auto-enables `search_knowledge_base` tool when non-empty. |
| Retrieval chunks (k) | `knowledge_base.retrieval_chunks` | ✅ Default `k` for searches; clamped 1–10. |
| Similarity threshold | `knowledge_base.similarity_threshold` | ⚠️ Saved; the active confidence floor is read from `JURINEX_VOICE_KB_MIN_SCORE` env (default 0.55). Easy to wire to this field if the admin needs per-agent control. |
| Instructions textarea | `knowledge_base.instructions` | ⚠️ Saved; not currently injected. |

### 3.5 Speech / Realtime transcription / Call settings (mostly UI-only today)

```json
{
  "speech":         { "background_sound": "None", "response_eagerness": 1, "interruption_sensitivity": 0.9, "reminder_seconds": 10, "reminder_times": 1, "pronunciation": [] },
  "transcription":  { "denoising_mode": "noise_and_speech", "mode": "speed" },
  "call":           { "keypad_detection": true, "keypad_timeout_seconds": 2.5, "termination_key_enabled": false, "digit_limit_enabled": false, "end_on_silence_minutes": 1, "max_duration_minutes": 15.3, "ring_duration_seconds": 30, "recording_enabled": true }
}
```

| UI field | JSONB path | Wired? |
|---|---|---|
| Speech eagerness, interruption, etc. | `speech.*` | ❌ UI-only. Wire to Gemini Live VAD / `realtimeInputConfig.automaticActivityDetection` when needed. |
| Transcription denoising / mode | `transcription.*` | ❌ UI-only. Pass through to Live config when needed. |
| Keypad / termination key / digit limit | `call.*` | ❌ Twilio-only relevance — wire DTMF on the call-agent side. |
| End Call on Silence (minutes) | `call.end_on_silence_minutes` | ❌ Implement an idle-timer in the call-agent: track last `mic_packet_sent` with RMS above threshold; close after N minutes. |
| Max Call Duration (minutes) | `call.max_duration_minutes` | ❌ Hard `setTimeout` cap on session start, calls `end_call`. |
| Ring Duration | `call.ring_duration_seconds` | ⚠️ Same value also lives in `voice_agent_transfer_configs.ring_duration_seconds` — pass to Twilio Dial timeout. |
| Transfer Type (warm / cold) | (alias of `voice_agent_transfer_configs.transfer_type`) | ✅ |
| Call Recording toggle | `call.recording_enabled` | ❌ Toggle saves; recording pipeline is the call-agent's job. Suggested: tap Twilio mic stream + Gemini PCM out → mix on shared timeline → upload WAV to GCS → INSERT `voice_call_enrichments.recording_gcs_uri`. |

### 3.6 Tool settings (calendar, etc.)

Calendar configuration the admin saves through the **pencil** modal on `calendar_check` / `calendar_book`:

```json
{
  "tool_settings": {
    "calendar": {
      "calendar_id": "abc@group.calendar.google.com",   // override; falls back to JURINEX_VOICE_DEFAULT_CALENDAR_ID
      "timezone": "Asia/Kolkata",
      "default_meeting_minutes": 30,
      "view_only": false,
      "working_hours": {
        "monday":    { "enabled": true,  "start": "09:00", "end": "18:00" },
        "tuesday":   { "enabled": true,  "start": "09:00", "end": "18:00" },
        "wednesday": { "enabled": true,  "start": "09:00", "end": "18:00" },
        "thursday":  { "enabled": true,  "start": "09:00", "end": "18:00" },
        "friday":    { "enabled": true,  "start": "09:00", "end": "18:00" },
        "saturday":  { "enabled": true,  "start": "10:00", "end": "14:00" },
        "sunday":    { "enabled": false, "start": "00:00", "end": "00:00" }
      },
      "blocked_dates": ["2026-12-25"]
    }
  }
}
```

`tool_settings` lives in `custom_settings.agent_builder.tool_settings` (the canonical location). [tools/workingHours.js](tools/workingHours.js) enforces the policy in both `calendar_check` (filters free windows) and `calendar_book` (rejects bookings outside hours / on blocked dates / when `view_only=true`). Reuse it verbatim in the call-agent.

### 3.7 Post-call extraction

```json
{
  "post_call_extraction": [
    { "key": "call_summary",        "label": "Call Summary",        "type": "text",    "enabled": true },
    { "key": "call_successful",     "label": "Call Successful",     "type": "boolean", "enabled": true },
    { "key": "user_sentiment",      "label": "User Sentiment",      "type": "enum",    "options": ["positive","neutral","negative"], "enabled": true },
    { "key": "preferred_language",  "label": "Preferred Language",  "type": "string",  "enabled": true }
  ],
  "post_call_model": "gemini-2.5-flash"
}
```

| Field | Wired? |
|---|---|
| `post_call_extraction[]` | ✅ Used as the JSON schema for [postcall/postCallExtractor.js](postcall/postCallExtractor.js). |
| `post_call_model` | ✅ The Gemini model that runs the extraction. Default `gemini-2.5-flash`. |

### 3.8 Security & fallback

```json
{
  "security": {
    "fallback_phrase": "I am sorry, I do not have information on that in our records.",
    "allow_interruptions": true
  }
}
```

| Field | Wired? |
|---|---|
| `security.fallback_phrase` | ⚠️ Saved; a `fallback_phrase` row exists in `voice_system_prompt_fragments` but is not yet auto-injected. Easy: append `renderFragment('fallback_phrase', {fallback_phrase: …})` into the system instruction. |
| `security.allow_interruptions` | ❌ UI-only. Map to Gemini Live `realtimeInputConfig.automaticActivityDetection` when implementing. |

---

## 4. Prompt assembly recipe

At session start, the call-agent assembles the system instruction in
**this exact order** (see [tests/agentLiveTest.socket.js](tests/agentLiveTest.socket.js) `buildLiveSystemInstruction`):

```
1.  voice_agent_configurations.audio_live_system_prompt   (agent persona, Preeti's identity)
2.  ""                                                    (blank line)
3.  voice_system_prompt_fragments[live_session_base]      (with {{language_label}} substituted)
4.  ""
5.  voice_system_prompt_fragments[live_session_realtime_rules]
6.  KB block — see below                                  (only when search_knowledge_base is NOT enabled)
7.  Tool block — see below
```

### 4.1 KB block (conditional)

```
if (knowledge_base.document_ids has at least one entry):
    if "search_knowledge_base" is in enabledFunctionKeys:
        // tool-based: skip dumping the KB
        kb_block = ""
    else:
        // legacy: dump up to 45 KB of chunks
        sections = [
            "### Document i: <title>\n<chunk1>\n\n<chunk2>...",
            ...
        ]
        kb_block = renderFragment(
            "knowledge_base_header",
            {
                kb_sections_block: sections.join("\n\n"),
                kb_truncated_note: (truncated ? renderFragment("knowledge_base_truncated_note") : "")
            }
        )
else:
    kb_block = ""
```

### 4.2 Tool block

```
enabledFunctionKeys = builderSettings.functions
                        .filter(f => f.enabled !== false)
                        .map(f => f.key);

// auto-enable KB search when documents are selected
if (knowledge_base.document_ids.length > 0):
    enabledFunctionKeys.push("search_knowledge_base")  (deduped)

variables = {
    language_label,           // e.g. "English (US)" / "Hindi (India)"
    timezone,                 // tool_settings.calendar.timezone
    default_meeting_minutes,  // tool_settings.calendar.default_meeting_minutes
    working_hours_block,      // formatted multi-line list
    disabled_days,
    blocked_dates,
    view_only_warning,        // empty unless view_only=true
    transfer_destination,     // voice_agent_transfer_configs.static_destination
    transfer_type             // voice_agent_transfer_configs.transfer_type
}

tool_block = ["---"]
for tool_name in enabledFunctionKeys (sorted by sort_order in voice_tool_system_prompts):
    template = SELECT prompt_template FROM voice_tool_system_prompts
                WHERE tool_name = ? AND is_active = true
    tool_block.append(render(template, variables))
tool_block.append("---")
```

### 4.3 Live config sent to Gemini

```js
{
  model: `models/${live_model}`,
  config: {
    responseModalities: ["AUDIO"],
    systemInstruction: <assembled per §4.1-4.2>,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice_name } } },
    thinkingConfig: { thinkingLevel: "minimal" },                       // 3.1 Live optimization
    sessionResumption: resumeHandle ? { handle: resumeHandle } : {},     // opt into handles
    contextWindowCompression: { triggerTokens: 104857, slidingWindow: { targetTokens: 52428 } },
    ...(functionDeclarations.length ? { tools: [{ functionDeclarations }] } : {}),
  }
}
```

`functionDeclarations` come from [tools/declarations.js](tools/declarations.js). Reuse that file or copy it.

### 4.4 First turn (welcome)

If `welcome.speaker === "ai_first"` and `welcome.message` is non-empty,
send via **`realtimeInput.text`** (NOT `clientContent`):

```js
session.sendRealtimeInput({
  text: render(
    welcome_turn_template,        // from voice_system_prompt_fragments
    { language_label, welcome_message: welcome.message }
  )
});
```

Using `clientContent` for this is a documented cause of WS 1008 closes
on Live audio sessions — do not change this.

### 4.5 Cache / TTL

Both prompt-fragment tables are read at session start. The admin app
caches them for 60s ([tools/toolPrompts.repository.js](tools/toolPrompts.repository.js),
[tools/systemPromptFragments.repository.js](tools/systemPromptFragments.repository.js)).
Apply the same TTL (or `LISTEN/NOTIFY` invalidation) in the call-agent.

---

## 5. Call-agent integration recipe

Step-by-step contract for the engineer building the customer-facing
call agent.

### 5.1 Inbound call accepted

```
Twilio webhook → return TwiML <Stream> pointing at your media-stream WS
```

When Twilio opens the media-stream WS:

1. Look up the agent that should handle this call (by phone number,
   IVR mapping, or DB rule).

2. Check `SELECT status FROM voice_agents WHERE id = $1`. If
   `status != 'active'`, reject the call with a polite message.

3. Load the configuration in one round-trip:

   ```sql
   SELECT
     a.audio_live_system_prompt,
     a.live_model,
     a.voice_name,
     a.custom_settings,
     t.static_destination,
     t.transfer_type,
     t.ring_duration_seconds
   FROM voice_agent_configurations a
   LEFT JOIN voice_agent_transfer_configs t USING (agent_id)
   WHERE a.agent_id = $1
   ```

4. Resolve `enabledFunctionKeys` (§4.2). Auto-add
   `search_knowledge_base` if `knowledge_base.document_ids` is
   non-empty.

5. Render the system instruction (§4.1).

6. Open `ai.live.connect` (§4.3). On `setupComplete`, send the
   welcome turn (§4.4).

### 5.2 Mid-call audio loop

| Direction | What |
|---|---|
| Twilio → backend | μ-law 8 kHz audio. Decode, resample to PCM 16-bit LE 16 kHz mono, base64-encode, `session.sendRealtimeInput({ audio: { data, mimeType: "audio/pcm;rate=16000" } })`. |
| Backend → Twilio | Gemini emits `serverContent.modelTurn.parts[].inlineData.{data, mimeType: "audio/pcm;rate=24000"}`. Loop **every part**. Resample 24k → 8k μ-law and forward to Twilio. |

### 5.3 Tool call frames

Whenever Gemini sends `toolCall`, dispatch via the same handlers in
[tools/](tools/). Every tool call MUST be answered with a
`toolResponse.functionResponses[]` envelope (failure to do so is a
documented cause of mid-call WS 1008). See §6 for the exact contract.

### 5.4 Resumption on WS 1011

Native-audio Live preview models occasionally emit WS code 1011
("Internal error occurred.") right after an `interrupted` event. The
admin app already wires the auto-resume path
([tests/agentLiveTest.socket.js](tests/agentLiveTest.socket.js) — search
for `MAX_RESUME_ATTEMPTS`). Mirror that in the call-agent:

1. Stash `sessionResumptionUpdate.newHandle` on every incoming frame.
2. In `onclose(1011)` if a handle is present and the session was
   productive (audio out > 0) and attempts < 3, immediately reconnect
   with `config.sessionResumption: { handle }`.

### 5.5 Session teardown

When the call ends (caller hangup / `end_call` / `transfer_call`):

1. Flush any pending input/output transcripts into the running
   transcript array.
2. INSERT a row into `voice_post_call_extractions` with `status =
   'pending'`, then run the extraction job (§7) and UPDATE.
3. Persist the `voice_call_enrichments` row for telephony metrics.
4. Upload the recording WAV to GCS and write its URI back into
   `voice_call_enrichments.recording_gcs_uri` if recording is enabled.

---

## 6. Tool dispatch contract

Every `toolCall` from Gemini Live looks like:

```json
{
  "toolCall": {
    "functionCalls": [
      { "id": "fc_…", "name": "<tool_name>", "args": { … } }
    ]
  }
}
```

Reply with:

```json
{
  "toolResponse": {
    "functionResponses": [
      { "id": "fc_…", "name": "<tool_name>", "response": { "result": <handler return value> } }
    ]
  }
}
```

Handler return contracts (read each tool file for the full schema):

| Tool | On success | On failure |
|---|---|---|
| `end_call` | `{ status: "ending_call", reason, detail }` + caller side closes the leg after grace | n/a |
| `transfer_call` | `{ status: "transfer_initiated" / "transfer_simulated" / "transfer_unavailable", destination, reason, detail }` | structured `status` |
| `agent_transfer` | `{ status: "agent_transfer_initiated" / "target_agent_not_found", target_agent_id, reason, detail }` | structured |
| `calendar_check` | `{ status: "ok" / "low_confidence" / "calendar_not_configured" / "calendar_error", calendar_id, time_zone, slot_duration_minutes, busy[], free_windows[], blocked_dates[], view_only, detail }` | structured |
| `calendar_book` | `{ status: "booked", booked: true, success: true, event_id, html_link, start_iso, end_iso, summary, attendee_*, confirmation_email, detail, instruction_to_agent }` | `{ status: "calendar_error" / "outside_working_hours" / "date_blocked" / "day_disabled" / "view_only_mode" / "invalid_arguments", booked: false, success: false, detail, instruction_to_agent }` |
| `search_knowledge_base` | `{ status: "ok" / "low_confidence", confident, top_score, min_score, result_count, results: [{score, document, section, snippet}], detail, instruction_to_agent }` | `{ status: "search_error" / "invalid_arguments", ... }` |

Always include `instruction_to_agent` on error paths so the model
behaves correctly without inventing facts. The hardened prompts in
`voice_tool_system_prompts` instruct the model to honour those.

Audit every dispatch as a row in `voice_tool_executions` (see §2.8).

---

## 7. Post-call lifecycle

After session teardown, the call-agent runs a short Gemini text job
to populate `voice_post_call_extractions`:

```js
const fieldList = builderSettings.post_call_extraction;
const model     = builderSettings.post_call_model || 'gemini-2.5-flash';

if (!fieldList.some(f => f.enabled !== false))   →  status = 'skipped'
if (transcript.length < 10)                      →  status = 'skipped'
otherwise:
    INSERT row with status='running', store transcript + extraction_fields snapshot
    call ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: <derived from fieldList: text→string, boolean→boolean, enum→string with .enum, number→number>
      }
    })
    UPDATE row with status='completed', extracted_data, latency_ms
```

The full reference implementation is
[postcall/postCallExtractor.js](postcall/postCallExtractor.js). It's
fire-and-forget — failures never throw into the call-agent's teardown
loop.

---

## 8. Models, voices, pricing

`voice_model_pricing` is the source of truth. Currently:

| Category | model_id | Use |
|---|---|---|
| `live_audio` | `gemini-2.5-flash-native-audio-preview-12-2025` | **Recommended** for live conversation |
| `live_audio` | `gemini-2.5-flash-native-audio-preview-09-2025` | Pinned older snapshot |
| `live_audio` | `gemini-3.1-flash-live-preview` | Alternative; lower acoustic richness; some keys can't stream audio |
| `post_call_text` | `gemini-2.5-flash` | Post-call extraction job |

Voices the model accepts: any row in `platform_voices.voice_name`
(`Aoede`, `Kore`, `Leda`, `Puck`, `Zephyr`, etc.). The agent's choice
is in `voice_agent_configurations.voice_name`.

---

## 9. Env vars

```bash
# DB
JURINEX_VOICE_DATABASE_URL = postgresql://db_user:...@host:5432/Calling_agent_DB

# Gemini
GOOGLE_API_KEY                            = AIza...                 (must support Live + text)
GEMINI_API_KEY                            = (alternate name)
JURINEX_VOICE_LIVE_API_VERSION            = v1beta
EMBEDDING_MODEL                           = text-embedding-004      (or gemini-embedding-001)
EMBEDDING_DIM                             = 768

# KB
JURINEX_VOICE_KB_MIN_SCORE                = 0.55                    (similarity floor)
JURINEX_VOICE_KB_SEARCH_K                 = 5
JURINEX_VOICE_LIVE_KB_BUDGET_BYTES        = 45000                   (legacy: only when search tool disabled)
JURINEX_VOICE_LIVE_KB_CHUNKS_PER_DOC      = 40

# Calendar (Google service account)
JURINEX_VOICE_CALENDAR_SA_JSON_BASE64     = <base64 service-account JSON>
JURINEX_VOICE_DEFAULT_CALENDAR_ID         = <calendar id shared with the SA>
JURINEX_VOICE_DEFAULT_CALENDAR_TZ         = Asia/Kolkata
JURINEX_VOICE_CALENDAR_ALLOW_ATTENDEES    = false                   (set true only after Workspace DWD)

# SMTP (booking confirmation emails — reused project SMTP)
EMAIL_HOST / EMAIL_PORT / EMAIL_SECURE / EMAIL_USER / EMAIL_PASS / EMAIL_FROM
JURINEX_VOICE_BOOKING_EMAIL_FROM          = bookings@example.com    (optional override)

# Live tunables
JURINEX_VOICE_LIVE_WELCOME_TIMEOUT_MS     = 3500
JURINEX_VOICE_LIVE_TOOL_END_GRACE_MS      = 4500
JURINEX_VOICE_LIVE_MAX_RESUMES            = 3
JURINEX_VOICE_TOOL_PROMPT_CACHE_MS        = 60000
JURINEX_VOICE_PROMPT_FRAGMENT_CACHE_MS    = 60000

# GCS (recording uploads, KB original files)
GCS_KEY_BASE64                            = <same SA as calendar>
GCS_VOICE_BUCKET                          = jurinex-voice-docs
GCP_PROJECT_ID                            = nexintel-ai-summarizer

# Admin auth (this app only)
ADMIN_API_KEY                             = <random>
```

---

## 10. HTTP endpoints

All routes mounted at `/admin/jurinex-voice/*` (and aliased
`/api/admin/jurinex-voice/*`). All require `X-Admin-API-Key:
$ADMIN_API_KEY` or `Authorization: Bearer <jwt|admin_token>`.

```
GET    /agents
POST   /agents
GET    /agents/:agentId
PATCH  /agents/:agentId
DELETE /agents/:agentId                            (soft-delete: status='inactive')

GET    /agents/:agentId/configuration              full builder snapshot
PUT    /agents/:agentId/configuration              save builder snapshot

POST   /kb/upload                                  multipart: file, agent_id?, title?, language?, tags?
POST   /kb/upload-text                             json:      title, text, agent_id?, language?, tags?
GET    /kb/documents                               ?agent_id&status&source_type&limit&offset
GET    /kb/documents/:documentId                   returns sample_chunks (first 5)
DELETE /kb/documents/:documentId                   removes chunks + GCS object
POST   /kb/documents/:documentId/reindex

POST   /kb/search                                  body: { query, k=5, agent_id?, source? }
GET    /kb/search-logs

GET    /debug/events                               ?event_type&document_id&agent_id&limit
GET    /health                                     (no auth)

# Voice / model picker (for the UI)
GET    /voices
GET    /model-pricing
```

WebSocket (admin live test only):

```
WSS   /admin/jurinex-voice/agents/:agentId/live-test       (auth via ?admin_key= or token=)
```

Production telephony does NOT use this WS — it uses Twilio Media
Streams against the call-agent service. The contract above (system
instruction assembly, tool dispatch, post-call extraction) is the
same regardless of transport.

---

## 11. Run

```bash
cd Backend
npm install
npm run migrate:jurinex-voice    # idempotent; creates pgvector + all tables
npm run dev
```

The migration runner re-applies every `.sql` in `migrations/` in
filename order on each run, so tables and seed rows
(`voice_tool_system_prompts`, `voice_system_prompt_fragments`,
`voice_model_pricing`, `platform_voices`) stay current automatically.
