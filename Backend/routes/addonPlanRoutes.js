const express = require('express');

module.exports = (paymentPool) => {
  const router = express.Router();

  // Reload controller so code changes apply without restarting `npm start`.
  const load = () => {
    const p = require.resolve('../controllers/addonPlanController');
    delete require.cache[p];
    return require(p);
  };

  // Mounted at /api/admin/addon-plans
  router.post('/', (req, res) => load().createAddonPlan(req, res, paymentPool));
  router.get('/', (req, res) => load().getAllAddonPlans(req, res, paymentPool));
  router.get('/:id', (req, res) => load().getAddonPlanById(req, res, paymentPool));
  router.put('/:id', (req, res) => load().updateAddonPlan(req, res, paymentPool));
  router.delete('/:id', (req, res) => load().deleteAddonPlan(req, res, paymentPool));

  return router;
};
