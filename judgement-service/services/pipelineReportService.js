const pipelineReportRepository = require('./pipelineReportRepository');
const {
  countJudgmentDocuments,
  getJudgmentDocument,
  summarizeIkJudgmentDocuments,
  listIkJudgmentDocuments,
  getIkJudgmentDocument,
  IK_JUDGMENTS_INDEX,
} = require('./elasticsearchService');
const {
  countPoints,
  countPointsByCanonicalIds,
  fetchPointsByIds,
  fetchAllPointsByFilter,
  COLLECTION_NAME,
} = require('./qdrantService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PipelineReport');

const QDRANT_COUNT_CACHE_TTL_MS = 10000;
const qdrantCountCache = new Map();

function getCachedQdrantCounts(cacheKey) {
  const entry = qdrantCountCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > QDRANT_COUNT_CACHE_TTL_MS) {
    qdrantCountCache.delete(cacheKey);
    return null;
  }
  return entry.value;
}

function setCachedQdrantCounts(cacheKey, value) {
  qdrantCountCache.set(cacheKey, { value, cachedAt: Date.now() });
}

function getSourceDescriptor(sourceType) {
  if (sourceType === 'ik_pipeline') {
    return {
      title: 'Indian Kanoon Fallback Pipeline',
      shortLabel: 'User Pipeline',
      description:
        'When a user searches a citation that is not available locally, we fetch the judgment from Indian Kanoon and store the raw copy in Elasticsearch index ik_judgments.',
      steps: [
        {
          key: 'local_lookup',
          title: '1. Check local knowledge first',
          detail: 'User citation search looks in our local database before reaching outside the system.',
        },
        {
          key: 'ik_fallback',
          title: '2. Fallback to Indian Kanoon',
          detail: 'If the citation is missing locally, the user pipeline fetches the judgment from Indian Kanoon.',
        },
        {
          key: 'store_insert',
          title: '3. Insert into our stores',
          detail: 'The fetched judgment is written into the ik_judgments Elasticsearch index so future citation searches can reuse the local copy.',
        },
      ],
    };
  }

  return {
    title: `Pipeline Report: ${sourceType}`,
    shortLabel: sourceType,
    description: `Judgments currently stored with source_type = ${sourceType}.`,
    steps: [
      {
        key: 'source',
        title: 'Source pipeline',
        detail: `This report is scoped to judgments stored with source_type = ${sourceType}.`,
      },
    ],
  };
}

function buildSourceTypeArray(sourceType) {
  if (!sourceType || sourceType === pipelineReportRepository.ALL_SOURCE_TYPES) {
    return null;
  }

  return [sourceType];
}

function buildQdrantFilter({ sourceType, canonicalId = null }) {
  const must = [];

  if (canonicalId) {
    must.push({
      key: 'canonical_id',
      match: { value: canonicalId },
    });
  }

  if (sourceType && sourceType !== pipelineReportRepository.ALL_SOURCE_TYPES) {
    must.push({
      key: 'source_type',
      match: { value: sourceType },
    });
  }

  return must.length ? { must } : null;
}

function createWarning(store, error) {
  return {
    store,
    message: error?.message || `${store} data could not be loaded`,
  };
}

function isIkJudgmentsSource(sourceType) {
  return sourceType === 'ik_pipeline';
}

function mapIkRowToJudgment(row, qdrantPointCount = 0) {
  return {
    judgmentUuid: row.tid,
    canonicalId: row.tid,
    caseName: row.title,
    courtCode: row.docsource,
    judgmentDate: row.publishdate,
    year: row.year,
    sourceType: 'ik_pipeline',
    status: 'indexed',
    esDocId: row.tid,
    createdAt: row.fetched_at || row.publishdate,
    updatedAt: row.fetched_at || row.publishdate,
    stores: {
      postgres: false,
      elasticsearch: true,
      qdrantPoints: qdrantPointCount,
    },
  };
}

function resolveSettledCount(result, store, warnings) {
  if (result.status === 'fulfilled') {
    return {
      status: 'healthy',
      count: Number(result.value || 0),
    };
  }

  warnings.push(createWarning(store, result.reason));
  return {
    status: 'degraded',
    count: 0,
  };
}

async function getPipelineReportSummary({ sourceType } = {}) {
  const normalizedSourceType = pipelineReportRepository.normalizeSourceType(sourceType);
  const descriptor = getSourceDescriptor(normalizedSourceType);
  const startedAt = Date.now();

  logger.flow('Building pipeline report summary', {
    sourceType: normalizedSourceType,
    report: descriptor.title,
    dataFlow: descriptor.steps.map((step) => step.title),
  });

  const [postgresSummaryResult, esCountResult, qdrantCountResult] = await Promise.allSettled([
    pipelineReportRepository.getPipelineReportSummary({
      sourceType: normalizedSourceType,
    }),
    isIkJudgmentsSource(normalizedSourceType)
      ? summarizeIkJudgmentDocuments()
      : countJudgmentDocuments({
        sourceTypes: buildSourceTypeArray(normalizedSourceType),
      }),
    countPoints({
      filter: buildQdrantFilter({ sourceType: normalizedSourceType }),
    }),
  ]);

  const postgresSummary = postgresSummaryResult.status === 'fulfilled'
    ? postgresSummaryResult.value
    : {
      sourceType: normalizedSourceType,
      totalJudgments: 0,
      judgmentsWithDate: 0,
      judgmentsWithYear: 0,
      esLinkedJudgments: 0,
      uploadedStatusCount: 0,
      distinctCourts: 0,
      firstInsertedAt: null,
      latestInsertedAt: null,
    };

  const postgresCount = Number(postgresSummary.totalJudgments || 0);

  logger.step('PostgreSQL pipeline summary loaded', {
    sourceType: normalizedSourceType,
    totalJudgments: postgresCount,
    latestInsertedAt: postgresSummary.latestInsertedAt,
    pgFulfilled: postgresSummaryResult.status === 'fulfilled',
  });

  const warnings = [];
  let elasticsearch = resolveSettledCount(esCountResult, 'elasticsearch', warnings);
  const qdrant = resolveSettledCount(qdrantCountResult, 'qdrant', warnings);

  if (isIkJudgmentsSource(normalizedSourceType) && esCountResult.status === 'fulfilled') {
    const ikSummary = esCountResult.value;
    postgresSummary.totalJudgments = ikSummary.totalJudgments;
    postgresSummary.judgmentsWithDate = ikSummary.judgmentsWithDate;
    postgresSummary.distinctCourts = ikSummary.distinctCourts;
    postgresSummary.firstInsertedAt = ikSummary.firstInsertedAt;
    postgresSummary.latestInsertedAt = ikSummary.latestInsertedAt;
    elasticsearch = {
      status: 'healthy',
      count: ikSummary.totalJudgments,
      index: ikSummary.index || IK_JUDGMENTS_INDEX,
    };
  }

  const response = {
    sourceType: normalizedSourceType,
    descriptor,
    summary: postgresSummary,
    stores: {
      postgres: {
        status: postgresSummaryResult.status === 'fulfilled' ? 'healthy' : 'degraded',
        count: postgresCount,
      },
      elasticsearch,
      qdrant: {
        ...qdrant,
        collection: COLLECTION_NAME,
      },
    },
    warnings,
  };

  if (warnings.length) {
    logger.warn('Pipeline report summary completed with degraded stores', {
      sourceType: normalizedSourceType,
      warnings,
      durationMs: Date.now() - startedAt,
    });
  } else {
    logger.info('Pipeline report summary ready', {
      sourceType: normalizedSourceType,
      postgresCount: response.stores.postgres.count,
      elasticsearchCount: response.stores.elasticsearch.count,
      qdrantCount: response.stores.qdrant.count,
      durationMs: Date.now() - startedAt,
    });
  }

  return response;
}

async function listPipelineJudgments({
  sourceType,
  search = '',
  limit = 10,
  offset = 0,
} = {}) {
  const normalizedSourceType = pipelineReportRepository.normalizeSourceType(sourceType);
  const normalizedSearch = pipelineReportRepository.normalizeSearch(search);
  const normalizedLimit = pipelineReportRepository.normalizeLimit(limit);
  const normalizedOffset = pipelineReportRepository.normalizeOffset(offset);
  const descriptor = getSourceDescriptor(normalizedSourceType);
  const startedAt = Date.now();

  logger.flow('Listing pipeline report judgments', {
    sourceType: normalizedSourceType,
    search: normalizedSearch,
    limit: normalizedLimit,
    offset: normalizedOffset,
  });

  if (isIkJudgmentsSource(normalizedSourceType)) {
    const ikList = await listIkJudgmentDocuments({
      search: normalizedSearch,
      limit: normalizedLimit,
      offset: normalizedOffset,
    });

    const warnings = [];
    const canonicalIds = ikList.rows.map((row) => row.tid).filter(Boolean);
    let qdrantCountsMap = new Map();

    if (canonicalIds.length) {
      try {
        qdrantCountsMap = await countPointsByCanonicalIds({
          sourceType: normalizedSourceType,
          canonicalIds,
        });
      } catch (error) {
        warnings.push(createWarning('qdrant', error));
      }
    }

    const judgments = ikList.rows.map((row) => (
      mapIkRowToJudgment(row, Number(qdrantCountsMap.get(row.tid) || 0))
    ));

    logger.info('Pipeline judgment list ready from ik_judgments', {
      sourceType: normalizedSourceType,
      search: normalizedSearch,
      totalMatches: ikList.total,
      returnedRows: judgments.length,
      durationMs: Date.now() - startedAt,
    });

    return {
      sourceType: normalizedSourceType,
      descriptor,
      judgments,
      meta: {
        total: ikList.total,
        limit: normalizedLimit,
        offset: normalizedOffset,
        search: normalizedSearch,
        hasMore: normalizedOffset + judgments.length < ikList.total,
        index: ikList.index || IK_JUDGMENTS_INDEX,
      },
      warnings,
    };
  }

  const postgresList = await pipelineReportRepository.listPipelineJudgments({
    sourceType: normalizedSourceType,
    search: normalizedSearch,
    limit: normalizedLimit,
    offset: normalizedOffset,
  });

  logger.step('PostgreSQL pipeline rows loaded', {
    sourceType: normalizedSourceType,
    totalMatches: postgresList.total,
    returnedRows: postgresList.rows.length,
  });

  const warnings = [];
  const canonicalIds = postgresList.rows
    .map((row) => row.canonical_id)
    .filter(Boolean);

  let qdrantCountsMap = new Map();
  if (canonicalIds.length) {
    const effectiveSourceType =
      normalizedSourceType !== pipelineReportRepository.ALL_SOURCE_TYPES
        ? normalizedSourceType
        : null;
    const cacheKey = `${effectiveSourceType || 'all'}|${canonicalIds.slice().sort().join(',')}`;
    const cached = getCachedQdrantCounts(cacheKey);

    if (cached) {
      qdrantCountsMap = cached;
    } else {
      try {
        qdrantCountsMap = await countPointsByCanonicalIds({
          sourceType: effectiveSourceType,
          canonicalIds,
        });
        setCachedQdrantCounts(cacheKey, qdrantCountsMap);
      } catch (error) {
        warnings.push(createWarning('qdrant', error));
        qdrantCountsMap = new Map();
      }
    }
  }

  const judgments = postgresList.rows.map((row) => {
    const qdrantPointCount = row.canonical_id
      ? Number(qdrantCountsMap.get(row.canonical_id) || 0)
      : 0;

    return {
      judgmentUuid: row.judgment_uuid,
      canonicalId: row.canonical_id,
      caseName: row.case_name,
      courtCode: row.court_code,
      judgmentDate: row.judgment_date,
      year: row.year,
      sourceType: row.source_type,
      status: row.status,
      esDocId: row.es_doc_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stores: {
        postgres: true,
        elasticsearch: Boolean(row.es_doc_id),
        qdrantPoints: qdrantPointCount,
      },
    };
  });

  const dedupedWarnings = warnings.filter((warning, index, items) =>
    items.findIndex((candidate) => candidate.store === warning.store && candidate.message === warning.message) === index
  );

  if (dedupedWarnings.length) {
    logger.warn('Pipeline judgment list completed with degraded stores', {
      sourceType: normalizedSourceType,
      warnings: dedupedWarnings,
      durationMs: Date.now() - startedAt,
    });
  } else {
    logger.info('Pipeline judgment list ready', {
      sourceType: normalizedSourceType,
      search: normalizedSearch,
      totalMatches: postgresList.total,
      returnedRows: judgments.length,
      durationMs: Date.now() - startedAt,
    });
  }

  return {
    sourceType: normalizedSourceType,
    descriptor,
    judgments,
    meta: {
      total: postgresList.total,
      limit: normalizedLimit,
      offset: normalizedOffset,
      search: normalizedSearch,
      hasMore: normalizedOffset + judgments.length < postgresList.total,
    },
    warnings: dedupedWarnings,
  };
}

function qdrantPointToChunkRow(point = {}, fallback = {}) {
  const payload = point?.payload || {};
  const chunkIndex = Number(payload.chunk_index ?? 0);
  const chunkText = String(payload.chunk_text || '');

  return {
    chunk_id: String(point.id ?? ''),
    document_id: null,
    judgment_uuid: payload.judgment_uuid || fallback.judgmentUuid || null,
    chunk_index: Number.isFinite(chunkIndex) ? chunkIndex : 0,
    char_start: Number(payload.char_start ?? 0),
    char_end: Number(payload.char_end ?? chunkText.length),
    chunk_text: chunkText,
    embedding_model: payload.embedding_model || fallback.embeddingModel || 'models/gemini-embedding-001',
    embedding_status: payload.embedding_status || 'indexed',
    qdrant_point_id: String(point.id ?? ''),
  };
}

async function getPipelineJudgmentDetail({ judgmentUuid } = {}) {
  const normalizedUuid = String(judgmentUuid || '').trim();
  if (!normalizedUuid) {
    return null;
  }

  const startedAt = Date.now();
  logger.flow('Loading pipeline judgment detail', {
    judgmentUuid: normalizedUuid,
  });

  const judgment = await pipelineReportRepository.getPipelineJudgmentByUuid(normalizedUuid);
  if (!judgment) {
    const ikDocument = await getIkJudgmentDocument(normalizedUuid);
    if (!ikDocument) {
      logger.warn('Pipeline judgment not found', { judgmentUuid: normalizedUuid });
      return null;
    }

    const textPreview = String(ikDocument.text || '');
    const qdrantFilter = buildQdrantFilter({
      sourceType: 'ik_pipeline',
      canonicalId: ikDocument.tid,
    });

    const warnings = [];
    let qdrantPointCount = 0;
    try {
      qdrantPointCount = await countPoints({ filter: qdrantFilter });
    } catch (error) {
      warnings.push(createWarning('qdrant', error));
    }

    const upload = {
      documentId: ikDocument.tid,
      judgmentUuid: ikDocument.tid,
      canonicalId: ikDocument.tid,
      originalFilename: ikDocument.title || ikDocument.tid,
      sourceUrl: ikDocument.source_url,
      status: 'indexed',
      totalPages: 0,
      textPagesCount: 0,
      ocrPagesCount: 0,
      ocrBatchesCount: 0,
      mergedText: textPreview,
      metadata: {
        caseName: ikDocument.title || '',
        courtCode: ikDocument.docsource || '',
        judgmentDate: ikDocument.publishdate || null,
        year: ikDocument.year || null,
        primaryCitation: null,
        alternateCitations: (ikDocument.casesCited || [])
          .map((item) => item?.title)
          .filter(Boolean),
        sourceUrl: ikDocument.source_url,
      },
      pipelineMetrics: {},
      esDocId: ikDocument.tid,
      qdrantCollection: COLLECTION_NAME,
      lastProgressMessage: null,
      errorMessage: null,
      processingStartedAt: ikDocument.fetched_at || ikDocument.publishdate || null,
      processingCompletedAt: ikDocument.fetched_at || ikDocument.publishdate || null,
      createdAt: ikDocument.fetched_at || ikDocument.publishdate || null,
      updatedAt: ikDocument.fetched_at || ikDocument.publishdate || null,
    };

    logger.info('Pipeline judgment detail ready from ik_judgments', {
      judgmentUuid: normalizedUuid,
      elasticsearchPresent: true,
      textPreviewChars: textPreview.length,
      qdrantPointCount,
      warningCount: warnings.length,
      durationMs: Date.now() - startedAt,
    });

    return {
      upload,
      judgment: {
        judgment_uuid: ikDocument.tid,
        canonical_id: ikDocument.tid,
        case_name: ikDocument.title,
        court_code: ikDocument.docsource,
        judgment_date: ikDocument.publishdate,
        year: ikDocument.year,
        source_type: 'ik_pipeline',
        status: 'indexed',
        es_doc_id: ikDocument.tid,
        qdrant_collection: COLLECTION_NAME,
      },
      pages: [],
      chunks: [],
      aliases: [],
      textPreview,
      stores: {
        postgres: { status: 'degraded', count: 0 },
        elasticsearch: {
          status: 'healthy',
          present: true,
          docId: ikDocument.tid,
          index: IK_JUDGMENTS_INDEX,
        },
        qdrant: {
          status: warnings.some((warning) => warning.store === 'qdrant') ? 'degraded' : 'healthy',
          count: qdrantPointCount,
          collection: COLLECTION_NAME,
        },
      },
      warnings,
      sourceType: 'ik_pipeline',
    };
  }

  const sourceType = judgment.source_type || pipelineReportRepository.DEFAULT_SOURCE_TYPE;

  const [pgChunks, aliases] = await Promise.all([
    pipelineReportRepository.getChunksByJudgmentUuid(normalizedUuid),
    pipelineReportRepository.getAliasesByJudgmentUuid(normalizedUuid),
  ]);

  const warnings = [];
  let elasticsearchDocument = null;
  let qdrantPoints = [];
  let qdrantPointCount = 0;

  const esDocId = judgment.es_doc_id || judgment.canonical_id || null;
  if (esDocId) {
    try {
      elasticsearchDocument = await getJudgmentDocument(esDocId);
    } catch (error) {
      warnings.push(createWarning('elasticsearch', error));
      elasticsearchDocument = null;
    }
  }

  const qdrantFilter = buildQdrantFilter({
    sourceType,
    canonicalId: judgment.canonical_id || null,
  });

  try {
    qdrantPoints = await fetchAllPointsByFilter({
      filter: qdrantFilter,
      withPayload: true,
      withVector: false,
    });
    qdrantPointCount = qdrantPoints.length;
  } catch (error) {
    warnings.push(createWarning('qdrant', error));
    qdrantPoints = [];

    try {
      qdrantPointCount = await countPoints({ filter: qdrantFilter });
    } catch (countError) {
      qdrantPointCount = 0;
    }
  }

  let chunks = pgChunks;
  if (!chunks.length && qdrantPoints.length) {
    chunks = qdrantPoints
      .map((point) => qdrantPointToChunkRow(point, { judgmentUuid: normalizedUuid }))
      .sort((left, right) => (left.chunk_index || 0) - (right.chunk_index || 0));
  }

  const textPreview = String(elasticsearchDocument?.full_text || '');

  const canonicalId = judgment.canonical_id || null;
  const qdrantCollection = judgment.qdrant_collection || COLLECTION_NAME;

  const upload = {
    documentId: judgment.judgment_uuid,
    judgmentUuid: judgment.judgment_uuid,
    canonicalId,
    originalFilename: judgment.case_name || canonicalId || judgment.judgment_uuid,
    sourceUrl: judgment.citation_data?.source_url || null,
    status: judgment.status || 'uploaded',
    totalPages: 0,
    textPagesCount: 0,
    ocrPagesCount: 0,
    ocrBatchesCount: 0,
    mergedText: textPreview,
    metadata: {
      caseName: judgment.case_name || '',
      courtCode: judgment.court_code || '',
      judgmentDate: judgment.judgment_date || null,
      year: judgment.year || null,
      primaryCitation: judgment.citation_data?.primary_citation || null,
      alternateCitations: judgment.citation_data?.alternate_citations || [],
      sourceUrl: judgment.citation_data?.source_url || null,
    },
    pipelineMetrics: {},
    esDocId: judgment.es_doc_id || null,
    qdrantCollection,
    lastProgressMessage: null,
    errorMessage: null,
    processingStartedAt: judgment.created_at || null,
    processingCompletedAt: judgment.updated_at || null,
    createdAt: judgment.created_at || null,
    updatedAt: judgment.updated_at || null,
  };

  const detail = {
    upload,
    judgment,
    pages: [],
    chunks,
    aliases,
    textPreview,
    stores: {
      postgres: { status: 'healthy', count: 1 },
      elasticsearch: {
        status: elasticsearchDocument ? 'healthy' : 'degraded',
        present: Boolean(elasticsearchDocument),
        docId: esDocId,
      },
      qdrant: {
        status: 'healthy',
        count: qdrantPointCount,
        collection: qdrantCollection,
      },
    },
    warnings,
    sourceType,
  };

  logger.info('Pipeline judgment detail ready', {
    judgmentUuid: normalizedUuid,
    sourceType,
    chunks: chunks.length,
    aliases: aliases.length,
    elasticsearchPresent: Boolean(elasticsearchDocument),
    textPreviewChars: textPreview.length,
    qdrantPointCount,
    warningCount: warnings.length,
    durationMs: Date.now() - startedAt,
  });

  return detail;
}

async function getPipelineJudgmentVectors({ judgmentUuid, pointIds = [] } = {}) {
  const normalizedUuid = String(judgmentUuid || '').trim();
  if (!normalizedUuid) {
    return null;
  }

  const requestedPointIds = Array.from(
    new Set(
      pointIds
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );

  if (!requestedPointIds.length) {
    return { collection: COLLECTION_NAME, vectors: [] };
  }

  const judgment = await pipelineReportRepository.getPipelineJudgmentByUuid(normalizedUuid);
  if (!judgment) {
    return null;
  }

  const pgChunks = await pipelineReportRepository.getChunksByJudgmentUuid(normalizedUuid);
  const chunkByPointId = new Map(
    pgChunks
      .filter((chunk) => chunk.qdrant_point_id)
      .map((chunk) => [String(chunk.qdrant_point_id), chunk])
  );

  if (!chunkByPointId.size) {
    const qdrantFilter = buildQdrantFilter({
      sourceType: judgment.source_type || pipelineReportRepository.DEFAULT_SOURCE_TYPE,
      canonicalId: judgment.canonical_id || null,
    });

    try {
      const points = await fetchAllPointsByFilter({
        filter: qdrantFilter,
        withPayload: true,
        withVector: false,
      });

      points
        .map((point) => qdrantPointToChunkRow(point, { judgmentUuid: normalizedUuid }))
        .forEach((chunk) => {
          if (chunk.qdrant_point_id) {
            chunkByPointId.set(String(chunk.qdrant_point_id), chunk);
          }
        });
    } catch (error) {
      logger.warn('Unable to load Qdrant chunks for vector preview fallback', {
        judgmentUuid: normalizedUuid,
        reason: error.message,
      });
    }
  }

  const allowedPointIds = requestedPointIds.filter((pointId) => chunkByPointId.has(pointId));
  if (!allowedPointIds.length) {
    return {
      collection: judgment.qdrant_collection || COLLECTION_NAME,
      vectors: [],
    };
  }

  const qdrantPoints = await fetchPointsByIds(allowedPointIds);
  const vectors = allowedPointIds
    .map((pointId) => {
      const chunk = chunkByPointId.get(pointId);
      const qPoint = qdrantPoints.find((p) => String(p.id) === String(pointId));
      if (!qPoint) return null;

      const vector = Array.isArray(qPoint.vector)
        ? qPoint.vector
        : Array.isArray(qPoint.vector?.default)
          ? qPoint.vector.default
          : [];

      return {
        pointId,
        chunkId: chunk.chunk_id,
        chunkIndex: chunk.chunk_index,
        vector,
        dimension: vector.length,
        embeddingStatus: chunk.embedding_status,
        embeddingModel: chunk.embedding_model,
      };
    })
    .filter(Boolean);

  return {
    collection: judgment.qdrant_collection || COLLECTION_NAME,
    vectors,
  };
}

module.exports = {
  getPipelineReportSummary,
  listPipelineJudgments,
  getPipelineJudgmentDetail,
  getPipelineJudgmentVectors,
};
