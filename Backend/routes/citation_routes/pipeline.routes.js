const express = require('express');

module.exports = (pipelineController) => {
    const router = express.Router();

    // GET /api/admin/citation/pipeline/summary
    router.get('/summary', pipelineController.getSummary);

    // GET /api/admin/citation/pipeline/items
    router.get('/items', pipelineController.listItems);

    // GET /api/admin/citation/pipeline/errors
    router.get('/errors', pipelineController.getRecentErrors);

    return router;
};
