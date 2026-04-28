import React, { useEffect, useState } from 'react';
import { RefreshCw, Bot, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { listVoiceAgents, createVoiceAgent } from '../api/jurinexVoiceApi';

const StatusPill = ({ status }) => {
  const cls =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : status === 'inactive'
        ? 'bg-gray-100 text-gray-600 border-gray-200'
        : 'bg-amber-100 text-amber-700 border-amber-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status === 'active' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {status}
    </span>
  );
};

const VoiceAgentList = ({ onRefresh }) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: '', display_name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listVoiceAgents();
      setAgents(data.agents || []);
      onRefresh?.(data.agents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createVoiceAgent({
        name: draft.name.trim(),
        display_name: draft.display_name.trim() || undefined,
        description: draft.description.trim() || undefined,
      });
      setDraft({ name: '', display_name: '', description: '' });
      setShowCreate(false);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">Voice Agents</h3>
          {loading && <span className="text-xs text-slate-400 ml-2">loading…</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New agent
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="px-6 py-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
            placeholder="agent_name (lowercase, no spaces)"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            value={draft.display_name}
            onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
            placeholder="Display name"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Description"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <div className="md:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={creating} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="px-6 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-6 py-3 font-medium">Display name</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Languages</th>
              <th className="px-4 py-3 font-medium">Documents</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agents.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                  No voice agents yet.
                </td>
              </tr>
            )}
            {agents.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">
                  {a.display_name || a.name}
                </td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{a.name}</td>
                <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                <td className="px-4 py-3 text-slate-600">
                  {(a.language_config?.languages || []).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">{a.document_count ?? 0}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {a.updated_at ? new Date(a.updated_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VoiceAgentList;
