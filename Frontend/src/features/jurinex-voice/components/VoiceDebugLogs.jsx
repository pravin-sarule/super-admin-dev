import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { listVoiceDebugEvents } from '../api/jurinexVoiceApi';

const TYPE_COLOR = {
  upload_started: 'bg-blue-100 text-blue-700',
  gcs_uploaded: 'bg-emerald-100 text-emerald-700',
  gcs_failed: 'bg-red-100 text-red-700',
  ingest_started: 'bg-indigo-100 text-indigo-700',
  text_extracted: 'bg-violet-100 text-violet-700',
  chunks_created: 'bg-cyan-100 text-cyan-700',
  embeddings_created: 'bg-purple-100 text-purple-700',
  document_ready: 'bg-emerald-100 text-emerald-700',
  document_failed: 'bg-red-100 text-red-700',
  search_started: 'bg-slate-100 text-slate-700',
  search_completed: 'bg-emerald-100 text-emerald-700',
  agent_builder_row_clicked: 'bg-blue-100 text-blue-700',
  agent_builder_opened: 'bg-blue-100 text-blue-700',
  agent_builder_data_ready: 'bg-emerald-100 text-emerald-700',
  agent_builder_field_changed: 'bg-amber-100 text-amber-700',
  agent_builder_publish_started: 'bg-indigo-100 text-indigo-700',
  agent_builder_publish_completed: 'bg-emerald-100 text-emerald-700',
  agent_builder_publish_failed: 'bg-red-100 text-red-700',
  agent_config_loaded: 'bg-cyan-100 text-cyan-700',
  agent_config_saved: 'bg-emerald-100 text-emerald-700',
  agent_test_audio_started: 'bg-violet-100 text-violet-700',
  agent_test_audio_ended: 'bg-slate-100 text-slate-700',
  agent_test_llm_simulated: 'bg-purple-100 text-purple-700',
};

const VoiceDebugLogs = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listVoiceDebugEvents({
        event_type: filter || undefined,
        limit: 200,
      });
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">Debug events</h3>
          {loading && <span className="text-xs text-slate-400 ml-2">loading…</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">All event types</option>
            {Object.keys(TYPE_COLOR).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-6 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">No debug events yet.</td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id}>
                <td className="px-6 py-2 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[e.event_type] || 'bg-slate-100 text-slate-600'}`}>
                    {e.event_type}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600 text-xs">{e.event_stage || '—'}</td>
                <td className="px-4 py-2 text-slate-700">{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VoiceDebugLogs;
