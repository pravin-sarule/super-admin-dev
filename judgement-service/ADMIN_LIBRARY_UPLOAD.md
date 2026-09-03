# Jurinex Judgement Service — Admin Library Upload Architecture

*How a Super Admin turns a court PDF into an Indian Kanoon-format judgment
record in Elasticsearch, and how every reader of the judgment library then
finds it. `judgement-service` (Node/Express, port 8095) behind the super-admin
Backend (port 4000). Written 2026-09-03 from the live code; every claim below
points at the function that implements it.*

Companion documents: JUDGMENT_LIBRARY.md (the Python library service that
owns `ik_judgments` and the library-first search),
[database_storing.md](database_storing.md) (the older admin pipeline, no
longer used for uploads), [documentation.md](documentation.md).

---

## 0. The idea in one paragraph

The judgment library (`ik_judgments` + `ik_judgment_paragraphs`) is the free
local copy of Indian Kanoon that the citation-research pipeline consults
before paying for an IK search. Until now the only way a judgment entered it
was an IK `/doc/{tid}/` response. Admin Library Upload adds a second way: a
Super Admin uploads a court PDF, the service extracts its text, converts it
into **exactly** the record shape the library stores for IK judgments
(`tid, title, doc, text, docsource, publishdate, author, bench, numcites,
numcitedby, casesCited, citedBy`), chunks it into the same paragraph rows,
and writes both to Elasticsearch. **Elasticsearch is the only store**: no
Postgres row, no GCS copy of the PDF, no Qdrant vectors, no chunk tables.
The stored HTML is the source of truth; edits rebuild the record from it.
The library-first search, the Judgement Search page and the User Pipeline
tab all read the result with no special casing beyond a `source` tag.

**Live figures on 2026-09-03** (Elasticsearch 8.19.12):

| Index | Documents |
|---|---|
| `ik_judgments` (one per judgment) | 655 — 653 from Indian Kanoon, **2 from admin uploads** |
| `ik_judgment_paragraphs` (legal chunks) | 37,134 |
| `ik_search_cache` (remembered IK search pages; never written by uploads) | 147 |

---

## 1. System context

```
┌──────────────────────── Super Admin browser (React, :3001 dev) ───────────────────────┐
│  Sidebar "Judgement Upload" → /dashboard/judgements?view=admin_upload                  │
│    JudgementManagement.jsx        → tab "Admin Uploads"                                │
│    judgement-library/index.jsx    → upload form · library table · record view          │
│    judgement-library/useJudgementLibrary.js → state + actions                          │
│    services/judgementAdminApi.js  → libraryUpload / libraryList / libraryDetail /      │
│                                     libraryHtml / libraryUpdate / libraryDelete        │
└──────────────────────────────────────┬────────────────────────────────────────────────┘
                                       │ multipart / JSON + Bearer JWT
┌──────────────────────────────────────▼────────────────────────────────────────────────┐
│  super-admin Backend (Express, :4000)  Backend/routes/judgementRoutes.js               │
│    protect(pool) + authorize(['super-admin'])   → super_admins ⋈ admin_roles (Auth_DB)  │
│    /api/judgements-admin/library/*  → streamed to JUDGEMENT_SERVICE_URL, adding         │
│    x-admin-user-id / x-admin-role / x-admin-email / x-internal-service-key             │
└──────────────────────────────────────┬────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼────────────────────────────────────────────────┐
│  judgement-service (Express, :8095)   routes/judgementRoutes.js  /api/judgements/library│
│    authenticate + authorize(['super-admin'])          middleware/auth.js               │
│    controllers/libraryUploadController.js                                              │
│    services/libraryUploadService.js   extract → metadata → build → store               │
│    services/ikFormatService.js        the Indian Kanoon record builder (pure)          │
│    services/elasticsearchService.js   create-only writes, guarded deletes, listing     │
└───┬───────────────────────┬─────────────────────────┬─────────────────────────────────┘
    │                       │                         │
    ▼                       ▼                         ▼
 Elasticsearch          Google Document AI        Gemini 2.5 Flash
 ik_judgments           OCR, only for PDFs        case name · court code · date
 ik_judgment_paragraphs with no text layer        (metadataService.extractMetadata)
 (the ONLY store)       (documentAiService)

 NOT touched by this path: Postgres (citationTest), GCS, Qdrant, the `judgments` index.

 Readers of what was written:
   • Python library service (JUDGMENT_LIBRARY.md §5) — library-first search, free full-text reads
   • Judgement Search page — full-text leg over ik_judgments (judment_api)
   • User Pipeline tab — lists ik_judgments, labels uploads `admin-upload`
```

Both local services are started with `node server.js` and do not reload on
file changes; restart them after deploying code.

---

## 2. File map (what lives where)

| Concern | File · symbol |
|---|---|
| HTTP entry, multipart parsing (in memory), per-file results | `routes/judgementRoutes.js` (`/library/*`, registered before `/:documentId`) · `controllers/libraryUploadController.js` · `uploadToLibrary` |
| Orchestration: extract → metadata → build → store; list, detail, edit, delete | `services/libraryUploadService.js` · `ingestPdf`, `extractJudgmentText`, `runOcr`, `buildRecord`, `listLibraryUploads`, `getLibraryUpload`, `getLibraryUploadHtml`, `updateLibraryUpload`, `deleteLibraryUpload` |
| Indian Kanoon record builder (pure functions, no I/O) | `services/ikFormatService.js` · `buildIkTitle`, `resolveDocsource`, `detectAuthorAndBench`, `buildIkHtml`, `stripHtmlLikeIk`, `buildIkJudgmentBody`, `splitJudgmentParagraphs`, `extractSections/extractActs/extractCitations`, `buildParagraphRows`, `deriveUploadTid`, `isUploadTid`, `bodyTextFromIkHtml`, `toIkDocResponse`, `wrapIkHtmlPage` |
| Elasticsearch writes and reads for the library | `services/elasticsearchService.js` · `ensureIkLibraryMapping`, `createIkJudgmentDocument`, `bulkCreateIkParagraphs`, `deleteIkJudgmentDocument`, `getIkJudgmentSource`, `countIkParagraphs`, `searchIkAdminUploads`, `searchIkLibraryFullText`, `mapIkJudgmentHit` |
| PDF text layer, page split / merge for OCR batches | `services/pdfService.js` · `extractTextFromPdfBuffer`, `splitPdfIntoPages`, `mergePdfBuffers`, `normalizeWhitespace` |
| OCR for image-only PDFs (synchronous Document AI, ≤15 pages per call) | `services/documentAiService.js` · `processBatchPdf` (lazily required) |
| Case name / court code / judgment date from the text | `services/metadataService.js` · `extractMetadata` (heuristics + Gemini) |
| Judgement Search integration (library leg + graceful hybrid) | `judment_api/judmentApiService.js` · `fullTextSearch`, `formatLibraryFullTextResult`, `hybridSearch` |
| User Pipeline tab labelling | `services/pipelineReportService.js` · `mapIkRowToJudgment`, `getPipelineJudgmentDetail` |
| Backend proxy | `Backend/routes/judgementRoutes.js` · the `/library/*` block |
| Frontend | `Frontend/src/pages/dashboard/judgement-library/*`, `Frontend/src/pages/dashboard/JudgementManagement.jsx`, `Frontend/src/services/judgementAdminApi.js`, `Frontend/src/pages/dashboard/judgement-search/FullTextResultsPanel.jsx` |

---

## 3. Data store — Elasticsearch only

### 3.0 Indexes at a glance

All indexes live on the shared cluster at `ELASTIC_URL`. An upload writes to
exactly two of them — the same two the Python library service writes for
Indian Kanoon judgments.

| Index | Written by uploads? | Role | `_id` |
|---|---|---|---|
| `ik_judgments` | **yes** | one document per judgment in Indian Kanoon record format (§3.1) | the tid, `9` + 10 digits |
| `ik_judgment_paragraphs` | **yes** | the judgment split into legal chunks with `sections` / `acts` / `citations` (§3.2) | `{tid}:{paragraph_no}` |
| `ik_search_cache` | no | exact-query memory of real Indian Kanoon search pages; uploads are found by the full-text engine instead (§5.4) | `sha1(wire):pagenum` |
| `judgments` | no | the older admin pipeline's own index; still read by the Judgement Search page alongside `ik_judgments` so earlier records stay searchable (§5.2) | canonical id |

Index names come from `IK_JUDGMENTS_INDEX` and `IK_PARAGRAPHS_INDEX`
(`judgement-service/.env`, defaults above) and must match the Python
service's `elastic_index` / `elastic_paragraph_index`. Nothing goes to
Postgres, GCS or Qdrant.

### 3.1 `ik_judgments` — one document per judgment, `_id` = tid

The record is built by `ikFormatService.buildIkJudgmentBody` and is
field-for-field what the library writes from an IK `/doc` response
(JUDGMENT_LIBRARY.md A.2/A.3). Null values are dropped before indexing,
exactly like the library does.

| Field | Type (live mapping) | Content for an upload |
|---|---|---|
| `tid` | keyword | `9` + 10 digits derived from the SHA-1 of the extracted text (§4.5) |
| `title` | text | `"Party A vs Party B on 17 June, 2013"` — `buildIkTitle` |
| `doc` | text, `index: false` | the generated IK-style HTML fragment (§4.3) |
| `text` | text | `strip_html(doc)`: tags → spaces, spaces/tabs collapsed, newlines kept, **entities kept** — `stripHtmlLikeIk`. The search field. |
| `docsource` | text + `.kw` | court name as IK spells it, e.g. `Jharkhand High Court` — `resolveDocsource` |
| `publishdate` | date `yyyy-MM-dd` | judgment date |
| `author`, `bench` | text | judges — admin-entered or `detectAuthorAndBench`; omitted when unknown |
| `numcites`, `numcitedby` | integer | always `0` (no IK citation graph for uploads) |
| `casesCited`, `citedBy` | object, `enabled: false` | always `[]` |
| `fetched_at` | date (already in the mapping) | upload time |
| `source` | text + `.keyword` | `"admin_upload"` — the one marker that separates an upload from an IK fetch |
| `upload` | object, `enabled: false` (stored, never indexed) | `filename, uploaded_at, uploaded_by, admin_user_id, page_count, text_source ('pdf_text' \| 'ocr'), sha1, extraction_method, needs_review, court_code, case_name, updated_at?, updated_by?` |

`ensureIkLibraryMapping` puts the `upload` mapping (`enabled: false`) once
per process before the first write, so the bookkeeping block never enters
the inverted index. Everything the Python reader searches, filters or ranks
on (`text`, `title`, `docsource`, `publishdate`, `tid`) is identical in
name, type and derivation to an IK record.

### 3.2 `ik_judgment_paragraphs` — `_id` = `{tid}:{paragraph_no}`

Built by `buildParagraphRows` from the record's `text`, never from the HTML,
with the same rules as the library (§4.4):

| Field | Content |
|---|---|
| `judgment_id`, `paragraph_no` | parent tid, 1-based position |
| `title`, `docsource`, `publishdate`, `bench` | copied from the judgment (omitted when the judgment has none) |
| `text` | the chunk |
| `sections`, `acts`, `citations` | regex hits inside this chunk only; keys omitted when empty |
| `paragraph_type`, `case_number` | never written |

### 3.3 What is deliberately not stored

- **The PDF.** Nothing keeps the file. If it must be re-read (for example
  after an OCR improvement) it has to be uploaded again.
- **A second copy of the text.** Edits rebuild the body text from the
  stored `doc` (`bodyTextFromIkHtml`), so `doc` is the single source of
  truth for the record.
- **Anything in Postgres, GCS or Qdrant.** The older admin pipeline
  (`processingService.js`) still exists in the repo but is no longer wired
  to the Admin Uploads tab.

---

## 4. Write path — how a PDF becomes a library record

### 4.1 Entry point

```
POST /api/judgements-admin/library/upload            (Backend, proxied)
POST /api/judgements/library/upload                  (judgement-service)
  multipart/form-data
    documents[]   1..LIBRARY_UPLOAD_MAX_FILES (20) PDFs, ≤ LIBRARY_UPLOAD_MAX_BYTES (60 MB) each
    title         optional, single file only (dropped for batches)
    docsource     optional court name as IK spells it
    publishdate   optional YYYY-MM-DD (also accepted as judgmentDate)
    author, bench optional
    allowOcr      "0" to refuse OCR for this request
```

`routes/judgementRoutes.js` parses the files with `multer.memoryStorage()`;
the buffers live only for the duration of the request. The controller
(`uploadToLibrary`) processes files **sequentially and synchronously** and
answers once every file is either searchable or rejected:

```jsonc
{
  "success": true,
  "message": "1 stored, 0 duplicate, 0 failed",
  "summary": { "indexed": 1, "duplicate": 0, "failed": 0 },
  "results": [ { "filename": "…", "status": "indexed", "tid": "90734245700", "title": "…",
                 "docsource": "…", "publishdate": "…", "author": "…", "bench": "…",
                 "paragraphCount": 7, "structure": { "pre": 1, "p": 1, "blockquote": 0 },
                 "warnings": [], "durationMs": 8400, "upload": { … } } ]
}
```

HTTP 200 when at least one file was stored or found duplicate, 422 when
every file failed. The Backend proxy allows 15 minutes for the request
(`Math.max(proxyTimeoutMs, 900000)`), which covers OCR of long scanned files.

### 4.2 Step by step (`libraryUploadService.ingestPdf`)

```
1  ensureIkLibraryMapping()                       upload block mapped enabled:false (once per process)
2  extractJudgmentText(buffer)
     pdf-parse text layer  →  chars / page ≥ LIBRARY_UPLOAD_MIN_CHARS_PER_PAGE (120)?  → text_source = pdf_text
     otherwise             →  runOcr: split pages (pdf-lib) → ≤15-page batches →
                              Document AI processBatchPdf → page texts in order      → text_source = ocr
     no text either way    →  422 "no usable text layer …"
3  sha1(text)  →  tid = deriveUploadTid(sha1)      "9" + 10 digits (§4.5)
4  getIkJudgmentSource(tid)                       already there? → status: duplicate, nothing written
5  extractMetadata({ fullText, originalFilename })   caseName, courtCode, judgmentDate,
                                                     extractionMethod ('gemini' | 'heuristic'), needsReview
6  buildRecord
     title      = admin title  ||  buildIkTitle(caseName, judgmentDate)
     docsource  = resolveDocsource(admin court → COURT_CODE_TO_DOCSOURCE[courtCode] → sniff text → null)
     author/bench = admin values  ||  detectAuthorAndBench(text)
     { html }   = buildIkHtml({ title, author, bench, fullText })              §4.3
     body       = buildIkJudgmentBody({ …, doc: html, text: stripHtmlLikeIk(html), fetched_at, upload })
     paragraphs = buildParagraphRows(tid, body)                               §4.4
7  createIkJudgmentDocument(tid, body)            PUT ik_judgments/_create/{tid}
     409 → status: duplicate (lost a race), STOP
8  bulkCreateIkParagraphs(paragraphs)             POST _bulk (create, _id = tid:n), refresh=wait_for
9  return { status: 'indexed', tid, … , warnings }  warnings: court unknown / no date / no judges / no rows
```

Step 2 never calls Document AI for a PDF that has a text layer, and never
calls it at all when `DOCUMENT_AI_PROCESSOR_ID` is unset (the request fails
with a clear 422 instead). Step 5 is the only model call on this path; it
runs only for new content, because a duplicate is detected at step 4 first.

### 4.3 The Indian Kanoon HTML (`buildIkHtml`)

The skeleton reproduced from real IK records in the library (40 sampled):

```html
<h2 class="doc_title">Sangeeta Agrawal vs Union Of India &amp; Others on 17 June, 2013</h2>

<h3 class="doc_author">Author: <a href="/search/?formInput=authorid:p-bhatt">P.P. Bhatt</a></h3>

<h3 class="doc_bench">Bench: <a href="/search/?formInput=benchid:p-bhatt">P.P. Bhatt</a></h3>

<pre id="pre_1">…cause-title header…</pre>
<p id="p_1">…paragraph…</p>
<blockquote id="blockquote_1">…quoted passage…</blockquote>
…
<pre id="pre_2">…signature block…</pre>
```

Rules, all deterministic:

1. The text is split into blocks on blank lines (`splitBlocks`).
2. A block is *prose* when it starts like a numbered paragraph (`12.`,
   `(3)`) or is ≥ 200 chars with an average line ≥ 45 chars
   (`isProseBlock`).
3. Everything before the first prose block is one `<pre id="pre_1">`
   (the cause title / header); everything after the last prose block is a
   trailing `<pre>` (signature); each prose block in between is `<p id="p_N">`,
   or `<blockquote id="blockquote_N">` when it is wrapped in quotation
   marks (`isQuoteBlock`).
4. `&`, `<`, `>` are escaped; whitespace inside a block is preserved.
5. Author/bench lines are emitted only when a name is known; the slugs
   (`p-bhatt`) follow IK's initial-plus-surname convention (`ikNameSlug`).

`text` is then derived from the HTML exactly as the library derives it
(`stripHtmlLikeIk`): every tag becomes a space, runs of spaces/tabs collapse
to one space, newlines are kept and **entities are not decoded** — verified
byte-for-byte against 6 real IK records (their `text` still contains
`&amp;` and `&quot;`).

Block quality depends on the PDF's text layer: when pdf-parse yields no
blank lines, the whole judgment becomes one `<p>` (see the real record in
Appendix A.3), and the paragraph chunker falls back to numbered-paragraph
splitting.

### 4.4 Paragraph chunking and tagging (`splitJudgmentParagraphs`, `buildParagraphRows`)

Same rules as JUDGMENT_LIBRARY.md §4.3:

1. Split on blank lines when present; otherwise before numbered paragraph
   starts; otherwise one block.
2. Blocks over 2,500 chars are cut at the last sentence boundary after
   200 chars, repeatedly (`cutLongBlock`).
3. A block under 200 chars, or a next block under 100 chars, is merged
   forward with `\n`.
4. At most 400 chunks.

Verified against the library's own rows: identical chunk counts on 6/6
real judgments (2, 7, 29, 130, 203, 28). Per-chunk tags use the same
vocabulary (`IPC`, `CrPC`, `BNSS`, `Code of Criminal Procedure`,
`Evidence Act`, `Negotiable Instruments Act`, … in `ACT_PATTERNS`);
sections normalise `10-A` to `10A`; citations match `(2019) 4 SCC 123`,
`AIR 1994 SC 1`, `2022 SCC OnLine SC 344`. On 146 library rows the tags
agree on 137 / 133 / 145 (sections / acts / citations) and are a superset
where they differ (the library misses `Cr.P.C.` written with dots).

### 4.5 tid and idempotency

- `deriveUploadTid(sha1(text))` = `"9"` + `(sha1 mod 10¹⁰)` padded to 10
  digits, an 11-digit number. Indian Kanoon's ids are ≤ 9 digits (largest
  seen in the library: 186813347), so the two ranges never overlap and the
  value stays numeric-safe for any consumer that casts tid to int.
- Because the tid is a function of the text, the same PDF uploaded twice
  lands on the same id: step 4 reports `duplicate` and writes nothing.
  Different scans of the same judgment (different OCR text) get different
  tids; there is no fuzzy de-duplication.
- Writes are create-only (`_create`), like the library. A record is
  replaced only by an explicit edit (§4.6), under the same tid.
- `isUploadTid` / `assertUploadTid` gate every edit and delete:
  a real Indian Kanoon judgment can never be modified through this path.

### 4.6 Edit and delete

```
PUT /api/judgements/library/{tid}      body: any of title, docsource, publishdate, author, bench
  updateLibraryUpload
    text   = bodyTextFromIkHtml(doc)         header dropped, blocks un-escaped, joined with blank lines
    fields = stored values ⊕ overrides       '' clears a value
    rebuild html / text / paragraphs  →  deleteIkJudgmentDocument(tid)  →  _create(tid)  →  _bulk
    upload.updated_at / updated_by recorded

DELETE /api/judgements/library/{tid}
  deleteLibraryUpload → deleteIkJudgmentDocument: DELETE ik_judgments/{tid} (refresh=wait_for)
                        + POST ik_judgment_paragraphs/_delete_by_query { term: { judgment_id: tid } }
```

An edit preserves the body text exactly (verified: `bodyTextFromIkHtml`
of the old and new `doc` are equal) and keeps the tid, so anything that
referenced the judgment keeps working.

---

## 5. Read path — who sees an uploaded judgment

### 5.1 Admin Uploads tab (this service)

| Call | Implementation |
|---|---|
| `GET /library?search=&page=&size=` | `searchIkAdminUploads`: `regexp tid 9[0-9]{10}`, optional `multi_match` on `title^4, docsource^2, author, bench, text` or exact `tid`; sorted `fetched_at desc`; `doc`/`text` excluded |
| `GET /library/{tid}` | `getLibraryUpload`: the record, paragraph count, and the IK `/doc`-shaped view (`toIkDocResponse`) |
| `GET /library/{tid}/html` | the stored `doc` wrapped in a minimal page (`wrapIkHtmlPage`); `?raw=1` returns the bare fragment |

The record view renders `doc` in a sandboxed iframe and can show its HTML
source, so an admin sees exactly what the library holds.

### 5.2 Judgement Search page (judment_api)

`fullTextSearch` now runs two Elasticsearch legs in parallel and merges
them: the pipeline's `judgments` index (`searchJudgmentDocuments`) and the
library (`searchIkLibraryFullText`: same strict → relaxed / phrase
strategy over `text^4, title^3, docsource, author, bench`, highlights on
`text` and `title`). Library hits are shaped by
`formatLibraryFullTextResult` (`caseName = title`, `courtCode = docsource`,
`judgmentDate = publishdate`, `sourceBucket = admin_uploaded`,
`libraryTid = tid`, no PDF URL) so the existing result cards render them;
the card shows a "Judgment Library" badge and "Open in Library". Scope
`user_generated` excludes the library. `hybridSearch` tolerates the
semantic leg failing (Gemini or Qdrant down): the response carries
`semantic.unavailableReason` and the full-text results, instead of an
error.

### 5.3 User Pipeline tab

`listPipelineJudgments` for `ik_pipeline` lists `ik_judgments` sorted by
`publishdate`; `mapIkRowToJudgment` labels rows with
`source = "admin_upload"` as `sourceType: "admin-upload"` and
`getPipelineJudgmentDetail` shows the stored HTML for them.

### 5.4 The Python library service (JUDGMENT_LIBRARY.md §5)

Nothing changes there, by design. `es_wire_search` qualifies judgments on
`text` with strict phrases and `docsource` / `publishdate` filters, ranks
with paragraph proximity from `ik_judgment_paragraphs`, and reads full text
from ES for free — all fields an upload carries. Two consequences to know:

- A library round can now surface a judgment that Indian Kanoon does not
  have. The result card's `https://indiankanoon.org/doc/{tid}/` link is
  therefore not valid for tids starting with `9`; `source = "admin_upload"`
  identifies them.
- `ik_search_cache` is never written by uploads, so an upload is found by
  the full-text engine, not by the exact-query memory.

---

## 6. End-to-end: the first real upload

`Sangeeta_Agarwal_vs_Road_Transport_And_Highways_on_17_June_2013.PDF`,
uploaded by santosh@nexintelai.com at 09:58:07 UTC:

```
pdf-parse        5 pages, text layer present → pdf_text (no OCR)
sha1(text)       bed649c4…  →  tid 90734245700  →  not in library
extractMetadata  gemini: caseName "Sangeeta Agrawal v. Union Of India & Others",
                 judgmentDate 2013-06-17, courtCode UNKNOWN, needsReview true
buildIkTitle     "Sangeeta Agrawal vs Union Of India & Others on 17 June, 2013"
resolveDocsource courtCode UNKNOWN → text sniff "IN THE HIGH COURT OF JHARKHAND AT RANCHI"
                 → "Jharkhand High Court"  (source: text)
detectAuthor…    "Coram: THE HON'BLE MR JUSTICE P.P. BHATT" → author = bench = "P.P. Bhatt"
buildIkHtml      1 <p> + 1 <pre>  (the PDF's text layer carries no blank lines)
stored           doc 15,690 chars · text 15,369 chars · 7 paragraph rows (sections 3H, 30 …)
visible in       Admin Uploads list · Judgement Search ("Section 3H (4) of the National" → relevance 94)
                 · User Pipeline (sourceType admin-upload) · library-first search (strict phrases + court/date)
```

---

## 7. Configuration (`judgement-service/.env` unless noted)

| Env | Default | Effect |
|---|---|---|
| `ELASTIC_URL` / `ELASTICSEARCH_URL`, `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD` | — | the shared cluster; TLS is not verified (`rejectUnauthorized: false`) |
| `IK_JUDGMENTS_INDEX`, `IK_PARAGRAPHS_INDEX` | `ik_judgments`, `ik_judgment_paragraphs` | index names (must match the Python service) |
| `LIBRARY_UPLOAD_MAX_FILES` | 20 | PDFs per request |
| `LIBRARY_UPLOAD_MAX_BYTES` | 62914560 (60 MB) | per file |
| `LIBRARY_UPLOAD_MIN_CHARS_PER_PAGE` | 120 | below this the PDF is treated as scanned → OCR |
| `DOCUMENT_AI_PROCESSOR_ID`, `GCLOUD_PROJECT_ID` / `GCS_PROJECT_ID`, `DOCUMENT_AI_LOCATION`, `GCS_KEY_BASE64` | — | OCR; unset → scanned PDFs are rejected with 422 |
| `GOOGLE_API_KEY`, `JUDGEMENT_METADATA_MODEL` (`gemini-2.5-flash`), `JUDGEMENT_METADATA_MAX_TEXT_CHARS` (24000) | — | metadata extraction; without a key only the heuristics run |
| `JWT_SECRET`, `JUDGEMENT_INTERNAL_API_KEY` / `INTERNAL_SERVICE_KEY` | — | request auth (JWT from the dashboard, or the internal key the Backend proxy sends) |
| Backend: `JUDGEMENT_SERVICE_URL` (`http://localhost:8095`), `JUDGEMENT_PROXY_TIMEOUT_MS` (600000; upload uses ≥ 900000) | | proxy target and timeouts |
| Frontend: `VITE_LIBRARY_UPLOAD_MAX_FILES` (20) | | client-side file cap |

---

## 8. Failure modes and degradation

| Situation | Behaviour |
|---|---|
| Elasticsearch unreachable | the file's result is `failed` with the error; nothing partial is written (the judgment `_create` happens before the paragraph bulk; a bulk failure after a successful create throws and is reported — re-upload is a duplicate, so delete the record and retry) |
| PDF has no text layer and OCR is unavailable / disallowed | 422 for that file, other files continue |
| Document AI error | that file `failed`, others continue |
| Gemini metadata error | `extractMetadata` falls back to heuristics (`extractionMethod: heuristic`, `needsReview: true`); the upload still succeeds |
| Court not detected | record stored with no `docsource`; the result carries a warning; court-scoped library searches will not match until the admin sets the court and the record is rebuilt |
| Same PDF uploaded again | `duplicate`, points at the existing tid |
| Edit or delete of a non-upload tid | 400 (`isUploadTid` guard) |
| Judgement Search with Qdrant down | full-text results, semantic panel shows the reason |

---

## 9. Invariants and gotchas

1. **Elasticsearch is the only store.** No Postgres row, no GCS object, no
   Qdrant point is created by this path; the older pipeline is untouched.
2. **The record shape is the library's.** Same fields, same `text`
   derivation, same chunking; the only additions are `fetched_at`,
   `source` and the non-indexed `upload` block.
3. **tid = 9 + 10 digits** derived from the text. Never overlaps Indian
   Kanoon ids; only such tids can be edited or deleted here.
4. **`doc` is the source of truth.** Edits rebuild from it; there is no
   other copy of the text and no PDF.
5. **Create-only, replace-on-edit.** A tid is never partially updated;
   an edit deletes and re-creates judgment and paragraphs together.
6. **`https://indiankanoon.org/doc/{tid}/` is not valid for uploads.** Use
   `source = "admin_upload"` to decide whether to render that link.
7. **Judge detection is heuristic** (CORAM / HON'BLE / signature lines,
   one line at a time). `author` is set only when exactly one judge is
   found. Admins can override both on upload or later.
8. **Titles are title-cased per word, last "v." becomes "vs"** — IK's own
   convention ("The State Of Karnataka").
9. **Synchronous processing.** A long scanned PDF holds the request while
   OCR runs; keep batches small on slow connections.

---

## 10. Operating

```powershell
# run locally (plain node; restart after code changes)
cd c:\Users\ADMIN\super-admin-dev\judgement-service ; node server.js      # :8095
cd c:\Users\ADMIN\super-admin-dev\Backend ; node server.js                # :4000

# how many admin uploads are in the library (read-only)
curl -sk -u "$USER:$PASS" "$ELASTIC_URL/ik_judgments/_count" -H 'Content-Type: application/json' \
  -d '{"query":{"regexp":{"tid":"9[0-9]{10}"}}}'

# one record, without the big fields
curl -sk -u "$USER:$PASS" "$ELASTIC_URL/ik_judgments/_doc/90734245700?_source_excludes=doc,text"

# its paragraph rows
curl -sk -u "$USER:$PASS" "$ELASTIC_URL/ik_judgment_paragraphs/_count" -H 'Content-Type: application/json' \
  -d '{"query":{"term":{"judgment_id":"90734245700"}}}'
```

Verification performed on 2026-09-03 against the live cluster: a synthetic
13-page judgment PDF stored, searched with strict phrases plus court and
date filters, edited (title and bench) under the same tid with the body
text preserved, re-uploaded (duplicate), and deleted; `ik_judgments` and
`ik_judgment_paragraphs` returned to their previous counts.

---

## Appendix A — Exact stored record formats

Real records read from the live cluster on 2026-09-03 (long strings
truncated, marked `…`). This is what `GET ik_judgments/_doc/90734245700`
returns for a judgment that came from a PDF upload.

### A.1 What the admin sends

```
POST /api/judgements-admin/library/upload
Authorization: Bearer <super-admin JWT>
Content-Type: multipart/form-data
  documents: Sangeeta_Agarwal_vs_Road_Transport_And_Highways_on_17_June_2013.PDF (5 pages, text layer)
  (no optional fields)
```

### A.2 PDF → stored field

| Source | Stored as (`ik_judgments`) | Transformation |
|---|---|---|
| text layer (pdf-parse) or OCR pages | — | `extractJudgmentText`; joined page texts, whitespace normalised |
| SHA-1 of that text | `tid` (keyword) and the ES `_id` | `deriveUploadTid` → `"9" + 10 digits` |
| Gemini/heuristic caseName + judgmentDate, or admin `title` | `title` | `buildIkTitle`: title-case, last "v." → "vs", `" on 17 June, 2013"` |
| generated HTML | `doc` | `buildIkHtml`, stored verbatim, not indexed |
| generated HTML | `text` | `stripHtmlLikeIk(doc)`: tags → spaces, spaces/tabs collapsed, newlines kept, entities kept |
| admin court, else court code, else text sniff | `docsource` | `resolveDocsource` (`COURT_CODE_TO_DOCSOURCE`, `DOCSOURCE_TEXT_PATTERNS`, `DOCSOURCE_ALIASES`) |
| Gemini/heuristic judgmentDate or admin `publishdate` | `publishdate` | `YYYY-MM-DD` |
| admin values or judge lines in the text | `author`, `bench` | `detectAuthorAndBench`; dropped when unknown |
| — | `numcites`, `numcitedby`, `casesCited`, `citedBy` | `0`, `0`, `[]`, `[]` |
| request time | `fetched_at` | ISO timestamp |
| — | `source` | `"admin_upload"` |
| request context | `upload` | filename, uploader, page count, text source, sha1, extraction method, review flag, raw case name / court code |

### A.3 The stored judgment document (`ik_judgments`)

```jsonc
// GET ik_judgments/_doc/90734245700
{
  "_index": "ik_judgments",
  "_id": "90734245700",
  "_source": {
    "tid": "90734245700",
    "title": "Sangeeta Agrawal vs Union Of India & Others on 17 June, 2013",
    "doc": "<h2 class=\"doc_title\">Sangeeta Agrawal vs Union Of India &amp; Others on 17 June, 2013</h2>\n\n<h3 class=\"doc_author\">Author: <a href=\"/search/?formInput=authorid:p-bhatt\">P.P. Bhatt</a></h3>\n\n<h3 class=\"doc_bench\">Bench: <a href=\"/search/?formInput=benchid:p-bhatt\">P.P. Bhatt</a></h3>\n\n<p id=\"p_1\">Sangeeta Agarwal vs Road Transport And Highways on 17 June,\n2013\nAuthor: P.P. Bhatt\nBench: P.P. Bhatt\nIN THE HIGH COURT OF JHARKHAND AT RANCHI\nW.P.(C) No. 1540 of 2013\nSangeeta Agrawal ....Petitioner\nVersus\nThe Union of India &amp; others ... Respondents\n--------\nCoram: THE HON'BLE MR JUSTICE P.P. BHATT\n-------- … </p>\n<pre id=\"pre_1\">-- 5 of 5 --</pre>   [15,690 chars]",
    "text": " Sangeeta Agrawal vs Union Of India &amp; Others on 17 June, 2013 \n\n Author: P.P. Bhatt \n\n Bench: P.P. Bhatt \n\n Sangeeta Agarwal vs Road Transport And Highways on 17 June,\n2013\nAuthor: P.P. Bhatt\nBench: P.P. Bhatt\nIN THE HIGH COURT OF JHARKHAND AT RANCHI\nW.P.(C) No. 1540 of 2013 … [15,369 chars]",
    "docsource": "Jharkhand High Court",
    "publishdate": "2013-06-17",
    "author": "P.P. Bhatt",
    "bench": "P.P. Bhatt",
    "numcites": 0,
    "numcitedby": 0,
    "casesCited": [],
    "citedBy": [],
    "fetched_at": "2026-09-03T09:58:07.167Z",
    "source": "admin_upload",
    "upload": {
      "filename": "Sangeeta_Agarwal_vs_Road_Transport_And_Highways_on_17_June_2013.PDF",
      "uploaded_at": "2026-09-03T09:58:07.167Z",
      "uploaded_by": "santosh@nexintelai.com",
      "admin_user_id": 1,
      "page_count": 5,
      "text_source": "pdf_text",
      "sha1": "bed649c421c17f48a86d587cd39804974eae41a9",
      "extraction_method": "gemini",
      "needs_review": true,
      "court_code": "UNKNOWN",
      "case_name": "Sangeeta Agrawal v. Union Of India & Others"
    }
  }
}
```

Compare JUDGMENT_LIBRARY.md A.3: the first twelve keys are the same, in the
same types and derivations. This PDF was itself a printout of an Indian
Kanoon page, which is why IK's own header lines appear inside the body
text; the upload path stores what the PDF contains.

### A.4 The paragraph documents (`ik_judgment_paragraphs`)

```jsonc
// GET ik_judgment_paragraphs/_doc/90734245700:1   (7 rows for this judgment)
{
  "_id": "90734245700:1",
  "_source": {
    "judgment_id": "90734245700",
    "paragraph_no": 1,
    "title": "Sangeeta Agrawal vs Union Of India & Others on 17 June, 2013",
    "docsource": "Jharkhand High Court",
    "publishdate": "2013-06-17",
    "bench": "P.P. Bhatt",
    "sections": ["3H", "30"],
    "text": "Sangeeta Agrawal vs Union Of India &amp; Others on 17 June, 2013\nAuthor: P.P. Bhatt\nBench: P.P. Bhatt\nSangeeta Agarwal vs Road Transport And Highways on 17 June … [2,116 chars]"
    // "acts" / "citations" omitted: none found in this chunk
  }
}
```

### A.5 Storage sequence, step by step

```
1  multer parses the multipart body into memory                       (routes/judgementRoutes.js)
2  uploadToLibrary → ingestPdf(file)                                  (per file, in order)
3  ensureIkLibraryMapping: PUT ik_judgments/_mapping { upload: { enabled: false } }   (once)
4  extractJudgmentText: pdf-parse; OCR only if < 120 chars/page
5  tid = deriveUploadTid(sha1(text)); GET ik_judgments/_doc/{tid} → exists? duplicate, STOP
6  extractMetadata (heuristics + Gemini)
7  buildRecord: title, docsource, author/bench, html, text, body, paragraphs
8  PUT ik_judgments/_create/{tid}                     201 created · 409 → duplicate, STOP
9  POST _bulk?refresh=wait_for  create ik_judgment_paragraphs {tid}:1..N
10 respond { status: 'indexed', tid, … }; the judgment is searchable when the response arrives
```

### A.6 Observed coverage (2 uploads, 2026-09-03)

| Field | Records | Note |
|---|---|---|
| `text_source = pdf_text` | 2 / 2 | both PDFs had a text layer; OCR not exercised yet |
| `author`, `bench` | 2 / 2 | detected from `Coram:` / `HON'BLE … JUSTICE` lines |
| `docsource` | 2 / 2 | one from the court code (BOMHC → Bombay High Court), one from the text (Jharkhand) |
| `needs_review` | 1 / 2 | the Jharkhand record, because the court code was UNKNOWN |
| paragraph rows | 7 and 8 | short judgments (5 and 6 pages) |
