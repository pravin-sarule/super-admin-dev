const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const { getConfig, updateConfig } = require('../controllers/chatbotConfigController');
const { voicePreview } = require('../controllers/voicePreviewController');

const router = (pool) => {
  const r = express.Router();
  const auth = adminAuth(pool);
  r.get('/', auth, getConfig);
  r.put('/', auth, updateConfig);
  r.get('/voice-preview/:voiceName', auth, voicePreview);
  return r;
};

module.exports = router;
