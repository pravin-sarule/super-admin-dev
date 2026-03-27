const express = require('express');

module.exports = (routesdbController) => {
    const router = express.Router();

    // GET /api/admin/citation/routesdb/summary
    router.get('/summary', routesdbController.getSummary);

    // GET /api/admin/citation/routesdb/top-cited
    router.get('/top-cited', routesdbController.getTopCited);

    // GET /api/admin/citation/routesdb/courts-breakdown
    router.get('/courts-breakdown', routesdbController.getCourtsBreakdown);

    return router;
};
