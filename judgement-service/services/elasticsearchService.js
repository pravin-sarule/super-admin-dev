const axios = require('axios');
const http = require('http');
const https = require('https');
const { createLogger } = require('../utils/logger');

const ELASTICSEARCH_URL =
  process.env.ELASTICSEARCH_URL ||
  process.env.ELASTIC_URL;
const ELASTICSEARCH_USERNAME =
  process.env.ELASTICSEARCH_USERNAME ||
  process.env.ELASTIC_USER;
const ELASTICSEARCH_PASSWORD =
  process.env.ELASTICSEARCH_PASSWORD ||
  process.env.ELASTIC_PASSWORD;
const INDEX_NAME = process.env.ELASTICSEARCH_INDEX || 'judgments';
const ELASTICSEARCH_TIMEOUT_MS = Number(process.env.ELASTICSEARCH_TIMEOUT_MS || 120000);
const ELASTICSEARCH_HEALTH_TIMEOUT_MS = Number(process.env.ELASTICSEARCH_HEALTH_TIMEOUT_MS || 5000);

const isHttps = String(ELASTICSEARCH_URL || '').startsWith('https://');
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
const logger = createLogger('Elastic');
let ensureIndexPromise = null;

function requestConfig(timeoutMs) {
  return {
    auth: ELASTICSEARCH_USERNAME ? {
      username: ELASTICSEARCH_USERNAME,
      password: ELASTICSEARCH_PASSWORD,
    } : undefined,
    timeout: timeoutMs,
    ...(isHttps ? { httpsAgent } : { httpAgent }),
  };
}

async function checkElasticsearchHealth() {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  const startedAt = Date.now();
  logger.flow('Checking Elasticsearch health', {
    endpoint: ELASTICSEARCH_URL,
    timeoutMs: ELASTICSEARCH_HEALTH_TIMEOUT_MS,
  });

  try {
    await axios.get(`${ELASTICSEARCH_URL}/_cluster/health`, {
      ...requestConfig(ELASTICSEARCH_HEALTH_TIMEOUT_MS),
      params: {
        timeout: `${Math.max(1, Math.floor(ELASTICSEARCH_HEALTH_TIMEOUT_MS / 1000))}s`,
      },
    });

    logger.info('Elasticsearch health check passed', {
      endpoint: ELASTICSEARCH_URL,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error('Elasticsearch health check failed', error, {
      endpoint: ELASTICSEARCH_URL,
      timeoutMs: ELASTICSEARCH_HEALTH_TIMEOUT_MS,
      durationMs: Date.now() - startedAt,
      upstreamStatus: error.response?.status || null,
      upstreamData: error.response?.data || null,
    });
    throw new Error(`Elasticsearch health check failed: ${error.message}`);
  }
}

async function ensureIndex() {
  if (!ELASTICSEARCH_URL) return;
  if (ensureIndexPromise) {
    await ensureIndexPromise;
    return;
  }

  ensureIndexPromise = (async () => {
    await checkElasticsearchHealth();

    try {
      logger.flow('Ensuring Elasticsearch index exists', {
        index: INDEX_NAME,
        endpoint: ELASTICSEARCH_URL,
      });
      await axios.put(
        `${ELASTICSEARCH_URL}/${INDEX_NAME}`,
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
        requestConfig(ELASTICSEARCH_TIMEOUT_MS)
      );
    } catch (error) {
      const status = error.response?.status;
      const reason = error.response?.data?.error?.type || '';
      if (status !== 400 && reason !== 'resource_already_exists_exception') {
        ensureIndexPromise = null;
        logger.error('Elasticsearch index ensure failed', error, {
          index: INDEX_NAME,
          endpoint: ELASTICSEARCH_URL,
          timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
          upstreamStatus: status || null,
          upstreamData: error.response?.data || null,
        });
        throw error;
      }
    }
  })().catch((error) => {
    ensureIndexPromise = null;
    throw error;
  });

  await ensureIndexPromise;
}

async function indexJudgmentDocument(document) {
  if (!ELASTICSEARCH_URL) {
    return null;
  }

  await ensureIndex();

  const docId = document.canonical_id || document.canonicalId;
  logger.step('Indexing full judgment into Elasticsearch', {
    index: INDEX_NAME,
    docId,
    caseName: document.case_name || document.caseName,
    fullTextChars: (document.full_text || '').length,
    timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
  });

  try {
    await axios.put(
      `${ELASTICSEARCH_URL}/${INDEX_NAME}/_doc/${encodeURIComponent(docId)}`,
      document,
      {
        ...requestConfig(ELASTICSEARCH_TIMEOUT_MS),
      }
    );
  } catch (error) {
    logger.error('Elasticsearch index request failed', error, {
      index: INDEX_NAME,
      docId,
      endpoint: ELASTICSEARCH_URL,
      timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
      upstreamStatus: error.response?.status || null,
      upstreamData: error.response?.data || null,
    });
    throw error;
  }

  logger.info('Elasticsearch index completed', {
    index: INDEX_NAME,
    docId,
  });

  return docId;
}

async function deleteJudgmentDocument(docId) {
  if (!ELASTICSEARCH_URL || !docId) {
    return false;
  }

  logger.step('Deleting full judgment from Elasticsearch', {
    index: INDEX_NAME,
    docId,
    timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
  });

  try {
    await axios.delete(
      `${ELASTICSEARCH_URL}/${INDEX_NAME}/_doc/${encodeURIComponent(docId)}`,
      {
        ...requestConfig(ELASTICSEARCH_TIMEOUT_MS),
      }
    );
    logger.info('Elasticsearch delete completed', {
      index: INDEX_NAME,
      docId,
    });
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      return true; // Already deleted or not found
    }
    logger.error('Elasticsearch delete request failed', error, {
      index: INDEX_NAME,
      docId,
      endpoint: ELASTICSEARCH_URL,
      timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
      upstreamStatus: error.response?.status || null,
      upstreamData: error.response?.data || null,
    });
    throw error;
  }
}

module.exports = {
  checkElasticsearchHealth,
  indexJudgmentDocument,
  deleteJudgmentDocument,
};
