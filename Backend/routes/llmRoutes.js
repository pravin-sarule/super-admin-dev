// routes/llmRoutes.js
const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const llmController = require('../controllers/llmModelController');

// LLM model + token-limit administration. This is a super-admin-only surface
// (matches the "LLM Management" dashboard page). Previously these routes had
// NO authentication at all, so any caller could add/delete models and change
// token limits — now gated behind a valid admin JWT with the super-admin role.
module.exports = (pool) => {
  const router = express.Router();

  router.use(protect(pool), authorize(['super-admin']));

  // Get all LLM models
  router.get('/', llmController.getAllLLMModels);

  // Add a new LLM model
  router.post('/', llmController.addLLMModel);

  // Create a new LLM max token configuration
  router.post('/max-tokens', llmController.createMaxTokenEntry);

  // Get all LLM max token configurations
  router.get('/max-tokens', llmController.getAllMaxTokenEntries);

  // Update / delete a specific LLM max token configuration
  router.put('/max-tokens/:id', llmController.updateMaxTokenEntry);
  router.delete('/max-tokens/:id', llmController.deleteMaxTokenEntry);

  // Delete an LLM model
  router.delete('/:id', llmController.deleteLLMModel);

  // Get / update LLM model parameters (temperature, thinking, tools, etc.)
  router.get('/:id/parameters', llmController.getModelParameters);
  router.put('/:id/parameters', llmController.updateModelParameters);

  return router;
};
