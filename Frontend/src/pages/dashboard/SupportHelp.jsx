import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  CircleHelp,
  ExternalLink,
  Eye,
  Filter,
  LoaderCircle,
  Mail,
  MessageSquareText,
  PlusCircle,
  Search,
  Ticket,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

const SUPPORT_DEBUG_PREFIX = '[SupportHelp]';

const createTraceId = () =>
  `support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getStoredToken = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? String(token).trim() : '';
};

const logSupportEvent = (stage, payload = {}, level = 'log') => {
  const logger = console[level] || console.log;
  logger(`${SUPPORT_DEBUG_PREFIX} ${stage}`, payload);
};

const logSupportTableSnapshot = (queries) => {
  const rows = Array.isArray(queries) ? queries : [];
  console.group(`${SUPPORT_DEBUG_PREFIX} table:dataflow`);
  logSupportEvent('table:summary', {
    totalQueries: rows.length,
    ids: rows.map((query) => query.id),
  });
  if (rows.length > 0) {
    console.table(
      rows.map((query) => ({
        id: query.id,
        ticket_number: query.ticket_number || '-',
        subject: query.subject,
        user_id: query.user_id,
        user_name: query.user_name,
        user_email: query.user_email,
        status: query.status,
        priority: query.priority,
        created_at: query.created_at,
      }))
    );
  }
  console.groupEnd();
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

const parseContentDispositionFilename = (contentDisposition = '') => {
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch (error) {
      return utfMatch[1];
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || '';
};

const supportApiService = {
  baseURL: `${API_BASE_URL}/support-queries`,

  getAuthToken() {
    return getStoredToken();
  },

  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  async request(path, { method = 'GET', data, context = 'unknown' } = {}) {
    const traceId = createTraceId();
    const url = `${this.baseURL}${path}`;
    const token = this.getAuthToken();
    const requestMeta = {
      traceId,
      context,
      method,
      url,
      apiBaseUrl: API_BASE_URL,
      userRole: localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'unknown',
      hasToken: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 12)}...` : null,
      payload: data ?? null,
    };

    console.groupCollapsed(`${SUPPORT_DEBUG_PREFIX} ${context} -> ${method} ${url}`);
    logSupportEvent('request:start', requestMeta);

    try {
      const response = await fetch(url, {
        method,
        cache: 'no-store',
        headers: {
          ...this.getAuthHeaders(),
          'X-Request-Id': traceId,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });

      const payload = await readResponsePayload(response);
      const responseMeta = {
        ...requestMeta,
        status: response.status,
        ok: response.ok,
        responsePayload: payload,
      };

      if (!response.ok) {
        logSupportEvent('request:error', responseMeta, 'error');
        throw createApiError({
          message: payload?.message || `Support API request failed with status ${response.status}`,
          status: response.status,
          payload,
          traceId,
          url,
          method,
        });
      }

      logSupportEvent('request:success', responseMeta);
      return payload;
    } catch (error) {
      if (!error.traceId) {
        logSupportEvent(
          'request:exception',
          {
            ...requestMeta,
            errorMessage: error.message,
            stack: error.stack,
          },
          'error'
        );
      }
      throw error;
    } finally {
      console.groupEnd();
    }
  },

  async fetchQueries() {
    return this.request('/all', { context: 'fetchQueries' });
  },

  async getQuery(id) {
    return this.request(`/${id}`, { context: 'getQuery' });
  },

  async createQuery(data) {
    return this.request('', { method: 'POST', data, context: 'createQuery' });
  },

  async updateQuery(id, data) {
    return this.request(`/${id}`, { method: 'PUT', data, context: 'updateQuery' });
  },

  async deleteQuery(id) {
    return this.request(`/${id}`, { method: 'DELETE', context: 'deleteQuery' });
  },

  async fetchPriorities() {
    const token = this.getAuthToken();
    const traceId = createTraceId();
    const url = `${API_BASE_URL}/support-priorities`;
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Request-Id': traceId,
      },
    });
    if (!response.ok) {
      const payload = await readResponsePayload(response);
      throw createApiError({ message: payload?.message || 'Failed to load priorities', status: response.status, traceId, url, method: 'GET' });
    }
    return response.json();
  },

  async getAttachmentPreview(id, attachmentIndex = 0) {
    const traceId = createTraceId();
    const url = `${this.baseURL}/${id}/attachment/preview?attachmentIndex=${attachmentIndex}`;
    const token = this.getAuthToken();
    const requestMeta = {
      traceId,
      context: 'getAttachmentPreview',
      method: 'GET',
      url,
      apiBaseUrl: API_BASE_URL,
      userRole: localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'unknown',
      hasToken: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 12)}...` : null,
      queryId: id,
      attachmentIndex,
    };

    console.groupCollapsed(`${SUPPORT_DEBUG_PREFIX} getAttachmentPreview -> GET ${url}`);
    logSupportEvent('request:start', requestMeta);

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'application/octet-stream',
          'X-Request-Id': traceId,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        const payload = await readResponsePayload(response);
        logSupportEvent(
          'request:error',
          {
            ...requestMeta,
            status: response.status,
            ok: response.ok,
            responsePayload: payload,
          },
          'error'
        );
        throw createApiError({
          message: payload?.message || `Attachment preview request failed with status ${response.status}`,
          status: response.status,
          payload,
          traceId,
          url,
          method: 'GET',
        });
      }

      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition') || '';
      const fileName = parseContentDispositionFilename(contentDisposition);

      logSupportEvent('request:success', {
        ...requestMeta,
        status: response.status,
        ok: response.ok,
        contentType,
        fileName,
        blobSize: blob.size,
      });

      return { blob, contentType, fileName, traceId, url, attachmentIndex };
    } catch (error) {
      if (!error.traceId) {
        logSupportEvent(
          'request:exception',
          {
            ...requestMeta,
            errorMessage: error.message,
            stack: error.stack,
          },
          'error'
        );
      }
      throw error;
    } finally {
      console.groupEnd();
    }
  },
};

const collectAttachmentCandidates = (attachmentValue) => {
  if (attachmentValue == null) return [];

  if (Array.isArray(attachmentValue)) {
    return attachmentValue.flatMap((entry) => collectAttachmentCandidates(entry));
  }

  if (typeof attachmentValue === 'object') {
    const candidateValue =
      attachmentValue.attachment_url ||
      attachmentValue.url ||
      attachmentValue.path ||
      attachmentValue.gcsPath ||
      attachmentValue.gcs_path ||
      attachmentValue.file_path ||
      attachmentValue.storage_path ||
      attachmentValue.storagePath ||
      attachmentValue.gcsUrl ||
      attachmentValue.gcs_url ||
      attachmentValue.cloudStorageObject ||
      '';

    if (!candidateValue) return [];

    return [
      {
        value: candidateValue,
        file_name:
          attachmentValue.file_name ||
          attachmentValue.fileName ||
          attachmentValue.name ||
          '',
        mime_type: attachmentValue.mime_type || attachmentValue.mimeType || '',
        size: attachmentValue.size || null,
        resolved_attachment_url: attachmentValue.resolved_attachment_url || '',
      },
    ];
  }

  const rawText = String(attachmentValue).trim();
  if (!rawText) return [];

  if (
    (rawText.startsWith('[') && rawText.endsWith(']')) ||
    (rawText.startsWith('{') && rawText.endsWith('}'))
  ) {
    try {
      return collectAttachmentCandidates(JSON.parse(rawText));
    } catch (error) {
      // Fall through to plain string handling.
    }
  }

  if (rawText.includes('\n')) {
    return rawText
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => ({ value: entry, file_name: '', resolved_attachment_url: '' }));
  }

  if (rawText.includes('|')) {
    return rawText
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => ({ value: entry, file_name: '', resolved_attachment_url: '' }));
  }

  if (rawText.includes(',')) {
    const commaSeparatedEntries = rawText
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (commaSeparatedEntries.length > 1) {
      return commaSeparatedEntries.map((entry) => ({
        value: entry,
        file_name: '',
        resolved_attachment_url: '',
      }));
    }
  }

  return [{ value: rawText, file_name: '', resolved_attachment_url: '' }];
};

const readPayload = (response) => {
  const payload = response?.data || response;

  if (payload == null) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.map(normalizeQuery);
  }

  return normalizeQuery(payload || {});
};

const resolveAttachmentHref = (attachment) => {
  const resolved = String(
    attachment?.resolved_attachment_url || attachment?.resolved_url || attachment?.resolvedAttachmentUrl || ''
  ).trim();
  if (resolved) return resolved;

  const raw = String(attachment?.attachment_url || attachment || '').trim();
  if (/^https?:\/\//i.test(raw)) return raw;

  return '';
};

const getAttachmentFileName = (attachment) => {
  const rawValue = String(attachment?.attachment_url || attachment?.normalized_path || attachment || '').trim();
  if (!rawValue) return 'attachment';

  const sanitizedValue = rawValue.split('?')[0].replace(/\/+$/, '');
  const segments = sanitizedValue.split('/');
  return segments[segments.length - 1] || 'attachment';
};

const normalizeAttachments = (query) => {
  const attachmentCandidates =
    Array.isArray(query?.attachments) && query.attachments.length > 0
      ? query.attachments
      : query?.attachment_urls != null
        ? collectAttachmentCandidates(query.attachment_urls)
        : collectAttachmentCandidates(query?.attachment_url);

  return attachmentCandidates
    .map((attachment, index) => {
      const rawValue = String(attachment?.attachment_url || attachment?.value || attachment || '').trim();
      if (!rawValue) return null;

      return {
        id: attachment?.id || `attachment-${index}`,
        index: Number.isFinite(attachment?.index) ? attachment.index : index,
        attachment_url: rawValue,
        normalized_path: attachment?.normalized_path || rawValue,
        file_name: attachment?.file_name || getAttachmentFileName(rawValue),
        mime_type: attachment?.mime_type || attachment?.mimeType || '',
        size: attachment?.size || null,
        resolved_attachment_url:
          attachment?.resolved_attachment_url ||
          (index === 0 ? query?.resolved_attachment_url || '' : ''),
      };
    })
    .filter(Boolean);
};

const normalizeQuery = (query) => {
  const attachments = normalizeAttachments(query);

  return {
    id: query.id,
    user_id: query.user_id ?? null,
    subject: query.subject || 'Untitled query',
    priority: query.priority || 'medium',
    message: query.message || '',
    attachment_url: query.attachment_url || '',
    attachments,
    attachment_count: query.attachment_count ?? attachments.length,
    resolved_attachment_url:
      query.resolved_attachment_url || attachments[0]?.resolved_attachment_url || '',
    ticket_number: query.ticket_number || '',
    status: query.status || 'open',
    category: query.category || 'General',
    created_at: query.created_at || null,
    updated_at: query.updated_at || null,
    user_name: query.user_name || (query.user_id ? `User #${query.user_id}` : 'Unknown user'),
    user_email: query.user_email || '',
    email_sent: Boolean(query.email_sent),
    status_changed: Boolean(query.status_changed),
  };
};

const getAttachmentPreviewKind = ({ contentType = '', fileName = '' }) => {
  const normalizedType = String(contentType).toLowerCase();
  const normalizedName = String(fileName).toLowerCase();

  if (normalizedType.startsWith('image/')) return 'image';
  if (normalizedType.includes('pdf') || normalizedName.endsWith('.pdf')) return 'pdf';
  if (
    normalizedType.includes('msword') ||
    normalizedType.includes('officedocument.wordprocessingml.document') ||
    normalizedName.endsWith('.doc') ||
    normalizedName.endsWith('.docx')
  ) {
    return 'office';
  }
  if (
    normalizedType.startsWith('text/') ||
    ['.txt', '.md', '.json', '.csv', '.log'].some((extension) => normalizedName.endsWith(extension))
  ) {
    return 'text';
  }

  return 'other';
};

const formatStatus = (status) =>
  String(status || 'open')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (value) => {
  if (!value) return '-';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return '-';

  return parsedDate.toLocaleDateString();
};

const statusBadgeStyles = {
  open: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-sky-50 text-sky-700 border-sky-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const defaultPriorityBadgeStyles = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  urgent: 'bg-rose-50 text-rose-700 border-rose-200',
};

const modalBackdropClassName =
  'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm';

const cardClassName =
  'rounded-[28px] border border-slate-200/70 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]';

const SweetAlert = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  text,
  type = 'info',
  showCancel = false,
}) => {
  if (!isOpen) return null;

  const buttonClassName = {
    success: 'bg-emerald-600 hover:bg-emerald-700',
    error: 'bg-rose-600 hover:bg-rose-700',
    warning: 'bg-amber-500 hover:bg-amber-600',
    info: 'bg-blue-600 hover:bg-blue-700',
  }[type];

  return (
    <div className={modalBackdropClassName}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : type === 'success' ? 'Success' : 'Notice'}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{title}</h3>
          {text ? <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p> : null}
        </div>

        <div className="flex justify-end gap-3">
          {showCancel ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${buttonClassName}`}
          >
            {showCancel ? 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex min-w-24 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${
      statusBadgeStyles[status] || 'bg-slate-100 text-slate-600 border-slate-200'
    }`}
  >
    {formatStatus(status)}
  </span>
);

const PriorityBadge = ({ priority, priorityMap = {} }) => {
  const colorClass =
    priorityMap[priority]?.color ||
    defaultPriorityBadgeStyles[priority] ||
    'bg-slate-100 text-slate-600 border-slate-200';
  const label = priorityMap[priority]?.label || priority || 'medium';
  return (
    <span className={`inline-flex min-w-20 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${colorClass}`}>
      {label}
    </span>
  );
};

const InputField = ({ label, children, helper }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
    {children}
    {helper ? <span className="mt-2 block text-xs text-slate-500">{helper}</span> : null}
  </label>
);

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

const QueryFormModal = ({ isOpen, loading, onClose, onSubmit, priorities = [] }) => {
  const [formData, setFormData] = useState({
    user_id: '',
    subject: '',
    message: '',
    priority: 'medium',
    attachment_url: '',
  });

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        user_id: '',
        subject: '',
        message: '',
        priority: 'medium',
        attachment_url: '',
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      user_id: Number.parseInt(formData.user_id, 10),
      subject: formData.subject.trim(),
      message: formData.message.trim(),
      priority: formData.priority,
      attachment_url: formData.attachment_url.trim(),
    });
  };

  return (
    <div className={modalBackdropClassName}>
      <div className="w-full max-w-2xl rounded-[30px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">New Query</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-900">Add Support Query</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          <div className="grid gap-5 md:grid-cols-2">
            <InputField
              label="User ID"
              helper="The current backend requires a numeric user ID when creating a support query."
            >
              <input
                type="number"
                min="1"
                required
                value={formData.user_id}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, user_id: event.target.value }))
                }
                className={inputClassName}
                placeholder="Enter user ID"
              />
            </InputField>

            <InputField label="Priority">
              <select
                value={formData.priority}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, priority: event.target.value }))
                }
                className={inputClassName}
              >
                {priorities.length > 0
                  ? priorities.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))
                  : (
                    <>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </>
                  )}
              </select>
            </InputField>
          </div>

          <InputField label="Subject">
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(event) =>
                setFormData((previous) => ({ ...previous, subject: event.target.value }))
              }
              className={inputClassName}
              placeholder="Brief summary of the issue"
            />
          </InputField>

          <InputField label="Message">
            <textarea
              required
              rows={5}
              value={formData.message}
              onChange={(event) =>
                setFormData((previous) => ({ ...previous, message: event.target.value }))
              }
              className={`${inputClassName} resize-none`}
              placeholder="Describe the issue in detail"
            />
          </InputField>

          <InputField
            label="Attachment URL"
            helper="You can paste one path, or multiple storage paths/URLs separated by new lines."
          >
            <textarea
              rows={4}
              value={formData.attachment_url}
              onChange={(event) =>
                setFormData((previous) => ({ ...previous, attachment_url: event.target.value }))
              }
              className={`${inputClassName} resize-none`}
              placeholder="Paste one or more storage paths or public document URLs"
            />
          </InputField>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Create Query
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AttachmentPreviewModal = ({ preview, onClose, onSelectAttachment }) => {
  if (!preview.isOpen) return null;

  const activeAttachment = preview.attachments?.[preview.activeAttachmentIndex] || null;
  const previewKind = getAttachmentPreviewKind({
    contentType: preview.contentType,
    fileName: preview.fileName,
  });

  return (
    <div className={modalBackdropClassName}>
      <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Attachment Preview
            </p>
            <h3 className="mt-2 truncate text-xl font-semibold text-slate-900">
              {preview.fileName || activeAttachment?.file_name || 'Support attachment'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {preview.attachments?.length || 0} attachment{preview.attachments?.length === 1 ? '' : 's'}
              {preview.contentType ? ` • ${preview.contentType}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close attachment preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden bg-slate-50">
          {preview.attachments?.length > 1 ? (
            <aside className="w-full max-w-[320px] overflow-y-auto border-r border-slate-200 bg-white/85 px-4 py-5">
              <div className="mb-4 px-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Files
                </p>
              </div>
              <div className="space-y-2">
                {preview.attachments.map((attachment, index) => (
                  <button
                    key={attachment.id || `${attachment.file_name}-${index}`}
                    type="button"
                    onClick={() => onSelectAttachment(index)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      index === preview.activeAttachmentIndex
                        ? 'border-blue-200 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {attachment.file_name}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">{attachment.attachment_url}</div>
                  </button>
                ))}
              </div>
            </aside>
          ) : null}

          <div className="flex-1 overflow-auto px-6 py-6">
            {preview.loading ? (
              <div className="flex h-full min-h-[24rem] items-center justify-center">
                <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Loading attachment preview...
                </div>
              </div>
            ) : preview.error ? (
              <div className="mx-auto flex h-full min-h-[24rem] max-w-2xl flex-col items-center justify-center rounded-[28px] border border-amber-200 bg-white px-8 py-10 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">
                  Preview Unavailable
                </p>
                <h4 className="mt-3 text-2xl font-semibold text-slate-900">
                  This attachment could not be previewed
                </h4>
                <p className="mt-4 text-sm leading-7 text-slate-600">{preview.error}</p>
                <p className="mt-4 text-sm leading-7 text-slate-500">
                  If the message mentions storage access, the backend service account still needs
                  `storage.objects.get` permission for this file.
                </p>
              </div>
            ) : preview.objectUrl || preview.textContent ? (
              <div className="h-full min-h-[24rem] rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                {previewKind === 'image' ? (
                  <div className="flex h-full items-center justify-center overflow-auto rounded-[22px] bg-slate-100 p-4">
                    <img
                      src={preview.objectUrl}
                      alt={preview.fileName || 'Attachment preview'}
                      className="max-h-[66vh] w-auto max-w-full rounded-2xl object-contain"
                    />
                  </div>
                ) : previewKind === 'pdf' ? (
                  <iframe
                    title={preview.fileName || 'Attachment preview'}
                    src={preview.objectUrl}
                    className="h-[68vh] w-full rounded-[22px] border border-slate-200"
                  />
                ) : previewKind === 'text' ? (
                  <div className="h-[68vh] overflow-auto rounded-[22px] border border-slate-200 bg-slate-950 p-5">
                    <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-100">
                      {preview.textContent || 'Text preview is empty.'}
                    </pre>
                  </div>
                ) : previewKind === 'office' ? (
                  <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-8 text-center">
                    <p className="text-lg font-semibold text-slate-800">
                      Word documents can be downloaded or opened in a new tab.
                    </p>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
                      Browsers usually do not render `.doc` or `.docx` files inline from protected
                      blob URLs, so this preview keeps the file available through the actions below.
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-8 text-center">
                    <p className="text-lg font-semibold text-slate-800">
                      Inline preview is not available for this file type.
                    </p>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
                      The file was fetched successfully, but the browser cannot render this format
                      directly inside the dashboard preview.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>

          {preview.objectUrl ? (
            <>
              <a
                href={preview.objectUrl}
                download={preview.fileName || 'attachment'}
                className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Download
              </a>
              <a
                href={preview.objectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in New Tab
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const QueryDetailPage = ({
  query,
  loading,
  onBack,
  onDelete,
  onArchive,
  onOpenAttachment,
  onUpdateStatus,
  priorityMap = {},
  priorities = [],
}) => {
  const [nextStatus, setNextStatus] = useState('open');
  const [nextPriority, setNextPriority] = useState('medium');
  const [statusNote, setStatusNote] = useState('');

  useEffect(() => {
    if (query) {
      setNextStatus(query.status || 'open');
      setNextPriority(query.priority || 'medium');
      setStatusNote('');
    }
  }, [query]);

  if (!query) return null;

  const attachments = Array.isArray(query.attachments) ? query.attachments : [];

  return (
    <section className="space-y-6">
      <div className={`${cardClassName} overflow-hidden`}>
        <div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-7">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="Back to queries"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Query Details
              </p>
              <h1 className="mt-2 text-[1.9rem] font-semibold tracking-tight text-slate-950">
                {query.subject}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StatusBadge status={query.status} />
                <PriorityBadge priority={query.priority} priorityMap={priorityMap} />
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <Ticket className="mr-1.5 h-3.5 w-3.5" />
                  {query.ticket_number || `SUP-${query.id}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {query.status === 'closed' ? (
              <button
                type="button"
                onClick={() => onDelete(query)}
                className="inline-flex items-center rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Query
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onArchive(query)}
                className="inline-flex items-center rounded-2xl border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Query
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.5fr_0.95fr] lg:px-7">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <User className="h-4 w-4" />
                  User
                </div>
                <p className="mt-4 text-lg font-semibold text-slate-900">{query.user_name}</p>
                <p className="mt-1 text-sm text-slate-500">{query.user_email || 'No email available'}</p>
                <p className="mt-3 text-sm text-slate-500">User ID: {query.user_id || '-'}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  Timeline
                </div>
                <p className="mt-4 text-sm text-slate-600">Created: {formatDate(query.created_at)}</p>
                <p className="mt-2 text-sm text-slate-600">Updated: {formatDate(query.updated_at)}</p>
                <p className="mt-2 text-sm text-slate-600">Category: {query.category}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Message
              </p>
              <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-5 text-sm leading-7 text-slate-700">
                {query.message || 'No message provided.'}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Attachment
              </p>
              {attachments.length > 0 ? (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-slate-500">
                    {attachments.length} attachment{attachments.length === 1 ? '' : 's'} available for this query.
                  </p>
                  <div className="grid gap-3">
                    {attachments.map((attachment, index) => (
                      <div
                        key={attachment.id || `${attachment.file_name}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 truncate text-sm font-semibold text-slate-800">
                            {attachment.file_name}
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenAttachment(query, index)}
                            className="inline-flex shrink-0 items-center rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Preview
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No attachment was provided for this query.</p>
              )}
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onUpdateStatus(query.id, {
                status: nextStatus,
                priority: nextPriority,
                admin_message: statusNote.trim(),
              });
            }}
            className="rounded-3xl border border-slate-200 bg-white p-6"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Update Status
            </p>

            <div className="mt-5 space-y-5">
              <InputField label="Status">
                <select
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value)}
                  className={inputClassName}
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </InputField>

              <InputField label="Priority">
                <select
                  value={nextPriority}
                  onChange={(event) => setNextPriority(event.target.value)}
                  className={inputClassName}
                >
                  {priorities.length > 0
                    ? priorities.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))
                    : (
                      <>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </>
                    )}
                </select>
              </InputField>

              <InputField
                label="Status Note"
                helper="This note is included in the email sent to the user whenever the query status changes."
              >
                <textarea
                  rows={6}
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  className={`${inputClassName} resize-none`}
                  placeholder="Add a short update for the user"
                />
              </InputField>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Update
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

const SupportHelp = () => {
  const navigate = useNavigate();
  const { queryId } = useParams();
  const previewObjectUrlRef = useRef('');

  const [queries, setQueries] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiLoading, setApiLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [attachmentPreview, setAttachmentPreview] = useState({
    isOpen: false,
    loading: false,
    query: null,
    attachments: [],
    activeAttachmentIndex: 0,
    objectUrl: '',
    contentType: '',
    fileName: '',
    error: '',
    textContent: '',
  });
  const [alert, setAlert] = useState({
    isOpen: false,
    title: '',
    text: '',
    type: 'info',
    showCancel: false,
    onConfirm: () => {},
  });

  const closeAlert = () => {
    setAlert((previous) => ({ ...previous, isOpen: false }));
  };

  const revokeAttachmentPreviewObjectUrl = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = '';
    }
  };

  const closeAttachmentPreview = () => {
    revokeAttachmentPreviewObjectUrl();
    setAttachmentPreview({
      isOpen: false,
      loading: false,
      query: null,
      attachments: [],
      activeAttachmentIndex: 0,
      objectUrl: '',
      contentType: '',
      fileName: '',
      error: '',
      textContent: '',
    });
  };

  const showAlert = ({ onConfirm, ...config }) => {
    setAlert({
      isOpen: true,
      onConfirm: () => {
        if (onConfirm) onConfirm();
        closeAlert();
      },
      ...config,
    });
  };

  // Build a map { value -> { label, color } } for fast badge lookup
  const priorityMap = priorities.reduce((acc, p) => {
    acc[p.value] = { label: p.label, color: p.color };
    return acc;
  }, {});

  const loadQueries = async () => {
    setLoading(true);

    try {
      const response = await supportApiService.fetchQueries();
      const normalizedQueries = readPayload(response);

      logSupportEvent('loadQueries:parsed-response', {
        isArray: Array.isArray(normalizedQueries),
        totalQueries: Array.isArray(normalizedQueries) ? normalizedQueries.length : 0,
        rawResponseType: Array.isArray(response) ? 'array' : typeof response,
        rawResponse: response,
      });
      logSupportTableSnapshot(normalizedQueries);
      setQueries(normalizedQueries);
    } catch (error) {
      logSupportEvent(
        'loadQueries:failed',
        {
          message: error.message,
          status: error.status,
          traceId: error.traceId,
          payload: error.payload,
          url: error.url,
        },
        'error'
      );
      showAlert({
        type: 'error',
        title: 'Unable to Load Queries',
        text:
          error.status === 403
            ? `Access denied while loading support queries. Current role: ${
                localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'unknown'
              }.`
            : error.payload?.message || 'The support query list could not be fetched from the server.',
      });
      setQueries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    logSupportEvent('page:init', {
      apiBaseUrl: API_BASE_URL,
      supportEndpoint: supportApiService.baseURL,
      userRole: localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'unknown',
      hasToken: Boolean(getStoredToken()),
      routeQueryId: queryId || null,
      backendMode: API_BASE_URL.includes('localhost') ? 'local' : 'remote',
    });

    supportApiService.fetchPriorities()
      .then((data) => {
        const active = Array.isArray(data) ? data.filter((p) => p.is_active) : [];
        setPriorities(active);
      })
      .catch((err) => logSupportEvent('priorities:load:failed', { message: err.message }, 'warn'));

    loadQueries();
  }, []);

  useEffect(() => () => revokeAttachmentPreviewObjectUrl(), []);

  useEffect(() => {
    let ignore = false;

    if (!queryId) {
      setSelectedQuery(null);
      return () => {
        ignore = true;
      };
    }

    const loadSelectedQuery = async () => {
      setApiLoading(true);
      try {
        logSupportEvent('detail:load:start', { queryId });
        const response = await supportApiService.getQuery(queryId);
        const normalizedQuery = readPayload(response);

        if (ignore) return;

        logSupportEvent('detail:load:success', {
          queryId,
          ticketNumber: normalizedQuery.ticket_number,
          attachmentResolved: Boolean(normalizedQuery.resolved_attachment_url),
        });
        setSelectedQuery(normalizedQuery);
      } catch (error) {
        if (ignore) return;
        logSupportEvent(
          'detail:load:failed',
          {
            queryId,
            message: error.message,
            status: error.status,
            traceId: error.traceId,
            payload: error.payload,
          },
          'error'
        );
        showAlert({
          type: 'error',
          title: 'Unable to Open Query',
          text: error.payload?.message || 'The query details could not be loaded.',
        });
        navigate('/dashboard/support');
      } finally {
        if (!ignore) {
          setApiLoading(false);
        }
      }
    };

    loadSelectedQuery();

    return () => {
      ignore = true;
    };
  }, [navigate, queryId]);

  const filteredQueries = queries.filter((query) => {
    const haystack = [
      query.subject,
      query.message,
      query.user_name,
      query.user_email,
      query.user_id ? String(query.user_id) : '',
      query.category,
      query.ticket_number,
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch = haystack.includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || query.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || query.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const activeFilteredQueries = filteredQueries.filter((query) => query.status !== 'closed');

  const archivedFilteredQueries = queries.filter((query) => {
    if (query.status !== 'closed') return false;
    const haystack = [
      query.subject,
      query.message,
      query.user_name,
      query.user_email,
      query.user_id ? String(query.user_id) : '',
      query.ticket_number,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  useEffect(() => {
    logSupportEvent('queries:state-updated', {
      totalQueries: queries.length,
      filteredQueries: filteredQueries.length,
      activeFilters: {
        search,
        statusFilter,
        priorityFilter,
      },
      detailView: Boolean(queryId),
    });
  }, [filteredQueries.length, priorityFilter, queries, queryId, search, statusFilter]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  const handleCreateQuery = async (payload) => {
    if (!payload.user_id || !payload.subject || !payload.message) {
      showAlert({
        type: 'warning',
        title: 'Missing Required Fields',
        text: 'User ID, subject, and message are required to create a support query.',
      });
      return;
    }

    setApiLoading(true);

    try {
      const response = await supportApiService.createQuery(payload);
      const newQuery = readPayload(response);
      setQueries((previous) => [newQuery, ...previous]);
      setShowCreateModal(false);
      showAlert({
        type: 'success',
        title: 'Query Created',
        text: 'The support query has been added successfully.',
      });
    } catch (error) {
      logSupportEvent(
        'createQuery:failed',
        {
          message: error.message,
          status: error.status,
          traceId: error.traceId,
          payload: error.payload,
          requestPayload: payload,
        },
        'error'
      );
      showAlert({
        type: 'error',
        title: 'Create Failed',
        text:
          error.payload?.message ||
          'The backend rejected the new support query. Please verify the user ID and try again.',
      });
    } finally {
      setApiLoading(false);
    }
  };

  const handleOpenDetails = (id) => {
    logSupportEvent('detail:navigate', { queryId: id });
    navigate(`/dashboard/support/${id}`);
  };

  const handleBackToList = () => {
    logSupportEvent('detail:back-to-list', { queryId });
    navigate('/dashboard/support');
  };

  const handleUpdateStatus = async (id, payload) => {
    // Capture previous status BEFORE the API call so we can show accurate feedback
    const previousStatus = selectedQuery?.status;
    setApiLoading(true);

    try {
      const response = await supportApiService.updateQuery(id, payload);
      const updatedQuery = readPayload(response);

      // backend echoes status_changed; fall back to local comparison
      const statusChanged =
        updatedQuery.status_changed !== undefined
          ? updatedQuery.status_changed
          : String(previousStatus ?? '').toLowerCase() !== String(updatedQuery.status ?? '').toLowerCase();

      logSupportEvent('updateQuery:success', {
        queryId: id,
        previousStatus,
        nextStatus: updatedQuery.status,
        statusChanged,
        emailTarget: updatedQuery.user_email,
      });

      setQueries((previous) =>
        previous.map((query) => (String(query.id) === String(id) ? updatedQuery : query))
      );
      setSelectedQuery(updatedQuery);

      showAlert({
        type: 'success',
        title: 'Query Updated',
        text: updatedQuery.email_sent
          ? `Query updated successfully — a notification email has been sent to the user with your status note.`
          : `Query details have been saved. No email was sent because the status didn't change and no note was provided.`,
      });
    } catch (error) {
      logSupportEvent(
        'updateQuery:failed',
        {
          queryId: id,
          requestPayload: payload,
          message: error.message,
          status: error.status,
          traceId: error.traceId,
          responsePayload: error.payload,
        },
        'error'
      );
      showAlert({
        type: 'error',
        title: 'Update Failed',
        text: error.payload?.message || 'The support query could not be updated.',
      });
    } finally {
      setApiLoading(false);
    }
  };

  const handleDeleteQuery = (query) => {
    showAlert({
      type: 'warning',
      title: 'Delete This Query?',
      text: `This will permanently remove "${query.subject}".`,
      showCancel: true,
      onConfirm: async () => {
        setApiLoading(true);

        try {
          await supportApiService.deleteQuery(query.id);
          setQueries((previous) => previous.filter((item) => item.id !== query.id));
          if (String(selectedQuery?.id) === String(query.id)) {
            setSelectedQuery(null);
            navigate('/dashboard/support');
          }
          showAlert({
            type: 'success',
            title: 'Query Deleted',
            text: 'The support query has been removed.',
          });
        } catch (error) {
          logSupportEvent(
            'deleteQuery:failed',
            {
              queryId: query.id,
              message: error.message,
              status: error.status,
              traceId: error.traceId,
              payload: error.payload,
            },
            'error'
          );
          showAlert({
            type: 'error',
            title: 'Delete Failed',
            text: error.payload?.message || 'The support query could not be deleted.',
          });
        } finally {
          setApiLoading(false);
        }
      },
    });
  };

  const handleArchiveQuery = (query) => {
    showAlert({
      type: 'warning',
      title: 'Archive This Query?',
      text: `"${query.subject}" will be moved to the archive.`,
      showCancel: true,
      onConfirm: async () => {
        setApiLoading(true);
        try {
          const response = await supportApiService.updateQuery(query.id, { status: 'closed' });
          const updatedQuery = readPayload(response);
          setQueries((previous) =>
            previous.map((item) => (String(item.id) === String(query.id) ? updatedQuery : item))
          );
          if (String(selectedQuery?.id) === String(query.id)) {
            setSelectedQuery(updatedQuery);
            navigate('/dashboard/support');
          }
          showAlert({
            type: 'success',
            title: 'Query Archived',
            text: 'The support query has been moved to the archive.',
          });
        } catch (error) {
          logSupportEvent('archiveQuery:failed', { queryId: query.id, message: error.message }, 'error');
          showAlert({
            type: 'error',
            title: 'Archive Failed',
            text: error.payload?.message || 'The support query could not be archived.',
          });
        } finally {
          setApiLoading(false);
        }
      },
    });
  };

  const loadAttachmentPreview = async (query, attachmentIndex = 0) => {
    const attachments = Array.isArray(query?.attachments) ? query.attachments : [];
    const selectedAttachment = attachments[attachmentIndex];

    if (!selectedAttachment) {
      showAlert({
        type: 'warning',
        title: 'Attachment Missing',
        text: 'The selected attachment could not be found in this support query record.',
      });
      return;
    }

    revokeAttachmentPreviewObjectUrl();
    setAttachmentPreview({
      isOpen: true,
      loading: true,
      query,
      attachments,
      activeAttachmentIndex: attachmentIndex,
      objectUrl: '',
      contentType: '',
      fileName: selectedAttachment.file_name || getAttachmentFileName(selectedAttachment),
      error: '',
      textContent: '',
    });

    try {
      const previewResponse = await supportApiService.getAttachmentPreview(query.id, attachmentIndex);
      const objectUrl = URL.createObjectURL(previewResponse.blob);
      const fileName = previewResponse.fileName || getAttachmentFileName(selectedAttachment);
      const previewKind = getAttachmentPreviewKind({
        contentType: previewResponse.contentType,
        fileName,
      });
      const textContent =
        previewKind === 'text' ? await previewResponse.blob.text().catch(() => '') : '';

      previewObjectUrlRef.current = objectUrl;

      logSupportEvent('attachment:preview:success', {
        queryId: query.id,
        attachmentIndex,
        contentType: previewResponse.contentType,
        fileName,
        blobSize: previewResponse.blob.size,
      });

      setAttachmentPreview({
        isOpen: true,
        loading: false,
        query,
        attachments,
        activeAttachmentIndex: attachmentIndex,
        objectUrl,
        contentType: previewResponse.contentType,
        fileName,
        error: '',
        textContent,
      });
    } catch (error) {
      logSupportEvent(
        'attachment:preview:failed',
        {
          queryId: query.id,
          attachmentIndex,
          message: error.message,
          status: error.status,
          traceId: error.traceId,
          payload: error.payload,
        },
        'error'
      );

      setAttachmentPreview({
        isOpen: true,
        loading: false,
        query,
        attachments,
        activeAttachmentIndex: attachmentIndex,
        objectUrl: '',
        contentType: '',
        fileName: selectedAttachment.file_name || getAttachmentFileName(selectedAttachment),
        error:
          error.payload?.message ||
          'The attachment preview could not be loaded. Check the backend support attachment logs for more detail.',
        textContent: '',
      });
    }
  };

  const handleOpenAttachment = async (query, attachmentIndex = 0) => {
    const selectedAttachment = Array.isArray(query?.attachments)
      ? query.attachments[attachmentIndex]
      : null;
    logSupportEvent('attachment:open', {
      queryId: query.id,
      attachmentIndex,
      attachmentCount: query.attachments?.length || 0,
      rawAttachmentUrl: selectedAttachment?.attachment_url || query.attachment_url,
      resolvedAttachmentUrl: resolveAttachmentHref(selectedAttachment || query),
    });

    await loadAttachmentPreview(query, attachmentIndex);
  };

  const handleSelectAttachmentPreview = async (attachmentIndex) => {
    if (!attachmentPreview.query) return;

    logSupportEvent('attachment:select', {
      queryId: attachmentPreview.query.id,
      nextAttachmentIndex: attachmentIndex,
    });

    await loadAttachmentPreview(attachmentPreview.query, attachmentIndex);
  };

  const isFiltering = Boolean(search) || statusFilter !== 'all' || priorityFilter !== 'all';

  return (
    <>
      <SweetAlert {...alert} onClose={closeAlert} />
      <AttachmentPreviewModal
        preview={attachmentPreview}
        onClose={closeAttachmentPreview}
        onSelectAttachment={handleSelectAttachmentPreview}
      />

      <QueryFormModal
        isOpen={showCreateModal}
        loading={apiLoading}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateQuery}
        priorities={priorities}
      />

      {queryId ? (
        apiLoading && !selectedQuery ? (
          <section className={`${cardClassName} px-6 py-20 text-center`}>
            <div className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              Loading query details...
            </div>
          </section>
        ) : selectedQuery ? (
          <QueryDetailPage
            query={selectedQuery}
            loading={apiLoading}
            onBack={handleBackToList}
            onDelete={handleDeleteQuery}
            onArchive={handleArchiveQuery}
            onOpenAttachment={handleOpenAttachment}
            onUpdateStatus={handleUpdateStatus}
            priorityMap={priorityMap}
            priorities={priorities}
          />
        ) : (
          <section className={`${cardClassName} px-6 py-20 text-center`}>
            <p className="text-lg font-semibold text-slate-700">Query not found</p>
            <button
              type="button"
              onClick={handleBackToList}
              className="mt-4 inline-flex items-center rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Support List
            </button>
          </section>
        )
      ) : (
        <section className={`${cardClassName} overflow-hidden`}>
          <div className="flex flex-col gap-6 px-6 py-6 lg:px-7">
            {/* Header */}
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900">
                  <CircleHelp className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-[1.9rem] font-semibold tracking-tight text-slate-950">
                    Support &amp; Help Management
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Track incoming support requests and update their progress.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                    isFiltering
                      ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                  title="Clear filters"
                >
                  <Filter className="h-5 w-5" />
                </button>

                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search queries..."
                    className="h-11 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 lg:w-60"
                  />
                </label>

                {activeTab === 'active' ? (
                  <>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="all">All Status</option>
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>

                    <select
                      value={priorityFilter}
                      onChange={(event) => setPriorityFilter(event.target.value)}
                      className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="all">All Priority</option>
                      {priorities.length > 0
                        ? priorities.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))
                        : (
                          <>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </>
                        )}
                    </select>
                  </>
                ) : null}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 w-fit">
              <button
                type="button"
                onClick={() => { setActiveTab('active'); clearFilters(); }}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition ${
                  activeTab === 'active'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <MessageSquareText className="h-4 w-4" />
                Active Queries
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {queries.filter((q) => q.status !== 'closed').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('archive'); clearFilters(); }}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition ${
                  activeTab === 'archive'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Archive className="h-4 w-4" />
                Archive
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === 'archive' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {queries.filter((q) => q.status === 'closed').length}
                </span>
              </button>
            </div>

            {/* Active Queries Table */}
            {activeTab === 'active' ? (
              <div className="overflow-hidden rounded-[24px] border border-slate-300/80">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-slate-50/80">
                      <tr className="text-left">
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">ID</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Subject</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">User</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Status</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Priority</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Ticket</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Created</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {loading ? (
                        <tr>
                          <td colSpan="8" className="px-6 py-16 text-center">
                            <div className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                              Loading support queries...
                            </div>
                          </td>
                        </tr>
                      ) : null}

                      {!loading && activeFilteredQueries.length > 0
                        ? activeFilteredQueries.map((query) => (
                            <tr key={query.id} className="transition hover:bg-slate-50/80">
                              <td className="px-4 py-4 text-sm font-semibold text-slate-700">#{query.id}</td>
                              <td className="px-4 py-4 text-sm text-slate-800">
                                <div className="max-w-xs">
                                  <p className="truncate font-medium">{query.subject}</p>
                                  <p className="mt-1 truncate text-xs text-slate-500">{query.message}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-700">
                                <div className="max-w-[12rem]">
                                  <p className="truncate font-medium">{query.user_name}</p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {query.user_email || (query.user_id ? `ID ${query.user_id}` : '-')}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm"><StatusBadge status={query.status} /></td>
                              <td className="px-4 py-4 text-sm"><PriorityBadge priority={query.priority} priorityMap={priorityMap} /></td>
                              <td className="px-4 py-4 text-sm text-slate-600">{query.ticket_number || `SUP-${query.id}`}</td>
                              <td className="px-4 py-4 text-sm text-slate-600">{formatDate(query.created_at)}</td>
                              <td className="px-4 py-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDetails(query.id)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                                    title="View query"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleArchiveQuery(query)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 text-amber-600 transition hover:bg-amber-50"
                                    title="Archive query"
                                  >
                                    <Archive className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        : null}

                      {!loading && activeFilteredQueries.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="px-6 py-20 text-center">
                            <div className="mx-auto flex max-w-sm flex-col items-center">
                              <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
                                <MessageSquareText className="h-7 w-7" />
                              </div>
                              <p className="mt-5 text-lg font-medium text-slate-600">No active queries found</p>
                              <p className="mt-2 text-sm text-slate-500">
                                Try adjusting the search or filter options, or add a new query.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Archive Table */}
            {activeTab === 'archive' ? (
              <div className="overflow-hidden rounded-[24px] border border-slate-300/80">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-amber-50/60">
                      <tr className="text-left">
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">ID</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Subject</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">User</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Priority</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Ticket</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Closed</th>
                        <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {loading ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-16 text-center">
                            <div className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                              Loading archived queries...
                            </div>
                          </td>
                        </tr>
                      ) : null}

                      {!loading && archivedFilteredQueries.length > 0
                        ? archivedFilteredQueries.map((query) => (
                            <tr key={query.id} className="transition hover:bg-slate-50/80">
                              <td className="px-4 py-4 text-sm font-semibold text-slate-700">#{query.id}</td>
                              <td className="px-4 py-4 text-sm text-slate-800">
                                <div className="max-w-xs">
                                  <p className="truncate font-medium">{query.subject}</p>
                                  <p className="mt-1 truncate text-xs text-slate-500">{query.message}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-700">
                                <div className="max-w-[12rem]">
                                  <p className="truncate font-medium">{query.user_name}</p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {query.user_email || (query.user_id ? `ID ${query.user_id}` : '-')}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm"><PriorityBadge priority={query.priority} priorityMap={priorityMap} /></td>
                              <td className="px-4 py-4 text-sm text-slate-600">{query.ticket_number || `SUP-${query.id}`}</td>
                              <td className="px-4 py-4 text-sm text-slate-600">{formatDate(query.updated_at)}</td>
                              <td className="px-4 py-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDetails(query.id)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                                    title="View query"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteQuery(query)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                                    title="Delete query permanently"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        : null}

                      {!loading && archivedFilteredQueries.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-20 text-center">
                            <div className="mx-auto flex max-w-sm flex-col items-center">
                              <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
                                <Archive className="h-7 w-7" />
                              </div>
                              <p className="mt-5 text-lg font-medium text-slate-600">No archived queries</p>
                              <p className="mt-2 text-sm text-slate-500">
                                Closed queries will appear here.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </>
  );
};

export default SupportHelp;
