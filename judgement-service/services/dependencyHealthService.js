const pool = require('../config/db');
const { bucket, bucketName } = require('../config/gcs');
const { checkElasticsearchHealth } = require('./elasticsearchService');
const { checkQdrantHealth } = require('./qdrantService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('DependencyHealth');

async function runCheck(key, label, checkFn) {
  const startedAt = Date.now();

  try {
    const result = await checkFn();

    return {
      key,
      label,
      status: 'healthy',
      message: result?.message || 'Available',
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      details: result?.details || null,
    };
  } catch (error) {
    return {
      key,
      label,
      status: 'unhealthy',
      message: error.message || 'Unavailable',
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      details: null,
    };
  }
}

async function checkPostgresHealth() {
  await pool.query('SELECT 1');
  return {
    message: 'PostgreSQL connection is healthy',
  };
}

async function checkStorageHealth() {
  const [exists] = await bucket.exists();

  if (!exists) {
    throw new Error(`Object storage bucket ${bucketName} is not accessible`);
  }

  return {
    message: `Object storage bucket ${bucketName} is accessible`,
  };
}

async function checkDocumentAiConfigHealth() {
  const projectId = process.env.GCLOUD_PROJECT_ID || process.env.GCS_PROJECT_ID;
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
  const credentials =
    process.env.GCS_KEY_BASE64 || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId || !processorId || !credentials) {
    throw new Error('Document AI configuration is incomplete');
  }

  return {
    message: 'Document AI configuration is present',
  };
}

async function getDependencyHealth() {
  const dependencies = await Promise.all([
    runCheck('postgresql', 'PostgreSQL', checkPostgresHealth),
    runCheck('object_storage', 'Object Storage', checkStorageHealth),
    runCheck('elasticsearch', 'Elasticsearch', checkElasticsearchHealth),
    runCheck('qdrant', 'Qdrant', checkQdrantHealth),
    runCheck('document_ai', 'Document AI', checkDocumentAiConfigHealth),
  ]);

  const unhealthyDependencies = dependencies.filter((dependency) => dependency.status !== 'healthy');
  const overallStatus = unhealthyDependencies.length ? 'degraded' : 'healthy';

  if (unhealthyDependencies.length) {
    logger.warn('Dependency health degraded', {
      overallStatus,
      unhealthyCount: unhealthyDependencies.length,
      dependencies: unhealthyDependencies.map((dependency) => ({
        key: dependency.key,
        label: dependency.label,
        message: dependency.message,
        latencyMs: dependency.latencyMs,
      })),
    });
  }

  return {
    overallStatus,
    checkedAt: new Date().toISOString(),
    unhealthyCount: unhealthyDependencies.length,
    dependencies,
  };
}

module.exports = {
  getDependencyHealth,
};
