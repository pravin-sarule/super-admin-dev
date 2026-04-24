const { generateEmbeddings } = require('../services/embeddingService');
const { searchChunksByVector, COLLECTION_NAME } = require('../services/qdrantService');
const { searchJudgmentDocuments } = require('../services/elasticsearchService');
const { getSignedReadUrl } = require('../services/storageService');
const {
  sourceScopeToSourceTypes,
  toSourceBucket,
} = require('../services/duplicateDetectionService');
const repository = require('./judmentApiRepository');
const { createLogger } = require('../utils/logger');

const logger = createLogger('JudmentApiService');
const DEFAULT_SIGNED_URL_EXPIRY_MINUTES = Math.max(
  1,
  Number(process.env.JUDMENT_API_SIGNED_URL_EXPIRY_MINUTES || 60)
);
const DEFAULT_SOURCE_SCOPE = String(
  process.env.JUDMENT_API_DEFAULT_SOURCE_SCOPE || 'admin_uploaded'
).trim().toLowerCase();

function normalizePositiveInt(value, fallback, max = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function normalizeScoreThreshold(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeQuery(query) {
  return String(query || '').trim();
}

function roundTo(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSourceScope(scope) {
  const normalized = String(scope || DEFAULT_SOURCE_SCOPE).trim().toLowerCase();
  if (normalized === 'admin_uploaded' || normalized === 'user_generated' || normalized === 'all') {
    return normalized;
  }
  return 'admin_uploaded';
}

function resolveSearchScope(payload = {}) {
  const requestedSourceScope = normalizeSourceScope(payload.sourceScope);
  const fullTextSourceTypes = sourceScopeToSourceTypes(requestedSourceScope);
  const semanticEnabled = requestedSourceScope !== 'user_generated';
  const semanticEffectiveSourceScope =
    requestedSourceScope === 'all' ? 'admin_uploaded' : requestedSourceScope;

  let semanticScopeCoverage = requestedSourceScope;
  let semanticScopeCoverageMessage = null;

  if (requestedSourceScope === 'all') {
    semanticScopeCoverage = 'admin_uploaded_only';
    semanticScopeCoverageMessage =
      'Semantic retrieval currently searches admin-uploaded judgments only because legal_embeddings_v2 does not store user-generated embeddings.';
  } else if (requestedSourceScope === 'user_generated') {
    semanticScopeCoverage = 'unavailable';
    semanticScopeCoverageMessage =
      'Semantic retrieval is unavailable for user-generated judgments because legal_embeddings_v2 only stores admin-upload embeddings.';
  }

  return {
    requestedSourceScope,
    fullTextSourceTypes,
    semanticEnabled,
    semanticEffectiveSourceScope,
    semanticScopeCoverage,
    semanticScopeCoverageMessage,
  };
}

function tokenizeQuery(query) {
  return Array.from(
    new Set(
      String(query || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3)
    )
  );
}

function normalizeSemanticRelevance(rawScore) {
  const parsed = Number(rawScore);
  if (!Number.isFinite(parsed)) return 0;

  const normalized = parsed >= 0 && parsed <= 1
    ? parsed
    : clamp((parsed + 1) / 2, 0, 1);

  return Math.round(normalized * 100);
}

function buildFullTextRelevance(hit, query, maxRawScore = 0) {
  const rawScore = Number(hit?._score || 0);
  const source = hit?._source || {};
  const highlights = hit?.highlight || {};
  const queryTerms = tokenizeQuery(query);
  const textCorpus = [
    source.case_name || '',
    ...(highlights.case_name || []),
    ...(highlights.full_text || []),
  ].join(' ').toLowerCase();

  const matchedTerms = queryTerms.filter((term) => textCorpus.includes(term));
  const queryCoverage = queryTerms.length ? matchedTerms.length / queryTerms.length : 0;
  const exactPhraseMatch = textCorpus.includes(String(query || '').trim().toLowerCase());
  const highlightCount = (highlights.full_text || []).length + (highlights.case_name || []).length;

  const saturationScore = 1 - Math.exp(-rawScore / 8);
  const relativeScore = maxRawScore > 0 ? clamp(rawScore / maxRawScore, 0, 1) : 0;
  const highlightSignal = clamp(highlightCount / 3, 0, 1);
  const phraseBonus = exactPhraseMatch ? 0.08 : 0;

  const normalizedScore = clamp(
    (saturationScore * 0.5) +
      (relativeScore * 0.25) +
      (queryCoverage * 0.2) +
      (highlightSignal * 0.05) +
      phraseBonus,
    0,
    1
  );

  return {
    score: Math.round(normalizedScore * 100),
    model: 'hybrid_elasticsearch',
    rawScore: roundTo(rawScore, 3),
    queryCoverage: roundTo(queryCoverage, 3),
    matchedTerms,
    totalTerms: queryTerms.length,
    exactPhraseMatch,
    highlightCount,
  };
}

function buildQdrantFilter(filters = {}) {
  const must = [];

  if (filters.judgmentUuid) {
    must.push({
      key: 'judgment_uuid',
      match: { value: String(filters.judgmentUuid).trim() },
    });
  }

  if (filters.canonicalId) {
    must.push({
      key: 'canonical_id',
      match: { value: String(filters.canonicalId).trim() },
    });
  }

  if (filters.courtCode) {
    must.push({
      key: 'court_code',
      match: { value: String(filters.courtCode).trim() },
    });
  }

  if (filters.year != null && String(filters.year).trim() !== '') {
    const year = Number(filters.year);
    if (Number.isFinite(year)) {
      must.push({
        key: 'year',
        match: { value: year },
      });
    }
  }

  return must.length ? { must } : null;
}

async function buildSignedUrlMap(rows = [], expiresMinutes = DEFAULT_SIGNED_URL_EXPIRY_MINUTES) {
  const storagePaths = Array.from(
    new Set(
      rows
        .map((row) => row.storage_path)
        .filter(Boolean)
    )
  );

  const signedUrlMap = new Map();
  if (!storagePaths.length) {
    return signedUrlMap;
  }

  await Promise.all(storagePaths.map(async (storagePath) => {
    try {
      const signedUrl = await getSignedReadUrl(storagePath, expiresMinutes);
      signedUrlMap.set(storagePath, signedUrl);
    } catch (error) {
      logger.warn('Failed to generate signed URL for search result', {
        storagePath,
        errorMessage: error.message,
      });
    }
  }));

  return signedUrlMap;
}

function buildDocumentSource(row, signedUrlMap) {
  const signedStorageUrl = row.storage_path ? signedUrlMap.get(row.storage_path) || null : null;
  const sourceUrl = row.source_url || null;

  return {
    originalFilename: row.original_filename || null,
    sourceUrl,
    storageBucket: row.storage_bucket || null,
    storagePath: row.storage_path || null,
    storageUri: row.storage_uri || null,
    originalFileUrl: signedStorageUrl || sourceUrl || row.storage_uri || null,
    signedStorageUrl,
  };
}

function formatSemanticResult(point, metadataRow, signedUrlMap) {
  const rawScore = Number(point.score || 0);
  const sourceType = metadataRow?.source_type || point.payload?.source_type || 'admin-upload';
  return {
    score: rawScore,
    rawScore: roundTo(rawScore, 3),
    relevanceScore: normalizeSemanticRelevance(rawScore),
    relevance: {
      model: 'vector_similarity',
      rawScore: roundTo(rawScore, 3),
    },
    pointId: String(point.id),
    chunk: {
      chunkId: metadataRow?.chunk_id || point.id,
      chunkIndex: metadataRow?.chunk_index ?? point.payload?.chunk_index ?? null,
      charStart: metadataRow?.char_start ?? null,
      charEnd: metadataRow?.char_end ?? null,
      chunkText: metadataRow?.chunk_text || point.payload?.chunk_text || null,
      embeddingModel: metadataRow?.embedding_model || null,
      embeddingStatus: metadataRow?.embedding_status || null,
    },
    judgment: {
      judgmentUuid: metadataRow?.judgment_uuid || point.payload?.judgment_uuid || null,
      canonicalId: metadataRow?.canonical_id || point.payload?.canonical_id || null,
      caseName: metadataRow?.case_name || point.payload?.case_name || null,
      courtCode: metadataRow?.court_code || point.payload?.court_code || null,
      year: metadataRow?.year ?? point.payload?.year ?? null,
      judgmentDate: metadataRow?.judgment_date || null,
      sourceType,
      sourceBucket: toSourceBucket(sourceType),
      verificationStatus: metadataRow?.verification_status || null,
      confidenceScore: metadataRow?.confidence_score ?? null,
      citationData: metadataRow?.citation_data || {},
      ocrInfo: metadataRow?.ocr_info || {},
    },
    document: {
      documentId: metadataRow?.document_id || null,
      uploadStatus: metadataRow?.upload_status || null,
      uploadMetadata: metadataRow?.upload_metadata || {},
      pipelineMetrics: metadataRow?.pipeline_metrics || {},
      createdAt: metadataRow?.upload_created_at || null,
      updatedAt: metadataRow?.upload_updated_at || null,
      ...buildDocumentSource(metadataRow || {}, signedUrlMap),
    },
    qdrantPayload: point.payload || {},
  };
}

function formatFullTextResult(hit, metadataRow, signedUrlMap, query, maxRawScore) {
  const source = hit._source || {};
  const highlights = hit.highlight || {};
  const relevance = buildFullTextRelevance(hit, query, maxRawScore);
  const sourceType = metadataRow?.source_type || source.source_type || null;

  return {
    score: relevance.rawScore,
    rawScore: relevance.rawScore,
    relevanceScore: relevance.score,
    relevance,
    judgment: {
      judgmentUuid: metadataRow?.judgment_uuid || source.judgment_uuid || null,
      canonicalId: metadataRow?.canonical_id || source.canonical_id || null,
      caseName: metadataRow?.case_name || source.case_name || null,
      courtCode: metadataRow?.court_code || source.court_code || null,
      year: metadataRow?.year ?? source.year ?? null,
      judgmentDate: metadataRow?.judgment_date || source.judgment_date || null,
      sourceType,
      sourceBucket: sourceType ? toSourceBucket(sourceType) : null,
      verificationStatus: metadataRow?.verification_status || null,
      confidenceScore: metadataRow?.confidence_score ?? null,
      citationData: metadataRow?.citation_data || {},
      ocrInfo: metadataRow?.ocr_info || {},
      citations: Array.isArray(source.citations) ? source.citations : [],
      status: metadataRow?.judgment_status || source.status || null,
    },
    document: {
      documentId: metadataRow?.document_id || null,
      uploadStatus: metadataRow?.upload_status || null,
      uploadMetadata: metadataRow?.upload_metadata || {},
      pipelineMetrics: metadataRow?.pipeline_metrics || {},
      createdAt: metadataRow?.upload_created_at || null,
      updatedAt: metadataRow?.upload_updated_at || null,
      ...buildDocumentSource(metadataRow || source || {}, signedUrlMap),
    },
    highlights: {
      fullText: highlights.full_text || [],
      caseName: highlights.case_name || [],
    },
  };
}

async function semanticSearch(payload = {}) {
  const query = normalizeQuery(payload.query);
  if (!query) {
    const error = new Error('query is required');
    error.statusCode = 400;
    throw error;
  }

  const limit = normalizePositiveInt(payload.limit || payload.chunkLimit, 8, 50);
  const scoreThreshold = normalizeScoreThreshold(payload.scoreThreshold);
  const filters = payload.filters || {};
  const scope = payload.__resolvedSearchScope || resolveSearchScope(payload);
  const timings = {};

  if (!scope.semanticEnabled) {
    return {
      query,
      collection: COLLECTION_NAME,
      searchMode: 'semantic',
      limit,
      scoreThreshold,
      appliedScoreThreshold: null,
      thresholdFallbackTriggered: false,
      filters: {
        ...filters,
        sourceScope: scope.requestedSourceScope,
      },
      requestedSourceScope: scope.requestedSourceScope,
      effectiveSourceScope: null,
      scopeCoverage: scope.semanticScopeCoverage,
      scopeCoverageMessage: scope.semanticScopeCoverageMessage,
      unavailableReason: scope.semanticScopeCoverageMessage,
      totalResults: 0,
      timings,
      results: [],
    };
  }

  const embeddingStartedAt = Date.now();
  const embeddingResponse = await generateEmbeddings([query], { taskType: 'RETRIEVAL_QUERY' });
  timings.embeddingMs = Date.now() - embeddingStartedAt;

  const qdrantStartedAt = Date.now();
  const points = await searchChunksByVector({
    vector: embeddingResponse.vectors[0],
    limit,
    scoreThreshold,
    filter: buildQdrantFilter(filters),
  });
  const appliedScoreThreshold = scoreThreshold;
  const thresholdFallbackTriggered = false;
  timings.qdrantMs = Date.now() - qdrantStartedAt;

  const pointIds = points.map((point) => String(point.id));
  const dbStartedAt = Date.now();
  const metadataRows = await repository.getChunkMetadataByPointIds(pointIds);

  const metadataByPointId = new Map();
  metadataRows.forEach((row) => {
    metadataByPointId.set(String(row.chunk_id), row);
    if (row.qdrant_point_id) {
      metadataByPointId.set(String(row.qdrant_point_id), row);
    }
  });

  const fallbackJudgmentUuids = Array.from(
    new Set(
      points
        .filter((point) => !metadataByPointId.has(String(point.id)))
        .map((point) => String(point.payload?.judgment_uuid || '').trim())
        .filter(Boolean)
    )
  );

  const fallbackJudgmentRows = fallbackJudgmentUuids.length
    ? await repository.getJudgmentMetadataByJudgmentUuids(fallbackJudgmentUuids)
    : [];
  timings.dbMs = Date.now() - dbStartedAt;

  const fallbackByJudgmentUuid = new Map();
  fallbackJudgmentRows.forEach((row) => {
    const key = String(row.judgment_uuid || '');
    if (key && !fallbackByJudgmentUuid.has(key)) {
      fallbackByJudgmentUuid.set(key, row);
    }
  });

  const signedUrlStartedAt = Date.now();
  const signedUrlMap = await buildSignedUrlMap(
    [...metadataRows, ...fallbackJudgmentRows],
    payload.signedUrlExpiryMinutes
  );
  timings.signedUrlMs = Date.now() - signedUrlStartedAt;

  const results = points.map((point) => {
    const pointId = String(point.id);
    const chunkMetadata = metadataByPointId.get(pointId) || null;
    const fallbackMetadata = fallbackByJudgmentUuid.get(String(point.payload?.judgment_uuid || '')) || null;
    const resolvedMetadata = chunkMetadata || fallbackMetadata
      ? {
        ...(fallbackMetadata || {}),
        ...(chunkMetadata || {}),
      }
      : null;

    return formatSemanticResult(
      point,
      resolvedMetadata,
      signedUrlMap
    );
  });

  let unavailableReason = scope.semanticScopeCoverageMessage || '';
  if (!results.length && !unavailableReason) {
    if (scoreThreshold != null) {
      unavailableReason = `No chunks scored above the similarity threshold of ${Number(scoreThreshold).toFixed(2)} for this query. Try lowering the threshold or rephrasing the query.`;
    } else {
      unavailableReason = 'No semantic chunks matched this query.';
    }
  }

  return {
    query,
    collection: COLLECTION_NAME,
    searchMode: 'semantic',
    limit,
    scoreThreshold,
    appliedScoreThreshold,
    thresholdFallbackTriggered,
    filters: {
      ...filters,
      sourceScope: scope.requestedSourceScope,
    },
    requestedSourceScope: scope.requestedSourceScope,
    effectiveSourceScope: scope.semanticEffectiveSourceScope,
    scopeCoverage: scope.semanticScopeCoverage,
    scopeCoverageMessage: scope.semanticScopeCoverageMessage,
    unavailableReason,
    totalResults: results.length,
    timings,
    results,
  };
}

async function fullTextSearch(payload = {}) {
  const query = normalizeQuery(payload.query);
  if (!query) {
    const error = new Error('query is required');
    error.statusCode = 400;
    throw error;
  }

  const limit = normalizePositiveInt(payload.limit || payload.judgmentLimit, 10, 50);
  const phraseMatch = Boolean(payload.phraseMatch);
  const operator = String(payload.operator || 'and').toLowerCase() === 'or' ? 'or' : 'and';
  const scope = payload.__resolvedSearchScope || resolveSearchScope(payload);
  const timings = {};

  const elasticStartedAt = Date.now();
  const hits = await searchJudgmentDocuments({
    query,
    limit,
    phraseMatch,
    operator,
    sourceTypes: scope.fullTextSourceTypes,
  });
  timings.elasticMs = Date.now() - elasticStartedAt;

  const judgmentUuids = hits
    .map((hit) => hit._source?.judgment_uuid)
    .filter(Boolean);

  const dbStartedAt = Date.now();
  const metadataRows = await repository.getJudgmentMetadataByJudgmentUuids(judgmentUuids);
  timings.dbMs = Date.now() - dbStartedAt;

  const metadataByJudgmentUuid = new Map();
  metadataRows.forEach((row) => {
    if (!metadataByJudgmentUuid.has(String(row.judgment_uuid))) {
      metadataByJudgmentUuid.set(String(row.judgment_uuid), row);
    }
  });

  const signedUrlStartedAt = Date.now();
  const signedUrlMap = await buildSignedUrlMap(metadataRows, payload.signedUrlExpiryMinutes);
  timings.signedUrlMs = Date.now() - signedUrlStartedAt;

  const maxRawScore = hits.reduce((maxScore, hit) => {
    const parsed = Number(hit?._score || 0);
    return Number.isFinite(parsed) ? Math.max(maxScore, parsed) : maxScore;
  }, 0);

  const results = hits.map((hit) => {
    const judgmentUuid = String(hit._source?.judgment_uuid || '');
    return formatFullTextResult(
      hit,
      metadataByJudgmentUuid.get(judgmentUuid) || null,
      signedUrlMap,
      query,
      maxRawScore
    );
  });

  return {
    query,
    searchMode: 'full_text',
    limit,
    phraseMatch,
    operator,
    requestedSourceScope: scope.requestedSourceScope,
    effectiveSourceScope: scope.requestedSourceScope,
    filters: {
      sourceScope: scope.requestedSourceScope,
      sourceTypes: scope.fullTextSourceTypes,
    },
    totalResults: results.length,
    timings,
    results,
  };
}

async function hybridSearch(payload = {}) {
  const semanticLimit = normalizePositiveInt(payload.semanticLimit || payload.chunkLimit || payload.limit, 8, 50);
  const fullTextLimit = normalizePositiveInt(payload.fullTextLimit || payload.judgmentLimit || payload.limit, 10, 50);
  const scope = resolveSearchScope(payload);

  const [semantic, fullText] = await Promise.all([
    semanticSearch({
      ...payload,
      __resolvedSearchScope: scope,
      limit: semanticLimit,
    }),
    fullTextSearch({
      ...payload,
      __resolvedSearchScope: scope,
      limit: fullTextLimit,
    }),
  ]);

  return {
    query: semantic.query,
    searchMode: 'hybrid',
    requestedSourceScope: scope.requestedSourceScope,
    filters: {
      sourceScope: scope.requestedSourceScope,
      fullTextSourceTypes: scope.fullTextSourceTypes,
    },
    searchScopes: {
      requested: scope.requestedSourceScope,
      semantic: {
        enabled: scope.semanticEnabled,
        effective: semantic.effectiveSourceScope,
        coverage: semantic.scopeCoverage,
        message: semantic.scopeCoverageMessage || null,
      },
      fullText: {
        effective: fullText.effectiveSourceScope,
      },
    },
    semantic,
    fullText,
    totalResults: {
      semanticChunks: semantic.totalResults,
      fullTextJudgments: fullText.totalResults,
    },
    timings: {
      embeddingMs: semantic.timings.embeddingMs || 0,
      qdrantMs: semantic.timings.qdrantMs || 0,
      elasticMs: fullText.timings.elasticMs || 0,
      dbMs: (semantic.timings.dbMs || 0) + (fullText.timings.dbMs || 0),
      signedUrlMs: (semantic.timings.signedUrlMs || 0) + (fullText.timings.signedUrlMs || 0),
    },
  };
}

module.exports = {
  semanticSearch,
  fullTextSearch,
  hybridSearch,
};
