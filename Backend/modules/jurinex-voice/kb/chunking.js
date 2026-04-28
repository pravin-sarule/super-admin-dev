/**
 * Text chunking with paragraph/sentence boundaries, configurable token
 * targets, and approximate token counting (4 chars ≈ 1 token).
 *
 * Each chunk records char_start/char_end and the most recent markdown
 * heading path so search results can be cited.
 */

const DEFAULT_CHUNK_TOKENS = Number(process.env.KB_CHUNK_TOKENS || 500);
const DEFAULT_CHUNK_OVERLAP = Number(process.env.KB_CHUNK_OVERLAP || 50);

const approxTokens = (str) => Math.ceil((str || '').length / 4);

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

const splitParagraphs = (text) => {
  const lines = text.split('\n');
  const paragraphs = [];
  const headingStack = [];

  let buf = '';
  let bufStart = 0;
  let bufHeadingPath = '';
  let cursor = 0;

  const flush = (endChar) => {
    if (buf.trim()) {
      paragraphs.push({
        text: buf.trim(),
        char_start: bufStart,
        char_end: endChar,
        heading_path: bufHeadingPath,
      });
    }
    buf = '';
  };

  for (const line of lines) {
    const lineLen = line.length + 1; // +1 for the newline we split on
    const headingMatch = line.match(HEADING_RE);

    if (headingMatch) {
      flush(cursor);
      const depth = headingMatch[1].length;
      const heading = headingMatch[2];
      headingStack.length = depth - 1;
      headingStack[depth - 1] = heading;
      bufHeadingPath = headingStack.filter(Boolean).join(' › ');
      bufStart = cursor + lineLen;
    } else if (line.trim() === '') {
      flush(cursor);
      bufStart = cursor + lineLen;
    } else {
      if (!buf) bufStart = cursor;
      buf += (buf ? '\n' : '') + line;
    }
    cursor += lineLen;
  }
  flush(cursor);

  return paragraphs;
};

const splitSentences = (text) =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .filter(Boolean);

/**
 * @param {string} fullText
 * @param {{ chunkTokens?: number, chunkOverlap?: number }} opts
 * @returns {{ chunk_index: number, text: string, token_count: number,
 *            char_start: number, char_end: number, heading_path: string }[]}
 */
const chunkText = (fullText, opts = {}) => {
  const chunkTokens = Math.max(50, opts.chunkTokens || DEFAULT_CHUNK_TOKENS);
  const overlap = Math.max(0, Math.min(opts.chunkOverlap || DEFAULT_CHUNK_OVERLAP, chunkTokens - 1));

  if (!fullText || !fullText.trim()) return [];

  const paragraphs = splitParagraphs(fullText);
  const chunks = [];
  let chunkIndex = 0;

  let current = { text: '', tokens: 0, char_start: null, char_end: null, heading_path: '' };

  const pushCurrent = () => {
    if (!current.text.trim()) return;
    chunks.push({
      chunk_index: chunkIndex++,
      text: current.text.trim(),
      token_count: approxTokens(current.text),
      char_start: current.char_start ?? 0,
      char_end: current.char_end ?? 0,
      heading_path: current.heading_path || '',
    });
    // overlap by tail tokens from the just-flushed chunk
    if (overlap > 0) {
      const tail = current.text.slice(-overlap * 4);
      current = {
        text: tail,
        tokens: approxTokens(tail),
        char_start: current.char_end,
        char_end: current.char_end,
        heading_path: current.heading_path,
      };
    } else {
      current = { text: '', tokens: 0, char_start: null, char_end: null, heading_path: '' };
    }
  };

  const addPiece = (piece, headingPath, char_start, char_end) => {
    const pieceTokens = approxTokens(piece);

    if (current.tokens + pieceTokens > chunkTokens && current.text) {
      pushCurrent();
    }

    if (pieceTokens > chunkTokens) {
      // Hard split: piece itself is too big — break it.
      let i = 0;
      const stride = chunkTokens * 4;
      while (i < piece.length) {
        const seg = piece.slice(i, i + stride);
        const segTokens = approxTokens(seg);
        const segStart = char_start + i;
        const segEnd = segStart + seg.length;

        if (current.tokens + segTokens > chunkTokens && current.text) pushCurrent();
        if (!current.text) {
          current.char_start = segStart;
          current.heading_path = headingPath;
        }
        current.text += (current.text ? ' ' : '') + seg;
        current.tokens += segTokens;
        current.char_end = segEnd;
        i += stride;

        if (current.tokens >= chunkTokens) pushCurrent();
      }
      return;
    }

    if (!current.text) {
      current.char_start = char_start;
      current.heading_path = headingPath;
    }
    current.text += (current.text ? ' ' : '') + piece;
    current.tokens += pieceTokens;
    current.char_end = char_end;
  };

  for (const p of paragraphs) {
    if (approxTokens(p.text) <= chunkTokens) {
      addPiece(p.text, p.heading_path, p.char_start, p.char_end);
    } else {
      // Paragraph too big — split into sentences.
      const sentences = splitSentences(p.text);
      let cursor = p.char_start;
      for (const s of sentences) {
        const sStart = cursor;
        const sEnd = cursor + s.length;
        addPiece(s, p.heading_path, sStart, sEnd);
        cursor = sEnd + 1;
      }
    }
  }

  pushCurrent();

  return chunks;
};

module.exports = {
  chunkText,
  approxTokens,
  DEFAULT_CHUNK_TOKENS,
  DEFAULT_CHUNK_OVERLAP,
};
