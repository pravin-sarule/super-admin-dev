export function formatDateTime(value) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatNumber(value) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString('en-IN') : '0';
}

export function prettyStatus(status) {
  return String(status || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function dedupeWarnings(warnings = []) {
  return warnings.filter((warning, index, items) => (
    items.findIndex((candidate) => (
      candidate.store === warning.store && candidate.message === warning.message
    )) === index
  ));
}
