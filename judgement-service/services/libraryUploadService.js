/**
 * libraryUploadService
 *
 * Admin "Library Upload": a court PDF goes straight into the shared judgment
 * library (`ik_judgments` + `ik_judgment_paragraphs`) in exactly the record
 * shape the library stores Indian Kanoon judgments (JUDGMENT_LIBRARY.md A.3/A.4).
 *
 * Elasticsearch is the ONLY store:
 *   - no Postgres row, no GCS copy of the PDF, no Qdrant, no chunk tables
 *   - the stored `doc` HTML is the source of truth; a title / court / judge edit
 *     rebuilds the record from it (bodyTextFromIkHtml), so nothing else needs
 *     to be kept
 *   - the tid is derived from the SHA-1 of the extracted text, so the same PDF
 *     uploaded twice lands on the same id and is reported as a duplicate
 *
 * Processing is synchronous: the upload request returns once the judgment is
 * searchable (or with the reason it was not stored).
 */
const crypto = require('crypto');
const {
  extractTextFromPdfBuffer,
  splitPdfIntoPages,
  mergePdfBuffers,
  normalizeWhitespace,
} = require('./pdfService');
const { extractMetadata } = require('./metadataService');
const es = require('./elasticsearchService');
const ik = require('./ikFormatService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('LibraryUpload');

/** Document AI's synchronous endpoint accepts at most 15 pages per call. */
const OCR_BATCH_PAGES = 15;
/** Below this many characters per page the PDF is treated as scanned. */
const MIN_CHARS_PER_PAGE = Math.max(20, Number(process.env.LIBRARY_UPLOAD_MIN_CHARS_PER_PAGE || 120));

/** Fields an admin may set on a record; anything else is derived from the text. */
const EDITABLE_FIELDS = ['title', 'docsource', 'publishdate', 'author', 'bench'];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex');
}

function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/**
 * Keep only the editable keys. `undefined` = untouched, '' = clear (null).
 */
function pickOverrides(input = {}) {
  const picked = {};
  for (const key of EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input || {}, key) || input[key] === undefined) continue;
    const text = ik.squashWs(input[key]);
    picked[key] = text || null;
  }
  if (picked.publishdate) {
    const iso = toIsoDate(picked.publishdate);
    if (!iso) throw httpError(400, 'publishdate must be YYYY-MM-DD');
    picked.publishdate = iso;
  }
  return picked;
}

function ocrConfigured() {
  return Boolean(
    String(process.env.DOCUMENT_AI_PROCESSOR_ID || '').trim()
      && (process.env.GCLOUD_PROJECT_ID || process.env.GCS_PROJECT_ID)
  );
}

/** Scanned PDF: OCR every page through Document AI in ≤15-page batches, in order. */
async function runOcr(buffer) {
  // Lazy: documentAiService bootstraps Google credentials when it is loaded.
  const { processBatchPdf } = require('./documentAiService');

  const pages = await splitPdfIntoPages(buffer);
  const texts = [];
  for (let start = 0; start < pages.length; start += OCR_BATCH_PAGES) {
    const batch = pages.slice(start, start + OCR_BATCH_PAGES);
    const batchPdf = batch.length === 1 ? batch[0].buffer : await mergePdfBuffers(batch.map((page) => page.buffer));
    const result = await processBatchPdf(batchPdf);
    const extracted = Array.isArray(result.pages) ? result.pages : [];
    for (let i = 0; i < batch.length; i += 1) {
      texts.push(normalizeWhitespace(extracted[i]?.text || ''));
    }
  }
  return { text: texts.filter(Boolean).join('\n\n').trim(), pageCount: pages.length };
}

/**
 * Text layer first; OCR only when the PDF is effectively image-only.
 * Returns { text, pageCount, textSource: 'pdf_text' | 'ocr' }.
 */
async function extractJudgmentText(buffer, { allowOcr = true } = {}) {
  const parsed = await extractTextFromPdfBuffer(buffer);
  const pageCount = Math.max(1, Number(parsed.pageCount || 1));
  const text = String(parsed.text || '').trim();
  const charsPerPage = text.length / pageCount;

  if (text && charsPerPage >= MIN_CHARS_PER_PAGE) {
    return { text, pageCount, textSource: 'pdf_text' };
  }

  if (!allowOcr) {
    throw httpError(422, 'The PDF has no usable text layer and OCR was not allowed for this request');
  }
  if (!ocrConfigured()) {
    throw httpError(422, 'The PDF has no usable text layer and Document AI OCR is not configured (DOCUMENT_AI_PROCESSOR_ID)');
  }

  logger.step('PDF has no text layer; running Document AI OCR', { pageCount, charsPerPage: Math.round(charsPerPage) });
  const ocr = await runOcr(buffer);
  if (!ocr.text) throw httpError(422, 'OCR produced no text for this PDF');
  return { text: ocr.text, pageCount: ocr.pageCount, textSource: 'ocr' };
}

/**
 * Build the library record from judgment text + resolved fields.
 * `fields` may carry title/docsource/publishdate/author/bench; missing ones are
 * derived (title from caseName+date, court from code/text, judges from text).
 */
function buildRecord({ text, tid, fields = {}, caseName = null, courtCode = null, fetchedAt, upload }) {
  const publishdate = toIsoDate(fields.publishdate);
  const title = fields.title || ik.buildIkTitle({ caseName: caseName || 'Untitled Judgment', judgmentDate: publishdate });
  const court = ik.resolveDocsource({ docsource: fields.docsource, courtCode, fullText: text });
  const detected = ik.detectAuthorAndBench(text);
  const has = (key) => Object.prototype.hasOwnProperty.call(fields, key);
  const author = has('author') ? fields.author : detected.author;
  const bench = has('bench') ? fields.bench : detected.bench;

  const { html, structure } = ik.buildIkHtml({ title, author, bench, fullText: text });
  const body = ik.buildIkJudgmentBody({
    tid,
    title,
    html,
    docsource: court.docsource,
    publishdate,
    author,
    bench,
    fetchedAt,
    upload,
  });
  const paragraphs = ik.buildParagraphRows(tid, body);

  const warnings = [];
  if (!court.docsource) warnings.push('Court could not be determined; set the court name so court-scoped searches can find this judgment.');
  if (!publishdate) warnings.push('Judgment date is missing; date filters will not match this judgment.');
  if (!bench) warnings.push('No judge names were detected; author and bench are empty.');
  if (!paragraphs.length) warnings.push('The judgment produced no paragraph rows.');

  return { body, paragraphs, html, structure, court, detected, warnings };
}

function summarize(body, extra = {}) {
  return {
    tid: body.tid,
    title: body.title || null,
    docsource: body.docsource || null,
    publishdate: body.publishdate || null,
    author: body.author || null,
    bench: body.bench || null,
    textChars: String(body.text || '').length,
    htmlChars: String(body.doc || '').length,
    fetchedAt: body.fetched_at || null,
    upload: body.upload || null,
    ...extra,
  };
}

/**
 * Store one PDF in the library. Returns one of:
 *   { status: 'indexed',   tid, ...record summary, paragraphCount, warnings }
 *   { status: 'duplicate', tid, existing: summary }   – same text already stored
 */
async function ingestPdf({ buffer, filename, fields = {}, admin = {}, allowOcr = true }) {
  if (!buffer || !buffer.length) throw httpError(400, 'Empty file');

  await es.ensureIkLibraryMapping();

  const startedAt = Date.now();
  const extracted = await extractJudgmentText(buffer, { allowOcr });
  const contentSha1 = sha1(extracted.text);
  const tid = ik.deriveUploadTid(contentSha1);

  const existing = await es.getIkJudgmentSource(tid);
  if (existing) {
    logger.warn('Library upload is a duplicate of an existing record', { filename, tid });
    return { status: 'duplicate', tid, filename, existing: summarize(existing) };
  }

  // Case name / court / date from the text (heuristics + Gemini when configured).
  const metadata = await extractMetadata({ fullText: extracted.text, originalFilename: filename, sourceUrl: '' });
  const overrides = pickOverrides(fields);
  const resolvedFields = {
    ...overrides,
    ...(overrides.publishdate === undefined && metadata.judgmentDate ? { publishdate: metadata.judgmentDate } : {}),
  };

  const fetchedAt = new Date().toISOString();
  const upload = {
    filename: String(filename || 'judgment.pdf'),
    uploaded_at: fetchedAt,
    uploaded_by: admin.email || null,
    admin_user_id: admin.id ?? null,
    page_count: extracted.pageCount,
    text_source: extracted.textSource,
    sha1: contentSha1,
    extraction_method: metadata.extractionMethod || null,
    needs_review: Boolean(metadata.needsReview),
    court_code: metadata.courtCode || null,
    case_name: metadata.caseName || null,
  };

  const built = buildRecord({
    text: extracted.text,
    tid,
    fields: resolvedFields,
    caseName: metadata.caseName,
    courtCode: metadata.courtCode,
    fetchedAt,
    upload,
  });

  const created = await es.createIkJudgmentDocument(tid, built.body);
  if (!created.created) {
    return { status: 'duplicate', tid, filename, existing: summarize(created.existing || {}) };
  }
  const paragraphSummary = await es.bulkCreateIkParagraphs(built.paragraphs);

  logger.info('Judgment stored in library from upload', {
    filename,
    tid,
    title: built.body.title,
    docsource: built.body.docsource,
    publishdate: built.body.publishdate,
    textSource: extracted.textSource,
    pageCount: extracted.pageCount,
    paragraphs: built.paragraphs.length,
    durationMs: Date.now() - startedAt,
    adminUserId: admin.id ?? null,
  });

  return {
    status: 'indexed',
    filename,
    ...summarize(built.body),
    paragraphCount: built.paragraphs.length,
    paragraphSummary,
    structure: built.structure,
    docsourceResolvedFrom: built.court.source,
    detectedAuthor: built.detected.author,
    detectedBench: built.detected.bench,
    warnings: built.warnings,
    durationMs: Date.now() - startedAt,
  };
}

async function requireUploadRecord(tid) {
  const id = String(tid || '').trim();
  if (!ik.isUploadTid(id)) throw httpError(400, 'Not an admin-upload tid');
  const source = await es.getIkJudgmentSource(id);
  if (!source) throw httpError(404, 'Judgment not found in the library');
  return source;
}

async function listLibraryUploads({ search = '', from = 0, size = 20 } = {}) {
  return es.searchIkAdminUploads({ search, from, size });
}

async function getLibraryUpload(tid) {
  const source = await requireUploadRecord(tid);
  const paragraphCount = await es.countIkParagraphs(source.tid).catch(() => 0);
  return {
    ...summarize(source),
    paragraphCount,
    document: ik.toIkDocResponse(source),
    text: source.text || '',
  };
}

async function getLibraryUploadHtml(tid) {
  const source = await requireUploadRecord(tid);
  return { html: source.doc || '', title: source.title || null, tid: source.tid };
}

/**
 * Edit title / court / date / author / bench. The body text is recovered from
 * the stored HTML, the record is rebuilt and replaced under the same tid.
 */
async function updateLibraryUpload(tid, input = {}, admin = {}) {
  const source = await requireUploadRecord(tid);
  const overrides = pickOverrides(input);
  if (!Object.keys(overrides).length) throw httpError(400, `Nothing to update; editable fields: ${EDITABLE_FIELDS.join(', ')}`);

  const text = ik.bodyTextFromIkHtml(source.doc);
  if (!text) throw httpError(422, 'Stored HTML has no body text to rebuild from');

  const fields = {
    title: source.title || null,
    docsource: source.docsource || null,
    publishdate: source.publishdate || null,
    author: source.author || null,
    bench: source.bench || null,
    ...overrides,
  };
  const upload = {
    ...(source.upload && typeof source.upload === 'object' ? source.upload : {}),
    updated_at: new Date().toISOString(),
    updated_by: admin.email || null,
  };

  const built = buildRecord({
    text,
    tid: source.tid,
    fields,
    caseName: source.upload?.case_name || null,
    courtCode: source.upload?.court_code || null,
    fetchedAt: source.fetched_at || new Date().toISOString(),
    upload,
  });

  await es.deleteIkJudgmentDocument(source.tid);
  const created = await es.createIkJudgmentDocument(source.tid, built.body);
  if (!created.created) throw new Error('Could not replace the library record');
  const paragraphSummary = await es.bulkCreateIkParagraphs(built.paragraphs);

  logger.info('Library record rebuilt after edit', {
    tid: source.tid,
    changed: Object.keys(overrides),
    paragraphs: built.paragraphs.length,
    adminUserId: admin.id ?? null,
  });

  return {
    status: 'indexed',
    ...summarize(built.body),
    paragraphCount: built.paragraphs.length,
    paragraphSummary,
    structure: built.structure,
    warnings: built.warnings,
    changed: Object.keys(overrides),
  };
}

async function deleteLibraryUpload(tid, admin = {}) {
  const source = await requireUploadRecord(tid);
  const removed = await es.deleteIkJudgmentDocument(source.tid);
  logger.info('Library record deleted', { tid: source.tid, adminUserId: admin.id ?? null, ...removed });
  return { tid: source.tid, title: source.title || null, ...removed };
}

module.exports = {
  EDITABLE_FIELDS,
  extractJudgmentText,
  ingestPdf,
  listLibraryUploads,
  getLibraryUpload,
  getLibraryUploadHtml,
  updateLibraryUpload,
  deleteLibraryUpload,
};
