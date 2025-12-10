// const Multer = require('multer');
// const { bucket } = require('../config/gcs');

// const multer = Multer({
//   storage: Multer.memoryStorage(),
//   limits: {
//     fileSize: 5 * 1024 * 1024, // No larger than 5mb
//   },
// });

// const uploadToGCS = (req, res, next) => {
//   if (!req.file) {
//     return next();
//   }

//   const gcsFileName = Date.now() + '-' + req.file.originalname;
//   const file = bucket.file(gcsFileName);

//   const stream = file.createWriteStream({
//     metadata: {
//       contentType: req.file.mimetype,
//     },
//     resumable: false,
//   });

//   stream.on('error', (err) => {
//     req.file.cloudStorageError = err;
//     next(err);
//   });

//   stream.on('finish', () => {
//     req.file.cloudStorageObject = gcsFileName;
//     req.file.gcsUrl = `https://storage.googleapis.com/${bucket.name}/${gcsFileName}`;
//     next();
//   });

//   stream.end(req.file.buffer);
// };

// module.exports = { multer, uploadToGCS };

const Multer = require('multer');
const { Storage } = require('@google-cloud/storage');

// Decode base64 from .env and parse it
const credentials = JSON.parse(
  Buffer.from(process.env.GCS_KEY_BASE64, 'base64').toString('utf-8')
);

const storage = new Storage({
  credentials,
  projectId: process.env.GCS_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Multer setup
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Max 5MB
  },
});

// GCS upload middleware
const uploadToGCS = (req, res, next) => {
  if (!req.file) return next();

  const gcsFileName = `templates/${Date.now()}-${req.file.originalname}`;
  const file = bucket.file(gcsFileName);

  const stream = file.createWriteStream({
    metadata: {
      contentType: req.file.mimetype,
    },
    resumable: false,
  });

  stream.on('error', (err) => {
    console.error('GCS Upload Error:', err);
    return res.status(500).json({ message: 'GCS Upload Failed', error: err.message });
  });

  stream.on('finish', () => {
    req.file.cloudStorageObject = gcsFileName;
    req.file.gcsUrl = `https://storage.googleapis.com/${bucket.name}/${gcsFileName}`;
    next();
  });

  stream.end(req.file.buffer);
};

module.exports = { multer, uploadToGCS, bucket };
