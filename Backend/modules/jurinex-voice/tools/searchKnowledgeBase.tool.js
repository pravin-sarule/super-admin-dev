/**
 * search_knowledge_base tool — runs an embedding-based cosine search
 * over the agent's KB chunks (kb_chunks via pgvector). Returns the top
 * snippets so the agent can answer accurately without us having to dump
 * the entire document into the system prompt.
 *
 * Mirrors the architecture documented in the Jurinex_call_agent
 * project: confident only when top score >= KB_MIN_SCORE; otherwise
 * the model should hand off to a human / take a callback.
 */

const kbSearch = require('../kb/kbSearch.service');

const KB_MIN_SCORE = Number(process.env.JURINEX_VOICE_KB_MIN_SCORE || 0.55);
const KB_DEFAULT_K = Number(process.env.JURINEX_VOICE_KB_SEARCH_K || 5);

const trimSnippet = (text, max = 800) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
};

const run = async (args = {}, context = {}) => {
  const query = String(args.query || '').trim();
  const k = Math.max(1, Math.min(10, Number(args.k) || KB_DEFAULT_K));

  if (!query) {
    return {
      status: 'invalid_arguments',
      confident: false,
      detail:
        'query is required. Pull a short phrase from what the caller just asked and call again.',
      instruction_to_agent:
        'You called search_knowledge_base without a query. Ask the caller what they need, then call again with their question as the query.',
    };
  }

  console.log('[VOICE_TOOL][search_knowledge_base] query', {
    sessionId: context.sessionId,
    agentId: context.agentId,
    query: query.slice(0, 120),
    k,
  });

  let response;
  try {
    response = await kbSearch.search({
      query,
      k,
      agent_id: context.agentId || null,
      source: 'voice_agent_live',
    });
  } catch (err) {
    console.error('[VOICE_TOOL][search_knowledge_base] failed', {
      sessionId: context.sessionId,
      error: err.message,
    });
    return {
      status: 'search_error',
      confident: false,
      detail: `Knowledge base lookup failed: ${err.message}.`,
      instruction_to_agent:
        'The KB lookup failed. Apologize, say you are having trouble looking that up right now, and offer to take a callback.',
    };
  }

  const results = (response.results || []).map((r) => ({
    score: Number(r.score) || 0,
    document: r.document_title || 'Untitled',
    section: Array.isArray(r.heading_path) && r.heading_path.length
      ? r.heading_path.join(' > ')
      : null,
    snippet: trimSnippet(r.text),
  }));

  const topScore = results.length ? Math.max(...results.map((r) => r.score)) : 0;
  const confident = topScore >= KB_MIN_SCORE;

  console.log('[VOICE_TOOL][search_knowledge_base] result', {
    sessionId: context.sessionId,
    resultCount: results.length,
    topScore: Number(topScore.toFixed(3)),
    confident,
    latencyMs: response.latency_ms,
  });

  return {
    status: confident ? 'ok' : 'low_confidence',
    confident,
    top_score: Number(topScore.toFixed(3)),
    min_score: KB_MIN_SCORE,
    result_count: results.length,
    results,
    detail: confident
      ? 'Use these snippets verbatim as your source of truth. Quote facts directly from them; do not invent numbers, names, or features.'
      : `No snippet scored above the ${KB_MIN_SCORE} confidence floor. Tell the caller you do not have that information in your records and offer to transfer or take a callback.`,
    instruction_to_agent: confident
      ? 'Speak the answer in the caller language using ONLY the snippets above. Do not read raw markdown or scores.'
      : 'Do NOT make up an answer. Apologize that you do not have that detail in records, then offer to transfer or take a callback.',
  };
};

module.exports = { name: 'search_knowledge_base', run };
