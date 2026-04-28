/**
 * Jurinex Voice — main router.
 *
 * Mounted at /admin/jurinex-voice. Every route is gated by the hybrid
 * X-Admin-API-Key middleware (also accepts existing Bearer JWT/admin token).
 */

const express = require('express');
const Multer = require('multer');

const adminApiKey = require('./middleware/adminApiKey.middleware');
const agentCtrl = require('./agents/voiceAgent.controller');
const kbCtrl = require('./kb/kb.controller');

const upload = Multer({
  storage: Multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const buildRouter = (pool) => {
  const router = express.Router();
  const auth = adminApiKey(pool);

  // ── Voice Agents ─────────────────────────────────────────────────
  router.get('/agents', auth, agentCtrl.list);
  router.post('/agents', auth, agentCtrl.create);
  router.get('/agents/:agentId', auth, agentCtrl.get);
  router.patch('/agents/:agentId', auth, agentCtrl.update);
  router.delete('/agents/:agentId', auth, agentCtrl.remove);

  // ── Knowledge Base ───────────────────────────────────────────────
  router.post('/kb/upload', auth, upload.single('file'), kbCtrl.uploadDocument);
  router.post('/kb/upload-text', auth, kbCtrl.uploadText);
  router.get('/kb/documents', auth, kbCtrl.listDocuments);
  router.get('/kb/documents/:documentId', auth, kbCtrl.getDocument);
  router.delete('/kb/documents/:documentId', auth, kbCtrl.deleteDocument);
  router.post('/kb/documents/:documentId/reindex', auth, kbCtrl.reindexDocument);

  router.post('/kb/search', auth, kbCtrl.search);
  router.get('/kb/search-logs', auth, kbCtrl.listSearchLogs);

  // ── Debug ────────────────────────────────────────────────────────
  router.get('/debug/events', auth, kbCtrl.listDebugEvents);

  // ── Health (no auth — used by deployment / status pages) ────────
  router.get('/health', (req, res) =>
    res.json({
      success: true,
      service: 'jurinex-voice',
      bucket:
        process.env.GCS_VOICE_BUCKET ||
        process.env.JURINEX_VOICE_GCS_BUCKET ||
        'jurinex-voice-docs',
    })
  );

  return router;
};

module.exports = buildRouter;
