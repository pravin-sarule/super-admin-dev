import { logWorkspaceEvent } from '../../../services/supportWorkspaceApi';
import { createDebugLogger } from '../../../utils/debugLogger';

const supportWorkspaceLogger = createDebugLogger('SupportWorkspace');

export const CARD_CLASS_NAME =
  'rounded-[28px] border border-slate-200/70 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]';

export const statusBadgeStyles = {
  open: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const defaultPriorityBadgeStyles = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  urgent: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const formatLabel = (value) =>
  String(value || '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(' ');

export const formatDate = (value, withTime = false) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return withTime
    ? date.toLocaleString()
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
        file_name: attachmentValue.file_name || attachmentValue.fileName || attachmentValue.name || '',
        mime_type: attachmentValue.mime_type || attachmentValue.mimeType || '',
        size: attachmentValue.size || null,
      },
    ];
  }

  const rawValue = String(attachmentValue).trim();
  if (!rawValue) return [];

  if (
    (rawValue.startsWith('[') && rawValue.endsWith(']')) ||
    (rawValue.startsWith('{') && rawValue.endsWith('}'))
  ) {
    try {
      return collectAttachmentCandidates(JSON.parse(rawValue));
    } catch (error) {
      logWorkspaceEvent('attachments:parse:failed', {
        value: rawValue,
        message: error.message,
      }, 'warn');
    }
  }

  return rawValue
    .split(/\r?\n|\|/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => ({ value: entry, file_name: '' }));
};

const getAttachmentFileName = (attachment) => {
  const rawValue = String(attachment?.attachment_url || attachment?.value || attachment || '').trim();
  if (!rawValue) return 'attachment';

  const sanitized = rawValue.split('?')[0].replace(/\/+$/, '');
  const segments = sanitized.split('/');
  return segments[segments.length - 1] || 'attachment';
};

export const normalizeTicket = (ticket = {}) => {
  const attachments = collectAttachmentCandidates(ticket.attachment_urls || ticket.attachments || []).map(
    (attachment, index) => ({
      id: attachment.id || `attachment-${index}`,
      index,
      attachment_url: attachment.attachment_url || attachment.value || '',
      file_name: attachment.file_name || getAttachmentFileName(attachment),
      mime_type: attachment.mime_type || '',
      size: attachment.size || null,
    })
  );

  return {
    ...ticket,
    id: Number(ticket.id),
    ticket_number: ticket.ticket_number || `SUP-${ticket.id}`,
    category: String(ticket.category || 'general').trim().toLowerCase() || 'general',
    status: String(ticket.status || 'open').trim().toLowerCase() || 'open',
    priority: String(ticket.priority || 'medium').trim().toLowerCase() || 'medium',
    attachments,
    attachment_count: ticket.attachment_count ?? attachments.length,
    internal_notes: Array.isArray(ticket.internal_notes) ? ticket.internal_notes : [],
    assigned_to_admin_id: ticket.assigned_to_admin_id ?? ticket.assigned_to?.id ?? null,
    updated_at: ticket.updated_at || ticket.last_activity_at || ticket.created_at || null,
  };
};

export const normalizeMember = (member = {}) => ({
  ...member,
  id: Number(member.id),
  manager_admin_id: member.manager_admin_id != null ? Number(member.manager_admin_id) : null,
  reports_to_admin_id: member.reports_to_admin_id != null ? Number(member.reports_to_admin_id) : null,
  created_by_admin_id: member.created_by_admin_id != null ? Number(member.created_by_admin_id) : null,
  hierarchy_role: member.hierarchy_role || (member.is_team_manager ? 'support_admin' : 'support_user'),
  permissions: member.permissions || {},
  workload: member.workload || {
    total_assigned: 0,
    open_assigned: 0,
    closed_assigned: 0,
    archived_assigned: 0,
  },
  allowed_priorities: Array.isArray(member.allowed_priorities) ? member.allowed_priorities : [],
  allowed_categories: Array.isArray(member.allowed_categories) ? member.allowed_categories : [],
});

const normalizeAnalytics = (analytics = {}, members = []) => {
  const managers = Array.isArray(analytics.managers) ? analytics.managers : [];
  const overview = analytics.overview || {};
  const rawUniversal = analytics.universal || {};

  const fallbackUniversalFromManagers =
    analytics.type === 'super_admin'
      ? {
          total_tickets:
            overview.universal_ticket_total ??
            managers.reduce((total, manager) => total + Number(manager?.pool_metrics?.total_tickets || 0), 0),
          open_tickets:
            overview.open_ticket_pool ??
            managers.reduce((total, manager) => total + Number(manager?.pool_metrics?.open_tickets || 0), 0),
          pending_tickets:
            overview.pending_ticket_total ??
            managers.reduce((total, manager) => total + Number(manager?.pool_metrics?.pending_tickets || 0), 0),
          in_progress_tickets:
            overview.in_progress_ticket_total ??
            managers.reduce((total, manager) => total + Number(manager?.pool_metrics?.in_progress_tickets || 0), 0),
          resolved_tickets:
            overview.resolved_ticket_total ??
            managers.reduce((total, manager) => total + Number(manager?.pool_metrics?.resolved_tickets || 0), 0),
          closed_tickets:
            overview.closed_ticket_pool ??
            managers.reduce((total, manager) => total + Number(manager?.pool_metrics?.closed_tickets || 0), 0),
          unassigned_tickets:
            overview.unassigned_ticket_pool ??
            managers.reduce((total, manager) => total + Number(manager?.pool_metrics?.unassigned_tickets || 0), 0),
        }
      : {};

  const universal =
    analytics.type === 'super_admin' &&
    Number(rawUniversal.total_tickets || 0) === 0 &&
    Number(fallbackUniversalFromManagers.total_tickets || 0) > 0
      ? fallbackUniversalFromManagers
      : rawUniversal;

  return {
    type: analytics.type || 'support_user',
    overview,
    universal,
    daily_ticket_trends: Array.isArray(analytics.daily_ticket_trends) ? analytics.daily_ticket_trends : [],
    manager: analytics.manager || null,
    managers,
    team_members: Array.isArray(analytics.team_members)
      ? analytics.team_members.map(normalizeMember)
      : members.filter((member) => member.hierarchy_role === 'support_user'),
  };
};

export const normalizeWorkspacePayload = (payload = {}) => {
  const data = payload?.data || {};
  const viewer = data.viewer || {};
  const summary = data.summary || {};
  const options = data.options || {};
  const team = data.team || {};
  const pagination = data.pagination || {};
  const filters = data.filters || {};

  const tickets = Array.isArray(data.tickets) ? data.tickets.map(normalizeTicket) : [];
  const members = Array.isArray(team.members) ? team.members.map(normalizeMember) : [];
  const analytics = normalizeAnalytics(data.analytics || {}, members);

  supportWorkspaceLogger.flow('workspace:dataflow', {
    summary: {
      ticketCount: tickets.length,
      memberCount: members.length,
      scope: filters.scope || null,
    },
    output: {
      viewer,
      summary,
      analytics,
      ticketIds: tickets.map((ticket) => ticket.id),
      memberIds: members.map((member) => member.id),
      pagination,
      filters,
    },
    table: tickets.map((ticket) => ({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      assigned_to: ticket.assigned_to?.name || 'Unassigned',
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
    })),
  });

  return {
    viewer,
    summary,
    options: {
      priorities: Array.isArray(options.priorities) ? options.priorities : [],
      categories: Array.isArray(options.categories) ? options.categories : [],
      statuses: Array.isArray(options.statuses) ? options.statuses : [],
    },
    team: {
      members,
    },
    analytics,
    pagination,
    filters,
    tickets,
  };
};
