import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { supportWorkspaceApi } from '../../../services/supportWorkspaceApi';
import {
  AnalyticsPanel,
  BulkAssignPanel,
  MemberModal,
  NotificationToast,
  SectionTabs,
  TeamPanel,
  TicketDetailPanel,
  TicketListPanel,
} from './components/SupportWorkspacePanels';
import {
  CARD_CLASS_NAME,
  formatLabel,
  normalizeMember,
  normalizeTicket,
  normalizeWorkspacePayload,
} from './supportWorkspaceUtils';
import { createDebugLogger } from '../../../utils/debugLogger';

const supportWorkspaceLogger = createDebugLogger('SupportWorkspace');

const createToastState = () => ({
  isVisible: false,
  message: '',
  type: 'info',
});

const toggleArrayValue = (list = [], value) =>
  list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

const createEmptyMemberForm = (queueOptions = ['assigned_to_me'], teamName = '') => ({
  id: null,
  name: '',
  email: '',
  password: '',
  team_name: teamName,
  hierarchy_role: 'support_user',
  default_queue: queueOptions[0] || 'assigned_to_me',
  permissions: {
    can_view_all_tickets: false,
    can_view_assigned_to_me: true,
    can_view_team_tickets: false,
    can_view_unassigned_tickets: false,
    can_view_closed_tickets: false,
  },
  allowed_priorities: [],
  allowed_categories: [],
  is_blocked: false,
});

const createAssignmentForm = (viewer) => ({
  strategy: 'round_robin',
  scope:
    (viewer?.default_queue && viewer.default_queue !== 'archived'
      ? viewer.default_queue
      : viewer?.available_scopes?.find((scope) => scope !== 'archived')) || 'assigned_to_me',
  filters: {
    statuses: [],
    priorities: [],
    categories: [],
  },
  limit: 100,
  chunk_size: 2,
  reassign_existing: false,
  assignments: [{ admin_id: '', priorities: [], categories: [], quota: 1 }],
});

const createDetailForm = (ticket) => ({
  status: ticket?.status || 'open',
  priority: ticket?.priority || 'medium',
  category: ticket?.category || 'general',
  assigned_to_admin_id:
    ticket?.assigned_to_admin_id != null ? String(ticket.assigned_to_admin_id) : '',
  admin_message: '',
  internal_note: '',
});

const SupportWorkspace = () => {
  const navigate = useNavigate();
  const { queryId, managerId } = useParams();

  const [section, setSection] = useState('analytics');
  const [workspace, setWorkspace] = useState({
    viewer: { available_scopes: [] },
    summary: {},
    options: { priorities: [], categories: [], statuses: [] },
    team: { members: [] },
    analytics: { overview: {} },
    tickets: [],
    pagination: {},
    filters: {},
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [filters, setFilters] = useState({
    scope: 'assigned_to_me',
    search: '',
    status: 'all',
    priority: 'all',
    category: 'all',
    page: 1,
    pageSize: 25,
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailForm, setDetailForm] = useState(createDetailForm(null));
  const [memberModal, setMemberModal] = useState({ open: false, mode: 'create' });
  const [memberForm, setMemberForm] = useState(createEmptyMemberForm([], ''));
  const [memberSaving, setMemberSaving] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState(createAssignmentForm(null));
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [toast, setToast] = useState(createToastState());
  const shouldShowManagerAnalytics = Boolean(managerId) && !queryId;

  const showToast = (message, type = 'info') => {
    setToast({
      isVisible: true,
      message,
      type,
    });
  };

  useEffect(() => {
    if (!toast.isVisible) return undefined;
    const timer = window.setTimeout(() => setToast(createToastState()), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    if (shouldShowManagerAnalytics && section !== 'analytics') {
      setSection('analytics');
    }
  }, [shouldShowManagerAnalytics, section]);

  const priorityMap = useMemo(
    () =>
      (workspace.options.priorities || []).reduce((accumulator, option) => {
        accumulator[option.value] = option;
        return accumulator;
      }, {}),
    [workspace.options.priorities]
  );

  const queueOptions =
    (workspace.viewer.available_scopes || ['assigned_to_me']).filter((scope) => scope !== 'archived');
  const teamDirectoryMembers = useMemo(() => {
    if (workspace.viewer.hierarchy_role === 'support_admin') {
      return teamMembers.filter((member) => member.hierarchy_role === 'support_user');
    }

    if (workspace.viewer.hierarchy_role === 'support_user') {
      return teamMembers.filter(
        (member) =>
          member.hierarchy_role === 'support_user' &&
          member.manager_admin_id === workspace.viewer.manager_admin_id
      );
    }

    return teamMembers;
  }, [teamMembers, workspace.viewer.hierarchy_role, workspace.viewer.manager_admin_id]);

  const loadWorkspace = async () => {
    setWorkspaceLoading(true);
    try {
      const response = await supportWorkspaceApi.fetchWorkspace({
        scope: filters.scope,
        search: debouncedSearch,
        status: filters.status !== 'all' ? filters.status : '',
        priority: filters.priority !== 'all' ? filters.priority : '',
        category: filters.category !== 'all' ? filters.category : '',
        page: filters.page,
        pageSize: filters.pageSize,
      });

      const normalized = normalizeWorkspacePayload(response);
      setWorkspace(normalized);
      setTeamMembers(normalized.team.members);
      setAssignmentForm((previous) => ({
        ...previous,
        scope:
          (normalized.viewer.default_queue && normalized.viewer.default_queue !== 'archived'
            ? normalized.viewer.default_queue
            : normalized.viewer.available_scopes?.find((scope) => scope !== 'archived')) || previous.scope,
      }));

      const nextScope =
        normalized.filters.scope === 'archived' ? 'closed' : normalized.filters.scope;

      if (filters.scope !== nextScope) {
        setFilters((previous) => ({
          ...previous,
          scope: nextScope,
        }));
      }

      supportWorkspaceLogger.flow('workspace:state', {
        summary: {
          scope: nextScope,
          ticketCount: normalized.tickets.length,
          memberCount: normalized.team.members.length,
        },
        output: {
          summary: normalized.summary,
          analytics: normalized.analytics?.overview || {},
        },
      });
    } catch (error) {
      supportWorkspaceLogger.error('workspace:load:failed', error, {
        summary: {
          scope: filters.scope,
        },
      });
      showToast(
        error.payload?.error?.message || error.payload?.message || 'Failed to load the support workspace.',
        'error'
      );
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    setTeamLoading(true);
    try {
      const response = await supportWorkspaceApi.fetchTeamMembers();
      const members = Array.isArray(response?.data?.members)
        ? response.data.members.map(normalizeMember)
        : [];
      setTeamMembers(members);
      supportWorkspaceLogger.flow('team:loaded', {
        summary: {
          memberCount: members.length,
        },
        table: members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          hierarchy_role: member.hierarchy_role,
          status: member.is_blocked ? 'Blocked' : 'Active',
        })),
      });
      setWorkspace((previous) => ({
        ...previous,
        team: { members },
      }));
    } catch (error) {
      supportWorkspaceLogger.error('team:load:failed', error);
      showToast(
        error.payload?.error?.message || error.payload?.message || 'Failed to refresh support team members.',
        'error'
      );
    } finally {
      setTeamLoading(false);
    }
  };

  const loadTicket = async (ticketId) => {
    if (!ticketId) {
      setSelectedTicket(null);
      setDetailForm(createDetailForm(null));
      return;
    }

    setTicketLoading(true);
    try {
      const response = await supportWorkspaceApi.fetchTicket(ticketId);
      const ticket = normalizeTicket(response?.data || {});
      setSelectedTicket(ticket);
      setDetailForm(createDetailForm(ticket));
      setSection('tickets');
      supportWorkspaceLogger.flow('ticket:loaded', {
        summary: {
          ticketId,
          status: ticket.status,
          priority: ticket.priority,
        },
        output: ticket,
      });
    } catch (error) {
      supportWorkspaceLogger.error('ticket:load:failed', error, {
        summary: {
          ticketId,
        },
      });
      showToast(
        error.payload?.error?.message || error.payload?.message || 'Failed to load the ticket details.',
        'error'
      );
      navigate('/dashboard/support');
    } finally {
      setTicketLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [
    filters.scope,
    filters.status,
    filters.priority,
    filters.category,
    filters.page,
    filters.pageSize,
    debouncedSearch,
    reloadToken,
  ]);

  useEffect(() => {
    void loadTicket(queryId);
  }, [queryId]);

  useEffect(() => {
    if (workspace.viewer?.available_scopes?.length > 0) {
      setMemberForm((previous) =>
        previous.default_queue
          ? previous
          : {
              ...previous,
              default_queue:
                workspace.viewer.available_scopes.find((scope) => scope !== 'archived') || 'assigned_to_me',
            }
      );
      setAssignmentForm((previous) =>
        previous.scope
          ? previous
          : {
              ...previous,
              scope:
                workspace.viewer.available_scopes.find((scope) => scope !== 'archived') || 'assigned_to_me',
            }
      );
    }
  }, [workspace.viewer]);

  const refreshAll = async () => {
    setReloadToken((previous) => previous + 1);
    if (queryId) {
      await loadTicket(queryId);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((previous) => ({
      ...previous,
      [field]: value,
      ...(field !== 'page' ? { page: 1 } : {}),
    }));
  };

  const handleOpenTicket = (ticketId) => {
    navigate(`/dashboard/support/${ticketId}`);
  };

  const handleBackToTickets = () => {
    navigate('/dashboard/support');
  };

  const handleDetailChange = (field, value) => {
    setDetailForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSaveTicket = async () => {
    if (!selectedTicket) return;

    setTicketSaving(true);
    try {
      const payload = {
        status: detailForm.status,
        priority: detailForm.priority,
        category: detailForm.category,
        admin_message: detailForm.admin_message,
        internal_note: detailForm.internal_note,
      };

      if (workspace.viewer.is_manager || workspace.viewer.is_super_admin) {
        payload.assigned_to_admin_id =
          detailForm.assigned_to_admin_id === '' ? null : Number(detailForm.assigned_to_admin_id);
      }

      const response = await supportWorkspaceApi.updateTicket(selectedTicket.id, payload);
      const updatedTicket = normalizeTicket(response?.data || {});
      setSelectedTicket(updatedTicket);
      setDetailForm(createDetailForm(updatedTicket));
      showToast('Support ticket updated successfully.', 'success');
      await refreshAll();
    } catch (error) {
      showToast(
        error.payload?.error?.message || error.payload?.message || 'Failed to update the ticket.',
        'error'
      );
    } finally {
      setTicketSaving(false);
    }
  };

  const openMemberModal = (mode, member = null) => {
    const hierarchyRole = member?.hierarchy_role || 'support_user';
    const baseForm = member
      ? {
          id: member.id,
          name: member.name || '',
          email: member.email || '',
          password: '',
          team_name: member.team_name || '',
          hierarchy_role: hierarchyRole,
          default_queue:
            member.default_queue && member.default_queue !== 'archived'
              ? member.default_queue
              : hierarchyRole === 'support_admin'
                ? 'all'
                : queueOptions[0] || 'assigned_to_me',
          permissions: {
            can_view_all_tickets: Boolean(member.permissions?.can_view_all_tickets),
            can_view_assigned_to_me: Boolean(member.permissions?.can_view_assigned_to_me),
            can_view_team_tickets: Boolean(member.permissions?.can_view_team_tickets),
            can_view_unassigned_tickets: Boolean(member.permissions?.can_view_unassigned_tickets),
            can_view_closed_tickets: Boolean(member.permissions?.can_view_closed_tickets),
          },
          allowed_priorities: member.allowed_priorities || [],
          allowed_categories: member.allowed_categories || [],
          is_blocked: Boolean(member.is_blocked),
        }
      : createEmptyMemberForm(queueOptions, workspace.viewer.team_name || '');

    setMemberForm(baseForm);
    setMemberModal({ open: true, mode });
  };

  const closeMemberModal = () => {
    setMemberModal({ open: false, mode: 'create' });
    setMemberForm(createEmptyMemberForm(queueOptions, workspace.viewer.team_name || ''));
  };

  const handleMemberFormChange = (field, value) => {
    setMemberForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const toggleMemberPermission = (key) => {
    setMemberForm((previous) => ({
      ...previous,
      permissions: {
        ...previous.permissions,
        [key]: !previous.permissions[key],
      },
    }));
  };

  const toggleMemberPriority = (value) => {
    setMemberForm((previous) => ({
      ...previous,
      allowed_priorities: toggleArrayValue(previous.allowed_priorities, value),
    }));
  };

  const toggleMemberCategory = (value) => {
    setMemberForm((previous) => ({
      ...previous,
      allowed_categories: toggleArrayValue(previous.allowed_categories, value),
    }));
  };

  const handleSaveMember = async () => {
    setMemberSaving(true);
    try {
      const payload = {
        name: memberForm.name,
        email: memberForm.email,
        password: memberForm.password,
        team_name: memberForm.team_name,
        default_queue: memberForm.default_queue,
        permissions: memberForm.permissions,
        allowed_priorities: memberForm.allowed_priorities,
        allowed_categories: memberForm.allowed_categories,
        is_blocked: memberForm.is_blocked,
      };

      if (memberModal.mode === 'create') {
        await supportWorkspaceApi.createTeamMember(payload);
        showToast('Support user created successfully.', 'success');
      } else {
        await supportWorkspaceApi.updateTeamMember(memberForm.id, payload);
        showToast('Support user updated successfully.', 'success');
      }

      closeMemberModal();
      await Promise.all([loadTeamMembers(), refreshAll()]);
    } catch (error) {
      showToast(
        error.payload?.error?.message || error.payload?.message || 'Failed to save the support user.',
        'error'
      );
    } finally {
      setMemberSaving(false);
    }
  };

  const handleAssignmentFormChange = (field, value) => {
    setAssignmentForm((previous) => {
      if (
        field === 'filters.priorities' ||
        field === 'filters.categories' ||
        field === 'filters.statuses'
      ) {
        const filterKey = field.split('.')[1];
        return {
          ...previous,
          filters: {
            ...previous.filters,
            [filterKey]: toggleArrayValue(previous.filters[filterKey], value),
          },
        };
      }

      if (field.startsWith('filters.')) {
        const filterKey = field.split('.')[1];
        return {
          ...previous,
          filters: {
            ...previous.filters,
            [filterKey]: value,
          },
        };
      }

      return {
        ...previous,
        [field]: value,
      };
    });
  };

  const handleAssignmentRowChange = (index, field, value) => {
    setAssignmentForm((previous) => ({
      ...previous,
      assignments: previous.assignments.map((assignment, assignmentIndex) =>
        assignmentIndex === index
          ? {
              ...assignment,
              [field]: value,
            }
          : assignment
      ),
    }));
  };

  const toggleAssignmentPriority = (index, value) => {
    setAssignmentForm((previous) => ({
      ...previous,
      assignments: previous.assignments.map((assignment, assignmentIndex) =>
        assignmentIndex === index
          ? {
              ...assignment,
              priorities: toggleArrayValue(assignment.priorities || [], value),
            }
          : assignment
      ),
    }));
  };

  const toggleAssignmentCategory = (index, value) => {
    setAssignmentForm((previous) => ({
      ...previous,
      assignments: previous.assignments.map((assignment, assignmentIndex) =>
        assignmentIndex === index
          ? {
              ...assignment,
              categories: toggleArrayValue(assignment.categories || [], value),
            }
          : assignment
      ),
    }));
  };

  const addAssignmentRow = () => {
    setAssignmentForm((previous) => ({
      ...previous,
      assignments: [...previous.assignments, { admin_id: '', priorities: [], categories: [], quota: 1 }],
    }));
  };

  const removeAssignmentRow = (index) => {
    setAssignmentForm((previous) => ({
      ...previous,
      assignments:
        previous.assignments.length > 1
          ? previous.assignments.filter((_, assignmentIndex) => assignmentIndex !== index)
          : previous.assignments,
    }));
  };

  const handleRunAssignment = async () => {
    setAssignmentLoading(true);
    try {
      const payload = {
        strategy: assignmentForm.strategy,
        scope: assignmentForm.scope,
        limit: Number(assignmentForm.limit),
        chunk_size: Number(assignmentForm.chunk_size),
        reassign_existing: Boolean(assignmentForm.reassign_existing),
        filters: assignmentForm.filters,
        assignments: assignmentForm.assignments
          .filter((assignment) => assignment.admin_id)
          .map((assignment) => ({
            admin_id: Number(assignment.admin_id),
            priorities: assignment.priorities,
            categories: assignment.categories,
            quota: Number(assignment.quota || 1),
          })),
      };

      await supportWorkspaceApi.bulkAssignTickets(payload);
      showToast('Bulk assignment completed successfully.', 'success');
      await Promise.all([loadTeamMembers(), refreshAll()]);
    } catch (error) {
      showToast(
        error.payload?.error?.message || error.payload?.message || 'Failed to run bulk assignment.',
        'error'
      );
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleAttachmentOpen = async (ticketId, attachmentIndex) => {
    try {
      const preview = await supportWorkspaceApi.getAttachmentPreview(ticketId, attachmentIndex);
      const objectUrl = URL.createObjectURL(preview.blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      showToast(
        error.payload?.message || 'The attachment preview could not be loaded.',
        'error'
      );
    }
  };

  const shouldShowTicketDetail = Boolean(queryId);
  const handleSectionChange = (nextSection) => {
    if (shouldShowManagerAnalytics && nextSection !== 'analytics') {
      navigate('/dashboard/support');
    }

    setSection(nextSection);
  };

  const handleOpenManagerAnalytics = (selectedManagerId) => {
    navigate(`/dashboard/support/admin/${selectedManagerId}`);
  };

  const handleBackToAnalyticsList = () => {
    navigate('/dashboard/support');
  };

  return (
    <>
      <NotificationToast toast={toast} onClose={() => setToast(createToastState())} />

      <MemberModal
        open={memberModal.open}
        mode={memberModal.mode}
        form={memberForm}
        loading={memberSaving}
        queueOptions={queueOptions}
        priorityOptions={workspace.options.priorities || []}
        categoryOptions={workspace.options.categories || []}
        onClose={closeMemberModal}
        onChange={handleMemberFormChange}
        onTogglePermission={toggleMemberPermission}
        onTogglePriority={toggleMemberPriority}
        onToggleCategory={toggleMemberCategory}
        onSubmit={handleSaveMember}
      />

      <div className="space-y-6">
        <div className={`${CARD_CLASS_NAME} flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Support Dashboard</p>
            <h1 className="mt-2 text-[1.75rem] font-semibold tracking-tight text-slate-950">
              {workspace.viewer.team_name || 'Support Workspace'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Role: {formatLabel(workspace.viewer.hierarchy_role || 'support_user')}
            </p>
          </div>

          <SectionTabs
            section={section}
            onChange={handleSectionChange}
            canManageTeam={workspace.viewer.can_manage_assignments}
          />
        </div>

        {shouldShowTicketDetail ? (
          ticketLoading && !selectedTicket ? (
            <section className={`${CARD_CLASS_NAME} px-6 py-20 text-center`}>
              <div className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Loading ticket details...
              </div>
            </section>
          ) : (
            <TicketDetailPanel
              ticket={selectedTicket}
              loading={ticketSaving}
              teamMembers={teamMembers}
              options={workspace.options}
              detailForm={detailForm}
              onDetailChange={handleDetailChange}
              onBack={handleBackToTickets}
              onSave={handleSaveTicket}
              onAttachmentOpen={handleAttachmentOpen}
              viewer={workspace.viewer}
              priorityMap={priorityMap}
            />
          )
        ) : null}

        {!shouldShowTicketDetail && section === 'analytics' ? (
          <AnalyticsPanel
            viewer={workspace.viewer}
            analytics={workspace.analytics}
            members={teamMembers}
            selectedManagerId={managerId}
            onOpenManagerDashboard={handleOpenManagerAnalytics}
            onBackToManagerList={handleBackToAnalyticsList}
          />
        ) : null}

        {!shouldShowTicketDetail && section === 'tickets' ? (
          <TicketListPanel
            viewer={workspace.viewer}
            summary={workspace.summary}
            tickets={workspace.tickets}
            loading={workspaceLoading}
            filters={filters}
            options={workspace.options}
            priorityMap={priorityMap}
            onScopeChange={(scope) => handleFilterChange('scope', scope)}
            onFilterChange={handleFilterChange}
            onOpenTicket={handleOpenTicket}
            onRefresh={refreshAll}
          />
        ) : null}

        {!shouldShowTicketDetail && section === 'team' ? (
          <TeamPanel
            members={teamDirectoryMembers}
            loading={teamLoading || workspaceLoading}
            viewer={workspace.viewer}
            onCreate={() => openMemberModal('create')}
            onEdit={(member) => openMemberModal('edit', member)}
          />
        ) : null}

        {!shouldShowTicketDetail && section === 'assignments' ? (
          <BulkAssignPanel
            viewer={workspace.viewer}
            members={teamMembers}
            options={workspace.options}
            form={assignmentForm}
            loading={assignmentLoading}
            onChange={handleAssignmentFormChange}
            onAssignmentChange={handleAssignmentRowChange}
            onToggleAssignmentPriority={toggleAssignmentPriority}
            onToggleAssignmentCategory={toggleAssignmentCategory}
            onAddAssignment={addAssignmentRow}
            onRemoveAssignment={removeAssignmentRow}
            onSubmit={handleRunAssignment}
          />
        ) : null}
      </div>
    </>
  );
};

export default SupportWorkspace;
