const express = require('express');

module.exports = (paymentPool) => {
  const router = express.Router();

  // Reload controller so code changes apply without restarting `npm start`.
  const load = () => {
    const p = require.resolve('../controllers/monthlyPlanController');
    delete require.cache[p];
    return require(p);
  };

  // Mounted at /api/admin/monthly-plans
  router.post('/', (req, res) => load().createMonthlyPlan(req, res, paymentPool));
  router.get('/', (req, res) => load().getAllMonthlyPlans(req, res, paymentPool));
  router.get('/:id', (req, res) => load().getMonthlyPlanById(req, res, paymentPool));
  router.put('/:id', (req, res) => load().updateMonthlyPlan(req, res, paymentPool));
  router.delete('/:id', (req, res) => load().deleteMonthlyPlan(req, res, paymentPool));

  return router;
};
