import { ExternalLink, FileSearch, Quote } from 'lucide-react';
import { formatDate } from '../judgement-service/helpers';

function sourceBucketClasses(sourceBucket) {
  if (sourceBucket === 'user_generated') {
    return 'bg-emerald-100 text-emerald-700';
  }

  return 'bg-blue-100 text-blue-700';
}

function sourceBucketLabel(sourceBucket) {
  return sourceBucket === 'user_generated' ? 'User Generated' : 'Admin Uploaded';
}

const FullTextResultsPanel = ({ results = [], requestedSourceScope = 'admin_uploaded' }) => (
  <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Full Text Judgment Matches</h2>
        <p className="text-sm text-slate-500">
          Elasticsearch hits ranked by text relevance, including highlighted snippets.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <FileSearch className="h-4 w-4" />
        {results.length} hits
      </div>
    </div>

    <div className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">
      Requested scope: {String(requestedSourceScope || 'admin_uploaded').replace(/_/g, ' ')}
    </div>

    <div className="space-y-4">
      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
          No full-text results yet. Try another query or broaden the search phrase.
        </div>
      ) : (
        results.map((item, index) => (
          <article key={`${item.judgment.judgmentUuid || 'judgment'}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {item.judgment.caseName || 'Untitled judgment'}
                  </h3>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Relevance {Math.round(Number(item.relevanceScore || 0))}/100
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sourceBucketClasses(item.judgment.sourceBucket)}`}>
                    {sourceBucketLabel(item.judgment.sourceBucket)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span>{item.judgment.courtCode || 'Court pending'}</span>
                  <span>{item.judgment.year || 'Year pending'}</span>
                  <span>{formatDate(item.judgment.judgmentDate)}</span>
                  <span>{item.judgment.canonicalId || 'Canonical ID pending'}</span>
                  <span>Raw ES {Number(item.rawScore || 0).toFixed(3)}</span>
                  <span>Coverage {Math.round(Number(item.relevance?.queryCoverage || 0) * 100)}%</span>
                  {item.relevance?.exactPhraseMatch ? <span>Exact phrase hit</span> : null}
                </div>

                <div className="mt-4 space-y-3">
                  {(item.highlights.fullText || []).map((snippet, snippetIndex) => (
                    <div
                      key={snippetIndex}
                      className="rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700 shadow-sm"
                    >
                      <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <Quote className="h-4 w-4" />
                        Highlight
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: snippet }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full xl:max-w-xs">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Document</div>
                      <div className="mt-1 text-sm text-slate-700">{item.document.originalFilename || 'Original filename unavailable'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Document ID</div>
                      <div className="mt-1 text-sm text-slate-700">{item.document.documentId || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Citation</div>
                      <div className="mt-1 text-sm text-slate-700">{item.judgment.citations?.[0] || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {item.document.originalFileUrl ? (
                  <a
                    href={item.document.originalFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Original
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  </section>
);

export default FullTextResultsPanel;
