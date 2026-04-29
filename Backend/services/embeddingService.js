const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

// ── SDK client (singleton) ────────────────────────────────────────────────────
let _client = null;
const getClient = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  if (!_client) _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
};

// ── Single embedding (fallback / direct use) ──────────────────────────────────
const getEmbedding = async (text) => {
  const result = await getClient().models.embedContent({
    model:    'gemini-embedding-2',
    contents: text,
    config:   { outputDimensionality: 768 },
  });
  return result.embeddings[0].values;
};

// ── Batch embed via REST API — up to 100 texts per single API call ─────────────
// This is the key speedup: 100 texts → 1 API call instead of 100 individual calls.
const batchEmbedREST = async (texts) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key=${apiKey}`;

  const { data } = await axios.post(
    url,
    {
      requests: texts.map((text) => ({
        model:              'models/gemini-embedding-2',
        content:            { parts: [{ text: String(text).slice(0, 8192) }] },
        taskType:           'RETRIEVAL_DOCUMENT',
        outputDimensionality: 768,
      })),
    },
    { timeout: 120_000 }
  );

  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new Error(
      `batchEmbedContents returned ${data.embeddings?.length ?? 0} embeddings for ${texts.length} texts`
    );
  }

  return data.embeddings.map((e) => e.values);
};

// ── Fallback: sliding-window individual embeddings ────────────────────────────
// Used if batchEmbedREST fails or as a standalone option.
const slidingWindowEmbeddings = async (texts, concurrency = 20) => {
  const results = new Array(texts.length);
  let next = 0;

  const worker = async () => {
    while (true) {
      const idx = next++;
      if (idx >= texts.length) break;
      results[idx] = await getEmbedding(texts[idx]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, texts.length) }, () => worker())
  );
  return results;
};

/**
 * Embed many texts as fast as possible.
 *
 * Strategy:
 *   1. Split texts into batches of `batchSize` (default 100 — Gemini REST limit).
 *   2. Run up to `concurrency` batch calls in parallel (default 5).
 *   3. Each batch call sends all its texts in ONE API request (batchEmbedContents).
 *   4. On failure of the REST batch, falls back to sliding-window individual calls.
 *
 * Example: 200 chunks → 2 batch calls of 100 (run in parallel) → done.
 * Previously: 200 chunks → 20 sequential rounds of 10 individual calls.
 */
const getBatchEmbeddings = async (texts, batchSize = 100, concurrency = 5) => {
  if (!texts.length) return [];

  // ── Build batch descriptors ──────────────────────────────────────────────
  const batches = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push({ texts: texts.slice(i, i + batchSize), startIdx: i });
  }

  const results = new Array(texts.length);

  // ── Sliding window over batches ──────────────────────────────────────────
  let nextBatch = 0;

  const worker = async () => {
    while (true) {
      const bi = nextBatch++;
      if (bi >= batches.length) break;

      const { texts: batchTexts, startIdx } = batches[bi];

      let embeddings;
      try {
        embeddings = await batchEmbedREST(batchTexts);
      } catch (restErr) {
        // REST batch failed — fall back to individual calls for this batch
        console.warn(
          `⚠️  batchEmbedREST failed for batch[${bi}] (${batchTexts.length} texts): ${restErr.message}. Falling back.`
        );
        embeddings = await slidingWindowEmbeddings(batchTexts, 10);
      }

      embeddings.forEach((emb, i) => {
        results[startIdx + i] = emb;
      });
    }
  };

  const workerCount = Math.min(concurrency, batches.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
};

module.exports = { getEmbedding, getBatchEmbeddings };
