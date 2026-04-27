const { GoogleGenAI } = require('@google/genai');

// Singleton client — avoid creating a new instance on every call
let _client = null;
const getClient = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  if (!_client) _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
};

const getEmbedding = async (text) => {
  const result = await getClient().models.embedContent({
    model: 'gemini-embedding-2',
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return result.embeddings[0].values;
};

/**
 * Embed many texts in parallel with a concurrency cap.
 * Processes `concurrency` texts simultaneously, then the next batch, etc.
 * E.g. 50 chunks with concurrency=10 → 5 parallel batches instead of 50 serial calls.
 */
const getBatchEmbeddings = async (texts, concurrency = 10) => {
  const results = [];
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((t) => getEmbedding(t)));
    results.push(...batchResults);
  }
  return results;
};

module.exports = { getEmbedding, getBatchEmbeddings };
