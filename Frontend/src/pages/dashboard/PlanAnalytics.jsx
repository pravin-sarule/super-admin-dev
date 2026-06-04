import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ArrowLeft, RefreshCw, BarChart3, Repeat, Package, HardDrive, Users, CreditCard, AlertTriangle, X, Eye, Lock,
} from 'lucide-react';
import { COLORS, fmtINR, fmtNum, fmtDate } from './userAnalytics/analyticsFormat';
import { KpiCard, ChartCard, EmptyState, Donut, StatusPill } from './userAnalytics/AnalyticsCharts';
import { fetchPlanSummary, fetchMonthlySubscribers, fetchTopupBuyers } from './userAnalytics/analyticsApi';

const TABS = [
  { key: 'monthly', label: 'Monthly Plans', icon: Repeat },
  { key: 'topup', label: 'Topup Plans', icon: Package },
  { key: 'addon', label: 'Add-on Plans', icon: HardDrive },
];

const Skeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}</div>
    <div className="h-64 bg-slate-100 rounded-xl" />
  </div>
);

const PlanAnalytics = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('monthly');
  const [sel, setSel] = useState(null);          // { type, id, name }
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try { const r = await fetchPlanSummary(); setSummary(r.data); }
    catch (e) { setErr(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openPlan = async (type, plan) => {
    if (plan.is_custom) return;
    setSel({ type, id: plan.id, name: plan.name }); setRows([]); setRowsLoading(true);
    try {
      const r = type === 'monthly' ? await fetchMonthlySubscribers(plan.id) : await fetchTopupBuyers(plan.id);
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch { setRows([]); } finally { setRowsLoading(false); }
  };
  const closePanel = () => { setSel(null); setRows([]); };

  const monthly = summary?.monthly || [];
  const topup = summary?.topup || [];
  const addons = summary?.addons?.catalog || [];

  const UserCell = ({ r }) => (
    <div className="flex flex-col">
      <span className="font-medium text-slate-700 flex items-center gap-1.5">
        {r.username || `User #${r.user_id}`}
        {r.is_blocked && <Lock className="w-3 h-3 text-red-500" />}
      </span>
      {r.email && <span className="text-xs text-slate-400">{r.email}</span>}
    </div>
  );
  const ViewBtn = ({ id }) => (
    <button onClick={() => navigate(`/dashboard/users/${id}/analytics`)}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
      <Eye className="w-3 h-3" /> Analytics
    </button>
  );

  // Drill-in panel for the selected plan's users.
  const Panel = () => {
    if (!sel || sel.type !== tab) return null;
    const isMonthly = sel.type === 'monthly';
    return (
      <ChartCard
        title={`${isMonthly ? 'Subscribers' : 'Buyers'} — ${sel.name}`}
        subtitle={rowsLoading ? 'Loading…' : `${rows.length} ${isMonthly ? 'subscriber' : 'buyer'}${rows.length !== 1 ? 's' : ''}`}
        right={<button onClick={closePanel} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-4 h-4" /></button>}>
        {rowsLoading ? <EmptyState icon={Users} text="Loading…" />
          : rows.length === 0 ? <EmptyState icon={Users} text={`No ${isMonthly ? 'subscribers' : 'buyers'} yet.`} />
          : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="px-3 py-2 text-left">User</th>
                  {isMonthly
                    ? <><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Joined</th><th className="px-3 py-2 text-right">Plan balance</th><th className="px-3 py-2 text-right">Top-up balance</th></>
                    : <><th className="px-3 py-2 text-left">Purchased</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Tokens</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Expires</th></>}
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.user_id}-${i}`} className="border-b border-slate-100 hover:bg-blue-50/40">
                      <td className="px-3 py-2"><UserCell r={r} /></td>
                      {isMonthly ? (
                        <>
                          <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                          <td className="px-3 py-2 text-slate-600">{fmtDate(r.created_at || r.start_date)}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{fmtNum(r.current_token_balance)}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{fmtNum(r.topup_token_balance)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-slate-600">{fmtDate(r.created_at)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtINR(r.amount)} {r.currency || ''}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{fmtNum(r.tokens_credited)}</td>
                          <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                          <td className="px-3 py-2 text-slate-600">{fmtDate(r.expires_at)}</td>
                        </>
                      )}
                      <td className="px-3 py-2 text-right"><ViewBtn id={r.user_id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </ChartCard>
    );
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/dashboard/subscriptions')} className="mt-1 p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm"><BarChart3 className="w-5 h-5 text-white" /></div>
              <h1 className="text-xl font-bold text-slate-800">Plan Analytics</h1>
            </div>
            <p className="text-sm text-slate-500 ml-11">How many users purchased each plan — click a plan to see its users, then drill into any user.</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {err ? (
        <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
          <AlertTriangle className="w-10 h-10 opacity-40" />
          <p className="text-sm">{err}</p>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Retry</button>
        </div>
      ) : loading ? <Skeleton /> : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200">
            {TABS.map((t) => {
              const active = tab === t.key;
              const count = t.key === 'monthly' ? monthly.length : t.key === 'topup' ? topup.length : addons.length;
              return (
                <button key={t.key} onClick={() => { setTab(t.key); setSel(null); }}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <t.icon className="w-4 h-4" /> {t.label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[11px] ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* ── MONTHLY ── */}
          {tab === 'monthly' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard icon={Repeat} tone="blue" label="Monthly plans" value={fmtNum(monthly.length)} />
                <KpiCard icon={Users} tone="emerald" label="Active subscribers" value={fmtNum(monthly.reduce((s, m) => s + (m.active_subscribers || 0), 0))} />
                <KpiCard icon={Users} tone="slate" label="Total subscriptions" value={fmtNum(monthly.reduce((s, m) => s + (m.subscribers || 0), 0))} />
              </div>
              <ChartCard title="Subscribers per monthly plan">
                {monthly.every((m) => !m.subscribers) ? <EmptyState icon={Users} text="No subscribers yet." /> : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => fmtNum(v)} />
                        <Bar dataKey="subscribers" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
              <ChartCard title="Monthly plans" subtitle="Click a plan to see its subscribers">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                      <th className="px-3 py-2 text-left">Plan</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Subscribers</th><th className="px-3 py-2 text-right">Active</th>
                    </tr></thead>
                    <tbody>
                      {monthly.map((m) => (
                        <tr key={m.id} onClick={() => openPlan('monthly', m)}
                          className={`border-b border-slate-100 cursor-pointer ${sel?.type === 'monthly' && sel.id === m.id ? 'bg-blue-50/60' : 'hover:bg-blue-50/40'}`}>
                          <td className="px-3 py-2 font-medium text-slate-700">{m.name}{m.is_custom && <span className="ml-1 text-[10px] text-amber-600">(custom)</span>}</td>
                          <td className="px-3 py-2 capitalize text-slate-500">{m.category || '—'}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{Number(m.price) > 0 ? fmtINR(m.price) : 'Free'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtNum(m.subscribers)}</td>
                          <td className="px-3 py-2 text-right text-emerald-700">{fmtNum(m.active_subscribers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
              <Panel />
            </div>
          )}

          {/* ── TOPUP ── */}
          {tab === 'topup' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard icon={Package} tone="amber" label="Topup plans" value={fmtNum(topup.length)} />
                <KpiCard icon={CreditCard} tone="emerald" label="Total purchases" value={fmtNum(topup.reduce((s, t) => s + (t.purchases || 0), 0))} />
                <KpiCard icon={CreditCard} tone="violet" label="Topup revenue" value={fmtINR(topup.reduce((s, t) => s + Number(t.revenue || 0), 0))} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Purchases per topup plan">
                  {topup.every((t) => !t.purchases) ? <EmptyState icon={Package} text="No purchases yet." /> : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topup} margin={{ left: 8, right: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => fmtNum(v)} />
                          <Bar dataKey="purchases" fill={COLORS[4]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </ChartCard>
                <ChartCard title="Revenue by topup plan"><Donut data={topup.map((t) => ({ name: t.name, value: Number(t.revenue || 0) }))} valueFormatter={(v) => fmtINR(v)} /></ChartCard>
              </div>
              <ChartCard title="Topup plans" subtitle="Click a plan to see its buyers">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                      <th className="px-3 py-2 text-left">Pack</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Tokens</th><th className="px-3 py-2 text-right">Buyers</th><th className="px-3 py-2 text-right">Purchases</th><th className="px-3 py-2 text-right">Revenue</th>
                    </tr></thead>
                    <tbody>
                      {topup.map((t) => (
                        <tr key={t.id} onClick={() => openPlan('topup', t)}
                          className={`border-b border-slate-100 cursor-pointer ${sel?.type === 'topup' && sel.id === t.id ? 'bg-amber-50/60' : 'hover:bg-amber-50/40'}`}>
                          <td className="px-3 py-2 font-medium text-slate-700">{t.name}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{fmtINR(t.price)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{fmtNum(t.tokens)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtNum(t.buyers)}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{fmtNum(t.purchases)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700">{fmtINR(t.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
              <Panel />
            </div>
          )}

          {/* ── ADD-ON ── */}
          {tab === 'addon' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Add-on purchases aren't tracked yet (phase 2) — there's no per-user add-on purchase record, so buyer counts aren't available. Showing the active add-on catalog.</span>
              </div>
              <ChartCard title="Add-on catalog" subtitle={`${addons.length} active add-ons`}>
                {addons.length === 0 ? <EmptyState icon={HardDrive} text="No add-ons configured." /> : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <th className="px-3 py-2 text-left">Add-on</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Storage</th><th className="px-3 py-2 text-left">Billing</th><th className="px-3 py-2 text-right">Buyers</th>
                      </tr></thead>
                      <tbody>
                        {addons.map((a) => (
                          <tr key={a.id} className="border-b border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-700">{a.name}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{fmtINR(a.price)}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{a.storage_gb >= 1024 ? `${a.storage_gb / 1024} TB` : `${a.storage_gb} GB`}</td>
                            <td className="px-3 py-2 capitalize text-slate-500">{a.billing_type === 'one_time' ? `One-time (${a.validity_years || '—'} yr)` : `${a.billing_interval_months || 1} mo`}</td>
                            <td className="px-3 py-2 text-right text-slate-400 italic">n/a</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ChartCard>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PlanAnalytics;
