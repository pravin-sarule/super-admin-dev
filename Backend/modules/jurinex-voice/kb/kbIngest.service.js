/**
 * Jurinex Voice ingestion pipeline.
 *
 *   1. Load kb_documents row
 *   2. Read file bytes from GCS (or use raw_text for `manual` source)
 *   3. Extract text (PDF / DOCX / TXT / MD)
 *   4. Chunk with KB_CHUNK_TOKENS / KB_CHUNK_OVERLAP
 *   5. Embed chunks via Google text-embedding-004
 *   6. Insert kb_chunks in batches
 *   7. Mark document `ready` (or `failed`)
 *
 * On failure the document is marked `failed`, an error message is stored,
 * a `voice_debug_events` row is written, and the server keeps running.
 */

const { downloadFileFromGcs } = require('../gcs/gcsStorage.service');
const { extractText, detectSourceType } = require('./textExtraction');
const { chunkText, approxTokens } = require('./chunking');
const {
  embedDocuments,
  toVectorLiteral,
  EMBEDDING_MODEL,
  EMBEDDING_DIM,
} = require('./embeddings');
const repo = require('./kb.repository');
const dataflow = require('../observability/dataflowLogger');
const voiceLogger = require('../observability/voiceLogger');

const processDocument = async (documentId) => {
  const startedAt = Date.now();
  let stage = 'load';
  let agent_id = null;

  try {
    const doc = await repo.getDocument(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);
    agent_id = doc.agent_id;

    await dataflow.logIngestStarted({ document_id: doc.id, agent_id: doc.agent_id });

    // 1. Load text — either already supplied (upload-text), or fetch from GCS.
    let rawText = doc.raw_text || '';
    let sourceType = doc.source_type;

    if (!rawText && doc.gcs_object_name && doc.gcs_bucket) {
      stage = 'download';
      const buffer = await downloadFileFromGcs(doc.gcs_bucket, doc.gcs_object_name);

      stage = 'extract';
      const extracted = await extractText(buffer, {
        filename: doc.original_filename,
        contentType: doc.content_type,
      });
      rawText = extracted.text;
      sourceType = sourceType || extracted.sourceType;
    } else if (!sourceType) {
      sourceType = detectSourceType(doc.original_filename, doc.content_type);
    }

    if (!rawText || !rawText.trim()) {
      throw new Error('No text content extracted from document');
    }

    await dataflow.logTextExtracted({
      document_id: doc.id,
      char_count: rawText.length,
      source_type: sourceType,
    });

    // 2. Chunk
    stage = 'chunk';
    const chunks = chunkText(rawText, {
      chunkTokens: Number(process.env.KB_CHUNK_TOKENS) || 500,
      chunkOverlap: Number(process.env.KB_CHUNK_OVERLAP) || 50,
    });

    if (!chunks.length) {
      throw new Error('Chunking produced 0 chunks');
    }

    const totalTokens = chunks.reduce((acc, c) => acc + (c.token_count || 0), 0);
    await dataflow.logChunksCreated({
      document_id: doc.id,
      chunk_count: chunks.length,
      token_count: totalTokens,
    });

    // 3. Embed
    stage = 'embed';
    const vectors = await embedDocuments(chunks.map((c) => c.text));
    if (vectors.length !== chunks.length) {
      throw new Error(
        `Embedding count mismatch: got ${vectors.length}, expected ${chunks.length}`
      );
    }

    await dataflow.logEmbeddingsCreated({
      document_id: doc.id,
      chunk_count: vectors.length,
      model: EMBEDDING_MODEL,
      dim: EMBEDDING_DIM,
    });

    // 4. Insert chunks
    stage = 'persist';
    await repo.deleteChunksFor(doc.id); // idempotent for re-index
    const enriched = chunks.map((c, i) => ({
      ...c,
      embeddingLiteral: toVectorLiteral(vectors[i]),
    }));
    await repo.insertChunks(doc.id, enriched);

    // 5. Finalize
    stage = 'finalize';
    await repo.updateDocument(doc.id, {
      status: 'ready',
      error_message: null,
      chunk_count: chunks.length,
      token_count: totalTokens,
      raw_text: rawText.length > 200_000 ? rawText.slice(0, 200_000) : rawText,
      source_type: sourceType,
      embedding_model: EMBEDDING_MODEL,
      embedding_dim: EMBEDDING_DIM,
    });

    await dataflow.logDocumentReady({
      document_id: doc.id,
      agent_id: doc.agent_id,
      chunk_count: chunks.length,
    });

    voiceLogger.info('processDocument complete', {
      summary: {
        document_id: doc.id,
        chunks: chunks.length,
        latencyMs: Date.now() - startedAt,
      },
    });

    return { ok: true, document_id: doc.id, chunks: chunks.length };
  } catch (err) {
    const message = err?.message || String(err);
    voiceLogger.errorWithContext(`processDocument failed at stage=${stage}`, err, {
      summary: { document_id: documentId, stage },
    });
    try {
      await repo.updateDocument(documentId, {
        status: 'failed',
        error_message: `[${stage}] ${message}`.slice(0, 1000),
      });
    } catch (innerErr) {
      voiceLogger.error('Failed to mark document as failed', {
        summary: { document_id: documentId, error: innerErr.message },
      });
    }
    await dataflow.logDocumentFailed({
      document_id: documentId,
      agent_id,
      stage,
      error: message,
    });
    return { ok: false, document_id: documentId, error: message };
  }
};

module.exports = { processDocument };
