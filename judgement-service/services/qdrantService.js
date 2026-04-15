const axios = require('axios');
const { EMBEDDING_DIMENSION } = require('./embeddingService');
const { createLogger } = require('../utils/logger');

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY =
  process.env.QDRANT_API_KEY ||
  process.env.Qdrant_API_KEY;
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'legal_embeddings_v2';
const QDRANT_TIMEOUT_MS = Number(process.env.QDRANT_TIMEOUT_MS || 120000);
const PAYLOAD_INDEX_FIELDS = [
  { fieldName: 'judgment_uuid', fieldSchema: 'keyword' },
  { fieldName: 'canonical_id', fieldSchema: 'keyword' },
  { fieldName: 'case_name', fieldSchema: 'keyword' },
];
const logger = createLogger('Qdrant');

function client() {
  return axios.create({
    baseURL: QDRANT_URL,
    timeout: QDRANT_TIMEOUT_MS,
    headers: QDRANT_API_KEY ? {
      'api-key': QDRANT_API_KEY,
      'Content-Type': 'application/json',
    } : {
      'Content-Type': 'application/json',
    },
  });
}

function extractCollectionVectorSize(collectionResponse = {}) {
  return Number(
    collectionResponse?.config?.params?.vectors?.size ||
    collectionResponse?.config?.params?.vectors?.default?.size ||
    0
  );
}

function isSafeVerificationPoint(point = {}) {
  const verificationTag = point?.payload?.verification_tag;
  const canonicalId = point?.payload?.canonical_id;
  const caseName = point?.payload?.case_name;

  return (
    (typeof verificationTag === 'string' && verificationTag.startsWith('codex_qdrant_')) ||
    canonicalId === 'manual-pipeline-like-check' ||
    caseName === 'Manual pipeline-like check'
  );
}

async function recreateCollection(api) {
  logger.step('Creating Qdrant collection', {
    collection: COLLECTION_NAME,
    vectorSize: EMBEDDING_DIMENSION,
    timeoutMs: QDRANT_TIMEOUT_MS,
  });
  await api.put(`/collections/${COLLECTION_NAME}`, {
    vectors: {
      size: EMBEDDING_DIMENSION,
      distance: 'Cosine',
    },
  });
}

async function ensurePayloadIndexes(api) {
  for (const indexConfig of PAYLOAD_INDEX_FIELDS) {
    logger.flow('Ensuring Qdrant payload index', {
      collection: COLLECTION_NAME,
      fieldName: indexConfig.fieldName,
      fieldSchema: indexConfig.fieldSchema,
      timeoutMs: QDRANT_TIMEOUT_MS,
    });

    await api.put(`/collections/${COLLECTION_NAME}/index?wait=true`, {
      field_name: indexConfig.fieldName,
      field_schema: indexConfig.fieldSchema,
    });
  }
}

async function checkQdrantHealth() {
  if (!QDRANT_URL) {
    throw new Error('Qdrant URL is not configured');
  }

  const api = client();

  logger.flow('Checking Qdrant health', {
    endpoint: QDRANT_URL,
    collection: COLLECTION_NAME,
    timeoutMs: QDRANT_TIMEOUT_MS,
  });

  await api.get('/collections');
  const collectionResponse = await api.get(`/collections/${COLLECTION_NAME}`);
  const collection = collectionResponse.data?.result || {};
  const configuredVectorSize = extractCollectionVectorSize(collection);

  if (configuredVectorSize && configuredVectorSize !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Qdrant collection ${COLLECTION_NAME} has vector size ${configuredVectorSize}, expected ${EMBEDDING_DIMENSION}`
    );
  }

  logger.info('Qdrant health check passed', {
    endpoint: QDRANT_URL,
    collection: COLLECTION_NAME,
    vectorSize: configuredVectorSize || null,
    payloadIndexes: Object.keys(collection.payload_schema || {}),
  });

  return {
    message: `Qdrant is reachable and collection target is ${COLLECTION_NAME}`,
  };
}

async function ensureCollection() {
  if (!QDRANT_URL) return;

  const api = client();

  try {
    logger.flow('Checking Qdrant collection', {
      collection: COLLECTION_NAME,
      endpoint: QDRANT_URL,
      timeoutMs: QDRANT_TIMEOUT_MS,
    });
    const response = await api.get(`/collections/${COLLECTION_NAME}`);
    const configuredVectorSize = extractCollectionVectorSize(response?.data?.result || {});
    const pointCount = Number(response?.data?.result?.points_count || 0);

    if (configuredVectorSize && configuredVectorSize !== EMBEDDING_DIMENSION) {
      const mismatchContext = {
        collection: COLLECTION_NAME,
        configuredVectorSize,
        expectedVectorSize: EMBEDDING_DIMENSION,
        pointCount,
      };

      if (pointCount === 0) {
        logger.warn('Qdrant collection dimension mismatch detected on empty collection, recreating', mismatchContext);
        await api.delete(`/collections/${COLLECTION_NAME}`);
        await recreateCollection(api);
        await ensurePayloadIndexes(api);
        return;
      }

      if (pointCount <= 10) {
        const verificationScan = await api.post(`/collections/${COLLECTION_NAME}/points/scroll`, {
          limit: 10,
          with_payload: true,
          with_vector: false,
        });
        const scannedPoints = verificationScan.data?.result?.points || [];
        const onlyVerificationPoints =
          scannedPoints.length === pointCount &&
          scannedPoints.every((point) => isSafeVerificationPoint(point));

        if (onlyVerificationPoints) {
          logger.warn('Qdrant collection dimension mismatch detected on verification-only collection, recreating', {
            ...mismatchContext,
            verificationPoints: scannedPoints.map((point) => point.id),
          });
          await api.delete(`/collections/${COLLECTION_NAME}`);
          await recreateCollection(api);
          await ensurePayloadIndexes(api);
          return;
        }
      }

      throw new Error(
        `Qdrant collection ${COLLECTION_NAME} has vector size ${configuredVectorSize}, expected ${EMBEDDING_DIMENSION}. Recreate the collection or change GEMINI_EMBEDDING_DIMENSION.`
      );
    }
  } catch (error) {
    if (error.response?.status !== 404) {
      throw error;
    }

    logger.step('Creating Qdrant collection', {
      collection: COLLECTION_NAME,
      vectorSize: EMBEDDING_DIMENSION,
      timeoutMs: QDRANT_TIMEOUT_MS,
    });
    await recreateCollection(api);
    await ensurePayloadIndexes(api);
    return;
  }

  await ensurePayloadIndexes(api);
}

async function upsertChunks(points) {
  if (!QDRANT_URL || !points.length) return null;

  const invalidPoint = points.find(
    (point) => !Array.isArray(point.vector) ||
      point.vector.length !== EMBEDDING_DIMENSION ||
      !point.vector.every((value) => Number.isFinite(value))
  );

  if (invalidPoint) {
    throw new Error(
      `Invalid Qdrant vector for point ${invalidPoint.id}: expected ${EMBEDDING_DIMENSION} finite values`
    );
  }

  await ensureCollection();

  const api = client();
  logger.step('Upserting chunk vectors to Qdrant', {
    collection: COLLECTION_NAME,
    points: points.length,
    timeoutMs: QDRANT_TIMEOUT_MS,
  });
  const upsertResponse = await api.put(`/collections/${COLLECTION_NAME}/points?wait=true`, {
    points,
  });

  const verifyIds = points.slice(0, Math.min(points.length, 3)).map((point) => point.id);
  const verificationResponse = await api.post(`/collections/${COLLECTION_NAME}/points`, {
    ids: verifyIds,
    with_payload: true,
    with_vector: false,
  });
  const retrievedIds = new Set(
    (verificationResponse.data?.result || []).map((point) => String(point.id))
  );
  const missingIds = verifyIds.filter((id) => !retrievedIds.has(String(id)));

  if (missingIds.length) {
    throw new Error(
      `Qdrant upsert verification failed for collection ${COLLECTION_NAME}; missing point ids: ${missingIds.join(', ')}`
    );
  }

  logger.info('Qdrant upsert completed', {
    collection: COLLECTION_NAME,
    points: points.length,
    operationResult: upsertResponse.data?.result || null,
    verifiedPointIds: verifyIds,
  });

  return COLLECTION_NAME;
}

async function fetchPointsByIds(pointIds = []) {
  if (!QDRANT_URL) {
    throw new Error('Qdrant URL is not configured');
  }

  const ids = Array.from(
    new Set(
      pointIds
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );

  if (!ids.length) {
    return [];
  }

  await ensureCollection();

  const api = client();
  logger.flow('Fetching Qdrant vectors by point ids', {
    collection: COLLECTION_NAME,
    requestedPoints: ids.length,
    timeoutMs: QDRANT_TIMEOUT_MS,
  });

  const response = await api.post(`/collections/${COLLECTION_NAME}/points`, {
    ids,
    with_payload: true,
    with_vector: true,
  });

  const points = response.data?.result || [];

  logger.info('Fetched Qdrant vectors by point ids', {
    collection: COLLECTION_NAME,
    requestedPoints: ids.length,
    returnedPoints: points.length,
  });

  return points;
}

async function deletePointsByJudgmentUuid(collectionName, judgmentUuid) {
  if (!QDRANT_URL || !judgmentUuid) return;

  const collection = collectionName || COLLECTION_NAME;
  const api = client();

  logger.step('Deleting Qdrant vectors for judgment', {
    collection,
    judgmentUuid,
    timeoutMs: QDRANT_TIMEOUT_MS,
  });

  try {
    const response = await api.post(`/collections/${collection}/points/delete?wait=true`, {
      filter: {
        must: [
          {
            key: 'judgment_uuid',
            match: { value: judgmentUuid },
          },
        ],
      },
    });

    logger.info('Qdrant vectors deleted', {
      collection,
      judgmentUuid,
      status: response.data?.status || 'unknown',
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return; // Collection not found
    }
    logger.error('Failed to delete Qdrant vectors', error, {
      collection,
      judgmentUuid,
      upstreamStatus: error.response?.status || null,
    });
    throw error;
  }
}

module.exports = {
  checkQdrantHealth,
  fetchPointsByIds,
  upsertChunks,
  deletePointsByJudgmentUuid,
  COLLECTION_NAME,
};
