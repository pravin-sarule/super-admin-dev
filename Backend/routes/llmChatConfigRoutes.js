const express = require('express');
const {
  getLlmChatConfig,
  createLlmChatConfig,
  updateLlmChatConfig,
  deleteLlmChatConfig,
} = require('../controllers/llmChatConfigController');
const { protect, authorize } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  const router = express.Router();

  const adminOnly = authorize(['super-admin', 'admin', 'user-admin']);

  // GET /api/admin/llm-config — fetch current config (any authenticated admin)
  router.get('/', protect(pool), getLlmChatConfig);

  // POST /api/admin/llm-config — create singleton config when none exists
  router.post('/', protect(pool), adminOnly, createLlmChatConfig);

  // PUT /api/admin/llm-config — partial or full update
  router.put('/', protect(pool), adminOnly, updateLlmChatConfig);

  // DELETE /api/admin/llm-config — remove config row
  router.delete('/', protect(pool), adminOnly, deleteLlmChatConfig);

  return router;
};
