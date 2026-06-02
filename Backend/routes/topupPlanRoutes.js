const express = require('express');

module.exports = (paymentPool) => {
  const router = express.Router();

  // Reload controller so code changes apply without restarting `npm start`.
  const load = () => {
    const p = require.resolve('../controllers/topupPlanController');
    delete require.cache[p];
    return require(p);
  };

  // Mounted at /api/admin/topup-plans
  router.post('/', (req, res) => load().createTopupPlan(req, res, paymentPool));
  router.get('/', (req, res) => load().getAllTopupPlans(req, res, paymentPool));
  router.get('/:id', (req, res) => load().getTopupPlanById(req, res, paymentPool));
  router.put('/:id', (req, res) => load().updateTopupPlan(req, res, paymentPool));
  router.delete('/:id', (req, res) => load().deleteTopupPlan(req, res, paymentPool));

  return router;
};
