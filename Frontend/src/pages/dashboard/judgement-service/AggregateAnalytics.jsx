import React from 'react';
import {
  Clock,
  Zap,
  Layers,
  FileSearch,
  Timer
} from 'lucide-react';
import { formatDuration } from './helpers';

const AggregateAnalytics = ({ summary, loading }) => {
  if (loading || !summary) {
    return (
      <div className="grid h-24 animate-pulse gap-6 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-3xl bg-slate-100" />
        ))}
      </div>
    );
  }

  const analytics = [
    {
      label: 'Batch Processing Time',
      value: formatDuration(summary.total_duration_ms),
      detail: 'Cumulative compute for all judgments',
      icon: Clock,
      color: 'from-blue-600 to-indigo-600',
    },
    {
      label: 'Avg. Speed Per Doc',
      value: formatDuration(summary.avg_duration_ms),
      detail: 'Mean processing time for success',
      icon: Timer,
      color: 'from-violet-600 to-purple-600',
    },
    {
      label: 'Total Pages Digested',
      value: summary.total_pages?.toLocaleString() || '0',
      detail: `${summary.total_text_pages?.toLocaleString()} text • ${summary.total_ocr_pages?.toLocaleString()} OCR`,
      icon: Layers,
      color: 'from-emerald-600 to-teal-600',
    },
    {
      label: 'Pipeline Efficiency',
      value: summary.total > 0 ? `${Math.round((summary.completed / summary.total) * 100)}%` : '0%',
      detail: 'Success rate of indexing engine',
      icon: Zap,
      color: 'from-amber-500 to-orange-600',
    },
  ];

  return (
    <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {analytics.map((item) => (
        <div
          key={item.label}
          className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
        >
          <div className={`absolute right-0 top-0 h-24 w-24 translate-x-12 translate-y--12 rounded-full bg-gradient-to-br ${item.color} opacity-[0.03] transition-transform group-hover:scale-110`} />
          
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {item.label}
              </p>
              <h3 className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
                {item.value}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {item.detail}
              </p>
            </div>
            <div className={`rounded-2xl bg-gradient-to-br ${item.color} p-3 text-white shadow-lg`}>
              <item.icon className="h-5 w-5" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
};

export default AggregateAnalytics;
