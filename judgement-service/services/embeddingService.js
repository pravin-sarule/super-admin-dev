const axios = require('axios');
const crypto = require('crypto');
const { createLogger } = require('../utils/logger');

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-001';
const EMBEDDING_DIMENSION = Number(process.env.GEMINI_EMBEDDING_DIMENSION || 768);
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const BATCH_SIZE = Number(process.env.GEMINI_EMBEDDING_BATCH_SIZE || 25);
const logger = createLogger('Embeddings');

function normalizeVector(values) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + (value * value), 0)) || 1;
  return values.map((value) => value / magnitude);
}

function hashEmbedding(text, dims = EMBEDDING_DIMENSION) {
  const digest = crypto.createHash('sha256').update(String(text || ''), 'utf8').digest();
  const vector = Array.from({ length: dims }, (_, index) => {
    const byte = digest[index % digest.length];
    return (byte / 127.5) - 1;
  });
  return normalizeVector(vector);
}

function projectVector(values, targetDims = EMBEDDING_DIMENSION) {
  if (!Array.isArray(values) || !values.length || !values.every((value) => Number.isFinite(value))) {
    return null;
  }

  if (values.length === targetDims) {
    return normalizeVector(values);
  }

  if (values.length < targetDims) {
    return null;
  }

  const projected = Array.from({ length: targetDims }, (_, index) => {
    const start = Math.floor((index * values.length) / targetDims);
    const end = Math.floor(((index + 1) * values.length) / targetDims);
    const slice = values.slice(start, Math.max(end, start + 1));
    const sum = slice.reduce((total, value) => total + value, 0);
    return sum / slice.length;
  });

  return normalizeVector(projected);
}

async function embedBatchViaGemini(texts) {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:batchEmbedContents`,
    {
      requests: texts.map((text) => ({
        model: EMBEDDING_MODEL,
        content: {
          parts: [{ text }],
        },
        taskType: 'RETRIEVAL_DOCUMENT',
      })),
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_API_KEY,
      },
      timeout: 60000,
    }
  );

  return (response.data?.embeddings || []).map((entry) => normalizeVector(entry.values || []));
}

function coerceBatchVectors(texts, embeddedVectors, batchNumber) {
  return texts.map((text, index) => {
    const vector = projectVector(embeddedVectors[index]);

    if (
      Array.isArray(vector) &&
      vector.length === EMBEDDING_DIMENSION &&
      vector.every((value) => Number.isFinite(value))
    ) {
      return vector;
    }

    logger.warn('Embedding vector shape mismatch, using deterministic fallback for text', {
      batchNumber,
      textIndex: index,
      expectedDimension: EMBEDDING_DIMENSION,
      actualDimension: Array.isArray(embeddedVectors[index]) ? embeddedVectors[index].length : null,
    });

    return hashEmbedding(text);
  });
}

async function generateEmbeddings(texts) {
  const safeTexts = texts.map((text) => String(text || '').slice(0, 10000));
  const vectors = [];

  logger.step('Generating embeddings for chunks', {
    texts: safeTexts.length,
    batchSize: BATCH_SIZE,
    model: EMBEDDING_MODEL,
  });

  for (let index = 0; index < safeTexts.length; index += BATCH_SIZE) {
    const batch = safeTexts.slice(index, index + BATCH_SIZE);
    const batchNumber = Math.floor(index / BATCH_SIZE) + 1;

    try {
      if (!GOOGLE_API_KEY) {
        throw new Error('GOOGLE_API_KEY is not configured');
      }

      const embedded = await embedBatchViaGemini(batch);
      if (embedded.length !== batch.length) {
        throw new Error(`Embedding count mismatch: expected ${batch.length}, got ${embedded.length}`);
      }
      vectors.push(...coerceBatchVectors(batch, embedded, batchNumber));
      logger.info('Embedding batch complete', {
        batchNumber,
        batchSize: batch.length,
      });
    } catch (error) {
      logger.warn('Gemini embedding failed, using deterministic fallback', {
        batchNumber,
        batchSize: batch.length,
        reason: error.message,
      });
      vectors.push(...batch.map((text) => hashEmbedding(text)));
    }
  }

  logger.info('Embedding generation complete', {
    vectors: vectors.length,
    model: EMBEDDING_MODEL,
  });

  return {
    model: EMBEDDING_MODEL,
    vectors,
  };
}

module.exports = {
  generateEmbeddings,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
};
