# Judgement Service — Simple Guide

This file explains **what the service does**, **where data lives**, and **how it moves**.

Read this first. For table-by-table mapping of admin PDF uploads, see `database_storing.md`.

---

## What is this?

`judgement-service` stores and searches legal judgments.

It runs on port **8095**. Super Admin talks to it from:

```
http://localhost:3001/dashboard/judgements
```

There are **two workspaces** on that page:

| Button | What you see |
|---|---|
| **User Pipeline** (default) | Judgments fetched from Indian Kanoon when a user search missed locally |
| **Admin Uploads** | PDFs uploaded by Super Admin, then OCR'd and indexed |

Sidebar **Judgement Upload** opens **User Pipeline** first.

---

## Big picture

Think of four boxes. Each box has one job.

```
  ┌─────────────┐     ┌───────────────┐     ┌────────────────┐     ┌────────────┐
  │ PostgreSQL  │     │ Google Cloud  │     │ Elasticsearch  │     │   Qdrant   │
  │             │     │    Storage    │     │                │     │            │
  │ Who / what  │     │ Files (PDFs)  │     │ Find by words  │     │ Find by    │
  │ is this     │     │ OCR JSON      │     │ (full text)    │     │ meaning    │
  │ case?       │     │               │     │                │     │ (vectors)  │
  └─────────────┘     └───────────────┘     └────────────────┘     └────────────┘
         │                    │                     │                     │
         └────────────────────┴─────────────────────┴─────────────────────┘
                                      │
                         judgement-service :8095
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
            Super Admin UI                      User citation search
            (localhost:3001)                    (app / judment-api)
```

| Store | Plain English |
|---|---|
| **PostgreSQL** | The notebook. Names, dates, status, pages, chunks. |
| **GCS** | The filing cabinet. Actual PDF files. |
| **Elasticsearch** | The word index. “Find this phrase.” |
| **Qdrant** | The meaning index. “Find similar ideas.” |

Indian Kanoon and Document AI are **sources**, not stores. We fetch from them, then write into the boxes above.

---

## How the Super Admin page is laid out

```
┌─ Judgment Dashboards ─────────────────────────────────────────┐
│  [ User Pipeline ]  [ Admin Uploads ]                         │
└───────────────────────────────────────────────────────────────┘

  User Pipeline (default)                 Admin Uploads
  ─────────────────────                   ─────────────
  Pipeline summary                        Choose PDFs + upload
  Metric cards                            Status cards
  Inserted Judgments table                Pipeline Monitor
       │                                       │
       │ Inspect                               │ Inspect
       ▼                                       ▼
  Header + Back (black)                   Document inspect
  Document Workspace                      Pages / OCR / chunks
  Full Document (HTML/text)               Vectors / aliases
  Document Overview
```

User Pipeline inspect does **not** show Aliases or Vector Preview. Those belong to Admin Uploads.

---

## Two pipelines

### 1) User Pipeline — “we don’t have this citation, fetch it”

When a lawyer searches a citation and we do **not** have it locally, the product fetches it from Indian Kanoon and keeps a raw copy.

```
  Lawyer / user
       │
       │  "find this citation"
       ▼
  ┌─────────────────────────┐
  │ Look locally first      │
  │  Postgres               │
  │  ES index `judgments`   │
  │  Qdrant chunks          │
  └───────────┬─────────────┘
              │
         found? ──yes──► return local judgment
              │
              no
              ▼
  ┌─────────────────────────┐
  │ Indian Kanoon           │
  │ fetch by citation / tid │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────────────────────┐
  │ Elasticsearch index  ik_judgments       │
  │                                         │
  │  _id          = IK tid  (e.g. 134606517)│
  │  title        = case name               │
  │  text         = plain judgment text     │
  │  doc          = original HTML           │
  │  docsource    = court                   │
  │  publishdate  = judgment date           │
  └─────────────────────────────────────────┘
              │
              ▼
  Super Admin → User Pipeline
  lists and inspects THIS index only
```

**Important:** many of these copies live **only** in `ik_judgments`. Postgres can still show **0**. That is normal today.

```
  User Pipeline UI
       │
       ├── summary cards  ──► count docs in ik_judgments
       ├── table          ──► search + paginate ik_judgments
       └── inspect        ──► one doc: metadata + HTML/text
```

Qdrant is **not** required to list or inspect User Pipeline docs. If Qdrant is down, the table still works. Semantic search elsewhere will be weak.

---

### 2) Admin Uploads — “we uploaded a PDF”

Super Admin drops in a PDF. The service splits it, OCRs it if needed, then writes to **all four stores**.

```
  Super Admin
  "Choose PDFs" → Upload Judgments
       │
       ▼
  ┌──────────────┐
  │  Postgres    │  create upload row (status = uploaded / processing)
  │  judgment_   │
  │  uploads     │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  GCS         │  judgements/original/<document_id>/file.pdf
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  Split PDF   │  one file per page
  │  → GCS       │  judgements/pages/<document_id>/page-0001.pdf
  └──────┬───────┘
         │
         ├── digital text? ──yes──► use embedded text
         │
         └── scanned? ──no text──► Document AI OCR
                                      │
                                      ▼
                                 GCS ocr-raw JSON
                                      │
                                      ▼
                                 merge page text
         │
         ▼
  ┌──────────────────────────────────────────┐
  │ PostgreSQL                               │
  │   judgments          (the case)          │
  │   judgment_uploads   (this PDF)          │
  │   judgment_pages     (each page)         │
  │   judgment_chunks    (text slices)       │
  │   citation_aliases   (other citations)   │
  └──────────────────┬───────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
  ┌─────────────────┐   ┌──────────────────────┐
  │ Elasticsearch   │   │ Qdrant               │
  │ index           │   │ collection           │
  │ `judgments`     │   │ `legal_embeddings_v2`│
  │                 │   │                      │
  │ id = canonical_ │   │ point id = chunk_id  │
  │      id         │   │ vector = 768-d       │
  │ full_text =     │   │ payload = case meta  │
  │   whole case    │   │   + chunk text       │
  └─────────────────┘   └──────────────────────┘
```

**UI:** Judgment Dashboards → **Admin Uploads**.

Reads Postgres first, then GCS / ES / Qdrant for previews.

---

## Elasticsearch — two indexes (easy mix-up)

```
  Elasticsearch cluster
  │
  ├── judgments            ← processed cases (admin PDF + some IK ingest)
  │     id     = canonical_id
  │     used by  Admin search, hybrid search
  │
  └── ik_judgments         ← raw Indian Kanoon fallback copies
        id     = tid  (Indian Kanoon number)
        used by  User Pipeline table + inspect
```

Same cluster. **Different indexes. Different ids.** Do not look for a User Pipeline row in `judgments` if it was only written to `ik_judgments`.

---

## Identity keys (how one case is named)

```
  One uploaded PDF
       │
       ├── document_id      UUID of this file
       │
       └── judgment_uuid    UUID of the logical case in Postgres
                │
                ├── canonical_id     human-ish slug
                │                    <case>-<court>-<year>-<hash>
                │
                ├── es_doc_id        usually = canonical_id
                │                    on index `judgments`
                │
                └── chunk_id         UUID per text slice
                                     also Qdrant point id

  One Indian Kanoon fallback copy
       │
       └── tid              Indian Kanoon number (e.g. 134606517)
                            also Elasticsearch _id on `ik_judgments`
```

---

## Search data flow (Judgement Search / judment-api)

Users search by **meaning** (Qdrant) and by **words** (Elasticsearch `judgments`). Results are then filled with names and dates from Postgres.

```
  Query: "demolition of the building"
       │
       ├──────────────────────┐
       ▼                      ▼
  Qdrant                  Elasticsearch
  legal_embeddings_v2     index `judgments`
  similar chunks          phrase / keyword hits
       │                      │
       └──────────┬───────────┘
                  ▼
           Merge + rank
                  │
                  ▼
           Postgres lookup
           (case name, court, date)
                  │
                  ▼
           Search results
```

`ik_judgments` is **not** the main hybrid-search index. It is the fallback archive listed in User Pipeline.

---

## What each screen reads

```
  Super Admin
       │
       ├── User Pipeline
       │      summary + table + inspect  ──►  ES  ik_judgments
       │      store chips PG / ES / Qdrant are health + counts
       │
       ├── Admin Uploads
       │      list / status              ──►  Postgres judgment_uploads
       │      inspect pages              ──►  GCS + Postgres pages
       │      inspect text / search      ──►  ES judgments
       │      inspect vectors            ──►  Qdrant
       │
       └── Judgement Search
              semantic                   ──►  Qdrant
              full text                  ──►  ES judgments
              extra fields               ──►  Postgres
```

| Screen | Main store | Notes |
|---|---|---|
| User Pipeline table | `ik_judgments` | Paginated (10 / 25 / 50 / 100) |
| User Pipeline inspect | `ik_judgments` | Metadata + full HTML/`text` |
| Admin Uploads | Postgres | Plus GCS, ES, Qdrant |
| Hybrid search | Qdrant + ES `judgments` | Postgres enriches the hit |

---

## Postgres tables (admin pipeline)

```
  judgments ─────────── 1 case
       │
       ├── judgment_uploads     1 row per PDF
       ├── judgment_pages       1 row per page
       ├── judgment_chunks      1 row per text slice
       └── citation_aliases     other ways to cite the case

  Also: judgment_api_analytics, judges, statutes_cited
```

`source_type` on `judgments`:

| Value | Meaning |
|---|---|
| `admin-upload` | Super Admin PDF |
| `indian_kanoon` | IK ingest into the main `judgments` index |
| `ik_pipeline` | User fallback (SQL row may be missing; copy may live only in `ik_judgments`) |

Postgres does **not** store PDF bytes, embedding vectors, or the User Pipeline HTML archive.

---

## GCS folders (admin pipeline)

```
  bucket (GCS_BUCKET_NAME)
  └── judgements/
        ├── original/<document_id>/....pdf
        ├── pages/<document_id>/page-0001.pdf
        └── ocr-raw/<document_id>/batch-001.json
```

SQL only keeps the **path**, not the file.

---

## Qdrant

```
  collection: legal_embeddings_v2
  vector size: 768
  distance: cosine
  point id: chunk_id

  payload: judgment_uuid, canonical_id, case_name,
           chunk_text, court, year, source_type
```

If Qdrant returns **404**, the cluster URL is wrong or the service is down. User Pipeline listing still works. **Qdrant Points** stays 0.

---

## End-to-end map (one glance)

```
                         SOURCES
              ┌────────────┴────────────┐
              │                         │
        Admin PDF                 Indian Kanoon
              │                         │
              ▼                         ▼
        split + OCR               raw HTML + text
              │                         │
              ▼                         ▼
     ┌────────────────┐        ┌─────────────────┐
     │ Postgres       │        │ ES ik_judgments │
     │ GCS            │        │ (User Pipeline) │
     │ ES judgments   │        └─────────────────┘
     │ Qdrant         │
     └───────┬────────┘
             │
             ▼
      Hybrid search  (ES judgments + Qdrant)
```

---

## Local ports

| App | Port | URL |
|---|---|---|
| Super Admin UI | 3001 | `http://localhost:3001` |
| Admin backend | 4000 | proxies `/api/judgements-admin` |
| judgement-service | 8095 | `http://localhost:8095` |

Use the **same** `JWT_SECRET` in Admin backend and judgement-service, or Judgement Upload will bounce to login.

Do not commit `.env`. Passwords and API keys stay there.

---

## Code map

| File | Job |
|---|---|
| `db/initSchema.js` | Create Postgres tables |
| `services/processingService.js` | Admin PDF pipeline writes |
| `services/elasticsearchService.js` | `judgments` + `ik_judgments` |
| `services/qdrantService.js` | `legal_embeddings_v2` |
| `services/pipelineReportService.js` | User Pipeline report (reads `ik_judgments`) |
| `judment_api/` | External search API |
| `database_storing.md` | Detailed admin-upload field mapping |

Frontend (Super Admin):

| File | Job |
|---|---|
| `Frontend/.../JudgementManagement.jsx` | Toggle; default = User Pipeline |
| `Frontend/.../judgement-pipeline-report/` | User Pipeline UI |
| `Frontend/.../judgement-service/` | Admin Uploads UI |
