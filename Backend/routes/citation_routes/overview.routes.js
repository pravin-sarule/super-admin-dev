const express = require('express');

module.exports = (overviewController) => {
    const router = express.Router();

    // GET /api/admin/citation/overview
    router.get('/', overviewController.getOverview);

    return router;
};
