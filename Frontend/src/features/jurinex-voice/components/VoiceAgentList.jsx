import React, { useEffect, useState } from 'react';
import { RefreshCw, Bot, CheckCircle, AlertCircle, Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import {
  listVoiceAgents,
  createVoiceAgent,
  updateVoiceAgent,
  deleteVoiceAgent,
} from '../api/jurinexVoiceApi';
import VoiceAgentConfiguration from './VoiceAgentConfiguration';
import { logVoiceBuilderFlow } from '../utils/voiceDataflowLogger';

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

const VoiceAgentList = ({ onRefresh, onNavigateUpload }) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: '', display_name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', display_name: '', description: '' });
  const [editing, setEditing] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  const handleSaved = (agent) => {
    const next = agents.map((item) =>
      item.id === agent.id ? { ...item, ...agent, document_count: item.document_count } : item
    );
    setAgents(next);
    setSelectedAgent((current) =>
      current?.id === agent.id
        ? { ...current, ...agent, document_count: current.document_count }
        : current
    );
    onRefresh?.(next);
  };

  const openEdit = (agent) => {
    setEditingAgent(agent);
    setEditDraft({
      name: agent.name || '',
      display_name: agent.display_name || '',
      description: agent.description || '',
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingAgent) return;
    setEditing(true);
    try {
      await updateVoiceAgent(editingAgent.id, {
        name: editDraft.name.trim(),
        display_name: editDraft.display_name.trim() || null,
        description: editDraft.description.trim() || null,
      });
      setEditingAgent(null);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setEditing(false);
    }
  };

  const openDelete = (agent) => {
    setDeletingAgent(agent);
    setDeleteConfirmText('');
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeletingAgent(null);
    setDeleteConfirmText('');
  };

  const handleDeleteSubmit = async () => {
    if (!deletingAgent) return;
    if (deleteConfirmText.trim() !== deletingAgent.name) return;
    setDeleting(true);
    try {
      await deleteVoiceAgent(deletingAgent.id);
      setDeletingAgent(null);
      setDeleteConfirmText('');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
    void logVoiceBuilderFlow({
      agentId: agent.id,
      stage: 'agent_row_clicked',
      message: 'Admin clicked voice agent row',
      eventType: 'agent_builder_row_clicked',
      payload: {
        agent_name: agent.name,
        display_name: agent.display_name,
        status: agent.status,
        document_count: agent.document_count ?? 0,
      },
    });
  };

  if (selectedAgent) {
    return (
      <VoiceAgentConfiguration
        agent={selectedAgent}
        onBack={() => setSelectedAgent(null)}
        onSaved={handleSaved}
        onNavigateUpload={onNavigateUpload}
      />
    );
  }

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
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agents.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                  No voice agents yet.
                </td>
              </tr>
            )}
            {agents.map((a) => (
              <tr
                key={a.id}
                onClick={() => handleSelectAgent(a)}
                className="hover:bg-slate-50 cursor-pointer"
                title="Configure agent"
              >
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
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                      title="Edit agent name"
                      aria-label={`Edit ${a.display_name || a.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDelete(a)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title="Delete agent"
                      aria-label={`Delete ${a.display_name || a.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Edit modal ───────────────────────────────────── */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <form
            onSubmit={handleEditSubmit}
            className="w-full max-w-md rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">Edit agent</h3>
              </div>
              <button
                type="button"
                onClick={() => !editing && setEditingAgent(null)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block text-sm">
                <span className="block text-xs font-semibold text-slate-700">
                  Internal name (slug — used in code & URLs)
                </span>
                <input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  required
                  pattern="[a-z0-9_-]+"
                  title="Lowercase letters, numbers, underscores, dashes only."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs font-semibold text-slate-700">
                  Display name (shown to admins)
                </span>
                <input
                  value={editDraft.display_name}
                  onChange={(e) => setEditDraft({ ...editDraft, display_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs font-semibold text-slate-700">Description</span>
                <textarea
                  rows={3}
                  value={editDraft.description}
                  onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                disabled={editing}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editing || !editDraft.name.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editing ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Delete confirmation modal (type-to-confirm) ──── */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="text-base font-semibold text-red-700">Delete agent</h3>
              </div>
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-md p-1 text-red-600 hover:bg-red-100 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <p className="text-slate-700">
                You are about to delete the agent
                {' '}<strong className="text-slate-900">
                  {deletingAgent.display_name || deletingAgent.name}
                </strong>
                . This will:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-slate-600">
                <li>Permanently remove the agent row from the database.</li>
                <li>
                  Cascade-delete its configuration and transfer settings
                  (<code>voice_agent_configurations</code>,
                  <code>voice_agent_transfer_configs</code>).
                </li>
                <li>
                  Keep historical call records, bookings, KB documents,
                  and audit rows — their <code>agent_id</code> becomes
                  a dangling reference but the rows are not deleted.
                </li>
              </ul>
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                <strong>This cannot be undone.</strong> The agent row
                is hard-deleted. Recreating an identical agent later
                will get a different <code>id</code> — anything in your
                stack that references the old id will need updating.
              </div>
              <label className="block text-sm">
                <span className="block text-xs font-semibold text-slate-700">
                  To confirm, type the agent&apos;s internal name{' '}
                  <code className="font-mono text-slate-900">{deletingAgent.name}</code> below:
                </span>
                <input
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deletingAgent.name}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={deleting || deleteConfirmText.trim() !== deletingAgent.name}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAgentList;
