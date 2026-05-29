/**
 * Repository for kb_documents, kb_chunks, kb_search_logs, voice_debug_events.
 *
 * Embeddings are sent to PostgreSQL as pgvector string literals
 * (e.g. `[0.1,0.2,...]`) and cast `$N::vector` so we don't need any
 * special pg type registration.
 */
const pool = require('../db/jurinexVoiceDB');

const DOC_COLS = `
  id, agent_id, title, source_type, source_uri,
  gcs_bucket, gcs_object_name, gcs_uri,
  original_filename, content_type, file_size_bytes, file_hash,
  status, error_message, chunk_count, token_count,
  embedding_model, embedding_dim, language, tags,
  uploaded_by, created_at, updated_at
`;

const insertDocument = async (doc) => {
  const {
    agent_id = null,
    title,
    source_type,
    source_uri = null,
    gcs_bucket = null,
    gcs_object_name = null,
    gcs_uri = null,
    original_filename = null,
    content_type = null,
    file_size_bytes = null,
    file_hash = null,
    raw_text = null,
    status = 'processing',
    embedding_model = 'text-embedding-004',
    embedding_dim = 768,
    language = null,
    tags = null,
    uploaded_by = null,
  } = doc;

  const { rows } = await pool.query(
    `INSERT INTO kb_documents
       (agent_id, title, source_type, source_uri,
        gcs_bucket, gcs_object_name, gcs_uri,
        original_filename, content_type, file_size_bytes, file_hash,
        raw_text, status, embedding_model, embedding_dim,
        language, tags, uploaded_by)
     VALUES
       ($1,$2,$3,$4,
        $5,$6,$7,
        $8,$9,$10,$11,
        $12,$13,$14,$15,
        $16,$17,$18)
     RETURNING ${DOC_COLS}`,
    [
      agent_id,
      title,
      source_type,
      source_uri,
      gcs_bucket,
      gcs_object_name,
      gcs_uri,
      original_filename,
      content_type,
      file_size_bytes,
      file_hash,
      raw_text,
      status,
      embedding_model,
      embedding_dim,
      language,
      tags,
      uploaded_by,
    ]
  );
  return rows[0];
};

const updateDocument = async (id, fields) => {
  const allowed = [
    'agent_id',
    'title',
    'source_type',
    'source_uri',
    'gcs_bucket',
    'gcs_object_name',
    'gcs_uri',
    'original_filename',
    'content_type',
    'file_size_bytes',
    'file_hash',
    'raw_text',
    'status',
    'error_message',
    'chunk_count',
    'token_count',
    'embedding_model',
    'embedding_dim',
    'language',
    'tags',
  ];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    params.push(fields[key]);
    sets.push(`${key} = $${params.length}`);
  }
  if (!sets.length) return getDocument(id);
  params.push(id);
  const { rows } = await pool.query(
    `UPDATE kb_documents
        SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length}
      RETURNING ${DOC_COLS}`,
    params
  );
  return rows[0] || null;
};

const getDocument = async (id) => {
  const { rows } = await pool.query(
    `SELECT ${DOC_COLS} FROM kb_documents WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

const findByHash = async (file_hash) => {
  if (!file_hash) return null;
  const { rows } = await pool.query(
    `SELECT ${DOC_COLS} FROM kb_documents WHERE file_hash = $1 LIMIT 1`,
    [file_hash]
  );
  return rows[0] || null;
};

const listDocuments = async ({
  agent_id,
  status,
  source_type,
  limit = 50,
  offset = 0,
  // When true (default), an agent_id filter ALSO includes global docs
  // (agent_id IS NULL). This matches the runtime search semantics
  // (`OR d.agent_id IS NULL`). Set false for "strict ownership" views.
  include_global = true,
} = {}) => {
  const params = [];
  const where = [];
  if (agent_id) {
    params.push(agent_id);
    where.push(
      include_global
        ? `(agent_id = $${params.length}::uuid OR agent_id IS NULL)`
        : `agent_id = $${params.length}::uuid`
    );
  }
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (source_type) {
    params.push(source_type);
    where.push(`source_type = $${params.length}`);
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  params.push(Math.max(Number(offset) || 0, 0));

  const sql = `
    SELECT ${DOC_COLS}
      FROM kb_documents
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
};

const deleteDocument = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM kb_documents WHERE id = $1
     RETURNING gcs_bucket, gcs_object_name, id`,
    [id]
  );
  return rows[0] || null;
};

const deleteChunksFor = async (document_id) => {
  await pool.query(`DELETE FROM kb_chunks WHERE document_id = $1`, [document_id]);
};

const insertChunks = async (document_id, chunks) => {
  if (!chunks.length) return 0;
  const BATCH = 200;
  let total = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 0;

    for (const c of batch) {
      params.push(
        document_id,
        c.chunk_index,
        c.text,
        c.token_count,
        c.char_start ?? null,
        c.char_end ?? null,
        c.heading_path || null,
        c.metadata ? JSON.stringify(c.metadata) : null,
        c.embeddingLiteral
      );
      values.push(
        `($${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}::jsonb, $${++p}::vector)`
      );
    }

    await pool.query(
      `INSERT INTO kb_chunks
         (document_id, chunk_index, text, token_count,
          char_start, char_end, heading_path, metadata, embedding)
       VALUES ${values.join(', ')}
       ON CONFLICT (document_id, chunk_index) DO NOTHING`,
      params
    );
    total += batch.length;
  }
  return total;
};

const getDocumentChunks = async (document_id, { limit = 5 } = {}) => {
  const { rows } = await pool.query(
    `SELECT id, chunk_index, text, token_count, char_start, char_end,
            heading_path, metadata, created_at
       FROM kb_chunks
      WHERE document_id = $1
      ORDER BY chunk_index ASC
      LIMIT $2`,
    [document_id, Math.min(Math.max(Number(limit) || 5, 1), 100)]
  );
  return rows;
};

const search = async ({ embeddingLiteral, agent_id = null, k = 5 }) => {
  const sql = `
    SELECT
      c.id,
      c.text,
      c.heading_path,
      c.document_id,
      c.chunk_index,
      d.title           AS document_title,
      d.gcs_uri         AS gcs_uri,
      d.source_type     AS source_type,
      d.agent_id        AS agent_id,
      1 - (c.embedding <=> $1::vector) AS score
    FROM kb_chunks c
    JOIN kb_documents d ON d.id = c.document_id
   WHERE d.status = 'ready'
     AND ($2::uuid IS NULL OR d.agent_id = $2::uuid OR d.agent_id IS NULL)
   ORDER BY c.embedding <=> $1::vector
   LIMIT $3
  `;
  const { rows } = await pool.query(sql, [
    embeddingLiteral,
    agent_id || null,
    Math.min(Math.max(Number(k) || 5, 1), 50),
  ]);
  return rows;
};

const insertSearchLog = async ({
  call_id = null,
  agent_id = null,
  query,
  top_chunk_ids = [],
  top_scores = [],
  latency_ms = null,
  source = null,
}) => {
  const { rows } = await pool.query(
    `INSERT INTO kb_search_logs
       (call_id, agent_id, query, top_chunk_ids, top_scores, latency_ms, source)
     VALUES ($1,$2,$3,$4::uuid[],$5::double precision[],$6,$7)
     RETURNING id, created_at`,
    [
      call_id,
      agent_id,
      query,
      top_chunk_ids,
      top_scores,
      latency_ms,
      source,
    ]
  );
  return rows[0];
};

const listSearchLogs = async ({ agent_id, limit = 50, offset = 0 } = {}) => {
  const params = [];
  const where = [];
  if (agent_id) {
    params.push(agent_id);
    where.push(`agent_id = $${params.length}`);
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  params.push(Math.max(Number(offset) || 0, 0));
  const sql = `
    SELECT id, call_id, agent_id, query, top_chunk_ids, top_scores,
           latency_ms, source, created_at
      FROM kb_search_logs
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
};

const listDebugEvents = async ({
  event_type,
  trace_id,
  document_id,
  agent_id,
  limit = 100,
  offset = 0,
} = {}) => {
  const params = [];
  const where = [];
  if (event_type) {
    params.push(event_type);
    where.push(`event_type = $${params.length}`);
  }
  if (trace_id) {
    params.push(trace_id);
    where.push(`trace_id = $${params.length}`);
  }
  if (document_id) {
    params.push(document_id);
    where.push(`document_id = $${params.length}`);
  }
  if (agent_id) {
    params.push(agent_id);
    where.push(`agent_id = $${params.length}`);
  }
  params.push(Math.min(Math.max(Number(limit) || 100, 1), 500));
  params.push(Math.max(Number(offset) || 0, 0));
  const sql = `
    SELECT id, trace_id, agent_id, document_id, event_type,
           event_stage, message, payload, created_at
      FROM voice_debug_events
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
};

module.exports = {
  insertDocument,
  updateDocument,
  getDocument,
  findByHash,
  listDocuments,
  deleteDocument,
  deleteChunksFor,
  insertChunks,
  getDocumentChunks,
  search,
  insertSearchLog,
  listSearchLogs,
  listDebugEvents,
};
