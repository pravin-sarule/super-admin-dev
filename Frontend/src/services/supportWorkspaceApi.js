import { API_BASE_URL } from '../config';
import { createDebugLogger } from '../utils/debugLogger';

export const SUPPORT_WORKSPACE_DEBUG_PREFIX = '[SupportWorkspace]';
const supportLogger = createDebugLogger('SupportWorkspace');

export const createTraceId = () =>
  `support-workspace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getStoredToken = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? String(token).trim() : '';
};

const getStoredRole = () =>
  localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'unknown';

const logWorkspaceEvent = (stage, payload = {}, level = 'log') => {
  supportLogger.event(stage, payload, level);
};

const readResponsePayload = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      return { parseError: error.message };
    }
  }

  try {
    const text = await response.text();
    return text ? { raw: text } : null;
  } catch (error) {
    return { parseError: error.message };
  }
};

const createApiError = ({ message, status, payload, traceId, url, method }) => {
  const error = new Error(message);
  error.status = status;
  error.payload = payload;
  error.traceId = traceId;
  error.url = url;
  error.method = method;
  return error;
};

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      return;
    }

    if (Array.isArray(value)) {
      searchParams.set(key, value.join(','));
      return;
    }

    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
};

const request = async (
  path,
  { method = 'GET', data, context = 'unknown', headers = {}, responseType = 'json' } = {}
) => {
  const traceId = createTraceId();
  const url = `${API_BASE_URL}${path}`;
  const token = getStoredToken();
  const requestMeta = {
    traceId,
    context,
    method,
    url,
    role: getStoredRole(),
    hasToken: Boolean(token),
    payload: data ?? null,
  };

  supportLogger.flow(`${context} -> ${method} ${url}`, {
    summary: {
      traceId,
      role: requestMeta.role,
      hasToken: requestMeta.hasToken,
    },
    input: requestMeta.payload,
    context: {
      method,
      url,
    },
  });

  try {
    const response = await fetch(url, {
      method,
      cache: 'no-store',
      headers: {
        ...(responseType === 'json' ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Request-Id': traceId,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...headers,
      },
      ...(data !== undefined && responseType === 'json' ? { body: JSON.stringify(data) } : {}),
    });

    if (responseType === 'blob') {
      if (!response.ok) {
        const payload = await readResponsePayload(response);
        supportLogger.error('request:error', createApiError({
          message: payload?.message || `Request failed with status ${response.status}`,
          status: response.status,
          payload,
          traceId,
          url,
          method,
        }), {
          summary: {
            context,
            method,
            status: response.status,
          },
          input: requestMeta.payload,
          output: payload,
        });
        throw createApiError({
          message: payload?.message || `Request failed with status ${response.status}`,
          status: response.status,
          payload,
          traceId,
          url,
          method,
        });
      }

      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition') || '';
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const fileName = fileNameMatch?.[1] || '';

      supportLogger.flow('request:success', {
        summary: {
          context,
          method,
          status: response.status,
        },
        metrics: {
          blobSize: blob.size,
        },
        output: {
          contentType,
          fileName,
          traceId,
        },
      });

      return { blob, contentType, fileName, traceId, url };
    }

    const payload = await readResponsePayload(response);

    if (!response.ok) {
      supportLogger.error('request:error', createApiError({
        message: payload?.message || payload?.error?.message || `Request failed with status ${response.status}`,
        status: response.status,
        payload,
        traceId,
        url,
        method,
      }), {
        summary: {
          context,
          method,
          status: response.status,
        },
        input: requestMeta.payload,
        output: payload,
      });
      throw createApiError({
        message: payload?.message || payload?.error?.message || `Request failed with status ${response.status}`,
        status: response.status,
        payload,
        traceId,
        url,
        method,
      });
    }

    supportLogger.flow('request:success', {
      summary: {
        context,
        method,
        status: response.status,
      },
      input: requestMeta.payload,
      output: payload,
    });

    return payload;
  } catch (error) {
    if (!error.traceId) {
      supportLogger.error('request:exception', error, {
        summary: {
          context,
          method,
        },
        input: requestMeta.payload,
      });
    }
    throw error;
  }
};

export const supportWorkspaceApi = {
  fetchWorkspace(params = {}) {
    return request(`/support-admin/workspace${buildQueryString(params)}`, {
      context: 'fetchWorkspace',
    });
  },

  fetchTicket(ticketId) {
    return request(`/support-admin/tickets/${ticketId}`, {
      context: 'fetchTicket',
    });
  },

  updateTicket(ticketId, payload) {
    return request(`/support-admin/tickets/${ticketId}`, {
      method: 'PATCH',
      data: payload,
      context: 'updateTicket',
    });
  },

  fetchTeamMembers() {
    return request('/support-admin/team/members', {
      context: 'fetchTeamMembers',
    });
  },

  createTeamMember(payload) {
    return request('/support-admin/team/members', {
      method: 'POST',
      data: payload,
      context: 'createTeamMember',
    });
  },

  updateTeamMember(adminId, payload) {
    return request(`/support-admin/team/members/${adminId}`, {
      method: 'PUT',
      data: payload,
      context: 'updateTeamMember',
    });
  },

  bulkAssignTickets(payload) {
    return request('/support-admin/tickets/bulk-assign', {
      method: 'POST',
      data: payload,
      context: 'bulkAssignTickets',
    });
  },

  getAttachmentPreview(ticketId, attachmentIndex = 0) {
    return request(`/support-queries/${ticketId}/attachment/preview?attachmentIndex=${attachmentIndex}`, {
      context: 'getAttachmentPreview',
      responseType: 'blob',
      headers: {
        Accept: 'application/octet-stream',
      },
    });
  },
};

export { logWorkspaceEvent };
