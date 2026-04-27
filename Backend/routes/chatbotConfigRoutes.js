const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const { getConfig, updateConfig } = require('../controllers/chatbotConfigController');

const router = (pool) => {
  const r = express.Router();
  const auth = adminAuth(pool);
  r.get('/', auth, getConfig);
  r.put('/', auth, updateConfig);
  return r;
};

module.exports = router;
