// routes/systemPromptRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const systemPromptController = require('../controllers/systemPromptController');

module.exports = (pool) => {
  // Create a new system prompt - only super-admin
  router.post(
    '/',
    protect(pool),
    authorize(['super-admin']),
    systemPromptController.createSystemPrompt
  );

  // Get all system prompts - only super-admin
  router.get(
    '/',
    protect(pool),
    authorize(['super-admin']),
    systemPromptController.getAllSystemPrompts
  );

  // Get a single system prompt by ID - only super-admin
  router.get(
    '/:id',
    protect(pool),
    authorize(['super-admin']),
    systemPromptController.getSystemPromptById
  );

  // Update a system prompt by ID - only super-admin
  router.put(
    '/:id',
    protect(pool),
    authorize(['super-admin']),
    systemPromptController.updateSystemPrompt
  );

  // Delete a system prompt by ID - only super-admin
  router.delete(
    '/:id',
    protect(pool),
    authorize(['super-admin']),
    systemPromptController.deleteSystemPrompt
  );

  return router;
};

