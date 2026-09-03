// controllers/libraryUploadController.js
// Admin "Library Upload": PDFs -> Indian Kanoon-format records in ik_judgments.
const libraryUploadService = require('../services/libraryUploadService');
const { wrapIkHtmlPage } = require('../services/ikFormatService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('LibraryUploadController');

function adminFromRequest(req) {
  return {
    id: req.user?.id ?? null,
    email: req.user?.email || null,
    role: req.user?.role || null,
  };
}

function sendError(res, error, fallbackMessage) {
  const statusCode = Number(error.statusCode) || 500;
  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

function collectPdfFiles(req) {
  const files = [];
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files && typeof req.files === 'object') {
    for (const list of Object.values(req.files)) {
      if (Array.isArray(list)) files.push(...list);
    }
  }
  if (req.file) files.push(req.file);

  return files.filter((file) => file && file.buffer && file.buffer.length);
}

function isPdf(file) {
  const name = String(file.originalname || '').toLowerCase();
  const type = String(file.mimetype || '').toLowerCase();
  return name.endsWith('.pdf') || type === 'application/pdf';
}

/** Optional per-request fields applied to every uploaded file. */
function fieldsFromBody(body = {}) {
  const fields = {};
  for (const key of ['title', 'docsource', 'publishdate', 'author', 'bench']) {
    if (body[key] !== undefined && String(body[key]).trim() !== '') fields[key] = String(body[key]);
  }
  // Accept the form's judgmentDate alias as well.
  if (fields.publishdate === undefined && body.judgmentDate) fields.publishdate = String(body.judgmentDate);
  return fields;
}

async function uploadToLibrary(req, res) {
  const files = collectPdfFiles(req);
  const admin = adminFromRequest(req);
  const fields = fieldsFromBody(req.body || {});
  const allowOcr = String(req.body?.allowOcr ?? '1') !== '0';

  logger.step('Library upload requested', {
    files: files.map((file) => ({ name: file.originalname, bytes: file.size || file.buffer.length })),
    fields: Object.keys(fields),
    allowOcr,
    adminUserId: admin.id,
  });

  if (!files.length) {
    return res.status(400).json({ success: false, message: 'At least one PDF file is required (field "documents")' });
  }

  // A title can only describe one judgment; never stamp it on a whole batch.
  if (files.length > 1 && fields.title !== undefined) {
    delete fields.title;
  }

  const results = [];
  for (const file of files) {
    const filename = file.originalname || 'judgment.pdf';
    if (!isPdf(file)) {
      results.push({ filename, status: 'failed', error: 'Only PDF files are accepted' });
      continue;
    }
    try {
      const result = await libraryUploadService.ingestPdf({
        buffer: file.buffer,
        filename,
        fields,
        admin,
        allowOcr,
      });
      results.push(result);
    } catch (error) {
      logger.error('Library upload failed for file', error, { filename });
      results.push({ filename, status: 'failed', error: error.message });
    }
  }

  const summary = results.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    { indexed: 0, duplicate: 0, failed: 0 }
  );

  const allFailed = summary.indexed === 0 && summary.duplicate === 0;
  return res.status(allFailed ? 422 : 200).json({
    success: !allFailed,
    message: allFailed
      ? 'No judgment could be stored'
      : `${summary.indexed} stored, ${summary.duplicate} duplicate, ${summary.failed} failed`,
    summary,
    results,
  });
}

async function listLibrary(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(200, Math.max(1, Number(req.query.size) || 20));
    const result = await libraryUploadService.listLibraryUploads({
      search: req.query.search || '',
      from: (page - 1) * size,
      size,
    });
    return res.json({ success: true, page, size, total: result.total, rows: result.rows });
  } catch (error) {
    logger.error('Library list failed', error);
    return sendError(res, error, 'Failed to list library uploads');
  }
}

async function getLibraryRecord(req, res) {
  try {
    const record = await libraryUploadService.getLibraryUpload(req.params.tid);
    return res.json({ success: true, record });
  } catch (error) {
    return sendError(res, error, 'Failed to load library record');
  }
}

async function getLibraryRecordHtml(req, res) {
  try {
    const document = await libraryUploadService.getLibraryUploadHtml(req.params.tid);
    const raw = String(req.query.raw || '') === '1';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(raw ? document.html : wrapIkHtmlPage(document.html, document.title));
  } catch (error) {
    return sendError(res, error, 'Failed to render library HTML');
  }
}

async function updateLibraryRecord(req, res) {
  try {
    const record = await libraryUploadService.updateLibraryUpload(req.params.tid, req.body || {}, adminFromRequest(req));
    return res.json({ success: true, message: 'Library record updated', record });
  } catch (error) {
    logger.error('Library update failed', error, { tid: req.params.tid });
    return sendError(res, error, 'Failed to update library record');
  }
}

async function deleteLibraryRecord(req, res) {
  try {
    const result = await libraryUploadService.deleteLibraryUpload(req.params.tid, adminFromRequest(req));
    return res.json({ success: true, message: `Removed tid ${result.tid} from the library`, result });
  } catch (error) {
    logger.error('Library delete failed', error, { tid: req.params.tid });
    return sendError(res, error, 'Failed to delete library record');
  }
}

module.exports = {
  uploadToLibrary,
  listLibrary,
  getLibraryRecord,
  getLibraryRecordHtml,
  updateLibraryRecord,
  deleteLibraryRecord,
};
