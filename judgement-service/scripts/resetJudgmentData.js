#!/usr/bin/env node

const path = require('path');
const axios = require('axios');
const http = require('http');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const pool = require('../config/db');
const { bucket, bucketName } = require('../config/gcs');
const { EMBEDDING_DIMENSION } = require('../services/embeddingService');
const { COLLECTION_NAME } = require('../services/qdrantService');

const ELASTICSEARCH_URL =
  process.env.ELASTICSEARCH_URL ||
  process.env.ELASTIC_URL;
const ELASTICSEARCH_USERNAME =
  process.env.ELASTICSEARCH_USERNAME ||
  process.env.ELASTIC_USER;
const ELASTICSEARCH_PASSWORD =
  process.env.ELASTICSEARCH_PASSWORD ||
  process.env.ELASTIC_PASSWORD;
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'judgments';
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY =
  process.env.QDRANT_API_KEY ||
  process.env.Qdrant_API_KEY;
const JUDGMENT_BUCKET_PREFIX = 'judgements/';
const QDRANT_COLLECTIONS_TO_DELETE = Array.from(
  new Set([COLLECTION_NAME, 'legal_embeddings'].filter(Boolean))
);
const PG_JUDGMENT_TABLES = [
  'judgment_api_analytics',
  'judgment_chunks',
  'judgment_pages',
  'judgment_uploads',
  'citation_aliases',
  'statutes_cited',
  'judgment_judges',
  'judgments',
  'judges',
];

const elasticIsHttps = String(ELASTICSEARCH_URL || '').startsWith('https://');
const elasticHttpAgent = new http.Agent({ keepAlive: true });
const elasticHttpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function elasticRequestConfig(timeoutMs = 120000) {
  return {
    timeout: timeoutMs,
    ...(elasticIsHttps ? { httpsAgent: elasticHttpsAgent } : { httpAgent: elasticHttpAgent }),
    ...(ELASTICSEARCH_USERNAME ? {
      auth: {
        username: ELASTICSEARCH_USERNAME,
        password: ELASTICSEARCH_PASSWORD,
      },
    } : {}),
  };
}

function qdrantClient() {
  return axios.create({
    baseURL: QDRANT_URL,
    timeout: 240000,
    headers: QDRANT_API_KEY ? {
      'api-key': QDRANT_API_KEY,
      'Content-Type': 'application/json',
    } : {
      'Content-Type': 'application/json',
    },
  });
}

async function clearBucketArtifacts() {
  console.log(`[resetJudgmentData] deleting bucket artifacts bucket=${bucketName} prefix=${JUDGMENT_BUCKET_PREFIX}`);
  await bucket.deleteFiles({
    prefix: JUDGMENT_BUCKET_PREFIX,
    force: true,
  });
}

async function resetElasticsearchIndex() {
  if (!ELASTICSEARCH_URL) {
    console.log('[resetJudgmentData] skipping Elasticsearch reset because URL is not configured');
    return;
  }

  console.log(`[resetJudgmentData] deleting Elasticsearch index index=${ELASTICSEARCH_INDEX}`);
  try {
    await axios.delete(
      `${ELASTICSEARCH_URL}/${ELASTICSEARCH_INDEX}`,
      elasticRequestConfig()
    );
  } catch (error) {
    if (error.response?.status !== 404) {
      throw error;
    }
  }

  console.log(`[resetJudgmentData] recreating Elasticsearch index index=${ELASTICSEARCH_INDEX}`);
  await axios.put(
    `${ELASTICSEARCH_URL}/${ELASTICSEARCH_INDEX}`,
    {
      mappings: {
        properties: {
          judgment_uuid: { type: 'keyword' },
          canonical_id: { type: 'keyword' },
          case_name: { type: 'text' },
          court_code: { type: 'keyword' },
          year: { type: 'integer' },
          judgment_date: { type: 'date' },
          source_url: { type: 'keyword', index: false },
          source_type: { type: 'keyword' },
          status: { type: 'keyword' },
          full_text: { type: 'text' },
          citations: { type: 'keyword' },
        },
      },
    },
    elasticRequestConfig()
  );
}

async function resetQdrantCollections() {
  if (!QDRANT_URL) {
    console.log('[resetJudgmentData] skipping Qdrant reset because URL is not configured');
    return;
  }

  const api = qdrantClient();

  for (const collectionName of QDRANT_COLLECTIONS_TO_DELETE) {
    console.log(`[resetJudgmentData] deleting Qdrant collection collection=${collectionName}`);
    try {
      await api.delete(`/collections/${collectionName}`);
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }
  }

  console.log(`[resetJudgmentData] recreating active Qdrant collection collection=${COLLECTION_NAME}`);
  await api.put(`/collections/${COLLECTION_NAME}`, {
    vectors: {
      size: EMBEDDING_DIMENSION,
      distance: 'Cosine',
    },
  });

  for (const fieldConfig of [
    { field_name: 'judgment_uuid', field_schema: 'keyword' },
    { field_name: 'canonical_id', field_schema: 'keyword' },
    { field_name: 'case_name', field_schema: 'keyword' },
  ]) {
    await api.put(`/collections/${COLLECTION_NAME}/index?wait=true`, fieldConfig);
  }
}

async function resetPostgresTables() {
  console.log(`[resetJudgmentData] truncating Postgres tables tables=${PG_JUDGMENT_TABLES.join(',')}`);
  await pool.query(`
    TRUNCATE TABLE ${PG_JUDGMENT_TABLES.join(', ')}
    RESTART IDENTITY CASCADE
  `);
}

async function main() {
  console.log('[resetJudgmentData] starting full judgment-data reset');
  await clearBucketArtifacts();
  await resetElasticsearchIndex();
  await resetQdrantCollections();
  await resetPostgresTables();
  console.log('[resetJudgmentData] completed full judgment-data reset');
}

main()
  .catch((error) => {
    console.error('[resetJudgmentData] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
