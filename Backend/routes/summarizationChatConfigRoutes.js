const express = require('express');
const {
  getSummarizationChatConfig,
  createSummarizationChatConfig,
  updateSummarizationChatConfig,
  deleteSummarizationChatConfig,
} = require('../controllers/summarizationChatConfigController');
const { protect, authorize } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  const router = express.Router();
  const adminOnly = authorize(['super-admin', 'admin', 'user-admin']);

  router.get('/', protect(pool), getSummarizationChatConfig);
  router.post('/', protect(pool), adminOnly, createSummarizationChatConfig);
  router.put('/', protect(pool), adminOnly, updateSummarizationChatConfig);
  router.delete('/', protect(pool), adminOnly, deleteSummarizationChatConfig);

  return router;
};
