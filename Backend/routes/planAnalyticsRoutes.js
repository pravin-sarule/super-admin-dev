const express = require('express');

const paymentPool = require('../config/payment_DB');
const { protect, authorize } = require('../middleware/authMiddleware');

// Read-only plan-purchase analytics. authPool (Main DB) passed in by server.js.
module.exports = (authPool) => {
  const router = express.Router();
  const pools = { authPool, paymentPool };

  router.use(protect(authPool), authorize(['user-admin', 'super-admin']));

  const load = () => {
    const p = require.resolve('../controllers/planAnalyticsController');
    delete require.cache[p];
    return require(p);
  };

  // Mounted at /api/admin/plan-analytics
  router.get('/summary', (req, res) => load().getSummary(req, res, pools));
  router.get('/monthly/:planId/subscribers', (req, res) => load().getMonthlySubscribers(req, res, pools));
  router.get('/topup/:planId/buyers', (req, res) => load().getTopupBuyers(req, res, pools));
  router.get('/addon/:planId/buyers', (req, res) => load().getAddonBuyers(req, res, pools));

  return router;
};
