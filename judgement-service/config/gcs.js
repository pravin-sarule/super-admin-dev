const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config();

function decodeBase64Key() {
  const base64Key = process.env.GCS_KEY_BASE64;

  if (!base64Key) {
    throw new Error('GCS_KEY_BASE64 is not configured');
  }

  const cleanedBase64 = String(base64Key)
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/\s/g, '');

  const decoded = Buffer.from(cleanedBase64, 'base64').toString('utf8');
  const keyObject = JSON.parse(decoded);

  if (!keyObject.private_key || !keyObject.client_email || !keyObject.project_id) {
    throw new Error('Invalid GCS service-account JSON');
  }

  return keyObject;
}

let storage;
let bucket;

try {
  const credentials = decodeBase64Key();
  const tempFilePath = path.join(os.tmpdir(), 'judgement-service-gcs-key.json');
  fs.writeFileSync(tempFilePath, JSON.stringify(credentials, null, 2), 'utf8');

  storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID || credentials.project_id,
    keyFilename: tempFilePath,
  });
} catch (error) {
  console.error('[JudgementService][GCS] Failed to bootstrap credentials from base64:', error.message);
  storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
}

const bucketName = process.env.GCS_BUCKET_NAME;

if (!bucketName) {
  throw new Error('GCS_BUCKET_NAME is required for judgement-service');
}

bucket = storage.bucket(bucketName);

module.exports = {
  storage,
  bucket,
  bucketName,
};
