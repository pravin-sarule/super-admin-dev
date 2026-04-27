const CHUNK_TOKEN_LIMIT = 1000; // approximate: split by whitespace word count

/**
 * Extract page-aware text segments from a Document AI JSON response.
 * Handles both `paragraphs` and `blocks` layouts.
 */
const parseDocumentAIJson = (docAIJson) => {
  const fullText = docAIJson.text || '';
  const pages = docAIJson.pages || [];
  const segments = [];

  for (const page of pages) {
    const pageNumber = page.pageNumber || 1;
    const layoutItems = page.paragraphs || page.blocks || page.lines || [];

    for (const item of layoutItems) {
      const textAnchor = item.layout?.textAnchor || item.textAnchor;
      if (!textAnchor?.textSegments?.length) continue;

      let text = '';
      for (const seg of textAnchor.textSegments) {
        const start = parseInt(seg.startIndex || '0', 10);
        const end = parseInt(seg.endIndex || '0', 10);
        text += fullText.slice(start, end);
      }

      const trimmed = text.trim();
      if (trimmed) segments.push({ text: trimmed, pageNumber });
    }
  }

  // Fallback: if no segments found, use the raw full text
  if (segments.length === 0 && fullText.trim()) {
    segments.push({ text: fullText.trim(), pageNumber: 1 });
  }

  return segments;
};

/**
 * Split segments into chunks of ~CHUNK_TOKEN_LIMIT words, preserving page metadata.
 */
const splitIntoChunks = (segments) => {
  const chunks = [];
  let currentText = '';
  let currentPage = segments[0]?.pageNumber || 1;
  let chunkIndex = 0;

  const flushChunk = () => {
    if (!currentText.trim()) return;
    const trimmed = currentText.trim();
    chunks.push({
      chunk_index: chunkIndex++,
      content: trimmed,
      page_number: currentPage,
      token_count: trimmed.split(/\s+/).length,
    });
    currentText = '';
  };

  for (const seg of segments) {
    const combined = currentText ? `${currentText}\n${seg.text}` : seg.text;
    const wordCount = combined.split(/\s+/).length;

    if (wordCount > CHUNK_TOKEN_LIMIT && currentText) {
      flushChunk();
      currentText = seg.text;
      currentPage = seg.pageNumber;
    } else {
      currentText = combined;
      if (!currentText || currentText === seg.text) {
        currentPage = seg.pageNumber;
      }
    }
  }

  flushChunk();
  return chunks;
};

module.exports = { parseDocumentAIJson, splitIntoChunks };
