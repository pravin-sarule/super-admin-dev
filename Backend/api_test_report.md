# Admin Dashboard API — Test Report

**Generated:** 2026-03-05T05:19:33.226Z  
**Base URL:** `http://localhost:4000`  
**Admin Token:** `[REDACTED]`  

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 21 |
| ✅ Passed | 21 |
| ❌ Failed | 0 |
| Avg Latency | 16ms |

### All Tests

| # | Method | Endpoint | Expected | Actual | Result | Latency |
|---|--------|----------|----------|--------|--------|--------|
| 1 | GET | `/api/admin/overview` | 200 + { success: true, data: { total_judgments, ... } } | 200 | ✅ PASS | 63ms |
| 2 | GET | `/api/admin/hitl` | 200 + data.tasks array | 200 | ✅ PASS | 23ms |
| 3 | GET | `/api/admin/hitl/00000000-0000-0000-0000-000000000000` | 404 | 404 | ✅ PASS | 14ms |
| 4 | POST | `/api/admin/hitl/1/action` | 400 | 400 | ✅ PASS | 4ms |
| 5 | GET | `/api/admin/pipeline/summary` | 200 + object | 200 | ✅ PASS | 14ms |
| 6 | GET | `/api/admin/pipeline/items` | 200 + paginated list | 200 | ✅ PASS | 23ms |
| 7 | GET | `/api/admin/pipeline/errors` | 200 | 200 | ✅ PASS | 13ms |
| 8 | GET | `/api/admin/routesdb/summary` | 200 | 200 | ✅ PASS | 15ms |
| 9 | GET | `/api/admin/routesdb/top-cited` | 200 + array | 200 | ✅ PASS | 13ms |
| 10 | GET | `/api/admin/routesdb/courts-breakdown` | 200 | 200 | ✅ PASS | 12ms |
| 11 | GET | `/api/admin/business/summary` | 200 | 200 | ✅ PASS | 11ms |
| 12 | GET | `/api/admin/business/reports-per-day` | 200 + array | 200 | ✅ PASS | 13ms |
| 13 | GET | `/api/admin/business/top-users` | 200 + array | 200 | ✅ PASS | 22ms |
| 14 | GET | `/api/admin/users` | 200 + data.users array | 200 | ✅ PASS | 28ms |
| 15 | GET | `/api/admin/users/pending` | 200 | 200 | ✅ PASS | 14ms |
| 16 | GET | `/api/admin/users/stats` | 200 | 200 | ✅ PASS | 13ms |
| 17 | POST | `/api/admin/users/36/approve` | 200 | 200 | ✅ PASS | 14ms |
| 18 | POST | `/api/admin/users/36/block` | 200 | 200 | ✅ PASS | 15ms |
| 19 | POST | `/api/admin/users/36/unblock` | 200 | 200 | ✅ PASS | 14ms |
| 20 | GET | `/api/admin/overview` | 401 | 401 | ✅ PASS | 3ms |
| 21 | GET | `/api/admin/overview` | 403 | 403 | ✅ PASS | 2ms |

---

## Overview

### Overview

**Purpose:** Dashboard summary: total judgments, verified/unverified counts, confidence distribution, HITL pending, blacklist count, ingestion status, today citations.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/overview"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `63ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "total_judgments": 5,
    "verified_judgments_count": 0,
    "unverified_judgments_count": 5,
    "avg_confidence_score": 0.8,
    "hitl_pending_count": 0,
    "blacklist_count": 0,
    "today_citations_added": 4,
    "ingestion_status_counts": {},
    "confidence_distribution": {
      "0-0.4": 0,
      "0.4-0.7": 0,
      "0.7-0.9": 4,
      "0.9-1.0": 0
    }
  }
}
```
</details>

---

## HITL Queue

### HITL List

**Purpose:** List HITL pending tasks with pagination, sortable by priority.

**Inputs:** Query: status, page, pageSize, sort

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/hitl?status=PENDING&page=1&pageSize=5&sort=priority_desc"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `23ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "tasks": [],
    "pagination": {
      "page": 1,
      "pageSize": 5,
      "total": 0,
      "totalPages": 0
    }
  }
}
```
</details>

### HITL Detail

**Purpose:** Get single HITL task detail by ID.

**Inputs:** Params: taskId

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/hitl/00000000-0000-0000-0000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `14ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "HITL task 00000000-0000-0000-0000-000000000000 not found",
    "details": null
  },
  "requestId": "b74c096f-4cf7-469c-8681-8675db5a3135"
}
```
</details>

### HITL Action (INVALID — expect 400)

**Purpose:** Validate action body — invalid action should return 400.

**Inputs:** Body: { action: "INVALID" }

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/hitl/1/action" -H "Content-Type: application/json" -d '{"action":"INVALID"}'
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `4ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      "\"action\" must be one of [APPROVED, REJECTED, ESCALATED]"
    ]
  },
  "requestId": "4e844de6-10b4-4e7a-b22a-d26e1af21951"
}
```
</details>

---

## Data Pipeline

### Pipeline Summary

**Purpose:** Ingestion queue status counts grouped by status.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/pipeline/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `14ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {}
}
```
</details>

### Pipeline Items

**Purpose:** List ingestion queue items with filters: status, source, date range, hasError.

**Inputs:** Query: status, hasError, page, pageSize

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/pipeline/items?status=FAILED&hasError=true&page=1&pageSize=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `23ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 5,
      "total": 0,
      "totalPages": 0
    }
  }
}
```
</details>

### Pipeline Errors

**Purpose:** Recent ingestion errors.

**Inputs:** Query: limit

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/pipeline/errors?limit=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `13ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": []
}
```
</details>

---

## Routes & DB

### RoutesDB Summary

**Purpose:** Total judgments, aliases, statutes, verification breakdown.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/routesdb/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `15ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "total_judgments": 5,
    "total_aliases": 2,
    "total_statutes_rows": 0,
    "verified_count": 0,
    "unverified_count": 5,
    "verification_status_breakdown": [
      {
        "status": "VERIFIED_WARN",
        "count": 4
      },
      {
        "status": "pending",
        "count": 1
      }
    ]
  }
}
```
</details>

### RoutesDB Top Cited

**Purpose:** Top judgments by citation_frequency.

**Inputs:** Query: limit

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/routesdb/top-cited?limit=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `13ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": [
    {
      "judgment_uuid": "5bb96f20-0a5e-4c37-82c3-708bc5e19c88",
      "canonical_id": "9f1ee07f1a48165b",
      "citation_frequency": 0,
      "court_code": "Supreme Court",
      "court_tier": null,
      "verification_status": "pending"
    },
    {
      "judgment_uuid": "b6bc8cce-e1e6-4679-8a74-44db814f41f5",
      "canonical_id": "4b05aa19d01b70bf",
      "citation_frequency": 0,
      "court_code": "SC",
      "court_tier": null,
      "verification_status": "VERIFIED_WARN"
    },
    {
      "judgment_uuid": "dafc9fd0-3e94-42ae-8ee3-8332c685ff5d",
      "canonical_id": "ec94b246e66f4759",
      "citation_frequency": 0,
      "court_code": "SC",
      "court_tier": null,
      "verification_status": "VERIFIED_WARN"
    },
    {
      "judgment_uuid": "db9ff3ab-8417-483e-b2be-2e7a617b71eb",
      "canonical_id": "661d7fa345480026",
      "citation_frequency": 0,
      "court_code": "SC",
      "court_tier": null,
      "verification_status": "VERIFIED_WARN"
    },
    {
      "judgment_uuid": "a6b0e013-5f46-4027-a37a-0a9747a69aac",
      "canonical_id": "2c19ee0a54edc470",
      "citation_frequency": 0,
      "court_code": "Indian Kanoon",
      "court_tier": null,
      "verification_status": "VERIFIED_WARN"
    }
  ]
}
```
</details>

### RoutesDB Courts Breakdown

**Purpose:** Court distribution grouped by court_tier and court_code.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/routesdb/courts-breakdown"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `12ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": [
    {
      "court_tier": "unknown",
      "court_code": "SC",
      "count": 3
    },
    {
      "court_tier": "unknown",
      "court_code": "Supreme Court",
      "count": 1
    },
    {
      "court_tier": "unknown",
      "court_code": "Indian Kanoon",
      "count": 1
    }
  ]
}
```
</details>

---

## Business Metrics

### Business Summary

**Purpose:** Total reports count and average citations per report.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/business/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `11ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "total_reports": 8,
    "avg_citations_per_report": "7.25"
  }
}
```
</details>

### Business Reports/Day

**Purpose:** Reports count per day for the last N days.

**Inputs:** Query: days

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/business/reports-per-day?days=7"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `13ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-03-04T18:30:00.000Z",
      "report_count": 5
    },
    {
      "date": "2026-03-03T18:30:00.000Z",
      "report_count": 3
    }
  ]
}
```
</details>

### Business Top Users

**Purpose:** Top users by report count, enriched with email/username from Auth DB.

**Inputs:** Query: limit

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/business/top-users?limit=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `22ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": [
    {
      "user_id": "anonymous",
      "total_reports": 8,
      "total_citations": 58,
      "email": null,
      "username": null
    }
  ]
}
```
</details>

> ⚠️ **Note:** Note: email/username not enriched (Auth DB join may have no matching users).

---

## User Management

### Users List

**Purpose:** List users with pagination, filterable by role, approval_status, account_type, search.

**Inputs:** Query: page, pageSize, role, approval_status, account_type, search

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/users?page=1&pageSize=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `28ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 40,
        "email": "test_1770093227@example.com",
        "username": "Test User",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "SOLO",
        "is_active": true,
        "created_at": "2026-02-02T23:03:47.280Z",
        "phone": null,
        "location": null
      },
      {
        "id": 39,
        "email": "test_1770092820@example.com",
        "username": "Test User",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "SOLO",
        "is_active": true,
        "created_at": "2026-02-02T22:57:00.143Z",
        "phone": null,
        "location": null
      },
      {
        "id": 38,
        "email": "demo@nexintelai.com",
        "username": "Demo Jurinex",
        "role": "user",
        "auth_type": "google",
        "profile_image": "https://lh3.googleusercontent.com/a/ACg8ocJU2oYxzKfI6D9muD2wlktZdum5-GIRYZFxIupo8MLgCdjPjg=s96-c",
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": null,
        "is_active": true,
        "created_at": "2026-02-02T04:13:18.500Z",
        "phone": null,
        "location": null
      },
      {
        "id": 37,
        "email": "test15@gmail.com",
        "username": "test",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "FIRM_ADMIN",
        "is_active": true,
        "created_at": "2026-01-19T00:46:11.783Z",
        "phone": "1475683596",
        "location": "test, test"
      },
      {
        "id": 36,
        "email": "test14@gmail.com",
        "username": "test",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": 
... (truncated)
```
</details>

### Users Pending

**Purpose:** List users with approval_status=PENDING.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/users/pending"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `14ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 36,
        "email": "test14@gmail.com",
        "username": "test",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-01-19T00:45:03.546Z",
        "phone": "1475683596",
        "location": "test, test"
      },
      {
        "id": 35,
        "email": "test1@gmail.com",
        "username": "test",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-01-19T00:43:26.676Z",
        "phone": "1475683596",
        "location": "test, test"
      },
      {
        "id": 34,
        "email": "test12@gmail.com",
        "username": "test",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-01-19T00:42:39.279Z",
        "phone": "1475683596",
        "location": "test, test"
      },
      {
        "id": 33,
        "email": "test@gmail.com",
        "username": "test",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-01-19T00:41:24.466Z",
        "phone": "1475683596",
        "location": "test, test"
      },
      {
        "id": 14,
        "email": "dalalrutuja2004@gmail.com",
        "username": "Dalal Rutuja",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-01-06T23:15:51.722Z",
        "phone": "9503808108",
        "location": "Aurangabad, Maharashtra"
      },
      {
        "id": 12,
        "email": "rutuja@gmail.com",
        "username": "Rutuja",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-01-06T05:30:18
... (truncated)
```
</details>

### Users Stats

**Purpose:** User statistics: total, active, blocked, pending, by account type.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/users/stats"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `13ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "total_users": 28,
    "active_users": 20,
    "blocked_users": 0,
    "pending_approvals": 8,
    "firm_admin_count": 9,
    "firm_user_count": 7,
    "solo_users": 6
  }
}
```
</details>

### User Approve

**Purpose:** Approve a user: sets approval_status=APPROVED, is_active=true.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/users/36/approve"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `14ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 36,
      "email": "test14@gmail.com",
      "username": "test",
      "password": "$2b$10$NRSAC4bXOYwt58TQhSUdb.enUcMlEr6inu/QEAj5GQ2.t0zpLZuTC",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-01-19T00:45:03.546Z",
      "updated_at": "2026-01-19T00:45:03.546Z",
      "razorpay_customer_id": null,
      "phone": "1475683596",
      "location": "test, test",
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "FIRM_ADMIN",
      "approval_status": "APPROVED",
      "first_login": true,
      "is_active": true
    },
    "message": "User approved successfully"
  }
}
```
</details>

### User Block

**Purpose:** Block a user: sets is_blocked=true, is_active=false.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/users/36/block"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `15ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 36,
      "email": "test14@gmail.com",
      "username": "test",
      "password": "$2b$10$NRSAC4bXOYwt58TQhSUdb.enUcMlEr6inu/QEAj5GQ2.t0zpLZuTC",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": true,
      "created_at": "2026-01-19T00:45:03.546Z",
      "updated_at": "2026-01-19T00:45:03.546Z",
      "razorpay_customer_id": null,
      "phone": "1475683596",
      "location": "test, test",
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "FIRM_ADMIN",
      "approval_status": "APPROVED",
      "first_login": true,
      "is_active": false
    },
    "message": "User blocked successfully"
  }
}
```
</details>

### User Unblock

**Purpose:** Unblock a user: sets is_blocked=false, is_active=true.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4000/api/admin/users/36/unblock"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `14ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 36,
      "email": "test14@gmail.com",
      "username": "test",
      "password": "$2b$10$NRSAC4bXOYwt58TQhSUdb.enUcMlEr6inu/QEAj5GQ2.t0zpLZuTC",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-01-19T00:45:03.546Z",
      "updated_at": "2026-01-19T00:45:03.546Z",
      "razorpay_customer_id": null,
      "phone": "1475683596",
      "location": "test, test",
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "FIRM_ADMIN",
      "approval_status": "APPROVED",
      "first_login": true,
      "is_active": true
    },
    "message": "User unblocked successfully"
  }
}
```
</details>

---

## Auth Negative

### No Auth Header

**Purpose:** Verify that missing Authorization header returns 401.

**Inputs:** No Authorization header

**Example curl:**
```bash
curl -s "http://localhost:4000/api/admin/overview"
```

**Test Result:** ✅ PASS — Status: `401` — Latency: `3ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authorization header required: Bearer <token>"
  },
  "requestId": "ddf6b7f3-02b7-4b26-b162-8e68f7efc1f3"
}
```
</details>

### Wrong Token

**Purpose:** Verify that wrong Bearer token returns 403.

**Inputs:** Authorization: Bearer wrong_token

**Example curl:**
```bash
curl -s -H "Authorization: Bearer wrong_token" "http://localhost:4000/api/admin/overview"
```

**Test Result:** ✅ PASS — Status: `403` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Invalid admin token"
  },
  "requestId": "1c7cf8c5-9002-4062-a247-7d06628dfb0d"
}
```
</details>

---

*End of report.*
