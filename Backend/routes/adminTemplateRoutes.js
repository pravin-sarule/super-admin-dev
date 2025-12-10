console.log('adminTemplateRoutes module loaded.'); // Top-level log

const express = require('express');
const { multer, uploadToGCS } = require('../middleware/upload');
const {
  createTemplate,
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
} = require('../controllers/templateController');

module.exports = (pool) => { // Accept pool as an argument
  console.log('Initializing adminTemplateRoutes with pool.');
  const router = express.Router();

  // Protect all admin template routes

  router.route('/')
    .post(multer.single('templateFile'), uploadToGCS, createTemplate) // Removed redundant protect, authorize
    .get(getAllTemplates);

  router.route('/:id')
    .get(getTemplateById)
    .put(updateTemplate)
    .delete(deleteTemplate);

  return router;
};console.log('adminTemplateRoutes module loaded.');
