const { v4: uuidv4 } = require('uuid');
const {
  uploadBuffer,
  uploadJson,
  downloadBuffer,
} = require('./storageService');
const {
  splitPdfIntoPages,
  mergePdfBuffers,
  extractTextFromPdfBuffer,
  normalizeWhitespace,
} = require('./pdfService');
const {
  processBatchPdf,
  processBatchPdfsAsync,
  resolveOcrMode,
} = require('./documentAiService');
const { extractMetadata } = require('./metadataService');
const { chunkTextSlidingWindow } = require('./chunkingService');
const { generateEmbeddings, EMBEDDING_MODEL } = require('./embeddingService');
const { indexJudgmentDocument } = require('./elasticsearchService');
const { upsertChunks, COLLECTION_NAME } = require('./qdrantService');
const repository = require('./judgementRepository');
const { createLogger } = require('../utils/logger');

const activeJobs = new Set();
const OCR_BATCH_SIZE = 15;
const OCR_BATCH_CONCURRENCY = Math.max(
  1,
  Number(process.env.OCR_BATCH_CONCURRENCY || 5)
);
const PAGE_CLASSIFICATION_CONCURRENCY = Math.max(
  1,
  Number(process.env.PAGE_CLASSIFICATION_CONCURRENCY || 4)
);
const PROCESSING_CONCURRENCY = Math.max(
  1,
  Number(process.env.JUDGEMENT_PROCESSING_CONCURRENCY || 3)
);
const processingQueue = [];
let activeProcessingJobs = 0;
const logger = createLogger('Pipeline');
const PIPELINE_STAGE_ORDER = {
  split_and_classify: 1,
  ocr_processing: 2,
  merge_text: 3,
  metadata_extract: 4,
  indexing: 5,
};

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function createPipelineMetrics(existingMetrics = {}) {
  return {
    startedAt: existingMetrics.startedAt || new Date().toISOString(),
    totalDurationMs: Number(existingMetrics.totalDurationMs || 0),
    ocrMode: existingMetrics.ocrMode || null,
    stages: existingMetrics.stages || {},
  };
}

function updatePipelineTotal(metrics) {
  const startedAt = new Date(metrics.startedAt || Date.now()).getTime();
  if (Number.isFinite(startedAt)) {
    metrics.totalDurationMs = Math.max(0, Date.now() - startedAt);
  }
}

function startPipelineStage(metrics, stageKey, label, details = null) {
  const startedAt = Date.now();
  metrics.stages[stageKey] = {
    ...(metrics.stages[stageKey] || {}),
    order: PIPELINE_STAGE_ORDER[stageKey] || 99,
    label,
    status: 'running',
    details,
    startedAt: new Date(startedAt).toISOString(),
  };
  updatePipelineTotal(metrics);
  return startedAt;
}

function finishPipelineStage(metrics, stageKey, startedAt, details = null, extra = {}) {
  const finishedAt = Date.now();
  const stage = metrics.stages[stageKey] || {};
  metrics.stages[stageKey] = {
    ...stage,
    order: stage.order || PIPELINE_STAGE_ORDER[stageKey] || 99,
    status: 'completed',
    details,
    durationMs: Math.max(0, finishedAt - startedAt),
    finishedAt: new Date(finishedAt).toISOString(),
    ...extra,
  };
  updatePipelineTotal(metrics);
}

function failPipelineStage(metrics, stageKey, startedAt, error, details = null) {
  const finishedAt = Date.now();
  const stage = metrics.stages[stageKey] || {};
  metrics.stages[stageKey] = {
    ...stage,
    order: stage.order || PIPELINE_STAGE_ORDER[stageKey] || 99,
    status: 'failed',
    details: details || error.message,
    durationMs: startedAt ? Math.max(0, finishedAt - startedAt) : stage.durationMs || 0,
    finishedAt: new Date(finishedAt).toISOString(),
    errorMessage: error.message,
  };
  updatePipelineTotal(metrics);
}

function serializePipelineMetrics(metrics) {
  return JSON.stringify(metrics || {});
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (!items.length) return [];

  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function classifyPages(documentId, originalFilename, pageDocuments) {
  logger.step('Classifying split PDF pages', {
    documentId,
    pageCount: pageDocuments.length,
    originalFilename,
    concurrency: PAGE_CLASSIFICATION_CONCURRENCY,
  });

  const pageRows = await mapWithConcurrency(
    pageDocuments,
    PAGE_CLASSIFICATION_CONCURRENCY,
    async (page) => {
      const destination = `judgements/pages/${documentId}/page-${String(page.pageNumber).padStart(4, '0')}.pdf`;
      const [storedPage, extracted] = await Promise.all([
        uploadBuffer(page.buffer, destination, 'application/pdf'),
        extractTextFromPdfBuffer(page.buffer),
      ]);

      return {
        pageId: uuidv4(),
        pageNumber: page.pageNumber,
        buffer: page.buffer,
        pageType: extracted.isDigitalText ? 'TEXT_PAGE' : 'OCR_REQUIRED',
        status: extracted.isDigitalText ? 'ocr_done' : 'ocr_required',
        textLength: extracted.text ? extracted.text.length : 0,
        textContent: extracted.isDigitalText && extracted.text ? extracted.text.replace(/\0/g, '') : null,
        gcsPagePath: storedPage.path,
        gcsPageUri: storedPage.uri,
        originalFilename,
      };
    }
  );

  await repository.replacePages(documentId, pageRows);
  logger.info('Page classification complete', {
    documentId,
    totalPages: pageRows.length,
    textPages: pageRows.filter((page) => page.pageType === 'TEXT_PAGE').length,
    ocrPages: pageRows.filter((page) => page.pageType === 'OCR_REQUIRED').length,
  });
  return pageRows;
}

async function runOcrBatches(documentId, pages) {
  const ocrPages = pages.filter((page) => page.pageType === 'OCR_REQUIRED');
  const batches = chunkArray(ocrPages, OCR_BATCH_SIZE);
  const ocrMode = resolveOcrMode({
    batchCount: batches.length,
    pageCount: ocrPages.length,
  });

  logger.step('Starting OCR batch processing', {
    documentId,
    ocrPages: ocrPages.length,
    batchCount: batches.length,
    batchSizeLimit: OCR_BATCH_SIZE,
    concurrency: OCR_BATCH_CONCURRENCY,
    mode: ocrMode,
  });

  if (ocrMode === 'async' && batches.length) {
    const batchDocuments = await mapWithConcurrency(
      batches,
      Math.min(OCR_BATCH_CONCURRENCY, batches.length),
      async (batch, batchIndex) => ({
        batchNumber: batchIndex + 1,
        pageNumbers: batch.map((page) => page.pageNumber),
        buffer: await mergePdfBuffers(batch.map((page) => page.buffer)),
      })
    );

    const asyncResult = await processBatchPdfsAsync(batchDocuments, { documentId });

    await Promise.all(asyncResult.batches.map(async (batchResult) => {
      const rawDestination = `judgements/ocr-raw/${documentId}/batch-${String(batchResult.batchNumber).padStart(3, '0')}.json`;
      const rawJson = await uploadJson(batchResult.rawResult, rawDestination);

      const batchPageNumbers = Array.isArray(batchResult.pageNumbers) ? batchResult.pageNumbers : [];
      const extractedPages = Array.isArray(batchResult.pages) ? batchResult.pages : [];

      if (!batchPageNumbers.length) {
        logger.warn('Async OCR batch returned without page mapping', {
          documentId,
          batchNumber: batchResult.batchNumber,
          extractedPages: extractedPages.length,
        });
      }

      if (batchPageNumbers.length !== extractedPages.length) {
        logger.warn('Async OCR batch page count mismatch', {
          documentId,
          batchNumber: batchResult.batchNumber,
          expectedPages: batchPageNumbers.length,
          extractedPages: extractedPages.length,
        });
      }

      await Promise.all(batchPageNumbers.map(async (pageNumber, pageOffset) => {
        const ocrPage = extractedPages[pageOffset] || {};
        const textContent = normalizeWhitespace(ocrPage.text || '');

        await repository.updatePage(documentId, pageNumber, {
          status: 'ocr_done',
          text_content: textContent,
          text_length: textContent.length,
          ocr_json_path: rawJson.path,
          ocr_json_uri: rawJson.uri,
          ocr_confidence: ocrPage.confidence || null,
        });
      }));

      logger.info('OCR batch complete', {
        documentId,
        batchNumber: batchResult.batchNumber,
        extractedPages: extractedPages.length,
        rawJsonPath: rawJson.path,
        mode: 'async',
      });
    }));

    return {
      ocrPageCount: ocrPages.length,
      batchCount: batches.length,
      mode: asyncResult.mode,
      operationMetadata: asyncResult.operationMetadata,
    };
  }

  await mapWithConcurrency(
    batches,
    OCR_BATCH_CONCURRENCY,
    async (batch, batchIndex) => {
      logger.flow('Processing OCR batch', {
        documentId,
        batchNumber: batchIndex + 1,
        batchSize: batch.length,
        pageNumbers: batch.map((page) => page.pageNumber),
      });

      const mergedPdf = await mergePdfBuffers(batch.map((page) => page.buffer));
      const ocrResult = await processBatchPdf(mergedPdf);
      const rawDestination = `judgements/ocr-raw/${documentId}/batch-${String(batchIndex + 1).padStart(3, '0')}.json`;
      const rawJson = await uploadJson(ocrResult.rawResult, rawDestination);

      await Promise.all(batch.map(async (page, pageOffset) => {
        const ocrPage = ocrResult.pages[pageOffset] || {};
        const textContent = normalizeWhitespace(ocrPage.text || '');

        await repository.updatePage(documentId, page.pageNumber, {
          status: 'ocr_done',
          text_content: textContent,
          text_length: textContent.length,
          ocr_json_path: rawJson.path,
          ocr_json_uri: rawJson.uri,
          ocr_confidence: ocrPage.confidence || null,
        });
      }));

      logger.info('OCR batch complete', {
        documentId,
        batchNumber: batchIndex + 1,
        extractedPages: ocrResult.pages.length,
        rawJsonPath: rawJson.path,
        mode: 'sync',
      });
    }
  );

  return {
    ocrPageCount: ocrPages.length,
    batchCount: batches.length,
    mode: 'sync',
  };
}

async function mergeFullText(documentId) {
  const pages = await repository.getPages(documentId);
  const orderedText = pages
    .sort((left, right) => left.page_number - right.page_number)
    .map((page) => normalizeWhitespace(page.text_content || ''))
    .filter(Boolean)
    .join('\n\n');

  logger.step('Merging ordered page text into judgment text', {
    documentId,
    pages: pages.length,
  });

  return {
    pages,
    fullText: orderedText.trim(),
  };
}

async function persistChunks(documentId, judgmentUuid, chunks) {
  await repository.replaceChunks(documentId, judgmentUuid, chunks, EMBEDDING_MODEL);
}

function buildQdrantPoints(chunks, vectors, metadata) {
  return chunks.map((chunk, index) => ({
    id: chunk.chunkId,
    vector: vectors[index],
    payload: {
      judgment_uuid: metadata.judgmentUuid,
      canonical_id: metadata.canonicalId,
      case_name: metadata.caseName,
      chunk_text: chunk.chunkText,
      chunk_index: chunk.chunkIndex,
      court_code: metadata.courtCode,
      year: metadata.year,
    },
  }));
}

async function processDocument({ documentId, fileBuffer = null }) {
  const upload = await repository.getUpload(documentId);
  if (!upload) {
    throw new Error(`Upload ${documentId} not found`);
  }

  if (activeJobs.has(documentId)) {
    return;
  }

  activeJobs.add(documentId);
  let pipelineStage = upload.status || 'uploaded';
  let lastProgressMessage = upload.lastProgressMessage || null;
  const pipelineMetrics = createPipelineMetrics(upload.pipelineMetrics);
  let currentMetricsStageKey = null;
  let currentStageStartedAt = null;

  try {
    logger.step('Pipeline started', {
      documentId,
      hasInlineBuffer: Boolean(fileBuffer),
      originalFilename: upload.originalFilename,
      sourceUrl: upload.sourceUrl,
      currentStatus: upload.status,
    });

    currentMetricsStageKey = 'split_and_classify';
    currentStageStartedAt = startPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      'Split and classify pages',
      'Downloading original PDF, splitting pages, and checking digital text'
    );

    await repository.updateUpload(documentId, {
      status: 'splitting',
      last_progress_message: 'Splitting PDF into single-page documents',
      error_message: null,
      processing_started_at: new Date(),
      pipeline_metrics: serializePipelineMetrics(pipelineMetrics),
    });
    pipelineStage = 'splitting';
    lastProgressMessage = 'Splitting PDF into single-page documents';

    const originalBuffer = fileBuffer || await downloadBuffer(upload.storagePath);
    logger.flow('Original PDF ready for processing', {
      documentId,
      sizeBytes: originalBuffer.length,
      storagePath: upload.storagePath,
    });
    const splitPages = await splitPdfIntoPages(originalBuffer);
    const classifiedPages = await classifyPages(documentId, upload.originalFilename, splitPages);
    finishPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      currentStageStartedAt,
      `${classifiedPages.length} pages classified`,
      {
        totalPages: classifiedPages.length,
        textPages: classifiedPages.filter((page) => page.pageType === 'TEXT_PAGE').length,
        ocrPages: classifiedPages.filter((page) => page.pageType === 'OCR_REQUIRED').length,
      }
    );

    currentMetricsStageKey = 'ocr_processing';
    currentStageStartedAt = startPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      'OCR processing',
      'Running Document AI OCR on scanned pages'
    );
    await repository.updateUpload(documentId, {
      total_pages: classifiedPages.length,
      text_pages_count: classifiedPages.filter((page) => page.pageType === 'TEXT_PAGE').length,
      ocr_pages_count: classifiedPages.filter((page) => page.pageType === 'OCR_REQUIRED').length,
      status: 'ocr_processing',
      last_progress_message: 'Running OCR batches for scanned pages',
      pipeline_metrics: serializePipelineMetrics(pipelineMetrics),
    });
    pipelineStage = 'ocr_processing';
    lastProgressMessage = 'Running OCR batches for scanned pages';

    const ocrSummary = await runOcrBatches(documentId, classifiedPages);
    pipelineMetrics.ocrMode = ocrSummary.mode || null;
    finishPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      currentStageStartedAt,
      `${ocrSummary.ocrPageCount} pages across ${ocrSummary.batchCount} batches via ${ocrSummary.mode || 'sync'} OCR`,
      {
        ocrPageCount: ocrSummary.ocrPageCount,
        batchCount: ocrSummary.batchCount,
        mode: ocrSummary.mode || 'sync',
      }
    );

    currentMetricsStageKey = 'merge_text';
    currentStageStartedAt = startPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      'Merge clean text',
      'Combining ordered page text into a single judgment text'
    );
    const merged = await mergeFullText(documentId);

    if (!merged.fullText) {
      throw new Error('No extractable text was produced from the uploaded PDF');
    }

    logger.info('Merged full text ready', {
      documentId,
      totalChars: merged.fullText.length,
      totalPages: merged.pages.length,
    });
    finishPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      currentStageStartedAt,
      `${merged.fullText.length} characters merged from ${merged.pages.length} pages`,
      {
        totalChars: merged.fullText.length,
        totalPages: merged.pages.length,
      }
    );

    currentMetricsStageKey = 'metadata_extract';
    currentStageStartedAt = startPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      'Extract metadata',
      'Extracting case identifiers, court, dates, and citations'
    );
    await repository.updateUpload(documentId, {
      status: 'metadata_extracting',
      ocr_batches_count: ocrSummary.batchCount,
      merged_text: merged.fullText,
      last_progress_message: 'Extracting judgment metadata and citations',
      pipeline_metrics: serializePipelineMetrics(pipelineMetrics),
    });
    pipelineStage = 'metadata_extracting';
    lastProgressMessage = 'Extracting judgment metadata and citations';

    const metadata = extractMetadata({
      fullText: merged.fullText,
      originalFilename: upload.originalFilename,
      sourceUrl: upload.sourceUrl,
    });
    logger.info('Metadata extracted', {
      documentId,
      canonicalId: metadata.canonicalId,
      caseName: metadata.caseName,
      courtCode: metadata.courtCode,
      year: metadata.year,
      judgmentDate: metadata.judgmentDate,
      citations: [metadata.primaryCitation, ...metadata.alternateCitations].filter(Boolean).length,
    });
    finishPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      currentStageStartedAt,
      `${[metadata.primaryCitation, ...metadata.alternateCitations].filter(Boolean).length} citations extracted`,
      {
        canonicalId: metadata.canonicalId,
        caseName: metadata.caseName,
      }
    );

    const existingJudgmentUuid = upload.judgmentUuid || uuidv4();
    const chunks = chunkTextSlidingWindow(merged.fullText, {
      chunkSize: 1200,
      overlap: 200,
    });
    logger.info('Sliding-window chunking complete', {
      documentId,
      judgmentUuid: existingJudgmentUuid,
      chunkSize: 1200,
      overlap: 200,
      chunkCount: chunks.length,
    });

    const initialJudgmentRow = await repository.upsertJudgment({
      judgmentUuid: existingJudgmentUuid,
      canonicalId: metadata.canonicalId,
      caseName: metadata.caseName,
      courtCode: metadata.courtCode,
      judgmentDate: metadata.judgmentDate,
      year: metadata.year,
      sourceType: 'admin-upload',
      verificationStatus: 'verified',
      confidenceScore: metadata.confidenceScore,
      esDocId: null,
      status: 'ocr_done',
      qdrantCollection: null,
      ocrInfo: {
        totalPages: merged.pages.length,
        textPages: classifiedPages.filter((page) => page.pageType === 'TEXT_PAGE').length,
        ocrPages: ocrSummary.ocrPageCount,
        ocrBatches: ocrSummary.batchCount,
      },
      citationData: {
        primary_citation: metadata.primaryCitation,
        alternate_citations: metadata.alternateCitations,
        source_url: metadata.sourceUrl,
      },
    });

    currentMetricsStageKey = 'indexing';
    currentStageStartedAt = startPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      'Index Elasticsearch and Qdrant',
      'Chunking, embedding, Elasticsearch indexing, and Qdrant upsert'
    );
    await repository.updateUpload(documentId, {
      judgment_uuid: initialJudgmentRow.judgment_uuid,
      canonical_id: metadata.canonicalId,
      metadata: JSON.stringify(metadata),
      status: 'indexing',
      last_progress_message: 'Indexing Elasticsearch and Qdrant',
      pipeline_metrics: serializePipelineMetrics(pipelineMetrics),
    });
    pipelineStage = 'indexing';
    lastProgressMessage = 'Indexing Elasticsearch and Qdrant';

    await repository.clearJudgmentArtifacts(documentId, initialJudgmentRow.judgment_uuid);
    await repository.replaceAliases(initialJudgmentRow.judgment_uuid, [
      metadata.primaryCitation,
      ...metadata.alternateCitations,
    ].filter(Boolean));
    await persistChunks(documentId, initialJudgmentRow.judgment_uuid, chunks);

    const elasticDocument = {
      judgment_uuid: initialJudgmentRow.judgment_uuid,
      canonical_id: metadata.canonicalId,
      case_name: metadata.caseName,
      court_code: metadata.courtCode,
      year: metadata.year,
      judgment_date: metadata.judgmentDate,
      source_url: metadata.sourceUrl,
      source_type: 'admin-upload',
      status: 'processed',
      citations: [metadata.primaryCitation, ...metadata.alternateCitations].filter(Boolean),
      full_text: merged.fullText,
    };

    const [esDocId, embeddingResponse] = await Promise.all([
      indexJudgmentDocument(elasticDocument),
      generateEmbeddings(chunks.map((chunk) => chunk.chunkText)),
    ]);
    const { vectors, model } = embeddingResponse;
    logger.info('Embeddings ready for Qdrant', {
      documentId,
      judgmentUuid: initialJudgmentRow.judgment_uuid,
      vectors: vectors.length,
      model,
    });
    const points = buildQdrantPoints(chunks, vectors, {
      judgmentUuid: initialJudgmentRow.judgment_uuid,
      canonicalId: metadata.canonicalId,
      caseName: metadata.caseName,
      courtCode: metadata.courtCode,
      year: metadata.year,
    });
    const qdrantCollection = await upsertChunks(points);
    await repository.markChunksIndexed(initialJudgmentRow.judgment_uuid);

    const judgmentRow = await repository.upsertJudgment({
      judgmentUuid: initialJudgmentRow.judgment_uuid,
      canonicalId: metadata.canonicalId,
      caseName: metadata.caseName,
      courtCode: metadata.courtCode,
      judgmentDate: metadata.judgmentDate,
      year: metadata.year,
      sourceType: 'admin-upload',
      verificationStatus: 'verified',
      confidenceScore: metadata.confidenceScore,
      esDocId,
      status: 'processed',
      qdrantCollection: qdrantCollection || COLLECTION_NAME,
      ocrInfo: {
        totalPages: merged.pages.length,
        textPages: classifiedPages.filter((page) => page.pageType === 'TEXT_PAGE').length,
        ocrPages: ocrSummary.ocrPageCount,
        ocrBatches: ocrSummary.batchCount,
      },
      citationData: {
        primary_citation: metadata.primaryCitation,
        alternate_citations: metadata.alternateCitations,
        source_url: metadata.sourceUrl,
      },
    });
    finishPipelineStage(
      pipelineMetrics,
      currentMetricsStageKey,
      currentStageStartedAt,
      `${chunks.length} chunks indexed into Elasticsearch and Qdrant`,
      {
        chunkCount: chunks.length,
        esDocId,
        qdrantCollection: qdrantCollection || COLLECTION_NAME,
      }
    );

    await repository.updateUpload(documentId, {
      judgment_uuid: judgmentRow.judgment_uuid,
      canonical_id: metadata.canonicalId,
      es_doc_id: esDocId,
      qdrant_collection: qdrantCollection || COLLECTION_NAME,
      metadata: JSON.stringify(metadata),
      status: 'completed',
      last_progress_message: 'Judgment OCR and indexing completed',
      processing_completed_at: new Date(),
      error_message: null,
      pipeline_metrics: serializePipelineMetrics(pipelineMetrics),
    });

    logger.info('Pipeline completed successfully', {
      documentId,
      judgmentUuid: judgmentRow.judgment_uuid,
      canonicalId: metadata.canonicalId,
      esDocId,
      qdrantCollection: qdrantCollection || COLLECTION_NAME,
      chunkCount: chunks.length,
    });
    logger.info('Pipeline timing summary', {
      documentId,
      totalDurationMs: pipelineMetrics.totalDurationMs,
      ocrMode: pipelineMetrics.ocrMode,
      stages: Object.fromEntries(
        Object.entries(pipelineMetrics.stages || {}).map(([stageKey, stage]) => [
          stageKey,
          {
            durationMs: stage.durationMs || 0,
            status: stage.status || 'completed',
          },
        ])
      ),
    });
  } catch (error) {
    if (currentMetricsStageKey) {
      failPipelineStage(
        pipelineMetrics,
        currentMetricsStageKey,
        currentStageStartedAt,
        error,
        lastProgressMessage || error.message
      );
    }
    logger.error('Pipeline failed', error, {
      documentId,
      originalFilename: upload.originalFilename,
      currentStatus: pipelineStage,
      lastProgressMessage,
      totalDurationMs: pipelineMetrics.totalDurationMs,
    });
    await repository.updateUpload(documentId, {
      status: 'failed',
      error_message: error.message,
      last_progress_message: lastProgressMessage || 'Processing failed',
      processing_completed_at: new Date(),
      pipeline_metrics: serializePipelineMetrics(pipelineMetrics),
    });
  } finally {
    activeJobs.delete(documentId);
  }
}

function drainProcessingQueue() {
  while (activeProcessingJobs < PROCESSING_CONCURRENCY && processingQueue.length) {
    const payload = processingQueue.shift();
    activeProcessingJobs += 1;

    logger.flow('Starting queued processing job', {
      documentId: payload.documentId,
      hasInlineBuffer: Boolean(payload.fileBuffer),
      activeProcessingJobs,
      queuedJobsRemaining: processingQueue.length,
      processingConcurrency: PROCESSING_CONCURRENCY,
    });

    setImmediate(() => {
      processDocument(payload)
        .catch((error) => {
          logger.error('Background processing crashed', error, {
            documentId: payload.documentId,
          });
        })
        .finally(() => {
          activeProcessingJobs = Math.max(0, activeProcessingJobs - 1);

          logger.flow('Queued processing job finished', {
            documentId: payload.documentId,
            activeProcessingJobs,
            queuedJobsRemaining: processingQueue.length,
            processingConcurrency: PROCESSING_CONCURRENCY,
          });

          drainProcessingQueue();
        });
    });
  }
}

function queueProcessing(payload) {
  logger.flow('Queueing background processing job', {
    documentId: payload.documentId,
    hasInlineBuffer: Boolean(payload.fileBuffer),
    activeProcessingJobs,
    queuedJobsBeforePush: processingQueue.length,
    processingConcurrency: PROCESSING_CONCURRENCY,
  });
  processingQueue.push(payload);
  drainProcessingQueue();
}

module.exports = {
  processDocument,
  queueProcessing,
};
