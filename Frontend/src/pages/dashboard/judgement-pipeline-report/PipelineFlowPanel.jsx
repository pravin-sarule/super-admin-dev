import React from 'react';
import { ArrowRight, Database, FileSearch, LibraryBig } from 'lucide-react';
import { formatDateTime, formatNumber } from './helpers';

const STEP_ICONS = [Database, FileSearch, LibraryBig];

const STATUS_STYLES = {
  healthy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  degraded: 'border-amber-200 bg-amber-50 text-amber-700',
};

const PipelineFlowPanel = ({ descriptor, stores, summary, warnings }) => {
  const steps = descriptor?.steps || [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            User Citation Fallback
          </span>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">{descriptor?.title || 'Pipeline Report'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {descriptor?.description || 'Track how fallback judgments move into our local stores.'}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
              First inserted: {formatDateTime(summary?.firstInsertedAt)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
              Latest inserted: {formatDateTime(summary?.latestInsertedAt)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:w-[420px]">
          {[
            {
              key: 'postgres',
              label: 'PostgreSQL',
              value: stores?.postgres?.count || 0,
            },
            {
              key: 'elasticsearch',
              label: 'Elasticsearch',
              value: stores?.elasticsearch?.count || 0,
            },
            {
              key: 'qdrant',
              label: stores?.qdrant?.collection
                ? `Qdrant • ${stores.qdrant.collection}`
                : 'Qdrant',
              value: stores?.qdrant?.count || 0,
            },
          ].map((store) => {
            const status =
              stores?.[store.key]?.status && STATUS_STYLES[stores[store.key].status]
                ? STATUS_STYLES[stores[store.key].status]
                : STATUS_STYLES.healthy;

            return (
              <div key={store.key} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-col gap-2">
                  <p className="break-words text-sm font-semibold text-slate-700">{store.label}</p>
                  <span className={`inline-flex w-fit flex-none whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status}`}>
                    {stores?.[store.key]?.status || 'healthy'}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">{formatNumber(store.value)}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[index] || LibraryBig;

          return (
            <div key={step.key || step.title} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <Icon className="h-5 w-5 text-slate-700" />
                </div>
                {index < steps.length - 1 ? <ArrowRight className="h-4 w-4 text-slate-300" /> : null}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
            </div>
          );
        })}
      </div>

      {warnings?.length ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Store warnings</p>
          <div className="mt-2 space-y-1">
            {warnings.map((warning) => (
              <p key={`${warning.store}-${warning.message}`}>
                {warning.store}: {warning.message}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default PipelineFlowPanel;
