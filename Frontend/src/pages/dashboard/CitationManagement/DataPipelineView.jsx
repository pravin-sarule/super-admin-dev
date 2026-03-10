import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Eye, Download, FileText, BookOpen, Search,
  Cpu, PenTool, BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  getPipelineAgents,
  getPipelineAgentHealth,
  getPipelineThroughput,
} from '../../../services/citationAdminApi';

/* ═══════════════════════════════════════════════
   PER-AGENT CONFIG
   ═══════════════════════════════════════════════ */
const AGENT_CONFIG = {
  watchdog: { icon: Eye, color: '#3b82f6', desc: 'SC S3 sync + IKanoon daily delta', metricLabel: 'DETECTED' },
  fetcher: { icon: Download, color: '#22c55e', desc: 'IKanoon API + S3 download + GCS upload', metricLabel: 'FETCHED' },
  clerk: { icon: FileText, color: '#f59e0b', desc: 'Parse metadata + extract citations', metricLabel: 'PROCESSED' },
  librarian: { icon: BookOpen, color: '#8b5cf6', desc: 'Dedup + canonical ID resolution', metricLabel: 'CATALOGED' },
  auditor: { icon: Search, color: '#06b6d4', desc: 'Confidence scoring + verification', metricLabel: 'VERIFIED' },
  keyword_extractor: { icon: PenTool, color: '#ec4899', desc: 'NLP keyword + statute extraction', metricLabel: 'EXTRACTED' },
  root: { icon: Cpu, color: '#f97316', desc: 'Pipeline orchestrator + scheduler', metricLabel: 'ORCHESTRATED' },
  report_builder: { icon: BarChart3, color: '#6366f1', desc: 'Generate citation reports', metricLabel: 'COMPILED' },
};

const AGENT_COLOR_LIST = Object.values(AGENT_CONFIG).map((c) => c.color);

const STATUS = {
  running: { dot: 'bg-green-500', text: 'text-green-700', label: 'running' },
  idle: { dot: 'bg-amber-400', text: 'text-amber-600', label: 'idle' },
  error: { dot: 'bg-red-500', text: 'text-red-700', label: 'error' },
};

const PIPELINE_ORDER = [
  'root', 'keyword_extractor', 'watchdog', 'fetcher', 'clerk', 'librarian', 'auditor', 'report_builder',
];

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function capitalize(s) {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

/* ═══════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════ */
export default function DataPipelineView() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentHealth, setAgentHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [throughputData, setThroughputData] = useState([]);
  const [throughputAgents, setThroughputAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    Promise.all([
      getPipelineAgents({ windowMinutes: 60 }).then((r) => r?.success ? r.data.agents : []),
      getPipelineThroughput({ bucket: 'hour' }).then((r) => r?.success ? r.data : null),
    ])
      .then(([agList, tpData]) => {
        setAgents(agList || []);
        if (agList?.length) {
          const defaultName = agList.some((a) => a.agent_name === 'root') ? 'root' : agList[0].agent_name;
          setSelectedAgent(defaultName);
        }
        if (tpData?.series) {
          const names = tpData.series.map((s) => s.agent_name);
          setThroughputAgents(names);
          const timeMap = {};
          tpData.series.forEach((s) => {
            s.points.forEach((p) => {
              const t = new Date(p.ts);
              const label = t.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true }).toUpperCase();
              if (!timeMap[label]) timeMap[label] = { time: label, _sort: t.getTime() };
              timeMap[label][s.agent_name] = p.count;
            });
          });
          setThroughputData(Object.values(timeMap).sort((a, b) => a._sort - b._sort));
        }
      })
      .catch((err) => setErrorMsg(err.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  const fetchHealth = useCallback((name) => {
    if (!name) return;
    setHealthLoading(true);
    setAgentHealth(null);
    getPipelineAgentHealth(name, { logLimit: 5 })
      .then((r) => r?.success && setAgentHealth(r.data))
      .catch(() => setAgentHealth(null))
      .finally(() => setHealthLoading(false));
  }, []);

  useEffect(() => { fetchHealth(selectedAgent); }, [selectedAgent, fetchHealth]);

  const orderedAgents = PIPELINE_ORDER
    .map((name) => agents.find((a) => a.agent_name === name))
    .filter(Boolean);
  const pipelineSubtitle = orderedAgents.length
    ? `${orderedAgents.length}-Agent pipeline: ${orderedAgents.map((a) => capitalize(a.agent_name)).join(' → ')}`
    : '';
  const selData = agents.find((a) => a.agent_name === selectedAgent);
  const selCfg = AGENT_CONFIG[selectedAgent] || {};

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
          <Settings className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Data Pipeline Health</h1>
          {pipelineSubtitle && <p className="text-xs text-gray-400 mt-0.5">{pipelineSubtitle}</p>}
        </div>
      </div>

      {errorMsg && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{errorMsg}</div>}

      {/* ════════════════════════════════════════
         PIPELINE FLOW ROW
         ════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {loading ? (
          <p className="text-gray-400 text-sm text-center py-6">Loading agents…</p>
        ) : (
          <div className="thin-scrollbar overflow-x-auto px-5 py-4">
            <div className="flex items-center gap-0 min-w-max mx-auto w-fit">
              {orderedAgents.map((agent, i) => {
                const cfg = AGENT_CONFIG[agent.agent_name] || {};
                const isSelected = selectedAgent === agent.agent_name;
                const st = STATUS[agent.status] || STATUS.idle;

                return (
                  <React.Fragment key={agent.agent_name}>
                    <button
                      type="button"
                      onClick={() => setSelectedAgent(agent.agent_name)}
                      className={`
                        flex flex-col items-center gap-1.5 rounded-xl border-2 transition-all
                        cursor-pointer select-none px-5 py-4
                        ${isSelected
                          ? 'border-blue-400 bg-blue-50/50 shadow'
                          : 'border-gray-100 bg-gray-50/40 hover:border-gray-200 hover:bg-gray-50'
                        }
                      `}
                      style={{ minWidth: 115 }}
                    >
                      {(() => {
                        const Icon = cfg.icon || Settings;
                        return (
                          <div
                            className="w-11 h-11 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${cfg.color || '#64748b'}15` }}
                          >
                            <Icon className="w-[20px] h-[20px]" style={{ color: cfg.color || '#64748b' }} />
                          </div>
                        );
                      })()}
                      <p className="text-[12px] font-semibold text-slate-700 whitespace-nowrap">
                        {capitalize(agent.agent_name)}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className={`w-[6px] h-[6px] rounded-full ${st.dot}`} />
                        <span className={`text-[9px] font-medium ${st.text}`}>{st.label}</span>
                      </div>
                    </button>

                    {i < orderedAgents.length - 1 && (
                      <span className="text-slate-400 text-base mx-2 select-none font-semibold">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
         BOTTOM: DETAIL + CHART
         ════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Agent Detail ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col min-h-[360px]">
          {!selectedAgent ? (
            <p className="text-gray-500 text-sm m-auto">Select an agent above</p>
          ) : healthLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const Icon = selCfg.icon || Settings;
                  const color = selCfg.color || '#64748b';
                  return (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-800 leading-tight">{capitalize(selectedAgent)}</h2>
                  <p className="text-[11px] text-gray-400 truncate">{selCfg.desc || ''}</p>
                </div>
              </div>

              {/* Metric row */}
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5">
                  <p className="text-lg font-bold text-blue-600 leading-tight">
                    {agentHealth?.today_events_count ?? selData?.today_events_count ?? 0}
                    <span className="text-xs font-medium text-gray-500 ml-1">today</span>
                  </p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-[0.12em] font-bold mt-0.5">
                    {selCfg.metricLabel || 'EVENTS'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5">
                  <p className="text-lg font-bold text-slate-800 leading-tight">
                    {agentHealth?.avg_latency_ms_today != null
                      ? `${Math.round(agentHealth.avg_latency_ms_today)}ms`
                      : selData?.last_latency_ms != null
                        ? `${Math.round(selData.last_latency_ms)}ms`
                        : '—'}
                  </p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-[0.12em] font-bold mt-0.5">LATENCY</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5">
                  <p className="text-lg font-bold text-green-600 leading-tight">
                    {agentHealth?.uptime_pct_24h != null
                      ? `${agentHealth.uptime_pct_24h}%`
                      : selData?.uptime_pct != null
                        ? `${selData.uptime_pct}%`
                        : '—'}
                  </p>
                  <p className="text-[9px] text-gray-400 uppercase tracking-[0.12em] font-bold mt-0.5">UPTIME</p>
                </div>
              </div>

              {/* Recent logs */}
              <p className="text-[9px] text-blue-500 uppercase tracking-[0.14em] font-bold mb-2">Recent Logs</p>
              <div className="flex-1 thin-scrollbar overflow-y-auto">
                {agentHealth?.recent_logs?.length ? (
                  <ul className="divide-y divide-gray-50">
                    {agentHealth.recent_logs.map((log) => (
                      <li key={log.id} className="flex items-baseline gap-2 py-2 text-[13px]">
                        <span className="text-gray-400 font-mono text-xs flex-shrink-0">{fmtTime(log.created_at)}</span>
                        <span className="text-gray-300 flex-shrink-0">—</span>
                        <span className={
                          log.log_level === 'ERROR' ? 'text-red-600 font-medium' :
                            log.log_level === 'WARN' ? 'text-amber-700' : 'text-slate-600'
                        }>{log.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">No recent logs</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Throughput Chart ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Pipeline Throughput (Today)</h3>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : throughputData.length === 0 ? (
            <p className="text-gray-500 text-sm">No throughput data</p>
          ) : (
            <div className="h-[310px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={throughputData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}
                    formatter={(v, n) => [v, capitalize(n)]}
                    cursor={{ fill: 'rgba(59,130,246,0.04)' }}
                  />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} formatter={capitalize} />
                  {throughputAgents.map((name, i) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      name={name}
                      fill={AGENT_CONFIG[name]?.color || AGENT_COLOR_LIST[i % AGENT_COLOR_LIST.length]}
                      radius={[2, 2, 0, 0]}
                      maxBarSize={20}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
