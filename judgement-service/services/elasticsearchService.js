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

function normalizeSourceTypes(sourceTypes = null) {
  return Array.from(
    new Set(
      (Array.isArray(sourceTypes) ? sourceTypes : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function tokenizeSearchTerms(query = '') {
  return Array.from(
    new Set(
      String(query || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    )
  );
}

function resolveRelaxedMinimumShouldMatch(query = '') {
  const termCount = tokenizeSearchTerms(query).length;

  if (termCount <= 1) return 1;
  if (termCount <= 3) return termCount;
  if (termCount <= 6) return Math.max(2, Math.ceil(termCount * 0.6));
  if (termCount <= 12) return Math.max(3, Math.ceil(termCount * 0.45));
  return Math.max(4, Math.ceil(termCount * 0.3));
}

function buildTextSearchQuery({
  query,
  phraseMatch = false,
  operator = 'and',
  relaxed = false,
} = {}) {
  const normalizedOperator = String(operator || 'and').toLowerCase() === 'or' ? 'or' : 'and';

  if (phraseMatch) {
    return {
      strategy: 'phrase',
      query: {
        bool: {
          should: [
            {
              match_phrase: {
                full_text: {
                  query,
                  slop: 2,
                },
              },
            },
            {
              match_phrase: {
                case_name: {
                  query,
                  slop: 1,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      minimumShouldMatch: null,
    };
  }

  if (!relaxed) {
    return {
      strategy: `strict_${normalizedOperator}`,
      query: {
        multi_match: {
          query,
          fields: ['full_text^4', 'case_name^3', 'citations^2', 'canonical_id^2', 'court_code'],
          type: 'best_fields',
          operator: normalizedOperator,
        },
      },
      minimumShouldMatch: null,
    };
  }

  const minimumShouldMatch = resolveRelaxedMinimumShouldMatch(query);

  return {
    strategy: 'relaxed_hybrid',
    query: {
      bool: {
        should: [
          {
            multi_match: {
              query,
              fields: ['full_text^4', 'case_name^3', 'citations^2', 'canonical_id^2', 'court_code'],
              type: 'best_fields',
              operator: normalizedOperator,
              boost: 4,
            },
          },
          {
            multi_match: {
              query,
              fields: ['full_text^5', 'case_name^4', 'citations^3', 'canonical_id^3', 'court_code^2'],
              type: 'best_fields',
              operator: 'or',
              minimum_should_match: minimumShouldMatch,
              boost: 2,
            },
          },
          {
            match_phrase: {
              full_text: {
                query,
                slop: 3,
                boost: 3,
              },
            },
          },
          {
            match_phrase: {
              case_name: {
                query,
                slop: 2,
                boost: 4,
              },
            },
          },
        ],
        minimum_should_match: 1,
      },
    },
    minimumShouldMatch,
  };
}

function buildScopedQuery(queryBody, sourceTypes = null) {
  const normalizedSourceTypes = normalizeSourceTypes(sourceTypes);

  if (!normalizedSourceTypes.length) {
    return queryBody;
  }

  return {
    bool: {
      must: [queryBody],
      filter: [
        {
          terms: {
            source_type: normalizedSourceTypes,
          },
        },
      ],
    },
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

async function getJudgmentDocument(docId) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  const normalizedDocId = String(docId || '').trim();
  if (!normalizedDocId) {
    return null;
  }

  await ensureIndex();

  const startedAt = Date.now();
  logger.flow('Fetching full judgment from Elasticsearch', {
    index: INDEX_NAME,
    docId: normalizedDocId,
    timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
  });

  try {
    const response = await axios.get(
      `${ELASTICSEARCH_URL}/${INDEX_NAME}/_doc/${encodeURIComponent(normalizedDocId)}`,
      requestConfig(ELASTICSEARCH_TIMEOUT_MS)
    );

    logger.info('Elasticsearch judgment fetch completed', {
      index: INDEX_NAME,
      docId: normalizedDocId,
      durationMs: Date.now() - startedAt,
      found: Boolean(response.data?.found),
    });

    if (!response.data?.found) {
      return null;
    }

    return response.data._source || null;
  } catch (error) {
    if (error.response?.status === 404) {
      logger.warn('Elasticsearch judgment not found', {
        index: INDEX_NAME,
        docId: normalizedDocId,
      });
      return null;
    }

    logger.error('Elasticsearch judgment fetch failed', error, {
      index: INDEX_NAME,
      docId: normalizedDocId,
      timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
      durationMs: Date.now() - startedAt,
      upstreamStatus: error.response?.status || null,
      upstreamData: error.response?.data || null,
    });
    throw error;
  }
}

async function countJudgmentDocuments({ sourceTypes = null } = {}) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  await ensureIndex();

  const normalizedSourceTypes = normalizeSourceTypes(sourceTypes);
  const startedAt = Date.now();

  logger.flow('Counting judgments in Elasticsearch', {
    index: INDEX_NAME,
    sourceTypes: normalizedSourceTypes.length ? normalizedSourceTypes : ['all'],
    timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
  });

  try {
    const response = await axios.post(
      `${ELASTICSEARCH_URL}/${INDEX_NAME}/_count`,
      {
        query: normalizedSourceTypes.length
          ? {
            terms: {
              source_type: normalizedSourceTypes,
            },
          }
          : {
            match_all: {},
          },
      },
      requestConfig(ELASTICSEARCH_TIMEOUT_MS)
    );

    const count = Number(response.data?.count || 0);

    logger.info('Elasticsearch judgment count completed', {
      index: INDEX_NAME,
      sourceTypes: normalizedSourceTypes.length ? normalizedSourceTypes : ['all'],
      count,
      durationMs: Date.now() - startedAt,
    });

    return count;
  } catch (error) {
    logger.error('Elasticsearch judgment count failed', error, {
      index: INDEX_NAME,
      sourceTypes: normalizedSourceTypes.length ? normalizedSourceTypes : ['all'],
      timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
      durationMs: Date.now() - startedAt,
      upstreamStatus: error.response?.status || null,
      upstreamData: error.response?.data || null,
    });
    throw error;
  }
}

async function searchJudgmentDocuments({
  query,
  limit = 10,
  phraseMatch = false,
  operator = 'and',
  sourceTypes = null,
} = {}) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    throw new Error('A search query is required');
  }

  await ensureIndex();

  const startedAt = Date.now();
  logger.flow('Searching judgments in Elasticsearch', {
    index: INDEX_NAME,
    query: normalizedQuery,
    limit,
    phraseMatch,
    operator,
    sourceTypes,
    timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
  });

  try {
    const executeSearch = async (queryPayload) => {
      const response = await axios.post(
        `${ELASTICSEARCH_URL}/${INDEX_NAME}/_search`,
        {
          size: limit,
          _source: [
            'judgment_uuid',
            'canonical_id',
            'case_name',
            'court_code',
            'year',
            'judgment_date',
            'source_url',
            'source_type',
            'status',
            'citations',
          ],
          query: queryPayload,
          highlight: {
            pre_tags: ['<mark>'],
            post_tags: ['</mark>'],
            fields: {
              full_text: {
                fragment_size: 180,
                number_of_fragments: 3,
              },
              case_name: {
                number_of_fragments: 1,
              },
            },
          },
        },
        requestConfig(ELASTICSEARCH_TIMEOUT_MS)
      );

      return response.data?.hits?.hits || [];
    };

    const strictSearch = buildTextSearchQuery({
      query: normalizedQuery,
      phraseMatch,
      operator,
      relaxed: false,
    });
    let queryStrategy = strictSearch.strategy;
    let relaxedMinimumShouldMatch = null;
    let hits = await executeSearch(buildScopedQuery(strictSearch.query, sourceTypes));

    if (!hits.length && !phraseMatch) {
      const relaxedSearch = buildTextSearchQuery({
        query: normalizedQuery,
        phraseMatch,
        operator,
        relaxed: true,
      });

      relaxedMinimumShouldMatch = relaxedSearch.minimumShouldMatch;

      logger.info('No strict Elasticsearch hits; retrying with relaxed full-text query', {
        index: INDEX_NAME,
        query: normalizedQuery,
        limit,
        operator,
        sourceTypes: normalizeSourceTypes(sourceTypes),
        relaxedMinimumShouldMatch,
      });

      hits = await executeSearch(buildScopedQuery(relaxedSearch.query, sourceTypes));
      queryStrategy = hits.length ? relaxedSearch.strategy : `${strictSearch.strategy}_empty`;
    }

    logger.info('Elasticsearch judgment search completed', {
      index: INDEX_NAME,
      query: normalizedQuery,
      limit,
      queryStrategy,
      relaxedMinimumShouldMatch,
      returnedHits: hits.length,
      durationMs: Date.now() - startedAt,
    });

    return hits;
  } catch (error) {
    logger.error('Elasticsearch judgment search failed', error, {
      index: INDEX_NAME,
      query: normalizedQuery,
      limit,
      phraseMatch,
      operator,
      sourceTypes,
      timeoutMs: ELASTICSEARCH_TIMEOUT_MS,
      durationMs: Date.now() - startedAt,
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
  getJudgmentDocument,
  countJudgmentDocuments,
  searchJudgmentDocuments,
};
