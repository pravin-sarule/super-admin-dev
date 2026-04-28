import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { searchVoiceKb } from '../api/jurinexVoiceApi';

const VoiceKbSearchTester = ({ agents = [] }) => {
  const [query, setQuery] = useState('');
  const [agentId, setAgentId] = useState('');
  const [k, setK] = useState(5);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setResults([]);
    try {
      const data = await searchVoiceKb({
        query: query.trim(),
        k: Number(k) || 5,
        agent_id: agentId || undefined,
        source: 'admin_test',
      });
      setResults(data.results || []);
      setMeta({ trace_id: data.trace_id, latency_ms: data.latency_ms });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <Search className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-slate-900">Test knowledge base</h3>
      </div>

      <form onSubmit={handleSearch} className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">Any agent (incl. global)</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.display_name || a.name}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={20}
            value={k}
            onChange={(e) => setK(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="k (1-20)"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
        <textarea
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What documents are needed for consultation?"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {meta && (
          <div className="text-xs text-slate-500">
            trace: <span className="font-mono">{meta.trace_id}</span> · {meta.latency_ms}ms
          </div>
        )}
      </form>

      {results.length > 0 && (
        <div className="px-6 pb-6 space-y-3">
          {results.map((r, i) => (
            <div key={r.chunk_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  #{i + 1} · {r.document_title}
                </div>
                <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  score {r.score.toFixed(3)}
                </span>
              </div>
              {r.heading_path && (
                <div className="text-xs text-slate-500 mt-1">{r.heading_path}</div>
              )}
              <div className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{r.text}</div>
              {r.gcs_uri && (
                <div className="mt-2 text-xs font-mono text-slate-500 break-all">{r.gcs_uri}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VoiceKbSearchTester;
