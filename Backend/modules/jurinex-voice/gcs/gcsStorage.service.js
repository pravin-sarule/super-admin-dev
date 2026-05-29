/**
 * Google Cloud Storage helpers for Jurinex Voice document uploads.
 *
 * Bucket name: jurinex-voice-docs (override with GCS_VOICE_BUCKET).
 * Credentials: reuses the project-wide GCS_KEY_BASE64 (base64 of a service
 * account JSON), matching the existing convention in middleware/upload.js.
 */

const path = require('path');
const { Storage } = require('@google-cloud/storage');
const voiceLogger = require('../observability/voiceLogger');

const DEFAULT_BUCKET = 'jurinex-voice-docs';

let _client = null;
let _bucketName = null;

const getBucketName = () =>
  process.env.GCS_VOICE_BUCKET ||
  process.env.JURINEX_VOICE_GCS_BUCKET ||
  DEFAULT_BUCKET;

const getStorageClient = () => {
  if (_client) return _client;

  const keyBase64 = process.env.GCS_KEY_BASE64;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId =
    process.env.GCP_PROJECT_ID ||
    process.env.GCS_PROJECT_ID ||
    process.env.GCLOUD_PROJECT_ID;

  if (keyBase64) {
    const credentials = JSON.parse(
      Buffer.from(keyBase64, 'base64').toString('utf-8')
    );
    _client = new Storage({ credentials, projectId });
  } else if (keyFile) {
    _client = new Storage({ keyFilename: keyFile, projectId });
  } else {
    // Fall back to ADC (works on Cloud Run / GCE)
    _client = new Storage({ projectId });
  }

  _bucketName = getBucketName();
  voiceLogger.info('🪣 Jurinex Voice GCS client ready', {
    summary: { bucket: _bucketName, projectId: projectId || 'adc' },
  });
  return _client;
};

const getBucket = () => getStorageClient().bucket(getBucketName());

const safeFilename = (name = '') =>
  String(name)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 180) || 'file';

const buildGcsObjectName = (agentId, documentId, originalFilename) => {
  const agentSegment = agentId ? String(agentId) : 'global';
  const safe = safeFilename(originalFilename || 'document.bin');
  return `voice-agents/${agentSegment}/documents/${documentId}/${safe}`;
};

const getGcsUri = (bucket, objectName) => `gs://${bucket}/${objectName}`;

const getPublicUrl = (bucket, objectName) =>
  `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${objectName
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;

const uploadFileToGcs = async (fileBuffer, objectName, contentType) => {
  const bucketName = getBucketName();
  const bucket = getBucket();
  const file = bucket.file(objectName);

  await file.save(fileBuffer, {
    contentType: contentType || 'application/octet-stream',
    resumable: false,
    metadata: {
      contentType: contentType || 'application/octet-stream',
      cacheControl: 'private, max-age=0',
    },
  });

  return {
    bucket: bucketName,
    objectName,
    gcsUri: getGcsUri(bucketName, objectName),
  };
};

const buildVoicePreviewAudioObjectName = ({
  voiceKey,
  languageCode,
  liveModel,
  ttsModel,
  promptHash,
}) => {
  const voiceSegment = safeFilename(voiceKey || 'voice');
  const langSegment = safeFilename(languageCode || 'language');
  const modelSegment = safeFilename(liveModel || ttsModel || 'model');
  const hashSegment = safeFilename(promptHash || String(Date.now())).slice(0, 64);
  return `platform-voices/previews/${voiceSegment}/${langSegment}/${modelSegment}/${hashSegment}.wav`;
};

const getSignedReadUrl = async (bucketName, objectName, expiresInMinutes = 60) => {
  const bucket = bucketName ? getStorageClient().bucket(bucketName) : getBucket();
  const file = bucket.file(objectName);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });
  return url;
};

const downloadFileFromGcs = async (bucketName, objectName) => {
  const bucket = bucketName ? getStorageClient().bucket(bucketName) : getBucket();
  const file = bucket.file(objectName);
  const [contents] = await file.download();
  return contents; // Buffer
};

const fileExists = async (bucketName, objectName) => {
  const bucket = bucketName ? getStorageClient().bucket(bucketName) : getBucket();
  const [exists] = await bucket.file(objectName).exists();
  return exists;
};

const deleteFileFromGcs = async (bucketName, objectName) => {
  const bucket = bucketName ? getStorageClient().bucket(bucketName) : getBucket();
  await bucket.file(objectName).delete({ ignoreNotFound: true });
};

const detectContentTypeFromName = (filename = '') => {
  const ext = path.extname(filename).toLowerCase();
  return (
    {
      '.pdf': 'application/pdf',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
    }[ext] || 'application/octet-stream'
  );
};

module.exports = {
  getBucketName,
  buildGcsObjectName,
  buildVoicePreviewAudioObjectName,
  getGcsUri,
  getPublicUrl,
  getSignedReadUrl,
  uploadFileToGcs,
  downloadFileFromGcs,
  fileExists,
  deleteFileFromGcs,
  safeFilename,
  detectContentTypeFromName,
};
