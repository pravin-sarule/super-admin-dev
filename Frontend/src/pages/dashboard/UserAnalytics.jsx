import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, RefreshCw, BarChart3, Repeat, Coins, HardDrive, CreditCard, Cpu, Layers,
  Building2, User, Lock, Mail, Calendar, Zap, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { COLORS, fmtBytes, fmtNum, fmtINR, fmtDate } from './userAnalytics/analyticsFormat';
import {
  KpiCard, ChartCard, EmptyState, Donut, StorageBar, SectionErrorBanner, StatusPill,
} from './userAnalytics/AnalyticsCharts';
import { fetchUserAnalytics, fetchUserStorage, fetchUserTokenSeries, fetchUserAiUsage, fetchFirmAnalytics } from './userAnalytics/analyticsApi';

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'plan', label: 'Plan & Billing', icon: Repeat },
  { key: 'tokens', label: 'Token Usage', icon: Coins },
  { key: 'storage', label: 'Storage', icon: HardDrive },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'ai', label: 'AI Usage', icon: Cpu },
];

const PERIODS = [
  { d: 7, label: '7 days' }, { d: 15, label: '15 days' }, { d: 30, label: '30 days' },
  { d: 90, label: 'Quarter' }, { d: 180, label: 'Half year' }, { d: 365, label: 'Year' },
];
const PeriodSelect = ({ value, onChange }) => (
  <select value={value} onChange={(e) => onChange(Number(e.target.value))}
    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/25 hover:border-slate-300">
    {PERIODS.map((p) => <option key={p.d} value={p.d}>{p.label}</option>)}
  </select>
);
const xTick = (d) => fmtDate(d).replace(/ \d{4}$/, '');

const Skeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}</div>
    <div className="h-64 bg-slate-100 rounded-xl" />
  </div>
);

/* ── token cards (shared) ── */
const TokenCards = ({ t }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
    <KpiCard icon={Calendar} tone="blue" label="Today" value={fmtNum(t.today)} sub="IST calendar day" />
    <KpiCard icon={Coins} tone="blue" label="This period" value={fmtNum(t.this_period)} />
    <KpiCard icon={Layers} tone="slate" label="All-time" value={fmtNum(t.all_time)} />
    <KpiCard icon={Repeat} tone="violet" label="Plan tokens left" value={fmtNum(t.plan_tokens_left)} sub={`of ${fmtNum(t.monthly_tokens)}/mo`} />
    <KpiCard icon={Zap} tone={t.topup_expired ? 'red' : 'amber'} label="Top-up balance" value={fmtNum(t.topup_balance)} sub={t.topup_expired ? 'Expired' : 'Active'} />
    <KpiCard icon={Coins} tone="emerald" label="Total available" value={fmtNum(t.total_available)} />
  </div>
);

/* ── plan card (user mode) ── */
const PlanCard = ({ plan, addons }) => {
  const p = plan?.data;
  const purchasedAddons = addons?.data?.purchased || [];
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              <Repeat className="w-3.5 h-3.5" />{p?.plan_name || 'Free'}
            </span>
            {p?.is_legacy && <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">Legacy plan</span>}
            {p?.status && <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 capitalize">{p.status}</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-slate-400 uppercase tracking-wide">Monthly tokens</p><p className="font-semibold text-slate-800">{fmtNum(p?.monthly_tokens)}</p></div>
          <div><p className="text-xs text-slate-400 uppercase tracking-wide">Tokens used</p><p className="font-semibold text-slate-800">{fmtNum(p?.plan_tokens_used)}</p></div>
          <div><p className="text-xs text-slate-400 uppercase tracking-wide">Storage limit</p><p className="font-semibold text-slate-800">{p?.storage_limit_gb != null ? `${p.storage_limit_gb} GB` : 'No cap'}</p></div>
          <div><p className="text-xs text-slate-400 uppercase tracking-wide">Billing period start</p><p className="font-semibold text-slate-800">{fmtDate(p?.billing_period_start)}</p></div>
          <div><p className="text-xs text-slate-400 uppercase tracking-wide">Ends</p><p className="font-semibold text-slate-800">{fmtDate(p?.end_date)}</p></div>
          <div><p className="text-xs text-slate-400 uppercase tracking-wide">Top-up balance</p><p className="font-semibold text-slate-800">{fmtNum(p?.topup_token_balance)}{p?.topup_expires_at ? ` (exp ${fmtDate(p.topup_expires_at)})` : ''}</p></div>
        </div>
      </div>

      <ChartCard title="Add-ons" subtitle={purchasedAddons.length ? `${purchasedAddons.length} purchased` : 'Storage add-ons'}>
        {addons?.data?.tracked === false && (
          <div className="flex items-start gap-2 px-3.5 py-2.5 mb-3 rounded-lg bg-amber-50/70 border border-amber-100 text-xs text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Add-on purchase data is unavailable right now. Showing the active add-on catalog.</span>
          </div>
        )}
        {purchasedAddons.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                <th className="px-3 py-2 text-left">Add-on</th><th className="px-3 py-2 text-right">Storage</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Purchased</th><th className="px-3 py-2 text-left">Expires</th>
              </tr></thead>
              <tbody>
                {purchasedAddons.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{a.plan_name || (a.storage_gb ? `+${a.storage_gb} GB Storage` : 'Storage add-on')}</td>
                    <td className="px-3 py-2 text-right">{fmtBytes(a.storage_bytes_granted)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtINR(a.amount)} {a.currency || ''}</td>
                    <td className="px-3 py-2"><StatusPill status={a.status} /></td>
                    <td className="px-3 py-2 text-slate-600">{fmtDate(a.created_at)}</td>
                    <td className="px-3 py-2 text-slate-600">{fmtDate(a.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-2">No add-ons purchased by this user. Available catalog:</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="px-3 py-2 text-left">Add-on</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Storage</th><th className="px-3 py-2 text-left">Billing</th>
                </tr></thead>
                <tbody>
                  {(addons?.data?.catalog || []).length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No add-ons configured.</td></tr>
                  ) : addons.data.catalog.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">{a.name}</td>
                      <td className="px-3 py-2 text-right">{fmtINR(a.price)}</td>
                      <td className="px-3 py-2 text-right">{a.storage_gb >= 1024 ? `${a.storage_gb / 1024} TB` : `${a.storage_gb} GB`}</td>
                      <td className="px-3 py-2 capitalize">{a.billing_type === 'one_time' ? `One-time (${a.validity_years || '—'} yr)` : `${a.billing_interval_months || 1} mo cycle`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ChartCard>
    </div>
  );
};

const TypeBadge = ({ type }) => {
  const cfg = type === 'topup' ? { c: 'bg-amber-50 text-amber-700 border-amber-100', i: Zap, t: 'Top-up' }
    : type === 'addon' ? { c: 'bg-cyan-50 text-cyan-700 border-cyan-100', i: HardDrive, t: 'Add-on' }
    : { c: 'bg-blue-50 text-blue-700 border-blue-100', i: Repeat, t: 'Plan' };
  const Icon = cfg.i;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.c}`}>
      <Icon className="w-2.5 h-2.5" />{cfg.t}
    </span>
  );
};

const PaymentsView = ({ data }) => {
  const items = Array.isArray(data) ? data : (data?.items || []);
  const summary = (data && !Array.isArray(data) && data.summary) || null;
  const byMonth = (data && !Array.isArray(data) && data.by_month) || [];
  const donut = summary ? [{ name: 'Plan', value: summary.plan_total }, { name: 'Top-up', value: summary.topup_total }, { name: 'Add-on', value: summary.addon_total || 0 }] : [];
  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiCard icon={CreditCard} tone="emerald" label="Total paid" value={fmtINR(summary.total)} sub={`${summary.plan_count + summary.topup_count + (summary.addon_count || 0)} payments`} />
          <KpiCard icon={Repeat} tone="blue" label="Plan payments" value={fmtINR(summary.plan_total)} sub={`${summary.plan_count} payment${summary.plan_count !== 1 ? 's' : ''}`} />
          <KpiCard icon={Zap} tone="amber" label="Top-up payments" value={fmtINR(summary.topup_total)} sub={`${summary.topup_count} purchase${summary.topup_count !== 1 ? 's' : ''}`} />
          <KpiCard icon={HardDrive} tone="cyan" label="Add-on payments" value={fmtINR(summary.addon_total || 0)} sub={`${summary.addon_count || 0} purchase${(summary.addon_count || 0) !== 1 ? 's' : ''}`} />
          <KpiCard icon={Coins} tone="violet" label="Top-up tokens" value={fmtNum(summary.topup_tokens)} sub="credited" />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Spend by type" subtitle={summary ? `Total ${fmtINR(summary.total)}` : undefined}><Donut data={donut} valueFormatter={(v) => fmtINR(v)} /></ChartCard>
        <ChartCard title="Monthly spend">
          {byMonth.length === 0 ? <EmptyState icon={CreditCard} text="No paid payments yet." /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v, n) => [fmtINR(v), n === 'topup' ? 'Top-up' : n === 'addon' ? 'Add-on' : 'Plan']} />
                  <Bar dataKey="plan" stackId="a" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="topup" stackId="a" fill={COLORS[4]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="addon" stackId="a" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
      <PaymentHistory items={items} />
    </div>
  );
};

/* ── payment history table with type filter + pagination (10/page) ── */
const PaymentHistory = ({ items }) => {
  const [typeFilter, setTypeFilter] = useState('all'); // all | plan | topup
  const [page, setPage] = useState(1);
  const PER = 10;

  const counts = { all: items.length, plan: items.filter((i) => i.type === 'plan').length, topup: items.filter((i) => i.type === 'topup').length, addon: items.filter((i) => i.type === 'addon').length };
  const filtered = typeFilter === 'all' ? items : items.filter((i) => i.type === typeFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const cur = Math.min(page, totalPages);
  const pageItems = filtered.slice((cur - 1) * PER, cur * PER);
  const setFilter = (k) => { setTypeFilter(k); setPage(1); };

  const filterBtns = (
    <div className="flex items-center gap-1">
      {[['all', 'All'], ['plan', 'Plan'], ['topup', 'Top-up'], ['addon', 'Add-on']].map(([k, label]) => (
        <button key={k} onClick={() => setFilter(k)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${typeFilter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          {label} <span className="opacity-70">{counts[k]}</span>
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard title="Payment history" subtitle={`${filtered.length} of ${items.length} · plans + top-ups`} right={items.length > 0 ? filterBtns : undefined}>
      {items.length === 0 ? <EmptyState icon={CreditCard} text="No payments yet." /> : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Plan / Pack</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Method</th>
              </tr></thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No {typeFilter} payments.</td></tr>
                ) : pageItems.map((p) => (
                  <tr key={`${p.type}-${p.id}`} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                    <td className="px-3 py-2"><TypeBadge type={p.type} /></td>
                    <td className="px-3 py-2 text-slate-700">
                      {p.plan_name}
                      {p.type === 'topup' && p.tokens_credited ? <span className="text-xs text-slate-400"> · {fmtNum(p.tokens_credited)} tokens{p.expires_at ? `, exp ${fmtDate(p.expires_at)}` : ''}</span> : null}
                      {p.type === 'addon' && p.storage_bytes_granted ? <span className="text-xs text-slate-400"> · {fmtBytes(p.storage_bytes_granted)}{p.expires_at ? `, exp ${fmtDate(p.expires_at)}` : ''}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtINR(p.amount)} {p.currency || ''}</td>
                    <td className="px-3 py-2"><StatusPill status={p.status} /></td>
                    <td className="px-3 py-2 text-slate-500 capitalize">{p.payment_method || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
              <span className="text-xs text-slate-400">Showing {(cur - 1) * PER + 1}–{Math.min(cur * PER, filtered.length)} of {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button disabled={cur <= 1} onClick={() => setPage(cur - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-medium text-slate-600 px-2">Page {cur} / {totalPages}</span>
                <button disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      )}
    </ChartCard>
  );
};

const AiUsage = ({ byModel, totals, daily, days, onDays, loading, allTime }) => {
  const rows = byModel || [];
  const t = totals || { total_tokens: 0, total_cost: 0, requests: 0 };
  const costData = rows.map((r) => ({ name: r.model_name || 'unknown', value: Number(r.total_cost) || 0 }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-700">AI / LLM usage by model</p>
          <p className="text-xs text-slate-400">{allTime ? 'All-time aggregate across firm members' : `Tokens, cost & requests for the selected period`}</p>
        </div>
        {!allTime && onDays && <PeriodSelect value={days} onChange={onDays} />}
      </div>

      {!allTime && (
        <ChartCard title="Daily AI tokens & cost" subtitle={`Last ${days} days`}>
          {loading ? <EmptyState icon={Cpu} text="Loading…" />
            : !daily || daily.length === 0 ? <EmptyState icon={Cpu} text="No AI usage in this period." />
            : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={daily} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={xTick} />
                    <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip labelFormatter={(d) => fmtDate(d)} formatter={(v, n) => (n === 'total_cost' ? [fmtINR(v), 'Cost'] : [fmtNum(v), 'Tokens'])} />
                    <Bar yAxisId="l" dataKey="total_tokens" name="total_tokens" fill={COLORS[0]} radius={[3, 3, 0, 0]} barSize={daily.length > 60 ? 3 : undefined} />
                    <Line yAxisId="r" dataKey="total_cost" name="total_cost" stroke={COLORS[4]} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cost by model" subtitle={`Total ${fmtINR(t.total_cost)}`}><Donut data={costData} valueFormatter={(v) => fmtINR(v)} /></ChartCard>
        <ChartCard title="Tokens by model">
          {rows.length === 0 ? <EmptyState icon={Cpu} text="No AI usage." /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows.map((r) => ({ name: r.model_name || 'unknown', tokens: Number(r.total_tokens) || 0 }))} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                  <Tooltip formatter={(v) => fmtNum(v)} />
                  <Bar dataKey="tokens" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Per-model breakdown">
        {rows.length === 0 ? <EmptyState icon={Cpu} text="No AI usage." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                <th className="px-3 py-2 text-left">Model</th><th className="px-3 py-2 text-right">Input</th><th className="px-3 py-2 text-right">Output</th><th className="px-3 py-2 text-right">Total tokens</th><th className="px-3 py-2 text-right">Requests</th><th className="px-3 py-2 text-right">Cost</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.model_name} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{r.model_name || 'unknown'}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNum(r.input_tokens)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNum(r.output_tokens)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtNum(r.total_tokens)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNum(r.requests)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtINR(r.total_cost)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold text-slate-800">
                  <td className="px-3 py-2">Total</td><td /><td /><td className="px-3 py-2 text-right">{fmtNum(t.total_tokens)}</td><td className="px-3 py-2 text-right">{fmtNum(t.requests)}</td><td className="px-3 py-2 text-right">{fmtINR(t.total_cost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
};

const StorageView = ({ storage, loading, error, onRetry }) => {
  if (loading) return <Skeleton />;
  if (error) return <EmptyState icon={AlertTriangle} text={`Storage failed to load: ${error}`} />;
  if (!storage) return <button onClick={onRetry} className="text-sm text-blue-600 hover:underline">Load storage</button>;
  const donut = storage.breakdown.filter((b) => b.bytes > 0).map((b) => ({ name: b.label, value: b.bytes }));
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-5 shadow-sm ${storage.over_limit ? 'bg-red-50/40 border-red-200' : 'bg-white border-slate-200'}`}>
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{fmtBytes(storage.total_bytes)}</span>
            <span className="text-sm text-slate-400">of {storage.limit_gb != null ? `${storage.limit_gb} GB` : 'unlimited'}</span>
            {storage.over_limit && <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-700">Storage Full</span>}
          </div>
          {storage.used_percent != null && <span className={`text-2xl font-bold ${storage.over_limit ? 'text-red-600' : 'text-slate-700'}`}>{storage.used_percent}%</span>}
        </div>
        <StorageBar percent={storage.used_percent} over={storage.over_limit} />
        {storage.addon_limit_bytes > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            {storage.base_limit_gb != null ? `${storage.base_limit_gb} GB plan` : 'No plan limit'}
            {' + '}<span className="font-medium text-cyan-700">{fmtBytes(storage.addon_limit_bytes)}</span> from {storage.addon_purchases} add-on{storage.addon_purchases !== 1 ? 's' : ''}
            {' = '}<span className="font-medium">{fmtBytes(storage.limit_bytes)}</span> total
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="What's using storage"><Donut data={donut} valueFormatter={(v) => fmtBytes(v)} /></ChartCard>
        <ChartCard title="Breakdown">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                <th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Items</th><th className="px-3 py-2 text-right">Size</th>
              </tr></thead>
              <tbody>
                {storage.breakdown.map((b) => (
                  <tr key={b.key} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{b.label}{!b.ok && <span className="ml-2 text-[10px] text-red-500">unavailable</span>}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{b.count != null ? fmtNum(b.count) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{fmtBytes(b.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

/* ─────────────────────────── Page ─────────────────────────── */
const UserAnalytics = ({ mode: modeProp }) => {
  const { userId, firmId } = useParams();
  const navigate = useNavigate();
  const mode = modeProp === 'firm' || firmId ? 'firm' : 'user';
  const id = mode === 'firm' ? firmId : userId;

  const [tab, setTab] = useState('overview');
  const [main, setMain] = useState(null);
  const [mainLoading, setMainLoading] = useState(true);
  const [mainErr, setMainErr] = useState(null);

  const [days, setDays] = useState(30); // chart/AI window: 7/15/30/90/180/365
  const [series, setSeries] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [storage, setStorage] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageErr, setStorageErr] = useState(null);

  // Firm mode: which member to scope storage/series to.
  const [memberId, setMemberId] = useState(null);

  const loadMain = useCallback(async () => {
    setMainLoading(true); setMainErr(null);
    try {
      const res = mode === 'firm' ? await fetchFirmAnalytics(id) : await fetchUserAnalytics(id);
      setMain(res.data);
    } catch (e) { setMainErr(e.message || 'Failed to load analytics'); }
    finally { setMainLoading(false); }
  }, [id, mode]);

  const loadStorage = useCallback(async (targetUserId) => {
    if (!targetUserId) return;
    setStorageLoading(true); setStorageErr(null);
    try { const res = await fetchUserStorage(targetUserId); setStorage(res.data); }
    catch (e) { setStorageErr(e.message || 'Failed'); }
    finally { setStorageLoading(false); }
  }, []);

  const loadSeries = useCallback(async (targetUserId, d) => {
    if (!targetUserId) return;
    try { const res = await fetchUserTokenSeries(targetUserId, d); setSeries(res.data.series); }
    catch { setSeries([]); }
  }, []);

  const loadAiUsage = useCallback(async (targetUserId, d) => {
    if (!targetUserId) return;
    setAiLoading(true);
    try { const res = await fetchUserAiUsage(targetUserId, d); setAiUsage(res.data); }
    catch { setAiUsage(null); }
    finally { setAiLoading(false); }
  }, []);

  useEffect(() => { loadMain(); }, [loadMain]);
  // Storage loads once per target (independent of the time window).
  useEffect(() => { if (mode === 'user' && id) loadStorage(id); }, [mode, id, loadStorage]);
  useEffect(() => { if (mode === 'firm' && memberId) loadStorage(memberId); }, [mode, memberId, loadStorage]);
  // Series + AI usage re-fetch whenever the target OR the selected window changes.
  useEffect(() => { if (mode === 'user' && id) { loadSeries(id, days); loadAiUsage(id, days); } }, [mode, id, days, loadSeries, loadAiUsage]);
  useEffect(() => { if (mode === 'firm' && memberId) { loadSeries(memberId, days); loadAiUsage(memberId, days); } }, [mode, memberId, days, loadSeries, loadAiUsage]);

  const headerTitle = mode === 'firm'
    ? (main?.firm?.firm_name || 'Firm')
    : (main?.user?.username || `User #${id}`);
  const headerSub = mode === 'firm'
    ? `${main?.firm?.member_count ?? 0} members · ${main?.firm?.approval_status || ''}`
    : (main?.user?.email || '');

  const tokens = mode === 'firm' ? main?.aggregate?.tokens : main?.tokens?.data;
  const ai = mode === 'firm' ? { data: main?.aggregate?.ai_usage } : main?.ai_usage;
  const paymentsData = mode === 'firm' ? main?.aggregate?.payments : main?.payments?.data;
  const members = mode === 'firm' ? (main?.members || []) : [];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate(-1)} className="mt-1 p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                {mode === 'firm' ? <Building2 className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-white" />}
              </div>
              <h1 className="text-xl font-bold text-slate-800">{headerTitle}</h1>
              {mode === 'user' && main?.user?.is_blocked && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-red-700 border border-red-100"><Lock className="w-3 h-3" />Blocked</span>}
            </div>
            <p className="text-sm text-slate-500 ml-11">{headerSub}</p>
          </div>
        </div>
        <button onClick={loadMain} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${mainLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {mainErr ? (
        <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
          <AlertTriangle className="w-10 h-10 opacity-40" />
          <p className="text-sm">{mainErr}</p>
          <button onClick={loadMain} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Retry</button>
        </div>
      ) : mainLoading ? <Skeleton /> : (
        <>
          <SectionErrorBanner errors={main?.meta?.section_errors} />

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <t.icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </div>

          {/* Firm member selector (firm mode, storage/token tabs) */}
          {mode === 'firm' && (tab === 'storage' || tab === 'tokens') && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Member:</span>
              <select value={memberId || ''} onChange={(e) => setMemberId(e.target.value || null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="">Select a member…</option>
                {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.username} ({m.user.role || 'member'})</option>)}
              </select>
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && tokens && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                {mode === 'firm'
                  ? <KpiCard icon={Building2} tone="violet" label="Members" value={fmtNum(main?.firm?.member_count)} />
                  : <KpiCard icon={Repeat} tone="blue" label="Plan" value={main?.plan?.data?.plan_name || 'Free'} sub={main?.plan?.data?.is_legacy ? 'Legacy' : undefined} />}
                <KpiCard icon={Calendar} tone="blue" label="Tokens today" value={fmtNum(tokens.today)} />
                <KpiCard icon={Coins} tone="slate" label="Tokens this period" value={fmtNum(tokens.this_period)} />
                <KpiCard icon={Cpu} tone="emerald" label="AI cost" value={fmtINR(ai?.data?.totals?.total_cost)} />
                {mode === 'user'
                  ? <KpiCard icon={HardDrive} tone={storage?.over_limit ? 'red' : 'cyan'} label="Storage"
                      value={storageLoading ? '…' : storageErr ? '—' : storage?.used_percent != null ? `${storage.used_percent}%` : (storage ? fmtBytes(storage.total_bytes) : '—')}
                      sub={storageLoading ? 'loading…' : storageErr ? 'unavailable' : storage ? fmtBytes(storage.total_bytes) : 'no limit set'} />
                  : <KpiCard icon={CreditCard} tone="emerald" label="Payments" value={fmtINR(main?.aggregate?.payments_total)} sub={`${main?.aggregate?.payment_count || 0} total`} />}
              </div>
              <ChartCard title={`Token usage — last ${days} days`} subtitle={mode === 'firm' ? 'Select a member to view trend' : 'IST daily totals'} right={mode === 'user' ? <PeriodSelect value={days} onChange={setDays} /> : undefined}>
                {!series || series.length === 0 ? <EmptyState icon={BarChart3} text={mode === 'firm' ? 'Pick a member in the Token Usage tab.' : 'No usage in the last 30 days.'} /> : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series} margin={{ left: 8, right: 8 }}>
                        <defs><linearGradient id="tok" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.3} /><stop offset="100%" stopColor={COLORS[0]} stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => fmtDate(d).replace(/ \d{4}$/, '')} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                        <Tooltip formatter={(v) => fmtNum(v)} labelFormatter={(d) => fmtDate(d)} />
                        <Area type="monotone" dataKey="total_tokens" stroke={COLORS[0]} fill="url(#tok)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>
          )}

          {/* ── PLAN & BILLING ── */}
          {tab === 'plan' && (
            mode === 'user'
              ? <PlanCard plan={main?.plan} addons={main?.addons} />
              : <ChartCard title="Member plans" subtitle={`${members.length} members`}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase"><th className="px-3 py-2 text-left">Member</th><th className="px-3 py-2 text-left">Role</th><th className="px-3 py-2 text-left">Plan</th><th className="px-3 py-2 text-right">Payments</th></tr></thead>
                      <tbody>{members.map((m) => (
                        <tr key={m.user.id} className="border-b border-slate-100"><td className="px-3 py-2 text-slate-700">{m.user.username}</td><td className="px-3 py-2 text-slate-500 capitalize">{m.user.role || '—'}</td><td className="px-3 py-2">{m.plan_name}</td><td className="px-3 py-2 text-right">{fmtINR(m.payments_total)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </ChartCard>
          )}

          {/* ── TOKEN USAGE ── */}
          {tab === 'tokens' && tokens && (
            <div className="space-y-4">
              <TokenCards t={tokens} />
              {mode === 'firm' ? (
                <ChartCard title="Per-member tokens" subtitle={`${members.length} members`}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase"><th className="px-3 py-2 text-left">Member</th><th className="px-3 py-2 text-right">Today</th><th className="px-3 py-2 text-right">This period</th><th className="px-3 py-2 text-right">All-time</th><th className="px-3 py-2 text-right">AI cost</th></tr></thead>
                      <tbody>{members.map((m) => (
                        <tr key={m.user.id} className="border-b border-slate-100"><td className="px-3 py-2 text-slate-700">{m.user.username}</td><td className="px-3 py-2 text-right">{fmtNum(m.tokens.today)}</td><td className="px-3 py-2 text-right">{fmtNum(m.tokens.this_period)}</td><td className="px-3 py-2 text-right">{fmtNum(m.tokens.all_time)}</td><td className="px-3 py-2 text-right">{fmtINR(m.ai_cost)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </ChartCard>
              ) : (
                <ChartCard title={`Daily tokens — last ${days} days`} right={<PeriodSelect value={days} onChange={setDays} />}>
                  {!series || series.length === 0 ? <EmptyState icon={Coins} text={`No usage in the last ${days} days.`} /> : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series} margin={{ left: 8, right: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => fmtDate(d).replace(/ \d{4}$/, '')} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                          <Tooltip formatter={(v) => fmtNum(v)} labelFormatter={(d) => fmtDate(d)} />
                          <Line type="monotone" dataKey="total_tokens" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </ChartCard>
              )}
            </div>
          )}

          {/* ── STORAGE ── */}
          {tab === 'storage' && (
            mode === 'firm' && !memberId
              ? <EmptyState icon={HardDrive} text="Select a member above to view their storage." />
              : <StorageView storage={storage} loading={storageLoading} error={storageErr} onRetry={() => loadStorage(mode === 'firm' ? memberId : id)} />
          )}

          {/* ── PAYMENTS ── */}
          {tab === 'payments' && <PaymentsView data={paymentsData} />}

          {/* ── AI USAGE ── */}
          {tab === 'ai' && (
            mode === 'firm'
              ? <AiUsage byModel={ai?.data?.by_model || []} totals={ai?.data?.totals} allTime />
              : <AiUsage byModel={aiUsage?.by_model ?? ai?.data?.by_model ?? []} totals={aiUsage?.totals ?? ai?.data?.totals} daily={aiUsage?.daily} days={days} onDays={setDays} loading={aiLoading} />
          )}
        </>
      )}
    </div>
  );
};

export default UserAnalytics;
