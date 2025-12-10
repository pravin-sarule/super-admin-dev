const express = require('express');
const router = express.Router();
const customQueryController = require('../controllers/customQueryController');

router.get('/', customQueryController.getSelectedLLM);
router.post('/', customQueryController.setSelectedLLM);

module.exports = router;

