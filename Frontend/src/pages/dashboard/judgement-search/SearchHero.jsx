import { LoaderCircle, Search, SlidersHorizontal } from 'lucide-react';

const SearchHero = ({
  chunkLimit,
  error,
  judgmentLimit,
  loading,
  onSearch,
  phraseMatch,
  query,
  scoreThreshold,
  sourceScope,
  setChunkLimit,
  setJudgmentLimit,
  setPhraseMatch,
  setQuery,
  setScoreThreshold,
  setSourceScope,
}) => (
  <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Judgement Search</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Search across indexed judgments using semantic chunk retrieval from Qdrant and full-text matching from Elasticsearch. Use source scope to separate admin-uploaded judgments from user-generated citation results.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Search Query</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSearch();
                }
              }}
              placeholder="Try: demolition of the building"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-400"
            />
          </div>
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <SlidersHorizontal className="h-4 w-4" />
            Search Controls
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-600">
              <span className="mb-1 block font-medium">Chunk Limit</span>
              <input
                type="number"
                min="1"
                max="50"
                value={chunkLimit}
                onChange={(event) => setChunkLimit(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-400"
              />
            </label>

            <label className="text-sm text-slate-600">
              <span className="mb-1 block font-medium">Judgment Limit</span>
              <input
                type="number"
                min="1"
                max="50"
                value={judgmentLimit}
                onChange={(event) => setJudgmentLimit(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-400"
              />
            </label>

            <label className="text-sm text-slate-600 sm:col-span-2">
              <span className="mb-1 block font-medium">Source Scope</span>
              <select
                value={sourceScope}
                onChange={(event) => setSourceScope(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-400"
              >
                <option value="admin_uploaded">Admin uploaded</option>
                <option value="user_generated">User generated</option>
                <option value="all">All sources</option>
              </select>
            </label>

            <label className="text-sm text-slate-600 sm:col-span-2">
              <span className="mb-1 block font-medium">Score Threshold (optional)</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={scoreThreshold}
                onChange={(event) => setScoreThreshold(event.target.value)}
                placeholder="0.65"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-400"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Minimum cosine similarity (0–1) between your query and a chunk. Ideal: 0.60–0.70. Chunks scoring below this are dropped instead of shown as weak matches.
              </span>
            </label>

            <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={phraseMatch}
                onChange={(event) => setPhraseMatch(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Use phrase match for full-text results
            </label>
          </div>

          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Searching judgments...' : 'Run Hybrid Search'}
          </button>
        </div>
      </div>
    </div>
  </section>
);

export default SearchHero;
