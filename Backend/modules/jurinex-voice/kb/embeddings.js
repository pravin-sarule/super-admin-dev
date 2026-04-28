/**
 * Google text-embedding-004 wrapper for the Jurinex Voice KB.
 *
 * Uses the @google/genai Node SDK. Supports both task types:
 *   - RETRIEVAL_DOCUMENT (for indexing)
 *   - RETRIEVAL_QUERY    (for search)
 *
 * Falls back to GEMINI_API_KEY when GOOGLE_API_KEY is unset so we don't
 * duplicate secrets across the codebase.
 */

const { GoogleGenAI } = require('@google/genai');
const voiceLogger = require('../observability/voiceLogger');

// Default to the GA `gemini-embedding-001` (replaces text-embedding-004).
// Override with EMBEDDING_MODEL if your API key has access to a different one.
const DEFAULT_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
const DEFAULT_DIM = Number(process.env.EMBEDDING_DIM || 768);

let _client = null;
const getClient = () => {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Set GOOGLE_API_KEY (or GEMINI_API_KEY) for Jurinex Voice embeddings.'
    );
  }
  if (!_client) _client = new GoogleGenAI({ apiKey });
  return _client;
};

const callEmbed = async (texts, taskType) => {
  const client = getClient();
  const model = DEFAULT_MODEL;

  // The @google/genai SDK accepts an array of strings via `contents` and
  // returns one embedding per item.
  const result = await client.models.embedContent({
    model,
    contents: texts,
    config: { taskType, outputDimensionality: DEFAULT_DIM },
  });

  const arr = (result.embeddings || []).map((e) => e.values || []);
  if (arr.length !== texts.length) {
    voiceLogger.warn('embedding count mismatch', {
      summary: { requested: texts.length, returned: arr.length },
    });
  }
  return arr;
};

const embedDocuments = async (texts) => {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const BATCH = 100;
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const vectors = await callEmbed(slice, 'RETRIEVAL_DOCUMENT');
    out.push(...vectors);
  }
  return out;
};

const embedQuery = async (query) => {
  if (!query) throw new Error('embedQuery: query is required');
  const [vec] = await callEmbed([String(query)], 'RETRIEVAL_QUERY');
  return vec;
};

/** Format a JS number[] as a pgvector literal `[0.1,0.2,...]`. */
const toVectorLiteral = (vec) =>
  `[${(vec || []).map((v) => Number(v).toFixed(6)).join(',')}]`;

module.exports = {
  embedDocuments,
  embedQuery,
  toVectorLiteral,
  EMBEDDING_MODEL: DEFAULT_MODEL,
  EMBEDDING_DIM: DEFAULT_DIM,
};
