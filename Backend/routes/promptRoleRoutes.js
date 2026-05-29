// routes/promptRoleRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  getTokenLimitByRoleId,
  getTokenLimitForUser,
} = require('../controllers/promptRoleController');

module.exports = (pool) => {
  router.get('/', protect(pool), authorize(['super-admin']), getAllRoles);
  router.get('/user/:userId/token-limit', protect(pool), authorize(['super-admin']), getTokenLimitForUser);
  router.get('/:id/token-limit', protect(pool), authorize(['super-admin']), getTokenLimitByRoleId);
  router.post('/', protect(pool), authorize(['super-admin']), createRole);
  router.put('/:id', protect(pool), authorize(['super-admin']), updateRole);
  router.delete('/:id', protect(pool), authorize(['super-admin']), deleteRole);
  return router;
};
