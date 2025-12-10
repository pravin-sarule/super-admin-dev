const express = require('express');
const supportQueryController = require('../controllers/supportQueryController');
const { protect, authorize } = require('../middleware/authMiddleware');

module.exports = (pool) => { // Accept pool as an argument
  const router = express.Router();
  const supportQueryCtrl = supportQueryController(pool); // Initialize controller with pool

  // Create a new support query (accessible by authenticated users)
  router.post('/', protect(pool), supportQueryCtrl.createSupportQuery);

  // Get all support queries (Admin only)
  router.get('/all', protect(pool), authorize(['admin']), supportQueryCtrl.getAllSupportQueries);

  // Get a single support query by ID (Admin only)
  router.get('/:id', protect(pool), authorize(['admin']), supportQueryCtrl.getSupportQueryById);

  // Get support queries by user ID (Admin only, or user themselves)
  router.get('/user/:userId', protect(pool), authorize(['admin']), supportQueryCtrl.getSupportQueriesByUserId);

  // Update a support query by ID (Admin only)
  router.put('/:id', protect(pool), authorize(['admin']), supportQueryCtrl.updateSupportQuery);

  // Delete a support query by ID (Admin only)
  router.delete('/:id', protect(pool), authorize(['admin']), supportQueryCtrl.deleteSupportQuery);

  return router;
};