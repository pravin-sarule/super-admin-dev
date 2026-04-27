const { v4: uuidv4 } = require('uuid');
const { generateSignedUrl, listOutputFiles, downloadJsonFile } = require('../services/gcsService');
const { triggerBatchProcess, pollOperation } = require('../services/documentAIService');
const { parseDocumentAIJson, splitIntoChunks } = require('../services/chunkingService');
const { getBatchEmbeddings } = require('../services/embeddingService');
const pool = require('../config/aiDocumentDB');

// ─── Signed URL ───────────────────────────────────────────────────────────────

const generateSignedUrlHandler = async (req, res) => {
  try {
    const { filename, content_type } = req.body;
    if (!filename) return res.status(400).json({ success: false, error: 'filename is required' });

    const ext = filename.split('.').pop().toLowerCase();
    const safeFileName = `${uuidv4()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const gcsInputPath = `gs://${process.env.GCS_INPUT_BUCKET}/${safeFileName}`;
    const mimeType = content_type || 'application/pdf';

    const signedUrl = await generateSignedUrl(safeFileName, mimeType);

    const { rows } = await pool.query(
      `INSERT INTO documents (file_name, original_extension, gcs_input_path, processing_status)
       VALUES ($1, $2, $3, 'uploaded') RETURNING id`,
      [filename, ext, gcsInputPath]
    );

    return res.json({
      success: true,
      signed_url: signedUrl,
      gcs_input_path: gcsInputPath,
      document_id: rows[0].id,
    });
  } catch (err) {
    console.error('generateSignedUrl error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Trigger Processing ───────────────────────────────────────────────────────

const processDocumentHandler = async (req, res) => {
  const { gcs_input_path, document_id, filename, document_type } = req.body;
  if (!gcs_input_path) {
    return res.status(400).json({ success: false, error: 'gcs_input_path is required' });
  }

  try {
    let docId = document_id;

    if (!docId) {
      const ext = (filename || 'unknown.pdf').split('.').pop().toLowerCase();
      const { rows } = await pool.query(
        `INSERT INTO documents (file_name, original_extension, gcs_input_path, processing_status, document_type)
         VALUES ($1, $2, $3, 'uploaded', $4) RETURNING id`,
        [filename || 'unknown.pdf', ext, gcs_input_path, document_type || 'general']
      );
      docId = rows[0].id;
    } else {
      await pool.query(
        `UPDATE documents SET processing_status = 'uploaded', document_type = COALESCE($1, document_type), updated_at = NOW() WHERE id = $2`,
        [document_type || null, docId]
      );
    }

    res.json({ success: true, document_id: docId, status: 'ocr_processing' });

    runProcessingPipeline(docId, gcs_input_path).catch((err) => {
      console.error(`❌ Pipeline failed for document ${docId}:`, err.message);
    });
  } catch (err) {
    console.error('processDocument error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Background Pipeline ──────────────────────────────────────────────────────

const runProcessingPipeline = async (docId, gcsInputPath) => {
  const setStatus = (status) =>
    pool.query(
      `UPDATE documents SET processing_status = $1, updated_at = NOW() WHERE id = $2`,
      [status, docId]
    );

  try {
    await setStatus('ocr_processing');

    const outputPrefix = `gs://${process.env.GCS_OUTPUT_BUCKET}/ocr-output/${docId}/`;
    const operationName = await triggerBatchProcess(gcsInputPath, outputPrefix);

    await pool.query(
      `UPDATE documents SET operation_id = $1, updated_at = NOW() WHERE id = $2`,
      [operationName, docId]
    );

    // Poll LRO — check every 5 s, max 10 min (120 attempts)
    let done = false;
    for (let i = 0; i < 120 && !done; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const { done: isDone, error } = await pollOperation(operationName);
      if (error) throw new Error(`Document AI LRO error: ${JSON.stringify(error)}`);
      done = isDone;
    }
    if (!done) throw new Error('Document AI processing timed out after 10 minutes');

    await setStatus('ocr_completed');

    // Download all GCS output files in parallel
    const files = await listOutputFiles(`ocr-output/${docId}/`);
    const jsonFiles = files.filter((f) => f.name.endsWith('.json'));

    const downloadedDocs = await Promise.all(jsonFiles.map((f) => downloadJsonFile(f)));

    let allChunks = [];
    let totalPages = 0;
    let ocrPath = null;

    for (let i = 0; i < downloadedDocs.length; i++) {
      const docAIJson = downloadedDocs[i];
      totalPages = Math.max(totalPages, (docAIJson.pages || []).length);
      if (!ocrPath) ocrPath = `gs://${process.env.GCS_OUTPUT_BUCKET}/${jsonFiles[i].name}`;
      allChunks = allChunks.concat(splitIntoChunks(parseDocumentAIJson(docAIJson)));
    }

    await pool.query(
      `UPDATE documents SET total_pages = $1, gcs_ocr_path = $2,
       processing_status = 'embedding_processing', updated_at = NOW() WHERE id = $3`,
      [totalPages, ocrPath, docId]
    );

    // ── Bulk INSERT all chunks in one query ──────────────────────────────────
    const { rows: insertedChunks } = await pool.query(
      `INSERT INTO document_chunks (document_id, content, chunk_index, page_number, token_count)
       SELECT * FROM unnest(
         $1::uuid[], $2::text[], $3::int[], $4::int[], $5::int[]
       ) AS t(document_id, content, chunk_index, page_number, token_count)
       RETURNING id, chunk_index`,
      [
        allChunks.map(() => docId),
        allChunks.map((c) => c.content),
        allChunks.map((c) => c.chunk_index),
        allChunks.map((c) => c.page_number ?? 1),
        allChunks.map((c) => c.token_count ?? 0),
      ]
    );

    // Map chunk_index → chunk UUID returned by DB
    const chunkIdByIndex = {};
    for (const row of insertedChunks) chunkIdByIndex[row.chunk_index] = row.id;

    // ── Embed all chunks in parallel batches of 10 ───────────────────────────
    console.log(`⚡ Embedding ${allChunks.length} chunks in parallel batches…`);
    const allVectors = await getBatchEmbeddings(
      allChunks.map((c) => c.content),
      10  // 10 concurrent Gemini API calls at a time
    );

    // ── Bulk INSERT all embeddings in one query ──────────────────────────────
    const embParams = [];
    const embValueClauses = allChunks.map((c, i) => {
      const chunkId = chunkIdByIndex[c.chunk_index];
      const vecStr  = `[${allVectors[i].join(',')}]`;
      embParams.push(chunkId, vecStr);
      const p1 = embParams.length - 1;
      const p2 = embParams.length;
      return `($${p1}::uuid, $${p2}::vector, 'RETRIEVAL_DOCUMENT', 'gemini-embedding-2')`;
    });

    await pool.query(
      `INSERT INTO chunk_embeddings (chunk_id, embedding, task_type, model_name)
       VALUES ${embValueClauses.join(', ')}`,
      embParams
    );

    const chunkCount = allChunks.length;

    await pool.query(
      `UPDATE documents SET processing_status = 'active', total_chunks = $1, updated_at = NOW() WHERE id = $2`,
      [chunkCount, docId]
    );

    console.log(`✅ Document ${docId} complete: ${chunkCount} chunks, ${totalPages} pages`);
  } catch (err) {
    console.error(`❌ Pipeline error for document ${docId}:`, err.message);
    await pool
      .query(
        `UPDATE documents SET processing_status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [err.message, docId]
      )
      .catch(() => {});
  }
};

// ─── List ─────────────────────────────────────────────────────────────────────

const listDocumentsHandler = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, file_name, original_extension, gcs_input_path, gcs_ocr_path,
              processing_status, document_type, total_pages, total_chunks,
              error_message, created_at, updated_at
       FROM documents ORDER BY created_at DESC`
    );
    return res.json({ success: true, documents: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Get Single ───────────────────────────────────────────────────────────────

const getDocumentHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`SELECT * FROM documents WHERE id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Document not found' });

    const { rows: chunks } = await pool.query(
      `SELECT id, chunk_index, content, page_number, token_count
       FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index`,
      [id]
    );

    return res.json({ success: true, document: rows[0], chunks });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────

const deleteDocumentHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(`DELETE FROM documents WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ success: false, error: 'Document not found' });
    return res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  generateSignedUrlHandler,
  processDocumentHandler,
  listDocumentsHandler,
  getDocumentHandler,
  deleteDocumentHandler,
};
