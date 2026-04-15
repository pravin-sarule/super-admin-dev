export function formatDate(value) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDuration(durationMs) {
  const milliseconds = Number(durationMs || 0);

  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '0s';
  }

  if (milliseconds < 1000) {
    return `${milliseconds} ms`;
  }

  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

export function prettyStatus(status) {
  return String(status || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isActivePipelineStatus(status) {
  return ['uploaded', 'splitting', 'ocr_processing', 'metadata_extracting', 'indexing'].includes(status);
}

export function buildMetadataForm(detail) {
  const metadata = detail?.upload?.metadata || {};
  const citationData = detail?.judgment?.citation_data || {};

  return {
    caseName: metadata.caseName || detail?.judgment?.case_name || '',
    courtCode: metadata.courtCode || detail?.judgment?.court_code || '',
    judgmentDate: metadata.judgmentDate || (detail?.judgment?.judgment_date || '').slice(0, 10),
    year: metadata.year || detail?.judgment?.year || '',
    primaryCitation: metadata.primaryCitation || citationData.primary_citation || '',
    alternateCitations: (metadata.alternateCitations || citationData.alternate_citations || []).join(', '),
    sourceUrl: metadata.sourceUrl || detail?.upload?.sourceUrl || '',
  };
}

export function hasMetadataDraft(metadataForm) {
  return Object.values(metadataForm || {}).some((value) => String(value || '').trim().length > 0);
}

export function normalizeMetadataPayload(metadataForm) {
  return {
    caseName: metadataForm.caseName,
    courtCode: metadataForm.courtCode,
    judgmentDate: metadataForm.judgmentDate || null,
    year: metadataForm.year ? Number(metadataForm.year) : null,
    primaryCitation: metadataForm.primaryCitation || null,
    alternateCitations: metadataForm.alternateCitations
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    sourceUrl: metadataForm.sourceUrl || null,
  };
}
