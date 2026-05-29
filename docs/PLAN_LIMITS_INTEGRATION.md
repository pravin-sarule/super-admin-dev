# Subscription Plan Limits — Integration Guide

> **Scope:** How to wire the per-plan rate/quota limits (set in Super-Admin → Subscription
> Management) into the user-facing **jurinex-dev ChatModel** and **Summarization** services so that
> each user is automatically constrained by the plan they are subscribed to.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Super-Admin (super-admin-dev)                       │
│  payment_DB → subscription_plans                     │
│    ∟ chat_*  columns  (18 limit fields)              │
│    ∟ sum_*   columns  (18 limit fields)              │
└──────────────────┬──────────────────────────────────┘
                   │  plan is assigned to user
                   ▼
┌─────────────────────────────────────────────────────┐
│  payment_DB → user_subscriptions (or subscriptions) │
│    user_id  ──► plan_id                              │
└──────────────────┬──────────────────────────────────┘
                   │  read at request time
                   ▼
┌─────────────────────────────────────────────────────┐
│  jurinex-dev ChatModel  (Document_DB)                │
│  llm_chat_config  ← global model settings only      │
│  llmChatPolicyService  ← enforces limits             │
│  llmConfigService.getLLMConfig()  ← current source  │
└─────────────────────────────────────────────────────┘
```

**Two separate PostgreSQL databases are involved:**

| Database | Connection env | Contains |
|---|---|---|
| `Document_DB` | `DATABASE_URL` | `llm_chat_config`, `llm_usage_logs`, `user_files` |
| `Payment_DB` | `PAYMENT_DB_URL` | `subscription_plans`, `user_subscriptions` |

---

## 2. Subscription Plan — Column Reference

All columns live in `payment_DB.subscription_plans`.

### Chat Model limits (`chat_*`)

| Column | Type | Enforced by | Meaning |
|---|---|---|---|
| `chat_token_limit` | INTEGER | `assertChatAllowed` → `total_tokens_per_day` | Max tokens the user may consume in any rolling 24-hour window |
| `chat_messages_per_hour` | INTEGER | `assertChatAllowed` → `messages_per_hour` | Max LLM calls in the rolling last hour |
| `chat_chats_per_day` | INTEGER | `assertChatAllowed` → `chats_per_day` | Max LLM calls in the rolling last 24 hours |
| `chat_quota_per_minute` | INTEGER | `assertChatAllowed` → `quota_chats_per_minute` | Max LLM calls per minute (burst guard) |
| `chat_max_document_pages` | INTEGER | `assertUploadAllowed` → `max_document_pages` | Max pages per uploaded PDF |
| `chat_max_document_size_mb` | INTEGER | `assertUploadAllowed` / `assertStoredFileMeetsDashboardLimits` → `max_document_size_mb` | Max file size in MB |
| `chat_max_file_upload_per_day` | INTEGER | `assertUploadAllowed` → `max_file_upload_per_day` | Max file uploads per rolling 24 hours |
| `chat_max_upload_files` | INTEGER | `enforceDashboardUploadPolicy` → `max_upload_files` | Max files per single upload request |

### Summarization limits (`sum_*`)

| Column | Type | Enforced by | Meaning |
|---|---|---|---|
| `summarization_token_limit` | INTEGER | `assertChatAllowed` → `total_tokens_per_day` | Same as chat but for summarization sessions |
| `sum_messages_per_hour` | INTEGER | `assertChatAllowed` → `messages_per_hour` | |
| `sum_chats_per_day` | INTEGER | `assertChatAllowed` → `chats_per_day` | |
| `sum_quota_per_minute` | INTEGER | `assertChatAllowed` → `quota_chats_per_minute` | |
| `sum_max_document_pages` | INTEGER | `assertUploadAllowed` → `max_document_pages` | |
| `sum_max_document_size_mb` | INTEGER | `assertUploadAllowed` → `max_document_size_mb` | |
| `sum_max_file_upload_per_day` | INTEGER | `assertUploadAllowed` → `max_file_upload_per_day` | |
| `sum_max_upload_files` | INTEGER | `enforceDashboardUploadPolicy` → `max_upload_files` | |
| `sum_max_context_documents` | INTEGER | Summarization retrieval layer | Max documents loaded as RAG context per query |
| `sum_max_conversation_history` | INTEGER | Summarization session layer | Max messages kept in the active conversation window |

> **NULL = unlimited.** Every column defaults to `NULL`. A `NULL` value means no limit is
> applied for that field — the policy service treats `0` and `NULL` both as "skip check".

---

## 3. Current Flow (Global Config Only)

```
Request → authenticate (JWT) → enforceLLMChatPolicy middleware
  ├─ getLLMConfig(userId)
  │    └─ reads llm_chat_config (Document_DB) — one global row
  ├─ assertChatAllowed(userId, config)
  │    └─ checks llm_usage_logs (rolling windows)
  └─ next() — controller runs
```

`getLLMConfig` returns the **same limits for every user** regardless of their plan.

---

## 4. Target Flow (Per-Plan Limits)

```
Request → authenticate (JWT) → enforceLLMChatPolicy middleware
  ├─ getLLMConfig(userId)
  │    ├─ reads llm_chat_config (model settings: model, temp, max_output_tokens, streaming_delay)
  │    ├─ reads user's active plan from Payment_DB → subscription_plans
  │    └─ MERGES: plan limits override global defaults where plan value is non-null
  ├─ assertChatAllowed(userId, mergedConfig)
  └─ next()
```

The global `llm_chat_config` acts as the **fallback** for any field where the user's plan has `NULL`.

---

## 5. Implementation

### Step 1 — Add payment_DB pool to ChatModel service

Create `Backend/ChatModel/config/paymentDb.js`:

```js
const { Pool } = require('pg');
require('dotenv').config();

const paymentPool = new Pool({
  connectionString: process.env.PAYMENT_DB_URL,
});

paymentPool.connect()
  .then(() => console.log('✅ ChatModel: Payment DB connected.'))
  .catch(err => console.error('❌ ChatModel: Payment DB failed:', err));

module.exports = paymentPool;
```

Add `PAYMENT_DB_URL` to `Backend/ChatModel/.env`:
```
PAYMENT_DB_URL="postgresql://db_user:PASSWORD@HOST:5432/Payment_DB"
```

---

### Step 2 — Add `getUserActivePlan` to llmConfigService

In `Backend/ChatModel/services/llmConfigService.js`, add at the top:

```js
const paymentPool = require('../config/paymentDb');
```

Add the plan-fetch helper:

```js
/**
 * Fetch the user's active subscription plan from payment_DB.
 * Tries three common table schemas in order; returns null if none found.
 */
async function getUserActivePlan(userId) {
  const uid = Number(userId);
  if (!uid || !Number.isFinite(uid)) return null;

  const queries = [
    // Most common schema
    `SELECT sp.*
     FROM subscriptions s
     JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.user_id = $1 AND (s.status = 'active' OR s.status IS NULL)
     ORDER BY s.created_at DESC NULLS LAST LIMIT 1`,

    `SELECT sp.*
     FROM user_subscriptions us
     JOIN subscription_plans sp ON sp.id = us.plan_id
     WHERE us.user_id = $1 AND (us.status = 'active' OR us.is_active = true)
     ORDER BY us.created_at DESC NULLS LAST LIMIT 1`,

    `SELECT sp.*
     FROM user_plans up
     JOIN subscription_plans sp ON sp.id = up.plan_id
     WHERE up.user_id = $1 AND (up.status = 'active' OR up.is_active = true)
     ORDER BY up.created_at DESC NULLS LAST LIMIT 1`,
  ];

  for (const sql of queries) {
    try {
      const { rows } = await paymentPool.query(sql, [uid]);
      if (rows.length > 0) return rows[0];
    } catch {
      // table doesn't exist in this environment — try next
    }
  }
  return null;
}
```

---

### Step 3 — Merge plan limits into `getLLMConfig`

Replace the existing `getLLMConfig` function body with a version that merges:

```js
/**
 * Returns effective LLM config for userId.
 * Model settings come from llm_chat_config; rate/quota limits come from the
 * user's active subscription plan (falls back to llm_chat_config values when
 * the plan column is NULL).
 */
async function getLLMConfig(userId = null, service = 'chat') {
  const baseRow = await getBaseLLMConfigRow();
  const cfg = mapRowToConfig(baseRow);

  const uid = normalizeUserId(userId);
  if (!uid) return cfg;  // no user → global defaults

  const plan = await getUserActivePlan(uid);
  if (!plan) {
    console.log(`[LLMConfig] No active plan for user ${uid} — using global defaults`);
    return cfg;
  }

  console.log(`[LLMConfig] Active plan for user ${uid}: "${plan.name}" (id=${plan.id})`);

  // Helper: use plan value when non-null, otherwise keep base config value
  const planInt = (colName, fallback) => {
    const v = plan[colName];
    if (v == null) return fallback;
    const n = finiteNumber(v, 0);
    return n > 0 ? n : fallback;
  };

  if (service === 'chat') {
    cfg.total_tokens_per_day     = planInt('chat_token_limit',             cfg.total_tokens_per_day);
    cfg.messages_per_hour        = planInt('chat_messages_per_hour',       cfg.messages_per_hour);
    cfg.chats_per_day            = planInt('chat_chats_per_day',           cfg.chats_per_day);
    cfg.quota_chats_per_minute   = planInt('chat_quota_per_minute',        cfg.quota_chats_per_minute);
    cfg.max_document_pages       = planInt('chat_max_document_pages',      cfg.max_document_pages);
    cfg.max_document_size_mb     = planInt('chat_max_document_size_mb',    cfg.max_document_size_mb);
    cfg.max_file_upload_per_day  = planInt('chat_max_file_upload_per_day', cfg.max_file_upload_per_day);
    cfg.max_upload_files         = planInt('chat_max_upload_files',        cfg.max_upload_files);
  } else {
    // service === 'summarization'
    cfg.total_tokens_per_day     = planInt('summarization_token_limit',    cfg.total_tokens_per_day);
    cfg.messages_per_hour        = planInt('sum_messages_per_hour',        cfg.messages_per_hour);
    cfg.chats_per_day            = planInt('sum_chats_per_day',            cfg.chats_per_day);
    cfg.quota_chats_per_minute   = planInt('sum_quota_per_minute',         cfg.quota_chats_per_minute);
    cfg.max_document_pages       = planInt('sum_max_document_pages',       cfg.max_document_pages);
    cfg.max_document_size_mb     = planInt('sum_max_document_size_mb',     cfg.max_document_size_mb);
    cfg.max_file_upload_per_day  = planInt('sum_max_file_upload_per_day',  cfg.max_file_upload_per_day);
    cfg.max_upload_files         = planInt('sum_max_upload_files',         cfg.max_upload_files);
    cfg.max_context_documents    = planInt('sum_max_context_documents',    cfg.max_context_documents ?? 0);
    cfg.max_conversation_history = planInt('sum_max_conversation_history', cfg.max_conversation_history ?? 0);
  }

  cfg._plan_id   = plan.id;
  cfg._plan_name = plan.name;

  return cfg;
}
```

Export `getUserActivePlan` so it can be used in other services:

```js
module.exports = {
  getLLMConfig,
  getUserActivePlan,    // ← add this
  invalidateConfigCache,
  resolveVertexModelId,
  getMulterUploadCeilingMb,
  getStreamingDelayMs,
  mapRowToConfig,
  mergeRequestLlmOverrides,
  flattenLlmRequestBody,
};
```

---

### Step 4 — Pass service type through middleware

**`middleware/llmChatPolicy.js`** — pass `'chat'`:

```js
const llmConfig = await getLLMConfig(userId, 'chat');   // ← add second arg
```

**Summarization middleware** (wherever you load the config for summarization) — pass `'summarization'`:

```js
const llmConfig = await getLLMConfig(userId, 'summarization');
```

---

### Step 5 — Use `max_context_documents` and `max_conversation_history` in Summarization

These two fields are **not** enforced by `llmChatPolicyService` — they are used inside the
summarization controller/RAG pipeline. After the middleware sets `req.llmChatConfig`:

```js
// In summarization controller, when building the retrieval query:
const maxContextDocs = req.llmChatConfig.max_context_documents || 5;  // default 5
const topK = Math.min(retrieval_top_k, maxContextDocs);

// When loading conversation history:
const maxHistory = req.llmChatConfig.max_conversation_history || 20;  // default 20
const history = allMessages.slice(-maxHistory);
```

---

## 6. Policy Enforcement — Error Codes

When a limit is hit, the middleware returns HTTP **429** (or **503** for infra errors) with this body:

```json
{
  "success": false,
  "code": "RATE_LIMIT_TOTAL_TOKENS_PER_DAY",
  "message": "Your token budget for the last 24 hours has been reached...",
  "details": {
    "used_tokens_last_24h": 45000,
    "limit": 50000,
    "next_reset_utc": "2026-05-22T00:00:00.000Z"
  }
}
```

| HTTP | `code` | Limit triggered |
|---|---|---|
| 429 | `RATE_LIMIT_TOTAL_TOKENS_PER_DAY` | `chat_token_limit` / `summarization_token_limit` |
| 429 | `RATE_LIMIT_PER_MINUTE` | `chat_quota_per_minute` / `sum_quota_per_minute` |
| 429 | `RATE_LIMIT_MESSAGES_PER_HOUR` | `chat_messages_per_hour` / `sum_messages_per_hour` |
| 429 | `RATE_LIMIT_CHATS_PER_DAY` | `chat_chats_per_day` / `sum_chats_per_day` |
| 429 | `DAILY_UPLOAD_LIMIT` | `chat_max_file_upload_per_day` / `sum_max_file_upload_per_day` |
| 413 | `FILE_TOO_LARGE` | `chat_max_document_size_mb` / `sum_max_document_size_mb` |
| 413 | `DOCUMENT_TOO_MANY_PAGES` | `chat_max_document_pages` / `sum_max_document_pages` |
| 400 | `TOO_MANY_FILES_IN_REQUEST` | `chat_max_upload_files` / `sum_max_upload_files` |
| 503 | `POLICY_CHECK_UNAVAILABLE` | Database unreachable (set `LLM_POLICY_LENIENT=true` to allow through) |

---

## 7. How Limits Are Measured (Rolling Windows)

All counts come from `public.llm_usage_logs` in **Document_DB**:

```sql
-- Token check (rolling 24h per user)
SELECT COALESCE(SUM(total_tokens), 0) FROM llm_usage_logs
WHERE user_id = $1 AND used_at > now() - interval '24 hours';

-- Rate checks (per minute / hour / 24h)
SELECT COUNT(*) FROM llm_usage_logs
WHERE user_id = $1 AND used_at > now() - interval '1 minute';  -- quota_per_minute
WHERE user_id = $1 AND used_at > now() - interval '1 hour';    -- messages_per_hour
WHERE user_id = $1 AND used_at > now() - interval '24 hours';  -- chats_per_day
```

Upload count comes from `user_files`:

```sql
SELECT COUNT(*) FROM user_files
WHERE user_id = $1
  AND (is_folder IS NULL OR is_folder = false)
  AND created_at > now() - interval '24 hours';
```

**Every limit is a rolling window, not a calendar-day reset.**

---

## 8. Admin API — Plan Endpoints

Base URL: `POST /api/admin/plans` (super-admin-dev backend)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/plans` | List all plans with all limit columns |
| `GET` | `/api/admin/plans/:id` | Get single plan |
| `POST` | `/api/admin/plans` | Create plan (requires `chat_token_limit`, `summarization_token_limit`) |
| `PUT` | `/api/admin/plans/:id` | Update plan limits |
| `DELETE` | `/api/admin/plans/:id` | Delete plan |

**Minimal create body:**
```json
{
  "name": "Professional",
  "price": 999,
  "currency": "INR",
  "interval": "month",
  "chat_token_limit": 100000,
  "summarization_token_limit": 80000,
  "chat_messages_per_hour": 60,
  "chat_chats_per_day": 100,
  "chat_quota_per_minute": 10,
  "chat_max_document_pages": 300,
  "chat_max_document_size_mb": 40,
  "chat_max_file_upload_per_day": 20,
  "chat_max_upload_files": 10,
  "sum_messages_per_hour": 60,
  "sum_chats_per_day": 80,
  "sum_quota_per_minute": 10,
  "sum_max_document_pages": 400,
  "sum_max_document_size_mb": 40,
  "sum_max_file_upload_per_day": 15,
  "sum_max_upload_files": 10,
  "sum_max_context_documents": 8,
  "sum_max_conversation_history": 25
}
```

---

## 9. Environment Variables Checklist

In `jurinex-dev/Backend/ChatModel/.env`:

```env
DATABASE_URL="postgresql://...Document_DB"
PAYMENT_DB_URL="postgresql://...Payment_DB"    # ← add this
LLM_POLICY_LENIENT=false                        # set true to let requests through if DB check fails
```

---

## 10. Fallback Behaviour Summary

| Situation | Behaviour |
|---|---|
| User has no active subscription | Global `llm_chat_config` limits apply |
| Plan column is `NULL` | Global `llm_chat_config` value for that field |
| Both plan and global are `NULL` / `0` | **No limit** for that field |
| `PAYMENT_DB_URL` unreachable | `getUserActivePlan` returns `null` → global config used; request is allowed |
| `LLM_POLICY_LENIENT=true` | If usage DB is unreachable, all policy checks pass |
