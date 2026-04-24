const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Repository');
const LIST_UPLOADS_SCHEMA_CACHE_TTL_MS = 60 * 1000;
let listUploadsSchemaCache = {
  expiresAt: 0,
  value: null,
};
const LIST_UPLOAD_SELECT_COLUMNS = [
  'ju.document_id',
  'ju.judgment_uuid',
  'ju.canonical_id',
  'ju.original_filename',
  'ju.status',
  'ju.total_pages',
  'ju.text_pages_count',
  'ju.ocr_pages_count',
  'ju.ocr_batches_count',
  'ju.last_progress_message',
  'ju.error_message',
  'ju.processing_started_at',
  'ju.processing_completed_at',
  'ju.created_at',
  'ju.updated_at',
];

function getPgErrorMeta(error) {
  if (!error) return {};

  return {
    pg_code: error.code || null,
    pg_severity: error.severity || null,
    pg_detail: error.detail || null,
    pg_hint: error.hint || null,
    pg_schema: error.schema || null,
    pg_table: error.table || null,
    pg_column: error.column || null,
    pg_constraint: error.constraint || null,
    pg_position: error.position || null,
    pg_internal_position: error.internalPosition || null,
    pg_where: error.where || null,
    pg_routine: error.routine || null,
  };
}

function mapUploadRow(row) {
  if (!row) return null;
  return {
    documentId: row.document_id,
    judgmentUuid: row.judgment_uuid,
    canonicalId: row.canonical_id,
    originalFilename: row.original_filename,
    sourceUrl: row.source_url,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    storageUri: row.storage_uri,
    status: row.status,
    adminUserId: row.admin_user_id,
    adminRole: row.admin_role,
    totalPages: row.total_pages,
    textPagesCount: row.text_pages_count,
    ocrPagesCount: row.ocr_pages_count,
    ocrBatchesCount: row.ocr_batches_count,
    mergedText: row.merged_text,
    metadata: row.metadata || {},
    pipelineMetrics: row.pipeline_metrics || {},
    esDocId: row.es_doc_id,
    qdrantCollection: row.qdrant_collection,
    lastProgressMessage: row.last_progress_message,
    errorMessage: row.error_message,
    processingStartedAt: row.processing_started_at,
    processingCompletedAt: row.processing_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isSchemaDriftError(error) {
  return ['42P01', '42703'].includes(error?.code);
}

async function getListUploadsSchemaState({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && listUploadsSchemaCache.value && listUploadsSchemaCache.expiresAt > now) {
    return listUploadsSchemaCache.value;
  }

  const result = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'judgment_uploads' AND column_name IN ('judgment_uuid', 'canonical_id'))
        OR (
          table_name = 'judgments'
          AND column_name IN ('judgment_uuid', 'case_name', 'court_code', 'year', 'judgment_date')
        )
      )
  `);

  const columnsByTable = new Map();

  result.rows.forEach((row) => {
    const existing = columnsByTable.get(row.table_name) || new Set();
    existing.add(row.column_name);
    columnsByTable.set(row.table_name, existing);
  });

  const uploadColumns = columnsByTable.get('judgment_uploads') || new Set();
  const judgmentColumns = columnsByTable.get('judgments') || new Set();
  const requiredJudgmentColumns = ['judgment_uuid', 'case_name', 'court_code', 'year', 'judgment_date'];

  const schemaState = {
    hasUploadsJudgmentUuid: uploadColumns.has('judgment_uuid'),
    hasUploadsCanonicalId: uploadColumns.has('canonical_id'),
    hasJudgmentsMetadata:
      requiredJudgmentColumns.every((columnName) => judgmentColumns.has(columnName)),
  };

  schemaState.canJoinJudgments =
    schemaState.hasUploadsJudgmentUuid && schemaState.hasJudgmentsMetadata;

  listUploadsSchemaCache = {
    value: schemaState,
    expiresAt: now + LIST_UPLOADS_SCHEMA_CACHE_TTL_MS,
  };

  logger.flow('Resolved upload listing schema state', {
    forceRefresh,
    schemaState,
    discoveredColumns: result.rows,
  });

  return schemaState;
}

function buildListUploadsQuery({ search = '', status = 'all', schemaState }) {
  const conditions = [];
  const values = [];
  const uploadSelectClause = LIST_UPLOAD_SELECT_COLUMNS.join(',\n        ');
  const selectCaseName = schemaState.canJoinJudgments ? 'j.case_name' : 'NULL::TEXT AS case_name';
  const selectCourtCode = schemaState.canJoinJudgments ? 'j.court_code' : 'NULL::VARCHAR(20) AS court_code';
  const selectYear = schemaState.canJoinJudgments ? 'j.year' : 'NULL::SMALLINT AS year';
  const selectJudgmentDate = schemaState.canJoinJudgments
    ? 'j.judgment_date'
    : 'NULL::DATE AS judgment_date';

  if (status && status !== 'all') {
    values.push(status);
    conditions.push(`ju.status = $${values.length}`);
  }

  if (search) {
    values.push(`%${String(search).trim().toLowerCase()}%`);

    const searchableFields = [
      `LOWER(ju.original_filename) LIKE $${values.length}`,
    ];

    if (schemaState.canJoinJudgments) {
      searchableFields.push(`LOWER(COALESCE(j.case_name, '')) LIKE $${values.length}`);
    }

    if (schemaState.hasUploadsCanonicalId) {
      searchableFields.push(`LOWER(COALESCE(ju.canonical_id, '')) LIKE $${values.length}`);
    }

    conditions.push(`(${searchableFields.join('\n      OR ')})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const joinClause = schemaState.canJoinJudgments
    ? 'LEFT JOIN judgments j ON j.judgment_uuid = ju.judgment_uuid'
    : '';

  return {
    values,
    query: `
      SELECT
        ${uploadSelectClause},
        ${selectCaseName},
        ${selectCourtCode},
        ${selectYear},
        ${selectJudgmentDate}
      FROM judgment_uploads ju
      ${joinClause}
      ${whereClause}
      ORDER BY ju.created_at DESC
    `,
  };
}

async function createUpload(payload) {
  const query = `
    INSERT INTO judgment_uploads (
      document_id,
      original_filename,
      source_url,
      storage_bucket,
      storage_path,
      storage_uri,
      status,
      admin_user_id,
      admin_role,
      processing_started_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING *
  `;

  const values = [
    payload.documentId,
    payload.originalFilename,
    payload.sourceUrl || null,
    payload.storageBucket || null,
    payload.storagePath || null,
    payload.storageUri || null,
    payload.status || 'uploaded',
    payload.adminUserId || null,
    payload.adminRole || null,
  ];

  const result = await pool.query(query, values);
  return mapUploadRow(result.rows[0]);
}

async function updateUpload(documentId, fields = {}) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);

  if (!entries.length) {
    return getUpload(documentId);
  }

  const setClauses = entries.map(([column], index) => `${column} = $${index + 2}`);
  const values = [documentId, ...entries.map(([, value]) => value)];

  const result = await pool.query(
    `
      UPDATE judgment_uploads
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE document_id = $1
      RETURNING *
    `,
    values
  );

  return mapUploadRow(result.rows[0]);
}

async function getUpload(documentId) {
  const result = await pool.query(
    'SELECT * FROM judgment_uploads WHERE document_id = $1',
    [documentId]
  );
  return mapUploadRow(result.rows[0]);
}

async function getJudgmentsByUuids(judgmentUuids = []) {
  const ids = Array.from(
    new Set(
      judgmentUuids
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );

  if (!ids.length) return [];

  const result = await pool.query(
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
        citation_data
      FROM judgments
      WHERE judgment_uuid = ANY($1::uuid[])
    `,
    [ids]
  );

  return result.rows;
}

async function listJudgmentIdentities({ excludeJudgmentUuid = null } = {}) {
  const values = [];
  const conditions = [];

  if (excludeJudgmentUuid) {
    values.push(excludeJudgmentUuid);
    conditions.push(`judgment_uuid <> $${values.length}::uuid`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
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
        citation_data
      FROM judgments
      ${whereClause}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    `,
    values
  );

  return result.rows;
}

async function listUploads({ search = '', status = 'all' } = {}) {
  const startedAt = Date.now();
  const normalizedSearch = String(search || '').trim();
  let schemaState = await getListUploadsSchemaState();

  try {
    const { query, values } = buildListUploadsQuery({
      search: normalizedSearch,
      status,
      schemaState,
    });

    logger.flow('Executing upload listing query', {
      status,
      search: normalizedSearch,
      hasSearch: Boolean(normalizedSearch),
      schemaState,
      queryMode: schemaState.canJoinJudgments ? 'full_join' : 'uploads_only',
      query,
      values,
    });

    const result = await pool.query(query, values);

    logger.flow('Upload listing query succeeded', {
      status,
      search: normalizedSearch,
      durationMs: Date.now() - startedAt,
      rowCount: result.rowCount,
      schemaState,
      queryMode: schemaState.canJoinJudgments ? 'full_join' : 'uploads_only',
    });

    if (!schemaState.canJoinJudgments || !schemaState.hasUploadsCanonicalId) {
      logger.warn('Listing uploads with reduced schema compatibility', schemaState);
    }

    return result.rows.map((row) => ({
      ...mapUploadRow(row),
      caseName: row.case_name,
      courtCode: row.court_code,
      year: row.year,
      judgmentDate: row.judgment_date,
    }));
  } catch (error) {
    logger.error('Upload listing query failed', error, {
      status,
      search: normalizedSearch,
      durationMs: Date.now() - startedAt,
      schemaState,
      ...getPgErrorMeta(error),
    });

    if (!isSchemaDriftError(error)) {
      throw error;
    }

    logger.warn('Detected schema drift while listing uploads, retrying with refreshed schema state', {
      status,
      search: normalizedSearch,
      ...getPgErrorMeta(error),
    });

    schemaState = await getListUploadsSchemaState({ forceRefresh: true });
    const { query, values } = buildListUploadsQuery({
      search: normalizedSearch,
      status,
      schemaState,
    });

    logger.flow('Retrying upload listing query after schema refresh', {
      status,
      search: normalizedSearch,
      schemaState,
      queryMode: schemaState.canJoinJudgments ? 'full_join' : 'uploads_only',
      query,
      values,
    });

    const result = await pool.query(query, values);

    logger.warn('Listing uploads after schema compatibility fallback', schemaState);
    logger.flow('Upload listing fallback query succeeded', {
      status,
      search: normalizedSearch,
      durationMs: Date.now() - startedAt,
      rowCount: result.rowCount,
      schemaState,
      queryMode: schemaState.canJoinJudgments ? 'full_join' : 'uploads_only',
    });

    return result.rows.map((row) => ({
      ...mapUploadRow(row),
      caseName: row.case_name,
      courtCode: row.court_code,
      year: row.year,
      judgmentDate: row.judgment_date,
    }));
  }
}

async function getSummary() {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'uploaded')::int AS uploaded,
      COUNT(*) FILTER (WHERE status = 'splitting')::int AS splitting,
      COUNT(*) FILTER (WHERE status = 'ocr_processing')::int AS ocr_processing,
      COUNT(*) FILTER (WHERE status = 'indexing')::int AS indexing,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'duplicate_detected')::int AS duplicate_detected,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COALESCE(SUM(total_pages), 0)::int AS total_pages,
      COALESCE(SUM(text_pages_count), 0)::int AS total_text_pages,
      COALESCE(SUM(ocr_pages_count), 0)::int AS total_ocr_pages,
      COALESCE(SUM((pipeline_metrics->>'totalDurationMs')::numeric), 0)::numeric AS total_duration_ms,
      COALESCE(AVG((pipeline_metrics->>'totalDurationMs')::numeric) FILTER (WHERE status = 'completed'), 0)::numeric AS avg_duration_ms
    FROM judgment_uploads
  `);

  const row = result.rows[0];
  return {
    ...row,
    total_duration_ms: parseFloat(row.total_duration_ms),
    avg_duration_ms: parseFloat(row.avg_duration_ms),
  };
}

async function replacePages(documentId, pages = []) {
  await pool.query('DELETE FROM judgment_pages WHERE document_id = $1', [documentId]);

  for (const page of pages) {
    await pool.query(
      `
        INSERT INTO judgment_pages (
          page_id,
          document_id,
          page_number,
          page_type,
          status,
          text_length,
          text_content,
          gcs_page_path,
          gcs_page_uri,
          ocr_json_path,
          ocr_json_uri,
          ocr_confidence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        page.pageId || uuidv4(),
        documentId,
        page.pageNumber,
        page.pageType,
        page.status || 'uploaded',
        page.textLength || 0,
        page.textContent || null,
        page.gcsPagePath || null,
        page.gcsPageUri || null,
        page.ocrJsonPath || null,
        page.ocrJsonUri || null,
        page.ocrConfidence || null,
      ]
    );
  }
}

async function updatePage(documentId, pageNumber, fields = {}) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!entries.length) return;

  const setClauses = entries.map(([column], index) => `${column} = $${index + 3}`);
  const values = [documentId, pageNumber, ...entries.map(([, value]) => value)];

  await pool.query(
    `
      UPDATE judgment_pages
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE document_id = $1 AND page_number = $2
    `,
    values
  );
}

async function getPages(documentId) {
  const result = await pool.query(
    `
      SELECT *
      FROM judgment_pages
      WHERE document_id = $1
      ORDER BY page_number ASC
    `,
    [documentId]
  );

  return result.rows;
}

async function clearJudgmentArtifacts(documentId, judgmentUuid = null) {
  if (judgmentUuid) {
    await pool.query('DELETE FROM judgment_chunks WHERE judgment_uuid = $1', [judgmentUuid]);
    await pool.query('DELETE FROM citation_aliases WHERE judgment_uuid = $1', [judgmentUuid]);
  }
}

async function upsertJudgment(payload) {
  const values = [
    payload.judgmentUuid,
    payload.canonicalId,
    payload.caseName,
    payload.courtCode || 'UNKNOWN',
    payload.judgmentDate || null,
    payload.year || null,
    payload.sourceType || 'admin-upload',
    payload.verificationStatus || 'verified',
    payload.confidenceScore || null,
    payload.esDocId || null,
    payload.status || 'ocr_done',
    JSON.stringify(payload.ocrInfo || {}),
    JSON.stringify(payload.citationData || {}),
    payload.qdrantCollection || null,
  ];

  if (payload.judgmentUuid) {
    const updateResult = await pool.query(
      `
        UPDATE judgments
        SET
          canonical_id = $2,
          case_name = $3,
          court_code = $4,
          judgment_date = $5,
          year = $6,
          source_type = $7,
          verification_status = $8,
          confidence_score = $9,
          es_doc_id = $10,
          status = $11,
          ocr_info = $12::jsonb,
          citation_data = $13::jsonb,
          qdrant_collection = $14,
          updated_at = NOW()
        WHERE judgment_uuid = $1
        RETURNING *
      `,
      values
    );

    if (updateResult.rows[0]) {
      return updateResult.rows[0];
    }
  }

  const insertResult = await pool.query(
    `
      INSERT INTO judgments (
        judgment_uuid,
        canonical_id,
        case_name,
        court_code,
        judgment_date,
        year,
        source_type,
        verification_status,
        confidence_score,
        es_doc_id,
        status,
        ocr_info,
        citation_data,
        qdrant_collection,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, NOW())
      ON CONFLICT (canonical_id) DO UPDATE
      SET
        case_name = EXCLUDED.case_name,
        court_code = EXCLUDED.court_code,
        judgment_date = EXCLUDED.judgment_date,
        year = EXCLUDED.year,
        source_type = EXCLUDED.source_type,
        verification_status = EXCLUDED.verification_status,
        confidence_score = EXCLUDED.confidence_score,
        es_doc_id = EXCLUDED.es_doc_id,
        status = EXCLUDED.status,
        ocr_info = EXCLUDED.ocr_info,
        citation_data = EXCLUDED.citation_data,
        qdrant_collection = EXCLUDED.qdrant_collection,
        updated_at = NOW()
      RETURNING *
    `,
    values
  );

  return insertResult.rows[0];
}

async function replaceAliases(judgmentUuid, aliases = []) {
  await pool.query('DELETE FROM citation_aliases WHERE judgment_uuid = $1', [judgmentUuid]);

  for (const alias of aliases) {
    if (!alias) continue;

    const normalized = String(alias).trim().toLowerCase().replace(/\s+/g, ' ');
    await pool.query(
      `
        INSERT INTO citation_aliases (
          alias_id,
          judgment_uuid,
          alias_string,
          reporter_type,
          normalized
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (normalized) DO NOTHING
      `,
      [uuidv4(), judgmentUuid, alias, null, normalized]
    );
  }
}

async function replaceChunks(documentId, judgmentUuid, chunks = [], embeddingModel = null) {
  await pool.query('DELETE FROM judgment_chunks WHERE judgment_uuid = $1', [judgmentUuid]);

  for (const chunk of chunks) {
    await pool.query(
      `
        INSERT INTO judgment_chunks (
          chunk_id,
          document_id,
          judgment_uuid,
          chunk_index,
          char_start,
          char_end,
          chunk_text,
          embedding_model,
          embedding_status,
          qdrant_point_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (judgment_uuid, chunk_index) DO UPDATE SET
          chunk_id = EXCLUDED.chunk_id,
          document_id = EXCLUDED.document_id,
          char_start = EXCLUDED.char_start,
          char_end = EXCLUDED.char_end,
          chunk_text = EXCLUDED.chunk_text,
          embedding_model = EXCLUDED.embedding_model,
          embedding_status = EXCLUDED.embedding_status,
          qdrant_point_id = EXCLUDED.qdrant_point_id
      `,
      [
        chunk.chunkId,
        documentId,
        judgmentUuid,
        chunk.chunkIndex,
        chunk.charStart,
        chunk.charEnd,
        chunk.chunkText,
        embeddingModel,
        chunk.embeddingStatus || 'pending',
        chunk.qdrantPointId || null,
      ]
    );
  }
}

async function markChunksIndexed(judgmentUuid) {
  await pool.query(
    `
      UPDATE judgment_chunks
      SET
        embedding_status = 'indexed',
        qdrant_point_id = chunk_id::text,
        updated_at = NOW()
      WHERE judgment_uuid = $1
    `,
    [judgmentUuid]
  );
}

async function getChunks(judgmentUuid) {
  const result = await pool.query(
    `
      SELECT *
      FROM judgment_chunks
      WHERE judgment_uuid = $1
      ORDER BY chunk_index ASC
    `,
    [judgmentUuid]
  );

  return result.rows;
}

async function getUploadDetail(documentId) {
  const upload = await getUpload(documentId);
  if (!upload) return null;

  const judgment = upload.judgmentUuid
    ? (await pool.query('SELECT * FROM judgments WHERE judgment_uuid = $1', [upload.judgmentUuid])).rows[0] || null
    : null;
  const pages = await getPages(documentId);
  const chunks = upload.judgmentUuid ? await getChunks(upload.judgmentUuid) : [];
  const aliases = upload.judgmentUuid
    ? (await pool.query(
      'SELECT alias_string, normalized FROM citation_aliases WHERE judgment_uuid = $1 ORDER BY created_at ASC',
      [upload.judgmentUuid]
    )).rows
    : [];

  return {
    upload,
    judgment,
    pages,
    chunks,
    aliases,
  };
}

async function countUploadsByJudgmentUuid(judgmentUuid, { excludeDocumentId = null } = {}) {
  if (!judgmentUuid) return 0;

  const values = [judgmentUuid];
  const conditions = ['judgment_uuid = $1'];

  if (excludeDocumentId) {
    values.push(excludeDocumentId);
    conditions.push(`document_id <> $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS upload_count
      FROM judgment_uploads
      WHERE ${conditions.join(' AND ')}
    `,
    values
  );

  return Number(result.rows[0]?.upload_count || 0);
}

async function deleteJudgmentByUuid(judgmentUuid) {
  if (!judgmentUuid) return false;

  const result = await pool.query(
    'DELETE FROM judgments WHERE judgment_uuid = $1',
    [judgmentUuid]
  );

  return result.rowCount > 0;
}

async function deleteUploadAndJudgment(documentId) {
  const upload = await getUpload(documentId);
  if (!upload) return false;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (upload.judgmentUuid) {
      const referenceCountResult = await client.query(
        `
          SELECT COUNT(*)::int AS upload_count
          FROM judgment_uploads
          WHERE judgment_uuid = $1 AND document_id <> $2
        `,
        [upload.judgmentUuid, documentId]
      );

      if (Number(referenceCountResult.rows[0]?.upload_count || 0) === 0) {
        await client.query('DELETE FROM judgments WHERE judgment_uuid = $1', [upload.judgmentUuid]);
      }
    }

    await client.query('DELETE FROM judgment_uploads WHERE document_id = $1', [documentId]);

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createUpload,
  updateUpload,
  getUpload,
  listUploads,
  getSummary,
  replacePages,
  updatePage,
  getPages,
  clearJudgmentArtifacts,
  upsertJudgment,
  replaceAliases,
  replaceChunks,
  markChunksIndexed,
  getChunks,
  getUploadDetail,
  listJudgmentIdentities,
  getJudgmentsByUuids,
  countUploadsByJudgmentUuid,
  deleteJudgmentByUuid,
  deleteUploadAndJudgment,
};
