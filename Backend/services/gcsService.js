const { Storage } = require('@google-cloud/storage');

const getGcsClient = () => {
  const keyBase64 = process.env.GCS_KEY_BASE64;
  if (!keyBase64) throw new Error('GCS_KEY_BASE64 environment variable is not set');
  const credentials = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'));
  return new Storage({ credentials, projectId: process.env.GCLOUD_PROJECT_ID });
};

/**
 * Generate a v4 signed URL for direct client upload to GCS.
 * @param {string} fileName - The object name inside the input bucket
 * @param {string} contentType - MIME type of the file (default: application/pdf)
 * @returns {Promise<string>} The signed upload URL
 */
const generateSignedUrl = async (fileName, contentType = 'application/pdf') => {
  const storage = getGcsClient();
  const [url] = await storage
    .bucket(process.env.GCS_INPUT_BUCKET)
    .file(fileName)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });
  return url;
};

/**
 * List all files under a GCS prefix in the output bucket.
 * @param {string} prefix - GCS folder prefix (e.g., "ocr-output/<docId>/")
 * @returns {Promise<File[]>} Array of GCS File objects
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
 * @param {File} gcsFile - GCS File object
 * @returns {Promise<Object>} Parsed JSON object
 */
const downloadJsonFile = async (gcsFile) => {
  const [contents] = await gcsFile.download();
  return JSON.parse(contents.toString('utf8'));
};

module.exports = { getGcsClient, generateSignedUrl, listOutputFiles, downloadJsonFile };
