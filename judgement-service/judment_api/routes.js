const express = require('express');
const controller = require('./judmentApiController');
const { authenticateApiKey } = require('./apiKeyMiddleware');

const router = express.Router();

router.use(authenticateApiKey);

router.post('/search/semantic', controller.semanticSearch);
router.post('/search/full-text', controller.fullTextSearch);
router.post('/search/hybrid', controller.hybridSearch);
router.get('/analytics', controller.getAnalytics);

module.exports = router;
