// routes/chunkingMethodRoutes.js
const express = require('express');
const router = express.Router();
const chunkingMethodController = require('../controllers/chunkingMethodController');

// Get all chunking methods
router.get('/', chunkingMethodController.getAllChunkingMethods);

// Add a new chunking method
router.post('/', chunkingMethodController.addChunkingMethod);

module.exports = router;