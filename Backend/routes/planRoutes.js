// const express = require('express');
// const router = express.Router();

// const {
//     createPlan,
//     getAllPlans,
//     getPlanById,
//     updatePlan,
//     deletePlan,
// } = require('../controllers/plan.controller');

// // Routes for creating a plan and getting all plans
// router.route('/')
//     .post(createPlan)
//     .get(getAllPlans);

// // Routes for getting, updating, and deleting a specific plan
// router.route('/:id')
//     .get(getPlanById)
//     .put(updatePlan)
//     .delete(deletePlan);

// module.exports = router;


// const express = require('express');
// const router = express.Router();

// // Import the controller functions
// const {
//     createPlan,
//     getAllPlans,
//     getPlanById,
//     updatePlan,
//     deletePlan,
// } = require('../controllers/plan.controller');

// // --- Define API Routes ---

// // @route   POST /api/admin/plans
// // @desc    Create a new subscription plan
// //
// // @route   GET /api/admin/plans
// // @desc    Get all plans (with optional filtering via query params)
// router.route('/')
//     .post(createPlan)
//     .get(getAllPlans);

// // @route   GET /api/admin/plans/:id
// // @desc    Get a single plan by its unique ID
// //
// // @route   PUT /api/admin/plans/:id
// // @desc    Update an existing plan by its ID
// //
// // @route   DELETE /api/admin/plans/:id
// // @desc    Delete a plan by its ID
// router.route('/:id')
//     .get(getPlanById)
//     .put(updatePlan)
//     .delete(deletePlan);

// module.exports = router;


// const express = require('express');
// const router = express.Router();

// // Import the controller functions
// const {
//     createPlan,
//     getAllPlans,
//     getPlanById,
//     updatePlan,
//     deletePlan,
// } = require('../controllers/plan.controller');

// // Route to create a new plan or get all plans (with filtering)
// router.route('/')
//     .post(createPlan)
//     .get(getAllPlans);

// // Routes to get, update, or delete a specific plan by its ID
// router.route('/:id')
//     .get(getPlanById)
//     .put(updatePlan)
//     .delete(deletePlan);

// module.exports = router;
const express = require('express');

module.exports = (paymentPool) => {
  const router = express.Router();
  const planController = require('../controllers/planController');

  // TODO: Add middleware like `authenticateAdmin` if needed

  router.post('/plans', (req, res) => planController.createPlan(req, res, paymentPool));
  router.get('/plans', (req, res) => planController.getAllPlans(req, res, paymentPool));
  router.get('/plans/:id', (req, res) => planController.getPlanById(req, res, paymentPool));
  router.put('/plans/:id', (req, res) => planController.updatePlan(req, res, paymentPool));
  router.delete('/plans/:id', (req, res) => planController.deletePlan(req, res, paymentPool));

  return router;
};
