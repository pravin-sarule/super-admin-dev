const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;

const getDocAIClient = () => {
  const keyBase64 = process.env.GCS_KEY_BASE64;
  if (!keyBase64) throw new Error('GCS_KEY_BASE64 environment variable is not set');
  const credentials = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'));
  return new DocumentProcessorServiceClient({ credentials });
};

/**
 * Trigger a Document AI batchProcessDocuments LRO.
 * Returns the GCP operation name (used to poll for completion).
 */
const triggerBatchProcess = async (gcsInputPath, gcsOutputPrefix) => {
  const client = getDocAIClient();
  const projectId = process.env.GCLOUD_PROJECT_ID;
  const location = process.env.DOCUMENT_AI_LOCATION;
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
  const processorVersion = process.env.DOCUMENT_AI_OCR_VERSION;

  const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}/processorVersions/${processorVersion}`;

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
 * Poll an LRO by operation name.
 * Returns { done, error }.
 */
const pollOperation = async (operationName) => {
  const client = getDocAIClient();
  const [operation] = await client.operationsClient.getOperation({ name: operationName });
  return { done: Boolean(operation.done), error: operation.error || null };
};

module.exports = { triggerBatchProcess, pollOperation };
