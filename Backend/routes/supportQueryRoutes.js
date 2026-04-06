const express = require('express');
const supportQueryController = require('../controllers/supportQueryController');
const { protect, authorize } = require('../middleware/authMiddleware');

module.exports = (pool) => { // Accept pool as an argument
  const router = express.Router();
  const supportQueryCtrl = supportQueryController(pool); // Initialize controller with pool
  const supportQueryAdminRoles = ['super-admin', 'support-admin', 'admin'];

  // Create a new support query (admin support team only)
  router.post('/', protect(pool), authorize(supportQueryAdminRoles), supportQueryCtrl.createSupportQuery);

  // Get all support queries (Admin only)
  router.get('/all', protect(pool), authorize(supportQueryAdminRoles), supportQueryCtrl.getAllSupportQueries);

  // Stream an attachment preview for a support query inside the admin dashboard
  router.get(
    '/:id/attachment/preview',
    protect(pool),
    authorize(supportQueryAdminRoles),
    supportQueryCtrl.previewSupportQueryAttachment
  );

  // Get a single support query by ID (Admin only)
  router.get('/:id', protect(pool), authorize(supportQueryAdminRoles), supportQueryCtrl.getSupportQueryById);

  // Get support queries by user ID (Admin only, or user themselves)
  router.get('/user/:userId', protect(pool), authorize(supportQueryAdminRoles), supportQueryCtrl.getSupportQueriesByUserId);

  // Update a support query by ID (Admin only)
  router.put('/:id', protect(pool), authorize(supportQueryAdminRoles), supportQueryCtrl.updateSupportQuery);

  // Delete a support query by ID (Admin only)
  router.delete('/:id', protect(pool), authorize(supportQueryAdminRoles), supportQueryCtrl.deleteSupportQuery);

  return router;
};
