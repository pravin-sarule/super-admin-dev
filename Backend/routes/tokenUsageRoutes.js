// const express = require('express');
// const router = express.Router();
// const { protect, authorize } = require('../middleware/authMiddleware');
// const tokenUsageController = require('../controllers/tokenUsageController');

// module.exports = (pool) => {
//   // Get all token usage logs - only super-admin
//   router.get(
//     '/',
//     protect(pool),
//     authorize(['super-admin']),
//     tokenUsageController.getAllTokenUsageLogs
//   );

//   // Get aggregated statistics - only super-admin
//   router.get(
//     '/stats',
//     protect(pool),
//     authorize(['super-admin']),
//     tokenUsageController.getTokenUsageStats
//   );

//   // Get usage by user ID - only super-admin
//   router.get(
//     '/user/:userId',
//     protect(pool),
//     authorize(['super-admin']),
//     tokenUsageController.getUsageByUserId
//   );

//   return router;
// };


const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const tokenUsageController = require('../controllers/tokenUsageController');

module.exports = (pool) => {
  // Get all token usage logs - only super-admin
  router.get(
    '/',
    protect(pool),
    authorize(['super-admin']),
    tokenUsageController.getAllTokenUsageLogs
  );

  // Get aggregated statistics - only super-admin
  router.get(
    '/stats',
    protect(pool),
    authorize(['super-admin']),
    tokenUsageController.getTokenUsageStats
  );

  // Get usage by user ID - only super-admin
  router.get(
    '/user/:userId',
    protect(pool),
    authorize(['super-admin']),
    tokenUsageController.getUsageByUserId
  );

  // Get session stats summary - only super-admin
  router.get(
    '/sessions/stats',
    protect(pool),
    authorize(['super-admin']),
    tokenUsageController.getSessionStatsSummary
  );

  // Get active login users - only super-admin
  router.get(
    '/sessions/active-login',
    protect(pool),
    authorize(['super-admin']),
    tokenUsageController.getActiveLoginUsers
  );

  // Get live users - only super-admin
  router.get(
    '/sessions/live',
    protect(pool),
    authorize(['super-admin']),
    tokenUsageController.getLiveUsers
  );

  // Get all sessions - only super-admin
  router.get(
    '/sessions/all',
    protect(pool),
    authorize(['super-admin']),
    tokenUsageController.getAllSessions
  );
// Add this route with your other session routes
router.get('/sessions/details', 
  protect(pool),
   authorize(['super-admin']),
 tokenUsageController.getUserSessionDetails
);

router.get('/heartbeat', protect(pool), authorize(['super-admin']), tokenUsageController.getHeartbeatStats);

  return router;
};