import React, { useState, useEffect } from 'react';
import { X, Loader2, Cpu, Globe, AlertTriangle, Clock, ChevronDown } from 'lucide-react';
import { getAnalyticsSessionDetails } from '../../../services/citationAdminApi';

/**
 * Full cost breakdown for one session — the UI equivalent of the engine's
 * "COMPLETE COST — END-TO-END session" terminal block.
 *
 * Two tables, matching how cost is actually incurred:
 *   LLM  — per (agent, model): calls, tokens in, tokens out, cost
 *   API  — per metered operation: calls, effective rate, cost (India Kanoon, grounding, OCR)
 *
 * Not date-filtered: a session is billed as a whole.
 */

const fmtInr = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUsd = (n) =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
};

function CostSourceBadge({ source }) {
  if (!source || source === 'rate_card') return null;
  const map = {
    producer: ['bg-amber-50 text-amber-700 border-amber-200', 'engine-priced'],
    manual: ['bg-slate-100 text-slate-600 border-slate-200', 'manual'],
    unpriced: ['bg-red-50 text-red-700 border-red-200', 'unpriced'],
  };
  const [cls, label] = map[source] || ['bg-slate-100 text-slate-600 border-slate-200', source];
  return (
    <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded border ${cls}`}>{label}</span>
  );
}

export default function SessionCostModal({ sessionId, runId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getAnalyticsSessionDetails(sessionId, runId)
      .then((res) => {
        if (!alive) return;
        if (res?.success && res?.data) setData(res.data);
        else setError('Invalid response for session analytics');
      })
      .catch((err) => {
        if (!alive) return;
        setError(
          err?.response?.data?.error?.message || err.message || 'Failed to load session cost'
        );
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sessionId, runId]);

  const t = data?.totals;
  const llm = data?.llm_breakdown ?? [];
  const api = data?.api_breakdown ?? [];

  return (
    <div className="fixed inset-0 z-[85] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[92vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">
              {runId ? 'Run Cost Breakdown' : 'Session Cost Breakdown'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
              {runId ? `run ${runId}` : sessionId}
            </p>
            {runId && (
              <p className="text-[11px] text-slate-400 font-mono truncate">session {sessionId}</p>
            )}
            {data && (
              <p className="text-xs text-slate-500 mt-1">
                {data.user_name}
                {data.email ? ` · ${data.email}` : ''} · {data.department}
                {data.case_id ? ` · case ${data.case_id}` : ''}
              </p>
            )}
            {t && (
              <p className="text-xs text-slate-400 mt-0.5">
                {fmtDateTime(t.started_at)} → {fmtDateTime(t.last_event_at)} (IST)
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          ) : (
            <>
              {/* Stat tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  ['AI subtotal', fmtInr(t.ai_cost_inr), `${llm.length} model line(s)`],
                  ['API subtotal', fmtInr(t.api_cost_inr), `${api.length} operation(s)`],
                  ['Grand total', fmtInr(t.total_cost_inr), fmtUsd(t.total_cost_usd)],
                  ['Calls', fmtNum(t.total_calls), `${fmtNum(t.event_count)} event rows`],
                ].map(([label, value, sub], i) => (
                  <div
                    key={label}
                    className={`rounded-xl border p-3 ${
                      i === 2
                        ? 'border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <p
                      className={`text-[11px] uppercase font-semibold ${
                        i === 2 ? 'text-white/90' : 'text-slate-500'
                      }`}
                    >
                      {label}
                    </p>
                    <p className={`text-xl font-bold mt-1 ${i === 2 ? '' : 'text-slate-900'}`}>
                      {value}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${i === 2 ? 'text-white/80' : 'text-slate-500'}`}>
                      {sub}
                    </p>
                  </div>
                ))}
              </div>

              {(t.unpriced_count > 0 || t.producer_priced_count > 0) && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {t.unpriced_count > 0 && (
                      <>
                        <strong>{t.unpriced_count}</strong> line(s) had no rate card match and are
                        counted at ₹0.{' '}
                      </>
                    )}
                    {t.producer_priced_count > 0 && (
                      <>
                        <strong>{t.producer_priced_count}</strong> line(s) fell back to the
                        engine&apos;s own cost because the operation name didn&apos;t match a rate
                        card entry.
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* LLM breakdown */}
              <div className="mb-5 rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-semibold text-slate-800">
                    LLM cost by agent &amp; model
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-white">
                      <tr>
                        {['Task / agent', 'Model', 'Calls', 'Tokens in', 'Tokens out', 'Cost'].map(
                          (h, i) => (
                            <th
                              key={h}
                              className={`px-4 py-2 font-semibold text-slate-600 uppercase whitespace-nowrap ${
                                i >= 2 ? 'text-right' : 'text-left'
                              }`}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {llm.map((r) => (
                        <tr key={`${r.operation}|${r.model}`} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="text-slate-800 font-medium">{r.operation}</span>
                            <CostSourceBadge source={r.cost_source} />
                            {r.stage && (
                              <div className="text-[10px] text-slate-400">{r.stage}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                            {r.model || '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-700">{fmtNum(r.calls)}</td>
                          <td className="px-4 py-2 text-right text-slate-700">
                            {fmtNum(r.input_tokens)}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-700">
                            {r.output_tokens ? fmtNum(r.output_tokens) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-900">
                            {fmtInr(r.cost_inr)}
                          </td>
                        </tr>
                      ))}
                      {llm.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                            No LLM calls recorded for this session.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {llm.length > 0 && (
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td colSpan={5} className="px-4 py-2 text-right font-semibold text-slate-700">
                            AI subtotal
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-slate-900">
                            {fmtInr(t.ai_cost_inr)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Metered API breakdown */}
              <div className="mb-5 rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-slate-800">
                    Metered API cost (India Kanoon, grounding, OCR)
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-white">
                      <tr>
                        {['Service', 'Operation', 'Calls', 'Rate', 'Cache hits', 'Cost'].map(
                          (h, i) => (
                            <th
                              key={h}
                              className={`px-4 py-2 font-semibold text-slate-600 uppercase whitespace-nowrap ${
                                i >= 2 ? 'text-right' : 'text-left'
                              }`}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {api.map((r) => (
                        <tr key={`${r.service}|${r.operation}`} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{r.service}</td>
                          <td className="px-4 py-2 text-slate-800 font-medium whitespace-nowrap">
                            {r.operation}
                            <CostSourceBadge source={r.cost_source} />
                          </td>
                          <td className="px-4 py-2 text-right text-slate-700">
                            {fmtNum(r.calls)}{' '}
                            <span className="text-slate-400">{r.unit}</span>
                          </td>
                          <td className="px-4 py-2 text-right text-slate-600">
                            {r.unit_rate_inr ? fmtInr(r.unit_rate_inr) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-500">
                            {r.cache_hits ? `${r.cache_hits} free` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-900">
                            {fmtInr(r.cost_inr)}
                          </td>
                        </tr>
                      ))}
                      {api.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                            No metered API calls recorded for this session.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {api.length > 0 && (
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td colSpan={5} className="px-4 py-2 text-right font-semibold text-slate-700">
                            API subtotal
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-slate-900">
                            {fmtInr(t.api_cost_inr)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Grand total */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {fmtNum(t.input_tokens)} tokens in · {fmtNum(t.output_tokens)} tokens out ·{' '}
                  {fmtNum(t.total_calls)} calls
                  {t.cache_hits ? ` · ${t.cache_hits} cache hit(s), free` : ''}
                  {t.failed_count ? ` · ${t.failed_count} failed` : ''}
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 mr-3">GRAND TOTAL</span>
                  <span className="text-xl font-bold text-slate-900">
                    {fmtInr(t.total_cost_inr)}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">{fmtUsd(t.total_cost_usd)}</span>
                </div>
              </div>

              {t.producer_cost_inr > 0 && (
                <p className="mt-2 text-[11px] text-slate-400 text-right">
                  Engine reported {fmtInr(t.producer_cost_inr)} for these calls · difference{' '}
                  {fmtInr(t.total_cost_inr - t.producer_cost_inr)} after rate card pricing
                </p>
              )}

              {/* Raw call log — disclosure button, styled like the page's other actions */}
              <button
                type="button"
                onClick={() => setShowTimeline((s) => !s)}
                aria-expanded={showTimeline}
                aria-controls="session-raw-call-log"
                className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  showTimeline
                    ? 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-4 h-4 text-slate-400" />
                {showTimeline ? 'Hide raw call log' : 'Show raw call log'}
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-600 tabular-nums">
                  {data.timeline.length}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    showTimeline ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showTimeline && (
                <div
                  id="session-raw-call-log"
                  className="mt-3 overflow-x-auto rounded-lg border border-slate-200 max-h-72 overflow-y-auto"
                >
                  <table className="min-w-full divide-y divide-slate-200 text-[11px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {['When', 'Service', 'Operation', 'Model', 'Qty', 'Calls', 'Cost', 'ms'].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-3 py-1.5 text-left font-semibold text-slate-600 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.timeline.map((r) => (
                        <tr key={r.id} className={r.success === false ? 'bg-red-50/50' : ''}>
                          <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">
                            {fmtDateTime(r.occurred_at)}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">{r.service}</td>
                          <td className="px-3 py-1.5 text-slate-800">{r.operation}</td>
                          <td className="px-3 py-1.5 text-slate-500">{r.model || '—'}</td>
                          <td className="px-3 py-1.5 text-right text-slate-700">
                            {fmtNum(r.quantity)} <span className="text-slate-400">{r.unit}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-700">{r.calls}</td>
                          <td className="px-3 py-1.5 text-right text-slate-900">
                            {fmtInr(r.cost_inr)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-400">
                            {r.usage_time_ms || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
