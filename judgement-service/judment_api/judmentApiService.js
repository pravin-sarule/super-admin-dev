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
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return null;
  if (parsed > 1) return 1;
  return parsed;
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
  const semanticSourceTypes = sourceScopeToSourceTypes(requestedSourceScope);

  return {
    requestedSourceScope,
    fullTextSourceTypes,
    semanticSourceTypes,
    semanticEnabled: true,
    semanticEffectiveSourceScope: requestedSourceScope,
    semanticScopeCoverage: requestedSourceScope,
    semanticScopeCoverageMessage: null,
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

function sortPointsByScore(points = []) {
  return [...points].sort((left, right) => Number(right?.score || 0) - Number(left?.score || 0));
}

function dedupePointsByBestScore(points = []) {
  const unique = new Map();

  points.forEach((point) => {
    const pointId = String(point?.id || '').trim();
    if (!pointId) return;

    const existing = unique.get(pointId);
    if (!existing || Number(existing.score || 0) < Number(point.score || 0)) {
      unique.set(pointId, point);
    }
  });

  return sortPointsByScore(Array.from(unique.values()));
}

function selectBalancedAllScopePoints({
  adminPoints = [],
  userPoints = [],
  limit = 0,
} = {}) {
  const cappedLimit = Math.max(0, Number(limit || 0));
  if (!cappedLimit) return [];

  const adminQueue = dedupePointsByBestScore(adminPoints);
  const userQueue = dedupePointsByBestScore(userPoints);

  if (!adminQueue.length || !userQueue.length || cappedLimit === 1) {
    return dedupePointsByBestScore([...adminQueue, ...userQueue]).slice(0, cappedLimit);
  }

  const selected = [];
  const selectedIds = new Set();

  const takeNext = (queue) => {
    while (queue.length) {
      const candidate = queue.shift();
      const candidateId = String(candidate?.id || '').trim();
      if (!candidateId || selectedIds.has(candidateId)) continue;
      selectedIds.add(candidateId);
      selected.push(candidate);
      return candidate;
    }
    return null;
  };

  // Reserve one slot for each bucket so "All sources" keeps mixed coverage.
  takeNext(adminQueue);
  if (selected.length < cappedLimit) {
    takeNext(userQueue);
  }

  const leftovers = dedupePointsByBestScore([...adminQueue, ...userQueue]);
  for (const point of leftovers) {
    const pointId = String(point?.id || '').trim();
    if (!pointId || selectedIds.has(pointId)) continue;
    selectedIds.add(pointId);
    selected.push(point);
    if (selected.length >= cappedLimit) break;
  }

  return sortPointsByScore(selected).slice(0, cappedLimit);
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

  if (Array.isArray(filters.sourceTypes) && filters.sourceTypes.length) {
    must.push({
      key: 'source_type',
      match: { any: filters.sourceTypes.map((value) => String(value).trim()).filter(Boolean) },
    });
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
  const scope = payload.__resolvedSearchScope || resolveSearchScope(payload);
  const filters = {
    ...(payload.filters || {}),
    sourceTypes: scope.semanticSourceTypes || null,
  };
  const timings = {};
  const overallStartedAt = Date.now();

  logger.flow('Semantic search starting', {
    query,
    queryLength: query.length,
    chunkLimit: limit,
    scoreThreshold,
    requestedSourceScope: scope.requestedSourceScope,
    semanticSourceTypes: scope.semanticSourceTypes || 'all',
    additionalFilters: {
      judgmentUuid: filters.judgmentUuid || null,
      canonicalId: filters.canonicalId || null,
      courtCode: filters.courtCode || null,
      year: filters.year ?? null,
    },
  });

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

  logger.step('Generating query embedding (RETRIEVAL_QUERY)', { query });
  const embeddingStartedAt = Date.now();
  const embeddingResponse = await generateEmbeddings([query], { taskType: 'RETRIEVAL_QUERY' });
  timings.embeddingMs = Date.now() - embeddingStartedAt;
  logger.info('Query embedding generated', {
    embeddingDimension: Array.isArray(embeddingResponse?.vectors?.[0]) ? embeddingResponse.vectors[0].length : 0,
    embeddingModel: embeddingResponse?.model || null,
    durationMs: timings.embeddingMs,
  });

  const ADMIN_TYPES = ['admin-upload'];
  const USER_TYPES = ['ik_pipeline', 'indian_kanoon', 'google', 'google_grounding'];

  const isAllScope = scope.requestedSourceScope === 'all';
  const queryVector = embeddingResponse.vectors[0];
  const qdrantStartedAt = Date.now();

  let rawPoints;
  let balancedBuckets = null;

  if (isAllScope) {
    // Balanced retrieval: search admin and user buckets independently so the
    // smaller user-pipeline corpus always gets representation regardless of
    // global score ordering. Merge + dedupe by point.id, then sort by score.
    const adminFilter = buildQdrantFilter({ ...filters, sourceTypes: ADMIN_TYPES });
    const userFilter = buildQdrantFilter({ ...filters, sourceTypes: USER_TYPES });

    logger.step('Searching Qdrant — balanced retrieval (admin + user buckets)', {
      collection: COLLECTION_NAME,
      perBucketLimit: limit,
      scoreThreshold,
      adminFilterClauses: adminFilter?.must?.map((c) => ({ key: c.key, match: c.match })) || [],
      userFilterClauses: userFilter?.must?.map((c) => ({ key: c.key, match: c.match })) || [],
    });

    const [adminPoints, userPoints] = await Promise.all([
      searchChunksByVector({ vector: queryVector, limit, scoreThreshold, filter: adminFilter }),
      searchChunksByVector({ vector: queryVector, limit, scoreThreshold, filter: userFilter }),
    ]);

    const merged = new Map();
    for (const point of [...adminPoints, ...userPoints]) {
      const id = String(point.id);
      const existing = merged.get(id);
      if (!existing || Number(existing.score || 0) < Number(point.score || 0)) {
        merged.set(id, point);
      }
    }

    rawPoints = Array.from(merged.values()).sort(
      (a, b) => Number(b.score || 0) - Number(a.score || 0)
    );
    balancedBuckets = {
      adminPoints,
      userPoints,
    };

    logger.info('Balanced Qdrant retrieval complete', {
      adminBucketReturned: adminPoints.length,
      userBucketReturned: userPoints.length,
      mergedUnique: rawPoints.length,
      bySourceType: rawPoints.reduce((acc, point) => {
        const st = point?.payload?.source_type || 'unknown';
        acc[st] = (acc[st] || 0) + 1;
        return acc;
      }, {}),
    });
  } else {
    const qdrantFilter = buildQdrantFilter(filters);
    logger.step('Searching Qdrant by vector (single-scope)', {
      collection: COLLECTION_NAME,
      limit,
      scoreThreshold,
      filterApplied: Boolean(qdrantFilter),
      filterClauses: qdrantFilter?.must?.map((clause) => ({
        key: clause.key,
        match: clause.match,
      })) || [],
    });
    rawPoints = await searchChunksByVector({
      vector: queryVector,
      limit,
      scoreThreshold,
      filter: qdrantFilter,
    });
  }

  const thresholdFilteredPoints = scoreThreshold != null
    ? rawPoints.filter((point) => Number(point?.score || 0) >= scoreThreshold)
    : rawPoints;

  let points = thresholdFilteredPoints.slice(0, limit);

  if (isAllScope && balancedBuckets) {
    const adminThresholdFiltered = scoreThreshold != null
      ? balancedBuckets.adminPoints.filter((point) => Number(point?.score || 0) >= scoreThreshold)
      : balancedBuckets.adminPoints;
    const userThresholdFiltered = scoreThreshold != null
      ? balancedBuckets.userPoints.filter((point) => Number(point?.score || 0) >= scoreThreshold)
      : balancedBuckets.userPoints;

    points = selectBalancedAllScopePoints({
      adminPoints: adminThresholdFiltered,
      userPoints: userThresholdFiltered,
      limit,
    });
  }

  if (scoreThreshold != null && rawPoints.length !== thresholdFilteredPoints.length) {
    logger.warn('Qdrant returned points below score_threshold; filtered locally', {
      query,
      scoreThreshold,
      qdrantReturned: rawPoints.length,
      keptAfterFilter: thresholdFilteredPoints.length,
      droppedScores: rawPoints
        .filter((point) => Number(point?.score || 0) < scoreThreshold)
        .map((point) => Number(point?.score || 0).toFixed(4)),
    });
  }

  if (thresholdFilteredPoints.length > limit) {
    logger.info('Semantic results capped to requested limit', {
      query,
      requestedLimit: limit,
      resultsAfterThreshold: thresholdFilteredPoints.length,
      returnedResults: points.length,
      requestedSourceScope: scope.requestedSourceScope,
    });
  }

  logger.info('Qdrant semantic search completed', {
    query,
    requestedLimit: limit,
    requestedScoreThreshold: scoreThreshold,
    qdrantReturned: rawPoints.length,
    afterThresholdFilter: thresholdFilteredPoints.length,
    afterLimitCap: points.length,
    returnedBySourceType: points.reduce((acc, point) => {
      const sourceType = point?.payload?.source_type || 'unknown';
      acc[sourceType] = (acc[sourceType] || 0) + 1;
      return acc;
    }, {}),
    durationMs: Date.now() - qdrantStartedAt,
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

  const fallbackByJudgmentUuid = new Map();
  fallbackJudgmentRows.forEach((row) => {
    const key = String(row.judgment_uuid || '');
    if (key && !fallbackByJudgmentUuid.has(key)) {
      fallbackByJudgmentUuid.set(key, row);
    }
  });

  // Tier 3: ik_pipeline (and similar) Qdrant points carry a different judgment_uuid
  // than what Postgres uses, but the canonical_id is consistent across both stores.
  // Look up by canonical_id for any point still missing metadata.
  const canonicalIdsNeedingLookup = Array.from(
    new Set(
      points
        .filter((point) => {
          if (metadataByPointId.has(String(point.id))) return false;
          const judgmentUuid = String(point.payload?.judgment_uuid || '').trim();
          return !judgmentUuid || !fallbackByJudgmentUuid.has(judgmentUuid);
        })
        .map((point) => String(point.payload?.canonical_id || '').trim())
        .filter(Boolean)
    )
  );

  const fallbackByCanonicalId = new Map();
  if (canonicalIdsNeedingLookup.length) {
    const canonicalRows = await repository.getJudgmentMetadataByCanonicalIds(canonicalIdsNeedingLookup);
    canonicalRows.forEach((row) => {
      const key = String(row.canonical_id || '');
      if (key && !fallbackByCanonicalId.has(key)) {
        fallbackByCanonicalId.set(key, row);
      }
    });
  }
  timings.dbMs = Date.now() - dbStartedAt;

  const canonicalFallbackRowsAll = Array.from(fallbackByCanonicalId.values());

  const resolutionTrace = points.map((point) => {
    const pointId = String(point.id);
    const pointJudgmentUuid = String(point.payload?.judgment_uuid || '').trim();
    const pointCanonicalId = String(point.payload?.canonical_id || '').trim();
    const tier1 = metadataByPointId.has(pointId);
    const tier2 = !tier1 && pointJudgmentUuid && fallbackByJudgmentUuid.has(pointJudgmentUuid);
    const tier3 = !tier1 && !tier2 && pointCanonicalId && fallbackByCanonicalId.has(pointCanonicalId);
    let resolvedVia = 'UNRESOLVED';
    if (tier1) resolvedVia = 'tier1_pg_judgment_chunks_by_qdrant_point_id';
    else if (tier2) resolvedVia = 'tier2_pg_judgments_by_judgment_uuid';
    else if (tier3) resolvedVia = 'tier3_pg_judgments_by_canonical_id';
    return {
      pointId,
      score: roundTo(Number(point.score || 0), 4),
      sourceType: point.payload?.source_type || null,
      qdrantJudgmentUuid: pointJudgmentUuid || null,
      qdrantCanonicalId: pointCanonicalId || null,
      resolvedVia,
    };
  });

  const resolutionCounts = resolutionTrace.reduce(
    (acc, entry) => {
      acc[entry.resolvedVia] = (acc[entry.resolvedVia] || 0) + 1;
      return acc;
    },
    {}
  );

  logger.info('Semantic point → PG metadata resolution map', {
    keyExplainer: {
      tier1: 'point.id matches judgment_chunks.qdrant_point_id (admin-upload path — UUIDs aligned)',
      tier2: 'point.payload.judgment_uuid matches judgments.judgment_uuid (works when ingestion shared UUIDs)',
      tier3: 'point.payload.canonical_id matches judgments.canonical_id (ik_pipeline path — UUIDs differ between Qdrant and PG, canonical_id is the only shared key)',
    },
    perPoint: resolutionTrace,
    summary: resolutionCounts,
    qdrantHitsTotal: points.length,
    pgChunkRowsMatched: metadataRows.length,
    pgJudgmentsMatchedByUuid: fallbackJudgmentRows.length,
    pgJudgmentsMatchedByCanonicalId: canonicalFallbackRowsAll.length,
  });

  const signedUrlStartedAt = Date.now();
  const signedUrlMap = await buildSignedUrlMap(
    [...metadataRows, ...fallbackJudgmentRows, ...canonicalFallbackRowsAll],
    payload.signedUrlExpiryMinutes
  );
  timings.signedUrlMs = Date.now() - signedUrlStartedAt;

  const results = points.map((point) => {
    const pointId = String(point.id);
    const chunkMetadata = metadataByPointId.get(pointId) || null;
    const judgmentUuidFallback = fallbackByJudgmentUuid.get(String(point.payload?.judgment_uuid || '')) || null;
    const canonicalIdFallback = fallbackByCanonicalId.get(String(point.payload?.canonical_id || '')) || null;
    const fallbackMetadata = judgmentUuidFallback || canonicalIdFallback;
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

  const totalDurationMs = Date.now() - overallStartedAt;
  logger.info('Semantic search complete', {
    query,
    requestedSourceScope: scope.requestedSourceScope,
    semanticSourceTypes: scope.semanticSourceTypes || 'all',
    scoreThreshold,
    results: {
      qdrantReturned: rawPoints.length,
      afterThresholdFilter: points.length,
      finalReturnedToCaller: results.length,
      unresolvedMetadataPoints: resolutionTrace.filter((entry) => entry.resolvedVia === 'UNRESOLVED').length,
    },
    timings: {
      embeddingMs: timings.embeddingMs,
      qdrantMs: timings.qdrantMs,
      dbMs: timings.dbMs,
      signedUrlMs: timings.signedUrlMs,
      totalMs: totalDurationMs,
    },
    unavailableReason: unavailableReason || null,
  });

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

function stripHighlightTags(text) {
  return String(text || '')
    .replace(/<\/?mark>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function hydrateSemanticWithFullText({
  query,
  semantic,
  fullText,
}) {
  if (!semantic || !fullText) return semantic;

  const semanticLimit = normalizePositiveInt(semantic.limit, semantic.results?.length || 0, 50);
  const remainingSlots = Math.max(0, semanticLimit - (semantic.results?.length || 0));

  const presentKeys = new Set();
  (semantic.results || []).forEach((result) => {
    const uuid = String(result?.judgment?.judgmentUuid || '').trim();
    const canon = String(result?.judgment?.canonicalId || '').trim();
    if (uuid) presentKeys.add(`uuid:${uuid}`);
    if (canon) presentKeys.add(`canon:${canon}`);
  });

  const missingJudgments = (fullText.results || [])
    .filter((result) => {
      const uuid = String(result?.judgment?.judgmentUuid || '').trim();
      const canon = String(result?.judgment?.canonicalId || '').trim();
      // Need at least one identifier to dedupe + lookup against
      if (!uuid && !canon) return false;
      if (uuid && presentKeys.has(`uuid:${uuid}`)) return false;
      if (canon && presentKeys.has(`canon:${canon}`)) return false;
      return true;
    })
    .slice(0, remainingSlots);

  logger.flow('Hydration step — full-text → semantic merge', {
    semanticLimit,
    semanticResults: semantic.results?.length || 0,
    fullTextResults: fullText.results?.length || 0,
    remainingSlots,
    missingJudgmentsToHydrate: missingJudgments.length,
    missingJudgmentDetails: missingJudgments.map((r) => ({
      caseName: (r.judgment?.caseName || '').slice(0, 50),
      canonicalId: r.judgment?.canonicalId,
      judgmentUuid: r.judgment?.judgmentUuid || null,
      sourceType: r.judgment?.sourceType,
    })),
  });

  if (!remainingSlots || !missingJudgments.length) {
    return semantic;
  }

  const queryEmbeddingResponse = await generateEmbeddings([query], { taskType: 'RETRIEVAL_QUERY' });
  const queryVector = queryEmbeddingResponse.vectors?.[0];

  const hydrated = await Promise.all(
    missingJudgments.map(async (ftResult) => {
      const judgmentUuid = ftResult.judgment.judgmentUuid || null;
      const canonicalId = ftResult.judgment.canonicalId || null;
      const highlightSnippet = stripHighlightTags(
        (ftResult.highlights?.fullText || [])[0] || ftResult.judgment.caseName || ''
      );

      let bestPoint = null;

      if (queryVector && (judgmentUuid || canonicalId)) {
        try {
          // Prefer canonical_id since ik_pipeline-style ingest writes a
          // different judgment_uuid into Qdrant than what PG/ES carry.
          const lookupFilters = canonicalId
            ? { canonicalId }
            : { judgmentUuid };
          const judgmentPoints = await searchChunksByVector({
            vector: queryVector,
            limit: 1,
            scoreThreshold: null,
            filter: buildQdrantFilter(lookupFilters),
          });
          bestPoint = judgmentPoints?.[0] || null;
          logger.info('Per-judgment Qdrant lookup', {
            canonicalId,
            judgmentUuid,
            lookupKey: canonicalId ? 'canonical_id' : 'judgment_uuid',
            qdrantHit: Boolean(bestPoint),
            score: bestPoint ? Number(bestPoint.score).toFixed(4) : null,
          });
        } catch (error) {
          logger.warn('Per-judgment Qdrant lookup failed; using ES highlight as chunk', {
            canonicalId,
            judgmentUuid,
            reason: error.message,
          });
        }
      }

      const rawScore = bestPoint ? Number(bestPoint.score || 0) : 0;
      const fallbackKey = canonicalId || judgmentUuid || 'unknown';

      return {
        score: rawScore,
        rawScore: roundTo(rawScore, 3),
        relevanceScore: bestPoint
          ? normalizeSemanticRelevance(rawScore)
          : Math.round(Number(ftResult.relevanceScore || 0)),
        relevance: bestPoint
          ? { model: 'vector_similarity', rawScore: roundTo(rawScore, 3) }
          : { model: 'full_text_fallback', rawScore: roundTo(Number(ftResult.rawScore || 0), 3) },
        pointId: bestPoint ? String(bestPoint.id) : `ft-${fallbackKey}`,
        chunk: {
          chunkId: bestPoint ? String(bestPoint.id) : null,
          chunkIndex: bestPoint?.payload?.chunk_index ?? null,
          charStart: null,
          charEnd: null,
          chunkText: bestPoint?.payload?.chunk_text || highlightSnippet || null,
          embeddingModel: bestPoint ? 'gemini' : null,
          embeddingStatus: bestPoint ? 'indexed' : 'unavailable',
        },
        judgment: ftResult.judgment,
        document: ftResult.document,
        qdrantPayload: bestPoint?.payload || {},
        matchType: bestPoint ? 'vector_per_judgment' : 'full_text_fallback',
        sourceFallback: bestPoint ? null : 'elasticsearch_highlight',
      };
    })
  );

  const merged = [...(semantic.results || []), ...hydrated].slice(0, semanticLimit);

  logger.info('Hydration complete', {
    originalSemanticCount: semantic.results?.length || 0,
    hydratedAdded: hydrated.length,
    finalCount: merged.length,
    hydratedBreakdown: hydrated.reduce((acc, item) => {
      acc[item.matchType] = (acc[item.matchType] || 0) + 1;
      return acc;
    }, {}),
  });

  return {
    ...semantic,
    results: merged,
    totalResults: merged.length,
    hydratedFromFullText: hydrated.length,
  };
}

async function hybridSearch(payload = {}) {
  const semanticLimit = normalizePositiveInt(payload.semanticLimit || payload.chunkLimit || payload.limit, 8, 50);
  const fullTextLimit = normalizePositiveInt(payload.fullTextLimit || payload.judgmentLimit || payload.limit, 10, 50);
  const scope = resolveSearchScope(payload);

  const [semanticInitial, fullText] = await Promise.all([
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

  const semantic = await hydrateSemanticWithFullText({
    query: semanticInitial.query,
    semantic: semanticInitial,
    fullText,
  });

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
