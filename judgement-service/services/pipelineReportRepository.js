const pool = require('../config/db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PipelineReportRepo');
const DEFAULT_SOURCE_TYPE = 'ik_pipeline';
const ALL_SOURCE_TYPES = 'all';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function normalizeSourceType(sourceType) {
  const normalized = String(sourceType || DEFAULT_SOURCE_TYPE).trim();
  return normalized || DEFAULT_SOURCE_TYPE;
}

function normalizeSearch(search) {
  return String(search || '').trim();
}

function normalizeLimit(limit) {
  const numericLimit = Number(limit);
  if (!Number.isFinite(numericLimit) || numericLimit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(MAX_LIMIT, Math.floor(numericLimit));
}

function normalizeOffset(offset) {
  const numericOffset = Number(offset);
  if (!Number.isFinite(numericOffset) || numericOffset < 0) {
    return 0;
  }

  return Math.floor(numericOffset);
}

function buildFilters({ sourceType, search }) {
  const values = [];
  const conditions = [];

  if (sourceType !== ALL_SOURCE_TYPES) {
    values.push(sourceType);
    conditions.push(`source_type = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    const placeholder = `$${values.length}`;
    conditions.push(`(
      COALESCE(case_name, '') ILIKE ${placeholder}
      OR COALESCE(canonical_id, '') ILIKE ${placeholder}
      OR COALESCE(court_code, '') ILIKE ${placeholder}
      OR COALESCE(status, '') ILIKE ${placeholder}
    )`);
  }

  return {
    values,
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
  };
}

async function getPipelineReportSummary({ sourceType = DEFAULT_SOURCE_TYPE } = {}) {
  const normalizedSourceType = normalizeSourceType(sourceType);
  const { values, whereClause } = buildFilters({
    sourceType: normalizedSourceType,
    search: '',
  });

  logger.flow('Loading PostgreSQL summary for pipeline report', {
    sourceType: normalizedSourceType,
    whereClause,
  });

  const result = await pool.query(
    `
      SELECT
        COUNT(*)::int AS total_judgments,
        COUNT(*) FILTER (WHERE judgment_date IS NOT NULL)::int AS judgments_with_date,
        COUNT(*) FILTER (WHERE year IS NOT NULL)::int AS judgments_with_year,
        COUNT(*) FILTER (WHERE COALESCE(es_doc_id, '') <> '')::int AS es_linked_judgments,
        COUNT(*) FILTER (WHERE COALESCE(status, '') = 'uploaded')::int AS uploaded_status_count,
        COUNT(DISTINCT NULLIF(BTRIM(COALESCE(court_code, '')), ''))::int AS distinct_courts,
        MIN(created_at) AS first_inserted_at,
        MAX(created_at) AS latest_inserted_at
      FROM judgments
      ${whereClause}
    `,
    values
  );

  const row = result.rows[0] || {};

  return {
    sourceType: normalizedSourceType,
    totalJudgments: Number(row.total_judgments || 0),
    judgmentsWithDate: Number(row.judgments_with_date || 0),
    judgmentsWithYear: Number(row.judgments_with_year || 0),
    esLinkedJudgments: Number(row.es_linked_judgments || 0),
    uploadedStatusCount: Number(row.uploaded_status_count || 0),
    distinctCourts: Number(row.distinct_courts || 0),
    firstInsertedAt: row.first_inserted_at || null,
    latestInsertedAt: row.latest_inserted_at || null,
  };
}

async function listPipelineJudgments({
  sourceType = DEFAULT_SOURCE_TYPE,
  search = '',
  limit = DEFAULT_LIMIT,
  offset = 0,
} = {}) {
  const normalizedSourceType = normalizeSourceType(sourceType);
  const normalizedSearch = normalizeSearch(search);
  const normalizedLimit = normalizeLimit(limit);
  const normalizedOffset = normalizeOffset(offset);
  const { values, whereClause } = buildFilters({
    sourceType: normalizedSourceType,
    search: normalizedSearch,
  });

  logger.flow('Loading PostgreSQL rows for pipeline report', {
    sourceType: normalizedSourceType,
    search: normalizedSearch,
    limit: normalizedLimit,
    offset: normalizedOffset,
    whereClause,
  });

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM judgments
      ${whereClause}
    `,
    values
  );

  const rowValues = [...values, normalizedLimit, normalizedOffset];
  const limitPlaceholder = `$${values.length + 1}`;
  const offsetPlaceholder = `$${values.length + 2}`;
  const rowsResult = await pool.query(
    `
      SELECT
        judgment_uuid,
        canonical_id,
        case_name,
        court_code,
        judgment_date,
        year,
        source_type,
        status,
        es_doc_id,
        created_at,
        updated_at
      FROM judgments
      ${whereClause}
      ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    rowValues
  );

  return {
    sourceType: normalizedSourceType,
    search: normalizedSearch,
    limit: normalizedLimit,
    offset: normalizedOffset,
    total: Number(totalResult.rows[0]?.total || 0),
    rows: rowsResult.rows,
  };
}

async function getPipelineJudgmentByUuid(judgmentUuid) {
  const normalizedUuid = String(judgmentUuid || '').trim();
  if (!normalizedUuid) return null;

  const result = await pool.query(
    `
      SELECT *
      FROM judgments
      WHERE judgment_uuid = $1
      LIMIT 1
    `,
    [normalizedUuid]
  );

  return result.rows[0] || null;
}

async function getChunksByJudgmentUuid(judgmentUuid) {
  const normalizedUuid = String(judgmentUuid || '').trim();
  if (!normalizedUuid) return [];

  const result = await pool.query(
    `
      SELECT *
      FROM judgment_chunks
      WHERE judgment_uuid = $1
      ORDER BY chunk_index ASC
    `,
    [normalizedUuid]
  );

  return result.rows;
}

async function getAliasesByJudgmentUuid(judgmentUuid) {
  const normalizedUuid = String(judgmentUuid || '').trim();
  if (!normalizedUuid) return [];

  const result = await pool.query(
    `
      SELECT alias_string, normalized
      FROM citation_aliases
      WHERE judgment_uuid = $1
      ORDER BY created_at ASC
    `,
    [normalizedUuid]
  );

  return result.rows;
}

module.exports = {
  ALL_SOURCE_TYPES,
  DEFAULT_SOURCE_TYPE,
  getPipelineReportSummary,
  listPipelineJudgments,
  getPipelineJudgmentByUuid,
  getChunksByJudgmentUuid,
  getAliasesByJudgmentUuid,
  normalizeLimit,
  normalizeOffset,
  normalizeSearch,
  normalizeSourceType,
};
