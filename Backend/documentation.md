# Admin Dashboard API — Documentation

**Base URL:** `http://localhost:4000`

**Auth Header:** `Authorization: Bearer <ADMIN_TOKEN>`

> Set `ADMIN_TOKEN` in `.env`. All admin endpoints require a valid Bearer token (either the static `ADMIN_TOKEN` or a JWT from dashboard login).

---

## Route Prefixes

| Group | Base Path | DB Used |
|---|---|---|
| Citation Admin | `/api/citation-admin` | Citation DB + Auth DB |
| User Management | `/api/admin/users` | Auth DB |
| Auth | `/api/auth` | Auth DB |
| Plans | `/api/admin/plans` | Payment DB |
| Health Check | `/api/admin/health` | Main DB + Citation DB |

---

## A) Overview

### `GET /api/citation-admin/overview`

Dashboard summary stats.

> All day-based metrics (e.g., `today_citations_added`) are computed in IST (Asia/Kolkata).

**curl:**
```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/citation-admin/overview
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_judgments": 5200,
    "verified_judgments_count": 4100,
    "unverified_judgments_count": 1100,
    "avg_confidence_score": 0.7832,
    "hitl_pending_count": 42,
    "blacklist_count": 15,
    "today_citations_added": 23,
    "ingestion_status_counts": {
      "QUEUED": 50,
      "PROCESSING": 3,
      "DONE": 4900,
      "FAILED": 12
    },
    "confidence_distribution": {
      "0-0.4": 200,
      "0.4-0.7": 1500,
      "0.7-0.9": 2300,
      "0.9-1.0": 800
    }
  }
}
```

---

## B) HITL Queue

### `GET /api/citation-admin/hitl`

List pending tasks with pagination.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| status | string | — | Filter by status (PENDING, APPROVED, REJECTED, ESCALATED) |
| page | int | 1 | Page number |
| pageSize | int | 20 | Items per page (max 100) |
| sort | string | priority_desc | Sorting: priority_desc, created_at_desc, created_at_asc, priority_asc |

**curl:**
```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  "http://localhost:4000/api/citation-admin/hitl?status=PENDING&page=1&pageSize=20&sort=priority_desc"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "task_id": "550e8400-e29b-41d4-a716-446655440000",
        "citation_string": "AIR 2020 SC 1234",
        "canonical_id": "SC/2020/1234",
        "query_context": "search query text",
        "web_source_url": "https://...",
        "priority_score": 85,
        "status": "PENDING",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
  }
}
```

### `GET /api/citation-admin/hitl/:taskId`

Get task detail.

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/citation-admin/hitl/550e8400-e29b-41d4-a716-446655440000
```

### `POST /api/citation-admin/hitl/:taskId/action`

Process task action.

**Body:**
```json
{
  "action": "APPROVED",
  "reviewer": "admin@example.com",
  "notes": "Looks correct",
  "blacklist": false,
  "reason": ""
}
```

**curl:**
```bash
curl -X POST -H "Authorization: Bearer admin_secret_token_change_me" \
  -H "Content-Type: application/json" \
  -d '{"action":"REJECTED","reviewer":"admin","blacklist":true,"reason":"Invalid citation"}' \
  http://localhost:4000/api/citation-admin/hitl/550e8400-e29b-41d4-a716-446655440000/action
```

**Response:**
```json
{
  "success": true,
  "data": {
    "task": { "task_id": "550e8400-e29b-41d4-a716-446655440000", "status": "REJECTED", "..." : "..." },
    "blacklistEntry": { "blacklist_id": 5, "citation_string": "...", "reason": "Invalid citation" }
  }
}
```

> `blacklistEntry` is returned only when the request body includes `blacklist=true` and a blacklist record was created. Otherwise it will be `null`.

---

## C) Data Pipeline

### `GET /api/citation-admin/pipeline/summary`

Ingestion queue status counts.

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/citation-admin/pipeline/summary
```

**Response:**
```json
{ "success": true, "data": { "QUEUED": 50, "PROCESSING": 3, "DONE": 4900, "FAILED": 12 } }
```

### `GET /api/citation-admin/pipeline/items`

List ingestion items with filters.

**Query params:**
| Param | Type | Description |
|---|---|---|
| status | string | QUEUED, PROCESSING, DONE, FAILED |
| source | string | e.g. IKANOON |
| startDate | ISO date | Filter queued_at >= |
| endDate | ISO date | Filter queued_at <= |
| hasError | string | "true" or "false" |
| page | int | Page (default 1) |
| pageSize | int | Items per page (default 20) |

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  "http://localhost:4000/api/citation-admin/pipeline/items?status=FAILED&hasError=true&page=1&pageSize=10"
```

### `GET /api/citation-admin/pipeline/errors`

Recent errors.

| Param | Type | Default |
|---|---|---|
| limit | int | 50 |

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  "http://localhost:4000/api/citation-admin/pipeline/errors?limit=20"
```

---

## D) Routes & DB

### `GET /api/citation-admin/routesdb/summary`

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/citation-admin/routesdb/summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_judgments": 5200,
    "total_aliases": 8400,
    "total_statutes_rows": 12000,
    "verified_count": 4100,
    "unverified_count": 1100,
    "verification_status_breakdown": [
      { "status": "verified", "count": 4100 },
      { "status": "unverified", "count": 1100 }
    ]
  }
}
```

### `GET /api/citation-admin/routesdb/top-cited`

| Param | Type | Default |
|---|---|---|
| limit | int | 20 |

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  "http://localhost:4000/api/citation-admin/routesdb/top-cited?limit=10"
```

### `GET /api/citation-admin/routesdb/courts-breakdown`

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/citation-admin/routesdb/courts-breakdown
```

---

## E) Business Metrics

### `GET /api/citation-admin/business/summary`

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/citation-admin/business/summary
```

**Response:**
```json
{ "success": true, "data": { "total_reports": 350, "avg_citations_per_report": 12.5 } }
```

### `GET /api/citation-admin/business/reports-per-day`

| Param | Type | Default |
|---|---|---|
| days | int | 30 |

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  "http://localhost:4000/api/citation-admin/business/reports-per-day?days=7"
```

### `GET /api/citation-admin/business/top-users`

| Param | Type | Default |
|---|---|---|
| limit | int | 20 |

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  "http://localhost:4000/api/citation-admin/business/top-users?limit=10"
```

> Fields like `email` and `username` are enriched from Auth_DB. If the user profile is missing or lookup fails, these fields may be `null` while `user_id`, `total_reports`, and `total_citations` will still be returned.

**Response:**
```json
{
  "success": true,
  "data": [
    { "user_id": "33", "email": "user@example.com", "username": "testuser", "total_reports": 45, "total_citations": 540 }
  ]
}
```

---

## F) User Management

### `GET /api/admin/users`

List users with filters.

> The API normalizes `is_active` and `is_blocked` to boolean values (`true`/`false`) in responses.

**Query params:**
| Param | Type | Description |
|---|---|---|
| page | int | default 1 |
| pageSize | int | default 20, max 100 |
| role | string | Filter by role |
| approval_status | string | PENDING, APPROVED, etc. |
| account_type | string | FIRM_ADMIN, FIRM_USER, SOLO |
| search | string | Search email/username |

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  "http://localhost:4000/api/admin/users?page=1&pageSize=20&role=user&approval_status=PENDING"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "33",
        "email": "test@gmail.com",
        "username": "test",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 }
  }
}
```

### `GET /api/admin/users/pending`

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/admin/users/pending
```

### `GET /api/admin/users/stats`

```bash
curl -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/admin/users/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_users": 250,
    "active_users": 200,
    "blocked_users": 10,
    "pending_approvals": 15,
    "firm_admin_count": 30,
    "firm_user_count": 120,
    "solo_users": 100
  }
}
```

### `POST /api/admin/users/:id/approve`

```bash
curl -X POST -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/admin/users/33/approve
```

### `POST /api/admin/users/:id/block`

```bash
curl -X POST -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/admin/users/33/block
```

### `POST /api/admin/users/:id/unblock`

```bash
curl -X POST -H "Authorization: Bearer admin_secret_token_change_me" \
  http://localhost:4000/api/admin/users/33/unblock
```

---

## G) Health Check

### `GET /api/admin/health`

Check database connectivity (no auth required).

```bash
curl http://localhost:4000/api/admin/health
```

**Response (all healthy):**
```json
{ "success": true, "databases": { "authDB": "ok", "citationDB": "ok" } }
```

**Response (partial failure):**
```json
{ "success": false, "databases": { "authDB": "ok", "citationDB": "error: connect ECONNREFUSED" } }
```

---

## Error Responses

All errors return:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": ["\"action\" must be one of [APPROVED, REJECTED, ESCALATED]"]
  },
  "requestId": "uuid-string"
}
```

| HTTP Code | Code | When |
|---|---|---|
| 400 | VALIDATION_ERROR | Bad query params or body |
| 401 | UNAUTHORIZED | Missing auth header |
| 403 | FORBIDDEN | Invalid token |
| 404 | NOT_FOUND | Resource not found |
| 500 | INTERNAL_ERROR | Server error |

---

## Postman Testing Checklist

1. **Set environment variable** `baseUrl` = `http://localhost:4000`
2. **Set header** `Authorization: Bearer admin_secret_token_change_me` in collection auth
3. **Test each endpoint:**
   - [ ] `GET {{baseUrl}}/api/citation-admin/overview` — expect 200 with stats
   - [ ] `GET {{baseUrl}}/api/citation-admin/hitl?status=PENDING` — expect paginated tasks
   - [ ] `GET {{baseUrl}}/api/citation-admin/hitl/550e8400-e29b-41d4-a716-446655440000` — expect task or 404
   - [ ] `POST {{baseUrl}}/api/citation-admin/hitl/550e8400-e29b-41d4-a716-446655440000/action` with body `{"action":"APPROVED"}` — expect 200
   - [ ] `POST {{baseUrl}}/api/citation-admin/hitl/550e8400-e29b-41d4-a716-446655440000/action` with body `{"action":"INVALID"}` — expect 400
   - [ ] `GET {{baseUrl}}/api/citation-admin/pipeline/summary` — expect status counts
   - [ ] `GET {{baseUrl}}/api/citation-admin/pipeline/items?status=FAILED` — expect list
   - [ ] `GET {{baseUrl}}/api/citation-admin/pipeline/errors` — expect error list
   - [ ] `GET {{baseUrl}}/api/citation-admin/routesdb/summary` — expect counts
   - [ ] `GET {{baseUrl}}/api/citation-admin/routesdb/top-cited?limit=5` — expect list
   - [ ] `GET {{baseUrl}}/api/citation-admin/routesdb/courts-breakdown` — expect breakdown
   - [ ] `GET {{baseUrl}}/api/citation-admin/business/summary` — expect report stats
   - [ ] `GET {{baseUrl}}/api/citation-admin/business/reports-per-day?days=7` — expect daily data
   - [ ] `GET {{baseUrl}}/api/citation-admin/business/top-users?limit=5` — expect enriched users
   - [ ] `GET {{baseUrl}}/api/admin/users?page=1&pageSize=5` — expect user list
   - [ ] `GET {{baseUrl}}/api/admin/users/pending` — expect pending users
   - [ ] `GET {{baseUrl}}/api/admin/users/stats` — expect user stats
   - [ ] `POST {{baseUrl}}/api/admin/users/1/approve` — expect 200 or 404
   - [ ] `POST {{baseUrl}}/api/admin/users/1/block` — expect 200 or 404
   - [ ] `POST {{baseUrl}}/api/admin/users/1/unblock` — expect 200 or 404
   - [ ] `GET {{baseUrl}}/api/admin/health` — expect 200 with DB status
4. **Test without auth header** → expect 401
5. **Test with wrong token** → expect 403

---

## Database Index Suggestions (Optional)

For optimal query performance on the citation_db:

```sql
-- HITL queue
CREATE INDEX IF NOT EXISTS idx_hitl_status ON hitl_queue(status);
CREATE INDEX IF NOT EXISTS idx_hitl_priority ON hitl_queue(priority_score DESC, created_at DESC);

-- Ingestion queue
CREATE INDEX IF NOT EXISTS idx_ingestion_status ON ingestion_queue(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_queued_at ON ingestion_queue(queued_at DESC);

-- Judgments
CREATE INDEX IF NOT EXISTS idx_judgments_verification ON judgments(verification_status);
CREATE INDEX IF NOT EXISTS idx_judgments_citation_freq ON judgments(citation_frequency DESC);
CREATE INDEX IF NOT EXISTS idx_judgments_ingested_at ON judgments(ingested_at);
CREATE INDEX IF NOT EXISTS idx_judgments_court ON judgments(court_tier, court_code);

-- Citation reports
CREATE INDEX IF NOT EXISTS idx_reports_created ON citation_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_user ON citation_reports(user_id);
```
