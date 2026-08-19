# Citation cost ingestion — contract for the user-side engine

**Target database:** `citationTest` (the same DB the engine already uses for `judgement_sessions`)
**Target table:** `citation_usage_events`
**Consumer:** the Super Admin dashboard → Citation Management → **Citation Analytics**

Write one row per API call. The dashboard aggregates from this table alone.

---

## 1. Why this exists

The engine currently stashes a cumulative snapshot in `judgement_sessions.payload->'costLedger'`.
That blob is overwritten as the session progresses, has no per-call timestamps, and carries no
INR — so it cannot answer "what did this user cost last week". This table replaces it as the
source of truth.

> **Keep writing `costLedger` if it's useful to you — but never sum both. They double-count.**

### Important: the database prices the call, not the engine

Send **raw counters**. A `BEFORE INSERT` trigger looks up `citation_rate_card` and fills in
`cost_inr`, `cost_usd`, `rate_version` and `cost_source`. This means a price change is an admin
edit in the dashboard, with **no engine redeploy**.

This also fixes a live bug: the engine currently bills `gemini-2.5-flash` at
`gemini-2.5-flash-lite` rates ($0.10/$0.40 instead of $0.30/$2.50). On one real session the
`judgment_verifier` line reported **₹11.23** where the correct figure is **₹50.23** — a **~4.5×
under-report** on the single largest cost line.

---

## 2. The table

**The table already exists — do not create it.** This is here so you can see the shape you are
writing into. Verify with `\d citation_usage_events`.

```sql
-- citationTest.citation_usage_events  (ALREADY CREATED — reference only)
                                          -- YOU SET?
  id                    BIGSERIAL PK        -- no, auto
  event_key             TEXT                -- YES  idempotency key (see §2.2)
  session_id            TEXT                -- YES  = judgement_sessions.session_id
  run_id                TEXT                -- optional
  step_no               INTEGER             -- optional
  user_id               TEXT NOT NULL       -- YES  Auth_DB.users.id as text, or 'anonymous'
  case_id               TEXT                -- optional
  doc_id                TEXT                -- optional, judgement_vault.doc_id / IK docid
  provider              TEXT NOT NULL       -- YES  gemini|claude|indian_kanoon|document_ai|serper
  service               TEXT NOT NULL       -- YES  gemini|claude|india_kanoon|document_ai
  operation             TEXT NOT NULL       -- YES  agent name, or IK endpoint (see §3)
  stage                 TEXT                -- optional
  model                 TEXT                -- YES for LLM, NULL for IK
  unit                  TEXT NOT NULL       -- YES  tokens|calls|pages
  quantity              BIGINT NOT NULL     -- YES  billable units
  calls                 INTEGER NOT NULL    -- YES  1
  input_tokens          BIGINT NOT NULL     -- YES for LLM
  output_tokens         BIGINT NOT NULL     -- YES for LLM
  cached_tokens         BIGINT NOT NULL     -- optional, subset of input_tokens
  cache_hit             BOOLEAN NOT NULL    -- optional, true = free call
  cost_inr              NUMERIC             -- NO !! trigger fills this
  cost_usd              NUMERIC             -- NO !! trigger fills this
  producer_cost_inr     NUMERIC             -- optional, YOUR figure (drift check only)
  producer_cost_usd     NUMERIC             -- optional
  rate_version          TEXT                -- NO, trigger
  cost_source           TEXT NOT NULL       -- NO, trigger
  applied_inr_per_usd   NUMERIC             -- NO, trigger
  usage_time_ms         BIGINT NOT NULL     -- optional
  success               BOOLEAN NOT NULL     -- YES on failure (false)
  error_code            TEXT                -- optional
  error_message         TEXT                -- optional
  source                TEXT NOT NULL       -- leave default 'engine'
  metadata              JSONB NOT NULL      -- optional
  occurred_at           TIMESTAMPTZ NOT NULL-- YES  no default, real call time WITH offset
  created_at            TIMESTAMPTZ NOT NULL-- no, auto
```

Enforced by CHECK constraints — a violation is a hard error, not a silent skip:

```
unit        IN ('tokens','calls','pages','documents','characters','other')
source      IN ('engine','legacy','backfill')
occurred_at >  '2024-01-01'
quantity, calls, input_tokens, output_tokens, cached_tokens, cost_* >= 0
```

## 2.1 How to write

Direct `INSERT` over the connection you already hold. No HTTP endpoint, no auth plumbing — and
you can write in the same transaction as the session update.

**Single call — copy-paste ready:**

```sql
INSERT INTO citation_usage_events (
    event_key, session_id, run_id, step_no, user_id, case_id, doc_id,
    provider, service, operation, stage, model,
    unit, quantity, calls, input_tokens, output_tokens, cached_tokens, cache_hit,
    producer_cost_inr, usage_time_ms, success, error_code, metadata, occurred_at
) VALUES (
    $1,  $2,  $3,  $4,  $5,  $6,  $7,
    $8,  $9,  $10, $11, $12,
    $13, $14, $15, $16, $17, $18, $19,
    $20, $21, $22, $23, $24::jsonb, $25::timestamptz
)
ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;
```

**Batch a whole pipeline step in one round trip** (preferred — one call per stage, not per row):

```sql
INSERT INTO citation_usage_events (
    event_key, session_id, user_id, provider, service, operation, model,
    unit, quantity, calls, input_tokens, output_tokens, occurred_at
)
SELECT * FROM UNNEST(
    $1::text[],   $2::text[],   $3::text[],  $4::text[], $5::text[],
    $6::text[],   $7::text[],   $8::text[],  $9::bigint[], $10::int[],
    $11::bigint[], $12::bigint[], $13::timestamptz[]
)
ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;
```

**Check your work** — after one session, this must return zero rows:

```sql
SELECT provider, model, operation, COUNT(*)
  FROM citation_usage_events
 WHERE cost_source <> 'rate_card'
 GROUP BY 1,2,3;
```

Anything listed is either unpriced (missing rate card entry) or `manual` (you set `cost_inr`
yourself and bypassed pricing). Both are bugs.

**Emit at the call site, right after each response** — fire-and-forget with its own error
handling. Do *not* accumulate and flush at end-of-session; that recreates the `costLedger`
problem.

### Idempotency

```
event_key = "{session_id}:{attempt}:{operation}:{model|-}:{call_seq}"
```

- **`call_seq`** — monotonic per `(session_id, attempt, operation, model)`. A retry after a 429
  gets a **new `call_seq`**: it is real additional spend and must be counted.
- **`attempt`** — bumped only when a whole pipeline *stage* is re-run. A crash-and-replay of the
  same stage produces identical keys and inserts nothing.

Longer than ~200 chars → use `sha256(...)` hex.

---

## 3. Columns

| Column | Required | Meaning |
|---|---|---|
| `event_key` | **yes** | Idempotency key, formula above |
| `occurred_at` | **yes** | `timestamptz` when the call returned/errored, **with offset** (`2026-08-18T11:04:05.123+05:30`). No default — never pass `NOW()`, that is write time |
| `provider` | **yes** | lowercase: `gemini`, `claude`, `indian_kanoon`, `document_ai`, `serper`, `openai` |
| `service` | **yes** | score-card bucket: `gemini`, `claude`, `india_kanoon`, `document_ai`. Anything else still totals but renders as an extra card |
| `operation` | **yes** | LLM: the agent/task (`doc_classify`, `context_extract`, `grounds_extract`, `issue_split`, `keyword_extract`, `judgment_verifier`, `embed_rerank`, `grounding`). IK: `search` / `document` / `orig_doc` / `fragment` / `meta`. **Drives IK pricing — a wrong value is wrong money** |
| `model` | LLM only | exact vendor id (`gemini-2.5-flash`, `gemini-3.6-flash`). `NULL` for IK |
| `unit` | **yes** | `tokens` for LLM, `calls` for IK/search/grounding, `pages` for OCR |
| `quantity` | **yes** | `input_tokens + output_tokens` when `unit='tokens'`; call count when `calls`; pages when `pages` |
| `calls` | **yes** | `1` — one row per call |
| `input_tokens` / `output_tokens` | LLM | from the vendor's `usageMetadata` |
| `cached_tokens` | optional | the portion of `input_tokens` served from cache. Billed at the cached rate; the remainder at the normal input rate |
| `cache_hit` | optional | `true` = wholly free call. **Still insert the row** — it is counted, not billed (matches "Cache hits (free)" in your terminal output) |
| `session_id` | **yes when known** | must equal `judgement_sessions.session_id` |
| `user_id` | **yes when known** | `Auth_DB.users.id` **as text** (`'75'`, `'88'`) — the same value you already write to `judgement_sessions.user_id`. Use `'anonymous'` when unknown, never `NULL` |
| `case_id`, `run_id`, `step_no`, `doc_id`, `stage` | optional | `doc_id` = `judgement_vault.doc_id` / IK docid, enables per-document cost attribution |
| `producer_cost_inr` / `producer_cost_usd` | optional but wanted | your own computed figure. Stored but **not displayed** when a rate card row matches — it is the drift signal |
| `cost_inr` / `cost_usd` / `rate_version` / `cost_source` | **leave NULL** | trigger-owned. Setting `cost_inr` forces `cost_source='manual'` and bypasses the rate card |
| `success` / `error_code` / `error_message` | on failure | **a failed call that still burned input tokens MUST be recorded** with `success=false` and real token counts, or spend is under-reported |
| `usage_time_ms` | optional | wall clock of the call |
| `metadata` | optional | free-form JSONB: `issue_id`, `finish_reason`, `endpoint`, … |

---

## 4. Examples

### Gemini generation

```json
{
  "event_key": "edc2cabc…:1:judgment_verifier:gemini-2.5-flash:0042",
  "occurred_at": "2026-08-18T11:04:05.123+05:30",
  "session_id": "edc2cabc8d7044c4851e2409d01ed18d",
  "run_id": "run7", "step_no": 5, "user_id": "75", "case_id": "180",
  "provider": "gemini", "service": "gemini",
  "operation": "judgment_verifier", "stage": "verify",
  "model": "gemini-2.5-flash",
  "unit": "tokens", "quantity": 10447, "calls": 1,
  "input_tokens": 9436, "output_tokens": 1011, "cached_tokens": 0,
  "producer_cost_inr": 0.1146, "usage_time_ms": 2143, "success": true,
  "metadata": {"issue_id": "issue-3", "finish_reason": "STOP"}
}
```

### India Kanoon document fetch

```json
{
  "event_key": "edc2cabc…:1:document:0118",
  "occurred_at": "2026-08-18T11:03:12.004+05:30",
  "session_id": "edc2cabc8d7044c4851e2409d01ed18d",
  "run_id": "run7", "user_id": "75", "doc_id": "1523617",
  "provider": "indian_kanoon", "service": "india_kanoon",
  "operation": "document", "model": null,
  "unit": "calls", "quantity": 1, "calls": 1, "cache_hit": false,
  "producer_cost_inr": 0.20, "usage_time_ms": 612, "success": true,
  "metadata": {"endpoint": "/doc/1523617/"}
}
```

→ trigger fills `cost_inr = 0.2000`, `cost_source = 'rate_card'`, `rate_version = 'v1'`.

---

## 5. Two things that will silently cost you money

1. **`grounding` is the single largest line item.** In the legacy data, Google Search grounding
   was **₹2,353 of ₹3,738** total Gemini spend — 63%. Your `costLedger` tracks `grounding_calls`
   but the terminal report doesn't show it. Emit it as
   `operation='grounding'`, `unit='calls'`, `calls=N`, or that cost disappears.

2. **Unpriced models are billed at ₹0 — but flagged.** If a model has no rate card entry the row
   lands with `cost_source='unpriced'` and the dashboard shows an amber banner naming it. Check:

   ```sql
   SELECT provider, model, operation, COUNT(*)
     FROM citation_usage_events WHERE cost_source = 'unpriced'
    GROUP BY 1,2,3;
   ```

---

## 6. Rules of the table

- **Append-only.** `UPDATE`/`DELETE` raise `restrict_violation`. Corrections are compensating
  rows carrying `metadata->>'corrects_event_key'`. (DBA escape hatch:
  `SET LOCAL citation.allow_cost_mutation = 'on';` inside a transaction.)
- **Rate edits never reprice history.** Each row keeps the cost it was priced at, tagged with
  `rate_version`. A new price is a new rate card row with a later `effective_from`.
- **Two clocks.** `occurred_at` is yours; `created_at` is when the row landed. A widening gap
  means batching or clock drift — the dashboard heartbeat surfaces both.

## 7. Useful views

| View | Purpose |
|---|---|
| `v_citation_usage_events` | events + `service_canonical` (IK alias merge) + `user_key` |
| `v_citation_session_cost` | one row per session: AI vs IK split, totals, cache hits — reproduces the terminal's "COMPLETE COST — END-TO-END session" block |

```sql
SELECT * FROM v_citation_session_cost WHERE session_id = 'edc2cabc8d7044c4851e2409d01ed18d';
```
