const { v4: uuidv4 } = require('uuid');
const repository = require('./judmentApiRepository');
const service = require('./judmentApiService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('JudmentApiController');

async function recordAnalytics(payload) {
  try {
    await repository.insertAnalyticsRecord(payload);
  } catch (error) {
    logger.error('Failed to persist judment API analytics', error, {
      endpoint: payload.endpoint,
      requestId: payload.requestId,
    });
  }
}

function buildSearchSummary(result = {}) {
  if (result.searchMode === 'hybrid') {
    return {
      semanticChunks: result.totalResults?.semanticChunks || 0,
      fullTextJudgments: result.totalResults?.fullTextJudgments || 0,
    };
  }

  return {
    totalResults: result.totalResults || 0,
  };
}

async function handleSearch(req, res, searchHandler, endpointName) {
  const requestId = uuidv4();
  const startedAt = Date.now();

  try {
    logger.flow('Handling judment API search request', {
      requestId,
      endpoint: endpointName,
      query: req.body?.query || '',
      apiKeyFingerprint: req.apiClient?.fingerprint || null,
    });

    const result = await searchHandler(req.body || {});
    const totalDurationMs = Date.now() - startedAt;

    await recordAnalytics({
      requestId,
      endpoint: endpointName,
      searchMode: result.searchMode,
      queryText: result.query,
      filters: result.filters || req.body?.filters || {},
      semanticLimit: req.body?.semanticLimit || req.body?.chunkLimit || req.body?.limit || null,
      textLimit: req.body?.fullTextLimit || req.body?.judgmentLimit || req.body?.limit || null,
      scoreThreshold: req.body?.scoreThreshold ?? null,
      phraseMatch: Boolean(req.body?.phraseMatch),
      apiKeyFingerprint: req.apiClient?.fingerprint || null,
      statusCode: 200,
      success: true,
      resultCount:
        result.searchMode === 'hybrid'
          ? (result.totalResults?.semanticChunks || 0) + (result.totalResults?.fullTextJudgments || 0)
          : result.totalResults || 0,
      embeddingDurationMs: result.timings?.embeddingMs ?? result.semantic?.timings?.embeddingMs ?? null,
      qdrantDurationMs: result.timings?.qdrantMs ?? result.semantic?.timings?.qdrantMs ?? null,
      elasticDurationMs: result.timings?.elasticMs ?? result.fullText?.timings?.elasticMs ?? null,
      dbDurationMs: result.timings?.dbMs ?? null,
      signedUrlDurationMs: result.timings?.signedUrlMs ?? null,
      totalDurationMs,
      responseSummary: {
        searchMode: result.searchMode,
        timings: result.timings || {},
        ...buildSearchSummary(result),
      },
    });

    return res.json({
      success: true,
      requestId,
      totalDurationMs,
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const totalDurationMs = Date.now() - startedAt;

    logger.error('Judment API search request failed', error, {
      requestId,
      endpoint: endpointName,
      query: req.body?.query || '',
      apiKeyFingerprint: req.apiClient?.fingerprint || null,
      totalDurationMs,
    });

    await recordAnalytics({
      requestId,
      endpoint: endpointName,
      searchMode: endpointName,
      queryText: req.body?.query || '',
      filters: req.body?.filters || {},
      semanticLimit: req.body?.semanticLimit || req.body?.chunkLimit || req.body?.limit || null,
      textLimit: req.body?.fullTextLimit || req.body?.judgmentLimit || req.body?.limit || null,
      scoreThreshold: req.body?.scoreThreshold ?? null,
      phraseMatch: Boolean(req.body?.phraseMatch),
      apiKeyFingerprint: req.apiClient?.fingerprint || null,
      statusCode,
      success: false,
      resultCount: 0,
      totalDurationMs,
      errorMessage: error.message,
      responseSummary: {},
    });

    return res.status(statusCode).json({
      success: false,
      requestId,
      message: error.message || 'Internal server error',
      totalDurationMs,
    });
  }
}

async function semanticSearch(req, res) {
  return handleSearch(req, res, service.semanticSearch, 'semantic_search');
}

async function fullTextSearch(req, res) {
  return handleSearch(req, res, service.fullTextSearch, 'full_text_search');
}

async function hybridSearch(req, res) {
  return handleSearch(req, res, service.hybridSearch, 'hybrid_search');
}

async function getAnalytics(req, res) {
  const requestId = uuidv4();
  const startedAt = Date.now();

  try {
    const analytics = await repository.listAnalytics({
      limit: req.query.limit,
      endpoint: req.query.endpoint || null,
      success:
        req.query.success == null || req.query.success === ''
          ? null
          : String(req.query.success).toLowerCase() === 'true',
    });

    const totalDurationMs = Date.now() - startedAt;

    await recordAnalytics({
      requestId,
      endpoint: 'analytics_list',
      searchMode: 'analytics_list',
      queryText: null,
      filters: {
        endpoint: req.query.endpoint || null,
        success: req.query.success ?? null,
      },
      apiKeyFingerprint: req.apiClient?.fingerprint || null,
      statusCode: 200,
      success: true,
      resultCount: analytics.length,
      totalDurationMs,
      responseSummary: {
        analyticsRows: analytics.length,
      },
    });

    return res.json({
      success: true,
      requestId,
      totalDurationMs,
      analytics,
    });
  } catch (error) {
    logger.error('Judment API analytics fetch failed', error, {
      requestId,
      apiKeyFingerprint: req.apiClient?.fingerprint || null,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      requestId,
      message: error.message || 'Failed to fetch analytics',
    });
  }
}

module.exports = {
  semanticSearch,
  fullTextSearch,
  hybridSearch,
  getAnalytics,
};
