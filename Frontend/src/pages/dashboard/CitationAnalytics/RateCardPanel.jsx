import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  Plus,
  Save,
  Ban,
  History,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  getRateCard,
  createRate,
  updateRate,
  deactivateRate,
} from '../../../services/citationAdminApi';

/**
 * Rate Card admin panel — edit model pricing without a deploy.
 *
 * Rates are entered in the provider's own currency (USD for Gemini/Claude, INR for India
 * Kanoon / Document AI) plus an ₹/USD peg; the derived ₹ figure updates live as you type.
 *
 * Saving never edits a row in place: the backend closes the current row and inserts a
 * successor. Costs already recorded on past events are frozen and do NOT change.
 */

const UNITS = ['tokens', 'calls', 'pages'];
const CURRENCIES = ['USD', 'INR'];
const TIERS = ['standard', 'intro'];

const BLANK = {
  provider: 'gemini',
  service: 'gemini',
  model: '',
  operation: '',
  tier: 'standard',
  display_name: '',
  unit: 'tokens',
  currency: 'USD',
  inr_per_usd: 95.66,
  input_rate_per_million: 0,
  output_rate_per_million: 0,
  cached_input_rate_per_million: 0,
  cache_storage_rate_per_million_hour: 0,
  flat_rate_per_unit: 0,
  notes: '',
};

const num = (v) => (v === '' || v == null ? 0 : Number(v));

const toInr = (row, value) => {
  const n = num(value);
  return row.currency === 'INR' ? n : n * num(row.inr_per_usd);
};

const fmtInr = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function RateInput({ value, onChange, disabled, placeholder }) {
  return (
    <input
      type="number"
      step="any"
      min="0"
      disabled={disabled}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-24 px-2 py-1 rounded border border-slate-200 text-xs text-right focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}

export default function RateCardPanel({ onClose }) {
  const [rows, setRows] = useState([]);
  const [unpriced, setUnpriced] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [drafts, setDrafts] = useState({}); // id -> partial edits
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState(BLANK);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRateCard(includeInactive);
      if (res?.success && res?.data) {
        setRows(res.data.rates || []);
        setUnpriced(res.data.unpriced_targets || []);
        setDrafts({});
      } else {
        setError('Invalid response from rate card API');
      }
    } catch (err) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to load rate card');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (id, key, value) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), [key]: value } }));

  const merged = (row) => ({ ...row, ...(drafts[row.id] || {}) });
  const isDirty = (row) => Boolean(drafts[row.id] && Object.keys(drafts[row.id]).length);

  const save = async (row) => {
    setSavingId(row.id);
    setError(null);
    try {
      const res = await updateRate(row.id, drafts[row.id] || {});
      if (res?.success) await load();
      else setError('Save failed');
    } catch (err) {
      setError(err?.response?.data?.error?.message || err.message || 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const disable = async (row) => {
    setSavingId(row.id);
    setError(null);
    try {
      await deactivateRate(row.id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error?.message || err.message || 'Deactivate failed');
    } finally {
      setSavingId(null);
    }
  };

  const add = async () => {
    setSavingId('new');
    setError(null);
    try {
      const payload = { ...newRow };
      if (!payload.model) delete payload.model;
      if (!payload.operation) delete payload.operation;
      await createRate(payload);
      setAdding(false);
      setNewRow(BLANK);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error?.message || err.message || 'Create failed');
    } finally {
      setSavingId(null);
    }
  };

  const grouped = rows.reduce((acc, r) => {
    (acc[r.provider] = acc[r.provider] || []).push(r);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-stretch justify-end">
      <div className="w-full max-w-6xl bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-blue-600" />
              Rate Card
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Model pricing used to cost every API call. Editing a rate applies to{' '}
              <strong>future</strong> events only — past costs are frozen and never repriced.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded border-slate-300"
              />
              <History className="w-3.5 h-3.5" />
              Show history
            </label>
            <button
              type="button"
              onClick={() => setAdding((a) => !a)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Plus className="w-4 h-4" />
              Add rate
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {unpriced.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium mb-1">
                <AlertTriangle className="w-4 h-4" />
                Models seen in usage with no rate card entry
              </div>
              <ul className="text-xs space-y-0.5 ml-6 list-disc">
                {unpriced.map((u, i) => (
                  <li key={i}>
                    <code>{u.provider}</code> / <code>{u.model || u.operation || '*'}</code> —{' '}
                    {u.event_count} event(s), currently billed at ₹0
                  </li>
                ))}
              </ul>
            </div>
          )}

          {adding && (
            <div className="mb-5 p-4 rounded-xl border border-blue-200 bg-blue-50/40">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">New rate</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                {[
                  ['provider', 'Provider'],
                  ['service', 'Service (card bucket)'],
                  ['model', 'Model (blank = any)'],
                  ['operation', 'Operation (blank = any)'],
                  ['display_name', 'Display name'],
                ].map(([k, label]) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-slate-600">{label}</span>
                    <input
                      value={newRow[k]}
                      onChange={(e) => setNewRow((r) => ({ ...r, [k]: e.target.value }))}
                      className="px-2 py-1 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                ))}
                {[
                  ['unit', UNITS],
                  ['currency', CURRENCIES],
                  ['tier', TIERS],
                ].map(([k, opts]) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-slate-600 capitalize">{k}</span>
                    <select
                      value={newRow[k]}
                      onChange={(e) => setNewRow((r) => ({ ...r, [k]: e.target.value }))}
                      className="px-2 py-1 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500"
                    >
                      {opts.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {[
                  ['inr_per_usd', '₹ per USD'],
                  ['input_rate_per_million', 'Input / 1M'],
                  ['output_rate_per_million', 'Output / 1M'],
                  ['cached_input_rate_per_million', 'Cached in / 1M'],
                  ['flat_rate_per_unit', 'Flat / unit'],
                ].map(([k, label]) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-slate-600">{label}</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newRow[k]}
                      onChange={(e) => setNewRow((r) => ({ ...r, [k]: e.target.value }))}
                      className="px-2 py-1 rounded border border-slate-200 text-right focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={add}
                  disabled={savingId === 'new'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingId === 'new' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            Object.entries(grouped).map(([provider, list]) => (
              <div key={provider} className="mb-6">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  {provider.replace(/_/g, ' ')}
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          'Model / Operation',
                          'Tier',
                          'Unit',
                          'Cur',
                          '₹/USD',
                          'Input /1M',
                          'Output /1M',
                          'Cached /1M',
                          'Flat /unit',
                          'In ₹',
                          'Effective',
                          '',
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.map((raw) => {
                        const row = merged(raw);
                        const dirty = isDirty(raw);
                        const ro = !raw.is_active;
                        const isTokens = row.unit === 'tokens';
                        return (
                          <tr
                            key={raw.id}
                            className={`${ro ? 'bg-slate-50/60 text-slate-400' : 'hover:bg-slate-50/50'}`}
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="font-medium text-slate-800">
                                {raw.display_name || raw.model || raw.operation || '*'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {raw.model || '*'} / {raw.operation || '*'}
                              </div>
                            </td>
                            <td className="px-3 py-2">{raw.tier}</td>
                            <td className="px-3 py-2">{raw.unit}</td>
                            <td className="px-3 py-2">{raw.currency}</td>
                            <td className="px-3 py-2">
                              <RateInput
                                disabled={ro}
                                value={row.inr_per_usd}
                                onChange={(v) => patch(raw.id, 'inr_per_usd', v)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RateInput
                                disabled={ro || !isTokens}
                                value={row.input_rate_per_million}
                                onChange={(v) => patch(raw.id, 'input_rate_per_million', v)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RateInput
                                disabled={ro || !isTokens}
                                value={row.output_rate_per_million}
                                onChange={(v) => patch(raw.id, 'output_rate_per_million', v)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RateInput
                                disabled={ro || !isTokens}
                                value={row.cached_input_rate_per_million}
                                onChange={(v) => patch(raw.id, 'cached_input_rate_per_million', v)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RateInput
                                disabled={ro || isTokens}
                                value={row.flat_rate_per_unit}
                                onChange={(v) => patch(raw.id, 'flat_rate_per_unit', v)}
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                              {isTokens ? (
                                <>
                                  {fmtInr(toInr(row, row.input_rate_per_million))}
                                  <span className="text-slate-400"> in</span>
                                  <br />
                                  {fmtInr(toInr(row, row.output_rate_per_million))}
                                  <span className="text-slate-400"> out</span>
                                </>
                              ) : (
                                <>
                                  {fmtInr(toInr(row, row.flat_rate_per_unit))}
                                  <span className="text-slate-400"> /{row.unit}</span>
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-[10px] text-slate-500">
                              {String(raw.effective_from).slice(0, 10)}
                              {raw.effective_to && (
                                <>
                                  {' → '}
                                  {String(raw.effective_to).slice(0, 10)}
                                </>
                              )}
                              {!raw.is_active && (
                                <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                                  superseded
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {!ro && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => save(raw)}
                                    disabled={!dirty || savingId === raw.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                  >
                                    {savingId === raw.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Save className="w-3 h-3" />
                                    )}
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => disable(raw)}
                                    disabled={savingId === raw.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                  >
                                    <Ban className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
