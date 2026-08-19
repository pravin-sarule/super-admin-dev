# Judgement Service — Databases, Collections, and Data Flow

This document describes every store used by `judgement-service`: **why it exists**, **what is written**, **what is fetched**, and **which collections / indices / tables** hold the data.

The service runs on port `8095` by default and is used by:

- **Admin Uploads** (`/dashboard/judgements`) — PDF upload and processing pipeline
- **User Pipeline** (`/dashboard/judgements?view=ik_pipeline`) — Indian Kanoon fallback copies
- **Judgement Search** — hybrid semantic + full-text search

---

## 1. Store map

| Store | Role | Why we use it | Config |
|---|---|---|---|
| **PostgreSQL** (`citationTest`) | Relational source of truth | Identity, pipeline status, pages, chunks, aliases, analytics | `CITATION_DB_URL` |
| **Google Cloud Storage** | File artifacts | PDFs, split pages, OCR JSON are too large for SQL | `GCS_BUCKET_NAME` (default `draft_templates`) |
| **Elasticsearch** | Keyword / phrase search | Fast full-text search and User Pipeline listing | `ELASTIC_URL` |
| **Qdrant** | Vector search | Semantic chunk retrieval for hybrid search | `QDRANT_URL`, `QDRANT_COLLECTION` |
| **Document AI** | OCR (not a database) | Extract text from scanned PDF pages | `DOCUMENT_AI_*` |
| **Neo4j** | Graph (disabled locally) | Citation graph; currently skipped | `JUDGEMENT_DISABLE_NEO4J=true` |

PostgreSQL is the **anchor** for admin uploads. Elasticsearch and Qdrant are **search indexes** built from that pipeline.

The **User Pipeline** (citation fallback) currently lists and inspects documents from Elasticsearch index **`ik_judgments`**. Those copies often exist in Elasticsearch even when they are not yet in PostgreSQL.

---

## 2. Identity keys

| Key | Meaning | Typical type |
|---|---|---|
| `document_id` | One uploaded file | UUID |
| `judgment_uuid` | One logical judgment in PostgreSQL | UUID |
| `canonical_id` | Stable business id for a case | string, unique in `judgments` |
| `tid` | Indian Kanoon document id | numeric string (`104418353`) |
| `chunk_id` | One text chunk; also Qdrant point id | UUID |
| `es_doc_id` | Elasticsearch document id | usually `canonical_id` on `judgments`; `tid` on `ik_judgments` |

`canonical_id` is generated in `services/metadataService.js` as:

```text
<case-name-slug>-<court-code>-<year>-<10-char-hash>
```

---

## 3. PostgreSQL

**Database:** `citationTest` (from `CITATION_DB_URL`)

**Why:** store structured metadata, processing state, and joins that search indexes cannot own. Admin Uploads, pipeline status, and search enrichment all read PostgreSQL.

### 3.1 Tables

| Table | Stores | Fetched for |
|---|---|---|
| `judgments` | One row per logical case: name, court, date, `source_type`, `es_doc_id`, `qdrant_collection` | Admin metadata, search enrichment, pipeline reports that still use SQL |
| `judgment_uploads` | One row per uploaded PDF: status, GCS paths, merged text, admin user, errors | Admin Uploads dashboard, reprocess, inspect |
| `judgment_pages` | Per-page type, OCR text, GCS page/OCR URIs | Page preview, OCR layout |
| `judgment_chunks` | Chunk text, offsets, embedding status, `qdrant_point_id` | Chunk preview, vector inspect |
| `citation_aliases` | Alternate citation strings for a judgment | Search alias matching |
| `judgment_api_analytics` | Search API timings and result counts | Judgement Search analytics |
| `judges` / `judgment_judges` | Judge names linked to a judgment | Future structured extraction |
| `statutes_cited` | Act / section citations | Future structured extraction |

### 3.2 `source_type` values in `judgments`

| Value | Meaning |
|---|---|
| `admin-upload` | Uploaded from Super Admin → Judgement Upload |
| `indian_kanoon` | Fetched / ingested from Indian Kanoon into the `judgments` ES index |
| `ik_pipeline` | User citation fallback (intended SQL row; many fallback docs live only in `ik_judgments`) |

### 3.3 What PostgreSQL does **not** store

- Original PDF bytes (GCS)
- Chunk embedding vectors (Qdrant)
- Full-text search inverted index (Elasticsearch)
- Raw Indian Kanoon HTML for the User Pipeline list (`ik_judgments`)

---

## 4. Google Cloud Storage

**Bucket:** `GCS_BUCKET_NAME` (local config uses `draft_templates`)

**Why:** binary files and bulky OCR JSON must not live in Postgres.

| Path | Stores | Fetched for |
|---|---|---|
| `judgements/original/<document_id>/...pdf` | Original uploaded PDF | Download / reprocess |
| `judgements/pages/<document_id>/page-0001.pdf` | Single-page PDF | Page viewer |
| `judgements/ocr-raw/<document_id>/batch-001.json` | Document AI OCR JSON | OCR layout inspect |
| `judgements/ocr-input/...` / `ocr-output/...` | Document AI batch IO | OCR pipeline |

SQL keeps only the **paths**: `storage_path`, `gcs_page_path`, `ocr_json_path`.

---

## 5. Elasticsearch

Elasticsearch holds **searchable text**, not PDFs. There are two indices.

Env:

- URL: `ELASTIC_URL` / `ELASTICSEARCH_URL`
- Default admin/search index: `ELASTICSEARCH_INDEX` → **`judgments`**
- User-pipeline index: `IK_JUDGMENTS_INDEX` → **`ik_judgments`**

### 5.1 Index `judgments`

**Why:** keyword and phrase search over processed judgments (admin uploads + IK ingest that went through the main pipeline).

**Document id:** `canonical_id` (sometimes `ik:<tid>`)

**Stores:**

| Field | Purpose |
|---|---|
| `judgment_uuid` | Link back to Postgres |
| `canonical_id` | Stable case id |
| `case_name`, `court_code`, `court_name` | Display + filter |
| `year`, `judgment_date` | Date filter |
| `citations` / `primary_citation` | Citation search |
| `full_text` | Entire judgment text (this is what search hits) |
| `summary_text`, `holding_text` | Optional summaries |
| `source_type` | `admin-upload`, `indian_kanoon`, `ik_pipeline` |
| `source_url` | Origin URL (stored, not searched) |
| `status`, `verification_status` | Processing flags |

**Fetched for:**

- Hybrid / full-text search (`judment_api`)
- Admin detail text preview when `es_doc_id` is set
- Counts by `source_type` (legacy pipeline-report path)

### 5.2 Index `ik_judgments`

**Why:** raw Indian Kanoon copies created when a **user citation search** cannot find the case locally. The Super Admin **User Pipeline** dashboard lists and inspects **this index only**.

**Document id:** Indian Kanoon `tid` (example `134606517`)

**Stores:**

| Field | Purpose |
|---|---|
| `tid` | IK document id (also ES `_id`) |
| `title` | Case name shown in the table |
| `text` | Plain judgment text (full view fallback) |
| `doc` | Original HTML (full document view) |
| `docsource` | Court name |
| `publishdate` | Court judgment date |
| `author`, `bench` | Judge metadata |
| `casesCited`, `citedBy` | Citation graph |
| `numcites`, `numcitedby` | Counts |
| `fetched_at` | Ingest time (often empty on current docs) |

**Fetched for:**

- User Pipeline cards (total, courts, dates)
- Inserted Judgments table (all docs)
- Inspect / Full Document view
- Not used by Admin Uploads PDF pipeline

**What it does not store:** PDFs, page images, chunk vectors, Postgres `judgment_uuid`.

---

## 6. Qdrant

**Why:** semantic search. Elasticsearch matches words; Qdrant matches meaning of chunks.

Env:

- `QDRANT_URL`, `QDRANT_API_KEY`
- Active collection in code: `QDRANT_COLLECTION` → **`legal_embeddings_v2`**
- Also defined in `.env` but **not used by `qdrantService.js` today:** `JUDGEMENT_QDRANT_COLLECTION=judgement_segments_768`

### 6.1 Collection `legal_embeddings_v2`

| Item | Value |
|---|---|
| Vector size | 768 (`GEMINI_EMBEDDING_DIMENSION`) |
| Distance | Cosine |
| Point id | `chunk_id` |

**Stores (payload):**

- `judgment_uuid`
- `canonical_id`
- `case_name`
- `chunk_text`
- `chunk_index`
- `court_code`
- `year`
- `source_type`

**Fetched for:**

- Hybrid / semantic search
- Per-judgment vector inspect (admin pipeline)
- Duplicate detection (fingerprint search)

If Qdrant is unreachable (404 / wrong cluster URL), User Pipeline still works for listing `ik_judgments`, but **Qdrant Points stays 0** and semantic search is degraded.

---

## 7. Document AI (OCR)

Not a database. Used only during **Admin Uploads** processing.

**Why:** scanned PDFs have no digital text. Document AI produces OCR JSON, which is written to GCS and merged into `judgment_uploads.merged_text` / `judgment_pages.text_content`.

That merged text is then:

1. Chunked → Postgres `judgment_chunks` + Qdrant
2. Indexed as `full_text` → Elasticsearch `judgments`

---

## 8. Two pipelines

### 8.1 Admin Uploads (`source_type = admin-upload`)

```text
PDF upload
  → GCS original
  → split pages → GCS page PDFs
  → OCR if needed → GCS JSON + SQL pages
  → merge text
  → Postgres judgments + uploads + chunks
  → Elasticsearch index `judgments` (full_text)
  → Qdrant collection `legal_embeddings_v2` (chunk vectors)
```

**UI:** Judgement Upload → **Admin Uploads**

**Reads:** PostgreSQL first, then ES/Qdrant/GCS for previews.

### 8.2 User citation fallback (`ik_judgments`)

```text
User searches a citation
  → local Postgres / `judgments` ES / Qdrant miss
  → fetch from Indian Kanoon
  → write raw copy into Elasticsearch index `ik_judgments`
     (id = tid, fields = title, text, doc, court, date, cites)
```

**UI:** Judgement Upload → **User Pipeline**

**Reads:** Elasticsearch `ik_judgments` for the table and full document. PostgreSQL count may be 0 if those IK copies were never upserted into `judgments`. Qdrant is not required for this list/inspect view.

---

## 9. What each UI reads

| Screen | Primary store | Also uses |
|---|---|---|
| Admin Uploads list / status | PostgreSQL `judgment_uploads` | GCS, ES `judgments`, Qdrant |
| User Pipeline list / inspect | Elasticsearch **`ik_judgments`** | Qdrant only if reachable |
| Judgement Search (hybrid) | Qdrant chunks + ES `judgments` | Postgres for metadata enrichment |
| Dependency Monitor | Health checks to PG, GCS, ES, Qdrant, Document AI config | — |

---

## 10. Fetch vs store summary

```text
                    STORE                              FETCH
Admin PDF           GCS original/pages/OCR             Page PDF / OCR layout
Admin metadata      Postgres judgments + uploads       Admin dashboard
Admin full text     ES `judgments`.full_text           Keyword search, detail text
Admin chunks        Qdrant `legal_embeddings_v2`       Semantic search
User IK fallback    ES `ik_judgments` (title/text/doc) User Pipeline table + full view
Search analytics    Postgres judgment_api_analytics    Search analytics panel
```

---

## 11. Related files

| File | Contents |
|---|---|
| `db/initSchema.js` | Postgres table creation |
| `services/elasticsearchService.js` | `judgments` + `ik_judgments` APIs |
| `services/qdrantService.js` | `legal_embeddings_v2` |
| `services/processingService.js` | Admin upload pipeline writes |
| `services/pipelineReportService.js` | User Pipeline report (reads `ik_judgments`) |
| `config/db.js` | Postgres connection |
| `config/gcs.js` | GCS client |
| `database_storing.md` | Longer upload-mapping write-up |

Do not commit secrets. Connection strings, ES passwords, and Qdrant API keys live only in `.env`.
