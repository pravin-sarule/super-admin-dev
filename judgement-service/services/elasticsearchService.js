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
const IK_JUDGMENTS_INDEX = process.env.IK_JUDGMENTS_INDEX || 'ik_judgments';
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

function yearFromPublishDate(publishdate) {
  const year = Number(String(publishdate || '').slice(0, 4));
  return Number.isFinite(year) && year > 1000 ? year : null;
}

function mapIkJudgmentHit(hit = {}) {
  const source = hit._source || {};
  const tid = String(source.tid || hit._id || '').trim();
  const publishdate = source.publishdate || source.fetched_at || null;
  // Judgments published from admin uploads carry `source: 'admin_upload'`;
  // everything else in the library came from an Indian Kanoon /doc response.
  const isAdminUpload = source.source === 'admin_upload';

  return {
    tid,
    title: source.title || null,
    docsource: source.docsource || null,
    publishdate,
    text: source.text || '',
    doc: source.doc || '',
    author: source.author || null,
    bench: source.bench || null,
    numcites: Number(source.numcites || 0),
    numcitedby: Number(source.numcitedby || 0),
    casesCited: Array.isArray(source.casesCited) ? source.casesCited : [],
    citedBy: Array.isArray(source.citedBy) ? source.citedBy : [],
    fetched_at: source.fetched_at || null,
    year: yearFromPublishDate(publishdate),
    source: isAdminUpload ? 'admin_upload' : 'indian_kanoon',
    upload: isAdminUpload && source.upload && typeof source.upload === 'object' ? source.upload : null,
    source_url: isAdminUpload ? null : (tid ? `https://indiankanoon.org/doc/${tid}/` : null),
  };
}

/* -------------------------------------------------------------------------- */
/*            Library writes for admin uploads (ik_judgments + paragraphs)      */
/* -------------------------------------------------------------------------- */

const IK_PARAGRAPHS_INDEX = process.env.IK_PARAGRAPHS_INDEX || 'ik_judgment_paragraphs';
// Admin uploads are minted as "9" + 10 digits (ikFormatService.deriveUploadTid).
const UPLOAD_TID_REGEXP = '9[0-9]{10}';
let ensureLibraryMappingPromise = null;

/**
 * The `upload` bookkeeping block must stay out of the index (like casesCited /
 * citedBy in the library's own mapping). Idempotent; a failure only logs, in
 * which case dynamic mapping would still store the block.
 */
async function ensureIkLibraryMapping() {
  if (!ELASTICSEARCH_URL) return;
  if (ensureLibraryMappingPromise) return ensureLibraryMappingPromise;

  ensureLibraryMappingPromise = (async () => {
    try {
      await axios.put(
        `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_mapping`,
        { properties: { upload: { type: 'object', enabled: false } } },
        requestConfig(ELASTICSEARCH_TIMEOUT_MS)
      );
      logger.info('ik_judgments mapping ensured for upload bookkeeping block', { index: IK_JUDGMENTS_INDEX });
    } catch (error) {
      ensureLibraryMappingPromise = null;
      logger.warn('Could not ensure ik_judgments upload mapping; continuing', {
        index: IK_JUDGMENTS_INDEX,
        upstreamStatus: error.response?.status || null,
        reason: error.response?.data?.error?.reason || error.message,
      });
    }
  })();

  return ensureLibraryMappingPromise;
}

/**
 * List admin-uploaded judgments (identified by their tid range), newest first.
 * `doc` and `text` are excluded from the listing payload.
 */
async function searchIkAdminUploads({ search = '', from = 0, size = 20 } = {}) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  const normalizedSearch = String(search || '').trim();
  const must = [];
  if (normalizedSearch) {
    must.push({
      bool: {
        should: [
          { term: { tid: normalizedSearch } },
          {
            multi_match: {
              query: normalizedSearch,
              fields: ['title^4', 'docsource^2', 'author', 'bench', 'text'],
              type: 'best_fields',
              operator: 'and',
            },
          },
        ],
        minimum_should_match: 1,
      },
    });
  }

  const response = await axios.post(
    `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_search`,
    {
      from: Math.max(0, Number(from) || 0),
      size: Math.min(200, Math.max(1, Number(size) || 20)),
      track_total_hits: true,
      query: {
        bool: {
          filter: [{ regexp: { tid: UPLOAD_TID_REGEXP } }],
          ...(must.length ? { must } : {}),
        },
      },
      _source: { excludes: ['doc', 'text'] },
      sort: [
        { fetched_at: { order: 'desc', unmapped_type: 'date', missing: '_last' } },
        { tid: { order: 'asc' } },
      ],
    },
    requestConfig(ELASTICSEARCH_TIMEOUT_MS)
  );

  const hits = Array.isArray(response.data?.hits?.hits) ? response.data.hits.hits : [];
  const total = Number(response.data?.hits?.total?.value ?? hits.length);

  return { total, rows: hits.map(mapIkJudgmentHit) };
}

/**
 * Full-text search over admin-uploaded judgments in ik_judgments, with the same
 * strict → relaxed strategy as searchJudgmentDocuments (text ↔ full_text,
 * title ↔ case_name). Returns raw hits with <mark> highlights on text/title.
 */
async function searchIkLibraryFullText({
  query,
  limit = 10,
  phraseMatch = false,
  operator = 'and',
} = {}) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    throw new Error('A search query is required');
  }

  const normalizedOperator = String(operator || 'and').toLowerCase() === 'or' ? 'or' : 'and';
  const startedAt = Date.now();

  const execute = async (queryBody) => {
    const response = await axios.post(
      `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_search`,
      {
        size: Math.min(50, Math.max(1, Number(limit) || 10)),
        _source: ['tid', 'title', 'docsource', 'publishdate', 'author', 'bench', 'fetched_at', 'source', 'upload'],
        query: {
          bool: {
            must: [queryBody],
            filter: [{ regexp: { tid: UPLOAD_TID_REGEXP } }],
          },
        },
        highlight: {
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
          fields: {
            text: { fragment_size: 180, number_of_fragments: 3 },
            title: { number_of_fragments: 1 },
          },
        },
      },
      requestConfig(ELASTICSEARCH_TIMEOUT_MS)
    );
    return response.data?.hits?.hits || [];
  };

  const strictQuery = phraseMatch
    ? {
      bool: {
        should: [
          { match_phrase: { text: { query: normalizedQuery, slop: 2 } } },
          { match_phrase: { title: { query: normalizedQuery, slop: 1 } } },
        ],
        minimum_should_match: 1,
      },
    }
    : {
      multi_match: {
        query: normalizedQuery,
        fields: ['text^4', 'title^3', 'docsource', 'author', 'bench'],
        type: 'best_fields',
        operator: normalizedOperator,
      },
    };

  let strategy = phraseMatch ? 'phrase' : `strict_${normalizedOperator}`;
  let hits = await execute(strictQuery);

  if (!hits.length && !phraseMatch) {
    const relaxedQuery = {
      bool: {
        should: [
          {
            multi_match: {
              query: normalizedQuery,
              fields: ['text^5', 'title^4', 'docsource^2'],
              type: 'best_fields',
              operator: 'or',
              minimum_should_match: resolveRelaxedMinimumShouldMatch(normalizedQuery),
              boost: 2,
            },
          },
          { match_phrase: { text: { query: normalizedQuery, slop: 3, boost: 3 } } },
          { match_phrase: { title: { query: normalizedQuery, slop: 2, boost: 4 } } },
        ],
        minimum_should_match: 1,
      },
    };
    hits = await execute(relaxedQuery);
    strategy = hits.length ? 'relaxed_hybrid' : `${strategy}_empty`;
  }

  logger.info('ik_judgments library full-text search completed', {
    index: IK_JUDGMENTS_INDEX,
    query: normalizedQuery,
    limit,
    strategy,
    returnedHits: hits.length,
    durationMs: Date.now() - startedAt,
  });

  return hits;
}

function assertUploadTid(tid, action) {
  // Belt and braces: this module must never delete a real Indian Kanoon judgment.
  const value = String(tid || '').trim();
  if (!/^9\d{10}$/.test(value)) {
    throw new Error(`Refusing to ${action} ${value || '(empty)'}: not an admin-upload tid`);
  }
  return value;
}

/**
 * Create-only write into ik_judgments (op_type=create). Returns
 *   { created: true }                    on 201
 *   { created: false, existing: source } on 409 (already in the library)
 */
async function createIkJudgmentDocument(tid, body) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }
  const docId = String(tid || '').trim();
  if (!docId) throw new Error('tid is required');

  logger.step('Creating judgment in ik_judgments', {
    index: IK_JUDGMENTS_INDEX,
    tid: docId,
    title: body?.title,
    docChars: String(body?.doc || '').length,
    textChars: String(body?.text || '').length,
  });

  try {
    await axios.put(
      `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_create/${encodeURIComponent(docId)}`,
      body,
      requestConfig(ELASTICSEARCH_TIMEOUT_MS)
    );
    return { created: true };
  } catch (error) {
    if (error.response?.status === 409) {
      const existing = await getIkJudgmentSource(docId);
      logger.warn('ik_judgments document already exists; not overwriting', {
        index: IK_JUDGMENTS_INDEX,
        tid: docId,
        existingSource: existing?.source || 'indian_kanoon',
      });
      return { created: false, existing };
    }
    logger.error('ik_judgments create failed', error, {
      index: IK_JUDGMENTS_INDEX,
      tid: docId,
      upstreamStatus: error.response?.status || null,
      upstreamData: error.response?.data || null,
    });
    throw error;
  }
}

/** Raw _source of an ik_judgments record (null when absent). */
async function getIkJudgmentSource(tid) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }
  const docId = String(tid || '').trim();
  if (!docId) return null;

  try {
    const response = await axios.get(
      `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_doc/${encodeURIComponent(docId)}`,
      requestConfig(ELASTICSEARCH_TIMEOUT_MS)
    );
    return response.data?.found ? response.data._source : null;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}

/**
 * Bulk create paragraph rows with deterministic ids `{tid}:{paragraph_no}`.
 * Existing ids are skipped (create-only), so a re-run adds only what is missing.
 */
async function bulkCreateIkParagraphs(rows = []) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }
  if (!rows.length) return { created: 0, skipped: 0, failed: 0 };

  const lines = [];
  for (const row of rows) {
    lines.push(JSON.stringify({ create: { _index: IK_PARAGRAPHS_INDEX, _id: `${row.judgment_id}:${row.paragraph_no}` } }));
    lines.push(JSON.stringify(row));
  }
  const payload = `${lines.join('\n')}\n`;

  const response = await axios.post(
    `${ELASTICSEARCH_URL}/_bulk?refresh=wait_for`,
    payload,
    {
      ...requestConfig(ELASTICSEARCH_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/x-ndjson' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );

  const summary = { created: 0, skipped: 0, failed: 0 };
  for (const item of response.data?.items || []) {
    const result = item.create || {};
    if (result.status === 201) summary.created += 1;
    else if (result.status === 409) summary.skipped += 1;
    else summary.failed += 1;
  }

  logger.info('ik_judgment_paragraphs bulk create completed', {
    index: IK_PARAGRAPHS_INDEX,
    judgmentId: rows[0]?.judgment_id,
    rows: rows.length,
    ...summary,
  });

  if (summary.failed) {
    const firstFailure = (response.data?.items || []).find((i) => i.create?.error)?.create?.error;
    throw new Error(`Paragraph bulk index failed for ${summary.failed} row(s): ${JSON.stringify(firstFailure || {}).slice(0, 300)}`);
  }

  return summary;
}

async function countIkParagraphs(tid) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }
  const docId = String(tid || '').trim();
  if (!docId) return 0;
  const response = await axios.post(
    `${ELASTICSEARCH_URL}/${IK_PARAGRAPHS_INDEX}/_count`,
    { query: { term: { judgment_id: docId } } },
    requestConfig(ELASTICSEARCH_TIMEOUT_MS)
  );
  return Number(response.data?.count || 0);
}

/**
 * Remove an admin-upload judgment and all of its paragraph rows from the library.
 * Guarded so that only tids minted for uploads (9 + 10 digits) can ever be deleted.
 */
async function deleteIkJudgmentDocument(tid) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }
  const docId = assertUploadTid(tid, 'delete');

  logger.step('Deleting admin-upload judgment from library', {
    index: IK_JUDGMENTS_INDEX,
    paragraphIndex: IK_PARAGRAPHS_INDEX,
    tid: docId,
  });

  let judgmentDeleted = false;
  try {
    await axios.delete(
      `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_doc/${encodeURIComponent(docId)}?refresh=wait_for`,
      requestConfig(ELASTICSEARCH_TIMEOUT_MS)
    );
    judgmentDeleted = true;
  } catch (error) {
    if (error.response?.status !== 404) throw error;
  }

  const response = await axios.post(
    `${ELASTICSEARCH_URL}/${IK_PARAGRAPHS_INDEX}/_delete_by_query?refresh=true&conflicts=proceed`,
    { query: { term: { judgment_id: docId } } },
    requestConfig(ELASTICSEARCH_TIMEOUT_MS)
  );

  const paragraphsDeleted = Number(response.data?.deleted || 0);
  logger.info('Admin-upload judgment removed from library', {
    tid: docId,
    judgmentDeleted,
    paragraphsDeleted,
  });

  return { judgmentDeleted, paragraphsDeleted };
}

function buildIkSearchQuery(search = '') {
  const normalizedSearch = String(search || '').trim();
  if (!normalizedSearch) {
    return { match_all: {} };
  }

  return {
    bool: {
      should: [
        { term: { tid: normalizedSearch } },
        {
          multi_match: {
            query: normalizedSearch,
            fields: ['title^4', 'tid^5', 'docsource^3', 'text'],
            type: 'best_fields',
            operator: 'and',
          },
        },
      ],
      minimum_should_match: 1,
    },
  };
}

async function summarizeIkJudgmentDocuments() {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  const startedAt = Date.now();
  logger.flow('Summarizing ik_judgments documents', {
    index: IK_JUDGMENTS_INDEX,
  });

  const response = await axios.post(
    `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_search`,
    {
      size: 0,
      track_total_hits: true,
      aggs: {
        with_date: {
          filter: { exists: { field: 'publishdate' } },
        },
        courts: {
          cardinality: { field: 'docsource.kw' },
        },
        publish_min: { min: { field: 'publishdate' } },
        publish_max: { max: { field: 'publishdate' } },
      },
    },
    requestConfig(ELASTICSEARCH_TIMEOUT_MS)
  );

  const total = Number(response.data?.hits?.total?.value || 0);
  const summary = {
    index: IK_JUDGMENTS_INDEX,
    totalJudgments: total,
    judgmentsWithDate: Number(response.data?.aggregations?.with_date?.doc_count || 0),
    distinctCourts: Number(response.data?.aggregations?.courts?.value || 0),
    firstInsertedAt: response.data?.aggregations?.publish_min?.value_as_string || null,
    latestInsertedAt: response.data?.aggregations?.publish_max?.value_as_string || null,
  };

  logger.info('ik_judgments summary completed', {
    ...summary,
    durationMs: Date.now() - startedAt,
  });

  return summary;
}

async function listIkJudgmentDocuments({ search = '', limit = 10, offset = 0 } = {}) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  const startedAt = Date.now();
  logger.flow('Listing ik_judgments documents', {
    index: IK_JUDGMENTS_INDEX,
    search,
    limit,
    offset,
  });

  const searchBody = {
    from: offset,
    size: limit,
    track_total_hits: true,
    query: buildIkSearchQuery(search),
    _source: [
      'tid',
      'title',
      'docsource',
      'publishdate',
      'fetched_at',
      'author',
      'bench',
      'numcites',
      'numcitedby',
      'source',
      'source_url',
      'upload_document_id',
      'judgment_uuid',
      'canonical_id',
    ],
  };

  let response;
  try {
    response = await axios.post(
      `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_search`,
      {
        ...searchBody,
        sort: [
          { publishdate: { order: 'desc', unmapped_type: 'date', missing: '_last' } },
        ],
      },
      requestConfig(ELASTICSEARCH_TIMEOUT_MS)
    );
  } catch (error) {
    logger.error('ik_judgments sorted list failed, retrying without sort', error, {
      index: IK_JUDGMENTS_INDEX,
      upstreamStatus: error.response?.status || null,
      upstreamData: error.response?.data || null,
    });
    response = await axios.post(
      `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_search`,
      searchBody,
      requestConfig(ELASTICSEARCH_TIMEOUT_MS)
    );
  }

  const hits = Array.isArray(response.data?.hits?.hits) ? response.data.hits.hits : [];
  const rawTotal = response.data?.hits?.total;
  const total = Number(
    rawTotal?.value ??
    rawTotal ??
    hits.length
  );

  logger.info('ik_judgments list completed', {
    index: IK_JUDGMENTS_INDEX,
    search,
    total,
    returnedRows: hits.length,
    durationMs: Date.now() - startedAt,
  });

  return {
    index: IK_JUDGMENTS_INDEX,
    total,
    rows: hits.map(mapIkJudgmentHit),
  };
}

async function getIkJudgmentDocument(docId) {
  if (!ELASTICSEARCH_URL) {
    throw new Error('Elasticsearch URL is not configured');
  }

  const normalizedDocId = String(docId || '').trim();
  if (!normalizedDocId) {
    return null;
  }

  const startedAt = Date.now();
  logger.flow('Fetching ik_judgments document', {
    index: IK_JUDGMENTS_INDEX,
    docId: normalizedDocId,
  });

  try {
    const response = await axios.get(
      `${ELASTICSEARCH_URL}/${IK_JUDGMENTS_INDEX}/_doc/${encodeURIComponent(normalizedDocId)}`,
      requestConfig(ELASTICSEARCH_TIMEOUT_MS)
    );

    if (!response.data?.found) {
      return null;
    }

    logger.info('ik_judgments document fetch completed', {
      index: IK_JUDGMENTS_INDEX,
      docId: normalizedDocId,
      durationMs: Date.now() - startedAt,
    });

    return mapIkJudgmentHit(response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      logger.warn('ik_judgments document not found', {
        index: IK_JUDGMENTS_INDEX,
        docId: normalizedDocId,
      });
      return null;
    }

    logger.error('ik_judgments document fetch failed', error, {
      index: IK_JUDGMENTS_INDEX,
      docId: normalizedDocId,
      upstreamStatus: error.response?.status || null,
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
  summarizeIkJudgmentDocuments,
  listIkJudgmentDocuments,
  getIkJudgmentDocument,
  createIkJudgmentDocument,
  getIkJudgmentSource,
  bulkCreateIkParagraphs,
  countIkParagraphs,
  deleteIkJudgmentDocument,
  ensureIkLibraryMapping,
  searchIkAdminUploads,
  searchIkLibraryFullText,
  IK_JUDGMENTS_INDEX,
  IK_PARAGRAPHS_INDEX,
};
