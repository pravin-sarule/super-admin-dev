import React from 'react';
import { getSummaryCards } from './constants';

const SummaryCards = ({ summary }) => {
  const stats = getSummaryCards(summary);

  return (
    <section className="grid gap-4 xl:grid-cols-5">
      {stats.map((card) => {
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

export default SummaryCards;
