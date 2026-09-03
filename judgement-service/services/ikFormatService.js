/**
 * ikFormatService
 *
 * Turns an admin-uploaded judgment (merged OCR / PDF text + extracted metadata)
 * into the exact record shape Indian Kanoon's `/doc/{tid}/` API returns, so the
 * judgment can live in the shared `ik_judgments` + `ik_judgment_paragraphs`
 * library next to real IK judgments and be found by the library-first search.
 *
 * Everything here is a pure function of its inputs: no I/O, no model calls.
 * The HTML structure, the `text` derivation and the paragraph chunking mirror
 * what was observed on real records in the live library (see JUDGMENT_LIBRARY.md
 * §4.2–4.3 and Appendix A).
 *
 * IK HTML skeleton reproduced here:
 *
 *   <h2 class="doc_title">TITLE</h2>
 *
 *   <h3 class="doc_author">Author: <a href="/search/?formInput=authorid:slug">Name</a></h3>
 *
 *   <h3 class="doc_bench">Bench: <a href="/search/?formInput=benchid:slug">Name</a></h3>
 *
 *   <pre id="pre_1">cause-title / header block</pre>
 *   <p id="p_1">numbered or prose paragraph</p>
 *   <blockquote id="blockquote_1">quoted passage</blockquote>
 *   ...
 *   <pre id="pre_2">signature block</pre>
 */
const crypto = require('crypto');

/* -------------------------------------------------------------------------- */
/*                               tid management                               */
/* -------------------------------------------------------------------------- */

/**
 * Uploaded judgments get an 11-digit numeric tid starting with "9".
 * Indian Kanoon's own ids are <= 9 digits today (~2x10^8), so nothing we mint can
 * collide with a real IK document, while staying numeric-safe for any consumer
 * that casts tid to int. The value is derived from canonical_id so re-publishing
 * the same upload yields the same tid (idempotent, create-only friendly).
 */
const UPLOAD_TID_PREFIX = '9';
const UPLOAD_TID_DIGITS = 10;

function deriveUploadTid(canonicalId, salt = 0) {
  const seed = `${String(canonicalId || '').trim()}::${salt}`;
  const hex = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 15);
  const n = BigInt(`0x${hex}`) % (10n ** BigInt(UPLOAD_TID_DIGITS));
  return `${UPLOAD_TID_PREFIX}${n.toString().padStart(UPLOAD_TID_DIGITS, '0')}`;
}

function isUploadTid(tid) {
  const value = String(tid || '').trim();
  return new RegExp(`^${UPLOAD_TID_PREFIX}\\d{${UPLOAD_TID_DIGITS}}$`).test(value);
}

/* -------------------------------------------------------------------------- */
/*                                  helpers                                   */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function unescapeHtml(value) {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&amp;/g, '&');
}

function squashWs(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** "P.VELMURUGAN" -> "P.Velmurugan", "RAMESH SINHA" -> "Ramesh Sinha" (single letters stay upper). */
function titleCaseName(value) {
  return squashWs(value).replace(/[A-Za-z]+/g, (run) => (
    run.length === 1 ? run.toUpperCase() : run.charAt(0).toUpperCase() + run.slice(1).toLowerCase()
  ));
}

/** IK author/bench slugs look like "m-nagaprasanna" / "r-sinha": initial + last name. */
function ikNameSlug(name) {
  const parts = squashWs(name).replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
  if (!parts.length) return 'unknown';
  if (parts.length === 1) return parts[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const initial = parts[0].charAt(0).toLowerCase();
  const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${initial}-${last}`;
}

/* -------------------------------------------------------------------------- */
/*                               title + court                                */
/* -------------------------------------------------------------------------- */

/** "22 October, 2024" — IK's date phrase inside titles. */
function formatIkDate(isoDate) {
  const value = String(isoDate || '').slice(0, 10);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return null;
  return `${Number(match[3])} ${month}, ${match[1]}`;
}

/**
 * IK titles read "Party A vs Party B on 22 October, 2024".
 * Our metadata uses "v." between parties; IK uses "vs".
 */
function buildIkTitle({ caseName, judgmentDate }) {
  let title = squashWs(caseName)
    .replace(/\s+on\s+\d{1,2}\s+[A-Za-z]+\s*,?\s+\d{4}$/i, '') // strip any existing date phrase
    // IK title-cases every word ("The State Of Karnataka", "Smt.Syeda"); do the same,
    // keeping single-letter initials upper-case.
    .replace(/[A-Za-z]+/g, (run) => (run.length === 1 ? run.toUpperCase() : run.charAt(0).toUpperCase() + run.slice(1).toLowerCase()));

  // Only the LAST "v." separates the parties; an earlier one is usually an
  // initial inside a party name ("K.T. V. Health Food Pvt Ltd v. State").
  const versus = /\s+(?:v\.|vs\.|versus|v)\s+/gi;
  let last = null;
  let match;
  while ((match = versus.exec(title)) !== null) last = match;
  if (last) {
    title = `${title.slice(0, last.index)} vs ${title.slice(last.index + last[0].length)}`;
  }

  const datePhrase = formatIkDate(judgmentDate);
  if (datePhrase) title = `${title} on ${datePhrase}`;
  return title || 'Untitled Judgment';
}

/** Court-code -> the `docsource` strings that real IK records carry. */
const COURT_CODE_TO_DOCSOURCE = {
  SC: 'Supreme Court of India',
  DELHC: 'Delhi High Court',
  BOMHC: 'Bombay High Court',
  MADHC: 'Madras High Court',
  CALHC: 'Calcutta High Court',
  KARHC: 'Karnataka High Court',
  KERHC: 'Kerala High Court',
  ALLHC: 'Allahabad High Court',
  'P&HHC': 'Punjab-Haryana High Court',
  GUJHC: 'Gujarat High Court',
  RAJHC: 'Rajasthan High Court',
  NCLAT: 'National Company Law Appellate Tribunal',
  NCLT: 'National Company Law Tribunal',
};

/** Sniff the court from the head of the judgment when the code is UNKNOWN. */
const DOCSOURCE_TEXT_PATTERNS = [
  [/SUPREME\s+COURT\s+OF\s+INDIA/i, () => 'Supreme Court of India'],
  [/HIGH\s+COURT\s+OF\s+JUDICATURE\s+(?:AT|FOR)\s+([A-Z][A-Za-z]+)/i, (m) => `${titleCaseName(m[1])} High Court`],
  [/HIGH\s+COURT\s+OF\s+([A-Z][A-Za-z]+(?:\s+(?:AND|&)\s+[A-Z][A-Za-z]+)?)\s+(?:AT|,)/i, (m) => `${titleCaseName(m[1]).replace(/\bAnd\b/, '&')} High Court`],
  [/HIGH\s+COURT\s+OF\s+([A-Z][A-Za-z]+)/i, (m) => `${titleCaseName(m[1])} High Court`],
  [/(?:THE\s+)?([A-Z][A-Za-z]+(?:\s+(?:AND|&)\s+[A-Z][A-Za-z]+)?)\s+HIGH\s+COURT/i, (m) => `${titleCaseName(m[1]).replace(/\bAnd\b/, '&')} High Court`],
  [/INCOME\s+TAX\s+APPELLATE\s+TRIBUNAL[,\s]+(?:["“]?([A-Z][A-Za-z]+)["”]?\s+BENCH)?/i, (m) => (m[1] ? `Income Tax Appellate Tribunal - ${titleCaseName(m[1])}` : 'Income Tax Appellate Tribunal')],
  [/NATIONAL\s+COMPANY\s+LAW\s+APPELLATE\s+TRIBUNAL/i, () => 'National Company Law Appellate Tribunal'],
  [/NATIONAL\s+COMPANY\s+LAW\s+TRIBUNAL/i, () => 'National Company Law Tribunal'],
  [/CENTRAL\s+ADMINISTRATIVE\s+TRIBUNAL/i, () => 'Central Administrative Tribunal'],
  [/STATE\s+CONSUMER\s+DISPUTES\s+REDRESSAL\s+COMMISSION/i, () => 'State Consumer Disputes Redressal Commission'],
];

/** Spellings the library actually uses (Indian Kanoon's own, quirks included). */
const DOCSOURCE_ALIASES = {
  'Punjab & Haryana High Court': 'Punjab-Haryana High Court',
  'Chhattisgarh High Court': 'Chattisgarh High Court',
  'Jammu And Kashmir High Court': 'Jammu & Kashmir High Court',
};

function sniffDocsource(fullText) {
  const head = String(fullText || '').slice(0, 6000);
  for (const [pattern, build] of DOCSOURCE_TEXT_PATTERNS) {
    const match = head.match(pattern);
    if (match) {
      const value = squashWs(build(match));
      if (value) return DOCSOURCE_ALIASES[value] || value;
    }
  }
  return null;
}

/**
 * Priority: explicit admin value -> court-code mapping -> text sniff -> null.
 * Returns { docsource, source } so callers can tell the admin how it was chosen.
 */
function resolveDocsource({ docsource, courtCode, fullText }) {
  const explicit = squashWs(docsource);
  if (explicit) return { docsource: explicit, source: 'manual' };

  const code = squashWs(courtCode).toUpperCase();
  if (code && COURT_CODE_TO_DOCSOURCE[code]) {
    return { docsource: COURT_CODE_TO_DOCSOURCE[code], source: 'court_code' };
  }

  const sniffed = sniffDocsource(fullText);
  if (sniffed) return { docsource: sniffed, source: 'text' };

  return { docsource: null, source: 'none' };
}

/* -------------------------------------------------------------------------- */
/*                            author / bench detection                        */
/* -------------------------------------------------------------------------- */

// OCR and HTML sources spell it HON'BLE, HON’BLE, HONBLE or HON&#x27;BLE.
const HONBLE = "HON(?:['’]|&#x27;|&#39;|&apos;)?\\s?BLE";

// A name never spans a line break: words are joined by spaces/tabs only.
// Single-letter words are allowed ("ANIL B KATTI"); a name stops at "AND" / "&".
const NAME = "[A-Z][A-Za-z.'’]*(?:[ \\t]+(?![Aa][Nn][Dd]\\b|&)[A-Z][A-Za-z.'’]*){0,4}";
// Role words as they appear in headers (upper case) and signature blocks (mixed case).
const ROLE = "(?:[Cc][Hh][Ii][Ee][Ff][ \\t]+)?(?:[Jj][Uu][Ss][Tt][Ii][Cc][Ee]|[Jj][Uu][Dd][Gg][Ee]|C\\.?J\\.?|J\\.)";

const JUDGE_LINE_PATTERNS = [
  // THE HON'BLE MR. JUSTICE M. NAGAPRASANNA  (the name may start on the next PDF line)
  new RegExp(`${HONBLE}[ \\t]+(?:THE[ \\t]+)?(?:MR\\.?|MRS\\.?|MS\\.?|DR\\.?|SHRI|SRI|SMT\\.?)?[ \\t]*(?:CHIEF[ \\t]+)?JUSTICE[ \\t]*\\n?[ \\t]*(${NAME})`, 'g'),
  // CORAM: HON'BLE ... / CORAM: A. B. Sharma, J.
  /CORAM\s*[:\-][ \t]*\n?[ \t]*([^\n]{3,120})/g,
  // (RAMESH SINHA) Chief Justice   /  (Ravindra Kumar Agrawal) Judge
  new RegExp(`\\(\\s*(${NAME})\\s*\\)\\s*,?\\s*${ROLE}\\b`, 'g'),
  // X, J.  /  X, C.J.
  new RegExp(`^[ \\t]*(${NAME})[ \\t]*,[ \\t]*(?:C\\.?J\\.|J\\.)[ \\t]*$`, 'gm'),
];

/** CORAM lines list several judges: "A, B and C" — a bare "&" only counts when spaced (not "&#x27;"). */
const JUDGE_LIST_SEPARATOR = /\s*,\s*|\s+(?:and|&)\s+/i;

const NOT_A_NAME = /\b(?:COURT|BENCH|JUDGMENT|ORDER|PETITIONER|RESPONDENT|STATE|UNION|INDIA|DATED|DATE|THE|OF|AND|VS|VERSUS|SD|HON|HON['’]?BLE|MR|MRS|MS|DR|SHRI|SRI|SMT|JUSTICE|JUDGE|CORAM|PRESENT|BEFORE)\b/i;

const JUDGE_PREFIX = new RegExp(
  `^(?:THE\\s+)?(?:${HONBLE}\\s+)?(?:THE\\s+)?(?:MR\\.?|MRS\\.?|MS\\.?|DR\\.?|SHRI|SRI|SMT\\.?)?\\s*(?:CHIEF\\s+)?JUSTICE\\s+`,
  'i'
);

function cleanJudgeName(raw) {
  const name = squashWs(raw)
    .replace(JUDGE_PREFIX, '')
    .replace(/\s*,?\s*(?:CHIEF\s+JUSTICE|JUSTICE|JUDGE|C\.?J\.?|J\.)\s*$/i, '')
    .replace(/[()]/g, '')
    .trim();
  if (!name || name.length < 3 || name.length > 60) return null;
  if (NOT_A_NAME.test(name)) return null;
  if (!/[A-Za-z]{2,}/.test(name)) return null;
  return titleCaseName(name);
}

/**
 * Conservative judge detection from the head and tail of the judgment.
 * Returns { author, bench } — both null when nothing trustworthy is found.
 * author is set only when exactly one judge is found (IK's convention for
 * single-judge benches); we never guess who wrote a multi-judge opinion.
 */
function detectAuthorAndBench(fullText) {
  const text = String(fullText || '');
  const window = `${text.slice(0, 8000)}\n${text.slice(-3000)}`;
  const names = [];

  for (const pattern of JUDGE_LINE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(window)) !== null) {
      // CORAM lines may list several judges separated by commas / "and"
      const parts = match[1].split(JUDGE_LIST_SEPARATOR);
      for (const part of parts) {
        const name = cleanJudgeName(part);
        if (name && !names.some((n) => n.toLowerCase() === name.toLowerCase())) {
          names.push(name);
        }
      }
      if (names.length >= 5) break;
    }
  }

  if (!names.length) return { author: null, bench: null };
  return {
    author: names.length === 1 ? names[0] : null,
    bench: names.join(', '),
  };
}

/* -------------------------------------------------------------------------- */
/*                                HTML builder                                */
/* -------------------------------------------------------------------------- */

function splitBlocks(fullText) {
  return String(fullText || '')
    .replace(/\r/g, '')
    .split(/\n[ \t]*\n+/)
    .map((block) => block.replace(/[ \t]+$/gm, '').trim())
    .filter(Boolean);
}

function isNumberedParagraph(block) {
  return /^\s*(?:\d{1,3}[.)]|\(\d{1,3}\))\s+\S/.test(block);
}

function isProseBlock(block) {
  if (isNumberedParagraph(block)) return true;
  const lines = block.split('\n').filter((l) => l.trim());
  if (!lines.length) return false;
  const avg = block.length / lines.length;
  return block.length >= 200 && avg >= 45;
}

function isQuoteBlock(block) {
  const trimmed = block.trim();
  return /^["“‘']/.test(trimmed)
    && (/["”’']\s*\.?$/.test(trimmed) || trimmed.split('\n').length >= 2);
}

/**
 * Build the IK-style HTML fragment. Returns { html, structure } where structure
 * counts what was emitted (useful for the admin UI and tests).
 */
function buildIkHtml({ title, author, bench, fullText }) {
  const parts = [];
  parts.push(`<h2 class="doc_title">${escapeHtml(title)}</h2>`);

  if (squashWs(author)) {
    parts.push('');
    parts.push(
      `<h3 class="doc_author">Author: <a href="/search/?formInput=authorid:${ikNameSlug(author)}">${escapeHtml(squashWs(author))}</a></h3>`
    );
  }
  if (squashWs(bench)) {
    const benchLinks = squashWs(bench)
      .split(/\s*,\s*/)
      .filter(Boolean)
      .map((name) => `<a href="/search/?formInput=benchid:${ikNameSlug(name)}">${escapeHtml(name)}</a>`)
      .join(', ');
    parts.push('');
    parts.push(`<h3 class="doc_bench">Bench: ${benchLinks}</h3>`);
  }

  const blocks = splitBlocks(fullText);
  const structure = { pre: 0, p: 0, blockquote: 0, blocks: blocks.length };

  if (!blocks.length) {
    return { html: parts.join('\n'), structure };
  }

  // Header region = everything before the first prose paragraph -> <pre id="pre_1">
  let firstProse = blocks.findIndex(isProseBlock);
  if (firstProse === -1) firstProse = blocks.length; // no prose at all -> whole doc is one <pre>
  // Signature region = everything after the last prose paragraph -> <pre id="pre_N">
  let lastProse = -1;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    if (isProseBlock(blocks[i])) { lastProse = i; break; }
  }

  const body = [];
  let preNo = 0;
  let pNo = 0;
  let bqNo = 0;

  const pushPre = (chunk) => {
    preNo += 1;
    structure.pre += 1;
    body.push(`<pre id="pre_${preNo}">${escapeHtml(chunk)}</pre>`);
  };

  if (firstProse > 0) {
    pushPre(blocks.slice(0, firstProse).join('\n\n'));
  }

  for (let i = firstProse; i <= lastProse; i += 1) {
    const block = blocks[i];
    if (isQuoteBlock(block)) {
      bqNo += 1;
      structure.blockquote += 1;
      body.push(`<blockquote id="blockquote_${bqNo}">${escapeHtml(block)}</blockquote>`);
    } else {
      pNo += 1;
      structure.p += 1;
      body.push(`<p id="p_${pNo}">${escapeHtml(block)}</p>`);
    }
  }

  if (lastProse >= 0 && lastProse < blocks.length - 1) {
    pushPre(blocks.slice(lastProse + 1).join('\n\n'));
  }

  if (body.length) {
    parts.push('');
    parts.push(body.join('\n'));
  }

  return { html: parts.join('\n'), structure };
}

/**
 * Mirror of the library's strip_html: every tag becomes a space, runs of
 * spaces/tabs collapse to one space, newlines are kept. Entities are NOT
 * decoded — verified against real records, whose `text` still contains
 * `&amp;` / `&quot;`. This is exactly how `text` is derived from `doc`.
 */
function stripHtmlLikeIk(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ');
}

/**
 * Inverse of buildIkHtml for the body: recover the original judgment text
 * (blank-line separated blocks) from a stored `doc`, so a record can be
 * rebuilt after a title / court / judge edit without keeping the PDF or a
 * second copy of the text anywhere. The header (h2/h3) is not part of it.
 */
function bodyTextFromIkHtml(doc) {
  const withoutHeader = String(doc || '')
    .replace(/<h2 class="doc_title">[\s\S]*?<\/h2>/, '')
    .replace(/<h3 class="doc_(?:author|bench)">[\s\S]*?<\/h3>/g, '');
  const blocks = [];
  const blockPattern = /<(pre|p|blockquote)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = blockPattern.exec(withoutHeader)) !== null) {
    const block = unescapeHtml(match[2]).trim();
    if (block) blocks.push(block);
  }
  return blocks.join('\n\n').trim();
}

/* -------------------------------------------------------------------------- */
/*                          paragraph chunking + tagging                       */
/* -------------------------------------------------------------------------- */

const MAX_CHUNK_CHARS = 2500;
const MIN_CHUNK_CHARS = 200;
const MERGE_NEXT_BELOW = 100;
const MAX_CHUNKS = 400;

function cutLongBlock(block) {
  const out = [];
  let rest = block;
  while (rest.length > MAX_CHUNK_CHARS) {
    const window = rest.slice(0, MAX_CHUNK_CHARS);
    let cut = -1;
    for (const boundary of ['. ', '.\n', '? ', '?\n', '! ', '!\n']) {
      const idx = window.lastIndexOf(boundary);
      if (idx >= MIN_CHUNK_CHARS && idx > cut) cut = idx;
    }
    const at = cut === -1 ? MAX_CHUNK_CHARS : cut + 1;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Deterministic split of a judgment's `text` into legal chunks:
 *  1. blank lines -> else numbered paragraph starts -> else one block
 *  2. blocks > 2,500 chars cut at the last sentence boundary after 200 chars
 *  3. blocks < 200 chars (or a next block < 100) merged forward
 *  4. at most 400 chunks
 */
function splitJudgmentParagraphs(text) {
  const source = String(text || '').replace(/\r/g, '');
  if (!source.trim()) return [];

  let blocks;
  if (/\n[ \t]*\n/.test(source)) {
    blocks = source.split(/\n[ \t]*\n+/);
  } else if (/(?:^|\n)\s*\d{1,3}\.\s/.test(source)) {
    blocks = source.split(/\n(?=\s*\d{1,3}\.\s)/);
  } else {
    blocks = [source];
  }
  blocks = blocks.map((b) => b.trim()).filter(Boolean);

  const sized = blocks.flatMap((b) => (b.length > MAX_CHUNK_CHARS ? cutLongBlock(b) : [b]));

  const merged = [];
  for (const block of sized) {
    const last = merged[merged.length - 1];
    if (last !== undefined && (last.length < MIN_CHUNK_CHARS || block.length < MERGE_NEXT_BELOW)) {
      merged[merged.length - 1] = `${last}\n${block}`;
    } else {
      merged.push(block);
    }
  }

  return merged.slice(0, MAX_CHUNKS);
}

// "under sections 302 / 34, 307" — the lead is just the word; a preceding "under" is irrelevant.
const SECTION_LEAD = /\b(?:sections?|sec\.?|s\.|u\/s\.?)\s*/gi;
// "10A", "10-A" and "41A" all normalise to "10A" / "41A" like the library does.
const SECTION_TOKEN = /(\d{1,4})-?([A-Z]{0,2})(?:\s*\(\d{1,2}\))?/y;
const SECTION_SEPARATOR = /\s*(?:,|and|&|to|\/|read\s+with)\s*/y;

function extractSections(text) {
  const source = String(text || '');
  const found = new Set();
  SECTION_LEAD.lastIndex = 0;
  let lead;
  while ((lead = SECTION_LEAD.exec(source)) !== null) {
    let pos = SECTION_LEAD.lastIndex;
    for (let guard = 0; guard < 12; guard += 1) {
      SECTION_TOKEN.lastIndex = pos;
      const tok = SECTION_TOKEN.exec(source);
      if (!tok) break;
      found.add(`${tok[1]}${tok[2]}`.toUpperCase());
      pos = SECTION_TOKEN.lastIndex;
      SECTION_SEPARATOR.lastIndex = pos;
      const sep = SECTION_SEPARATOR.exec(source);
      if (!sep || sep[0].length === 0) break;
      pos = SECTION_SEPARATOR.lastIndex;
    }
  }
  return Array.from(found).slice(0, 30);
}

/** Vocabulary observed on real paragraph rows in the library — keep labels identical. */
const ACT_PATTERNS = [
  ['Indian Penal Code', /Indian\s+Penal\s+Code/i],
  ['IPC', /\bI\.?\s?P\.?\s?C\b\.?/],
  ['Code of Criminal Procedure', /Code\s+of\s+Criminal\s+Procedure/i],
  ['CrPC', /\bCr\.?\s?P\.?\s?C\b\.?/i],
  ['Bharatiya Nagarik Suraksha Sanhita', /Bharatiya\s+Nagarik\s+Suraksha\s+Sanhita/i],
  ['BNSS', /\bB\.?N\.?S\.?S\b\.?/],
  ['Bharatiya Nyaya Sanhita', /Bharatiya\s+Nyaya\s+Sanhita/i],
  ['BNS', /\bB\.?N\.?S\b(?!\.?S)\.?/],
  ['Bharatiya Sakshya Adhiniyam', /Bharatiya\s+Sakshya\s+Adhiniyam/i],
  ['BSA', /\bBSA\b/],
  ['Evidence Act', /Evidence\s+Act/i],
  ['CPC', /\bC\.?\s?P\.?\s?C\b\.?/],
  ['Companies Act', /Companies\s+Act/i],
  ['Negotiable Instruments Act', /Negotiable\s+Instruments\s+Act|\bN\.?\s?I\.?\s+Act\b/i],
  ['Contract Act', /Contract\s+Act/i],
  ['Arbitration and Conciliation Act', /Arbitration\s+(?:and|&)\s+Conciliation\s+Act/i],
];

function extractActs(text) {
  const source = String(text || '');
  const found = [];
  for (const [label, pattern] of ACT_PATTERNS) {
    if (pattern.test(source) && !found.includes(label)) found.push(label);
  }
  return found;
}

const CITATION_PATTERNS = [
  /\(\d{4}\)\s*\d{1,3}\s*SCC\s*OnLine\s*[A-Za-z]+\s*\d{1,6}/g,
  /\b\d{4}\s*SCC\s*OnLine\s*[A-Za-z]+\s*\d{1,6}/g,
  /\(\d{4}\)\s*\d{1,3}\s*[A-Z][A-Za-z.]{1,12}\s*\d{1,5}\b/g,
  /\b\d{4}\s*\(\d{1,3}\)\s*[A-Z][A-Za-z.]{1,12}\s*\d{1,5}\b/g,
  /\bAIR\s+\d{4}\s+[A-Z][A-Za-z.]{0,8}\s+\d{1,5}\b/g,
  /\[\d{4}\]\s*\d{1,3}\s*[A-Z][A-Za-z.]{1,12}\s*\d{1,5}\b/g,
];

function extractCitations(text) {
  const source = String(text || '');
  const found = new Set();
  for (const pattern of CITATION_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      found.add(squashWs(match[0]));
    }
  }
  return Array.from(found).slice(0, 20);
}

/**
 * Paragraph rows in exactly the shape stored in `ik_judgment_paragraphs`
 * (empty lists / nulls omitted, `paragraph_type` and `case_number` never invented).
 */
function buildParagraphRows(tid, judgmentBody) {
  const chunks = splitJudgmentParagraphs(judgmentBody.text);
  return chunks.map((chunk, index) => {
    const row = {
      judgment_id: String(tid),
      paragraph_no: index + 1,
      title: judgmentBody.title || undefined,
      docsource: judgmentBody.docsource || undefined,
      publishdate: judgmentBody.publishdate || undefined,
      bench: judgmentBody.bench || undefined,
      text: chunk,
    };
    const sections = extractSections(chunk);
    const acts = extractActs(chunk);
    const citations = extractCitations(chunk);
    if (sections.length) row.sections = sections;
    if (acts.length) row.acts = acts;
    if (citations.length) row.citations = citations;
    return Object.fromEntries(
      Object.entries(row).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
  });
}

/* -------------------------------------------------------------------------- */
/*                          the ik_judgments document                          */
/* -------------------------------------------------------------------------- */

/**
 * Build the `ik_judgments` record. Field-for-field what the library writes from
 * an IK `/doc` response (JUDGMENT_LIBRARY.md A.2/A.3): tid, title, doc, text,
 * docsource, publishdate, author, bench, numcites, numcitedby, casesCited,
 * citedBy. Null values are dropped exactly like the library does.
 *
 * Three additions, none of which touch the search fields:
 *   fetched_at  – the upload time (the field already exists in the mapping)
 *   source      – "admin_upload", so a record can be told apart from an IK fetch
 *   upload      – non-indexed bookkeeping (filename, uploader, page count …)
 */
function buildIkJudgmentBody({
  tid,
  title,
  html,
  docsource,
  publishdate,
  author,
  bench,
  fetchedAt = new Date().toISOString(),
  upload = null,
}) {
  const body = {
    tid: String(tid),
    title: squashWs(title) || null,
    doc: html,
    text: stripHtmlLikeIk(html),
    docsource: squashWs(docsource) || null,
    publishdate: publishdate ? String(publishdate).slice(0, 10) : null,
    author: squashWs(author) || null,
    bench: squashWs(bench) || null,
    numcites: 0,
    numcitedby: 0,
    casesCited: [],
    citedBy: [],
    fetched_at: fetchedAt,
    source: 'admin_upload',
    upload: upload && typeof upload === 'object' ? upload : null,
  };
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== null && v !== undefined));
}

/** Shape the stored record like IK's own `POST /doc/{tid}/` response. */
function toIkDocResponse(body) {
  if (!body) return null;
  return {
    tid: Number(body.tid),
    title: body.title || null,
    doc: body.doc || '',
    docsource: body.docsource || null,
    publishdate: body.publishdate || null,
    author: body.author || null,
    bench: body.bench || null,
    numcites: Number(body.numcites || 0),
    numcitedby: Number(body.numcitedby || 0),
    cites: Array.isArray(body.casesCited)
      ? body.casesCited.map((c) => ({ tid: Number(c.docId), title: c.title }))
      : [],
    citedby: Array.isArray(body.citedBy)
      ? body.citedBy.map((c) => ({ tid: Number(c.docId), title: c.title }))
      : [],
  };
}

/** Wrap the bare fragment in a page for "open in new tab" — the stored `doc` stays a fragment. */
function wrapIkHtmlPage(fragment, title) {
  return [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>${escapeHtml(title || 'Judgment')}</title>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<style>',
    'body{font-family:Georgia,"Times New Roman",serif;color:#1a1a1a;background:#fff;margin:0;padding:32px 16px;line-height:1.6}',
    '.doc{max-width:880px;margin:0 auto}',
    '.doc_title{font-size:1.5rem;line-height:1.3;margin:0 0 12px}',
    '.doc_author,.doc_bench{font-size:1rem;font-weight:600;margin:6px 0}',
    '.doc_author a,.doc_bench a{color:#1d4ed8;text-decoration:none}',
    'pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;margin:16px 0}',
    'p{margin:14px 0;text-align:justify;white-space:pre-wrap}',
    'blockquote{margin:14px 24px;padding:8px 16px;border-left:3px solid #cbd5e1;background:#f8fafc;white-space:pre-wrap}',
    '</style></head><body><div class="doc">',
    fragment,
    '</div></body></html>',
  ].join('\n');
}

module.exports = {
  UPLOAD_TID_PREFIX,
  deriveUploadTid,
  isUploadTid,
  escapeHtml,
  squashWs,
  formatIkDate,
  buildIkTitle,
  COURT_CODE_TO_DOCSOURCE,
  sniffDocsource,
  resolveDocsource,
  detectAuthorAndBench,
  buildIkHtml,
  stripHtmlLikeIk,
  unescapeHtml,
  bodyTextFromIkHtml,
  splitJudgmentParagraphs,
  extractSections,
  extractActs,
  extractCitations,
  buildParagraphRows,
  buildIkJudgmentBody,
  toIkDocResponse,
  wrapIkHtmlPage,
};
