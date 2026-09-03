const express = require('express');
const multer = require('multer');
const controller = require('../controllers/judgementController');
const libraryController = require('../controllers/libraryUploadController');
const { authenticate, authorize } = require('../middleware/auth');
const { createJudgementUploadStorage } = require('../services/storageService');

const router = express.Router();
const uploadLimits = {};
const maxUploadBytes = Number(process.env.JUDGEMENT_UPLOAD_MAX_BYTES || 0);
const maxUploadFiles = Math.max(1, Number(process.env.JUDGEMENT_UPLOAD_MAX_FILES || 100));

if (Number.isFinite(maxUploadBytes) && maxUploadBytes > 0) {
  uploadLimits.fileSize = maxUploadBytes;
}

uploadLimits.files = maxUploadFiles;

const upload = multer({
  storage: createJudgementUploadStorage(),
  ...(Object.keys(uploadLimits).length ? { limits: uploadLimits } : {}),
});

function assignUploadContext(req, _res, next) {
  req.judgementUploadContext = {
    maxUploadFiles,
  };
  next();
}

router.use(authenticate);
router.use(authorize(['super-admin']));

// --- Library Upload: PDF -> Indian Kanoon-format record in ik_judgments (Elasticsearch only) ---
// Registered before the /:documentId routes so "library" is never read as a document id.
const libraryMaxFiles = Math.max(1, Number(process.env.LIBRARY_UPLOAD_MAX_FILES || 20));
const libraryMaxBytes = Math.max(1024 * 1024, Number(process.env.LIBRARY_UPLOAD_MAX_BYTES || 60 * 1024 * 1024));
const libraryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: libraryMaxFiles, fileSize: libraryMaxBytes },
});

router.post(
  '/library/upload',
  libraryUpload.fields([
    { name: 'documents', maxCount: libraryMaxFiles },
    { name: 'document', maxCount: 1 },
  ]),
  libraryController.uploadToLibrary
);
router.get('/library', libraryController.listLibrary);
router.get('/library/:tid/html', libraryController.getLibraryRecordHtml);
router.get('/library/:tid', libraryController.getLibraryRecord);
router.put('/library/:tid', libraryController.updateLibraryRecord);
router.delete('/library/:tid', libraryController.deleteLibraryRecord);

router.get('/summary', controller.getJudgementSummary);
router.get('/pipeline-report/summary', controller.getPipelineReportSummary);
router.get('/pipeline-report', controller.listPipelineJudgments);
router.get('/pipeline-report/:judgmentUuid/vectors', controller.getPipelineJudgmentVectors);
router.get('/pipeline-report/:judgmentUuid', controller.getPipelineJudgmentDetail);
router.get('/dependencies/health', controller.getDependencyHealthSummary);
router.get('/', controller.listJudgements);
router.post(
  '/upload',
  assignUploadContext,
  upload.fields([
    { name: 'documents', maxCount: maxUploadFiles },
    { name: 'document', maxCount: 1 },
  ]),
  controller.uploadJudgement
);
router.post('/reprocess-failed', controller.reprocessFailedJudgements);
router.get('/:documentId/pages/:pageNumber/ocr-layout', controller.getPageOcrLayout);
router.get('/:documentId/pages/:pageNumber/pdf', controller.getPagePdf);
router.get('/:documentId/status', controller.getJudgementStatus);
router.get('/:documentId/vectors', controller.getJudgementVectors);
router.get('/:documentId', controller.getJudgementDetail);
router.post('/:documentId/reprocess', controller.reprocessJudgement);
router.put('/:documentId/metadata', controller.updateJudgementMetadata);
router.put('/:documentId/archive', controller.archiveJudgment);
router.delete('/:documentId', controller.deleteJudgment);

module.exports = router;
