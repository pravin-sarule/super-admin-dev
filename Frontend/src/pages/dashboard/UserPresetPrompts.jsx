import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, FolderOpen, FileText, ChevronLeft, ChevronDown, ChevronRight,
  Copy, Calendar, RefreshCw, Search, Inbox, PlusCircle, X, Trash2,
  Shield, User as UserIcon,
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { API_BASE_URL as API_ROOT, getAuthHeaders } from '../../config';

const MySwal = withReactContent(Swal);

const PRESET_API_URL = `${API_ROOT}/user-preset-prompts`;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
};

/**
 * Prompts are written with XML-ish tags (<role>…</role>, <context>…</context>).
 * Split them into titled sections so a non-technical reader sees headed paragraphs
 * instead of markup. Text outside any tag is kept as an untitled section, so nothing
 * is ever dropped — the sections always concatenate back to the original content.
 */
const parsePromptSections = (text) => {
  if (!text) return [];
  const sections = [];
  const tagPattern = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0;
  let match;

  while ((match = tagPattern.exec(text)) !== null) {
    const between = text.slice(lastIndex, match.index).trim();
    if (between) sections.push({ title: null, body: between });
    const body = match[2].trim();
    if (body) sections.push({ title: match[1], body });
    lastIndex = tagPattern.lastIndex;
  }

  const tail = text.slice(lastIndex).trim();
  if (tail) sections.push({ title: null, body: tail });

  return sections;
};

/** role -> "Role", output_format -> "Output Format" */
const humanizeTitle = (tag) =>
  String(tag || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const SourceBadge = ({ source, label }) => {
  if (source === 'superadmin') {
    return (
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold"
        title={label ? `Added by ${label}` : 'Added by a superadmin'}
      >
        <Shield className="w-3.5 h-3.5 mr-1" />
        Superadmin
      </span>
    );
  }
  if (source === 'mixed') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
        Both
      </span>
    );
  }
  if (source === 'none') {
    return <span className="text-xs text-gray-400">—</span>;
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
      <UserIcon className="w-3.5 h-3.5 mr-1" />
      User
    </span>
  );
};

/** One prompt, rendered as readable titled sections with a raw-text escape hatch. */
const PromptCard = ({ prompt, onDelete }) => {
  const [showRaw, setShowRaw] = useState(false);
  const text = prompt.prompt_text || '';
  const sections = useMemo(() => parsePromptSections(text), [text]);
  const isAdminOwned = prompt.created_by === 'superadmin';

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      MySwal.fire({
        icon: 'success', title: 'Copied', timer: 1200,
        showConfirmButton: false, toast: true, position: 'top-end',
      });
    } catch {
      MySwal.fire({ icon: 'error', title: 'Copy failed', confirmButtonColor: '#3085d6' });
    }
  };

  return (
    <div className="px-5 py-5">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <h4 className="font-semibold text-gray-900">{prompt.name}</h4>
            <SourceBadge source={prompt.created_by} label={prompt.created_by_label} />
          </div>
          {prompt.description && (
            <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{prompt.description}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Toggle the exact original text"
          >
            {showRaw ? 'Readable view' : 'Raw text'}
          </button>
          <button
            onClick={copyText}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Copy prompt text"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {isAdminOwned && (
            <button
              onClick={() => onDelete(prompt)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              title="Delete this prompt"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {showRaw ? (
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-800 font-mono whitespace-pre-wrap break-words">
          {text || '(empty)'}
        </pre>
      ) : sections.length === 0 ? (
        <p className="text-sm text-gray-400 italic">This prompt is empty.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
          {sections.map((section, i) => (
            <div key={i} className="px-4 py-3 bg-white">
              {section.title && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1.5">
                  {humanizeTitle(section.title)}
                </p>
              )}
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                {section.body}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
        <span className="inline-flex items-center">
          <Calendar className="w-3.5 h-3.5 mr-1" />
          Created {formatDate(prompt.created_at)}
        </span>
        <span>Updated {formatDate(prompt.updated_at)}</span>
        <span>{text.length.toLocaleString()} characters</span>
        {prompt.created_by_label && <span>Added by {prompt.created_by_label}</span>}
      </div>
    </div>
  );
};

/** Modal for assigning a new prompt to one specific user. */
const AssignPromptModal = ({ open, onClose, onCreated, presetUser }) => {
  const [directory, setDirectory] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [groups, setGroups] = useState([]);
  const [groupChoice, setGroupChoice] = useState('__new__');
  const [newGroupName, setNewGroupName] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset every time the modal opens so a previous draft never leaks into a new one.
  useEffect(() => {
    if (!open) return;
    setUserSearch('');
    setUserId(presetUser?.user_id || '');
    setGroups([]);
    setGroupChoice('__new__');
    setNewGroupName('');
    setName('');
    setDescription('');
    setPromptText('');

    axios
      .get(`${PRESET_API_URL}/directory`, { headers: getAuthHeaders() })
      .then((res) => setDirectory(res.data?.data || []))
      .catch(() => setDirectory([]));
  }, [open, presetUser]);

  // Load the chosen user's existing groups so the admin can file into one.
  useEffect(() => {
    if (!open || !userId) {
      setGroups([]);
      return;
    }
    axios
      .get(`${PRESET_API_URL}/users/${encodeURIComponent(userId)}`, { headers: getAuthHeaders() })
      .then((res) => setGroups(res.data?.data?.groups || []))
      .catch(() => setGroups([]));
  }, [open, userId]);

  const filteredDirectory = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter((u) =>
      [u.user_id, u.username, u.email].some((f) => String(f || '').toLowerCase().includes(q))
    );
  }, [directory, userSearch]);

  if (!open) return null;

  const usingNewGroup = groupChoice === '__new__';
  const canSubmit =
    userId && name.trim() && promptText.trim() && (usingNewGroup ? newGroupName.trim() : groupChoice);

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        prompt_text: promptText,
        ...(usingNewGroup
          ? { group_name: newGroupName.trim() }
          : { group_id: groupChoice }),
      };
      await axios.post(
        `${PRESET_API_URL}/users/${encodeURIComponent(userId)}/prompts`,
        body,
        { headers: getAuthHeaders() }
      );
      MySwal.fire({
        icon: 'success',
        title: 'Prompt assigned',
        text: 'Only this user can see it in their workspace.',
        confirmButtonColor: '#3085d6',
      });
      onCreated(userId);
      onClose();
    } catch (error) {
      MySwal.fire({
        icon: 'error',
        title: 'Could not assign prompt',
        text: error.response?.data?.message || error.message,
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Assign Prompt to a User</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              The prompt appears only in the selected user's workspace.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">User</label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Filter by name, email or ID..."
              className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setGroupChoice('__new__'); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a user...</option>
              {filteredDirectory.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.username || `User ${u.user_id}`} — {u.email || 'no email'} (ID {u.user_id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Group</label>
            <select
              value={groupChoice}
              onChange={(e) => setGroupChoice(e.target.value)}
              disabled={!userId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="__new__">+ Create a new group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.prompts.length} prompts)
                </option>
              ))}
            </select>
            {usingNewGroup && (
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group name, e.g. Summaries"
                disabled={!userId}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Prompt name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Case Summary Generator"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One line on what this prompt does"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Prompt text</label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={10}
              placeholder={'You can use tags to structure the prompt, e.g.\n\n<role>\nYou are an expert legal assistant.\n</role>\n\n<task>\nSummarise the document.\n</task>'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {promptText.length.toLocaleString()} characters
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || saving}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />}
            Assign Prompt
          </button>
        </div>
      </div>
    </div>
  );
};

const UserPresetPrompts = () => {
  // list view
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  // detail view — null means we're on the list
  const [selectedUser, setSelectedUser] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  const [assignOpen, setAssignOpen] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${PRESET_API_URL}/users`, { headers: getAuthHeaders() });
      setUsers(res.data?.data || []);
    } catch (error) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to load preset prompt users: ${error.response?.data?.message || error.message}`,
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const loadDetail = async (user) => {
    setLoadingDetail(true);
    try {
      const res = await axios.get(
        `${PRESET_API_URL}/users/${encodeURIComponent(user.user_id)}`,
        { headers: getAuthHeaders() }
      );
      const data = res.data?.data || null;
      setDetail(data);
      // Open every group by default — superadmin wants to see everything at a glance.
      setExpandedGroups(Object.fromEntries((data?.groups || []).map((g) => [g.id, true])));
      return true;
    } catch (error) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to load prompts: ${error.response?.data?.message || error.message}`,
        confirmButtonColor: '#3085d6',
      });
      return false;
    } finally {
      setLoadingDetail(false);
    }
  };

  const openUserPrompts = async (user) => {
    setSelectedUser(user);
    setDetail(null);
    setExpandedGroups({});
    const ok = await loadDetail(user);
    if (!ok) setSelectedUser(null);
  };

  const backToList = () => {
    setSelectedUser(null);
    setDetail(null);
    fetchUsers();
  };

  const handleCreated = async (userId) => {
    await fetchUsers();
    if (selectedUser && String(selectedUser.user_id) === String(userId)) {
      await loadDetail(selectedUser);
    }
  };

  const deletePrompt = async (prompt) => {
    const confirm = await MySwal.fire({
      icon: 'warning',
      title: 'Delete this prompt?',
      html: `<b>${prompt.name}</b> will be removed from this user's workspace.`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    try {
      await axios.delete(`${PRESET_API_URL}/prompts/${prompt.id}`, { headers: getAuthHeaders() });
      MySwal.fire({
        icon: 'success', title: 'Deleted', timer: 1400,
        showConfirmButton: false, toast: true, position: 'top-end',
      });
      await loadDetail(selectedUser);
      fetchUsers();
    } catch (error) {
      MySwal.fire({
        icon: 'error',
        title: 'Could not delete',
        text: error.response?.data?.message || error.message,
        confirmButtonColor: '#3085d6',
      });
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.user_id, u.username, u.email].some((f) => String(f || '').toLowerCase().includes(q))
    );
  }, [users, searchValue]);

  /* ---------------------------------- detail --------------------------------- */
  if (selectedUser) {
    const totals = detail?.totals || { groups: 0, prompts: 0 };
    const who = detail?.user || selectedUser;

    return (
      <>
        <AssignPromptModal
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          onCreated={handleCreated}
          presetUser={selectedUser}
        />
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={backToList}
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </button>
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {who.username || `User ${who.user_id}`}
                </h3>
                <p className="text-sm text-gray-500">
                  {who.email || 'No email'} · ID {who.user_id}
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold">
                <FolderOpen className="w-4 h-4 mr-2" />
                {totals.groups} {totals.groups === 1 ? 'Group' : 'Groups'}
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold">
                <FileText className="w-4 h-4 mr-2" />
                {totals.prompts} {totals.prompts === 1 ? 'Prompt' : 'Prompts'}
              </span>
              <button
                onClick={() => setAssignOpen(true)}
                className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Prompt
              </button>
            </div>
          </div>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Loading prompts...
            </div>
          ) : !detail?.groups?.length ? (
            <div className="text-center py-16 text-gray-500">
              <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              This user has no prompt groups yet.
            </div>
          ) : (
            <div className="space-y-4">
              {detail.groups.map((group) => {
                const open = !!expandedGroups[group.id];
                return (
                  <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* group header */}
                    <button
                      type="button"
                      onClick={() => setExpandedGroups((p) => ({ ...p, [group.id]: !p[group.id] }))}
                      className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center min-w-0">
                        {open
                          ? <ChevronDown className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0" />
                          : <ChevronRight className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0" />}
                        <FolderOpen className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{group.name}</p>
                          {group.description && (
                            <p className="text-sm text-gray-500 truncate">{group.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                        <SourceBadge source={group.created_by} label={group.created_by_label} />
                        <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          {group.prompts.length} {group.prompts.length === 1 ? 'prompt' : 'prompts'}
                        </span>
                      </div>
                    </button>

                    {/* prompts in group */}
                    {open && (
                      <div className="divide-y divide-gray-100">
                        {group.prompts.length === 0 ? (
                          <p className="px-5 py-6 text-sm text-gray-500 italic">
                            This group is empty.
                          </p>
                        ) : (
                          group.prompts.map((prompt) => (
                            <PromptCard key={prompt.id} prompt={prompt} onDelete={deletePrompt} />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  /* ----------------------------------- list ---------------------------------- */
  return (
    <>
      <AssignPromptModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onCreated={handleCreated}
        presetUser={null}
      />
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <Users className="w-6 h-6 mr-2 text-blue-600" />
              User Preset Prompts
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Prompts saved in a user's own workspace — created by the user, or assigned by a superadmin.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search user, email, ID..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={fetchUsers}
              disabled={loadingUsers}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingUsers ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setAssignOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Assign Prompt to User
            </button>
          </div>
        </div>

        {loadingUsers ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            {users.length === 0
              ? 'No user has preset prompts yet.'
              : 'No users match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['User', 'User ID', 'Groups', 'Prompts', 'Added By', 'Last Activity', 'Action'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {u.username || `User ${u.user_id}`}
                      </p>
                      <p className="text-sm text-gray-500">{u.email || 'No email'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{u.user_id}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        {u.groups}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                        {u.prompts}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <SourceBadge source={u.added_by} />
                      {u.added_by === 'mixed' && (
                        <p className="text-xs text-gray-500 mt-1">
                          {u.user_prompts} user · {u.admin_prompts} superadmin
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(u.last_activity)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openUserPrompts(u)}
                        className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        View Prompts
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default UserPresetPrompts;
