import React from 'react';
import { ArrowRight } from 'lucide-react';
import { formatDateTime, formatNumber } from './helpers';

const STATUS_STYLES = {
  healthy: 'bg-emerald-50 text-emerald-700',
  degraded: 'bg-amber-50 text-amber-700',
};

function compactStepTitle(title = '') {
  return String(title).replace(/^\d+\.\s*/, '');
}

const STORE_ITEMS = [
  { key: 'postgres', shortLabel: 'PG' },
  { key: 'elasticsearch', shortLabel: 'ES' },
  { key: 'qdrant', shortLabel: 'Qdrant' },
];

const PipelineFlowPanel = ({ descriptor, stores, summary, warnings }) => {
  const steps = descriptor?.steps || [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
              User citation fallback
            </span>
            <h2 className="text-sm font-semibold text-slate-900">
              {descriptor?.title || 'Pipeline Report'}
            </h2>
          </div>
          <p className="mt-1 max-w-3xl truncate text-xs text-slate-500" title={descriptor?.description || ''}>
            {descriptor?.description || 'Track how fallback judgments move into our local stores.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STORE_ITEMS.map((item) => {
            const store = stores?.[item.key] || {};
            const status = store.status || 'healthy';
            const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.healthy;
            const label = store.index || store.collection
              ? `${item.shortLabel} · ${store.index || store.collection}`
              : item.shortLabel;

            return (
              <div
                key={item.key}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                title={label}
              >
                <span className="text-[11px] font-semibold text-slate-600">{item.shortLabel}</span>
                <span className="text-sm font-bold tabular-nums text-slate-900">
                  {formatNumber(store.count || 0)}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${statusStyle}`}>
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {steps.length ? (
        <ol className="mt-3 flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-3">
          {steps.map((step, index) => (
            <li key={step.key || step.title} className="flex min-w-0 flex-1 items-center gap-1">
              <div
                className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5"
                title={step.detail || compactStepTitle(step.title)}
              >
                <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                  {index + 1}
                </span>
                <span className="truncate text-xs font-medium text-slate-700">
                  {compactStepTitle(step.title)}
                </span>
              </div>
              {index < steps.length - 1 ? (
                <ArrowRight className="h-3.5 w-3.5 flex-none text-slate-300" />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>First inserted {formatDateTime(summary?.firstInsertedAt)}</span>
          <span className="hidden text-slate-300 sm:inline">·</span>
          <span>Latest {formatDateTime(summary?.latestInsertedAt)}</span>
        </div>

        {warnings?.length ? (
          <div className="max-w-full truncate font-medium text-amber-700" title={warnings.map((warning) => `${warning.store}: ${warning.message}`).join('\n')}>
            {warnings.map((warning) => `${warning.store}: ${warning.message}`).join(' · ')}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default PipelineFlowPanel;
