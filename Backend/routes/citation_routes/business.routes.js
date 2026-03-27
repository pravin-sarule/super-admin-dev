const express = require('express');

module.exports = (businessController) => {
    const router = express.Router();

    // GET /api/admin/citation/business/summary
    router.get('/summary', businessController.getSummary);

    // GET /api/admin/citation/business/reports-per-day
    router.get('/reports-per-day', businessController.getReportsPerDay);

    // GET /api/admin/citation/business/top-users
    router.get('/top-users', businessController.getTopUsers);

    return router;
};
