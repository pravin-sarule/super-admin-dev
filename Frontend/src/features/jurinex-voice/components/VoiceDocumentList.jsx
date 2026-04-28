import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  FileText,
  Trash2,
  RotateCcw,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
} from 'lucide-react';
import {
  listVoiceDocuments,
  getVoiceDocument,
  deleteVoiceDocument,
  reindexVoiceDocument,
} from '../api/jurinexVoiceApi';

const STATUS_META = {
  processing: { label: 'Processing', cls: 'bg-blue-100 text-blue-700 border-blue-200', Icon: Clock },
  ready: { label: 'Ready', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle },
  failed: { label: 'Failed', cls: 'bg-red-100 text-red-700 border-red-200', Icon: AlertCircle },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200', Icon: FileText };
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${meta.cls}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
};

const VoiceDocumentList = ({ agents = [], reloadKey }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const agentMap = useMemo(() => {
    const m = {};
    for (const a of agents) m[a.id] = a;
    return m;
  }, [agents]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listVoiceDocuments({
        agent_id: agentFilter || undefined,
        status: statusFilter || undefined,
        limit: 100,
      });
      setDocs(data.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentFilter, statusFilter, reloadKey]);

  const handleView = async (id) => {
    setDetailLoading(true);
    setDetail({ id });
    try {
      const data = await getVoiceDocument(id);
      setDetail({ id, ...data });
    } catch (err) {
      setDetail({ id, error: err.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document and its chunks? GCS object will also be removed.')) return;
    try {
      await deleteVoiceDocument(id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReindex = async (id) => {
    try {
      await reindexVoiceDocument(id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">Documents</h3>
          {loading && <span className="text-xs text-slate-400 ml-2">loading…</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.display_name || a.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">Any status</option>
            <option value="processing">Processing</option>
            <option value="ready">Ready</option>
            <option value="failed">Failed</option>
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
              <th className="px-6 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Chunks</th>
              <th className="px-4 py-3 font-medium">Uploaded</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">No documents yet.</td>
              </tr>
            )}
            {docs.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-6 py-3">
                  <div className="font-medium text-slate-900">{d.title}</div>
                  <div className="text-xs text-slate-500">{d.original_filename || '—'}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {d.agent_id ? (agentMap[d.agent_id]?.display_name || agentMap[d.agent_id]?.name || d.agent_id) : 'global'}
                </td>
                <td className="px-4 py-3 text-slate-600 uppercase text-xs">{d.source_type}</td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3 text-slate-700">{d.chunk_count}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {d.created_at ? new Date(d.created_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleView(d.id)} title="View" className="p-1.5 hover:bg-slate-100 rounded-md">
                    <Eye className="w-4 h-4 text-slate-600" />
                  </button>
                  <button onClick={() => handleReindex(d.id)} title="Reindex" className="p-1.5 hover:bg-slate-100 rounded-md">
                    <RotateCcw className="w-4 h-4 text-slate-600" />
                  </button>
                  <button onClick={() => handleDelete(d.id)} title="Delete" className="p-1.5 hover:bg-red-50 rounded-md">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{detail.document?.title || 'Document detail'}</h4>
                {detail.document && <StatusBadge status={detail.document.status} />}
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="p-6 text-sm">
              {detailLoading && <div className="text-slate-500">Loading…</div>}
              {detail.error && <div className="text-red-700">{detail.error}</div>}
              {detail.document && (
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><dt className="text-xs text-slate-500">Document ID</dt><dd className="font-mono text-xs break-all">{detail.document.id}</dd></div>
                  <div><dt className="text-xs text-slate-500">Source type</dt><dd>{detail.document.source_type}</dd></div>
                  <div><dt className="text-xs text-slate-500">Filename</dt><dd>{detail.document.original_filename || '—'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Size</dt><dd>{detail.document.file_size_bytes || 0} bytes</dd></div>
                  <div><dt className="text-xs text-slate-500">Chunks</dt><dd>{detail.document.chunk_count}</dd></div>
                  <div><dt className="text-xs text-slate-500">Tokens</dt><dd>{detail.document.token_count}</dd></div>
                  <div className="md:col-span-2"><dt className="text-xs text-slate-500">GCS URI</dt><dd className="font-mono text-xs break-all">{detail.document.gcs_uri || '—'}</dd></div>
                  {detail.document.error_message && (
                    <div className="md:col-span-2"><dt className="text-xs text-slate-500">Error</dt><dd className="text-red-700">{detail.document.error_message}</dd></div>
                  )}
                </dl>
              )}

              {detail.sample_chunks?.length > 0 && (
                <div className="mt-6">
                  <h5 className="text-sm font-semibold text-slate-700 mb-2">First {detail.sample_chunks.length} chunks</h5>
                  <div className="space-y-2">
                    {detail.sample_chunks.map((c) => (
                      <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-500 mb-1">
                          #{c.chunk_index} · {c.token_count} tokens · {c.heading_path || 'no heading'}
                        </div>
                        <div className="text-sm whitespace-pre-wrap text-slate-700">{c.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceDocumentList;
