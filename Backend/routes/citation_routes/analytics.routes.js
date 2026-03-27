const express = require('express');

module.exports = (analyticsController) => {
  const router = express.Router();

  // GET /api/citation-admin/analytics/heartbeat - health check (before /)
  router.get('/heartbeat', analyticsController.getHeartbeat);
  // GET /api/citation-admin/analytics/user/:userId - full user analytics
  router.get('/user/:userId', analyticsController.getUserDetails);

  // GET /api/citation-admin/analytics - full analytics payload
  router.get('/', analyticsController.getAnalytics);

  return router;
};
