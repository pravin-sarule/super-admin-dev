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

export const getVoiceAgentLiveTestUrl = (agentId) => {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:4000';
  const baseUrl = new URL(`${BASE}/agents/${agentId}/live-test`, origin);
  const apiKey = adminApiKey();
  const token = getToken();

  if (apiKey) baseUrl.searchParams.set('admin_key', apiKey);
  if (token) baseUrl.searchParams.set('token', token);

  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return baseUrl.toString();
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

export const getVoiceAgentConfiguration = (agentId) =>
  fetch(`${BASE}/agents/${agentId}/config`, { headers: headers() }).then(handle);

export const updateVoiceAgentConfiguration = (agentId, payload) =>
  fetch(`${BASE}/agents/${agentId}/config`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

export const runVoiceAgentTestTurn = (agentId, payload) =>
  fetch(`${BASE}/agents/${agentId}/test-turn`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

export const runVoiceAgentTestAudioTurn = (agentId, { audioBlob, ...payload }) => {
  const fd = new FormData();
  fd.append('audio', audioBlob, `agent-test-${Date.now()}.webm`);
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    fd.append(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  const token = getToken();
  const apiKey = adminApiKey();
  return fetch(`${BASE}/agents/${agentId}/test-audio-turn`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(apiKey ? { 'X-Admin-API-Key': apiKey } : {}),
    },
    body: fd,
  }).then(handle);
};

export const streamVoiceAgentTestAudioTurn = async (agentId, { audioBlob, onEvent, ...payload }) => {
  const fd = new FormData();
  fd.append('audio', audioBlob, `agent-test-${Date.now()}.webm`);
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    fd.append(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  const token = getToken();
  const apiKey = adminApiKey();
  const res = await fetch(`${BASE}/agents/${agentId}/test-audio-turn-stream`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(apiKey ? { 'X-Admin-API-Key': apiKey } : {}),
    },
    body: fd,
  });

  if (!res.ok || !res.body) {
    return handle(res);
  }

  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  let buffer = '';

  const emitEventBlock = (block) => {
    const lines = block.split('\n');
    const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message';
    const dataLines = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    if (!dataLines.length) return;
    let data = null;
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      data = { raw: dataLines.join('\n') };
    }
    onEvent?.({ event, data });
  };

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      blocks.filter(Boolean).forEach(emitEventBlock);
    }
    if (done) break;
  }
  if (buffer.trim()) emitEventBlock(buffer);
  return { success: true };
};

export const deleteVoiceAgent = (agentId) =>
  fetch(`${BASE}/agents/${agentId}`, {
    method: 'DELETE',
    headers: headers(),
  }).then(handle);

// ── Platform voices ────────────────────────────────────────────────

export const listPlatformVoices = (params = {}) => {
  const q = new URLSearchParams();
  if (params.gender) q.set('gender', params.gender);
  if (params.accent) q.set('accent', params.accent);
  if (params.search) q.set('search', params.search);
  return fetch(`${BASE}/platform-voices?${q.toString()}`, { headers: headers() }).then(handle);
};

export const getPlatformVoicePreview = (voiceKey, payload) =>
  fetch(`${BASE}/platform-voices/${encodeURIComponent(voiceKey)}/preview`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

export const listVoiceModelPricing = () =>
  fetch(`${BASE}/models/pricing`, { headers: headers() }).then(handle);

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

export const recordVoiceDebugEvent = (payload) =>
  fetch(`${BASE}/debug/events`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

// ── Calendar bookings ──────────────────────────────────────────────

export const listCalendarBookings = (params = {}) => {
  const q = new URLSearchParams();
  if (params.agent_id) q.set('agent_id', params.agent_id);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.limit) q.set('limit', params.limit);
  if (params.offset) q.set('offset', params.offset);
  return fetch(`${BASE}/calendar/bookings?${q.toString()}`, { headers: headers() }).then(handle);
};

export const getCalendarSlots = (params = {}) => {
  const q = new URLSearchParams();
  if (params.agent_id) q.set('agent_id', params.agent_id);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return fetch(`${BASE}/calendar/slots?${q.toString()}`, { headers: headers() }).then(handle);
};

// ── Outbound call scheduler ────────────────────────────────────────

export const listScheduledCalls = (params = {}) => {
  const q = new URLSearchParams();
  ['agent_id', 'status', 'batch_id', 'from', 'to', 'limit', 'offset'].forEach((k) => {
    if (params[k] != null && params[k] !== '') q.set(k, params[k]);
  });
  return fetch(`${BASE}/scheduler/calls?${q.toString()}`, { headers: headers() }).then(handle);
};

export const createScheduledCall = (payload) =>
  fetch(`${BASE}/scheduler/calls`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

export const updateScheduledCall = (id, payload) =>
  fetch(`${BASE}/scheduler/calls/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(payload),
  }).then(handle);

export const cancelScheduledCall = (id) =>
  fetch(`${BASE}/scheduler/calls/${id}`, {
    method: 'DELETE',
    headers: headers(),
  }).then(handle);

export const bulkImportScheduledCalls = ({ file, agent_id, timezone, default_scheduled_at }) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('agent_id', agent_id);
  if (timezone) fd.append('timezone', timezone);
  if (default_scheduled_at) fd.append('default_scheduled_at', default_scheduled_at);
  // Don't include the JSON Content-Type header; browser sets multipart boundary.
  const h = headers();
  delete h['Content-Type'];
  return fetch(`${BASE}/scheduler/calls/bulk-import`, {
    method: 'POST',
    headers: h,
    body: fd,
  }).then(handle);
};

// ── Call analytics & history ───────────────────────────────────────

const callQuery = (params = {}) => {
  const q = new URLSearchParams();
  [
    'start_date',
    'end_date',
    'timezone',
    'agent_id',
    'direction',
    'status',
    'outcome',
    'sentiment',
    'search',
    'limit',
    'offset',
  ].forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      q.set(key, params[key]);
    }
  });
  return q.toString();
};

export const getVoiceCallAnalytics = (params = {}) =>
  fetch(`${BASE}/calls/analytics?${callQuery(params)}`, { headers: headers() }).then(handle);

export const listVoiceCallHistory = (params = {}) =>
  fetch(`${BASE}/calls/history?${callQuery(params)}`, { headers: headers() }).then(handle);

export const getVoiceCall = (callId) =>
  fetch(`${BASE}/calls/${callId}`, { headers: headers() }).then(handle);
