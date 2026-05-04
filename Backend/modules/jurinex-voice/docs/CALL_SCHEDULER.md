# Outbound Call Scheduler — integration spec

This document is the **call-agent integration contract** for the
outbound call scheduler that the admin app writes into. The admin app
(Voice Management → **Call Scheduler** tab) lets admins:

- Schedule a single outbound call (agent + phone + time + optional
  name / email / notes), or
- Bulk import a CSV with N rows of `recipient_phone, recipient_name,
  recipient_email, scheduled_at, notes`.

Each row lands in the `voice_call_schedules` PostgreSQL table. The
**voice-agent runtime** (the separate Twilio Media-Streams service)
polls this table, dials due rows via Twilio, and writes status back as
the call progresses. The admin side **never** modifies `status`,
`attempts`, `twilio_call_sid`, `call_id`, `last_attempt_at`, or
`last_error` after row creation — those columns belong to the
call-agent.

> Sister document: see [`README.md`](../README.md) for the broader
> Jurinex Voice contract (agent config, prompts, KB, tools, post-call
> extraction). The scheduler is purely about **when** a call happens;
> once it dials, the same agent / prompt / tool stack from the README
> drives the conversation.

---

## Table of contents

1. [Architecture & ownership](#1-architecture--ownership)
2. [Database schema — `voice_call_schedules`](#2-database-schema)
3. [Status state machine](#3-status-state-machine)
4. [Polling pattern (SQL the call-agent runs)](#4-polling-pattern)
5. [Per-stage UPDATE recipes](#5-per-stage-update-recipes)
6. [Linking to other tables (`calls`, post-call, etc.)](#6-linking-to-other-tables)
7. [Phone-number normalisation](#7-phone-number-normalisation)
8. [Time-zone & scheduled_at semantics](#8-time-zone--scheduled_at-semantics)
9. [Retry / failure policy](#9-retry--failure-policy)
10. [Admin HTTP API (for reference)](#10-admin-http-api)
11. [CSV import format](#11-csv-import-format)
12. [End-to-end worked example](#12-end-to-end-worked-example)
13. [Operational concerns](#13-operational-concerns)
14. [Analytics queries](#14-analytics-queries)

---

## 1. Architecture & ownership

```
   ┌────────────────────────────────────────┐
   │  ADMIN APP                             │
   │  Voice Management → Call Scheduler     │
   │                                        │
   │  • Schedule a single call (form)       │  writes pending row
   │  • CSV bulk import                     │ ─────────────────────►
   │  • Cancel pending rows                 │
   │                                        │
   └────────────────────────────────────────┘
                                                voice_call_schedules
                                              (the only shared table
                                               for this feature)
   ┌────────────────────────────────────────┐
   │  VOICE-AGENT RUNTIME (your service)    │
   │                                        │
   │  • Poll due rows                       │ ◄── reads pending rows
   │  • Dial Twilio                         │
   │  • Bridge Media Stream ↔ Gemini Live   │  writes status/attempts/
   │  • Persist transcripts + tool exec     │ ─────────────────────►
   │  • Update status as call progresses    │
   │                                        │
   └────────────────────────────────────────┘
```

**Read/write split is enforced by convention, not DB grants.** The
admin app only ever:
- INSERTs new rows.
- UPDATEs metadata fields the admin can edit (recipient_name,
  recipient_email, scheduled_at, notes).
- UPDATEs status to `'cancelled'` if the row is still `pending` or
  `queued`.

Everything else on each row is the call-agent's surface.

---

## 2. Database schema

Migration: `migrations/015_voice_call_schedules.sql`.

```sql
CREATE TABLE voice_call_schedules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id           UUID NOT NULL,
  recipient_name     TEXT,
  recipient_phone    TEXT NOT NULL,
  recipient_email    TEXT,
  scheduled_at       TIMESTAMPTZ NOT NULL,
  timezone           TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status             TEXT NOT NULL DEFAULT 'pending',
  attempts           INT  NOT NULL DEFAULT 0,
  max_attempts       INT  NOT NULL DEFAULT 3,
  last_attempt_at    TIMESTAMPTZ,
  last_error         TEXT,
  twilio_call_sid    TEXT,
  call_id            UUID,
  notes              TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  batch_id           UUID,
  source             TEXT NOT NULL DEFAULT 'manual',
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX voice_call_schedules_due_idx
  ON voice_call_schedules (status, scheduled_at)
  WHERE status IN ('pending', 'queued');
CREATE INDEX voice_call_schedules_agent_idx
  ON voice_call_schedules (agent_id, scheduled_at DESC);
CREATE INDEX voice_call_schedules_batch_idx
  ON voice_call_schedules (batch_id);
CREATE INDEX voice_call_schedules_phone_idx
  ON voice_call_schedules (recipient_phone);
```

### Column-by-column

| Column | Type | NN? | Default | Owner | Meaning |
|---|---|---|---|---|---|
| `id` | UUID | ✓ | `gen_random_uuid()` | system | Stable row id |
| `agent_id` | UUID | ✓ | – | admin | Which voice agent will dial. FK in spirit to `voice_agents.id`. The agent's persona, system prompt, KB, tools, voice all come from `voice_agent_configurations` for this id (see main README §2.2). |
| `recipient_name` | TEXT |  | – | admin | Display name of the person being called. Optional. |
| `recipient_phone` | TEXT | ✓ | – | admin | Normalised to E.164 (`+91…`) on insert. The single most important column: this is the number Twilio will dial. |
| `recipient_email` | TEXT |  | – | admin | Optional. Useful for follow-up email confirmation outside the call (e.g. emailing a recap). |
| `scheduled_at` | TIMESTAMPTZ | ✓ | – | admin | Earliest time the call may be placed (UTC instant). Stored as TIMESTAMPTZ so timezone is unambiguous. |
| `timezone` | TEXT | ✓ | `'Asia/Kolkata'` | admin | The originating timezone the admin scheduled in. Use it for human-readable rendering (e.g. retry windows, do-not-call hours). The actual due-time check uses UTC `scheduled_at`. |
| `status` | TEXT | ✓ | `'pending'` | shared | See state machine in §3. Admin only sets `pending` (insert) and `cancelled` (cancel-button). All other transitions are the call-agent's. |
| `attempts` | INT | ✓ | `0` | call-agent | Increment on each Twilio dial attempt. |
| `max_attempts` | INT | ✓ | `3` | admin | Hard cap. After `attempts == max_attempts`, the call-agent must move row to `failed` instead of retrying. |
| `last_attempt_at` | TIMESTAMPTZ |  | – | call-agent | When the most recent dial fired. Used for backoff. |
| `last_error` | TEXT |  | – | call-agent | Free-form error message from the most recent failure. Visible in the admin UI. |
| `twilio_call_sid` | TEXT |  | – | call-agent | The `CAxxxx…` Twilio assigns the call. Lets you join to Twilio's logs. |
| `call_id` | UUID |  | – | call-agent | Link to the existing `calls` table (and downstream `voice_call_enrichments`, `voice_post_call_extractions`). Set as soon as the `calls` row is created. |
| `notes` | TEXT |  | – | admin | Admin-only context. The call-agent MAY surface this in the system prompt as `{{caller_notes}}` if you want — see §6. |
| `metadata` | JSONB | ✓ | `{}` | both | Free-form extension. Suggested uses: `{"campaign":"may-launch","crm_id":"abc-123"}`. Admin and call-agent can both write keys here; do not rely on a fixed schema. |
| `batch_id` | UUID |  | – | admin | Shared by every row imported in one CSV upload. Useful for `WHERE batch_id = '…'` analytics. |
| `source` | TEXT | ✓ | `'manual'` | admin | `manual` (form), `csv` (bulk import), or `api` (programmatic). |
| `created_by` | TEXT |  | – | admin | Email/username of the admin who scheduled the call. May be null when scheduled via API key. |
| `created_at` / `updated_at` | TIMESTAMPTZ | ✓ | `now()` | system | Standard timestamps. The call-agent must `SET updated_at = now()` on every UPDATE. |

### Indexes — what they're for

| Index | Use case |
|---|---|
| `voice_call_schedules_due_idx (status, scheduled_at) WHERE status IN ('pending', 'queued')` | The polling query in §4. Partial index keeps it tiny even if the table has millions of historical rows. |
| `voice_call_schedules_agent_idx (agent_id, scheduled_at DESC)` | Admin UI filter "all calls for agent X, newest first". |
| `voice_call_schedules_batch_idx (batch_id)` | Group rows that came from one CSV. |
| `voice_call_schedules_phone_idx (recipient_phone)` | Quick lookups for "all calls to this number" / dedup. |

---

## 3. Status state machine

```
                        ┌───────────────┐
                        │  pending      │  ← admin INSERT
                        │  (admin own)  │
                        └─┬─────────────┘
                          │ admin → cancelled (DELETE)
                          ▼
                          │
                          │ call-agent picks up
                          ▼
                  ┌───────────────┐
                  │  queued       │  ← call-agent claimed the row
                  │  (in-flight)  │     but hasn't dialed Twilio yet
                  └─┬─────────────┘
                    │ admin → cancelled  (last chance)
                    │ call-agent dial    Twilio rings
                    ▼
            ┌───────────────────┐
            │  in_progress      │  ← Twilio call is live
            └─┬─────────────────┘
              │
   ┌──────────┼─────────────────────────────┐
   │          │                             │
   ▼          ▼                             ▼
completed  no_answer                       failed
            │ (busy / declined / timeout)   │ (any non-recoverable
            │                               │  error: bad number,
            │  if attempts < max:           │  twilio reject, …)
            │  → re-queue (status='queued') │
            └───────────────────────────────┘
```

| Status | Who can move it here | Terminal? |
|---|---|---|
| `pending` | admin INSERT (default) | no — picked up by poller |
| `queued` | call-agent (claim) | no — about to dial |
| `in_progress` | call-agent (Twilio call active) | no — call ringing/answered |
| `completed` | call-agent (Twilio call ended successfully) | **yes** |
| `no_answer` | call-agent (busy / declined / no_answer / voicemail timeout) | maybe — if `attempts < max_attempts`, the call-agent re-queues |
| `failed` | call-agent (hard error / max attempts reached) | **yes** |
| `cancelled` | admin (only when status was `pending` or `queued`) | **yes** |

The admin app's `DELETE` endpoint refuses to cancel rows that are
already `in_progress` or beyond — at that point the call-agent owns
the lifecycle and a cancel would race the dial.

---

## 4. Polling pattern

Run this loop every 5–10 seconds inside the call-agent runtime. Use
`FOR UPDATE SKIP LOCKED` so multiple worker pods can run concurrently
without claiming the same row twice.

```sql
BEGIN;

SELECT id,
       agent_id,
       recipient_name,
       recipient_phone,
       recipient_email,
       scheduled_at,
       timezone,
       attempts,
       max_attempts,
       notes,
       metadata,
       source,
       batch_id
  FROM voice_call_schedules
 WHERE status = 'pending'
   AND scheduled_at <= now()
 ORDER BY scheduled_at ASC, created_at ASC
   FOR UPDATE SKIP LOCKED
 LIMIT 1;

-- If a row was returned:
UPDATE voice_call_schedules
   SET status     = 'queued',
       updated_at = now()
 WHERE id = $1;

COMMIT;
```

Then dispatch the dial outside the transaction (don't hold a row
lock across an HTTP call to Twilio).

### Polling frequency

- Production: every **5 seconds** is plenty. The partial index on
  `(status, scheduled_at) WHERE status IN ('pending','queued')` keeps
  the query in microseconds even with millions of rows.
- For low-volume use cases you can poll every minute — the only cost
  is admin-perceived delay between "scheduled at 11:00" and "phone
  rings at 11:00:05".
- Use **Postgres LISTEN/NOTIFY** for sub-second pickup if you really
  need it: have the admin app `NOTIFY voice_call_scheduled` after each
  insert, and the call-agent listens and re-runs the poll early.

### Multi-worker safety

`FOR UPDATE SKIP LOCKED` is mandatory if you run more than one worker
process. Without it two pods can `SELECT` the same row and both dial
the same number. This pattern is standard PostgreSQL job-queue
practice (it's what `pg-boss`, `graphile-worker`, and Sidekiq's
SQL-backed adapters all do).

---

## 5. Per-stage UPDATE recipes

### 5.1 Claim a row (poller)

Already shown in §4. After the `UPDATE … SET status='queued'`, you
own the row. The admin UI now sees status = `queued` (the cancel
button is still enabled, but only just — see 5.4).

### 5.2 Just before the Twilio dial fires

```sql
UPDATE voice_call_schedules
   SET status          = 'in_progress',
       attempts        = attempts + 1,
       last_attempt_at = now(),
       twilio_call_sid = $2,         -- the CAxxxx returned by Twilio
       updated_at      = now()
 WHERE id = $1;
```

If `twilio_call_sid` is not yet known (you mint it after the actual
dial returns), do this step in two halves: set `attempts` and
`last_attempt_at` to mark the attempt, then `UPDATE … SET
twilio_call_sid = $2` once you have it. Keep the column nullable —
some Twilio errors don't produce a SID at all.

### 5.3 Successful call ended

```sql
UPDATE voice_call_schedules
   SET status     = 'completed',
       call_id    = $2,        -- FK to calls.id (created by your existing call-agent flow)
       updated_at = now()
 WHERE id = $1;
```

Linking the `call_id` is what lets the existing telephony tables
(`calls`, `call_messages`, `voice_call_enrichments`,
`voice_post_call_extractions`) join back to the scheduled row.

### 5.4 No answer / busy / voicemail

```sql
-- If we still have attempts left, re-queue:
UPDATE voice_call_schedules
   SET status      = 'queued',
       last_error  = $2,          -- e.g. 'no-answer (15s timeout)'
       updated_at  = now()
 WHERE id = $1
   AND attempts < max_attempts;

-- If we exhausted attempts, fail the row:
UPDATE voice_call_schedules
   SET status      = 'no_answer',
       last_error  = $2,
       updated_at  = now()
 WHERE id = $1
   AND attempts >= max_attempts;
```

Decide between `no_answer` (terminal, "they didn't pick up") and
re-queueing in the call-agent code — both UPDATEs return the row count
so you know which path applied.

### 5.5 Hard failure

```sql
UPDATE voice_call_schedules
   SET status     = 'failed',
       last_error = $2,        -- e.g. 'twilio: 21211 invalid number'
       updated_at = now()
 WHERE id = $1;
```

Hard failures are non-recoverable: invalid phone number, agent went
inactive, model misconfigured, Twilio account permission error.
Don't retry these.

### 5.6 Admin cancel race

Between the poller selecting a row and the call-agent actually
dialing, the admin can press **Cancel**. To avoid the race, gate the
"start dialing" UPDATE on the current status:

```sql
UPDATE voice_call_schedules
   SET status          = 'in_progress',
       attempts        = attempts + 1,
       last_attempt_at = now(),
       updated_at      = now()
 WHERE id = $1
   AND status = 'queued'
RETURNING id;
```

If the row count is `0`, the admin cancelled while we were preparing
— skip the dial.

---

## 6. Linking to other tables

```
voice_call_schedules.id
        │
        │ via call_id  (you set after Twilio call starts)
        ▼
calls.id  ──────────────► call_messages, voice_call_enrichments
                                         voice_post_call_extractions
                                         voice_calendar_bookings (if the
                                         agent books during the call)
```

So your existing post-call enrichment and analytics flows continue
to work unchanged: as long as you populate `voice_call_schedules.call_id`
when the call starts, every downstream artefact is reachable from the
scheduled row via a single JOIN.

The `voice_post_call_extractions` writer (already wired in
[postcall/postCallExtractor.js](../postcall/postCallExtractor.js))
takes both `session_id` and `call_id`. For scheduled outbound calls
you'll set `call_id` (from the existing `calls` row) and leave
`session_id` null — the extractor accepts either.

### Optional — surface admin notes to the model

The admin enters context in `voice_call_schedules.notes` (e.g.
*"Had a billing issue last week — be empathetic"*). To make Preeti
aware, append this line to the system instruction at session start:

```
[Background on this caller from the scheduler:]
{{notes}}
```

Implementation suggestion: when starting the Live session for a
scheduled outbound call, fetch `notes` from
`voice_call_schedules` and pass it to your prompt assembly as a new
fragment variable, e.g. `{{caller_notes}}`. You can either hardcode
this in the prompt builder or add a new row to
`voice_system_prompt_fragments` (see main README §2.11) keyed
`outbound_caller_notes`. Both work; the DB-fragment approach keeps
copy editable by admins.

---

## 7. Phone-number normalisation

Admin app applies these rules at insert/import time
([scheduler/callScheduler.controller.js](../scheduler/callScheduler.controller.js)):

| Input | Result |
|---|---|
| `+917875827090` | unchanged (E.164) |
| `7875827090` | `+917875827090` (default country `+91` from `JURINEX_VOICE_DEFAULT_COUNTRY_CODE` env) |
| `917875827090` | `+917875827090` (11–15 digits → just prepend `+`) |
| `+1 (555) 010-1234` | `+15550101234` (whitespace, parens, dashes stripped) |
| `+44 20 7946 0958` | `+442079460958` |
| `12345` | rejected with HTTP 400 |
| `abc` | rejected |

So **the call-agent can trust that every `recipient_phone` in the
table starts with `+` and has only digits after that.** No further
normalisation needed before passing to Twilio.

If a row arrives via direct DB insert (bypassing the API), validate
with `^\+?[1-9]\d{6,14}$` before dialing.

---

## 8. Time-zone & scheduled_at semantics

- `scheduled_at` is stored as `TIMESTAMPTZ` — i.e. an absolute UTC
  instant. There's never any ambiguity about "what time is this".
- `timezone` (TEXT, default `Asia/Kolkata`) records the timezone the
  admin scheduled in. Use it for:
  - Rendering in admin UI ("Mon May 10, 11:00 AM IST").
  - Do-not-call windows ("don't dial 21:00–08:00 in the recipient's
    local time").
  - Choosing a polite retry slot.
- The polling query (`scheduled_at <= now()`) is timezone-agnostic.
  No risk of double-firing across DST changes.

### When `scheduled_at` came from a CSV without an offset

The bulk-import endpoint accepts `scheduled_at` like
`2026-05-10 11:00:00` (no timezone). It interprets this in the
**form-supplied `timezone`** field (default `Asia/Kolkata`) and
stores the resulting UTC instant. So a CSV with `2026-05-10
11:00:00` + timezone=`Asia/Kolkata` becomes
`2026-05-10T05:30:00Z`. Round-trip safe.

---

## 9. Retry / failure policy

Recommended:

```
attempts < max_attempts AND status='no_answer'
    → wait min(15 minutes * 2^(attempts-1), 60 minutes) → status='queued'
attempts >= max_attempts
    → status='no_answer' (terminal)
hard error (bad number, model error, Twilio reject)
    → status='failed' (terminal, no retry)
```

Implementation hint: instead of a separate retry timer, just bump
`scheduled_at` forward by the backoff and set `status='pending'`. The
existing poller picks it up at the right time and you don't need a
second job system.

```sql
UPDATE voice_call_schedules
   SET status       = 'pending',
       scheduled_at = now() + (interval '15 minutes' * power(2, attempts - 1)),
       last_error   = $2,
       updated_at   = now()
 WHERE id = $1
   AND attempts < max_attempts;
```

---

## 10. Admin HTTP API

Admins go through this app's REST API; the call-agent does NOT need
to call it (everything the call-agent needs is reachable via plain
SQL on `voice_call_schedules`). Listed here for reference so you
understand what data the admin produces.

```
GET    /admin/jurinex-voice/scheduler/calls
       ?agent_id=&status=&batch_id=&from=&to=&limit=&offset=
       → { success, calls: [...], total }

POST   /admin/jurinex-voice/scheduler/calls
       body: { agent_id, recipient_phone, recipient_name?,
               recipient_email?, scheduled_at, timezone?,
               max_attempts?, notes?, metadata?, source? }
       → { success, call: {...} }

PATCH  /admin/jurinex-voice/scheduler/calls/:id
       body partial; allowed keys: recipient_name, recipient_phone,
       recipient_email, scheduled_at, timezone, notes, max_attempts,
       metadata, status (admin → 'cancelled' only)

DELETE /admin/jurinex-voice/scheduler/calls/:id
       Soft-cancels (status='cancelled') ONLY if status was
       'pending' or 'queued'. Returns 404 if the row already
       passed beyond.

POST   /admin/jurinex-voice/scheduler/calls/bulk-import
       multipart: file (CSV), agent_id (REQUIRED),
                  timezone (optional), default_scheduled_at (optional)
       → { success, batch_id, inserted_count, skipped_count,
           inserted: [...], skipped: [{ line, reason, raw }] }
```

Auth: `X-Admin-API-Key: $ADMIN_API_KEY` header, OR the existing
`Authorization: Bearer <jwt|admin_token>`. Both are accepted by the
shared middleware.

---

## 11. CSV import format

The bulk-import endpoint accepts standard RFC 4180 CSV. The parser is
quote-aware and handles `"escaped ""quotes"" inside cells"`.

### Header (case-insensitive, underscores or spaces ok)

| Required? | Column | Aliases | Notes |
|---|---|---|---|
| ✓ | `recipient_phone` | `phone` | E.164 or anything the normaliser in §7 accepts |
| ✓ | `scheduled_at` | `scheduled_time` | ISO 8601 with or without offset; if no offset, the form-supplied `timezone` (default `Asia/Kolkata`) is used. **Optional only if `default_scheduled_at` is supplied at the form level.** |
|   | `recipient_name` | `name` | Free text |
|   | `recipient_email` | `email` | Validated against `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
|   | `notes` | – | Free text |

### Example

```csv
recipient_phone,recipient_name,recipient_email,scheduled_at,notes
+917875827090,Vishal Bainade,vishal@example.com,2026-05-10T11:00:00+05:30,Demo follow-up
+919812345678,Asha,,2026-05-10T15:00:00+05:30,Reminder call
8004567123,Maya,maya@example.com,2026-05-11T09:30:00,New customer onboarding
```

The third row demonstrates phone normalisation (10-digit → `+91…`)
and a naïve timestamp that gets interpreted in the form-level
`timezone`.

### Skip-row reasons returned

| Reason | Cause |
|---|---|
| `invalid_phone` | Phone doesn't normalise to E.164 |
| `invalid_scheduled_at` | Couldn't parse the timestamp |
| `invalid_email` | Email present but doesn't match the regex |

The whole import is a single transaction — either all rows insert or
none do (admin sees the skipped list separately so they can fix the
CSV and re-upload).

---

## 12. End-to-end worked example

Admin schedules a call:

```bash
curl -s -X POST -H "X-Admin-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"agent_id":"f7055938-358e-4ac0-a064-9df5065854cc",
       "recipient_phone":"+917875827090",
       "recipient_name":"Vishal Bainade",
       "recipient_email":"vishal@example.com",
       "scheduled_at":"2026-05-10T11:00:00+05:30",
       "timezone":"Asia/Kolkata",
       "notes":"Follow-up on demo from May 4"}' \
  http://localhost:4000/api/admin/jurinex-voice/scheduler/calls
```

DB after insert:
```
id              | 8b4f...
agent_id        | f7055938-...
recipient_name  | Vishal Bainade
recipient_phone | +917875827090
scheduled_at    | 2026-05-10 05:30:00+00
timezone        | Asia/Kolkata
status          | pending
attempts        | 0
max_attempts    | 3
source          | manual
created_at      | 2026-05-04 14:23:11+00
```

At 11:00:05 IST on May 10, the call-agent's poller fires:

```sql
BEGIN;
SELECT * FROM voice_call_schedules
 WHERE status='pending' AND scheduled_at <= now()
 ORDER BY scheduled_at ASC FOR UPDATE SKIP LOCKED LIMIT 1;
-- → returns the row above

UPDATE voice_call_schedules SET status='queued', updated_at=now() WHERE id=$1;
COMMIT;
```

Call-agent loads the agent config (per main README §5.1), sends a
Twilio outbound call request:

```js
const call = await twilio.calls.create({
  to: row.recipient_phone,
  from: process.env.TWILIO_PHONE_NUMBER,
  url: `${PUBLIC_BASE_URL}/twilio/outbound-stream?schedule_id=${row.id}`,
});
// call.sid = 'CAabc123...'
```

```sql
UPDATE voice_call_schedules
   SET status='in_progress',
       attempts = attempts + 1,
       last_attempt_at = now(),
       twilio_call_sid = 'CAabc123...',
       updated_at = now()
 WHERE id = $1 AND status = 'queued';
```

Twilio webhook hits `/twilio/outbound-stream`, returns TwiML
`<Stream>` to your media server, which opens a Gemini Live session
with Preeti's full config + the row's `notes` injected. Conversation
happens. Caller hangs up. Your existing flow inserts a `calls` row and
runs the post-call extractor.

Final state:

```sql
UPDATE voice_call_schedules
   SET status     = 'completed',
       call_id    = $2,           -- the calls.id you just inserted
       updated_at = now()
 WHERE id = $1;
```

Now `voice_calendar_bookings` (if Preeti booked a meeting),
`voice_call_enrichments` (telephony metrics), and
`voice_post_call_extractions` (the JSON summary) all point at the
same `call_id`, which the scheduled row also references.

---

## 13. Operational concerns

### Clock skew
The poller uses `now()` (Postgres clock). As long as your call-agent
processes use the same Postgres connection, there's no drift to
worry about. Don't compare a JS `Date.now()` against `scheduled_at`
in code — always let the DB do it.

### Idempotency
`twilio_call_sid` is unique-able (`ALTER TABLE … ADD CONSTRAINT
voice_call_schedules_twilio_sid_uq UNIQUE(twilio_call_sid)` if you
want belt-and-suspenders). If your dialer crashes between
`twilio.calls.create` and the UPDATE, the SID is already on the row
in some logs but not in DB — on restart, query Twilio for that SID
before re-dialing.

### Do-not-call windows
The scheduler doesn't enforce any. If you need it, gate inside the
call-agent before claiming a row:

```sql
SELECT * FROM voice_call_schedules
 WHERE status='pending'
   AND scheduled_at <= now()
   AND EXTRACT(hour FROM (scheduled_at AT TIME ZONE timezone)) BETWEEN 8 AND 20
 ORDER BY scheduled_at ASC FOR UPDATE SKIP LOCKED LIMIT 1;
```

### Concurrency cap per agent
If you don't want one agent to be on five calls at once, gate by:

```sql
SELECT count(*) FROM voice_call_schedules
 WHERE agent_id = $1 AND status = 'in_progress';
```

before claiming the next row for that agent.

### Volume
The partial index on `(status, scheduled_at) WHERE status IN
('pending','queued')` is small — only contains rows the poller cares
about. Even at 1M total rows you'll be in the low milliseconds per
poll. If the table grows huge (>10M), partition by month.

---

## 14. Analytics queries

```sql
-- How many calls are scheduled, by status, for the next 7 days?
SELECT status, count(*)
  FROM voice_call_schedules
 WHERE scheduled_at BETWEEN now() AND now() + interval '7 days'
 GROUP BY status
 ORDER BY count(*) DESC;

-- All calls in a CSV import batch
SELECT * FROM voice_call_schedules
 WHERE batch_id = '94f1...' ORDER BY scheduled_at;

-- Rows the call-agent failed today
SELECT id, recipient_phone, attempts, last_error
  FROM voice_call_schedules
 WHERE status = 'failed'
   AND updated_at >= date_trunc('day', now())
 ORDER BY updated_at DESC;

-- Average time-to-first-attempt (admin scheduled → call-agent dialed)
SELECT
  date_trunc('day', created_at) AS day,
  avg(extract(epoch from (last_attempt_at - scheduled_at))) AS avg_lag_seconds
FROM voice_call_schedules
WHERE last_attempt_at IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC LIMIT 14;

-- Connect rate per agent
SELECT
  s.agent_id,
  a.name AS agent_name,
  count(*) FILTER (WHERE s.status='completed')                   AS completed,
  count(*) FILTER (WHERE s.status IN ('no_answer','failed'))     AS not_completed,
  round(100.0 * count(*) FILTER (WHERE s.status='completed') /
        nullif(count(*),0), 1) AS pct_completed
FROM voice_call_schedules s
LEFT JOIN voice_agents a ON a.id = s.agent_id
WHERE s.created_at >= now() - interval '30 days'
GROUP BY s.agent_id, a.name
ORDER BY pct_completed DESC NULLS LAST;
```

---

## 15. Quick-reference cheatsheet

For the call-agent engineer to pin to the wall:

```sql
-- 1. Claim a due row
BEGIN;
SELECT * FROM voice_call_schedules
 WHERE status = 'pending' AND scheduled_at <= now()
 ORDER BY scheduled_at ASC FOR UPDATE SKIP LOCKED LIMIT 1;
UPDATE voice_call_schedules SET status='queued', updated_at=now() WHERE id=$1;
COMMIT;

-- 2. Start dialing
UPDATE voice_call_schedules
   SET status='in_progress', attempts=attempts+1, last_attempt_at=now(),
       twilio_call_sid=$2, updated_at=now()
 WHERE id=$1 AND status='queued';

-- 3a. Successful end
UPDATE voice_call_schedules
   SET status='completed', call_id=$2, updated_at=now() WHERE id=$1;

-- 3b. No answer (with re-queue if attempts left)
UPDATE voice_call_schedules
   SET status='queued',
       scheduled_at = now() + (interval '15 minutes' * power(2, attempts-1)),
       last_error=$2, updated_at=now()
 WHERE id=$1 AND attempts < max_attempts;

-- 3c. Terminal failure
UPDATE voice_call_schedules
   SET status='failed', last_error=$2, updated_at=now() WHERE id=$1;
```

That's the entire contract. The admin app keeps writing rows; you
keep reading them and updating status. Every other table in the
README continues to work exactly as documented — the scheduler is
purely an outbound-trigger layer that hands off to the existing
agent + tool + post-call stack.
