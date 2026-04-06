const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const supportPriorityController = require('../controllers/supportPriorityController');

module.exports = (pool) => {
  const router = express.Router();
  const adminRoles = ['super-admin', 'support-admin', 'admin'];

  // GET — anyone authenticated can fetch priorities (used in create/edit forms)
  router.get('/', protect(pool), supportPriorityController.getAllPriorities);

  // POST — admin only
  router.post('/', protect(pool), authorize(adminRoles), supportPriorityController.createPriority);

  // PUT — admin only
  router.put('/:id', protect(pool), authorize(adminRoles), supportPriorityController.updatePriority);

  // DELETE — admin only
  router.delete('/:id', protect(pool), authorize(adminRoles), supportPriorityController.deletePriority);

  // PATCH toggle active — admin only
  router.patch('/:id/toggle', protect(pool), authorize(adminRoles), supportPriorityController.togglePriority);

  return router;
};
