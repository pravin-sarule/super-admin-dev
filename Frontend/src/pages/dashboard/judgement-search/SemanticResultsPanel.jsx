import { ExternalLink, Hash, Scale, Sparkles } from 'lucide-react';

function renderMetaLabel(label, value) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-700">{value || 'N/A'}</div>
    </div>
  );
}

const SemanticResultsPanel = ({ results = [], thresholdFallbackTriggered = false, appliedScoreThreshold = null }) => (
  <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Semantic Chunk Matches</h2>
        <p className="text-sm text-slate-500">
          Relevant Qdrant chunks for the query, enriched with judgment and document metadata.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
        <Sparkles className="h-4 w-4" />
        {results.length} matches
      </div>
    </div>

    {thresholdFallbackTriggered ? (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        No semantic chunks met the requested threshold, so the retriever fell back to the best cosine-similarity matches from Qdrant.
      </div>
    ) : null}

    {appliedScoreThreshold != null ? (
      <div className="mb-4 text-xs font-medium text-slate-500">
        Active Qdrant similarity threshold: {Number(appliedScoreThreshold).toFixed(2)}
      </div>
    ) : null}

    <div className="space-y-4">
      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
          Run a search to see semantic chunk matches.
        </div>
      ) : (
        results.map((item) => (
          <article key={item.pointId} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {item.judgment.caseName || item.qdrantPayload.case_name || 'Untitled judgment'}
                  </h3>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Relevance {Math.round(Number(item.relevanceScore || 0))}/100
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span>{item.judgment.courtCode || 'Court pending'}</span>
                  <span>{item.judgment.year || 'Year pending'}</span>
                  <span>{item.judgment.canonicalId || 'Canonical ID pending'}</span>
                  <span>{item.document.documentId || 'Document link pending'}</span>
                  <span>Vector {Number(item.rawScore || item.score || 0).toFixed(3)}</span>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700 shadow-sm">
                  {item.chunk.chunkText || 'Chunk text unavailable.'}
                </div>
              </div>

              <div className="w-full xl:max-w-xs">
                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-1">
                  {renderMetaLabel('Chunk Index', item.chunk.chunkIndex ?? 'N/A')}
                  {renderMetaLabel('Judgment UUID', item.judgment.judgmentUuid)}
                  {renderMetaLabel('Canonical ID', item.judgment.canonicalId)}
                  {renderMetaLabel('Document ID', item.document.documentId)}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.document.originalFileUrl ? (
                    <a
                      href={item.document.originalFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Original
                    </a>
                  ) : null}

                  {item.judgment.judgmentUuid ? (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                      <Scale className="h-4 w-4" />
                      {item.judgment.courtCode || 'Court'}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                    <Hash className="h-4 w-4" />
                    {item.pointId}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  </section>
);

export default SemanticResultsPanel;
