const express = require('express');

module.exports = (analyticsController, rateCardController) => {
  const router = express.Router();

  // Static paths must be declared before /:param paths.

  // GET /api/citation-admin/analytics/heartbeat - health check
  router.get('/heartbeat', analyticsController.getHeartbeat);
  // GET /api/citation-admin/analytics/departments - dropdown options (Auth_DB firms)
  router.get('/departments', analyticsController.getDepartments);
  // GET /api/citation-admin/analytics/export - streaming CSV (?scope=users|events)
  router.get('/export', analyticsController.exportCsv);

  // --- Rate card CRUD (mutations restricted to super-admin in the controller) ---
  if (rateCardController) {
    router.get('/rate-card', rateCardController.list);
    router.post('/rate-card', rateCardController.create);
    router.put('/rate-card/:id', rateCardController.update);
    router.post('/rate-card/:id/deactivate', rateCardController.deactivate);
  }

  // GET /api/citation-admin/analytics/sessions - per-session cost rows
  router.get('/sessions', analyticsController.getSessions);
  // GET /api/citation-admin/analytics/sessions/:sessionId - full session cost breakdown
  router.get('/sessions/:sessionId', analyticsController.getSessionDetails);

  // GET /api/citation-admin/analytics/user/:userId - full user analytics
  router.get('/user/:userId', analyticsController.getUserDetails);

  // GET /api/citation-admin/analytics - full analytics payload
  router.get('/', analyticsController.getAnalytics);

  return router;
};
