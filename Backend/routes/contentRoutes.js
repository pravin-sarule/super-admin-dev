
// const express = require('express');
// const router = express.Router();
// const { protect, authorize } = require('../middleware/authMiddleware');
// const pool = require('../config/db'); // Main Auth DB (for users, roles, etc.)

// // Import all controller functions
// const {
//   // Case Types & Sub-Types
//   getCaseTypes,
//   getSubTypesByCaseType,
//   createCaseType,
//   createSubType,
//   deleteCaseType,
//   deleteSubType,

//   // Courts
//   getCourts,
//   getCourtsByLevel,
//   getCourtById,
//   createCourt,
//   deleteCourt,
//   createJudge,
//   getJudgesByBench
// } = require('../controllers/contentController');

// module.exports = (docPool) => {
//   /* ============================================================
//      USER ROUTES
//   ============================================================ */

//   // ----- Case Types -----
//   router.get('/case-types', (req, res) => getCaseTypes(req, res, docPool));
//   router.get('/sub-types/:caseTypeId', (req, res) => getSubTypesByCaseType(req, res, docPool));

//   // ----- Courts -----
//   router.get('/courts', (req, res) => getCourts(req, res, docPool));
//   router.get('/courts/level/:level', (req, res) => getCourtsByLevel(req, res, docPool)); // new
//   router.get('/courts/:id', (req, res) => getCourtById(req, res, docPool)); // new

//   /* ============================================================
//      ADMIN ROUTES (Protected)
//   ============================================================ */

//   // ----- Case Types -----
//   router.post(
//     '/admin/case-types',
//     protect(pool),
//     authorize(['user-admin', 'super-admin']),
//     (req, res) => createCaseType(req, res, docPool)
//   );

//   router.delete(
//     '/admin/case-types/:id',
//     protect(pool),
//     authorize(['user-admin', 'super-admin']),
//     (req, res) => deleteCaseType(req, res, docPool)
//   );

//   // ----- Sub-Types -----
//   router.post(
//     '/admin/sub-types',
//     protect(pool),
//     authorize(['user-admin', 'super-admin']),
//     (req, res) => createSubType(req, res, docPool)
//   );

//   router.delete(
//     '/admin/sub-types/:id',
//     protect(pool),
//     authorize(['user-admin', 'super-admin']),
//     (req, res) => deleteSubType(req, res, docPool)
//   );

//   // ----- Courts -----
//   router.post(
//     '/admin/courts',
//     protect(pool),
//     authorize(['user-admin', 'super-admin']),
//     (req, res) => createCourt(req, res, docPool)
//   );

//   router.delete(
//     '/admin/courts/:id',
//     protect(pool),
//     authorize(['user-admin', 'super-admin']),
//     (req, res) => deleteCourt(req, res, docPool)
//   );


//   // Create new judge (admin)
// router.post(
//   '/admin/judges',
//   protect(pool),
//   authorize(['user-admin', 'super-admin']),
//   (req, res) => createJudge(req, res, docPool)
// );

// // Fetch judges by bench (user)
// router.get('/judges', (req, res) => getJudgesByBench(req, res, docPool));


//   return router;
// };



const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const pool = require('../config/db');

const {
  // Jurisdictions
  getAllJurisdictions,
  createJurisdiction,
  updateJurisdiction,
  deleteJurisdiction,

  // Courts
  getAllCourts,
  getCourtsByJurisdiction,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,

  // Benches
  getBenchesByCourt,
  createBench,
  updateBench,
  deleteBench,

  // Case Types & Sub-Types
  getCaseTypes,
  getSubTypesByCaseType,
  createCaseType,
  updateCaseType,
  deleteCaseType,
  createSubType,
  updateSubType,
  deleteSubType,

  // Judges
  getAllJudges,
  getJudgesByBench,
  createJudge,
  updateJudge,
  deleteJudge
} = require('../controllers/contentController');

module.exports = (docPool) => {
  /* ============================================================
     PUBLIC ROUTES (No Authentication Required)
  ============================================================ */

  // ----- Jurisdictions -----
  router.get('/jurisdictions', (req, res) => getAllJurisdictions(req, res, docPool));

  // ----- Courts -----
  router.get('/courts', (req, res) => getAllCourts(req, res, docPool));
  router.get('/courts/jurisdiction/:jurisdiction_id', (req, res) => 
    getCourtsByJurisdiction(req, res, docPool)
  );
  router.get('/courts/:id', (req, res) => getCourtById(req, res, docPool));

  // ----- Benches -----
  router.get('/benches/court/:court_id', (req, res) => 
    getBenchesByCourt(req, res, docPool)
  );

  // ----- Case Types -----
  router.get('/case-types', (req, res) => getCaseTypes(req, res, docPool));
  router.get('/case-types/:caseTypeId/sub-types', (req, res) => 
    getSubTypesByCaseType(req, res, docPool)
  );
  // Alternative route for sub-types (for frontend compatibility)
  router.get('/sub-types/:id', (req, res) => 
    getSubTypesByCaseType(req, res, docPool)
  );

  // ----- Judges -----
  router.get('/judges', (req, res) => getAllJudges(req, res, docPool));
  router.get('/judges/bench/:bench_id', (req, res) => 
    getJudgesByBench(req, res, docPool)
  );

  /* ============================================================
     ADMIN ROUTES (Protected - Requires Authentication & Authorization)
  ============================================================ */

  // ----- Jurisdictions (Admin) -----
  router.post(
    '/admin/jurisdictions',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    async (req, res) => {
      try {
        await createJurisdiction(req, res, docPool);
      } catch (error) {
        console.error('❌ Route handler error for createJurisdiction:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error: ' + error.message });
        }
      }
    }
  );

  router.put(
    '/admin/jurisdictions/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => updateJurisdiction(req, res, docPool)
  );

  router.delete(
    '/admin/jurisdictions/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => deleteJurisdiction(req, res, docPool)
  );

  // ----- Courts (Admin) -----
  router.post(
    '/admin/courts',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => createCourt(req, res, docPool)
  );

  router.put(
    '/admin/courts/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => updateCourt(req, res, docPool)
  );

  router.delete(
    '/admin/courts/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => deleteCourt(req, res, docPool)
  );

  // ----- Benches (Admin) -----
  router.post(
    '/admin/benches',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => createBench(req, res, docPool)
  );

  router.put(
    '/admin/benches/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => updateBench(req, res, docPool)
  );

  router.delete(
    '/admin/benches/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => deleteBench(req, res, docPool)
  );

  // ----- Case Types (Admin) -----
  router.post(
    '/admin/case-types',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => createCaseType(req, res, docPool)
  );

  router.put(
    '/admin/case-types/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => updateCaseType(req, res, docPool)
  );

  router.delete(
    '/admin/case-types/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => deleteCaseType(req, res, docPool)
  );

  // ----- Sub-Types (Admin) -----
  router.post(
    '/admin/sub-types',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => createSubType(req, res, docPool)
  );

  router.put(
    '/admin/sub-types/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => updateSubType(req, res, docPool)
  );

  router.delete(
    '/admin/sub-types/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => deleteSubType(req, res, docPool)
  );

  // ----- Judges (Admin) -----
  router.post(
    '/admin/judges',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => createJudge(req, res, docPool)
  );

  router.put(
    '/admin/judges/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => updateJudge(req, res, docPool)
  );

  router.delete(
    '/admin/judges/:id',
    protect(pool),
    authorize(['user-admin', 'super-admin']),
    (req, res) => deleteJudge(req, res, docPool)
  );

  return router;
};