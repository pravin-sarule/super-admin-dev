const pdfParseModule = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PDF');
const PDFParseClass = pdfParseModule?.PDFParse || null;

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\0/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function isTextPage(text) {
  const normalized = normalizeWhitespace(text);
  const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;
  return normalized.length >= 80 && wordCount >= 15;
}

async function splitPdfIntoPages(pdfBuffer) {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pageCount = srcDoc.getPageCount();
  const pages = [];

  for (let index = 0; index < pageCount; index += 1) {
    const pageDoc = await PDFDocument.create();
    const [copiedPage] = await pageDoc.copyPages(srcDoc, [index]);
    pageDoc.addPage(copiedPage);
    const pageBytes = await pageDoc.save();
    pages.push({
      pageNumber: index + 1,
      buffer: Buffer.from(pageBytes),
    });
  }

  return pages;
}

async function mergePdfBuffers(buffers) {
  const outDoc = await PDFDocument.create();

  for (const buffer of buffers) {
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageIndices = srcDoc.getPageIndices();
    const copiedPages = await outDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => outDoc.addPage(page));
  }

  const bytes = await outDoc.save();
  return Buffer.from(bytes);
}

async function extractTextFromPdfBuffer(pdfBuffer) {
  logger.flow('Extracting text from PDF buffer', {
    sizeBytes: pdfBuffer?.length || 0,
    parserMode: PDFParseClass ? 'class-api' : 'legacy-function',
  });

  if (PDFParseClass) {
    const parser = new PDFParseClass({ data: pdfBuffer });

    try {
      const result = await parser.getText();
      const text = normalizeWhitespace(result?.text || '');
      const pageCount =
        Number(result?.total || 0) ||
        Number(result?.pages?.length || 0) ||
        1;

      logger.info('PDF text extraction complete', {
        sizeBytes: pdfBuffer?.length || 0,
        pageCount,
        textLength: text.length,
        isDigitalText: isTextPage(text),
      });

      return {
        text,
        pageCount,
        isDigitalText: isTextPage(text),
      };
    } finally {
      try {
        await parser.destroy();
      } catch (error) {
        logger.warn('Failed to destroy PDF parser instance cleanly', {
          reason: error.message,
        });
      }
    }
  }

  if (typeof pdfParseModule === 'function') {
    const parsed = await pdfParseModule(pdfBuffer);
    const text = normalizeWhitespace(parsed.text || '');

    logger.info('PDF text extraction complete', {
      sizeBytes: pdfBuffer?.length || 0,
      pageCount: parsed.numpages || 1,
      textLength: text.length,
      isDigitalText: isTextPage(text),
    });

    return {
      text,
      pageCount: parsed.numpages || 1,
      isDigitalText: isTextPage(text),
    };
  }

  throw new Error('Unsupported pdf-parse module format: no callable parser available');
}

module.exports = {
  splitPdfIntoPages,
  mergePdfBuffers,
  extractTextFromPdfBuffer,
  normalizeWhitespace,
  isTextPage,
};
