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
const agentConfigCtrl = require('./agents/voiceAgentConfig.controller');
const kbCtrl = require('./kb/kb.controller');
const callCtrl = require('./calls/voiceCall.controller');
const platformVoiceCtrl = require('./voices/platformVoice.controller');
const modelPricingCtrl = require('./models/modelPricing.controller');
const agentTestCtrl = require('./tests/agentTest.controller');
const calendarBookingsCtrl = require('./calendar/calendarBookings.controller');

const upload = Multer({
  storage: Multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const buildRouter = (pool) => {
  const router = express.Router();
  const auth = adminApiKey(pool);

  // ── Platform Voices ─────────────────────────────────────────────
  router.get('/platform-voices', auth, platformVoiceCtrl.list);
  router.post('/platform-voices/:voiceKey/preview', auth, platformVoiceCtrl.preview);

  // ── Allowed Voice Models & Pricing ──────────────────────────────
  router.get('/models/pricing', auth, modelPricingCtrl.list);

  // ── Voice Agents ─────────────────────────────────────────────────
  router.get('/agents', auth, agentCtrl.list);
  router.post('/agents', auth, agentCtrl.create);
  router.get('/agents/:agentId/config', auth, agentConfigCtrl.get);
  router.put('/agents/:agentId/config', auth, agentConfigCtrl.update);
  router.post('/agents/:agentId/test-turn', auth, agentTestCtrl.runTurn);
  router.post('/agents/:agentId/test-audio-turn', auth, upload.single('audio'), agentTestCtrl.runAudioTurn);
  router.post('/agents/:agentId/test-audio-turn-stream', auth, upload.single('audio'), agentTestCtrl.runAudioTurnStream);
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

  // ── Calendar Bookings ────────────────────────────────────────────
  router.get('/calendar/bookings', auth, calendarBookingsCtrl.list);
  router.get('/calendar/slots', auth, calendarBookingsCtrl.slots);

  // ── Call Analytics & History ────────────────────────────────────
  router.get('/calls/analytics', auth, callCtrl.getAnalytics);
  router.get('/calls/history', auth, callCtrl.listCalls);
  router.get('/calls/:callId', auth, callCtrl.getCall);

  // ── Debug ────────────────────────────────────────────────────────
  router.get('/debug/events', auth, kbCtrl.listDebugEvents);
  router.post('/debug/events', auth, kbCtrl.createDebugEvent);

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
