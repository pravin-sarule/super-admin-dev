/**
 * HTTP controllers for KB documents and search.
 */

const crypto = require('crypto');
const path = require('path');

const repo = require('./kb.repository');
const ingest = require('./kbIngest.service');
const searchService = require('./kbSearch.service');
const {
  uploadFileToGcs,
  buildGcsObjectName,
  deleteFileFromGcs,
  getBucketName,
  detectContentTypeFromName,
} = require('../gcs/gcsStorage.service');
const { detectSourceType, SUPPORTED_EXT } = require('./textExtraction');
const { EMBEDDING_MODEL, EMBEDDING_DIM } = require('./embeddings');
const dataflow = require('../observability/dataflowLogger');
const voiceLogger = require('../observability/voiceLogger');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const parseTags = (raw) => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const startBackgroundIngest = (documentId) => {
  // Fire-and-forget; pipeline handles its own errors so the server stays up.
  setImmediate(() => {
    ingest.processDocument(documentId).catch((err) => {
      voiceLogger.error('Background ingest crashed', {
        summary: { documentId, error: err.message },
      });
    });
  });
};

// ─── Upload (multipart) ──────────────────────────────────────────────

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'file is required (multipart/form-data field name: "file")' },
      });
    }

    const { originalname, buffer, mimetype, size } = req.file;
    const sourceType = detectSourceType(originalname, mimetype);

    if (!SUPPORTED_EXT.includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Unsupported file type. Allowed: ${SUPPORTED_EXT.join(', ')}`,
        },
      });
    }

    const agent_id = req.body.agent_id || null;
    const title =
      req.body.title?.trim() ||
      path.parse(originalname).name ||
      'Untitled document';
    const language = req.body.language || null;
    const tags = parseTags(req.body.tags);
    const uploaded_by = req.user?.email || req.adminAuth?.method || 'admin';
    const file_hash = sha256(buffer);

    // Idempotency
    const existing = await repo.findByHash(file_hash);
    if (existing && existing.status === 'ready') {
      return res.status(200).json({
        success: true,
        deduplicated: true,
        document_id: existing.id,
        status: existing.status,
        gcs_uri: existing.gcs_uri,
      });
    }

    // 1. DB row first (status=processing)
    const doc = await repo.insertDocument({
      agent_id,
      title,
      source_type: sourceType,
      original_filename: originalname,
      content_type: mimetype || detectContentTypeFromName(originalname),
      file_size_bytes: size,
      file_hash,
      status: 'processing',
      embedding_model: EMBEDDING_MODEL,
      embedding_dim: EMBEDDING_DIM,
      language,
      tags,
      uploaded_by,
    });

    await dataflow.logUploadStarted({
      document_id: doc.id,
      agent_id,
      filename: originalname,
      bucket: getBucketName(),
      content_type: mimetype,
      size,
    });

    // 2. Upload to GCS
    let gcsResult;
    try {
      const objectName = buildGcsObjectName(agent_id, doc.id, originalname);
      gcsResult = await uploadFileToGcs(
        buffer,
        objectName,
        mimetype || detectContentTypeFromName(originalname)
      );
    } catch (err) {
      await dataflow.logGcsFailed({ document_id: doc.id, error: err.message });
      await repo.updateDocument(doc.id, {
        status: 'failed',
        error_message: `[gcs_upload] ${err.message}`.slice(0, 1000),
      });
      return res.status(502).json({
        success: false,
        error: { code: 'GCS_UPLOAD_FAILED', message: 'Failed to upload to GCS', detail: err.message },
        document_id: doc.id,
      });
    }

    // 3. Persist GCS metadata
    const updated = await repo.updateDocument(doc.id, {
      gcs_bucket: gcsResult.bucket,
      gcs_object_name: gcsResult.objectName,
      gcs_uri: gcsResult.gcsUri,
      source_uri: gcsResult.gcsUri,
    });

    await dataflow.logGcsUploaded({
      document_id: doc.id,
      gcs_uri: gcsResult.gcsUri,
      gcs_object_name: gcsResult.objectName,
    });

    // 4. Trigger async pipeline; respond 202.
    startBackgroundIngest(doc.id);

    return res.status(202).json({
      success: true,
      document_id: updated.id,
      status: 'processing',
      gcs_uri: gcsResult.gcsUri,
      title: updated.title,
    });
  } catch (err) {
    voiceLogger.errorWithContext('uploadDocument failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// ─── Upload (raw text / JSON) ────────────────────────────────────────

const uploadText = async (req, res) => {
  try {
    const { agent_id = null, title, text, language = null, tags = null } = req.body || {};
    if (!title || !text) {
      return res.status(400).json({
        success: false,
        error: { message: '`title` and `text` are required' },
      });
    }

    const file_hash = sha256(Buffer.from(text, 'utf8'));
    const existing = await repo.findByHash(file_hash);
    if (existing && existing.status === 'ready') {
      return res.json({
        success: true,
        deduplicated: true,
        document_id: existing.id,
        status: existing.status,
      });
    }

    const doc = await repo.insertDocument({
      agent_id,
      title,
      source_type: 'manual',
      original_filename: null,
      content_type: 'text/plain',
      file_size_bytes: Buffer.byteLength(text, 'utf8'),
      file_hash,
      raw_text: text,
      status: 'processing',
      embedding_model: EMBEDDING_MODEL,
      embedding_dim: EMBEDDING_DIM,
      language,
      tags: parseTags(tags),
      uploaded_by: req.user?.email || req.adminAuth?.method || 'admin',
    });

    await dataflow.logUploadStarted({
      document_id: doc.id,
      agent_id,
      filename: '(raw text)',
      bucket: getBucketName(),
      content_type: 'text/plain',
      size: doc.file_size_bytes,
    });

    startBackgroundIngest(doc.id);

    return res.status(202).json({
      success: true,
      document_id: doc.id,
      status: 'processing',
    });
  } catch (err) {
    voiceLogger.errorWithContext('uploadText failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// ─── List / Get / Delete ─────────────────────────────────────────────

const listDocuments = async (req, res) => {
  try {
    const { agent_id, status, source_type, limit, offset } = req.query;
    const docs = await repo.listDocuments({ agent_id, status, source_type, limit, offset });
    return res.json({ success: true, documents: docs, count: docs.length });
  } catch (err) {
    voiceLogger.errorWithContext('listDocuments failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const getDocument = async (req, res) => {
  try {
    const doc = await repo.getDocument(req.params.documentId);
    if (!doc) return res.status(404).json({ success: false, error: { message: 'Document not found' } });
    const chunks = await repo.getDocumentChunks(doc.id, { limit: 5 });
    return res.json({ success: true, document: doc, sample_chunks: chunks });
  } catch (err) {
    voiceLogger.errorWithContext('getDocument failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const removed = await repo.deleteDocument(documentId);
    if (!removed) {
      return res.status(404).json({ success: false, error: { message: 'Document not found' } });
    }
    if (removed.gcs_object_name) {
      try {
        await deleteFileFromGcs(removed.gcs_bucket, removed.gcs_object_name);
      } catch (err) {
        voiceLogger.warn('GCS delete failed (non-fatal)', {
          summary: { documentId, error: err.message },
        });
      }
    }
    return res.json({ success: true, document_id: documentId });
  } catch (err) {
    voiceLogger.errorWithContext('deleteDocument failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const reindexDocument = async (req, res) => {
  try {
    const doc = await repo.getDocument(req.params.documentId);
    if (!doc) return res.status(404).json({ success: false, error: { message: 'Document not found' } });
    await repo.updateDocument(doc.id, { status: 'processing', error_message: null });
    startBackgroundIngest(doc.id);
    return res.status(202).json({ success: true, document_id: doc.id, status: 'processing' });
  } catch (err) {
    voiceLogger.errorWithContext('reindexDocument failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// ─── Search & logs ───────────────────────────────────────────────────

const search = async (req, res) => {
  try {
    const { query, k = 5, agent_id = null, source = 'admin_test', call_id = null } = req.body || {};
    const result = await searchService.search({ query, k, agent_id, source, call_id });
    return res.json({ success: true, ...result });
  } catch (err) {
    const status = err.statusCode || 500;
    voiceLogger.errorWithContext('search failed', err, { requestId: req.requestId });
    return res.status(status).json({ success: false, error: { message: err.message } });
  }
};

const listSearchLogs = async (req, res) => {
  try {
    const { agent_id, limit, offset } = req.query;
    const rows = await repo.listSearchLogs({ agent_id, limit, offset });
    return res.json({ success: true, logs: rows });
  } catch (err) {
    voiceLogger.errorWithContext('listSearchLogs failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const listDebugEvents = async (req, res) => {
  try {
    const { event_type, trace_id, document_id, agent_id, limit, offset } = req.query;
    const rows = await repo.listDebugEvents({
      event_type,
      trace_id,
      document_id,
      agent_id,
      limit,
      offset,
    });
    return res.json({ success: true, events: rows });
  } catch (err) {
    voiceLogger.errorWithContext('listDebugEvents failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

module.exports = {
  uploadDocument,
  uploadText,
  listDocuments,
  getDocument,
  deleteDocument,
  reindexDocument,
  search,
  listSearchLogs,
  listDebugEvents,
};
