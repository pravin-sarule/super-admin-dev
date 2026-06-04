// Pure constants + formatters for the user-analytics view (kept separate from components
// so react-refresh / fast-refresh stays happy).

export const COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04', '#64748b'];

const KB = 1024, MB = KB * 1024, GB = MB * 1024;

export const fmtBytes = (b) => {
  const n = Number(b) || 0;
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  if (n >= KB) return `${(n / KB).toFixed(1)} KB`;
  return `${n} B`;
};
export const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
export const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
