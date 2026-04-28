const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const { getAllSessions, getSessionMessages } = require('../controllers/chatHistoryController');

const router = (pool) => {
  const r = express.Router();
  const auth = adminAuth(pool);

  r.get('/',           auth, getAllSessions);
  r.get('/:sessionId', auth, getSessionMessages);

  return r;
};

module.exports = router;
