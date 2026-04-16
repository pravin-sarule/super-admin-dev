import { Clock3, Database, FileSearch, Sparkles } from 'lucide-react';
import { formatDuration } from '../judgement-service/helpers';

const cardConfig = [
  {
    key: 'semanticChunks',
    label: 'Semantic Chunks',
    tone: 'from-blue-50 to-blue-100',
    icon: Sparkles,
  },
  {
    key: 'fullTextJudgments',
    label: 'Full Text Judgments',
    tone: 'from-emerald-50 to-emerald-100',
    icon: FileSearch,
  },
  {
    key: 'totalDurationMs',
    label: 'Total Search Time',
    tone: 'from-amber-50 to-amber-100',
    icon: Clock3,
  },
  {
    key: 'qdrantMs',
    label: 'Qdrant Time',
    tone: 'from-slate-50 to-slate-100',
    icon: Database,
  },
];

const SearchMetricCards = ({ result }) => {
  if (!result) return null;

  const values = {
    semanticChunks: result.totalResults?.semanticChunks || 0,
    fullTextJudgments: result.totalResults?.fullTextJudgments || 0,
    totalDurationMs: formatDuration(result.totalDurationMs),
    qdrantMs: formatDuration(result.timings?.qdrantMs || 0),
  };

  return (
    <section className="grid gap-4 xl:grid-cols-4">
      {cardConfig.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className={`rounded-3xl border border-slate-200 bg-gradient-to-br ${card.tone} p-5 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{values[card.key]}</p>
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

export default SearchMetricCards;
