const { Storage } = require('@google-cloud/storage');

// Singleton — avoids creating a new Storage instance on every GCS call
let _storage = null;
const getGcsClient = () => {
  if (_storage) return _storage;
  const keyBase64 = process.env.GCS_KEY_BASE64;
  if (!keyBase64) throw new Error('GCS_KEY_BASE64 environment variable is not set');
  const credentials = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'));
  _storage = new Storage({ credentials, projectId: process.env.GCLOUD_PROJECT_ID });
  return _storage;
};

/**
 * Generate a v4 signed URL for direct client upload to GCS.
 */
const generateSignedUrl = async (fileName, contentType = 'application/pdf') => {
  const storage = getGcsClient();
  const [url] = await storage
    .bucket(process.env.GCS_INPUT_BUCKET)
    .file(fileName)
    .getSignedUrl({
      version:     'v4',
      action:      'write',
      expires:     Date.now() + 15 * 60 * 1000,
      contentType,
    });
  return url;
};

/**
 * List all files under a GCS prefix in the output bucket.
 */
const listOutputFiles = async (prefix) => {
  const storage = getGcsClient();
  const [files] = await storage
    .bucket(process.env.GCS_OUTPUT_BUCKET)
    .getFiles({ prefix });
  return files;
};

/**
 * Download and parse a JSON file from GCS.
 */
const downloadJsonFile = async (gcsFile) => {
  const [contents] = await gcsFile.download();
  return JSON.parse(contents.toString('utf8'));
};

/**
 * Download a file from a full gs://bucket/object path as a Buffer.
 */
const downloadGsUriToBuffer = async (gcsUri) => {
  const m = String(gcsUri).match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!m) throw new Error(`Invalid GCS URI: ${gcsUri}`);
  const [, bucket, objectPath] = m;
  const storage = getGcsClient();
  const [buf] = await storage.bucket(bucket).file(objectPath).download();
  return buf;
};

module.exports = { getGcsClient, generateSignedUrl, listOutputFiles, downloadJsonFile, downloadGsUriToBuffer };
