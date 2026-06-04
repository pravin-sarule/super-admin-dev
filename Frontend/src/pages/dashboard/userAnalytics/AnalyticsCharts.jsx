import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { COLORS } from './analyticsFormat';

/* ── cards / layout ── */
export const KpiCard = ({ icon: Icon, label, value, sub, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-slate-50 text-slate-600', blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', cyan: 'bg-cyan-50 text-cyan-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone] || tones.slate}`}><Icon className="w-4 h-4" /></span>}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
};

export const ChartCard = ({ title, subtitle, children, right }) => (
  <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

export const EmptyState = ({ icon: Icon, text }) => (
  <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
    {Icon && <Icon className="w-9 h-9 opacity-30" />}
    <p className="text-sm">{text}</p>
  </div>
);

/* ── donut ── */
export const Donut = ({ data, valueFormatter = (v) => v }) => {
  const rows = (data || []).filter((d) => Number(d.value) > 0);
  if (!rows.length) return <EmptyState text="No data" />;
  const total = rows.reduce((s, r) => s + Number(r.value), 0);
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={92} paddingAngle={1}>
            {rows.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value, name) => [`${valueFormatter(value)} (${total ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`, name]} />
          <Legend verticalAlign="bottom" height={28} iconType="square" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ── storage progress bar (clamps to 100%, red when over) ── */
export const StorageBar = ({ percent, over }) => {
  const p = percent == null ? 0 : percent;
  const width = Math.min(100, Math.max(0, p));
  return (
    <div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : p > 80 ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${width}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-xs">
        <span className={over ? 'text-red-600 font-semibold' : 'text-slate-500'}>{percent == null ? 'No limit set' : `${percent}% used`}</span>
        {over && <span className="text-red-600 font-semibold">Over limit</span>}
      </div>
    </div>
  );
};

/* ── amber banner naming failed DB sections ── */
export const SectionErrorBanner = ({ errors }) => {
  if (!errors || !errors.length) return null;
  return (
    <div className="flex items-start gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>Some data couldn't be loaded ({errors.join(', ')}). The rest is shown below — try refreshing.</span>
    </div>
  );
};

/* ── status pill for payments ── */
export const StatusPill = ({ status }) => {
  const s = String(status || '').toLowerCase();
  const ok = ['captured', 'paid', 'success', 'succeeded'].includes(s);
  const fail = ['failed', 'cancelled', 'canceled'].includes(s);
  const cls = ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : fail ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border capitalize ${cls}`}>{status || 'unknown'}</span>;
};
