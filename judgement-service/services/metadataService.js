const crypto = require('crypto');

const COURT_PATTERNS = [
  { code: 'SC', regex: /supreme court/i },
  { code: 'DELHC', regex: /delhi high court/i },
  { code: 'BOMHC', regex: /bombay high court/i },
  { code: 'MADHC', regex: /madras high court/i },
  { code: 'CALHC', regex: /calcutta high court/i },
  { code: 'KARHC', regex: /karnataka high court/i },
  { code: 'KERHC', regex: /kerala high court/i },
  { code: 'ALLHC', regex: /allahabad high court/i },
  { code: 'P&HHC', regex: /punjab and haryana high court/i },
  { code: 'GUJHC', regex: /gujarat high court/i },
  { code: 'RAJHC', regex: /rajasthan high court/i },
  { code: 'NCLAT', regex: /nclat/i },
  { code: 'NCLT', regex: /nclt/i },
];

const CITATION_REGEXES = [
  /\(\d{4}\)\s*\d+\s*[A-Z][A-Z.\s]{1,30}\s*\d+/g,
  /\d{4}\s+SCC\s+OnLine\s+[A-Za-z]+\s+\d+/g,
  /AIR\s+\d{4}\s+[A-Za-z]+\s+\d+/g,
  /\[\d{4}\]\s*\d+\s*[A-Z][A-Z.\s]{1,30}\s*\d+/g,
];

const DATE_PATTERNS = [
  /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/,
  /\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/,
  /\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/,
];

function cleanLine(line) {
  return String(line || '').replace(/\s+/g, ' ').trim();
}

function titleCaseCaseName(value) {
  return cleanLine(value)
    .split(' ')
    .map((part) => {
      if (!part) return part;
      if (/^(v|vs|vs\.|v\.)$/i.test(part)) return 'v.';
      if (/^[A-Z]{2,}$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function pickCaseName(lines = [], fallbackName = '') {
  const fromVs = lines.find((line) => /\b(v|vs\.?|versus)\b/i.test(line) && line.length <= 220);
  if (fromVs) return titleCaseCaseName(fromVs);

  const likelyHeading = lines.find((line) => line.length >= 20 && line.length <= 220);
  if (likelyHeading) return titleCaseCaseName(likelyHeading);

  return titleCaseCaseName(fallbackName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '));
}

function detectCourtCode(text) {
  const match = COURT_PATTERNS.find((entry) => entry.regex.test(text));
  return match ? match.code : 'UNKNOWN';
}

function extractDate(text) {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const parsed = new Date(match[1]);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    }
  }

  return null;
}

function extractCitations(text) {
  const allMatches = [];

  for (const regex of CITATION_REGEXES) {
    const matches = text.match(regex) || [];
    allMatches.push(...matches.map((entry) => cleanLine(entry)));
  }

  return [...new Set(allMatches)].slice(0, 20);
}

function createCanonicalId(caseName, courtCode, year) {
  const slug = cleanLine(`${caseName}-${courtCode}-${year || 'undated'}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  const hash = crypto
    .createHash('sha1')
    .update(`${caseName}|${courtCode}|${year || ''}`)
    .digest('hex')
    .slice(0, 10);

  return `${slug || 'judgment'}-${hash}`;
}

function extractMetadata({ fullText, originalFilename, sourceUrl }) {
  const trimmedText = String(fullText || '').trim();
  const lines = trimmedText
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, 40);
  const topText = trimmedText.slice(0, 12000);

  const caseName = pickCaseName(lines, originalFilename);
  const courtCode = detectCourtCode(topText);
  const judgmentDate = extractDate(topText);
  const citations = extractCitations(topText);
  const primaryCitation = citations[0] || null;
  const alternateCitations = citations.slice(1);
  const year = judgmentDate ? Number(judgmentDate.slice(0, 4)) : (() => {
    const citationYear = primaryCitation?.match(/\b(19|20)\d{2}\b/);
    return citationYear ? Number(citationYear[0]) : null;
  })();

  return {
    caseName: caseName || 'Untitled Judgment',
    courtCode,
    judgmentDate,
    year,
    sourceUrl: cleanLine(sourceUrl),
    primaryCitation,
    alternateCitations,
    canonicalId: createCanonicalId(caseName || originalFilename, courtCode, year),
    confidenceScore: caseName && courtCode !== 'UNKNOWN' ? 0.88 : 0.72,
  };
}

module.exports = {
  extractMetadata,
};
