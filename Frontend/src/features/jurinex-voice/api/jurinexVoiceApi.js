// Frontend API client for the Jurinex Voice admin module.
//
// Calls land at  <API_BASE_URL>/admin/jurinex-voice/*  (mounted under /api in server.js).
// Every request carries:
//   - X-Admin-API-Key  (from VITE_ADMIN_API_KEY env, optional in dev)
//   - Authorization: Bearer <existing dashboard JWT>  (so this module piggy-backs on existing login)

import { API_BASE_URL, getToken } from '../../../config';

const BASE = `${API_BASE_URL}/admin/jurinex-voice`;

const adminApiKey = () => {
  const key =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_API_KEY) ||
    '';
  return key ? String(key).trim() : '';
};

const headers = (extra = {}) => {
  const token = getToken();
  const apiKey = adminApiKey();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(apiKey ? { 'X-Admin-API-Key': apiKey } : {}),
    ...extra,
  };
};

const handle = async (res) => {
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

// ── Voice agents ────────────────────────────────────────────────────

export const listVoiceAgents = (params = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  return fetch(`${BASE}/agents?${q.toString()}`, { headers: headers() }).then(handle);
};

export const getVoiceAgent = (agentId) =>
  fetch(`${BASE}/agents/${agentId}`, { headers: headers() }).then(handle);

export const createVoiceAgent = (payload) =>
  fetch(`${BASE}/agents`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

export const updateVoiceAgent = (agentId, payload) =>
  fetch(`${BASE}/agents/${agentId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

export const deleteVoiceAgent = (agentId) =>
  fetch(`${BASE}/agents/${agentId}`, {
    method: 'DELETE',
    headers: headers(),
  }).then(handle);

// ── Documents ───────────────────────────────────────────────────────

export const uploadVoiceDocument = ({ file, agent_id, title, language, tags }) => {
  const fd = new FormData();
  fd.append('file', file);
  if (agent_id) fd.append('agent_id', agent_id);
  if (title) fd.append('title', title);
  if (language) fd.append('language', language);
  if (tags) fd.append('tags', Array.isArray(tags) ? tags.join(',') : tags);

  // Don't pass Content-Type for FormData — the browser sets the multipart boundary.
  const token = getToken();
  const apiKey = adminApiKey();
  return fetch(`${BASE}/kb/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(apiKey ? { 'X-Admin-API-Key': apiKey } : {}),
    },
    body: fd,
  }).then(handle);
};

export const uploadVoiceText = (payload) =>
  fetch(`${BASE}/kb/upload-text`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

export const listVoiceDocuments = (params = {}) => {
  const q = new URLSearchParams();
  if (params.agent_id) q.set('agent_id', params.agent_id);
  if (params.status) q.set('status', params.status);
  if (params.source_type) q.set('source_type', params.source_type);
  if (params.limit) q.set('limit', params.limit);
  if (params.offset) q.set('offset', params.offset);
  return fetch(`${BASE}/kb/documents?${q.toString()}`, { headers: headers() }).then(handle);
};

export const getVoiceDocument = (documentId) =>
  fetch(`${BASE}/kb/documents/${documentId}`, { headers: headers() }).then(handle);

export const deleteVoiceDocument = (documentId) =>
  fetch(`${BASE}/kb/documents/${documentId}`, {
    method: 'DELETE',
    headers: headers(),
  }).then(handle);

export const reindexVoiceDocument = (documentId) =>
  fetch(`${BASE}/kb/documents/${documentId}/reindex`, {
    method: 'POST',
    headers: headers(),
  }).then(handle);

// ── Search & debug ──────────────────────────────────────────────────

export const searchVoiceKb = (payload) =>
  fetch(`${BASE}/kb/search`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

export const listVoiceSearchLogs = (params = {}) => {
  const q = new URLSearchParams();
  if (params.agent_id) q.set('agent_id', params.agent_id);
  if (params.limit) q.set('limit', params.limit);
  return fetch(`${BASE}/kb/search-logs?${q.toString()}`, { headers: headers() }).then(handle);
};

export const listVoiceDebugEvents = (params = {}) => {
  const q = new URLSearchParams();
  if (params.event_type) q.set('event_type', params.event_type);
  if (params.document_id) q.set('document_id', params.document_id);
  if (params.agent_id) q.set('agent_id', params.agent_id);
  if (params.limit) q.set('limit', params.limit);
  return fetch(`${BASE}/debug/events?${q.toString()}`, { headers: headers() }).then(handle);
};
