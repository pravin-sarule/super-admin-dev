
const express = require('express');
const { protect } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  const router = express.Router();
  const { loginAdmin } = require('../controllers/authController')(pool);

  router.post('/login', loginAdmin);

  router.get('/dashboard', protect(pool), (req, res) => {
    res.status(200).json({
      message: `Hello Admin ${req.user.id}`,
      user: req.user
    });
  });

  return router;
};