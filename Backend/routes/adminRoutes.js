// const express = require('express');
// const { protect, authorize } = require('../middleware/authMiddleware');
// module.exports = (pool) => {
//   const router = express.Router();
//   const { createAdmin } = require('../controllers/adminController')(pool);

//   // Only super-admin can create other admins
//   router.post('/create', protect(pool), authorize(['super-admin']), createAdmin);

//   return router;
// };


const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  const router = express.Router();
  const {
    createAdmin,
    fetchAdmins,
    updateAdmin,
    deleteAdmin
  } = require('../controllers/adminController')(pool);

  // ========================
  // ADMIN ROUTES
  // ========================

  // Create a new admin - only super-admin
  router.post('/create', protect(pool), authorize(['super-admin']), createAdmin);

  // Fetch all admins - super-admin and admin roles
  router.get('/', protect(pool), authorize(['super-admin']), fetchAdmins);

  // Update an admin by ID - only super-admin
  router.put('/:id', protect(pool), authorize(['super-admin']), updateAdmin);

  // Delete an admin by ID - only super-admin
  router.delete('/:id', protect(pool), authorize(['super-admin']), deleteAdmin);

  return router;
};
