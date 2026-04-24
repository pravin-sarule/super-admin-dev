const SupportAdminProfile = require('../../models/support_admin_profile');
const logger = require('../../config/logger');

const DEFAULT_MANAGER_PERMISSIONS = {
  is_team_manager: true,
  can_manage_team: true,
  can_view_all_tickets: true,
  can_view_assigned_to_me: true,
  can_view_team_tickets: true,
  can_view_unassigned_tickets: true,
  can_view_closed_tickets: true,
  can_view_archived_tickets: false,
  default_queue: 'all',
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

const log = (level, message, meta = {}) =>
  logger[level](message, {
    layer: 'SUPPORT_ACCESS',
    ...meta,
  });

const getHierarchyRole = ({ isSuperAdmin = false, isManager = false } = {}) => {
  if (isSuperAdmin) return 'super_admin';
  if (isManager) return 'support_admin';
  return 'support_user';
};

const normalizeProfilePermissions = (profile) => ({
  is_team_manager: toBoolean(profile?.is_team_manager),
  can_manage_team: toBoolean(profile?.can_manage_team),
  can_view_all_tickets: toBoolean(profile?.can_view_all_tickets),
  can_view_assigned_to_me: toBoolean(profile?.can_view_assigned_to_me, true),
  can_view_team_tickets: toBoolean(profile?.can_view_team_tickets),
  can_view_unassigned_tickets: toBoolean(profile?.can_view_unassigned_tickets),
  can_view_closed_tickets: toBoolean(profile?.can_view_closed_tickets),
  can_view_archived_tickets: toBoolean(profile?.can_view_archived_tickets),
});

const createDefaultManagerProfile = async (req) => {
  const payload = {
    admin_id: req.user.id,
    manager_admin_id: req.user.id,
    team_name: `${req.user.email || `support-${req.user.id}`} team`,
    ...DEFAULT_MANAGER_PERMISSIONS,
    created_by_admin_id: req.user.id,
    updated_by_admin_id: req.user.id,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const profile = await SupportAdminProfile.create(payload);
  log('info', 'Auto-provisioned support manager profile', {
    requestId: req.requestId,
    adminId: req.user.id,
    role: req.user.role,
    profileId: profile.id,
  });
  return profile;
};

const loadSupportWorkspaceContext = () => async (req, res, next) => {
  try {
    const currentRole = String(req.user?.normalizedRole || req.user?.role || '').trim().toLowerCase();

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized: User not authenticated' });
    }

    if (currentRole === 'super-admin') {
      const permissions = {
        ...DEFAULT_MANAGER_PERMISSIONS,
      };

      req.supportAccess = {
        profile: null,
        adminId: req.user.id,
        managerAdminId: req.user.id,
        teamAdminIds: [req.user.id],
        isManager: true,
        isSuperAdmin: true,
        hierarchyRole: getHierarchyRole({ isSuperAdmin: true, isManager: true }),
        defaultQueue: 'all',
        teamName: 'Support Workspace',
        permissions,
      };
      return next();
    }

    if (!['support-admin', 'admin'].includes(currentRole)) {
      return res.status(403).json({
        message: 'Access denied: This route is only available to support admins.',
        currentRole,
      });
    }

    let profile = await SupportAdminProfile.findOne({
      where: { admin_id: req.user.id },
    });

    if (!profile) {
      profile = await createDefaultManagerProfile(req);
    }

    if (!toBoolean(profile.is_active, true)) {
      log('warn', 'Blocked inactive support workspace profile access', {
        requestId: req.requestId,
        adminId: req.user.id,
        profileId: profile.id,
      });
      return res.status(403).json({
        message: 'Your support workspace profile is inactive.',
      });
    }

    const profileData = profile.toJSON();
    const permissions = normalizeProfilePermissions(profileData);
    const managerAdminId =
      permissions.is_team_manager || !profileData.manager_admin_id
        ? req.user.id
        : Number(profileData.manager_admin_id);

    const relatedProfiles = await SupportAdminProfile.findAll({
      where: {
        manager_admin_id: managerAdminId,
        is_active: true,
      },
      order: [['id', 'ASC']],
    });

    const teamAdminIds = Array.from(
      new Set([
        req.user.id,
        managerAdminId,
        ...relatedProfiles
          .map((item) => Number(item.admin_id))
          .filter((value) => Number.isInteger(value)),
      ])
    );

    req.supportAccess = {
      profile: profileData,
      adminId: req.user.id,
      managerAdminId,
      teamAdminIds,
      isManager: permissions.is_team_manager || permissions.can_manage_team,
      isSuperAdmin: false,
      hierarchyRole: getHierarchyRole({
        isManager: permissions.is_team_manager || permissions.can_manage_team,
      }),
      defaultQueue: profileData.default_queue || (permissions.can_view_all_tickets ? 'all' : 'assigned_to_me'),
      teamName: profileData.team_name || 'Support Team',
      permissions,
    };

    log('debug', 'Support workspace context loaded', {
      requestId: req.requestId,
      adminId: req.user.id,
      managerAdminId,
      teamAdminIds,
      permissions,
    });

    next();
  } catch (error) {
    log('error', 'Failed to load support workspace context', {
      requestId: req.requestId,
      adminId: req.user?.id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      message: 'Failed to load support workspace context.',
      error: error.message,
    });
  }
};

const requireSupportManager = () => (req, res, next) => {
  if (req.supportAccess?.isSuperAdmin || req.supportAccess?.isManager) {
    return next();
  }

  return res.status(403).json({
    message: 'Access denied: Support manager permission is required.',
  });
};

module.exports = {
  DEFAULT_MANAGER_PERMISSIONS,
  loadSupportWorkspaceContext,
  normalizeProfilePermissions,
  requireSupportManager,
};
