
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const pool = require('../config/db'); // Main Auth DB (for users, roles, etc.)

// Import all controller functions
const {
  // Case Types & Sub-Types
  getCaseTypes,
  getSubTypesByCaseType,
  createCaseType,
  createSubType,
  deleteCaseType,
  deleteSubType,

  // Courts
  getCourts,
  getCourtsByLevel,
  getCourtById,
  createCourt,
  deleteCourt,
  createJudge,
  getJudgesByBench
} = require('../controllers/contentController');

module.exports = (docPool) => {
  /* ============================================================
     USER ROUTES
  ============================================================ */

  // ----- Case Types -----
  router.get('/case-types', (req, res) => getCaseTypes(req, res, docPool));
  router.get('/sub-types/:caseTypeId', (req, res) => getSubTypesByCaseType(req, res, docPool));

  // ----- Courts -----
  router.get('/courts', (req, res) => getCourts(req, res, docPool));
  router.get('/courts/level/:level', (req, res) => getCourtsByLevel(req, res, docPool)); // new
  router.get('/courts/:id', (req, res) => getCourtById(req, res, docPool)); // new

  /* ============================================================
     ADMIN ROUTES (Protected)
  ============================================================ */

  // ----- Case Types -----
  router.post(
    '/admin/case-types',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => createCaseType(req, res, docPool)
  );

  router.delete(
    '/admin/case-types/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => deleteCaseType(req, res, docPool)
  );

  // ----- Sub-Types -----
  router.post(
    '/admin/sub-types',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => createSubType(req, res, docPool)
  );

  router.delete(
    '/admin/sub-types/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => deleteSubType(req, res, docPool)
  );

  // ----- Courts -----
  router.post(
    '/admin/courts',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => createCourt(req, res, docPool)
  );

  router.delete(
    '/admin/courts/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => deleteCourt(req, res, docPool)
  );


  // Create new judge (admin)
router.post(
  '/admin/judges',
  protect(pool),
  authorize(['user-admin', 'super-admin']),
  (req, res) => createJudge(req, res, docPool)
);

// Fetch judges by bench (user)
router.get('/judges', (req, res) => getJudgesByBench(req, res, docPool));


  return router;
};
