const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

// Setup GCP client from base64 key (same as secret manager)
let storage;
function setupGCPStorageFromBase64() {
  try {
    const base64Key = process.env.GCS_KEY_BASE64;
    if (!base64Key) throw new Error('GCS_KEY_BASE64 is not set');

    const cleanedBase64 = base64Key.replace(/^["']|["']$/g, '').trim().replace(/\s/g, '');
    const keyJson = Buffer.from(cleanedBase64, 'base64').toString('utf8');
    const keyObject = JSON.parse(keyJson);

    if (!keyObject.private_key || !keyObject.client_email || !keyObject.project_id) {
      throw new Error('Invalid GCP key structure');
    }

    const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
    fs.writeFileSync(tempFilePath, JSON.stringify(keyObject, null, 2), 'utf8');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

    storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      keyFilename: tempFilePath,
    });
  } catch (error) {
    console.error('Error setting up GCP Storage client:', error.message);
    // Fallback to environment variable if base64 setup fails
    storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
}

if (!storage) setupGCPStorageFromBase64();

// Use LEGAL_TEMPLATES_BUCKET_NAME for template files bucket
// GCS_BUCKET_NAME is kept for other uses (like draft_template)
// Set LEGAL_TEMPLATES_BUCKET_NAME=legal-templates-bucket in your .env file
const bucketName = process.env.LEGAL_TEMPLATES_BUCKET_NAME || 'legal-templates-bucket';

console.log(`📦 Legal Templates Bucket configured: ${bucketName}`);
const bucket = storage.bucket(bucketName);

// Verify bucket exists and is accessible
(async () => {
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      console.error(`❌ WARNING: Bucket "${bucketName}" does not exist!`);
      console.error(`   Please create the bucket in GCP Console or check the bucket name.`);
      console.error(`   Expected bucket name: legal-templates-bucket`);
    } else {
      console.log(`✅ GCS Bucket "${bucketName}" is accessible`);
    }
  } catch (error) {
    console.error(`❌ Error checking bucket "${bucketName}":`, error.message);
    console.error(`   This might be a permissions issue. The service account needs:`);
    console.error(`   - storage.buckets.get`);
    console.error(`   - storage.objects.create`);
    console.error(`   - storage.objects.get`);
    console.error(`   - storage.objects.list`);
    console.error(`   Or grant the "Storage Object Admin" role for full access.`);
  }
})();

module.exports = { storage, bucket, bucketName };