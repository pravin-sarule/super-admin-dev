/**
 * Extract plain text from PDF / DOCX / TXT / MD buffers.
 *
 * `pdf-parse` is already a project dependency. `mammoth` is loaded lazily
 * so the server still boots if it has not been installed yet — the upload
 * just gets a friendly error.
 */

const path = require('path');

const SUPPORTED_EXT = ['pdf', 'docx', 'txt', 'md'];

const detectSourceType = (filename = '', contentType = '') => {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (SUPPORTED_EXT.includes(ext)) return ext;

  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('wordprocessingml')) return 'docx';
  if (contentType.includes('markdown')) return 'md';
  if (contentType.includes('text/')) return 'txt';
  return 'unknown';
};

const requireOptional = (name) => {
  try {
    return require(name);
  } catch (_) {
    return null;
  }
};

const extractPdf = async (buffer) => {
  // pdf-parse v2.x exports a `PDFParse` class; v1.x exported a callable function.
  const mod = require('pdf-parse');
  const PDFParse = mod.PDFParse || (mod.default && mod.default.PDFParse);
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (PDFParse) {
    // v2.x — class API: new PDFParse({ data }).getText()
    const parser = new PDFParse({ data });
    try {
      const result = await parser.getText();
      return {
        text: result?.text || '',
        meta: { pages: Array.isArray(result?.pages) ? result.pages.length : null },
      };
    } finally {
      try { await parser.destroy(); } catch (_) { /* ignore */ }
    }
  }

  // v1.x — callable export
  const fn = typeof mod === 'function' ? mod : mod.default || mod.pdf;
  if (typeof fn !== 'function') throw new Error('pdf-parse: no usable export found');
  const result = await fn(buffer);
  return {
    text: result?.text || '',
    meta: { pages: result?.numpages || null },
  };
};

const extractDocx = async (buffer) => {
  const mammoth = requireOptional('mammoth');
  if (!mammoth) {
    throw new Error(
      'mammoth is not installed. Run `npm install mammoth` to enable DOCX support.'
    );
  }
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value || '', meta: {} };
};

const extractPlain = async (buffer) => ({
  text: buffer.toString('utf8'),
  meta: {},
});

/**
 * @param {Buffer} buffer
 * @param {{ filename?: string, contentType?: string }} opts
 * @returns {Promise<{ text: string, sourceType: string, meta: object }>}
 */
const extractText = async (buffer, opts = {}) => {
  const sourceType = detectSourceType(opts.filename, opts.contentType);

  if (!SUPPORTED_EXT.includes(sourceType)) {
    throw Object.assign(
      new Error(
        `Unsupported file type "${sourceType}". Allowed: ${SUPPORTED_EXT.join(', ')}.`
      ),
      { code: 'UNSUPPORTED_FILE_TYPE', statusCode: 400 }
    );
  }

  let extracted;
  if (sourceType === 'pdf') extracted = await extractPdf(buffer);
  else if (sourceType === 'docx') extracted = await extractDocx(buffer);
  else extracted = await extractPlain(buffer);

  // Normalize: collapse repeated whitespace but preserve paragraph breaks.
  const normalized = (extracted.text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text: normalized, sourceType, meta: extracted.meta || {} };
};

module.exports = {
  extractText,
  detectSourceType,
  SUPPORTED_EXT,
};
