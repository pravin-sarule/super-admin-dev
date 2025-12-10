/**
 * Document AI Service
 * Handles text extraction from PDFs using Google Cloud Document AI
 */

const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
require('dotenv').config();

let documentAIClient;

// Setup Document AI client from base64 key
function setupDocumentAIClient() {
  try {
    const base64Key = process.env.GCS_KEY_BASE64;
    if (!base64Key) throw new Error('GCS_KEY_BASE64 is not set');

    const cleanedBase64 = base64Key.replace(/^["']|["']$/g, '').trim().replace(/\s/g, '');
    const keyJson = Buffer.from(cleanedBase64, 'base64').toString('utf8');
    const keyObject = JSON.parse(keyJson);

    if (!keyObject.private_key || !keyObject.client_email || !keyObject.project_id) {
      throw new Error('Invalid GCP key structure');
    }

    const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
    fs.writeFileSync(tempFilePath, JSON.stringify(keyObject, null, 2), 'utf8');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

    documentAIClient = new DocumentProcessorServiceClient({
      keyFilename: tempFilePath,
    });
  } catch (error) {
    console.error('Error setting up Document AI client:', error.message);
    // Fallback to environment variable
    documentAIClient = new DocumentProcessorServiceClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
}

if (!documentAIClient) setupDocumentAIClient();

const PROJECT_ID = process.env.GCS_PROJECT_ID;
// Remove quotes if present in env variable
const LOCATION = (process.env.DOCUMENT_AI_LOCATION || 'us').replace(/^["']|["']$/g, '').trim();
const PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID ? 
  process.env.DOCUMENT_AI_PROCESSOR_ID.replace(/^["']|["']$/g, '').trim() : null;
const PROCESSOR_VERSION_ID = process.env.DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID ? 
  process.env.DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID.replace(/^["']|["']$/g, '').trim() : null;

// Debug logging
console.log('🔧 Document AI Configuration:');
console.log(`   PROJECT_ID: ${PROJECT_ID}`);
console.log(`   LOCATION: ${LOCATION}`);
console.log(`   PROCESSOR_ID: ${PROCESSOR_ID || 'not set (will use general-ocr)'}`);
console.log(`   PROCESSOR_VERSION_ID: ${PROCESSOR_VERSION_ID || 'not set'}`);

/**
 * Extract text from PDF buffer using Document AI
 * @param {Buffer} fileBuffer - PDF file buffer
 * @param {String} fileName - Original filename (for logging)
 * @returns {Object} Extraction result with text and metadata
 */
const extractTextFromPDF = async (fileBuffer, fileName = 'document.pdf') => {
  const startTime = Date.now();
  
  try {
    // Build processor name with optional version
    // Format: projects/{project}/locations/{location}/processors/{processor_id}
    // With version: projects/{project}/locations/{location}/processors/{processor_id}/processorVersions/{version_id}
    let processorName;
    
    if (!PROCESSOR_ID || PROCESSOR_ID === '') {
      // Use the general OCR processor if no processor ID is set
      processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/general-ocr`;
      console.log(`📄 Processing document with Document AI: ${fileName}`);
      console.log(`   ⚠️  Processor: general-ocr (default - PROCESSOR_ID not set)`);
      console.log(`   💡 Set DOCUMENT_AI_PROCESSOR_ID in .env to use a specific processor`);
    } else if (PROCESSOR_VERSION_ID && PROCESSOR_VERSION_ID !== '') {
      // Use specific processor version
      processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}/processorVersions/${PROCESSOR_VERSION_ID}`;
      console.log(`📄 Processing document with Document AI: ${fileName}`);
      console.log(`   Processor: ${PROCESSOR_ID}`);
      console.log(`   Version: ${PROCESSOR_VERSION_ID}`);
    } else {
      // Use latest processor version
      processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
      console.log(`📄 Processing document with Document AI: ${fileName}`);
      console.log(`   Processor: ${PROCESSOR_ID} (latest version)`);
    }

    // Prepare the request
    // Note: If using a specific processor, use processDocument
    // If using general OCR, you might need to use batchProcessDocuments or create a processor first
    const request = {
      name: processorName,
      rawDocument: {
        content: fileBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    // Process the document
    let result;
    try {
      [result] = await documentAIClient.processDocument(request);
    } catch (apiError) {
      // If processor doesn't exist, try using batchProcessDocuments or create processor
      if (apiError.code === 5 || apiError.message.includes('not found')) {
        console.warn(`⚠️  Processor ${processorName} not found. Trying alternative method...`);
        // For now, we'll throw a more helpful error
        throw new Error(
          `Document AI processor not found. Please create a processor in GCP Console or set DOCUMENT_AI_PROCESSOR_ID. ` +
          `Error: ${apiError.message}`
        );
      }
      throw apiError;
    }

    const document = result.document;
    if (!document) {
      throw new Error('Document AI returned no document data');
    }

    // Extract text
    const extractedText = document.text || '';
    
    // Calculate statistics
    const pageCount = document.pages ? document.pages.length : 0;
    const totalCharacters = extractedText.length;
    const totalWords = extractedText.split(/\s+/).filter(word => word.length > 0).length;
    const totalParagraphs = extractedText.split(/\n\n+/).filter(p => p.trim().length > 0).length;

    // Extract entities if available
    const entities = document.entities ? document.entities.map(entity => ({
      type: entity.type,
      mentionText: entity.mentionText,
      confidence: entity.confidence,
      normalizedValue: entity.normalizedValue,
    })) : [];

    // Extract form fields if available
    const formFields = document.formFields ? document.formFields.map(field => ({
      fieldName: field.fieldName?.textAnchor?.content || '',
      fieldValue: field.fieldValue?.textAnchor?.content || '',
      confidence: field.fieldName?.confidence || 0,
    })) : [];

    // Extract tables if available
    const tables = document.pages ? document.pages.flatMap((page, pageIndex) => 
      (page.tables || []).map((table, tableIndex) => ({
        pageIndex,
        tableIndex,
        rows: table.headerRows || 0,
        columns: table.bodyRows?.[0]?.cells?.length || 0,
      }))
    ) : [];

    // Calculate confidence scores
    const confidences = [];
    if (document.pages) {
      document.pages.forEach(page => {
        if (page.blocks) {
          page.blocks.forEach(block => {
            if (block.confidence) confidences.push(block.confidence);
          });
        }
      });
    }

    const averageConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : null;
    const minConfidence = confidences.length > 0 ? Math.min(...confidences) : null;
    const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : null;
    const confidenceScore = averageConfidence; // Use average as overall confidence

    // Generate hash for deduplication
    const extractedTextHash = crypto
      .createHash('sha256')
      .update(extractedText)
      .digest('hex');

    const processingDuration = Date.now() - startTime;

    console.log(`✅ Document AI processing completed in ${processingDuration}ms`);
    console.log(`   Extracted ${totalCharacters} characters, ${totalWords} words, ${pageCount} pages`);

    // Extract only the text from the document for raw_response storage
    const rawResponseText = extractedText || '';

    return {
      extractedText,
      extractedTextHash,
      pageCount,
      totalCharacters,
      totalWords,
      totalParagraphs,
      entities,
      formFields,
      tables,
      confidenceScore,
      averageConfidence,
      minConfidence,
      maxConfidence,
      processingDuration,
      documentAIProcessorId: PROCESSOR_ID || 'general-ocr',
      documentAIProcessorVersion: PROCESSOR_VERSION_ID || result.processorVersion || 'latest',
      documentAIOperationName: result.name || '',
      documentAIRequestId: result.requestId || '',
      rawResponse: rawResponseText, // Store only text, not full JSON
    };
  } catch (error) {
    const processingDuration = Date.now() - startTime;
    console.error(`❌ Document AI processing failed after ${processingDuration}ms:`, error.message);
    throw new Error(`Document AI extraction failed: ${error.message}`);
  }
};





module.exports = {
  extractTextFromPDF,
};

