const repository = require('./judgementRepository');
const {
  normalizeCaseNameForComparison,
  normalizeCitationList,
} = require('./metadataService');
const { generateEmbeddings } = require('./embeddingService');
const { searchChunksByVector } = require('./qdrantService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('DuplicateDetection');
const FINGERPRINT_SCORE_THRESHOLD = Number(
  process.env.DUPLICATE_FINGERPRINT_SCORE_THRESHOLD || 0.93
);
const FINGERPRINT_TEXT_LENGTH = Math.max(
  400,
  Number(process.env.DUPLICATE_FINGERPRINT_TEXT_LENGTH || 1200)
);
const FINGERPRINT_SEARCH_LIMIT = Math.max(
  3,
  Number(process.env.DUPLICATE_FINGERPRINT_SEARCH_LIMIT || 15)
);
const FINGERPRINT_MAX_MATCHES = Math.max(
  1,
  Number(process.env.DUPLICATE_FINGERPRINT_MAX_MATCHES || 5)
);

const USER_GENERATED_SOURCE_TYPES = new Set([
  'indian_kanoon',
  'google',
  'google_grounding',
  'ik_pipeline',
]);

function toSourceBucket(sourceType) {
  return sourceType === 'admin-upload' ? 'admin_uploaded' : 'user_generated';
}

function sourceScopeToSourceTypes(scope) {
  const normalized = String(scope || '').trim().toLowerCase();

  if (!normalized || normalized === 'all') {
    return null;
  }

  if (normalized === 'admin_uploaded') {
    return ['admin-upload'];
  }

  if (normalized === 'user_generated') {
    return Array.from(USER_GENERATED_SOURCE_TYPES);
  }

  return null;
}

function normalizeCitation(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function normalizeCaseTokens(value) {
  return Array.from(
    new Set(
      normalizeCaseNameForComparison(value)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && token !== 'and' && token !== 'ors')
    )
  );
}

function jaccardSimilarity(leftTokens = [], rightTokens = []) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);

  if (!left.size || !right.size) {
    return 0;
  }

  let intersection = 0;
  left.forEach((token) => {
    if (right.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...left, ...right]).size || 1;
  return intersection / union;
}

function buildCandidateMatch(metadata, candidate) {
  const reasons = [];
  let score = 0;

  const metadataCitations = normalizeCitationList([
    metadata.primaryCitation || null,
    ...(metadata.alternateCitations || []),
  ]).map(normalizeCitation);
  const candidateCitations = normalizeCitationList([
    candidate?.citation_data?.primary_citation || null,
    ...(candidate?.citation_data?.alternate_citations || []),
  ]).map(normalizeCitation);
  const overlappingCitations = metadataCitations.filter((citation) => candidateCitations.includes(citation));

  if (overlappingCitations.length) {
    score += 10;
    reasons.push('citation match');
  }

  const normalizedMetadataCase = normalizeCaseNameForComparison(metadata.caseName);
  const normalizedCandidateCase = normalizeCaseNameForComparison(candidate.case_name);
  if (normalizedMetadataCase && normalizedMetadataCase === normalizedCandidateCase) {
    score += 6;
    reasons.push('case name exact');
  }

  const tokenSimilarity = jaccardSimilarity(
    normalizeCaseTokens(metadata.caseName),
    normalizeCaseTokens(candidate.case_name)
  );
  if (tokenSimilarity >= 0.8) {
    score += 4;
    reasons.push(`case name overlap ${Math.round(tokenSimilarity * 100)}%`);
  }

  if (metadata.courtCode && candidate.court_code && metadata.courtCode === candidate.court_code) {
    score += 2;
    reasons.push('court match');
  }

  if (metadata.judgmentDate && candidate.judgment_date) {
    const candidateDate = String(candidate.judgment_date).slice(0, 10);
    if (metadata.judgmentDate === candidateDate) {
      score += 5;
      reasons.push('judgment date match');
    }
  } else if (metadata.year && candidate.year && Number(metadata.year) === Number(candidate.year)) {
    score += 1;
    reasons.push('year match');
  }

  const isDuplicate =
    overlappingCitations.length > 0 ||
    (
      tokenSimilarity >= 0.8 &&
      metadata.courtCode === candidate.court_code &&
      (
        (metadata.judgmentDate && String(candidate.judgment_date).slice(0, 10) === metadata.judgmentDate) ||
        (metadata.year && Number(candidate.year) === Number(metadata.year))
      )
    ) ||
    (
      normalizedMetadataCase &&
      normalizedMetadataCase === normalizedCandidateCase &&
      (
        overlappingCitations.length > 0 ||
        (metadata.year && Number(candidate.year) === Number(metadata.year))
      )
    );

  return {
    isDuplicate,
    score,
    reasons,
    candidate: {
      judgmentUuid: candidate.judgment_uuid,
      canonicalId: candidate.canonical_id,
      caseName: candidate.case_name,
      courtCode: candidate.court_code,
      judgmentDate: candidate.judgment_date,
      year: candidate.year,
      sourceType: candidate.source_type,
      sourceBucket: toSourceBucket(candidate.source_type),
      citationData: candidate.citation_data || {},
    },
  };
}

async function findPotentialDuplicateJudgments(metadata, { excludeJudgmentUuid = null } = {}) {
  const judgments = await repository.listJudgmentIdentities({ excludeJudgmentUuid });
  return judgments
    .map((candidate) => buildCandidateMatch(metadata, candidate))
    .filter((match) => match.isDuplicate)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

async function findContentFingerprintDuplicates(fullText, {
  excludeJudgmentUuid = null,
  scoreThreshold = FINGERPRINT_SCORE_THRESHOLD,
  textLength = FINGERPRINT_TEXT_LENGTH,
  searchLimit = FINGERPRINT_SEARCH_LIMIT,
  maxMatches = FINGERPRINT_MAX_MATCHES,
} = {}) {
  const fingerprintText = String(fullText || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, textLength);

  if (fingerprintText.length < 200) {
    return [];
  }

  const startedAt = Date.now();

  let vector;
  try {
    const { vectors } = await generateEmbeddings([fingerprintText], {
      taskType: 'RETRIEVAL_QUERY',
    });
    vector = Array.isArray(vectors) ? vectors[0] : null;
  } catch (error) {
    logger.warn('Fingerprint embedding failed; skipping content-based duplicate check', {
      reason: error.message,
    });
    return [];
  }

  if (!Array.isArray(vector) || !vector.length) {
    return [];
  }

  let points = [];
  try {
    points = await searchChunksByVector({
      vector,
      limit: searchLimit,
      scoreThreshold,
      ...(excludeJudgmentUuid
        ? {
          filter: {
            must_not: [
              { key: 'judgment_uuid', match: { value: excludeJudgmentUuid } },
            ],
          },
        }
        : {}),
    });
  } catch (error) {
    logger.warn('Fingerprint Qdrant search failed', {
      reason: error.message,
      scoreThreshold,
    });
    return [];
  }

  if (!points.length) {
    logger.info('Fingerprint check found no near-duplicate', {
      scoreThreshold,
      durationMs: Date.now() - startedAt,
    });
    return [];
  }

  const bestByUuid = new Map();
  for (const point of points) {
    const judgmentUuid = point?.payload?.judgment_uuid;
    if (!judgmentUuid) continue;
    if (excludeJudgmentUuid && judgmentUuid === excludeJudgmentUuid) continue;
    const current = bestByUuid.get(judgmentUuid);
    if (!current || Number(current.score || 0) < Number(point.score || 0)) {
      bestByUuid.set(judgmentUuid, point);
    }
  }

  const uniqueUuids = Array.from(bestByUuid.keys()).slice(0, maxMatches);
  if (!uniqueUuids.length) {
    return [];
  }

  const candidates = await repository.getJudgmentsByUuids(uniqueUuids);
  const candidatesByUuid = new Map(
    candidates.map((row) => [row.judgment_uuid, row])
  );

  const matches = uniqueUuids
    .map((judgmentUuid) => {
      const point = bestByUuid.get(judgmentUuid);
      const candidate = candidatesByUuid.get(judgmentUuid);
      if (!candidate) return null;

      const rawScore = Number(point?.score || 0);
      const similarityPct = Math.round(rawScore * 100);

      return {
        isDuplicate: true,
        score: Math.min(20, Math.round(rawScore * 20)),
        reasons: [`content fingerprint similarity ${similarityPct}%`],
        candidate: {
          judgmentUuid: candidate.judgment_uuid,
          canonicalId: candidate.canonical_id,
          caseName: candidate.case_name,
          courtCode: candidate.court_code,
          judgmentDate: candidate.judgment_date,
          year: candidate.year,
          sourceType: candidate.source_type,
          sourceBucket: toSourceBucket(candidate.source_type),
          citationData: candidate.citation_data || {},
        },
        matchType: 'content_fingerprint',
        similarity: rawScore,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.similarity - left.similarity);

  logger.warn('Fingerprint check found near-duplicate candidates', {
    scoreThreshold,
    matchCount: matches.length,
    topSimilarity: matches[0]?.similarity || 0,
    durationMs: Date.now() - startedAt,
    topCandidates: matches.slice(0, 3).map((match) => ({
      judgmentUuid: match.candidate.judgmentUuid,
      canonicalId: match.candidate.canonicalId,
      sourceType: match.candidate.sourceType,
      similarity: match.similarity,
    })),
  });

  return matches;
}

module.exports = {
  findPotentialDuplicateJudgments,
  findContentFingerprintDuplicates,
  sourceScopeToSourceTypes,
  toSourceBucket,
  USER_GENERATED_SOURCE_TYPES,
};
