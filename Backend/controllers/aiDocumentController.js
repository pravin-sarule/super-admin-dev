const { v4: uuidv4 } = require('uuid');
const { generateSignedUrl, listOutputFiles, downloadJsonFile } = require('../services/gcsService');
const { triggerBatchProcess, pollOperation } = require('../services/documentAIService');
const { parseDocumentAIJson, splitIntoChunks } = require('../services/chunkingService');
const { ocrPdfToChunks } = require('../services/parallelPageOcrService');
const { getBatchEmbeddings } = require('../services/embeddingService');
const pool = require('../config/aiDocumentDB');

/**
 * GCS batch OCR: single LRO, then download shards, sort by file name, merge pages → chunks.
 */
async function runBatchOcrToChunks(docId, gcsInputPath, heartbeat, lap) {
  const outputPrefix = `gs://${process.env.GCS_OUTPUT_BUCKET}/ocr-output/${docId}/`;
  heartbeat(`Document AI batchProcessDocuments starting (input=${gcsInputPath}, outputPrefix=${outputPrefix})`);
  const operationName = await triggerBatchProcess(gcsInputPath, outputPrefix);
  heartbeat(`Document AI LRO created: ${operationName}`);
  await pool.query(
    `UPDATE documents SET operation_id = $1, updated_at = NOW() WHERE id = $2`,
    [operationName, docId]
  );

  let done = false;
  let delay = 3000;
  const deadline = Date.now() + 20 * 60 * 1000;
  let pollCount = 0;
  let lastHeartbeatLog = Date.now();

  while (!done) {
    if (Date.now() > deadline) {
      throw new Error('Document AI OCR timed out after 20 minutes');
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 30_000);

    const { done: isDone, error } = await pollOperation(operationName);
    if (error) throw new Error(`Document AI LRO error: ${JSON.stringify(error)}`);
    done = isDone;
    pollCount += 1;
    const now = Date.now();
    if (!done) {
      const due = pollCount === 1 || now - lastHeartbeatLog >= 30_000;
      if (due) {
        lastHeartbeatLog = now;
        heartbeat(
          pollCount === 1
            ? `OCR LRO first poll: still processing (next wait ${delay / 1000}s, ~${Math.round((deadline - now) / 1000)}s until timeout)`
            : `OCR LRO still running (poll #${pollCount}, next wait ${delay / 1000}s, ~${Math.round((deadline - now) / 1000)}s until timeout)`
        );
      }
    }
  }

  lap(`OCR complete (${pollCount} poll(s))`);
  await pool.query(
    `UPDATE documents SET processing_status = 'ocr_completed', updated_at = NOW() WHERE id = $1`,
    [docId]
  );

  const files = await listOutputFiles(`ocr-output/${docId}/`);
  const jsonFiles = files
    .filter((f) => f.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!jsonFiles.length) throw new Error('No Document AI output JSON files found in GCS');

  const downloadedDocs = await Promise.all(jsonFiles.map((f) => downloadJsonFile(f)));
  lap(`Downloaded ${jsonFiles.length} shard(s)`);

  const shardResults = await Promise.all(
    downloadedDocs.map((docAIJson, i) =>
      new Promise((resolve) => {
        setImmediate(() => {
          const chunks = splitIntoChunks(parseDocumentAIJson(docAIJson));
          resolve({
            chunks,
            pages: (docAIJson.pages || []).length,
            path: `gs://${process.env.GCS_OUTPUT_BUCKET}/${jsonFiles[i].name}`,
          });
        });
      })
    )
  );

  let allChunks = [];
  let totalPages = 0;
  let ocrPath = null;

  for (const shard of shardResults) {
    totalPages += shard.pages;
    if (!ocrPath) ocrPath = shard.path;
    const offset = allChunks.length;
    allChunks = allChunks.concat(
      shard.chunks.map((c) => ({ ...c, chunk_index: c.chunk_index + offset }))
    );
  }

  lap(`Parsed ${allChunks.length} chunks across ${shardResults.length} shard(s), ${totalPages} pages`);
  return { allChunks, totalPages, ocrPath };
}

// ─── Pipeline concurrency limiter ─────────────────────────────────────────────
// Caps parallel pipelines so the DB pool (max 10) and GCP quotas are not exhausted.
const MAX_PIPELINES = 3;
let _running = 0;
const _queue = [];
const acquireSlot = () => new Promise((resolve) => {
  if (_running < MAX_PIPELINES) { _running++; resolve(); }
  else _queue.push(resolve);
});
const releaseSlot = () => {
  if (_queue.length) { _queue.shift()(); }
  else _running--;
};

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
      success:        true,
      signed_url:     signedUrl,
      gcs_input_path: gcsInputPath,
      document_id:    rows[0].id,
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

    // Fire-and-forget: pipeline runs in background, semaphore controls concurrency
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
  const t0 = Date.now();
  const lap = (label) =>
    console.log(`⏱  [doc:${docId}] ${label} (+${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const heartbeat = (msg) => {
    // stderr is often less buffered than stdout when the process is not a TTY (e.g. some Docker/PM2 setups)
    console.error(`[doc:${docId}] ${msg}`);
  };

  heartbeat('Pipeline scheduled — waiting for concurrency slot (max 3 parallel)…');
  await acquireSlot();
  heartbeat('Slot acquired — starting document processing');

  try {
    await pool.query(
      `UPDATE documents SET processing_status = 'ocr_processing', updated_at = NOW() WHERE id = $1`,
      [docId]
    );
    lap('DB status set to ocr_processing');

    const missing = ['GCLOUD_PROJECT_ID', 'DOCUMENT_AI_LOCATION', 'DOCUMENT_AI_PROCESSOR_ID', 'DOCUMENT_AI_OCR_VERSION', 'GCS_OUTPUT_BUCKET']
      .filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
    if (missing.length) {
      throw new Error(
        `Missing Document AI / GCS env: ${missing.join(', ')}. (Docs may name OCR version DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID — this app expects DOCUMENT_AI_OCR_VERSION.)`
      );
    }

    // ── OCR: parallel per-page processDocument (default for .pdf) or GCS batch LRO ──
    const useBatchOnly = process.env.DOCUMENT_AI_USE_BATCH_OCR === 'true';
    const isPdfPath = /\.pdf$/i.test(gcsInputPath);

    let allChunks;
    let totalPages;
    let ocrPath;

    if (!useBatchOnly && isPdfPath) {
      try {
        heartbeat('Using parallel small-batch Document AI OCR + merged chunking');
        await pool.query(
          `UPDATE documents SET operation_id = $1, updated_at = NOW() WHERE id = $2`,
          ['parallel-batch-ocr', docId]
        );
        const parallel = await ocrPdfToChunks(gcsInputPath, { heartbeat, lap, docId });
        allChunks = parallel.chunks;
        totalPages = parallel.totalPages;
        ocrPath = parallel.gcsOcrPath;
        await pool.query(
          `UPDATE documents SET processing_status = 'ocr_completed', updated_at = NOW() WHERE id = $1`,
          [docId]
        );
      } catch (parallelErr) {
        heartbeat(`Parallel batch OCR skipped (${parallelErr.message}) — using batch Document AI`);
        ({ allChunks, totalPages, ocrPath } = await runBatchOcrToChunks(docId, gcsInputPath, heartbeat, lap));
      }
    } else {
      ({ allChunks, totalPages, ocrPath } = await runBatchOcrToChunks(docId, gcsInputPath, heartbeat, lap));
    }

    await pool.query(
      `UPDATE documents SET total_pages = $1, gcs_ocr_path = $2,
       processing_status = 'embedding_processing', updated_at = NOW() WHERE id = $3`,
      [totalPages, ocrPath, docId]
    );

    // ── Step 5: Bulk INSERT chunks (single unnest call) ───────────────────
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

    const chunkIdByIndex = {};
    for (const row of insertedChunks) chunkIdByIndex[row.chunk_index] = row.id;
    lap('Chunks inserted into DB');

    // ── Step 6: Batch embed — 100 texts/call, 5 parallel calls ───────────
    console.log(`⚡ [doc:${docId}] Embedding ${allChunks.length} chunks (batch REST, 100/call, 5 parallel)…`);
    const allVectors = await getBatchEmbeddings(
      allChunks.map((c) => c.content),
      100,
      5
    );
    lap(`Embeddings generated (${allVectors.length})`);

    // ── Step 7: Bulk INSERT embeddings (unnest — no param-count limit) ────
    const chunkIds   = allChunks.map((c) => chunkIdByIndex[c.chunk_index]);
    const vectorStrs = allVectors.map((v) => `[${v.join(',')}]`);

    await pool.query(
      `INSERT INTO chunk_embeddings (chunk_id, embedding, task_type, model_name)
       SELECT unnest($1::uuid[]), unnest($2::text[])::vector, 'RETRIEVAL_DOCUMENT', 'gemini-embedding-2'`,
      [chunkIds, vectorStrs]
    );
    lap('Embeddings inserted into DB');

    // ── Step 8: Mark document active ──────────────────────────────────────
    await pool.query(
      `UPDATE documents SET processing_status = 'active', total_chunks = $1,
       ready_for_chat = TRUE, updated_at = NOW() WHERE id = $2`,
      [allChunks.length, docId]
    );

    const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `✅ [doc:${docId}] Pipeline complete in ${totalSec}s — ${allChunks.length} chunks, ${totalPages} pages`
    );
  } catch (err) {
    console.error(`❌ [doc:${docId}] Pipeline error:`, err.message);
    await pool
      .query(
        `UPDATE documents SET processing_status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [err.message, docId]
      )
      .catch(() => {});
  } finally {
    releaseSlot();
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

// ─── Startup Recovery (Cloud Run scale-to-zero safe) ─────────────────────────
// Cloud Run can kill instances mid-pipeline. On startup this finds any document
// stuck in an intermediate state for >15 min and re-queues it from scratch.
const recoverStuckDocuments = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT id, gcs_input_path FROM documents
       WHERE processing_status IN ('ocr_processing', 'embedding_processing', 'ocr_completed')
       AND updated_at < NOW() - INTERVAL '15 minutes'`
    );
    if (!rows.length) {
      console.log('✅ No stuck documents found on startup.');
      return;
    }
    console.log(`🔄 Found ${rows.length} stuck document(s) — recovering…`);
    for (const doc of rows) {
      // Clear partial chunks/embeddings (CASCADE deletes embeddings too)
      await pool.query(`DELETE FROM document_chunks WHERE document_id = $1`, [doc.id]);
      await pool.query(
        `UPDATE documents SET processing_status = 'uploaded', operation_id = NULL,
         error_message = NULL, total_chunks = 0, ready_for_chat = FALSE, updated_at = NOW()
         WHERE id = $1`,
        [doc.id]
      );
      runProcessingPipeline(doc.id, doc.gcs_input_path).catch((err) =>
        console.error(`❌ Recovery pipeline failed for doc ${doc.id}:`, err.message)
      );
    }
    console.log(`🔄 ${rows.length} document(s) queued for recovery.`);
  } catch (err) {
    console.error('❌ Document recovery check failed:', err.message);
  }
};

module.exports = {
  generateSignedUrlHandler,
  processDocumentHandler,
  listDocumentsHandler,
  getDocumentHandler,
  deleteDocumentHandler,
  recoverStuckDocuments,
};
