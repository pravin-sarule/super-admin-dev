// routes/agentPromptRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const agentPromptController = require('../controllers/agentPromptController');

module.exports = (pool) => {
  router.post('/', protect(pool), authorize(['super-admin']), agentPromptController.createAgentPrompt);
  router.get('/', protect(pool), authorize(['super-admin']), agentPromptController.getAllAgentPrompts);
  router.get('/:id', protect(pool), authorize(['super-admin']), agentPromptController.getAgentPromptById);
  router.put('/:id', protect(pool), authorize(['super-admin']), agentPromptController.updateAgentPrompt);
  router.delete('/:id', protect(pool), authorize(['super-admin']), agentPromptController.deleteAgentPrompt);

  return router;
};
