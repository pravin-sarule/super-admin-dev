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
    <section className="grid gap-4 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.key}
            className={`rounded-3xl border border-slate-200 bg-gradient-to-br ${card.tone} p-5 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                <Icon className="h-5 w-5 text-slate-700" />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default PipelineSummaryCards;
