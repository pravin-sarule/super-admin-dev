

// // FILE: routes/secretManagerRoutes.js
// // ============================================
// const express = require('express');

// module.exports = (docDB) => {
//   console.log('🛣️  SECRET MANAGER ROUTES - Initializing with docDB');
  
//   const router = express.Router();
  
//   // Initialize controller with docDB connection
//   const secretManagerController = require('../controllers/secretManagerController');
  
//   const {
//     getAllSecrets,
//     createSecret,
//     fetchSecretValueById
//   } = secretManagerController;

//   // 🔍 GET /api/secrets → list all secrets (use ?fetch=true to include secret values)
//   router.get('/', getAllSecrets);

//   // 🔐 GET /api/secrets/:id → fetch secret value by ID
//   router.get('/:id', fetchSecretValueById);

//   // 📥 POST /api/secrets/create → add new secret to GCP + DB
//   router.post('/create', createSecret);

//   console.log('✅ SECRET MANAGER ROUTES - Registered successfully');

//   return router;
// };


// FILE: routes/secretManagerRoutes.js
// ============================================
const express = require('express');
const multer = require('multer');

module.exports = (docDB) => {
  console.log('🛣️  SECRET MANAGER ROUTES - Initializing with docDB');
  
  const router = express.Router();

  // Configure multer for memory storage (files will be in req.files as buffers)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
      // Only accept PDF files
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed'), false);
      }
    },
  });

  // Import controller
  const secretManagerController = require('../controllers/secretManagerController');

  // Destructure all controller functions
  const {
    getAllSecrets,
    createSecret,
    fetchSecretValueById,
    updateSecret,
    deleteSecret
  } = secretManagerController;

  // 🔍 GET /api/secrets → list all secrets (use ?fetch=true to include secret values)
  router.get('/', getAllSecrets);

  // 🔐 GET /api/secrets/:id → fetch single secret by ID (includes its value and template files)
  router.get('/:id', fetchSecretValueById);

  // 📥 POST /api/secrets → create new secret in GCP + docDB (multipart)
  // Fields: name, description, secret_value, llm_id, chunking_method_id, temperature, template_type, status
  // Files input_pdf + output_pdf are optional; if either is sent, both must be provided.
  router.post('/', upload.fields([
    { name: 'input_pdf', maxCount: 1 },
    { name: 'output_pdf', maxCount: 1 }
  ]), createSecret);

  // 📥 POST /api/secrets/create → create new secret (backward compatibility, same as POST /)
  router.post('/create', upload.fields([
    { name: 'input_pdf', maxCount: 1 },
    { name: 'output_pdf', maxCount: 1 }
  ]), createSecret);

  // ✏️ PUT /api/secrets/:id → update existing secret (metadata or value)
  router.put('/:id', updateSecret);

  // 🗑️ DELETE /api/secrets/:id → delete secret from GCP + docDB
  router.delete('/:id', deleteSecret);

  console.log('✅ SECRET MANAGER ROUTES - Registered successfully');
  return router;
};
