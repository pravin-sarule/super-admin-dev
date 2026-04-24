const axios = require('axios');
const crypto = require('crypto');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Metadata');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const METADATA_MODEL =
  process.env.JUDGEMENT_METADATA_MODEL ||
  process.env.GEMINI_METADATA_MODEL ||
  'gemini-2.5-flash';
const MAX_MODEL_TEXT_CHARS = Math.max(4000, Number(process.env.JUDGEMENT_METADATA_MAX_TEXT_CHARS || 24000));

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

const COURT_CODES = new Set(COURT_PATTERNS.map((entry) => entry.code));
const WEAK_CASE_NAME_VALUES = new Set(['v', 'v.', 'vs', 'vs.', 'versus']);
const CITATION_REGEXES = [
  /\(\d{4}\)\s*\d+\s*[A-Z][A-Z.\s]{1,40}\s*\d+/g,
  /\d{4}\s+SCC\s+OnLine\s+[A-Za-z]+\s+\d+/g,
  /AIR\s+\d{4}\s+[A-Za-z]+\s+\d+/g,
  /\[\d{4}\]\s*\d+\s*[A-Z][A-Z.\s]{1,40}\s*\d+/g,
];
const DATE_PATTERNS = [
  /DATE OF JUDGMENT\s*[:.-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
  /DATE OF JUDGMENT\s*[:.-]?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
  /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/,
  /\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/,
  /\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/,
];

function cleanLine(line) {
  return String(line || '').replace(/\s+/g, ' ').trim();
}

function safeJsonParse(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (_) {
    const fenced = String(value).match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

function normalizeCitationList(value) {
  const values = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      values
        .map((entry) => cleanLine(entry))
        .filter(Boolean)
    )
  ).slice(0, 20);
}

function normalizeCaseNameForComparison(value) {
  return cleanLine(value)
    .replace(/\bon\s+\d{1,2}\s+[a-z]+\s*,?\s+\d{4}$/i, '')
    .replace(/\s*\(\s*supra\s*\)\s*$/i, '')
    .replace(/\b(vs\.?|versus)\b/gi, 'v')
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase()
    .trim();
}

function hasNamedPartAroundVersus(value) {
  const parts = cleanLine(value).split(/\b(?:v|vs\.?|versus)\b/i);
  if (parts.length < 2) return false;
  return parts.some((part) => /[a-z]{2,}/i.test(part));
}

function isWeakCaseName(value) {
  const normalized = normalizeCaseNameForComparison(value);
  if (!normalized) return true;
  if (WEAK_CASE_NAME_VALUES.has(normalized)) return true;
  if (normalized.length < 6) return true;
  if (/^v(?:s|ersus)?$/.test(normalized)) return true;
  if (/\b(?:v|vs|versus)\b/i.test(value) && !hasNamedPartAroundVersus(value)) return true;
  return false;
}

function stripTrailingDatePhrase(value) {
  return cleanLine(value)
    .replace(/\s+on\s+\d{1,2}\s+[A-Za-z]+\s*,?\s+\d{4}$/i, '')
    .replace(/\s+dated\s+\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/i, '')
    .replace(/\s+on\s+\d{1,2}$/i, '')
    .trim();
}

function looksLikeCitationLine(value) {
  const line = cleanLine(value);
  if (!line) return false;
  if (/^equivalent citations?/i.test(line)) return true;
  if (/^\[?\d{4}\]?[\s:.-]/.test(line) && /SCC|AIR|SCR|Cri|LJ|INSC/i.test(line)) return true;
  return false;
}

function titleCaseCaseName(value) {
  return cleanLine(value)
    .split(' ')
    .map((part) => {
      if (!part) return part;
      if (/^(v|vs|vs\.|v\.|versus)$/i.test(part)) return 'v.';
      if (/^[A-Z]{2,}$/.test(part)) return part;
      if (/^[A-Za-z]\.$/.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function sanitizeCaseName(value, fallbackName = '') {
  const cleaned = stripTrailingDatePhrase(value);
  const titled = titleCaseCaseName(cleaned);

  if (!isWeakCaseName(titled)) {
    return titled;
  }

  const fallback = titleCaseCaseName(
    stripTrailingDatePhrase(
      cleanLine(fallbackName)
        .replace(/\.pdf$/i, '')
        .replace(/[_-]+/g, ' ')
    )
  );

  return isWeakCaseName(fallback) ? titled : fallback;
}

function pickCaseName(lines = [], fallbackName = '') {
  const candidates = lines
    .map((line) => cleanLine(line))
    .filter((line) => line.length >= 8 && line.length <= 240 && !looksLikeCitationLine(line));

  const versusCandidate = candidates.find(
    (line) => /\b(v|vs\.?|versus)\b/i.test(line) && hasNamedPartAroundVersus(line)
  );
  if (versusCandidate) {
    return sanitizeCaseName(versusCandidate, fallbackName);
  }

  const likelyHeading = candidates.find((line) => line.length >= 20);
  if (likelyHeading) {
    return sanitizeCaseName(likelyHeading, fallbackName);
  }

  return sanitizeCaseName(fallbackName, 'Untitled Judgment');
}

function detectCourtCode(text) {
  const normalized = cleanLine(text);
  if (!normalized) return 'UNKNOWN';

  if (COURT_CODES.has(normalized.toUpperCase())) {
    return normalized.toUpperCase();
  }

  const match = COURT_PATTERNS.find((entry) => entry.regex.test(normalized));
  return match ? match.code : 'UNKNOWN';
}

function parseDateString(value) {
  const normalized = cleanLine(value);
  if (!normalized) return null;

  const ddmmyyyy = normalized.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3].length === 2 ? `20${ddmmyyyy[3]}` : ddmmyyyy[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function extractDate(text) {
  const normalizedText = String(text || '');
  for (const pattern of DATE_PATTERNS) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      const parsed = parseDateString(match[1]);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

function extractCitations(text) {
  const allMatches = [];

  for (const regex of CITATION_REGEXES) {
    const matches = String(text || '').match(regex) || [];
    allMatches.push(...matches.map((entry) => cleanLine(entry)));
  }

  return normalizeCitationList(allMatches);
}

function createCanonicalId({
  caseName,
  courtCode,
  judgmentDate,
  year,
  primaryCitation,
  alternateCitations = [],
}) {
  const dateOrYear = judgmentDate || year || 'undated';
  const slug = cleanLine(`${caseName}-${courtCode}-${dateOrYear}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);

  const hash = crypto
    .createHash('sha1')
    .update([
      normalizeCaseNameForComparison(caseName),
      courtCode,
      judgmentDate || '',
      year || '',
      cleanLine(primaryCitation || ''),
      normalizeCitationList(alternateCitations).join('|'),
    ].join('|'))
    .digest('hex')
    .slice(0, 12);

  return `${slug || 'judgment'}-${hash}`;
}

function buildHeuristicMetadata({ fullText, originalFilename, sourceUrl }) {
  const trimmedText = String(fullText || '').trim();
  const lines = trimmedText
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, 60);
  const topText = trimmedText.slice(0, 12000);

  const caseName = pickCaseName(lines, originalFilename);
  const courtCode = detectCourtCode(topText);
  const judgmentDate = extractDate(topText);
  const citations = extractCitations(topText);
  const primaryCitation = citations[0] || null;
  const alternateCitations = citations.slice(1);
  const year = judgmentDate
    ? Number(judgmentDate.slice(0, 4))
    : (() => {
      const citationYear = primaryCitation?.match(/\b(19|20)\d{2}\b/);
      return citationYear ? Number(citationYear[0]) : null;
    })();
  const needsReview =
    isWeakCaseName(caseName) ||
    courtCode === 'UNKNOWN' ||
    (!judgmentDate && !year);

  return {
    caseName: caseName || 'Untitled Judgment',
    courtCode,
    judgmentDate,
    year,
    sourceUrl: cleanLine(sourceUrl),
    primaryCitation,
    alternateCitations,
    canonicalId: createCanonicalId({
      caseName: caseName || originalFilename,
      courtCode,
      judgmentDate,
      year,
      primaryCitation,
      alternateCitations,
    }),
    confidenceScore: needsReview ? 0.58 : 0.82,
    extractionMethod: 'heuristic',
    metadataWarnings: needsReview ? ['heuristic extraction confidence is low'] : [],
    needsReview,
  };
}

function buildGeminiPrompt({ fullText, originalFilename, sourceUrl, heuristicMetadata }) {
  const snippet = String(fullText || '').slice(0, MAX_MODEL_TEXT_CHARS);
  return [
    'You extract metadata for Indian court judgments.',
    'Return JSON only with these keys:',
    'caseName, courtCode, judgmentDate, year, primaryCitation, alternateCitations, confidenceScore, needsReview, warnings.',
    'Rules:',
    '1. caseName must be the actual party title and must not end with publication phrases like "on 21 November, 1990".',
    '2. Prefer the true judgment date over citation years from the body text.',
    '3. If judgmentDate is known, year must equal the date year.',
    '4. courtCode should be one of SC, DELHC, BOMHC, MADHC, CALHC, KARHC, KERHC, ALLHC, P&HHC, GUJHC, RAJHC, NCLAT, NCLT, or UNKNOWN.',
    '5. If the metadata is uncertain, set needsReview=true and explain in warnings.',
    '6. Do not invent citations or dates.',
    '',
    `originalFilename: ${cleanLine(originalFilename) || 'N/A'}`,
    `sourceUrl: ${cleanLine(sourceUrl) || 'N/A'}`,
    `heuristicCaseName: ${heuristicMetadata.caseName || 'N/A'}`,
    `heuristicCourtCode: ${heuristicMetadata.courtCode || 'N/A'}`,
    `heuristicJudgmentDate: ${heuristicMetadata.judgmentDate || 'N/A'}`,
    '',
    'Judgment text snippet:',
    snippet,
  ].join('\n');
}

async function extractMetadataViaGemini({ fullText, originalFilename, sourceUrl, heuristicMetadata }) {
  if (!GOOGLE_API_KEY) {
    return null;
  }

  const prompt = buildGeminiPrompt({
    fullText,
    originalFilename,
    sourceUrl,
    heuristicMetadata,
  });

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${METADATA_MODEL}:generateContent`,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          responseMimeType: 'application/json',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GOOGLE_API_KEY,
        },
        timeout: 60000,
      }
    );

    const text = (response.data?.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => part?.text || '')
      .join('\n')
      .trim();

    return safeJsonParse(text);
  } catch (error) {
    logger.warn('Gemini metadata extraction failed, falling back to heuristics', {
      model: METADATA_MODEL,
      reason: error.message,
    });
    return null;
  }
}

function finalizeMetadata({
  heuristicMetadata,
  modelMetadata,
  originalFilename,
  sourceUrl,
}) {
  const preferredCaseName =
    !isWeakCaseName(modelMetadata?.caseName)
      ? modelMetadata.caseName
      : heuristicMetadata.caseName;
  const caseName = sanitizeCaseName(preferredCaseName, originalFilename);
  const courtCode = detectCourtCode(modelMetadata?.courtCode || heuristicMetadata.courtCode);
  const judgmentDate =
    parseDateString(modelMetadata?.judgmentDate) ||
    parseDateString(modelMetadata?.date) ||
    heuristicMetadata.judgmentDate ||
    null;
  const modelCitations = normalizeCitationList([
    modelMetadata?.primaryCitation || null,
    ...(Array.isArray(modelMetadata?.alternateCitations) ? modelMetadata.alternateCitations : []),
  ]);
  const heuristicCitations = normalizeCitationList([
    heuristicMetadata.primaryCitation || null,
    ...(heuristicMetadata.alternateCitations || []),
  ]);
  const citations = modelCitations.length ? modelCitations : heuristicCitations;
  const primaryCitation = citations[0] || null;
  const alternateCitations = citations.slice(1);
  const year = judgmentDate
    ? Number(judgmentDate.slice(0, 4))
    : Number.isFinite(Number(modelMetadata?.year))
      ? Number(modelMetadata.year)
      : heuristicMetadata.year;
  const metadataWarnings = normalizeCitationList([
    ...(Array.isArray(modelMetadata?.warnings) ? modelMetadata.warnings : []),
    ...(heuristicMetadata.metadataWarnings || []),
  ]);
  const needsReview =
    Boolean(modelMetadata?.needsReview) ||
    isWeakCaseName(caseName) ||
    courtCode === 'UNKNOWN' ||
    (!judgmentDate && !year);
  const confidenceScore = (() => {
    const candidate = Number(modelMetadata?.confidenceScore);
    if (Number.isFinite(candidate) && candidate >= 0 && candidate <= 1) {
      return candidate;
    }
    return needsReview ? 0.6 : 0.92;
  })();

  return {
    caseName: caseName || 'Untitled Judgment',
    courtCode,
    judgmentDate,
    year,
    sourceUrl: cleanLine(sourceUrl),
    primaryCitation,
    alternateCitations,
    canonicalId: createCanonicalId({
      caseName: caseName || originalFilename,
      courtCode,
      judgmentDate,
      year,
      primaryCitation,
      alternateCitations,
    }),
    confidenceScore,
    extractionMethod: modelMetadata ? 'gemini' : heuristicMetadata.extractionMethod,
    metadataWarnings,
    needsReview,
  };
}

async function extractMetadata({ fullText, originalFilename, sourceUrl }) {
  const heuristicMetadata = buildHeuristicMetadata({
    fullText,
    originalFilename,
    sourceUrl,
  });
  const modelMetadata = await extractMetadataViaGemini({
    fullText,
    originalFilename,
    sourceUrl,
    heuristicMetadata,
  });

  return finalizeMetadata({
    heuristicMetadata,
    modelMetadata,
    originalFilename,
    sourceUrl,
  });
}

module.exports = {
  createCanonicalId,
  detectCourtCode,
  extractCitations,
  extractDate,
  extractMetadata,
  isWeakCaseName,
  normalizeCaseNameForComparison,
  normalizeCitationList,
};
