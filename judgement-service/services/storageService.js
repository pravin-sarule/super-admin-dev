const { v4: uuidv4 } = require('uuid');
const { bucket, bucketName } = require('../config/gcs');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Storage');

function sanitizeFilename(filename = 'judgment.pdf') {
  const normalized = String(filename || 'judgment.pdf')
    .split(/[\\/]/)
    .pop()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'judgment.pdf';
}

async function uploadBuffer(buffer, destination, contentType = 'application/octet-stream') {
  const file = bucket.file(destination);

  logger.flow('Uploading buffer to object storage', {
    bucket: bucketName,
    destination,
    contentType,
    sizeBytes: buffer?.length || 0,
  });

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'no-store',
    },
  });

  logger.info('Object storage upload complete', {
    bucket: bucketName,
    destination,
    sizeBytes: buffer?.length || 0,
  });

  return {
    bucketName,
    path: destination,
    uri: `gs://${bucketName}/${destination}`,
  };
}

async function uploadJson(value, destination) {
  const payload = Buffer.from(JSON.stringify(value, null, 2), 'utf8');
  return uploadBuffer(payload, destination, 'application/json');
}

async function downloadBuffer(path) {
  logger.flow('Downloading buffer from object storage', {
    bucket: bucketName,
    path,
  });

  const [contents] = await bucket.file(path).download();

  logger.info('Object storage download complete', {
    bucket: bucketName,
    path,
    sizeBytes: contents?.length || 0,
  });

  return contents;
}

async function getSignedReadUrl(path, expiresMinutes = 60) {
  if (!path) return null;

  logger.flow('Generating signed read URL for object storage file', {
    bucket: bucketName,
    path,
    expiresMinutes,
  });

  const [url] = await bucket.file(path).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + Math.max(1, Number(expiresMinutes || 60)) * 60 * 1000,
  });

  logger.info('Signed read URL generated', {
    bucket: bucketName,
    path,
    expiresMinutes,
  });

  return url;
}

function createJudgementUploadStorage() {
  return {
    _handleFile(req, file, callback) {
      const documentId =
        req.uploadDocumentId ||
        uuidv4();
      const sanitizedFilename = sanitizeFilename(file.originalname);
      const destination = `judgements/original/${documentId}/${sanitizedFilename}`;
      const gcsFile = bucket.file(destination);
      const contentType = file.mimetype || 'application/pdf';
      let sizeBytes = 0;
      let settled = false;

      logger.flow('Streaming multipart upload to object storage', {
        bucket: bucketName,
        destination,
        documentId,
        contentType,
        originalFilename: file.originalname,
      });

      const done = (error, info) => {
        if (settled) return;
        settled = true;
        callback(error, info);
      };

      const writeStream = gcsFile.createWriteStream({
        resumable: true,
        metadata: {
          contentType,
          cacheControl: 'no-store',
        },
      });

      file.stream.on('data', (chunk) => {
        sizeBytes += chunk.length;
      });

      file.stream.on('error', (error) => {
        logger.error('Multipart upload stream failed before storage completed', error, {
          bucket: bucketName,
          destination,
          documentId,
        });
        done(error);
      });

      writeStream.on('error', (error) => {
        logger.error('Object storage streaming upload failed', error, {
          bucket: bucketName,
          destination,
          documentId,
        });
        done(error);
      });

      writeStream.on('finish', () => {
        logger.info('Object storage streaming upload complete', {
          bucket: bucketName,
          destination,
          documentId,
          sizeBytes,
        });

        done(null, {
          bucketName,
          documentId,
          path: destination,
          uri: `gs://${bucketName}/${destination}`,
          size: sizeBytes,
          contentType,
          sanitizedFilename,
        });
      });

      file.stream.pipe(writeStream);
    },

    _removeFile(_req, file, callback) {
      if (!file?.path) {
        callback(null);
        return;
      }

      bucket
        .file(file.path)
        .delete({ ignoreNotFound: true })
        .then(() => callback(null))
        .catch((error) => callback(error));
    },
  };
}

async function deleteDocumentDirectory(documentId) {
  if (!documentId) return;

  const prefix = `judgements/original/${documentId}/`;
  logger.step('Deleting document artifacts from object storage', {
    bucket: bucketName,
    prefix,
  });

  try {
    await bucket.deleteFiles({ prefix });
    logger.info('Object storage deletion complete', {
      bucket: bucketName,
      prefix,
    });
  } catch (error) {
    logger.error('Object storage deletion failed', error, {
      bucket: bucketName,
      prefix,
    });
  }
}

module.exports = {
  createJudgementUploadStorage,
  uploadBuffer,
  uploadJson,
  downloadBuffer,
  getSignedReadUrl,
  sanitizeFilename,
  deleteDocumentDirectory,
};
