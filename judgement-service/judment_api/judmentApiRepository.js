const pool = require('../config/db');

async function insertAnalyticsRecord(payload = {}) {
  await pool.query(
    `
      INSERT INTO judgment_api_analytics (
        request_id,
        endpoint,
        search_mode,
        query_text,
        filters,
        semantic_limit,
        text_limit,
        score_threshold,
        phrase_match,
        api_key_fingerprint,
        status_code,
        success,
        result_count,
        embedding_duration_ms,
        qdrant_duration_ms,
        elastic_duration_ms,
        db_duration_ms,
        signed_url_duration_ms,
        total_duration_ms,
        error_message,
        response_summary
      )
      VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21::jsonb
      )
    `,
    [
      payload.requestId,
      payload.endpoint,
      payload.searchMode,
      payload.queryText || null,
      JSON.stringify(payload.filters || {}),
      payload.semanticLimit || null,
      payload.textLimit || null,
      payload.scoreThreshold != null ? Number(payload.scoreThreshold) : null,
      Boolean(payload.phraseMatch),
      payload.apiKeyFingerprint || null,
      payload.statusCode || null,
      Boolean(payload.success),
      Number(payload.resultCount || 0),
      payload.embeddingDurationMs != null ? Number(payload.embeddingDurationMs) : null,
      payload.qdrantDurationMs != null ? Number(payload.qdrantDurationMs) : null,
      payload.elasticDurationMs != null ? Number(payload.elasticDurationMs) : null,
      payload.dbDurationMs != null ? Number(payload.dbDurationMs) : null,
      payload.signedUrlDurationMs != null ? Number(payload.signedUrlDurationMs) : null,
      payload.totalDurationMs != null ? Number(payload.totalDurationMs) : null,
      payload.errorMessage || null,
      JSON.stringify(payload.responseSummary || {}),
    ]
  );
}

async function listAnalytics({ limit = 50, endpoint = null, success = null } = {}) {
  const conditions = [];
  const values = [];

  if (endpoint) {
    values.push(String(endpoint).trim());
    conditions.push(`endpoint = $${values.length}`);
  }

  if (success != null) {
    values.push(Boolean(success));
    conditions.push(`success = $${values.length}`);
  }

  values.push(Math.max(1, Math.min(Number(limit || 50), 200)));
  const limitPlaceholder = `$${values.length}`;
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT *
      FROM judgment_api_analytics
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitPlaceholder}
    `,
    values
  );

  return result.rows;
}

async function getChunkMetadataByPointIds(pointIds = []) {
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

  const result = await pool.query(
    `
      SELECT
        jc.chunk_id,
        jc.document_id,
        jc.judgment_uuid,
        jc.chunk_index,
        jc.char_start,
        jc.char_end,
        jc.chunk_text,
        jc.embedding_model,
        jc.embedding_status,
        jc.qdrant_point_id,
        ju.original_filename,
        ju.source_url,
        ju.storage_bucket,
        ju.storage_path,
        ju.storage_uri,
        ju.status AS upload_status,
        ju.metadata AS upload_metadata,
        ju.pipeline_metrics,
        ju.created_at AS upload_created_at,
        ju.updated_at AS upload_updated_at,
        j.canonical_id,
        j.case_name,
        j.court_code,
        j.year,
        j.judgment_date,
        j.source_type,
        j.verification_status,
        j.confidence_score,
        j.citation_data,
        j.ocr_info
      FROM judgment_chunks jc
      LEFT JOIN judgment_uploads ju ON ju.document_id = jc.document_id
      LEFT JOIN judgments j ON j.judgment_uuid = jc.judgment_uuid
      WHERE jc.chunk_id::text = ANY($1::text[])
         OR COALESCE(jc.qdrant_point_id, '') = ANY($1::text[])
    `,
    [ids]
  );

  return result.rows;
}

async function getJudgmentMetadataByJudgmentUuids(judgmentUuids = []) {
  const ids = Array.from(
    new Set(
      judgmentUuids
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );

  if (!ids.length) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        j.judgment_uuid,
        j.canonical_id,
        j.case_name,
        j.court_code,
        j.year,
        j.judgment_date,
        j.source_type,
        j.verification_status,
        j.confidence_score,
        j.citation_data,
        j.ocr_info,
        j.status AS judgment_status,
        ju.document_id,
        ju.original_filename,
        ju.source_url,
        ju.storage_bucket,
        ju.storage_path,
        ju.storage_uri,
        ju.status AS upload_status,
        ju.metadata AS upload_metadata,
        ju.pipeline_metrics,
        ju.created_at AS upload_created_at,
        ju.updated_at AS upload_updated_at
      FROM judgments j
      LEFT JOIN judgment_uploads ju ON ju.judgment_uuid = j.judgment_uuid
      WHERE j.judgment_uuid = ANY($1::uuid[])
      ORDER BY ju.updated_at DESC NULLS LAST, ju.created_at DESC NULLS LAST
    `,
    [ids]
  );

  return result.rows;
}

module.exports = {
  insertAnalyticsRecord,
  listAnalytics,
  getChunkMetadataByPointIds,
  getJudgmentMetadataByJudgmentUuids,
};
