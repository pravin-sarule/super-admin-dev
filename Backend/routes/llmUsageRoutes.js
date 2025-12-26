const express = require('express');

const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');

const llmUsageController = require('../controllers/llmUsageController');

module.exports = (pool) => {
  // Get all LLM usage logs - only super-admin
  router.get(
    '/',
    protect(pool),
    authorize(['super-admin']),
    llmUsageController.getAllLlmUsageLogs
  );

  // Get aggregated statistics - only super-admin
  router.get(
    '/stats',
    protect(pool),
    authorize(['super-admin']),
    llmUsageController.getLlmUsageStats
  );

  // Get usage by user ID - only super-admin
  router.get(
    '/user/:userId',
    protect(pool),
    authorize(['super-admin']),
    llmUsageController.getUsageByUserId
  );

  return router;
};




