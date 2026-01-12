const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const fileController = require('../controllers/fileController');

module.exports = (pool) => {
  // Get total files count - only super-admin
  router.get(
    '/stats/total',
    protect(pool),
    authorize(['super-admin']),
    fileController.getTotalFilesCount
  );

  // Get user-specific files count with details - accessible by user or admin
  router.get(
    '/stats/user/:userId',
    protect(pool),
    fileController.getUserFilesCount
  );

  // Get files grouped by user - only super-admin
  router.get(
    '/stats/by-user',
    protect(pool),
    authorize(['super-admin']),
    fileController.getFilesGroupedByUser
  );
// NEW: Heartbeat endpoint
router.get('/heartbeat', protect(pool), authorize(['super-admin']), fileController.getHeartbeatFileStats);

  return router;
};