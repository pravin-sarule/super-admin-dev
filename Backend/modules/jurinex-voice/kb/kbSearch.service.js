/**
 * Knowledge-base similarity search.
 */
const crypto = require('crypto');
const { embedQuery, toVectorLiteral } = require('./embeddings');
const repo = require('./kb.repository');
const dataflow = require('../observability/dataflowLogger');

const search = async ({
  query,
  k = 5,
  agent_id = null,
  call_id = null,
  source = 'admin_test',
}) => {
  if (!query || !String(query).trim()) {
    const err = new Error('`query` is required');
    err.statusCode = 400;
    throw err;
  }

  const trace_id = crypto.randomUUID();
  await dataflow.logSearchStarted({ trace_id, agent_id, query, k, source });

  const t0 = Date.now();

  const queryVec = await embedQuery(query);
  const literal = toVectorLiteral(queryVec);

  const rows = await repo.search({
    embeddingLiteral: literal,
    agent_id,
    k,
  });

  const latency_ms = Date.now() - t0;

  await repo.insertSearchLog({
    call_id,
    agent_id,
    query,
    top_chunk_ids: rows.map((r) => r.id),
    top_scores: rows.map((r) => Number(r.score) || 0),
    latency_ms,
    source,
  });

  await dataflow.logSearchCompleted({
    trace_id,
    agent_id,
    query,
    result_count: rows.length,
    latency_ms,
    source,
  });

  return {
    trace_id,
    latency_ms,
    results: rows.map((r) => ({
      chunk_id: r.id,
      document_id: r.document_id,
      document_title: r.document_title,
      heading_path: r.heading_path,
      text: r.text,
      score: Number(r.score) || 0,
      source_type: r.source_type,
      gcs_uri: r.gcs_uri,
      agent_id: r.agent_id,
    })),
  };
};

module.exports = { search };
