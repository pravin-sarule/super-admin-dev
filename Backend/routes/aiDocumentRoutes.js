const express = require('express');
const adminAuth = require('../middleware/adminAuth.middleware');
const {
  generateSignedUrlHandler,
  processDocumentHandler,
  listDocumentsHandler,
  getDocumentHandler,
  deleteDocumentHandler,
} = require('../controllers/aiDocumentController');

const router = (pool) => {
  const r = express.Router();
  const auth = adminAuth(pool);

  r.post('/generate-signed-url', auth, generateSignedUrlHandler);
  r.post('/process-document', auth, processDocumentHandler);
  r.get('/documents', auth, listDocumentsHandler);
  r.get('/documents/:id', auth, getDocumentHandler);
  r.delete('/documents/:id', auth, deleteDocumentHandler);

  return r;
};

module.exports = router;
