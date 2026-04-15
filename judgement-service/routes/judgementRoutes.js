const express = require('express');
const multer = require('multer');
const controller = require('../controllers/judgementController');
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

router.get('/summary', controller.getJudgementSummary);
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
