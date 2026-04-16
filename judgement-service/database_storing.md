# Judgment Storage, Mapping, and Data Flow

This document explains where a judgment upload is stored, what goes into each SQL table, what is stored in Qdrant and Elasticsearch, how `canonical_id` is created and propagated, and how one judgment is mapped across all persistence layers.

## 1. Storage Overview

One uploaded judgment is stored across these systems:

1. PostgreSQL
   Holds the relational source of truth for uploads, logical judgments, pages, chunks, aliases, and analytics.

2. Google Cloud Storage
   Holds the original PDF, split page PDFs, and OCR JSON artifacts.

3. Qdrant
   Holds chunk embeddings for semantic search.

4. Elasticsearch
   Holds the full judgment text document for keyword and phrase search.

PostgreSQL is the anchor system. Qdrant and Elasticsearch are search indexes built from the PostgreSQL plus storage pipeline.

## 2. Core Identity Keys

These keys are the most important to understand:

### `document_id`

- Meaning: one uploaded file / one upload record
- Type: `UUID`
- Main table: `judgment_uploads.document_id`
- Used by:
  - `judgment_pages.document_id`
  - `judgment_chunks.document_id`
  - storage path prefix: `judgements/original/<document_id>/...`

### `judgment_uuid`

- Meaning: one logical judgment entity
- Type: `UUID`
- Main table: `judgments.judgment_uuid`
- Used by:
  - `judgment_uploads.judgment_uuid`
  - `judgment_chunks.judgment_uuid`
  - `citation_aliases.judgment_uuid`
  - Qdrant payload: `judgment_uuid`
  - Elasticsearch document body: `judgment_uuid`

### `canonical_id`

- Meaning: stable business identifier for the judgment
- Type: `VARCHAR(200)`
- Main table: `judgments.canonical_id`
- Also stored in:
  - `judgment_uploads.canonical_id`
  - Elasticsearch document field `canonical_id`
  - Qdrant payload field `canonical_id`

### `chunk_id`

- Meaning: one text chunk row in SQL
- Type: `UUID`
- Main table: `judgment_chunks.chunk_id`
- Also used as:
  - `judgment_chunks.qdrant_point_id`
  - Qdrant point `id`

### `es_doc_id`

- Meaning: Elasticsearch document id for the full judgment record
- Type: `TEXT`
- Stored in:
  - `judgments.es_doc_id`
  - `judgment_uploads.es_doc_id`

In the current pipeline, the Elasticsearch document id is the same as `canonical_id`.

## 3. Where `canonical_id` Comes From

`canonical_id` is created in `services/metadataService.js`.

Generation logic:

1. Extract metadata from merged full text:
   - `caseName`
   - `courtCode`
   - `judgmentDate`
   - `year`
   - citations

2. Build a slug from:
   - `caseName`
   - `courtCode`
   - `year`

3. Add a short SHA1 hash suffix to reduce collisions.

Format:

```text
<case-name-slug>-<court-code>-<year>-<10-char-hash>
```

Example:

```text
k-t-v-health-food-pvt-ltd-sc-2018-5b9643c08f
```

Important behavior:

- `judgments.canonical_id` is `UNIQUE`
- `upsertJudgment(...)` uses `ON CONFLICT (canonical_id) DO UPDATE`
- So `canonical_id` is the deduplication key for the logical judgment record

That means multiple uploads can point to the same logical judgment if they resolve to the same `canonical_id`.

## 4. PostgreSQL Tables

## 4.1 `judgments`

This is the logical judgment master table.

Main purpose:

- one row per logical judgment
- stores canonical metadata
- stores cross-index references

Important columns:

- `judgment_uuid`
- `canonical_id`
- `case_name`
- `court_code`
- `judgment_date`
- `year`
- `source_type`
- `verification_status`
- `confidence_score`
- `es_doc_id`
- `qdrant_collection`
- `citation_data`
- `ocr_info`
- `status`

What it represents:

- the final normalized identity of the judgment
- not just one upload file

## 4.2 `judgment_uploads`

This is the upload / processing table.

Main purpose:

- one row per uploaded document
- tracks pipeline status and storage locations

Important columns:

- `document_id`
- `judgment_uuid`
- `canonical_id`
- `original_filename`
- `source_url`
- `storage_bucket`
- `storage_path`
- `storage_uri`
- `status`
- `admin_user_id`
- `admin_role`
- `total_pages`
- `text_pages_count`
- `ocr_pages_count`
- `ocr_batches_count`
- `merged_text`
- `metadata`
- `pipeline_metrics`
- `es_doc_id`
- `qdrant_collection`
- `last_progress_message`
- `error_message`
- `processing_started_at`
- `processing_completed_at`

What it represents:

- the physical uploaded file and its pipeline lifecycle

## 4.3 `judgment_pages`

This is the per-page extracted artifact table.

Main purpose:

- stores page-level classification and OCR output references

Important columns:

- `page_id`
- `document_id`
- `page_number`
- `page_type`
- `status`
- `text_length`
- `text_content`
- `gcs_page_path`
- `gcs_page_uri`
- `ocr_json_path`
- `ocr_json_uri`
- `ocr_confidence`

What it represents:

- one row per page for one uploaded document

## 4.4 `judgment_chunks`

This is the SQL chunk registry.

Main purpose:

- stores the chunk text and the mapping between SQL and Qdrant

Important columns:

- `chunk_id`
- `document_id`
- `judgment_uuid`
- `chunk_index`
- `char_start`
- `char_end`
- `chunk_text`
- `embedding_model`
- `embedding_status`
- `qdrant_point_id`

What it represents:

- one text chunk for the judgment
- plus the lookup key to the Qdrant vector point

## 4.5 `citation_aliases`

Main purpose:

- stores normalized citation strings linked to a judgment

Important columns:

- `alias_id`
- `judgment_uuid`
- `alias_string`
- `normalized`

## 4.6 `judgment_api_analytics`

Main purpose:

- stores search API analytics and timings

Important columns:

- `request_id`
- `endpoint`
- `search_mode`
- `query_text`
- `filters`
- `semantic_limit`
- `text_limit`
- `score_threshold`
- `phrase_match`
- `status_code`
- `success`
- `result_count`
- timing columns:
  - `embedding_duration_ms`
  - `qdrant_duration_ms`
  - `elastic_duration_ms`
  - `db_duration_ms`
  - `signed_url_duration_ms`
  - `total_duration_ms`

## 4.7 Other SQL Tables

These exist in the schema but are not the primary upload pipeline tables:

- `judges`
- `judgment_judges`
- `statutes_cited`

They are for future or extended structured extraction.

## 5. What Is Stored in Google Cloud Storage

The file storage layer is not SQL, but it is part of the judgment storage model.

Artifacts:

### Original PDF

Stored under:

```text
judgements/original/<document_id>/<sanitized_filename>.pdf
```

Recorded in SQL:

- `judgment_uploads.storage_bucket`
- `judgment_uploads.storage_path`
- `judgment_uploads.storage_uri`

### Split page PDFs

Stored under:

```text
judgements/pages/<document_id>/page-0001.pdf
```

Recorded in SQL:

- `judgment_pages.gcs_page_path`
- `judgment_pages.gcs_page_uri`

### OCR JSON

Stored under:

```text
judgements/ocr-raw/<document_id>/batch-001.json
```

Recorded in SQL:

- `judgment_pages.ocr_json_path`
- `judgment_pages.ocr_json_uri`

## 6. What Is Stored in Elasticsearch

Elasticsearch stores one full-text judgment document per logical judgment.

Index name:

```text
judgments
```

Elasticsearch document id:

```text
canonical_id
```

Stored document fields:

- `judgment_uuid`
- `canonical_id`
- `case_name`
- `court_code`
- `year`
- `judgment_date`
- `source_url`
- `source_type`
- `status`
- `citations`
- `full_text`

Purpose:

- exact text search
- phrase search
- highlights/snippets

Key point:

- Elasticsearch stores the whole judgment text as `full_text`
- it does not store the original PDF file
- it is enriched back with SQL/storage metadata after search

## 7. What Is Stored in Qdrant

Qdrant stores one vector point per judgment chunk.

Collection:

```text
legal_embeddings_v2
```

Distance:

```text
Cosine
```

Qdrant point id:

```text
chunk_id
```

Stored payload:

- `judgment_uuid`
- `canonical_id`
- `case_name`
- `chunk_text`
- `chunk_index`
- `court_code`
- `year`

Stored vector:

- chunk embedding from `generateEmbeddings(...)`

Purpose:

- semantic retrieval
- nearest-neighbor chunk search
- RAG-style chunk lookup

Key point:

- Qdrant stores chunk vectors and payload metadata
- the real file/document metadata still comes from SQL/storage enrichment

## 8. End-to-End Upload Data Flow

This is the full lifecycle of one judgment upload.

### Step 1. Upload request arrives

Route:

```text
POST /api/judgements/upload
```

Controller:

- accepts multipart or base64 PDF
- streams or uploads original file to storage

Writes:

- original PDF to GCS
- one row in `judgment_uploads`

At this moment:

- `document_id` exists
- `judgment_uuid` and `canonical_id` are still not final

### Step 2. Upload row is created

`createUpload(...)` inserts into `judgment_uploads`.

Stored immediately:

- `document_id`
- `original_filename`
- `source_url`
- `storage_bucket`
- `storage_path`
- `storage_uri`
- `status = uploaded`
- admin identity fields

### Step 3. Background processing starts

`queueProcessing(...)` triggers the pipeline.

### Step 4. PDF is split and pages are classified

For each page:

- detect if text is already digital or needs OCR
- upload single-page PDF to GCS
- write rows into `judgment_pages`

### Step 5. OCR runs for scanned pages

Writes:

- OCR raw JSON to GCS
- updates matching `judgment_pages` rows with:
  - `text_content`
  - `ocr_json_path`
  - `ocr_confidence`

### Step 6. Full text is merged

All page text is ordered and merged into one `merged_text`.

Writes:

- `judgment_uploads.merged_text`
- page counts and pipeline metrics

### Step 7. Metadata is extracted

Metadata extraction creates:

- `caseName`
- `courtCode`
- `judgmentDate`
- `year`
- `primaryCitation`
- `alternateCitations`
- `canonicalId`

### Step 8. First judgment upsert happens

`upsertJudgment(...)` writes into `judgments`.

This creates or updates the logical judgment row using `canonical_id` as the conflict key.

Writes:

- `judgment_uuid`
- `canonical_id`
- judgment metadata
- citation and OCR info

### Step 9. Upload row is linked to the judgment

`judgment_uploads` is updated with:

- `judgment_uuid`
- `canonical_id`
- status and progress fields

### Step 10. Aliases and chunks are stored in SQL

`replaceAliases(...)` writes citation aliases.

`replaceChunks(...)` writes one row per chunk to `judgment_chunks`.

At this moment:

- chunk text exists in SQL
- vectors are not yet in Qdrant

### Step 11. Elasticsearch document is indexed

The whole judgment is written to Elasticsearch.

Document id:

```text
canonical_id
```

The returned id is stored as:

- `judgments.es_doc_id`
- `judgment_uploads.es_doc_id`

### Step 12. Chunk embeddings are generated

Each chunk text is embedded.

### Step 13. Qdrant points are upserted

Each chunk becomes a Qdrant point:

- point id = `chunk_id`
- payload includes `judgment_uuid`, `canonical_id`, `chunk_text`, etc.

The collection name is stored as:

- `judgments.qdrant_collection`
- `judgment_uploads.qdrant_collection`

Then SQL chunk rows are updated:

- `embedding_status = indexed`
- `qdrant_point_id = chunk_id::text`

### Step 14. Upload is marked completed

Final update to `judgment_uploads`:

- `status = completed`
- `processing_completed_at`
- `es_doc_id`
- `qdrant_collection`
- `canonical_id`
- final metrics

## 9. How One Judgment Maps Across the Systems

Example mapping:

- `document_id`
  - SQL upload row
  - SQL page rows
  - SQL chunk rows
  - GCS storage folder

- `judgment_uuid`
  - SQL logical judgment row
  - SQL upload row
  - SQL chunk rows
  - Qdrant payload
  - Elasticsearch document body

- `canonical_id`
  - SQL logical judgment row
  - SQL upload row
  - Qdrant payload
  - Elasticsearch document id and field

- `chunk_id`
  - SQL chunk row primary key
  - Qdrant point id

That is how one judgment is effectively linked across the three databases:

1. PostgreSQL:
   `judgment_uuid`, `document_id`, `canonical_id`, `chunk_id`

2. Qdrant:
   point id = `chunk_id`
   payload includes `judgment_uuid` and `canonical_id`

3. Elasticsearch:
   document id = `canonical_id`
   document body includes `judgment_uuid`

## 10. Which System Is the Source of Truth

Use this rule:

- PostgreSQL = source of truth for identity, upload lifecycle, chunk registry, and metadata
- GCS = source of truth for the real file and OCR artifacts
- Qdrant = semantic retrieval index
- Elasticsearch = full-text retrieval index

If a result comes from Qdrant or Elasticsearch, the app should enrich it from PostgreSQL to get the real document link and complete metadata.

## 11. How to Access the Data

## 11.1 PostgreSQL

### Find an upload by document id

```sql
SELECT *
FROM judgment_uploads
WHERE document_id = '<document_id>';
```

### Find the logical judgment by canonical id

```sql
SELECT *
FROM judgments
WHERE canonical_id = '<canonical_id>';
```

### Get pages for one upload

```sql
SELECT *
FROM judgment_pages
WHERE document_id = '<document_id>'
ORDER BY page_number;
```

### Get chunks for one judgment

```sql
SELECT *
FROM judgment_chunks
WHERE judgment_uuid = '<judgment_uuid>'
ORDER BY chunk_index;
```

### See how upload and judgment are linked

```sql
SELECT
  ju.document_id,
  ju.original_filename,
  ju.canonical_id AS upload_canonical_id,
  ju.judgment_uuid,
  j.canonical_id AS judgment_canonical_id,
  j.case_name,
  j.es_doc_id,
  j.qdrant_collection
FROM judgment_uploads ju
LEFT JOIN judgments j
  ON j.judgment_uuid = ju.judgment_uuid
WHERE ju.document_id = '<document_id>';
```

## 11.2 Elasticsearch

### Fetch one document by canonical id

```bash
curl -u "$ELASTICSEARCH_USERNAME:$ELASTICSEARCH_PASSWORD" \
  "$ELASTICSEARCH_URL/judgments/_doc/<canonical_id>"
```

### Search by text

```bash
curl -u "$ELASTICSEARCH_USERNAME:$ELASTICSEARCH_PASSWORD" \
  -H "Content-Type: application/json" \
  -X POST "$ELASTICSEARCH_URL/judgments/_search" \
  -d '{
    "query": {
      "multi_match": {
        "query": "demolition of the building",
        "fields": ["full_text^4", "case_name^3", "citations^2", "canonical_id^2", "court_code"],
        "type": "best_fields",
        "operator": "and"
      }
    }
  }'
```

## 11.3 Qdrant

### Search by query embedding

Your app does this internally:

1. generate query embedding
2. call Qdrant `/points/search`
3. use cosine similarity

Example shape:

```bash
curl -H "api-key: $QDRANT_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST "$QDRANT_URL/collections/legal_embeddings_v2/points/search" \
  -d '{
    "vector": [/* query embedding values */],
    "limit": 5,
    "with_payload": true,
    "with_vector": false
  }'
```

### Fetch vectors by point ids

```bash
curl -H "api-key: $QDRANT_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST "$QDRANT_URL/collections/legal_embeddings_v2/points" \
  -d '{
    "ids": ["<chunk_id>"],
    "with_payload": true,
    "with_vector": true
  }'
```

## 11.4 Existing Service APIs

### Uploads and details

- `POST /api/judgements/upload`
- `GET /api/judgements`
- `GET /api/judgements/summary`
- `GET /api/judgements/:documentId`
- `GET /api/judgements/:documentId/pages/:pageNumber/pdf`
- `GET /api/judgements/:documentId/pages/:pageNumber/ocr-layout`
- `GET /api/judgements/:documentId/vectors?pointIds=<id1>,<id2>`

### Search API

- `POST /api/judment-api/search/semantic`
- `POST /api/judment-api/search/full-text`
- `POST /api/judment-api/search/hybrid`
- `GET /api/judment-api/analytics`

## 12. Important Practical Notes

### `canonical_id` is not the upload id

Do not confuse:

- `document_id` = uploaded file identity
- `canonical_id` = logical judgment identity

### Qdrant and Elasticsearch are derived indexes

They should be rebuildable from SQL + storage.

### Qdrant chunk results still need SQL enrichment

Qdrant gives:

- vector match
- payload metadata

But for the real linked document, you usually enrich through SQL:

- `judgment_chunks`
- `judgment_uploads`
- `judgments`

### Elasticsearch results also need SQL enrichment

Elasticsearch gives:

- text relevance
- highlights
- indexed judgment metadata

But the original file URL and upload document metadata still come from SQL + storage.

## 13. Short Summary

If you want to remember just one mapping:

- Upload file lives in `judgment_uploads` and GCS under `document_id`
- Logical case identity lives in `judgments` under `judgment_uuid` and `canonical_id`
- Chunk registry lives in `judgment_chunks` under `chunk_id`
- Qdrant point id = `chunk_id`
- Elasticsearch doc id = `canonical_id`

That is the main bridge that maps one judgment across PostgreSQL, Qdrant, Elasticsearch, and storage.



<!-- Yes, the canonical_id in Qdrant is intended to be the same value as in judgments.canonical_id and judgment_uploads.canonical_id for that same logical judgment.

If you upload one file, say judgment "A", these IDs are created and stored:

document_id
Created first at upload time
Unique for that uploaded file
Stored in:
judgment_uploads.document_id
judgment_pages.document_id
judgment_chunks.document_id
GCS file paths like judgements/original/<document_id>/...
judgment_uuid
Created during processing when the logical judgment row is upserted
Unique for the logical judgment entity
Stored in:
judgments.judgment_uuid
judgment_uploads.judgment_uuid
judgment_chunks.judgment_uuid
Qdrant payload judgment_uuid
Elasticsearch document body judgment_uuid
canonical_id
Generated from extracted metadata: case name + court code + year + hash
Business identity of the judgment
Stored in:
judgments.canonical_id
judgment_uploads.canonical_id
Qdrant payload canonical_id
Elasticsearch doc id and canonical_id field
chunk_id
Created for each text chunk
Unique per chunk
Stored in:
judgment_chunks.chunk_id
judgment_chunks.qdrant_point_id
Qdrant point id
So for file "A" the mapping is:

Uploaded file identity:
document_id
Logical judgment identity:
judgment_uuid
Human/business identity:
canonical_id
Semantic chunk identity:
chunk_id
How they connect together for one file:

judgment_uploads.document_id
-> links to judgment_pages.document_id
-> links to judgment_chunks.document_id

judgment_uploads.judgment_uuid
-> links to judgments.judgment_uuid
-> links to judgment_chunks.judgment_uuid
-> also appears in Qdrant payload and Elasticsearch body

judgment_uploads.canonical_id
-> same as judgments.canonical_id
-> same as Qdrant payload canonical_id
-> same as Elasticsearch doc id

judgment_chunks.chunk_id
-> same as Qdrant point id

Very important distinction:

document_id is for the uploaded file
canonical_id is for the logical judgment content
they are not the same thing
Example shape for one uploaded file:

file "A.pdf" uploaded
document_id = d1...
processing extracts metadata and creates:
judgment_uuid = j1...
canonical_id = a-vs-b-sc-2023-abc1234567
chunks created:
chunk_id = c1..., c2..., c3...
Qdrant stores:
point id = c1...
payload { judgment_uuid: j1..., canonical_id: a-vs-b-sc-2023-abc1234567, ... }
Elasticsearch stores:
doc _id = a-vs-b-sc-2023-abc1234567
So yes:

Qdrant canonical_id should match judgment_uploads.canonical_id
but the actual unique file identity is document_id
 -->
