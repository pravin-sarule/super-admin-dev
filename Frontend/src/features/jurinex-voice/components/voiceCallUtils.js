const IST_TIME_ZONE = 'Asia/Kolkata';

export const COLORS = ['#5f85f6', '#4cc4e8', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'];

export const todayInput = () => new Date().toISOString().slice(0, 10);

export const monthStartInput = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

export const formatDateLabel = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIME_ZONE,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));
  return `${formatted.replace(',', '')} IST`;
};

export const formatDuration = (seconds) => {
  const total = Math.max(Number(seconds) || 0, 0);
  const mins = Math.floor(total / 60);
  const secs = Math.round(total % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export const formatDurationLong = (seconds) => {
  const total = Math.max(Number(seconds) || 0, 0);
  const mins = Math.floor(total / 60);
  const secs = Math.round(total % 60);
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

export const formatLatency = (ms) => {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '—';
  return `${Math.round(Number(ms))}ms`;
};

export const formatCurrency = (value) => {
  if (value === null || value === undefined || Number(value) === 0) return '—';
  return `$${Number(value).toFixed(3)}`;
};

export const formatPercent = (ratio) => {
  const value = Number(ratio) || 0;
  return `${Math.round(value * 100)}%`;
};

export const titleize = (value) => {
  if (!value) return 'Unknown';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
};

export const shortCallId = (id) => {
  if (!id) return '—';
  return `call_${String(id).replace(/-/g, '').slice(0, 24)}`;
};

export const maskPhone = (value, show = false) => {
  if (!value) return '—';
  const raw = String(value);
  if (show || raw.length < 7) return raw;
  return `${raw.slice(0, 3)}••••${raw.slice(-3)}`;
};

export const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const downloadCsv = (filename, rows) => {
  const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
