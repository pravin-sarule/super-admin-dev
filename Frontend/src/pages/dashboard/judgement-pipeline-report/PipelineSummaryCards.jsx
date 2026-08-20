import React from 'react';
import { Building2, CalendarDays, Database, SearchCheck, Waypoints } from 'lucide-react';
import { formatNumber } from './helpers';

const PipelineSummaryCards = ({ summary, stores }) => {
  const cards = [
    {
      key: 'total',
      label: 'Total Inserted',
      value: formatNumber(summary?.totalJudgments),
      tone: 'from-slate-50 to-white',
      icon: Database,
    },
    {
      key: 'dated',
      label: 'With Judgment Date',
      value: formatNumber(summary?.judgmentsWithDate),
      tone: 'from-blue-50 to-white',
      icon: CalendarDays,
    },
    {
      key: 'courts',
      label: 'Courts Covered',
      value: formatNumber(summary?.distinctCourts),
      tone: 'from-emerald-50 to-white',
      icon: Building2,
    },
    {
      key: 'es',
      label: 'Elasticsearch Docs',
      value: formatNumber(stores?.elasticsearch?.count),
      tone: 'from-amber-50 to-white',
      icon: SearchCheck,
    },
    {
      key: 'qdrant',
      label: 'Qdrant Points',
      value: formatNumber(stores?.qdrant?.count),
      tone: 'from-purple-50 to-white',
      icon: Waypoints,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.key}
            className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${card.tone} px-4 py-3 shadow-sm`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{card.value}</p>
              </div>
              <div className="rounded-xl bg-white/80 p-2">
                <Icon className="h-4 w-4 text-slate-600" />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default PipelineSummaryCards;
