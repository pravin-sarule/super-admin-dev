const { v4: uuidv4 } = require('uuid');

function chunkTextSlidingWindow(text, options = {}) {
  const chunkSize = Number(options.chunkSize || 1200);
  const overlap = Number(options.overlap || 200);
  const stride = Math.max(1, chunkSize - overlap);
  const normalizedText = String(text || '').trim();

  if (!normalizedText) return [];

  const chunks = [];
  let chunkIndex = 0;

  for (let start = 0; start < normalizedText.length; start += stride) {
    const end = Math.min(start + chunkSize, normalizedText.length);
    const chunkText = normalizedText.slice(start, end).trim();

    if (!chunkText) continue;

    chunks.push({
      chunkId: uuidv4(),
      chunkIndex,
      charStart: start,
      charEnd: end,
      chunkText,
    });

    chunkIndex += 1;

    if (end >= normalizedText.length) break;
  }

  return chunks;
}

module.exports = {
  chunkTextSlidingWindow,
};
