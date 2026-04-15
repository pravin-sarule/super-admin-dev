const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { bucket, bucketName, storage } = require('../config/gcs');
const { uploadBuffer } = require('./storageService');
require('dotenv').config();
const { createLogger } = require('../utils/logger');

let documentAIClient;
const logger = createLogger('DocumentAI');
const OCR_MODE = String(process.env.DOCUMENT_AI_OCR_MODE || 'auto').trim().toLowerCase();
const ASYNC_MIN_BATCHES = Math.max(1, Number(process.env.DOCUMENT_AI_ASYNC_MIN_BATCHES || 12));
const ASYNC_MIN_PAGES = Math.max(1, Number(process.env.DOCUMENT_AI_ASYNC_MIN_PAGES || 180));
const ASYNC_OUTPUT_DOWNLOAD_CONCURRENCY = Math.max(
  1,
  Number(process.env.DOCUMENT_AI_ASYNC_OUTPUT_CONCURRENCY || 8)
);
const DOCUMENT_AI_OPERATION_TIMEOUT_MS = Math.max(
  60000,
  Number(process.env.DOCUMENT_AI_OPERATION_TIMEOUT_MS || 900000)
);

function decodeServiceAccount() {
  const base64Key = process.env.GCS_KEY_BASE64;

  if (!base64Key) {
    throw new Error('GCS_KEY_BASE64 is not set');
  }

  const cleaned = String(base64Key)
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/\s/g, '');

  return JSON.parse(Buffer.from(cleaned, 'base64').toString('utf8'));
}

function documentAiEndpoint() {
  const location = String(process.env.DOCUMENT_AI_LOCATION || 'us').trim();
  return `${location}-documentai.googleapis.com`;
}

function getClient() {
  if (documentAIClient) return documentAIClient;

  try {
    const credentials = decodeServiceAccount();
    const tempFilePath = path.join(os.tmpdir(), 'judgement-service-document-ai-key.json');
    fs.writeFileSync(tempFilePath, JSON.stringify(credentials, null, 2), 'utf8');

    documentAIClient = new DocumentProcessorServiceClient({
      keyFilename: tempFilePath,
      apiEndpoint: documentAiEndpoint(),
    });
  } catch (error) {
    logger.warn('Falling back to GOOGLE_APPLICATION_CREDENTIALS', {
      reason: error.message,
    });
    documentAIClient = new DocumentProcessorServiceClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      apiEndpoint: documentAiEndpoint(),
    });
  }

  return documentAIClient;
}

function processorName() {
  const projectId = process.env.GCLOUD_PROJECT_ID || process.env.GCS_PROJECT_ID;
  const location = String(process.env.DOCUMENT_AI_LOCATION || 'us').trim();
  const processorId = String(process.env.DOCUMENT_AI_PROCESSOR_ID || '').trim();
  const versionId = String(process.env.DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID || '').trim();

  if (!projectId || !processorId) {
    throw new Error('GCLOUD_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID are required');
  }

  const base = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  return versionId ? `${base}/processorVersions/${versionId}` : base;
}

function textFromAnchor(textAnchor, fullText) {
  if (!textAnchor?.textSegments?.length || !fullText) return '';

  return textAnchor.textSegments
    .map((segment) => {
      const start = Number(segment.startIndex || 0);
      const end = Number(segment.endIndex || 0);
      return fullText.slice(start, end);
    })
    .join('');
}

function average(values = []) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function parseGcsUri(uri) {
  const match = String(uri || '').match(/^gs:\/\/([^/]+)\/?(.*)$/);

  if (!match) {
    throw new Error(`Invalid GCS URI: ${uri}`);
  }

  return {
    bucket: match[1],
    prefix: String(match[2] || '').replace(/^\/+/, ''),
  };
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

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise,
  ]);
}

function extractPages(document) {
  const fullText = document?.text || '';
  const pages = Array.isArray(document?.pages) ? document.pages : [];

  return pages.map((page, index) => {
    const pageText =
      textFromAnchor(page.layout?.textAnchor, fullText) ||
      (Array.isArray(page.blocks)
        ? page.blocks.map((block) => textFromAnchor(block.layout?.textAnchor, fullText)).join('\n')
        : '');

    const confidences = Array.isArray(page.blocks)
      ? page.blocks.map((block) => block.confidence).filter((value) => value != null)
      : [];

    return {
      pageNumber: page.pageNumber || index + 1,
      text: String(pageText || '').trim(),
      confidence: average(confidences),
    };
  });
}

function resolveOcrMode({ batchCount, pageCount }) {
  if (OCR_MODE === 'sync' || OCR_MODE === 'async') {
    return OCR_MODE;
  }

  if (batchCount >= ASYNC_MIN_BATCHES || pageCount >= ASYNC_MIN_PAGES) {
    return 'async';
  }

  return 'sync';
}

async function listOutputJsonFiles(outputGcsUri) {
  const parsed = parseGcsUri(outputGcsUri);
  const targetBucket = parsed.bucket === bucketName ? bucket : storage.bucket(parsed.bucket);
  const [files] = await targetBucket.getFiles({
    prefix: parsed.prefix,
  });

  return files
    .filter((file) => !file.name.endsWith('/') && file.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function downloadDocumentJson(file) {
  const [contents] = await file.download();
  return JSON.parse(contents.toString('utf8'));
}

async function processBatchPdf(batchBuffer) {
  const client = getClient();
  logger.step('Submitting OCR batch to Document AI', {
    processor: processorName(),
    sizeBytes: batchBuffer?.length || 0,
  });
  const request = {
    name: processorName(),
    rawDocument: {
      content: batchBuffer.toString('base64'),
      mimeType: 'application/pdf',
    },
  };

  try {
    const [result] = await client.processDocument(request);
    const document = result.document || {};
    const extractedPages = extractPages(document);

    logger.info('Document AI OCR batch complete', {
      pages: extractedPages.length,
      totalChars: (document.text || '').length,
    });

    return {
      mode: 'sync',
      rawResult: result,
      pages: extractedPages,
      pageCount: extractedPages.length,
    };
  } catch (error) {
    logger.error('Document AI OCR batch failed', error, {
      sizeBytes: batchBuffer?.length || 0,
    });
    throw error;
  }
}

async function processBatchPdfsAsync(batchDocuments, { documentId } = {}) {
  const client = getClient();
  const operationId = uuidv4();
  const outputPrefix = `judgements/ocr-output/${documentId || operationId}/${operationId}`;

  logger.step('Submitting async OCR batches to Document AI', {
    processor: processorName(),
    documentId: documentId || null,
    batchCount: batchDocuments.length,
    totalPages: batchDocuments.reduce((sum, batch) => sum + batch.pageNumbers.length, 0),
    outputPrefix,
  });

  const uploadedInputs = await mapWithConcurrency(
    batchDocuments,
    Math.min(ASYNC_OUTPUT_DOWNLOAD_CONCURRENCY, batchDocuments.length),
    async (batchDocument) => {
      const stored = await uploadBuffer(
        batchDocument.buffer,
        `judgements/ocr-input/${documentId || operationId}/batch-${String(batchDocument.batchNumber).padStart(3, '0')}.pdf`,
        'application/pdf'
      );

      return {
        ...batchDocument,
        inputUri: stored.uri,
      };
    }
  );

  const request = {
    name: processorName(),
    inputDocuments: {
      gcsDocuments: {
        documents: uploadedInputs.map((input) => ({
          gcsUri: input.inputUri,
          mimeType: 'application/pdf',
        })),
      },
    },
    documentOutputConfig: {
      gcsOutputConfig: {
        gcsUri: `gs://${bucketName}/${outputPrefix}/`,
      },
    },
    skipHumanReview: true,
  };

  try {
    const [operation] = await client.batchProcessDocuments(request);
    const operationResponse = await withTimeout(
      operation.promise(),
      DOCUMENT_AI_OPERATION_TIMEOUT_MS,
      `Document AI async batch timed out after ${DOCUMENT_AI_OPERATION_TIMEOUT_MS}ms`
    );
    const metadata =
      operationResponse?.[1] ||
      operation.metadata ||
      operation.latestResponse?.metadata ||
      {};
    const individualStatuses =
      metadata?.individualProcessStatuses ||
      metadata?.individual_process_statuses ||
      [];

    const batches = await mapWithConcurrency(
      uploadedInputs,
      Math.min(ASYNC_OUTPUT_DOWNLOAD_CONCURRENCY, uploadedInputs.length),
      async (input) => {
        const status = individualStatuses.find((item) => {
          const source = item?.inputGcsSource || item?.input_gcs_source || '';
          return source === input.inputUri;
        }) || null;

        if ((status?.status?.code || 0) !== 0) {
          throw new Error(
            status?.status?.message ||
            `Document AI async OCR failed for batch ${input.batchNumber}`
          );
        }

        const outputGcsDestination =
          status?.outputGcsDestination ||
          status?.output_gcs_destination ||
          `gs://${bucketName}/${outputPrefix}/`;
        const outputFiles = await listOutputJsonFiles(outputGcsDestination);

        if (!outputFiles.length) {
          throw new Error(`Document AI produced no JSON output for batch ${input.batchNumber}`);
        }

        const outputDocuments = await mapWithConcurrency(
          outputFiles,
          ASYNC_OUTPUT_DOWNLOAD_CONCURRENCY,
          downloadDocumentJson
        );

        const pages = outputDocuments
          .flatMap((document) => extractPages(document))
          .sort((left, right) => left.pageNumber - right.pageNumber);

        return {
          batchNumber: input.batchNumber,
          pageNumbers: input.pageNumbers,
          pages,
          rawResult: {
            mode: 'async_batch',
            inputGcsSource: input.inputUri,
            outputGcsDestination,
            outputFiles: outputFiles.map((file) => `gs://${file.bucket.name}/${file.name}`),
            status,
          },
        };
      }
    );

    logger.info('Document AI async OCR batches complete', {
      documentId: documentId || null,
      batchCount: batches.length,
      totalPages: batches.reduce((sum, batch) => sum + batch.pages.length, 0),
    });

    return {
      mode: 'async',
      batches,
      operationMetadata: {
        state: metadata?.state || null,
        stateMessage: metadata?.stateMessage || null,
        batchCount: batches.length,
        operationName: operation.latestResponse?.name || null,
      },
    };
  } catch (error) {
    logger.error('Document AI async OCR batches failed', error, {
      documentId: documentId || null,
      batchCount: batchDocuments.length,
    });
    throw error;
  }
}

module.exports = {
  processBatchPdf,
  processBatchPdfsAsync,
  resolveOcrMode,
};
