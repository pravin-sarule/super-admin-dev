const bcrypt = require('bcrypt');
const { Op, QueryTypes } = require('sequelize');

const logger = require('../../config/logger');
const supportSequelize = require('../../config/supportSequelize');
const SupportPriority = require('../../models/support_priority');
const SupportQuery = require('../../models/support_query');
const SupportAdminProfile = require('../../models/support_admin_profile');
const { sendError, sendSuccess } = require('../../utils/response');
const sendEmail = require('../../utils/sendEmail');
const {
  getAdminCreationEmailTemplate,
  getQueryStatusUpdateEmailTemplate,
} = require('../../utils/emailTemplates');
const {
  normalizeProfilePermissions,
  DEFAULT_MANAGER_PERMISSIONS: DEFAULT_SUPPORT_MANAGER_PERMISSIONS,
} = require('../../middleware/support/workspace.middleware');

const WORKSPACE_SCOPE_ORDER = [
  'all',
  'assigned_to_me',
  'my_team',
  'unassigned',
  'closed',
];

const STATUS_ORDER = ['open', 'pending', 'in_progress', 'resolved', 'closed'];

const log = (level, message, meta = {}) =>
  logger[level](message, {
    layer: 'SUPPORT_WORKSPACE',
    ...meta,
  });

const toInteger = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  if (typeof value === 'number') return value > 0;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const unique = (values = []) => Array.from(new Set(values.filter(Boolean)));

const normalizeText = (value) => String(value || '').trim();

const normalizeCategory = (value, fallback = 'general') => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || fallback;
};

const normalizeStatuses = (value) => {
  if (Array.isArray(value)) {
    return unique(
      value
        .map((entry) => normalizeText(entry).toLowerCase())
        .filter((entry) => STATUS_ORDER.includes(entry))
    );
  }

  const normalized = normalizeText(value).toLowerCase();
  if (!normalized || normalized === 'all') return [];
  return STATUS_ORDER.includes(normalized) ? [normalized] : [];
};

const normalizeArray = (value, normalizer = (entry) => String(entry || '').trim()) => {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .map((entry) => normalizer(entry))
      .filter(Boolean)
  );
};

const titleize = (value) =>
  String(value || '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(' ');

const shuffle = (items) => {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[randomIndex]] = [list[randomIndex], list[index]];
  }
  return list;
};

const sanitizeQueuePermissions = (payload = {}, fallback = {}) => {
  const permissions = normalizeProfilePermissions({
    ...fallback,
    ...payload,
  });

  return {
    is_team_manager: permissions.is_team_manager,
    can_manage_team: permissions.can_manage_team,
    can_view_all_tickets: permissions.can_view_all_tickets,
    can_view_assigned_to_me: permissions.can_view_assigned_to_me,
    can_view_team_tickets: permissions.can_view_team_tickets,
    can_view_unassigned_tickets: permissions.can_view_unassigned_tickets,
    can_view_closed_tickets: permissions.can_view_closed_tickets,
    can_view_archived_tickets: permissions.can_view_archived_tickets,
  };
};

const createEmptyWorkload = () => ({
  total_assigned: 0,
  open_assigned: 0,
  closed_assigned: 0,
  closed_by_admin_total: 0,
  closed_today_by_admin: 0,
  archived_assigned: 0,
});

const createEmptyPoolMetrics = () => ({
  total_tickets: 0,
  open_tickets: 0,
  pending_tickets: 0,
  in_progress_tickets: 0,
  resolved_tickets: 0,
  closed_tickets: 0,
  unassigned_tickets: 0,
  assigned_to_manager_tickets: 0,
  delegated_to_team_tickets: 0,
});

const isMemberManager = (profile, adminId) => {
  const managerAdminId = toInteger(profile?.manager_admin_id);
  if (!profile) return true;
  return (
    toBoolean(profile.is_team_manager) ||
    toBoolean(profile.can_manage_team) ||
    (managerAdminId != null && managerAdminId === toInteger(adminId))
  );
};

const getTeamAdminIds = (access) =>
  unique(
    [access.adminId, access.managerAdminId, ...(access.teamAdminIds || [])]
      .map((value) => toInteger(value))
      .filter(Number.isInteger)
  );

const buildManagedPoolCondition = (access) => {
  if (access.isSuperAdmin) return null;

  const teamAdminIds = getTeamAdminIds(access);
  const clauses = [];

  if (Number.isInteger(access.managerAdminId)) {
    clauses.push({ team_manager_admin_id: access.managerAdminId });
  }

  if (teamAdminIds.length > 0) {
    clauses.push({
      assigned_to_admin_id: {
        [Op.in]: teamAdminIds,
      },
    });
  }

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];

  return {
    [Op.or]: clauses,
  };
};

const belongsToManagedPool = (ticket, access) => {
  if (access.isSuperAdmin) return true;

  const assignedToAdminId = toInteger(ticket.assigned_to_admin_id);
  const managerAdminId = toInteger(ticket.team_manager_admin_id);
  const teamAdminIds = getTeamAdminIds(access);

  return (
    (managerAdminId != null && managerAdminId === access.managerAdminId) ||
    (assignedToAdminId != null && teamAdminIds.includes(assignedToAdminId))
  );
};

const enforceSupportUserHierarchy = (permissions = {}) => ({
  ...permissions,
  is_team_manager: false,
  can_manage_team: false,
});

const getAvailableScopes = (access) => {
  const permissions = access.permissions || {};
  const available = [];

  if (access.isSuperAdmin || permissions.can_view_all_tickets) {
    available.push('all');
  }
  if (!access.isSuperAdmin && permissions.can_view_assigned_to_me) {
    available.push('assigned_to_me');
  }
  if (access.isSuperAdmin || permissions.can_view_team_tickets || access.isManager) {
    available.push('my_team');
  }
  if (access.isSuperAdmin || permissions.can_view_unassigned_tickets) {
    available.push('unassigned');
  }
  if (access.isSuperAdmin || permissions.can_view_closed_tickets) {
    available.push('closed');
  }

  return WORKSPACE_SCOPE_ORDER.filter((scope) => available.includes(scope));
};

const getEffectiveScope = (requestedScope, access) => {
  const availableScopes = getAvailableScopes(access);
  if (!availableScopes.length) return access.isSuperAdmin ? 'all' : 'assigned_to_me';

  const normalizedRequestedScope = normalizeText(requestedScope).toLowerCase();
  if (availableScopes.includes(normalizedRequestedScope)) {
    return normalizedRequestedScope;
  }

  const defaultQueue = normalizeText(access.defaultQueue).toLowerCase();
  if (availableScopes.includes(defaultQueue)) {
    return defaultQueue;
  }

  return availableScopes[0];
};

const buildScopeConditions = (scope, access) => {
  const teamAdminIds = getTeamAdminIds(access);
  const managedPoolCondition = buildManagedPoolCondition(access);
  const activeTicketCondition = {
    status: {
      [Op.ne]: 'closed',
    },
  };

  switch (scope) {
    case 'assigned_to_me':
      return [
        ...(managedPoolCondition ? [managedPoolCondition] : []),
        { assigned_to_admin_id: access.adminId },
        { archived_at: null },
        activeTicketCondition,
      ];
    case 'my_team':
      if (access.isSuperAdmin) {
        return [
          { assigned_to_admin_id: { [Op.not]: null } },
          { archived_at: null },
          activeTicketCondition,
        ];
      }
      return [
        ...(managedPoolCondition ? [managedPoolCondition] : []),
        teamAdminIds.length > 0
          ? { assigned_to_admin_id: { [Op.in]: teamAdminIds } }
          : { assigned_to_admin_id: access.adminId },
        { archived_at: null },
        activeTicketCondition,
      ];
    case 'unassigned':
      return [
        ...(managedPoolCondition ? [managedPoolCondition] : []),
        { assigned_to_admin_id: null },
        { archived_at: null },
        activeTicketCondition,
      ];
    case 'closed':
      return [
        ...(managedPoolCondition ? [managedPoolCondition] : []),
        { status: 'closed' },
        { archived_at: null },
      ];
    case 'all':
    default:
      return [
        ...(managedPoolCondition ? [managedPoolCondition] : []),
        { archived_at: null },
        activeTicketCondition,
      ];
  }
};

const buildWorkspaceWhere = ({
  access,
  scope,
  search,
  status,
  priorities = [],
  categories = [],
}) => {
  const conditions = [...buildScopeConditions(scope, access)];

  const normalizedStatuses = normalizeStatuses(status);
  if (normalizedStatuses.length === 1) {
    conditions.push({ status: normalizedStatuses[0] });
  } else if (normalizedStatuses.length > 1) {
    conditions.push({
      status: {
        [Op.in]: normalizedStatuses,
      },
    });
  }

  const normalizedPriorities = normalizeArray(priorities, (entry) => String(entry || '').trim().toLowerCase());
  if (normalizedPriorities.length > 0) {
    conditions.push({
      priority: {
        [Op.in]: normalizedPriorities,
      },
    });
  }

  const normalizedCategories = normalizeArray(categories, normalizeCategory);
  if (normalizedCategories.length > 0) {
    conditions.push({
      category: {
        [Op.in]: normalizedCategories,
      },
    });
  }

  const searchTerm = normalizeText(search);
  if (searchTerm) {
    conditions.push({
      [Op.or]: [
        { ticket_number: { [Op.iLike]: `%${searchTerm}%` } },
        { subject: { [Op.iLike]: `%${searchTerm}%` } },
        { message: { [Op.iLike]: `%${searchTerm}%` } },
        { user_name: { [Op.iLike]: `%${searchTerm}%` } },
        { user_email: { [Op.iLike]: `%${searchTerm}%` } },
        { category: { [Op.iLike]: `%${searchTerm}%` } },
      ],
    });
  }

  if (conditions.length === 1) return conditions[0];
  return { [Op.and]: conditions };
};

const fetchAdminDirectory = async (pool, ids = []) => {
  const normalizedIds = unique(ids.map((value) => toInteger(value)).filter(Number.isInteger));
  if (normalizedIds.length === 0) return new Map();

  const result = await pool.query(
    `SELECT
       a.id,
       a.name,
       a.email,
       a.is_blocked,
       r.name AS role_name
     FROM super_admins a
     LEFT JOIN admin_roles r ON r.id = a.role_id
     WHERE a.id = ANY($1::int[])`,
    [normalizedIds]
  );

  return new Map(
    result.rows.map((row) => [
      Number(row.id),
      {
        id: Number(row.id),
        name: row.name,
        email: row.email,
        is_blocked: toBoolean(row.is_blocked),
        role_name: row.role_name,
      },
    ])
  );
};

const fetchSupportAdmins = async (pool, ids = null) => {
  const query =
    Array.isArray(ids) && ids.length > 0
      ? {
          sql: `SELECT
                  a.id,
                  a.name,
                  a.email,
                  a.is_blocked,
                  r.name AS role_name
                FROM super_admins a
                JOIN admin_roles r ON r.id = a.role_id
                WHERE r.name = 'support-admin'
                  AND a.id = ANY($1::int[])
                ORDER BY a.id DESC`,
          params: [ids],
        }
      : {
          sql: `SELECT
                  a.id,
                  a.name,
                  a.email,
                  a.is_blocked,
                  r.name AS role_name
                FROM super_admins a
                JOIN admin_roles r ON r.id = a.role_id
                WHERE r.name = 'support-admin'
                ORDER BY a.id DESC`,
          params: [],
        };

  const result = await pool.query(query.sql, query.params);
  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    email: row.email,
    is_blocked: toBoolean(row.is_blocked),
    role_name: row.role_name,
  }));
};

const hydrateTickets = async (pool, records = []) => {
  const tickets = records.map((record) => (typeof record.toJSON === 'function' ? record.toJSON() : record));
  const adminIds = unique(
    tickets.flatMap((ticket) => [
      toInteger(ticket.assigned_to_admin_id),
      toInteger(ticket.assigned_by_admin_id),
      toInteger(ticket.team_manager_admin_id),
    ])
  );

  const adminDirectory = await fetchAdminDirectory(pool, adminIds);

  return tickets.map((ticket) => {
    const assignedToId = toInteger(ticket.assigned_to_admin_id);
    const assignedById = toInteger(ticket.assigned_by_admin_id);
    const managerAdminId = toInteger(ticket.team_manager_admin_id);
    const internalNotes = Array.isArray(ticket.internal_notes) ? ticket.internal_notes : [];

    return {
      ...ticket,
      category: normalizeCategory(ticket.category),
      status: normalizeText(ticket.status).toLowerCase() || 'open',
      priority: normalizeText(ticket.priority).toLowerCase() || 'medium',
      assigned_to_admin_id: assignedToId,
      assigned_by_admin_id: assignedById,
      team_manager_admin_id: managerAdminId,
      assigned_to: assignedToId ? adminDirectory.get(assignedToId) || null : null,
      assigned_by: assignedById ? adminDirectory.get(assignedById) || null : null,
      team_manager: managerAdminId ? adminDirectory.get(managerAdminId) || null : null,
      internal_notes: internalNotes,
      is_archived: Boolean(ticket.archived_at),
    };
  });
};

const canAccessTicket = (ticket, access) => {
  const permissions = access.permissions || {};
  if (!belongsToManagedPool(ticket, access)) {
    return false;
  }

  const assignedToCurrentAdmin = toInteger(ticket.assigned_to_admin_id) === access.adminId;
  const isArchived = Boolean(ticket.archived_at);
  const isClosed = String(ticket.status || '').trim().toLowerCase() === 'closed';
  const isUnassigned = ticket.assigned_to_admin_id == null;

  if (permissions.can_view_all_tickets && !isArchived) return true;
  if (permissions.can_view_assigned_to_me && assignedToCurrentAdmin && !isArchived) return true;
  if ((permissions.can_view_team_tickets || access.isManager) && !isArchived) return true;
  if (permissions.can_view_unassigned_tickets && isUnassigned && !isArchived) return true;
  if (permissions.can_view_closed_tickets && isClosed && !isArchived) return true;

  return false;
};

const fetchTicketOrNull = async (ticketId) => {
  const parsedTicketId = toInteger(ticketId);
  if (!parsedTicketId) return null;
  return SupportQuery.findByPk(parsedTicketId);
};

const getPriorityOptions = async () => {
  const priorities = await SupportPriority.findAll({
    where: { is_active: true },
    order: [['display_order', 'ASC'], ['id', 'ASC']],
  });

  return priorities.map((priority) => {
    const data = priority.toJSON();
    return {
      id: data.id,
      value: normalizeText(data.value).toLowerCase(),
      label: data.label,
      color: data.color,
    };
  });
};

const getCategoryOptions = async () => {
  const rows = await supportSequelize.query(
    `SELECT DISTINCT COALESCE(NULLIF(TRIM(category), ''), 'general') AS category
     FROM support_queries
     ORDER BY 1 ASC`,
    { type: QueryTypes.SELECT }
  );

  return rows.map((row) => ({
    value: normalizeCategory(row.category),
    label: titleize(normalizeCategory(row.category)),
  }));
};

const getScopeSummary = async (access) => {
  const scopes = getAvailableScopes(access);

  const counts = await Promise.all(
    scopes.map(async (scope) => ({
      scope,
      count: await SupportQuery.count({
        where: buildWorkspaceWhere({
          access,
          scope,
        }),
      }),
    }))
  );

  return counts.reduce((accumulator, item) => {
    accumulator[item.scope] = item.count;
    return accumulator;
  }, {});
};

const appendInternalNote = (existingNotes, note, authorAdminId, authorName) => {
  const noteText = normalizeText(note);
  if (!noteText) return Array.isArray(existingNotes) ? existingNotes : [];

  const nextNotes = Array.isArray(existingNotes) ? [...existingNotes] : [];
  nextNotes.push({
    id: `note-${Date.now()}`,
    note: noteText,
    author_admin_id: authorAdminId,
    author_name: authorName || `Admin #${authorAdminId}`,
    created_at: new Date().toISOString(),
  });

  return nextNotes;
};

const fetchTeamWorkloads = async (adminIds = []) => {
  const normalizedIds = unique(adminIds.map((value) => toInteger(value)).filter(Number.isInteger));
  if (normalizedIds.length === 0) return new Map();

  const rows = await supportSequelize.query(
    `SELECT
       assigned_to_admin_id,
       COUNT(*)::int AS total_assigned,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status <> 'closed')::int AS open_assigned,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'closed')::int AS closed_assigned,
       COUNT(*) FILTER (
         WHERE archived_at IS NULL
           AND status = 'closed'
           AND closed_at IS NOT NULL
           AND (closed_by_admin_id = assigned_to_admin_id OR closed_by_admin_id IS NULL)
       )::int AS closed_by_admin_total,
       COUNT(*) FILTER (
         WHERE archived_at IS NULL
           AND status = 'closed'
           AND closed_at IS NOT NULL
           AND DATE(closed_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
           AND (closed_by_admin_id = assigned_to_admin_id OR closed_by_admin_id IS NULL)
       )::int AS closed_today_by_admin,
       COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived_assigned
     FROM support_queries
     WHERE assigned_to_admin_id IN (:adminIds)
     GROUP BY assigned_to_admin_id`,
    {
      replacements: { adminIds: normalizedIds },
      type: QueryTypes.SELECT,
    }
  );

  return new Map(
    rows.map((row) => [
      Number(row.assigned_to_admin_id),
      {
        total_assigned: Number(row.total_assigned || 0),
        open_assigned: Number(row.open_assigned || 0),
        closed_assigned: Number(row.closed_assigned || 0),
        closed_by_admin_total: Number(row.closed_by_admin_total || 0),
        closed_today_by_admin: Number(row.closed_today_by_admin || 0),
        archived_assigned: Number(row.archived_assigned || 0),
      },
    ])
  );
};

const fetchManagerPoolMetrics = async (managerIds = []) => {
  const normalizedManagerIds = unique(managerIds.map((value) => toInteger(value)).filter(Number.isInteger));
  if (normalizedManagerIds.length === 0) return new Map();

  const rows = await supportSequelize.query(
    `SELECT
       COALESCE(team_manager_admin_id, assigned_to_admin_id) AS manager_admin_id,
       COUNT(*) FILTER (WHERE archived_at IS NULL)::int AS total_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status <> 'closed')::int AS open_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'pending')::int AS pending_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'in_progress')::int AS in_progress_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'resolved')::int AS resolved_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'closed')::int AS closed_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND assigned_to_admin_id IS NULL)::int AS unassigned_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND assigned_to_admin_id = COALESCE(team_manager_admin_id, assigned_to_admin_id))::int AS assigned_to_manager_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND assigned_to_admin_id IS NOT NULL AND assigned_to_admin_id <> COALESCE(team_manager_admin_id, assigned_to_admin_id))::int AS delegated_to_team_tickets
     FROM support_queries
     WHERE COALESCE(team_manager_admin_id, assigned_to_admin_id) IN (:managerIds)
     GROUP BY COALESCE(team_manager_admin_id, assigned_to_admin_id)`,
    {
      replacements: { managerIds: normalizedManagerIds },
      type: QueryTypes.SELECT,
    }
  );

  return new Map(
    rows.map((row) => [
      Number(row.manager_admin_id),
      {
        total_tickets: Number(row.total_tickets || 0),
        open_tickets: Number(row.open_tickets || 0),
        pending_tickets: Number(row.pending_tickets || 0),
        in_progress_tickets: Number(row.in_progress_tickets || 0),
        resolved_tickets: Number(row.resolved_tickets || 0),
        closed_tickets: Number(row.closed_tickets || 0),
        unassigned_tickets: Number(row.unassigned_tickets || 0),
        assigned_to_manager_tickets: Number(row.assigned_to_manager_tickets || 0),
        delegated_to_team_tickets: Number(row.delegated_to_team_tickets || 0),
      },
    ])
  );
};

const fetchAssignmentByAdminCounts = async (adminIds = []) => {
  const normalizedAdminIds = unique(adminIds.map((value) => toInteger(value)).filter(Number.isInteger));
  if (normalizedAdminIds.length === 0) return new Map();

  const rows = await supportSequelize.query(
    `SELECT
       assigned_by_admin_id,
       COUNT(*)::int AS assigned_ticket_count
     FROM support_queries
     WHERE assigned_by_admin_id IN (:adminIds)
     GROUP BY assigned_by_admin_id`,
    {
      replacements: { adminIds: normalizedAdminIds },
      type: QueryTypes.SELECT,
    }
  );

  return new Map(
    rows.map((row) => [Number(row.assigned_by_admin_id), Number(row.assigned_ticket_count || 0)])
  );
};

const fetchGlobalTicketStatusMetrics = async () => {
  const rows = await supportSequelize.query(
    `SELECT
       COUNT(*) FILTER (WHERE archived_at IS NULL)::int AS total_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'open')::int AS open_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'pending')::int AS pending_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'in_progress')::int AS in_progress_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'resolved')::int AS resolved_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'closed')::int AS closed_tickets,
       COUNT(*) FILTER (WHERE archived_at IS NULL AND assigned_to_admin_id IS NULL)::int AS unassigned_tickets
     FROM support_queries`,
    {
      type: QueryTypes.SELECT,
    }
  );

  const row = rows[0] || {};

  return {
    total_tickets: Number(row.total_tickets || 0),
    open_tickets: Number(row.open_tickets || 0),
    pending_tickets: Number(row.pending_tickets || 0),
    in_progress_tickets: Number(row.in_progress_tickets || 0),
    resolved_tickets: Number(row.resolved_tickets || 0),
    closed_tickets: Number(row.closed_tickets || 0),
    unassigned_tickets: Number(row.unassigned_tickets || 0),
  };
};

const fetchGlobalDailyTicketMetrics = async (days = 14) => {
  const safeDays = Math.max(1, toInteger(days) || 14);

  const rows = await supportSequelize.query(
    `WITH date_range AS (
       SELECT generate_series(
         CURRENT_DATE - INTERVAL '${safeDays - 1} day',
         CURRENT_DATE,
         INTERVAL '1 day'
       )::date AS day
     ),
     created_counts AS (
       SELECT DATE(created_at) AS day, COUNT(*)::int AS created_count
       FROM support_queries
       WHERE archived_at IS NULL
         AND created_at >= CURRENT_DATE - INTERVAL '${safeDays - 1} day'
       GROUP BY DATE(created_at)
     ),
     solved_counts AS (
       SELECT DATE(closed_at) AS day, COUNT(*)::int AS solved_count
       FROM support_queries
       WHERE archived_at IS NULL
         AND status = 'closed'
         AND closed_at IS NOT NULL
         AND closed_at >= CURRENT_DATE - INTERVAL '${safeDays - 1} day'
       GROUP BY DATE(closed_at)
     )
     SELECT
       date_range.day,
       TO_CHAR(date_range.day, 'Mon DD') AS label,
       COALESCE(created_counts.created_count, 0)::int AS created_count,
       COALESCE(solved_counts.solved_count, 0)::int AS solved_count
     FROM date_range
     LEFT JOIN created_counts
       ON created_counts.day = date_range.day
     LEFT JOIN solved_counts
       ON solved_counts.day = date_range.day
     ORDER BY date_range.day ASC`,
    {
      type: QueryTypes.SELECT,
    }
  );

  return rows.map((row) => ({
    date: row.day,
    label: row.label,
    created_count: Number(row.created_count || 0),
    solved_count: Number(row.solved_count || 0),
  }));
};

const buildWorkspaceAnalytics = async ({ access, teamMembers = [], summary = {} }) => {
  const managerMembers = teamMembers.filter((member) => member.hierarchy_role === 'support_admin');
  const supportUsers = teamMembers.filter((member) => member.hierarchy_role === 'support_user');
  const managerIds = unique(managerMembers.map((member) => member.id));

  const [poolMetricsMap, assignmentCountsMap, globalTicketStatusMetrics, globalDailyTicketMetrics] = await Promise.all([
    fetchManagerPoolMetrics(managerIds),
    fetchAssignmentByAdminCounts(managerIds),
    access.isSuperAdmin ? fetchGlobalTicketStatusMetrics() : Promise.resolve(null),
    access.isSuperAdmin ? fetchGlobalDailyTicketMetrics(30) : Promise.resolve([]),
  ]);

  const managerSnapshots = managerMembers.map((manager) => {
    const poolMetrics = poolMetricsMap.get(manager.id) || createEmptyPoolMetrics();
    const createdUsers = supportUsers.filter((member) => member.manager_admin_id === manager.id);
    const activeUsers = createdUsers.filter((member) => !member.is_blocked);

    return {
      manager_admin_id: manager.id,
      manager_name: manager.name,
      manager_email: manager.email,
      support_user_count: createdUsers.length,
      active_support_user_count: activeUsers.length,
      assigned_ticket_count: assignmentCountsMap.get(manager.id) || 0,
      pool_metrics: poolMetrics,
      workload: manager.workload || createEmptyWorkload(),
      reports: createdUsers.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        is_blocked: member.is_blocked,
        workload: member.workload || createEmptyWorkload(),
      })),
    };
  });

  if (access.isSuperAdmin) {
    const universalMetrics = globalTicketStatusMetrics || {
      total_tickets: managerSnapshots.reduce(
        (total, manager) => total + (manager.pool_metrics?.total_tickets || 0),
        0
      ),
      open_tickets: managerSnapshots.reduce(
        (total, manager) => total + (manager.pool_metrics?.open_tickets || 0),
        0
      ),
      pending_tickets: managerSnapshots.reduce(
        (total, manager) => total + (manager.pool_metrics?.pending_tickets || 0),
        0
      ),
      in_progress_tickets: managerSnapshots.reduce(
        (total, manager) => total + (manager.pool_metrics?.in_progress_tickets || 0),
        0
      ),
      resolved_tickets: managerSnapshots.reduce(
        (total, manager) => total + (manager.pool_metrics?.resolved_tickets || 0),
        0
      ),
      closed_tickets: managerSnapshots.reduce(
        (total, manager) => total + (manager.pool_metrics?.closed_tickets || 0),
        0
      ),
      unassigned_tickets: managerSnapshots.reduce(
        (total, manager) => total + (manager.pool_metrics?.unassigned_tickets || 0),
        0
      ),
    };

    return {
      type: 'super_admin',
      overview: {
        support_admin_count: managerMembers.length,
        support_user_count: supportUsers.length,
        active_support_user_count: supportUsers.filter((member) => !member.is_blocked).length,
        delegated_ticket_count: managerSnapshots.reduce(
          (total, manager) => total + manager.assigned_ticket_count,
          0
        ),
        managed_ticket_pool: managerSnapshots.reduce(
          (total, manager) => total + manager.pool_metrics.total_tickets,
          0
        ),
        open_ticket_pool: managerSnapshots.reduce(
          (total, manager) => total + manager.pool_metrics.open_tickets,
          0
        ),
        closed_ticket_pool: managerSnapshots.reduce(
          (total, manager) => total + manager.pool_metrics.closed_tickets,
          0
        ),
        unassigned_ticket_pool: managerSnapshots.reduce(
          (total, manager) => total + manager.pool_metrics.unassigned_tickets,
          0
        ),
        pending_ticket_total: universalMetrics.pending_tickets || 0,
        in_progress_ticket_total: universalMetrics.in_progress_tickets || 0,
        resolved_ticket_total: universalMetrics.resolved_tickets || 0,
        universal_ticket_total: universalMetrics.total_tickets || 0,
      },
      universal: universalMetrics,
      daily_ticket_trends: globalDailyTicketMetrics,
      managers: managerSnapshots,
    };
  }

  const currentManagerId = access.isManager ? access.adminId : access.managerAdminId;
  const currentManager =
    managerSnapshots.find((manager) => manager.manager_admin_id === currentManagerId) || null;
  const visibleSupportUsers = supportUsers.filter(
    (member) => member.manager_admin_id === access.managerAdminId
  );

  if (access.isManager) {
    return {
      type: 'support_admin',
      overview: {
        support_user_count: visibleSupportUsers.length,
        active_support_user_count: visibleSupportUsers.filter((member) => !member.is_blocked).length,
        assigned_ticket_count: assignmentCountsMap.get(access.adminId) || 0,
        managed_ticket_pool: currentManager?.pool_metrics.total_tickets || 0,
        open_ticket_pool: currentManager?.pool_metrics.open_tickets || 0,
        closed_ticket_pool: currentManager?.pool_metrics.closed_tickets || 0,
        unassigned_ticket_pool: currentManager?.pool_metrics.unassigned_tickets || 0,
      },
      manager: currentManager,
      team_members: visibleSupportUsers,
    };
  }

  const personalWorkload =
    teamMembers.find((member) => member.id === access.adminId)?.workload || createEmptyWorkload();

  return {
    type: 'support_user',
    overview: {
      assigned_ticket_count: personalWorkload.total_assigned,
      open_ticket_pool: personalWorkload.open_assigned,
      closed_ticket_pool: personalWorkload.closed_assigned,
      team_open_ticket_pool: currentManager?.pool_metrics.open_tickets || 0,
      team_unassigned_ticket_pool: currentManager?.pool_metrics.unassigned_tickets || 0,
    },
    manager: currentManager,
    team_members: visibleSupportUsers,
  };
};

const getTeamMembersForResponse = async (pool, access) => {
  const visibleAdmins = access.isSuperAdmin
    ? await fetchSupportAdmins(pool)
    : await fetchSupportAdmins(pool, access.teamAdminIds);

  const profileRows = await SupportAdminProfile.findAll({
    where: access.isSuperAdmin
      ? {}
      : {
          admin_id: {
            [Op.in]: access.teamAdminIds,
          },
        },
    order: [['id', 'ASC']],
  });

  const profileMap = new Map(
    profileRows.map((profile) => {
      const data = profile.toJSON();
      return [Number(data.admin_id), data];
    })
  );

  const workloads = await fetchTeamWorkloads(visibleAdmins.map((admin) => admin.id));

  return visibleAdmins.map((admin) => {
    const profile = profileMap.get(admin.id) || null;
    const isTeamManager = isMemberManager(profile, admin.id);
    const basePermissions = isTeamManager
      ? { ...DEFAULT_SUPPORT_MANAGER_PERMISSIONS }
      : { can_view_assigned_to_me: true };
    const permissions = sanitizeQueuePermissions(profile || {}, {
      ...basePermissions,
      ...(profile || {}),
    });
    const workload = workloads.get(admin.id) || {
      total_assigned: 0,
      open_assigned: 0,
      closed_assigned: 0,
      closed_by_admin_total: 0,
      closed_today_by_admin: 0,
      archived_assigned: 0,
    };

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role_name: admin.role_name,
      is_blocked: admin.is_blocked,
      team_name: profile?.team_name || (admin.id === access.managerAdminId ? access.teamName : 'Support Team'),
      manager_admin_id: toInteger(profile?.manager_admin_id) || admin.id,
      is_team_manager: isTeamManager,
      can_manage_team: toBoolean(profile?.can_manage_team, isTeamManager),
      hierarchy_role: isTeamManager ? 'support_admin' : 'support_user',
      reports_to_admin_id: isTeamManager ? null : toInteger(profile?.manager_admin_id),
      created_by_admin_id: toInteger(profile?.created_by_admin_id),
      default_queue: profile?.default_queue || (isTeamManager ? 'all' : 'assigned_to_me'),
      allowed_priorities: Array.isArray(profile?.allowed_priorities) ? profile.allowed_priorities : [],
      allowed_categories: Array.isArray(profile?.allowed_categories) ? profile.allowed_categories : [],
      assignment_preferences: profile?.assignment_preferences || {},
      permissions,
      workload,
      created_at: profile?.created_at || null,
      updated_at: profile?.updated_at || null,
    };
  });
};

const fetchSupportRoleId = async (pool) => {
  const result = await pool.query(
    `SELECT id
     FROM admin_roles
     WHERE name = $1
     LIMIT 1`,
    ['support-admin']
  );

  if (result.rowCount === 0) {
    throw new Error('The admin_roles table does not contain the "support-admin" role.');
  }

  return Number(result.rows[0].id);
};

const isSuperAdminsPrimaryKeyConflict = (error) =>
  error?.code === '23505' && String(error?.constraint || '').trim() === 'super_admins_pkey';

const syncSuperAdminsIdSequence = async (pool) => {
  const sequenceResult = await pool.query(
    `SELECT pg_get_serial_sequence('super_admins', 'id') AS sequence_name`
  );

  const sequenceName = sequenceResult.rows[0]?.sequence_name || null;
  if (!sequenceName) {
    return null;
  }

  await pool.query(
    `SELECT setval($1::regclass, COALESCE((SELECT MAX(id) FROM super_admins), 0) + 1, false)`,
    [sequenceName]
  );

  return sequenceName;
};

const createSupportUserAdminRecord = async ({
  pool,
  name,
  email,
  hashedPassword,
  roleId,
  requestId,
  creatorAdminId,
}) => {
  await syncSuperAdminsIdSequence(pool);

  const insertAdmin = () =>
    pool.query(
      `INSERT INTO super_admins (name, email, password, role, role_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role`,
      [name, email, hashedPassword, 'support-admin', roleId]
    );

  try {
    return await insertAdmin();
  } catch (error) {
    if (!isSuperAdminsPrimaryKeyConflict(error)) {
      throw error;
    }

    log('warn', 'Detected out-of-sync super_admins id sequence during support user creation, retrying once', {
      requestId,
      adminId: creatorAdminId,
      email,
      error: error.message,
    });

    await syncSuperAdminsIdSequence(pool);
    return insertAdmin();
  }
};

const fetchAssigneeDefinitions = async (pool, access, rawAssignments = []) => {
  const requestedIds = unique(
    rawAssignments
      .map((entry) => toInteger(entry?.admin_id ?? entry?.adminId))
      .filter(Number.isInteger)
  );

  if (requestedIds.length === 0) {
    return [];
  }

  if (!access.isSuperAdmin) {
    const invalidIds = requestedIds.filter((adminId) => !access.teamAdminIds.includes(adminId));
    if (invalidIds.length > 0) {
      throw new Error(`Some assignees do not belong to your support team: ${invalidIds.join(', ')}`);
    }
  }

  const admins = await fetchAdminDirectory(pool, requestedIds);
  const profiles = await SupportAdminProfile.findAll({
    where: {
      admin_id: {
        [Op.in]: requestedIds,
      },
    },
  });
  const profileMap = new Map(
    profiles.map((profile) => {
      const data = profile.toJSON();
      return [Number(data.admin_id), data];
    })
  );

  return rawAssignments
    .map((entry) => {
      const adminId = toInteger(entry?.admin_id ?? entry?.adminId);
      if (!adminId) return null;

      const admin = admins.get(adminId);
      if (!admin) return null;

      const profile = profileMap.get(adminId) || null;

      return {
        admin_id: adminId,
        admin,
        profile,
        categories: normalizeArray(entry?.categories, normalizeCategory),
        priorities: normalizeArray(entry?.priorities, (item) => String(item || '').trim().toLowerCase()),
        quota: Math.max(1, toInteger(entry?.quota) || 1),
      };
    })
    .filter(Boolean);
};

const sendTicketStatusEmail = async ({
  pool,
  ticket,
  adminMessage,
  previousStatus,
  requestMeta,
}) => {
  const nextStatus = normalizeText(ticket.status).toLowerCase();
  const note = normalizeText(adminMessage);
  const statusDidChange = previousStatus !== nextStatus;

  if (!statusDidChange && !note) {
    return {
      emailSent: false,
      statusDidChange,
      recipientEmail: null,
    };
  }

  let userRow = null;
  if (ticket.user_id) {
    const userResult = await pool.query(
      `SELECT email, username
       FROM users
       WHERE id = $1`,
      [ticket.user_id]
    );
    userRow = userResult.rows[0] || null;
  }

  const recipientEmail = userRow?.email || ticket.user_email || null;
  const recipientName = userRow?.username || ticket.user_name || ticket.user_email || 'User';
  const queryReference = ticket.ticket_number || `SUP-${ticket.id}`;

  if (!recipientEmail) {
    log('warn', 'Skipped support ticket email because no recipient email was available', {
      ...requestMeta,
      ticketId: ticket.id,
      previousStatus,
      nextStatus,
    });
    return {
      emailSent: false,
      statusDidChange,
      recipientEmail: null,
    };
  }

  await sendEmail({
    email: recipientEmail,
    subject: `Support Ticket ${queryReference} Updated to ${titleize(nextStatus)}`,
    html: getQueryStatusUpdateEmailTemplate(
      recipientName,
      ticket.subject,
      nextStatus,
      note,
      queryReference
    ),
    text: `Dear ${recipientName},\n\nYour support ticket ${queryReference} is now ${titleize(nextStatus)}.\n\nUpdate: ${note || 'No note added.'}\n\nRegards,\nSupport Team`,
  });

  log('info', 'Support ticket status email sent', {
    ...requestMeta,
    ticketId: ticket.id,
    previousStatus,
    nextStatus,
    recipientEmail,
  });

  return {
    emailSent: true,
    statusDidChange,
    recipientEmail,
  };
};

module.exports = (pool) => {
  const getWorkspace = async (req, res) => {
    try {
      const access = req.supportAccess;
      const scope = getEffectiveScope(req.query.scope, access);
      const search = normalizeText(req.query.search);
      const status = normalizeText(req.query.status).toLowerCase() || 'all';
      const priorities = normalizeArray(
        normalizeText(req.query.priority)
          ? normalizeText(req.query.priority).split(',')
          : [],
        (entry) => String(entry || '').trim().toLowerCase()
      );
      const categories = normalizeArray(
        normalizeText(req.query.category)
          ? normalizeText(req.query.category).split(',')
          : [],
        normalizeCategory
      );
      const page = Math.max(1, toInteger(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, toInteger(req.query.pageSize) || 25));
      const offset = (page - 1) * pageSize;

      const where = buildWorkspaceWhere({
        access,
        scope,
        search,
        status,
        priorities,
        categories,
      });

      log('info', 'Fetching support workspace', {
        requestId: req.requestId,
        adminId: access.adminId,
        scope,
        page,
        pageSize,
        filters: {
          search,
          status,
          priorities,
          categories,
        },
      });

      const [total, records, summary, priorityOptions, categoryOptions] = await Promise.all([
        SupportQuery.count({ where }),
        SupportQuery.findAll({
          where,
          order: [['updated_at', 'DESC'], ['id', 'DESC']],
          limit: pageSize,
          offset,
        }),
        getScopeSummary(access),
        getPriorityOptions(),
        getCategoryOptions(),
      ]);

      const tickets = await hydrateTickets(pool, records);
      const teamMembers = await getTeamMembersForResponse(pool, access);
      const analytics = await buildWorkspaceAnalytics({
        access,
        teamMembers,
        summary,
      });
      const availableScopes = getAvailableScopes(access);

      log('debug', 'Support workspace dataflow snapshot', {
        requestId: req.requestId,
        adminId: access.adminId,
        scope,
        total,
        ticketIds: tickets.map((ticket) => ticket.id),
        summary,
        availableScopes,
      });

      return sendSuccess(res, {
        viewer: {
          admin_id: access.adminId,
          manager_admin_id: access.managerAdminId,
          is_super_admin: access.isSuperAdmin,
          is_manager: access.isManager,
          hierarchy_role: access.hierarchyRole,
          team_name: access.teamName,
          default_queue: access.defaultQueue,
          can_create_support_users: !access.isSuperAdmin && access.isManager,
          can_edit_team_members: access.isManager || access.isSuperAdmin,
          can_manage_assignments: access.isManager || access.isSuperAdmin,
          permissions: access.permissions,
          available_scopes: availableScopes,
        },
        filters: {
          scope,
          search,
          status,
          priorities,
          categories,
          page,
          pageSize,
        },
        options: {
          priorities: priorityOptions,
          categories: categoryOptions,
          statuses: STATUS_ORDER,
        },
        summary,
        team: {
          members: teamMembers,
        },
        analytics,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
        tickets,
      });
    } catch (error) {
      log('error', 'Failed to fetch support workspace', {
        requestId: req.requestId,
        adminId: req.supportAccess?.adminId,
        error: error.message,
        stack: error.stack,
      });
      return sendError(res, {
        message: 'Failed to fetch the support workspace.',
        details: error.message,
        requestId: req.requestId,
      });
    }
  };

  const getTicketById = async (req, res) => {
    try {
      const access = req.supportAccess;
      const ticket = await fetchTicketOrNull(req.params.id);

      if (!ticket) {
        return sendError(res, {
          code: 'NOT_FOUND',
          message: 'Support ticket not found.',
          statusCode: 404,
          requestId: req.requestId,
        });
      }

      const hydrated = (await hydrateTickets(pool, [ticket]))[0];
      if (!canAccessTicket(hydrated, access)) {
        return sendError(res, {
          code: 'FORBIDDEN',
          message: 'You do not have access to this support ticket.',
          statusCode: 403,
          requestId: req.requestId,
        });
      }

      log('debug', 'Fetched support ticket detail', {
        requestId: req.requestId,
        adminId: access.adminId,
        ticketId: hydrated.id,
        assignedToAdminId: hydrated.assigned_to_admin_id,
        status: hydrated.status,
      });

      return sendSuccess(res, hydrated);
    } catch (error) {
      log('error', 'Failed to fetch support ticket detail', {
        requestId: req.requestId,
        adminId: req.supportAccess?.adminId,
        ticketId: req.params.id,
        error: error.message,
        stack: error.stack,
      });
      return sendError(res, {
        message: 'Failed to fetch support ticket details.',
        details: error.message,
        requestId: req.requestId,
      });
    }
  };

  const updateTicket = async (req, res) => {
    try {
      const access = req.supportAccess;
      const ticket = await fetchTicketOrNull(req.params.id);

      if (!ticket) {
        return sendError(res, {
          code: 'NOT_FOUND',
          message: 'Support ticket not found.',
          statusCode: 404,
          requestId: req.requestId,
        });
      }

      const hydratedBeforeUpdate = (await hydrateTickets(pool, [ticket]))[0];
      if (!canAccessTicket(hydratedBeforeUpdate, access)) {
        return sendError(res, {
          code: 'FORBIDDEN',
          message: 'You do not have access to update this support ticket.',
          statusCode: 403,
          requestId: req.requestId,
        });
      }

      const requestedAssignmentAdminId =
        req.body.assigned_to_admin_id !== undefined
          ? toInteger(req.body.assigned_to_admin_id)
          : req.body.assignedToAdminId !== undefined
            ? toInteger(req.body.assignedToAdminId)
            : undefined;

      let assignee = null;
      if (requestedAssignmentAdminId !== undefined) {
        if (!access.isManager && !access.isSuperAdmin) {
          return sendError(res, {
            code: 'FORBIDDEN',
            message: 'Only support managers can change ticket assignments.',
            statusCode: 403,
            requestId: req.requestId,
          });
        }

        if (requestedAssignmentAdminId !== null) {
          const [resolvedAssignee] = await fetchAssigneeDefinitions(pool, access, [
            { admin_id: requestedAssignmentAdminId },
          ]);

          if (!resolvedAssignee) {
            return sendError(res, {
              code: 'INVALID_ASSIGNEE',
              message: 'The selected assignee could not be found in the support team.',
              statusCode: 400,
              requestId: req.requestId,
            });
          }

          assignee = resolvedAssignee;
        }
      }

      const previousStatus = normalizeText(ticket.status).toLowerCase() || 'open';
      const nextStatus =
        req.body.status !== undefined
          ? normalizeText(req.body.status).toLowerCase() || previousStatus
          : previousStatus;
      const nextPriority =
        req.body.priority !== undefined
          ? normalizeText(req.body.priority).toLowerCase() || ticket.priority
          : ticket.priority;
      const nextCategory =
        req.body.category !== undefined
          ? normalizeCategory(req.body.category)
          : normalizeCategory(ticket.category);
      const nextSubject =
        req.body.subject !== undefined ? normalizeText(req.body.subject) || ticket.subject : ticket.subject;
      const nextMessage =
        req.body.message !== undefined ? normalizeText(req.body.message) || ticket.message : ticket.message;
      const shouldArchive = req.body.archive !== undefined ? toBoolean(req.body.archive) : Boolean(ticket.archived_at);
      const adminMessage = normalizeText(req.body.admin_message);
      const internalNotes = appendInternalNote(
        ticket.internal_notes,
        req.body.internal_note,
        access.adminId,
        req.user.name || req.user.email
      );
      const nextTeamManagerAdminId =
        requestedAssignmentAdminId !== undefined
          ? requestedAssignmentAdminId === null
            ? access.isSuperAdmin
              ? null
              : access.managerAdminId
            : access.isSuperAdmin
              ? assignee?.profile?.manager_admin_id || assignee?.admin_id || null
              : access.managerAdminId
          : ticket.team_manager_admin_id;
      const previousClosedByAdminId = toInteger(ticket.closed_by_admin_id);

      await ticket.update({
        subject: nextSubject,
        message: nextMessage,
        priority: nextPriority,
        category: nextCategory,
        status: nextStatus,
        assigned_to_admin_id:
          requestedAssignmentAdminId !== undefined
            ? requestedAssignmentAdminId
            : ticket.assigned_to_admin_id,
        assigned_by_admin_id:
          requestedAssignmentAdminId !== undefined && requestedAssignmentAdminId !== null
            ? access.adminId
            : requestedAssignmentAdminId === null
              ? null
              : ticket.assigned_by_admin_id,
        team_manager_admin_id: nextTeamManagerAdminId,
        assignment_method:
          requestedAssignmentAdminId !== undefined
            ? normalizeText(req.body.assignment_method).toLowerCase() || 'manual'
            : ticket.assignment_method,
        archived_at: shouldArchive ? ticket.archived_at || new Date() : null,
        closed_at:
          nextStatus === 'closed'
            ? ticket.closed_at || new Date()
            : nextStatus !== 'closed'
              ? null
              : ticket.closed_at,
        closed_by_admin_id:
          nextStatus === 'closed'
            ? previousStatus === 'closed'
              ? previousClosedByAdminId || access.adminId
              : access.adminId
            : null,
        internal_notes: internalNotes,
        last_activity_at: new Date(),
        updated_at: new Date(),
      });

      const refreshedTicket = await fetchTicketOrNull(req.params.id);
      const hydratedTicket = (await hydrateTickets(pool, [refreshedTicket]))[0];

      const emailState = await sendTicketStatusEmail({
        pool,
        ticket: hydratedTicket,
        adminMessage,
        previousStatus,
        requestMeta: {
          requestId: req.requestId,
          adminId: access.adminId,
          ticketId: hydratedTicket.id,
        },
      });

      log('info', 'Support ticket updated', {
        requestId: req.requestId,
        adminId: access.adminId,
        ticketId: hydratedTicket.id,
        previousStatus,
        nextStatus: hydratedTicket.status,
        assignedToAdminId: hydratedTicket.assigned_to_admin_id,
        archived: hydratedTicket.is_archived,
        emailSent: emailState.emailSent,
      });

      return sendSuccess(res, {
        ...hydratedTicket,
        status_changed: emailState.statusDidChange,
        email_sent: emailState.emailSent,
      });
    } catch (error) {
      log('error', 'Failed to update support ticket', {
        requestId: req.requestId,
        adminId: req.supportAccess?.adminId,
        ticketId: req.params.id,
        payload: req.body,
        error: error.message,
        stack: error.stack,
      });
      return sendError(res, {
        message: 'Failed to update the support ticket.',
        details: error.message,
        requestId: req.requestId,
      });
    }
  };

  const listTeamMembers = async (req, res) => {
    try {
      const members = await getTeamMembersForResponse(pool, req.supportAccess);

      log('debug', 'Fetched support team members', {
        requestId: req.requestId,
        adminId: req.supportAccess.adminId,
        totalMembers: members.length,
        memberIds: members.map((member) => member.id),
      });

      return sendSuccess(res, {
        members,
        team_name: req.supportAccess.teamName,
      });
    } catch (error) {
      log('error', 'Failed to fetch support team members', {
        requestId: req.requestId,
        adminId: req.supportAccess?.adminId,
        error: error.message,
        stack: error.stack,
      });
      return sendError(res, {
        message: 'Failed to fetch support team members.',
        details: error.message,
        requestId: req.requestId,
      });
    }
  };

  const createTeamMember = async (req, res) => {
    try {
      const access = req.supportAccess;
      if (!access.isManager || access.isSuperAdmin) {
        return sendError(res, {
          code: 'FORBIDDEN',
          message:
            'Only support admins can create support users here. Super admins should create support admins from Admin Management.',
          statusCode: 403,
          requestId: req.requestId,
        });
      }

      const name = normalizeText(req.body.name);
      const email = normalizeText(req.body.email).toLowerCase();
      const password = normalizeText(req.body.password);
      const defaultQueue = normalizeText(req.body.default_queue || req.body.defaultQueue).toLowerCase() || 'assigned_to_me';
      const teamName = normalizeText(req.body.team_name || req.body.teamName) || access.teamName;
      const permissions = enforceSupportUserHierarchy(
        sanitizeQueuePermissions(req.body.permissions || {}, {
          can_view_assigned_to_me: true,
        })
      );

      if (!name || !email || !password) {
        return sendError(res, {
          code: 'VALIDATION_ERROR',
          message: 'Name, email, and password are required.',
          statusCode: 400,
          requestId: req.requestId,
        });
      }

      const existingAdmin = await pool.query(
        `SELECT id
         FROM super_admins
         WHERE email = $1
         LIMIT 1`,
        [email]
      );

      if (existingAdmin.rowCount > 0) {
        return sendError(res, {
          code: 'DUPLICATE_EMAIL',
          message: 'An admin with this email already exists.',
          statusCode: 409,
          requestId: req.requestId,
        });
      }

      const roleId = await fetchSupportRoleId(pool);
      const hashedPassword = await bcrypt.hash(password, 10);

      const createdAdmin = await createSupportUserAdminRecord({
        pool,
        name,
        email,
        hashedPassword,
        roleId,
        requestId: req.requestId,
        creatorAdminId: access.adminId,
      });

      const admin = createdAdmin.rows[0];

      const profile = await SupportAdminProfile.create({
        admin_id: Number(admin.id),
        manager_admin_id: access.managerAdminId,
        team_name: teamName,
        ...permissions,
        default_queue: defaultQueue === 'all' || defaultQueue === 'my_team' || defaultQueue === 'assigned_to_me' || defaultQueue === 'unassigned' || defaultQueue === 'closed'
          ? defaultQueue
          : 'assigned_to_me',
        allowed_priorities: normalizeArray(
          req.body.allowed_priorities || req.body.allowedPriorities,
          (entry) => String(entry || '').trim().toLowerCase()
        ),
        allowed_categories: normalizeArray(
          req.body.allowed_categories || req.body.allowedCategories,
          normalizeCategory
        ),
        assignment_preferences: req.body.assignment_preferences || req.body.assignmentPreferences || {},
        created_by_admin_id: access.adminId,
        updated_by_admin_id: access.adminId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      try {
        await sendEmail({
          email,
          subject: 'Support Team Account Created - Nexintel',
          html: getAdminCreationEmailTemplate(name, email, password),
        });
      } catch (emailError) {
        log('warn', 'Support team member created but email delivery failed', {
          requestId: req.requestId,
          adminId: access.adminId,
          memberAdminId: admin.id,
          error: emailError.message,
        });
      }

      log('info', 'Support user created under support admin', {
        requestId: req.requestId,
        adminId: access.adminId,
        memberAdminId: admin.id,
        memberEmail: admin.email,
        managerAdminId: access.managerAdminId,
        permissions,
      });

      const members = await getTeamMembersForResponse(pool, access);
      const createdMember = members.find((member) => Number(member.id) === Number(profile.admin_id)) || null;

      return sendSuccess(
        res,
        {
          member: createdMember,
        },
        201
      );
    } catch (error) {
      log('error', 'Failed to create support team member', {
        requestId: req.requestId,
        adminId: req.supportAccess?.adminId,
        payload: req.body,
        error: error.message,
        stack: error.stack,
      });
      return sendError(res, {
        message: 'Failed to create the support user.',
        details: error.message,
        requestId: req.requestId,
      });
    }
  };

  const updateTeamMember = async (req, res) => {
    try {
      const access = req.supportAccess;
      if (!access.isManager && !access.isSuperAdmin) {
        return sendError(res, {
          code: 'FORBIDDEN',
          message: 'Only support managers can update team members.',
          statusCode: 403,
          requestId: req.requestId,
        });
      }

      const adminId = toInteger(req.params.adminId);
      if (!adminId) {
        return sendError(res, {
          code: 'VALIDATION_ERROR',
          message: 'A valid team member ID is required.',
          statusCode: 400,
          requestId: req.requestId,
        });
      }

      if (!access.isSuperAdmin && !access.teamAdminIds.includes(adminId)) {
        return sendError(res, {
          code: 'FORBIDDEN',
          message: 'This support team member is outside your team.',
          statusCode: 403,
          requestId: req.requestId,
        });
      }

      const adminResult = await pool.query(
        `SELECT id, name, email, is_blocked
         FROM super_admins
         WHERE id = $1
         LIMIT 1`,
        [adminId]
      );

      if (adminResult.rowCount === 0) {
        return sendError(res, {
          code: 'NOT_FOUND',
          message: 'Support team member not found.',
          statusCode: 404,
          requestId: req.requestId,
        });
      }

      const existingAdmin = adminResult.rows[0];
      let profile = await SupportAdminProfile.findOne({
        where: { admin_id: adminId },
      });

      if (!profile) {
        const shouldCreateManagerProfile = access.isSuperAdmin;
        profile = await SupportAdminProfile.create({
          admin_id: adminId,
          manager_admin_id: shouldCreateManagerProfile ? adminId : access.managerAdminId,
          team_name: access.teamName,
          ...(shouldCreateManagerProfile
            ? { ...DEFAULT_SUPPORT_MANAGER_PERMISSIONS }
            : { can_view_assigned_to_me: true }),
          created_by_admin_id: access.adminId,
          updated_by_admin_id: access.adminId,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      const nextName = normalizeText(req.body.name) || existingAdmin.name;
      const nextEmail = normalizeText(req.body.email).toLowerCase() || existingAdmin.email;
      const nextPassword = normalizeText(req.body.password);
      const nextBlocked = req.body.is_blocked !== undefined ? toBoolean(req.body.is_blocked) : toBoolean(existingAdmin.is_blocked);

      if (nextEmail !== existingAdmin.email) {
        const emailCheck = await pool.query(
          `SELECT id
           FROM super_admins
           WHERE email = $1
             AND id <> $2
           LIMIT 1`,
          [nextEmail, adminId]
        );

        if (emailCheck.rowCount > 0) {
          return sendError(res, {
            code: 'DUPLICATE_EMAIL',
            message: 'Another admin already uses this email address.',
            statusCode: 409,
            requestId: req.requestId,
          });
        }
      }

      if (nextPassword) {
        const hashedPassword = await bcrypt.hash(nextPassword, 10);
        await pool.query(
          `UPDATE super_admins
           SET name = $1,
               email = $2,
               password = $3,
               is_blocked = $4
           WHERE id = $5`,
          [nextName, nextEmail, hashedPassword, nextBlocked, adminId]
        );
      } else {
        await pool.query(
          `UPDATE super_admins
           SET name = $1,
               email = $2,
               is_blocked = $3
           WHERE id = $4`,
          [nextName, nextEmail, nextBlocked, adminId]
        );
      }

      const existingProfile = profile.toJSON();
      const targetIsManager = isMemberManager(existingProfile, adminId);
      const permissions = access.isSuperAdmin && targetIsManager
        ? sanitizeQueuePermissions(req.body.permissions || {}, existingProfile)
        : enforceSupportUserHierarchy(
            sanitizeQueuePermissions(req.body.permissions || {}, existingProfile)
          );

      await profile.update({
        manager_admin_id: targetIsManager
          ? toInteger(existingProfile.manager_admin_id) || adminId
          : toInteger(existingProfile.manager_admin_id) || access.managerAdminId,
        team_name:
          normalizeText(req.body.team_name || req.body.teamName) || profile.team_name || access.teamName,
        ...permissions,
        default_queue:
          normalizeText(req.body.default_queue || req.body.defaultQueue).toLowerCase() || profile.default_queue,
        allowed_priorities: normalizeArray(
          req.body.allowed_priorities || req.body.allowedPriorities,
          (entry) => String(entry || '').trim().toLowerCase()
        ),
        allowed_categories: normalizeArray(
          req.body.allowed_categories || req.body.allowedCategories,
          normalizeCategory
        ),
        assignment_preferences: req.body.assignment_preferences || req.body.assignmentPreferences || profile.assignment_preferences || {},
        updated_by_admin_id: access.adminId,
        is_active: req.body.is_active !== undefined ? toBoolean(req.body.is_active) : profile.is_active,
        updated_at: new Date(),
      });

      log('info', 'Support team member updated', {
        requestId: req.requestId,
        adminId: access.adminId,
        memberAdminId: adminId,
        permissions,
      });

      const members = await getTeamMembersForResponse(pool, access);
      const updatedMember = members.find((member) => Number(member.id) === adminId) || null;

      return sendSuccess(res, {
        member: updatedMember,
      });
    } catch (error) {
      log('error', 'Failed to update support team member', {
        requestId: req.requestId,
        adminId: req.supportAccess?.adminId,
        memberAdminId: req.params.adminId,
        payload: req.body,
        error: error.message,
        stack: error.stack,
      });
      return sendError(res, {
        message: 'Failed to update the support user.',
        details: error.message,
        requestId: req.requestId,
      });
    }
  };

  const bulkAssignTickets = async (req, res) => {
    try {
      const access = req.supportAccess;
      if (!access.isManager && !access.isSuperAdmin) {
        return sendError(res, {
          code: 'FORBIDDEN',
          message: 'Only support managers can run bulk ticket assignment.',
          statusCode: 403,
          requestId: req.requestId,
        });
      }

      const strategy = normalizeText(req.body.strategy).toLowerCase() || 'round_robin';
      const assignments = await fetchAssigneeDefinitions(pool, access, req.body.assignments || []);
      const totalRequestedQuota = assignments.reduce((sum, entry) => sum + Math.max(1, entry.quota || 1), 0);

      if (assignments.length === 0) {
        return sendError(res, {
          code: 'VALIDATION_ERROR',
          message: 'At least one assignee is required for bulk assignment.',
          statusCode: 400,
          requestId: req.requestId,
        });
      }

      const scope = getEffectiveScope(req.body.scope || 'all', access);
      const filters = req.body.filters || {};
      const reassignExisting = toBoolean(req.body.reassign_existing || req.body.reassignExisting);
      const limit = Math.min(500, Math.max(1, toInteger(req.body.limit) || 100));
      const chunkSize = Math.max(1, toInteger(req.body.chunk_size || req.body.chunkSize) || 2);
      const effectiveLimit =
        strategy === 'fixed_quota'
          ? Math.min(500, Math.max(1, totalRequestedQuota))
          : limit;

      if (strategy === 'fixed_quota' && totalRequestedQuota <= 0) {
        return sendError(res, {
          code: 'VALIDATION_ERROR',
          message: 'Add at least one ticket count for the selected support users.',
          statusCode: 400,
          requestId: req.requestId,
        });
      }

      const where = buildWorkspaceWhere({
        access,
        scope,
        search: filters.search,
        status:
          Array.isArray(filters.statuses) && filters.statuses.length > 0
            ? filters.statuses
            : filters.status,
        priorities: filters.priorities || [],
        categories: filters.categories || [],
      });

      if (!reassignExisting) {
        where[Op.and] = [...(where[Op.and] || []), { assigned_to_admin_id: null }];
      }

      const tickets = await SupportQuery.findAll({
        where,
        order: [['created_at', 'ASC'], ['id', 'ASC']],
        limit: effectiveLimit,
      });

      const workingTickets = strategy === 'random' ? shuffle(tickets) : [...tickets];
      const updates = [];
      const skippedTickets = [];
      const fixedQuotaAssignments =
        strategy === 'fixed_quota'
          ? assignments.flatMap((entry) =>
              Array.from({ length: Math.max(1, entry.quota || 1) }, () => entry)
            )
          : [];

      const resolveAssigneeForTicket = (ticket, ticketIndex) => {
        if (strategy === 'fixed_quota') {
          return fixedQuotaAssignments[ticketIndex] || null;
        }

        if (strategy === 'category') {
          const normalizedCategory = normalizeCategory(ticket.category);
          return assignments.find((entry) => entry.categories.includes(normalizedCategory)) || null;
        }

        if (strategy === 'priority') {
          const normalizedPriority = normalizeText(ticket.priority).toLowerCase();
          return assignments.find((entry) => entry.priorities.includes(normalizedPriority)) || null;
        }

        if (strategy === 'balanced_chunks') {
          return assignments[Math.floor(ticketIndex / chunkSize) % assignments.length] || null;
        }

        return assignments[ticketIndex % assignments.length] || null;
      };

      for (let index = 0; index < workingTickets.length; index += 1) {
        const ticket = workingTickets[index];
        const assignee = resolveAssigneeForTicket(ticket, index);

        if (!assignee) {
          skippedTickets.push(ticket.id);
          continue;
        }

        await ticket.update({
          assigned_to_admin_id: assignee.admin_id,
          assigned_by_admin_id: access.adminId,
          team_manager_admin_id: assignee.profile?.manager_admin_id || access.managerAdminId,
          assignment_method: strategy,
          updated_at: new Date(),
          last_activity_at: new Date(),
        });

        updates.push({
          ticket_id: ticket.id,
          assigned_to_admin_id: assignee.admin_id,
          assigned_to_name: assignee.admin?.name || assignee.admin?.email || `Admin #${assignee.admin_id}`,
        });
      }

      const summary = updates.reduce((accumulator, item) => {
        const current = accumulator[item.assigned_to_admin_id] || {
          admin_id: item.assigned_to_admin_id,
          name: item.assigned_to_name,
          ticket_count: 0,
        };

        current.ticket_count += 1;
        accumulator[item.assigned_to_admin_id] = current;
        return accumulator;
      }, {});

      log('info', 'Bulk support ticket assignment completed', {
        requestId: req.requestId,
        adminId: access.adminId,
        strategy,
        requestedLimit: effectiveLimit,
        matchedTickets: tickets.length,
        updatedTickets: updates.length,
        skippedTicketIds: skippedTickets,
        distribution: Object.values(summary),
      });

      return sendSuccess(res, {
        strategy,
        matched_ticket_count: tickets.length,
        updated_ticket_count: updates.length,
        skipped_ticket_ids: skippedTickets,
        requested_ticket_count: strategy === 'fixed_quota' ? totalRequestedQuota : null,
        distribution: Object.values(summary),
        ticket_ids: updates.map((item) => item.ticket_id),
      });
    } catch (error) {
      log('error', 'Failed to bulk assign support tickets', {
        requestId: req.requestId,
        adminId: req.supportAccess?.adminId,
        payload: req.body,
        error: error.message,
        stack: error.stack,
      });
      return sendError(res, {
        message: 'Failed to run bulk ticket assignment.',
        details: error.message,
        requestId: req.requestId,
      });
    }
  };

  return {
    bulkAssignTickets,
    createTeamMember,
    getTicketById,
    getWorkspace,
    listTeamMembers,
    updateTeamMember,
    updateTicket,
  };
};
