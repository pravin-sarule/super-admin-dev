const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;

// Singleton — recreating the gRPC client on every poll causes auth hangs
let _client = null;
const getDocAIClient = () => {
  if (_client) return _client;
  const keyBase64 = process.env.GCS_KEY_BASE64;
  if (!keyBase64) throw new Error('GCS_KEY_BASE64 environment variable is not set');
  const credentials = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'));
  _client = new DocumentProcessorServiceClient({ credentials });
  return _client;
};

const buildProcessorVersionName = () => {
  const projectId = process.env.GCLOUD_PROJECT_ID;
  const location = process.env.DOCUMENT_AI_LOCATION;
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
  const processorVersion = process.env.DOCUMENT_AI_OCR_VERSION;
  return `projects/${projectId}/locations/${location}/processors/${processorId}/processorVersions/${processorVersion}`;
};

/**
 * Online processDocument — one PDF per call (used for parallel per-page OCR).
 * Returns a plain JSON-like document matching batch output shape for chunking.
 */
const processDocumentRaw = async (pdfBuffer) => {
  const client = getDocAIClient();
  const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  const [result] = await client.processDocument({
    name: buildProcessorVersionName(),
    rawDocument: { content: buf, mimeType: 'application/pdf' },
  });
  const doc = result.document;
  if (!doc) throw new Error('Document AI processDocument returned an empty document');
  return typeof doc.toJSON === 'function' ? doc.toJSON() : JSON.parse(JSON.stringify(doc));
};

/**
 * Trigger a Document AI batchProcessDocuments LRO.
 * Returns the GCP operation name (used to poll for completion).
 */
const triggerBatchProcess = async (gcsInputPath, gcsOutputPrefix) => {
  const client = getDocAIClient();
  const processorName = buildProcessorVersionName();

  const request = {
    name: processorName,
    inputDocuments: {
      gcsDocuments: {
        documents: [{ gcsUri: gcsInputPath, mimeType: 'application/pdf' }],
      },
    },
    documentOutputConfig: {
      gcsOutputConfig: { gcsUri: gcsOutputPrefix },
    },
  };

  const [operation] = await client.batchProcessDocuments(request);
  return operation.name;
};

/**
 * Poll an LRO by operation name with automatic retry on transient errors.
 * Returns { done, error }.
 */
const pollOperation = async (operationName, maxRetries = 3) => {
  const client = getDocAIClient();
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const [operation] = await client.operationsClient.getOperation({ name: operationName });
      return { done: Boolean(operation.done), error: operation.error || null };
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        console.warn(
          `[Document AI] getOperation transient error (attempt ${attempt + 1}/${maxRetries}): ${err.message}`
        );
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
};

module.exports = { triggerBatchProcess, pollOperation, processDocumentRaw };
