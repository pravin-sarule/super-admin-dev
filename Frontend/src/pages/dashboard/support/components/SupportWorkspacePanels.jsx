import React from 'react';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CircleHelp,
  Eye,
  Filter,
  Hash,
  LoaderCircle,
  Mail,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  SendHorizontal,
  Settings2,
  Shield,
  Shuffle,
  Ticket,
  TrendingUp,
  UserCog,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import {
  CARD_CLASS_NAME,
  defaultPriorityBadgeStyles,
  formatDate,
  formatLabel,
  statusBadgeStyles,
} from '../supportWorkspaceUtils';

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

const modalBackdropClassName =
  'fixed inset-0 z-50 overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-sm';

const queueLabels = {
  all: 'All Tickets',
  assigned_to_me: 'Assigned To Me',
  my_team: 'My Team',
  unassigned: 'Unassigned',
  closed: 'Closed',
};

const queuePermissionMeta = {
  can_view_all_tickets: {
    chipLabel: 'Full queue',
    label: 'See all tickets in my queue',
    description: 'Use this when the support user should be able to open every ticket that belongs to your queue.',
  },
  can_view_assigned_to_me: {
    chipLabel: 'Assigned to them',
    label: 'See tickets assigned to this user',
    description: 'Good for focused agents who should only work on tickets that you assign to them.',
  },
  can_view_team_tickets: {
    chipLabel: 'Teammate tickets',
    label: 'See teammate tickets',
    description: 'Lets the user view tickets already assigned to other support users in the same team.',
  },
  can_view_unassigned_tickets: {
    chipLabel: 'Unassigned tickets',
    label: 'See unassigned tickets',
    description: 'Lets the user help with tickets that are still waiting for assignment in your queue.',
  },
  can_view_closed_tickets: {
    chipLabel: 'Closed tickets',
    label: 'See closed tickets',
    description: 'Useful when the user needs to review finished tickets or follow previous work.',
  },
};

const assignmentStrategyHelp = {
  fixed_quota: {
    summary: 'You choose the exact number of tickets for each support user.',
    details: 'Use this when you already know the split and want full control over how many tickets each person gets.',
    example: 'Example: 5 tickets to User A, 8 tickets to User B, and 2 tickets to User C.',
  },
  round_robin: {
    summary: 'Tickets are shared one by one in turn.',
    details: 'This gives a simple and fair split when everyone should receive tickets evenly.',
    example: 'Example: Ticket 1 goes to User A, ticket 2 to User B, ticket 3 to User C, then it repeats.',
  },
  balanced_chunks: {
    summary: 'Tickets are shared in small batches.',
    details: 'Use this when you want a balanced split, but prefer giving a few tickets at a time to each support user.',
    example: 'Example: With chunk size 3, User A gets 3 tickets, then User B gets 3, then User C gets 3.',
  },
  random: {
    summary: 'Tickets are shuffled first, then assigned automatically.',
    details: 'Use this when ticket order does not matter and you want the split to be mixed.',
    example: 'Example: The system randomizes the list, then distributes those tickets across the selected support users.',
  },
  category: {
    summary: 'Tickets are assigned by category ownership.',
    details: 'Use this when certain support users should receive only certain categories.',
    example: 'Example: Billing tickets go to one user and Technical tickets go to another.',
  },
  priority: {
    summary: 'Tickets are assigned by priority ownership.',
    details: 'Use this when urgent or high-priority tickets should go to specific support users.',
    example: 'Example: Urgent tickets go to a senior support user, while low priority tickets go to others.',
  },
};

const getHierarchyLabel = (value) =>
  ({
    super_admin: 'Super Admin',
    support_admin: 'Support Admin',
    support_user: 'Support User',
  }[value] || formatLabel(value));

export const NotificationToast = ({ toast, onClose }) => {
  if (!toast?.isVisible) return null;

  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  }[toast.type || 'info'];

  return (
    <div className="fixed right-4 top-4 z-[80]">
      <div className={`flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${styles}`}>
        <div className="mt-0.5">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="flex-1 text-sm font-medium">{toast.message}</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-current transition hover:bg-white/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex min-w-24 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${
      statusBadgeStyles[status] || 'border-slate-200 bg-slate-100 text-slate-600'
    }`}
  >
    {formatLabel(status)}
  </span>
);

export const PriorityBadge = ({ priority, priorityMap = {} }) => {
  const option = priorityMap[priority];
  const colorClass =
    option?.color || defaultPriorityBadgeStyles[priority] || 'border-slate-200 bg-slate-100 text-slate-600';

  return (
    <span className={`inline-flex min-w-24 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${colorClass}`}>
      {option?.label || formatLabel(priority)}
    </span>
  );
};

const SummaryCard = ({ icon: Icon, label, value, accent }) => (
  <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
      </div>
      <div className={`rounded-2xl p-3 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const toMetricValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getBarWidth = (value, maxValue) => {
  if (maxValue <= 0 || value <= 0) return '0%';
  return `${Math.max((value / maxValue) * 100, 8)}%`;
};

const getBarHeight = (value, maxValue) => {
  if (maxValue <= 0 || value <= 0) return '0%';
  return `${Math.max((value / maxValue) * 100, 12)}%`;
};

const DetailMetricCard = ({ label, value, helper, accent = 'bg-slate-100 text-slate-700' }) => (
  <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
        {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
      </div>
      <span className={`rounded-2xl px-3 py-1 text-xs font-semibold ${accent}`}>{value}</span>
    </div>
  </div>
);

const HorizontalBarChart = ({ title, description, data = [] }) => {
  const normalizedData = data
    .map((item) => ({
      ...item,
      value: toMetricValue(item.value),
    }))
    .filter((item) => item.label);
  const maxValue = Math.max(...normalizedData.map((item) => item.value), 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BarChart3 className="h-4 w-4 text-blue-600" />
        {title}
      </div>
      {description ? <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p> : null}

      <div className="mt-5 space-y-4">
        {normalizedData.length > 0 ? (
          normalizedData.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="font-semibold text-slate-950">{item.value}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${item.color || 'bg-blue-500'}`}
                  style={{ width: getBarWidth(item.value, maxValue) }}
                />
              </div>
              {item.helper ? <p className="text-xs leading-5 text-slate-500">{item.helper}</p> : null}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
            No chart data is available yet.
          </div>
        )}
      </div>
    </div>
  );
};
const VerticalBarChart = ({ title, description, data = [] }) => {
  const normalizedData = data
    .map((item) => ({
      ...item,
      value: toMetricValue(item.value),
    }))
    .filter((item) => item.label);
  const maxValue = Math.max(...normalizedData.map((item) => item.value), 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <TrendingUp className="h-4 w-4 text-violet-600" />
        {title}
      </div>
      {description ? <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p> : null}

      {normalizedData.length > 0 ? (
        <>
          <div className="mt-5 rounded-[26px] border border-slate-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 px-4 py-5">
            <div className="flex h-64 items-end gap-3">
              {normalizedData.map((item) => (
                <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-3">
                  <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                  <div className="flex h-48 w-full items-end justify-center rounded-2xl bg-white/70 px-2 py-2">
                    <div
                      className={`w-full max-w-16 rounded-t-2xl transition-all duration-500 ${item.color || 'bg-violet-500'}`}
                      style={{ height: getBarHeight(item.value, maxValue) }}
                    />
                  </div>
                  <span className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
          No performance shape is available yet.
        </div>
      )}
    </div>
  );
};

const SupportAdminDetailDashboard = ({ manager, members = [], onBack }) => {
  if (!manager) return null;

  const pool = {
    total_tickets: toMetricValue(manager.pool_metrics?.total_tickets),
    open_tickets: toMetricValue(manager.pool_metrics?.open_tickets),
    closed_tickets: toMetricValue(manager.pool_metrics?.closed_tickets),
    unassigned_tickets: toMetricValue(manager.pool_metrics?.unassigned_tickets),
    assigned_to_manager_tickets: toMetricValue(manager.pool_metrics?.assigned_to_manager_tickets),
    delegated_to_team_tickets: toMetricValue(manager.pool_metrics?.delegated_to_team_tickets),
  };

  const directoryEntry = members.find((member) => Number(member.id) === Number(manager.manager_admin_id)) || null;
  const teamName = directoryEntry?.team_name || 'Support Team';
  const personalWorkload = {
    total_assigned: toMetricValue(manager.workload?.total_assigned),
    open_assigned: toMetricValue(manager.workload?.open_assigned),
    closed_assigned: toMetricValue(manager.workload?.closed_assigned),
    closed_by_admin_total: toMetricValue(manager.workload?.closed_by_admin_total),
    closed_today_by_admin: toMetricValue(manager.workload?.closed_today_by_admin),
  };
  const reports = (manager.reports || [])
    .map((report) => {
      const workload = {
        total_assigned: toMetricValue(report.workload?.total_assigned),
        open_assigned: toMetricValue(report.workload?.open_assigned),
        closed_assigned: toMetricValue(report.workload?.closed_assigned),
        closed_by_admin_total: toMetricValue(report.workload?.closed_by_admin_total),
        closed_today_by_admin: toMetricValue(report.workload?.closed_today_by_admin),
      };

      return {
        ...report,
        workload,
        remaining_tickets: workload.open_assigned,
        solved_tickets: workload.closed_today_by_admin,
        solved_overall_tickets: workload.closed_by_admin_total,
      };
    })
    .sort((left, right) => right.workload.total_assigned - left.workload.total_assigned);

  const solvedTickets = personalWorkload.closed_today_by_admin;
  const remainingTickets = personalWorkload.open_assigned;
  const totalPersonallySolvedTickets = personalWorkload.closed_by_admin_total;
  const teamSolvedTickets = pool.closed_tickets;
  const teamRemainingTickets = pool.open_tickets;
  const delegatedTickets = pool.delegated_to_team_tickets;
  const ticketsAssignedByAdmin = toMetricValue(manager.assigned_ticket_count);
  const supportUsersCreated = toMetricValue(manager.support_user_count);
  const activeSupportUsers = toMetricValue(manager.active_support_user_count);

  const personalBreakdown = [
    {
      label: 'Solved Today By Support Admin',
      value: solvedTickets,
      color: 'bg-emerald-500',
      helper: 'Tickets this support admin closed today. This is the live daily solved count.',
    },
    {
      label: 'Still Active With Admin',
      value: remainingTickets,
      color: 'bg-amber-500',
      helper: 'Tickets still directly assigned to this support admin and not closed yet.',
    },
    {
      label: 'Waiting Assignment',
      value: pool.unassigned_tickets,
      color: 'bg-blue-500',
      helper: 'Tickets that still need an owner in this queue.',
    },
    {
      label: 'Delegated To Users',
      value: delegatedTickets,
      color: 'bg-violet-500',
      helper: 'Tickets currently assigned to support users created by this support admin.',
    },
    {
      label: 'Queue Closed Overall',
      value: teamSolvedTickets,
      color: 'bg-slate-500',
      helper: 'All closed tickets in this support admin queue across the full team.',
    },
  ];

  const teamQueueBreakdown = [
    {
      label: 'Team Solved',
      value: teamSolvedTickets,
      color: 'bg-emerald-500',
      helper: 'All closed tickets in this support admin queue, including support users.',
    },
    {
      label: 'Team Active',
      value: teamRemainingTickets,
      color: 'bg-amber-500',
      helper: 'All active tickets still left in this support admin queue.',
    },
    {
      label: 'Waiting Assignment',
      value: pool.unassigned_tickets,
      color: 'bg-blue-500',
      helper: 'Tickets inside this queue that still do not have an owner.',
    },
    {
      label: 'Delegated To Users',
      value: delegatedTickets,
      color: 'bg-violet-500',
      helper: 'Tickets currently sitting with support users created by this support admin.',
    },
  ];

  const supportUserLoad = reports.map((report) => ({
    label: report.name,
    value: report.workload.total_assigned,
    color: 'bg-blue-500',
    helper: `${report.solved_tickets} solved, ${report.remaining_tickets} still active`,
  }));

  const solvedPerformanceData =
    reports.length > 0
      ? reports.map((report) => ({
          label: report.name,
          value: report.solved_tickets,
          color: 'bg-violet-500',
          helper: `${report.solved_overall_tickets} total solved overall, ${report.remaining_tickets} still active now.`,
        }))
      : [
          {
            label: 'Solved Today',
            value: solvedTickets,
            color: 'bg-emerald-500',
            helper: 'Tickets this support admin closed today.',
          },
          {
            label: 'Active With Admin',
            value: remainingTickets,
            color: 'bg-amber-500',
            helper: 'Tickets still active and directly assigned to this support admin.',
          },
          {
            label: 'Unassigned',
            value: pool.unassigned_tickets,
            color: 'bg-blue-500',
            helper: 'Tickets still waiting for an owner.',
          },
          {
            label: 'Queue Closed Overall',
            value: teamSolvedTickets,
            color: 'bg-slate-500',
            helper: 'All closed tickets across this support admin queue.',
          },
        ];

  return (
    <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
      <div className="space-y-6 px-6 py-6 lg:px-7">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Support Admin Analytics
        </button>
      ) : null}

      <div className="space-y-6 rounded-[26px] border border-slate-200 bg-slate-50/60 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Support Admin Dashboard</p>
          <h3 className="mt-2 text-[1.9rem] font-semibold tracking-tight text-slate-950">
            {manager.manager_name}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Real workload view for this support admin. Today's personal solved count is separated from the full team queue totals so the analytics stay accurate.
          </p>
        </div>

        <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Email</p>
            <p className="mt-2 font-semibold text-slate-900">{manager.manager_email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Team / Group</p>
            <p className="mt-2 font-semibold text-slate-900">{teamName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tickets Assigned By Admin</p>
            <p className="mt-2 font-semibold text-slate-900">{ticketsAssignedByAdmin}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Support Users Created</p>
            <p className="mt-2 font-semibold text-slate-900">{supportUsersCreated}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Solved Today By Admin</p>
            <p className="mt-2 font-semibold text-slate-900">{solvedTickets}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Queue Closed Overall</p>
            <p className="mt-2 font-semibold text-slate-900">{teamSolvedTickets}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DetailMetricCard
          label="Solved Today By Support Admin"
          value={solvedTickets}
          helper="Tickets this support admin closed today. This is the live personal solved count."
          accent="bg-emerald-50 text-emerald-700"
        />
        <DetailMetricCard
          label="Active With Support Admin"
          value={remainingTickets}
          helper="Active tickets still directly assigned to this support admin and not closed yet."
          accent="bg-amber-50 text-amber-700"
        />
        <DetailMetricCard
          label="Waiting For Assignment"
          value={pool.unassigned_tickets}
          helper="Tickets that are inside this queue but still do not have an owner."
          accent="bg-blue-50 text-blue-700"
        />
        <DetailMetricCard
          label="Delegated To Support Users"
          value={delegatedTickets}
          helper="Tickets currently assigned to support users created by this support admin."
          accent="bg-violet-50 text-violet-700"
        />
        <DetailMetricCard
          label="Personal Solved Overall"
          value={totalPersonallySolvedTickets}
          helper="All tickets this support admin has personally closed overall in the tracked data."
          accent="bg-slate-100 text-slate-700"
        />
        <DetailMetricCard
          label="Active Support Users"
          value={activeSupportUsers}
          helper="Support users created by this admin who are currently active."
          accent="bg-cyan-50 text-cyan-700"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <HorizontalBarChart
          title="Support Admin Personal Breakdown"
          description="This chart shows the real personal workload of this support admin, separate from the broader team queue."
          data={personalBreakdown}
        />

        <VerticalBarChart
          title={reports.length > 0 ? 'Solved Today By Support User' : 'Solved Ticket Snapshot'}
          description={
            reports.length > 0
              ? 'This dynamic chart changes for each support admin and shows how many tickets each support user closed today.'
              : 'This dynamic chart shows today\'s real solved workload for this support admin alongside the queue totals around it.'
          }
          data={solvedPerformanceData}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <HorizontalBarChart
          title="Team Queue Snapshot"
          description="This chart shows the full support-admin queue totals, separate from the support admin's own personal workload."
          data={teamQueueBreakdown}
        />

        <HorizontalBarChart
          title="Support User Load"
          description="See how many tickets each support user created by this support admin is carrying right now."
          data={supportUserLoad}
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users className="h-4 w-4 text-blue-600" />
            Support User Detail
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Detailed breakdown of every support user created by this support admin, including solved-today and remaining tickets.
          </p>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-slate-50/90">
                  <tr className="text-left">
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Support User</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assigned</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Solved Today</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {reports.length > 0 ? (
                    reports.map((report) => (
                      <tr key={report.id} className="transition hover:bg-slate-50/80">
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">{report.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{report.email}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              report.is_blocked ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {report.is_blocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-sm font-semibold text-slate-900">
                          {report.workload.total_assigned}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          {report.solved_tickets}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          {report.remaining_tickets}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-16 text-center text-sm text-slate-500">
                        This support admin has not created any support users yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </div>
      </div>
      </div>
    </section>
  );
};

export const SectionTabs = ({ section, onChange, canManageTeam }) => {
  const tabs = [
    { value: 'analytics', label: 'Analytics', icon: Shield },
    { value: 'tickets', label: 'Tickets', icon: CircleHelp },
    { value: 'team', label: 'Team Members', icon: Users },
    ...(canManageTeam ? [{ value: 'assignments', label: 'Assignment Center', icon: Shuffle }] : []),
  ];

  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = section === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export const TicketListPanel = ({
  viewer,
  summary,
  tickets,
  loading,
  filters,
  options,
  priorityMap,
  onScopeChange,
  onFilterChange,
  onOpenTicket,
  onRefresh,
}) => {
  const scopes = (viewer?.available_scopes || []).filter((scope) => scope !== 'archived');
  const summaryCards = [
    {
      key: 'visible',
      icon: Ticket,
      label: 'Visible Tickets',
      value: summary?.[filters.scope] ?? 0,
      accent: 'bg-blue-50 text-blue-700',
    },
    ...(scopes.includes('assigned_to_me')
      ? [
          {
            key: 'assigned_to_me',
            icon: UserRound,
            label: 'Assigned To Me',
            value: summary?.assigned_to_me ?? 0,
            accent: 'bg-emerald-50 text-emerald-700',
          },
        ]
      : []),
    ...(scopes.includes('my_team')
      ? [
          {
            key: 'my_team',
            icon: Users,
            label: 'My Team',
            value: summary?.my_team ?? 0,
            accent: 'bg-violet-50 text-violet-700',
          },
        ]
      : []),
    ...(!scopes.includes('assigned_to_me') && scopes.includes('unassigned')
      ? [
          {
            key: 'unassigned',
            icon: UserCog,
            label: 'Unassigned',
            value: summary?.unassigned ?? 0,
            accent: 'bg-amber-50 text-amber-700',
          },
        ]
      : []),
    ...(scopes.includes('closed')
      ? [
          {
            key: 'closed',
            icon: CheckCircle2,
            label: 'Closed',
            value: summary?.closed ?? 0,
            accent: 'bg-slate-100 text-slate-700',
          },
        ]
      : []),
  ].slice(0, 4);

  return (
    <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
      <div className="space-y-6 px-6 py-6 lg:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Support Workspace</p>
            <h1 className="mt-2 text-[1.95rem] font-semibold tracking-tight text-slate-950">
              Support Tickets
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage ticket queues, assignments, and status flow with support-team RBAC.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.key}
              icon={card.icon}
              label={card.label}
              value={card.value}
              accent={card.accent}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {scopes.map((scope) => {
            const active = filters.scope === scope;
            return (
              <button
                key={scope}
                type="button"
                onClick={() => onScopeChange(scope)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {queueLabels[scope] || formatLabel(scope)}
                <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                  {summary?.[scope] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.25fr_repeat(3,minmax(0,0.5fr))]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(event) => onFilterChange('search', event.target.value)}
              placeholder="Search ticket number, subject, requester, category..."
              className={`${inputClassName} pl-11`}
            />
          </label>

          <select
            value={filters.status}
            onChange={(event) => onFilterChange('status', event.target.value)}
            className={inputClassName}
          >
            <option value="all">All Status</option>
            {(options?.statuses || []).map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>

          <select
            value={filters.priority}
            onChange={(event) => onFilterChange('priority', event.target.value)}
            className={inputClassName}
          >
            <option value="all">All Priority</option>
            {(options?.priorities || []).map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>

          <select
            value={filters.category}
            onChange={(event) => onFilterChange('category', event.target.value)}
            className={inputClassName}
          >
            <option value="all">All Category</option>
            {(options?.categories || []).map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50/90">
                <tr className="text-left">
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ticket</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Subject</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Requester</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assignee</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Priority</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Updated</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <div className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Loading support tickets...
                      </div>
                    </td>
                  </tr>
                ) : null}

                {!loading && tickets.length > 0
                  ? tickets.map((ticket) => (
                      <tr key={ticket.id} className="transition hover:bg-slate-50/80">
                        <td className="px-4 py-4 align-top text-sm font-semibold text-slate-700">
                          <div>{ticket.ticket_number}</div>
                          <div className="mt-1 text-xs font-medium text-slate-400">
                            {formatLabel(ticket.category)}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-800">
                          <div className="max-w-[22rem]">
                            <p className="font-semibold text-slate-900">{ticket.subject}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-6 text-slate-500">
                              {ticket.message || 'No message provided.'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          <div className="max-w-[14rem]">
                            <p className="font-medium text-slate-900">{ticket.user_name || 'Unknown requester'}</p>
                            <p className="mt-1 text-xs text-slate-500">{ticket.user_email || 'No email'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          {ticket.assigned_to ? (
                            <div className="max-w-[14rem]">
                              <p className="font-medium text-slate-900">{ticket.assigned_to.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{ticket.assigned_to.email}</p>
                            </div>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-semibold text-slate-500">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top text-sm">
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td className="px-4 py-4 align-top text-sm">
                          <PriorityBadge priority={ticket.priority} priorityMap={priorityMap} />
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-600">
                          {formatDate(ticket.updated_at)}
                        </td>
                        <td className="px-4 py-4 align-top text-sm">
                          <button
                            type="button"
                            onClick={() => onOpenTicket(ticket.id)}
                            className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Open
                          </button>
                        </td>
                      </tr>
                    ))
                  : null}

                {!loading && tickets.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-20 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
                          <Filter className="h-7 w-7" />
                        </div>
                        <p className="mt-5 text-lg font-medium text-slate-700">No tickets matched this queue</p>
                        <p className="mt-2 text-sm text-slate-500">
                          Try a different scope or relax the filters to see more tickets.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export const TicketDetailPanel = ({
  ticket,
  loading,
  teamMembers,
  options,
  detailForm,
  onDetailChange,
  onBack,
  onSave,
  onAttachmentOpen,
  viewer,
  priorityMap,
}) => {
  if (!ticket) return null;

  return (
    <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_0.95fr] lg:px-7">
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tickets
              </button>
              <h1 className="mt-4 text-[1.9rem] font-semibold tracking-tight text-slate-950">
                {ticket.subject}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} priorityMap={priorityMap} />
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <Hash className="mr-1.5 h-3.5 w-3.5" />
                  {ticket.ticket_number}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
              <p>Created: {formatDate(ticket.created_at, true)}</p>
              <p className="mt-2">Updated: {formatDate(ticket.updated_at, true)}</p>
              <p className="mt-2">Category: {formatLabel(ticket.category)}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <UserRound className="h-4 w-4" />
                Requester
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-950">{ticket.user_name || 'Unknown requester'}</p>
              <p className="mt-2 text-sm text-slate-500">{ticket.user_email || 'No email available'}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <UserCog className="h-4 w-4" />
                Assignee
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-950">
                {ticket.assigned_to?.name || 'Unassigned'}
              </p>
              <p className="mt-2 text-sm text-slate-500">{ticket.assigned_to?.email || 'No assignee yet'}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <MessageSquare className="h-4 w-4" />
              Customer Message
            </div>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-5 text-sm leading-7 text-slate-700">
              {ticket.message || 'No message provided.'}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <Paperclip className="h-4 w-4" />
              Attachments
            </div>
            {ticket.attachments?.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {ticket.attachments.map((attachment, index) => (
                  <div
                    key={attachment.id || `${attachment.file_name}-${index}`}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{attachment.file_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{attachment.attachment_url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAttachmentOpen(ticket.id, index)}
                      className="inline-flex items-center rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No attachments were provided for this ticket.</p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <Settings2 className="h-4 w-4" />
              Internal Notes
            </div>
            {ticket.internal_notes?.length > 0 ? (
              <div className="mt-4 space-y-3">
                {ticket.internal_notes.map((note) => (
                  <div key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-sm leading-7 text-slate-700">{note.note}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {note.author_name || 'Support admin'} • {formatDate(note.created_at, true)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No internal notes yet.</p>
            )}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
          className="rounded-3xl border border-slate-200 bg-white p-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Update Ticket</p>

          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Status</span>
              <select
                value={detailForm.status}
                onChange={(event) => onDetailChange('status', event.target.value)}
                className={inputClassName}
              >
                {(options?.statuses || []).map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Priority</span>
              <select
                value={detailForm.priority}
                onChange={(event) => onDetailChange('priority', event.target.value)}
                className={inputClassName}
              >
                {(options?.priorities || []).map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Category</span>
              <select
                value={detailForm.category}
                onChange={(event) => onDetailChange('category', event.target.value)}
                className={inputClassName}
              >
                {(options?.categories || []).map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            {(viewer?.is_manager || viewer?.is_super_admin) && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Assign To</span>
                <select
                  value={detailForm.assigned_to_admin_id ?? ''}
                  onChange={(event) => onDetailChange('assigned_to_admin_id', event.target.value)}
                  className={inputClassName}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">User Update</span>
              <textarea
                rows={5}
                value={detailForm.admin_message}
                onChange={(event) => onDetailChange('admin_message', event.target.value)}
                className={`${inputClassName} resize-none`}
                placeholder="Write the customer-facing update that should be sent with the status change."
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Internal Note</span>
              <textarea
                rows={4}
                value={detailForm.internal_note}
                onChange={(event) => onDetailChange('internal_note', event.target.value)}
                className={`${inputClassName} resize-none`}
                placeholder="Add a note visible only to the support team."
              />
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Update
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export const AnalyticsPanel = ({
  viewer,
  analytics,
  members = [],
  selectedManagerId = null,
  onOpenManagerDashboard,
  onBackToManagerList,
}) => {
  const overview = analytics?.overview || {};
  const managers = analytics?.type === 'super_admin' ? analytics.managers || [] : [];
  const universal = analytics?.type === 'super_admin' ? analytics.universal || {} : {};
  const dailyTrends = analytics?.type === 'super_admin' ? analytics.daily_ticket_trends || [] : [];
  const [trendDays, setTrendDays] = React.useState(14);
  const filteredDailyTrends =
    analytics?.type === 'super_admin' ? dailyTrends.slice(-trendDays) : [];
  const selectedManager =
    analytics?.type === 'super_admin' && selectedManagerId
      ? managers.find((manager) => Number(manager.manager_admin_id) === Number(selectedManagerId)) || null
      : null;

  if (analytics?.type === 'super_admin') {
    if (selectedManagerId) {
      return selectedManager ? (
        <SupportAdminDetailDashboard
          key={selectedManager.manager_admin_id}
          manager={selectedManager}
          members={members}
          onBack={onBackToManagerList}
        />
      ) : (
        <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
          <div className="space-y-6 px-6 py-6 lg:px-7">
            <button
              type="button"
              onClick={onBackToManagerList}
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Support Admin Analytics
            </button>
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-16 text-center text-sm text-slate-500">
              The selected support admin analytics could not be found.
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
        <div className="space-y-6 px-6 py-6 lg:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Support Analytics</p>
            <h2 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-slate-950">
              Super Admin Monitoring
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Track every support admin, their created support users, and the ticket load delegated through the hierarchy.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Shield} label="Support Admins" value={overview.support_admin_count ?? 0} accent="bg-violet-50 text-violet-700" />
            <SummaryCard icon={Users} label="Support Users" value={overview.support_user_count ?? 0} accent="bg-blue-50 text-blue-700" />
            <SummaryCard icon={Ticket} label="Managed Ticket Pool" value={overview.managed_ticket_pool ?? 0} accent="bg-amber-50 text-amber-700" />
            <SummaryCard icon={CheckCircle2} label="Delegated Tickets" value={overview.delegated_ticket_count ?? 0} accent="bg-emerald-50 text-emerald-700" />
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Universal Ticket Analytics</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">All Support Tickets Overview</h3>
              <p className="mt-2 text-sm text-slate-500">
                Live totals from the complete support ticket system, including day-by-day incoming tickets and day-by-day solved tickets.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Show trend for
              </span>
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTrendDays(days)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    trendDays === days
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                icon={Ticket}
                label="Total Support Tickets"
                value={universal.total_tickets ?? 0}
                accent="bg-blue-50 text-blue-700"
              />
              <SummaryCard
                icon={CircleHelp}
                label="Pending Tickets"
                value={universal.pending_tickets ?? 0}
                accent="bg-amber-50 text-amber-700"
              />
              <SummaryCard
                icon={RefreshCw}
                label="In Progress"
                value={universal.in_progress_tickets ?? 0}
                accent="bg-cyan-50 text-cyan-700"
              />
              <SummaryCard
                icon={CheckCircle2}
                label="Solved Tickets"
                value={universal.closed_tickets ?? 0}
                accent="bg-emerald-50 text-emerald-700"
              />
              <SummaryCard
                icon={UserCog}
                label="Unassigned Tickets"
                value={universal.unassigned_tickets ?? 0}
                accent="bg-slate-100 text-slate-700"
              />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <VerticalBarChart
                title="Daily Support Tickets"
                description="Day-by-day count of new support tickets created across the full platform."
                data={filteredDailyTrends.map((entry) => ({
                  label: entry.label,
                  value: entry.created_count,
                  color: 'bg-blue-500',
                  helper: `${entry.created_count} new tickets created on ${entry.label}.`,
                }))}
              />

              <VerticalBarChart
                title="Daily Solved Tickets"
                description="Day-by-day count of support tickets solved and closed across the full platform."
                data={filteredDailyTrends.map((entry) => ({
                  label: entry.label,
                  value: entry.solved_count,
                  color: 'bg-emerald-500',
                  helper: `${entry.solved_count} tickets solved on ${entry.label}.`,
                }))}
              />
            </div>

            <div className="mt-5">
              <HorizontalBarChart
                title="Universal Status Breakdown"
                description="Overall support ticket totals by status, so super admin can track the full queue health in one place."
                data={[
                  {
                    label: 'Open',
                    value: universal.open_tickets,
                    color: 'bg-cyan-500',
                    helper: 'New tickets that are still open.',
                  },
                  {
                    label: 'Pending',
                    value: universal.pending_tickets,
                    color: 'bg-amber-500',
                    helper: 'Tickets currently waiting on follow-up or action.',
                  },
                  {
                    label: 'In Progress',
                    value: universal.in_progress_tickets,
                    color: 'bg-blue-500',
                    helper: 'Tickets actively being worked on.',
                  },
                  {
                    label: 'Resolved',
                    value: universal.resolved_tickets,
                    color: 'bg-violet-500',
                    helper: 'Tickets marked resolved but not yet fully closed.',
                  },
                  {
                    label: 'Closed',
                    value: universal.closed_tickets,
                    color: 'bg-emerald-500',
                    helper: 'Tickets fully solved and closed.',
                  },
                ]}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-slate-50/90">
                  <tr className="text-left">
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Support Admin</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Support Users Created</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ticket Pool</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Open</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Team Solved</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unassigned</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assigned By Admin</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dashboard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {(analytics.managers || []).map((manager) => (
                    <tr key={manager.manager_admin_id} className="transition hover:bg-slate-50/80">
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        <button
                          type="button"
                          onClick={() => onOpenManagerDashboard?.(manager.manager_admin_id)}
                          className="text-left font-semibold text-slate-900 transition hover:text-blue-700"
                        >
                          {manager.manager_name}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">{manager.manager_email}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        <div className="space-y-1 text-xs">
                          <p>Total: {manager.support_user_count ?? 0}</p>
                          <p>Active: {manager.active_support_user_count ?? 0}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-semibold text-slate-900">
                        {manager.pool_metrics?.total_tickets ?? 0}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        {manager.pool_metrics?.open_tickets ?? 0}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        {manager.pool_metrics?.closed_tickets ?? 0}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        {manager.pool_metrics?.unassigned_tickets ?? 0}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        {manager.assigned_ticket_count ?? 0}
                      </td>
                      <td className="px-4 py-4 align-top text-sm">
                        <button
                          type="button"
                          onClick={() => onOpenManagerDashboard?.(manager.manager_admin_id)}
                          className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Open Full Dashboard
                        </button>
                      </td>
                    </tr>
                  ))}

                  {(analytics.managers || []).length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-20 text-center text-sm text-slate-500">
                        No support admin analytics are available yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (analytics?.type === 'support_admin') {
    return (
      <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
        <div className="space-y-6 px-6 py-6 lg:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Team Analytics</p>
            <h2 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-slate-950">
              Support Admin Team Dashboard
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Monitor the support users you created and the tickets currently flowing through your queue.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Users} label="Support Users" value={overview.support_user_count ?? 0} accent="bg-blue-50 text-blue-700" />
            <SummaryCard icon={Ticket} label="Managed Ticket Pool" value={overview.managed_ticket_pool ?? 0} accent="bg-amber-50 text-amber-700" />
            <SummaryCard icon={UserRound} label="Unassigned In Team" value={overview.unassigned_ticket_pool ?? 0} accent="bg-slate-100 text-slate-700" />
            <SummaryCard icon={CheckCircle2} label="Delegated By Me" value={overview.assigned_ticket_count ?? 0} accent="bg-emerald-50 text-emerald-700" />
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Current Team Lead</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {analytics.manager?.manager_name || 'Support Admin'}
                </p>
                <p className="mt-1 text-sm text-slate-500">{analytics.manager?.manager_email || viewer?.team_name}</p>
              </div>
              <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <p>Open team pool: <span className="font-semibold text-slate-900">{overview.open_ticket_pool ?? 0}</span></p>
                <p>Closed team pool: <span className="font-semibold text-slate-900">{overview.closed_ticket_pool ?? 0}</span></p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-slate-50/90">
                  <tr className="text-left">
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Support User</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assigned</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Open</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Closed</th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Default Queue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {(analytics.team_members || []).map((member) => (
                    <tr key={member.id} className="transition hover:bg-slate-50/80">
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{member.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{member.email}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          member.is_blocked ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {member.is_blocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">{member.workload?.total_assigned ?? 0}</td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">{member.workload?.open_assigned ?? 0}</td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">{member.workload?.closed_assigned ?? 0}</td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        {queueLabels[member.default_queue] || formatLabel(member.default_queue)}
                      </td>
                    </tr>
                  ))}

                  {(analytics.team_members || []).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center text-sm text-slate-500">
                        No support users have been created for this team yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const personalMembers = analytics?.team_members?.length
    ? analytics.team_members
    : members.filter((member) => member.hierarchy_role === 'support_user');

  return (
    <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
      <div className="space-y-6 px-6 py-6 lg:px-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Personal Analytics</p>
          <h2 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-slate-950">
            Support User Dashboard
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Track your own workload inside the support admin queue you report to.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Ticket} label="Assigned To Me" value={overview.assigned_ticket_count ?? 0} accent="bg-blue-50 text-blue-700" />
          <SummaryCard icon={CircleHelp} label="Open Tickets" value={overview.open_ticket_pool ?? 0} accent="bg-amber-50 text-amber-700" />
          <SummaryCard icon={CheckCircle2} label="Closed Tickets" value={overview.closed_ticket_pool ?? 0} accent="bg-emerald-50 text-emerald-700" />
          <SummaryCard icon={Users} label="Team Unassigned" value={overview.team_unassigned_ticket_pool ?? 0} accent="bg-slate-100 text-slate-700" />
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Reporting Line</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {analytics.manager?.manager_name || 'Support Admin'}
          </p>
          <p className="mt-1 text-sm text-slate-500">{analytics.manager?.manager_email || 'No manager email available'}</p>
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-800">Visible Support Users In Your Team</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {personalMembers.map((member) => (
              <span key={member.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {member.name}
              </span>
            ))}
            {personalMembers.length === 0 ? (
              <span className="text-sm text-slate-500">No teammate records are available yet.</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export const TeamPanel = ({ members, loading, viewer, onCreate, onEdit }) => (
  <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
    <div className="space-y-6 px-6 py-6 lg:px-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {viewer?.is_super_admin ? 'Support Hierarchy' : 'Support Team'}
          </p>
          <h2 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-slate-950">
            {viewer?.is_super_admin ? 'Support Admins & Support Users' : 'Support Users & Queue RBAC'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {viewer?.is_super_admin
              ? 'Review the full support hierarchy, including managers and their support users.'
              : 'Manage support users, their queue permissions, and their live workloads.'}
          </p>
        </div>

        {viewer?.can_create_support_users ? (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Support User
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[26px] border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-50/90">
              <tr className="text-left">
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">User</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Role</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Queue Access</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workload</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <div className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Loading support team...
                    </div>
                  </td>
                </tr>
              ) : null}

                {!loading && members.length > 0
                  ? members.map((member) => {
                    const enabledPermissions = Object.entries(member.permissions || {})
                      .filter(([key, enabled]) => Boolean(enabled) && queuePermissionMeta[key])
                      .map(([key]) => queuePermissionMeta[key].chipLabel)
                      .filter(Boolean);

                    return (
                      <tr key={member.id} className="transition hover:bg-slate-50/80">
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          <div>
                            <p className="font-semibold text-slate-900">{member.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{member.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            member.hierarchy_role === 'support_admin'
                              ? 'bg-violet-50 text-violet-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {getHierarchyLabel(member.hierarchy_role)}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          <div className="flex max-w-[18rem] flex-wrap gap-2">
                            {enabledPermissions.length > 0 ? (
                              enabledPermissions.map((label) => (
                                <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {label}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">No queue access enabled</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          <div className="space-y-1 text-xs">
                            <p>Total: {member.workload.total_assigned}</p>
                            <p>Open: {member.workload.open_assigned}</p>
                            <p>Closed: {member.workload.closed_assigned}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-700">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            member.is_blocked ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {member.is_blocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-sm">
                          {viewer?.can_edit_team_members ? (
                            <button
                              type="button"
                              onClick={() => onEdit(member)}
                              className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Edit
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Read only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                : null}

              {!loading && members.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
                        <Users className="h-7 w-7" />
                      </div>
                      <p className="mt-5 text-lg font-medium text-slate-700">No support users yet</p>
                      <p className="mt-2 text-sm text-slate-500">
                        Create the first support user to start assigning tickets from your queue.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
);

const CheckboxGroup = ({ title, options = [], values = [], onToggle }) => (
  <div>
    <p className="mb-3 text-sm font-semibold text-slate-700">{title}</p>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selected
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  </div>
);

const CheckboxFieldGroup = ({ title, helperText, options = [], values = [], onToggle }) => (
  <div>
    <p className="mb-2 text-sm font-semibold text-slate-700">{title}</p>
    {helperText ? <p className="mb-3 text-xs leading-5 text-slate-500">{helperText}</p> : null}
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((option) => {
        const selected = values.includes(option.value);
        return (
          <label
            key={option.value}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
              selected ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white'
            }`}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(option.value)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700">{option.label}</span>
              {option.description ? (
                <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  </div>
);

export const MemberModal = ({
  open,
  mode,
  form,
  loading,
  queueOptions,
  priorityOptions,
  categoryOptions,
  onClose,
  onChange,
  onTogglePermission,
  onTogglePriority,
  onToggleCategory,
  onSubmit,
}) => {
  if (!open) return null;

  const title = mode === 'create' ? 'Create Support User' : 'Edit Support User';

  return (
    <div className={modalBackdropClassName}>
      <div className="flex min-h-full items-center justify-center py-4">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Support Team</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm text-slate-500">
                Create a support user under your team. This user can only work on tickets that belong to your support queue.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="rounded-3xl border border-blue-100 bg-blue-50/80 p-5">
                <p className="text-sm font-semibold text-blue-900">How this works</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-blue-800">
                  <p>1. Create the support user with name, email, and password.</p>
                  <p>2. Choose which tickets they are allowed to see inside your queue.</p>
                  <p>3. After saving, assign tickets from the ticket page or the Assignment Center.</p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Name</span>
              <input
                value={form.name}
                onChange={(event) => onChange('name', event.target.value)}
                className={inputClassName}
                placeholder="Support user name"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => onChange('email', event.target.value)}
                className={inputClassName}
                placeholder="name@company.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Team / Group Name</span>
              <input
                value={form.team_name || ''}
                onChange={(event) => onChange('team_name', event.target.value)}
                className={inputClassName}
                placeholder={form.hierarchy_role === 'support_admin' ? 'Example: Pending Team' : 'Same as parent team or subgroup name'}
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Use this as the group name for analytics, filters, and queue management.
              </p>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Password {mode === 'edit' ? '(optional)' : ''}
              </span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => onChange('password', event.target.value)}
                className={inputClassName}
                placeholder={mode === 'edit' ? 'Leave blank to keep current password' : 'Create a password'}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Default Queue</span>
              <select
                value={form.default_queue}
                onChange={(event) => onChange('default_queue', event.target.value)}
                className={inputClassName}
              >
                {queueOptions.map((queue) => (
                  <option key={queue} value={queue}>
                    {queueLabels[queue] || formatLabel(queue)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {form.hierarchy_role === 'support_admin'
                  ? 'Support admins usually should start on All Tickets because they manage the full team queue.'
                  : 'This is the first screen this account will see after login.'}
              </p>
            </label>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <p className="text-sm font-semibold text-slate-800">What this user can see</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              These permissions apply only inside your support-admin queue. They do not give access to other support admins' tickets.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Object.entries(queuePermissionMeta).map(([key, meta]) => (
                <label key={key} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(form.permissions[key])}
                    onChange={() => onTogglePermission(key)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-700">{meta.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{meta.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <CheckboxGroup
            title="Priorities this user can work on"
            options={priorityOptions}
            values={form.allowed_priorities}
            onToggle={onTogglePriority}
          />

          <CheckboxGroup
            title="Categories this user can work on"
            options={categoryOptions}
            values={form.allowed_categories}
            onToggle={onToggleCategory}
          />

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <input
              type="checkbox"
              checked={Boolean(form.is_blocked)}
              onChange={(event) => onChange('is_blocked', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Block this user from logging in</span>
          </label>

            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {mode === 'create' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const BulkAssignPanel = ({
  viewer,
  members,
  options,
  form,
  loading,
  onChange,
  onAssignmentChange,
  onToggleAssignmentPriority,
  onToggleAssignmentCategory,
  onAddAssignment,
  onRemoveAssignment,
  onSubmit,
}) => {
  const totalRequestedTickets = (form.assignments || []).reduce(
    (sum, assignment) => sum + Math.max(0, Number(assignment.quota || 0)),
    0
  );
  const strategyMeta =
    assignmentStrategyHelp[form.strategy] || {
      summary: 'Choose the rule that should decide who gets each ticket.',
      details: '',
      example: '',
    };
  const statusOptions = (options?.statuses || []).map((status) => ({
    value: status,
    label: formatLabel(status),
    description: `Include tickets that are currently ${formatLabel(status).toLowerCase()}.`,
  }));

  return (
    <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
      <div className="space-y-6 px-6 py-6 lg:px-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Assignment Center</p>
        <h2 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-slate-950">Bulk Ticket Distribution</h2>
        <p className="mt-2 text-sm text-slate-500">
          Quickly assign tickets from your queue to your support users with a simple rule.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="w-full space-y-5 rounded-3xl border border-slate-200 bg-slate-50/70 p-5"
      >
          <div className="rounded-3xl border border-blue-100 bg-blue-50/80 p-5">
            <p className="text-sm font-semibold text-blue-900">How to assign tickets</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-blue-800">
              <p>1. Choose which tickets should be included from your queue.</p>
              <p>2. Pick how you want to split them across support users.</p>
              <p>3. Add the support users who should receive those tickets, then run the assignment.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">How to split tickets</span>
              <select
                value={form.strategy}
                onChange={(event) => onChange('strategy', event.target.value)}
                className={inputClassName}
              >
                <option value="fixed_quota">Exact Counts</option>
                <option value="round_robin">Round Robin</option>
                <option value="balanced_chunks">Balanced Chunks</option>
                <option value="random">Random</option>
                <option value="category">Category Owner</option>
                <option value="priority">Priority Owner</option>
              </select>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-800">{strategyMeta.summary}</p>
                {strategyMeta.details ? <p className="mt-2">{strategyMeta.details}</p> : null}
                {strategyMeta.example ? <p className="mt-2 text-slate-500">{strategyMeta.example}</p> : null}
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Which tickets to use</span>
              <select
                value={form.scope}
                onChange={(event) => onChange('scope', event.target.value)}
                className={inputClassName}
              >
                {(viewer?.available_scopes || []).filter((scope) => scope !== 'archived').map((scope) => (
                  <option key={scope} value={scope}>
                    {queueLabels[scope] || formatLabel(scope)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Pick the ticket group you want to distribute from your support-admin queue.
              </p>
            </label>
          </div>

          <div className={`grid gap-4 ${form.strategy === 'fixed_quota' ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
            <CheckboxFieldGroup
              title="Include ticket status"
              helperText="Leave all unchecked to include every status in the selected ticket group. Closed tickets stay in the Closed queue only."
              options={statusOptions}
              values={form.filters.statuses || []}
              onToggle={(value) => onChange('filters.statuses', value)}
            />

            {form.strategy !== 'fixed_quota' ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Max tickets in this run</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={form.limit}
                  onChange={(event) => onChange('limit', event.target.value)}
                  className={inputClassName}
                />
              </label>
            ) : null}
          </div>

          {form.strategy === 'fixed_quota' ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
              Exact split mode will assign <span className="font-semibold">{totalRequestedTickets}</span> tickets in total, based on the counts you enter for each support user below.
            </div>
          ) : null}

          {form.strategy === 'balanced_chunks' ? (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tickets per turn</span>
              <input
                type="number"
                min="1"
                max="100"
                value={form.chunk_size}
                onChange={(event) => onChange('chunk_size', event.target.value)}
                className={inputClassName}
              />
            </label>
          ) : null}

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={Boolean(form.reassign_existing)}
              onChange={(event) => onChange('reassign_existing', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Also move tickets that are already assigned</span>
          </label>

          <CheckboxGroup
            title="Only include these priorities"
            options={options?.priorities || []}
            values={form.filters.priorities}
            onToggle={(value) => onChange('filters.priorities', value)}
          />

          <CheckboxGroup
            title="Only include these categories"
            options={options?.categories || []}
            values={form.filters.categories}
            onToggle={(value) => onChange('filters.categories', value)}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Who should receive tickets</p>
              <button
                type="button"
                onClick={onAddAssignment}
                className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Support User
              </button>
            </div>

            {form.assignments.map((assignment, index) => (
              <div key={`assignment-${index}`} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Support User</span>
                    <select
                      value={assignment.admin_id}
                      onChange={(event) => onAssignmentChange(index, 'admin_id', event.target.value)}
                      className={inputClassName}
                    >
                      <option value="">Select team member</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.email})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end gap-3">
                    {form.strategy === 'fixed_quota' ? (
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">Ticket Count</span>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={assignment.quota ?? 1}
                          onChange={(event) => onAssignmentChange(index, 'quota', event.target.value)}
                          className={`${inputClassName} w-28`}
                        />
                      </label>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onRemoveAssignment(index)}
                      className="mt-auto inline-flex items-center rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove User
                    </button>
                  </div>
                </div>

                {form.strategy === 'priority' ? (
                  <div className="mt-4">
                    <CheckboxGroup
                      title="This user should receive these priorities"
                      options={options?.priorities || []}
                      values={assignment.priorities}
                      onToggle={(value) => onToggleAssignmentPriority(index, value)}
                    />
                  </div>
                ) : null}

                {form.strategy === 'category' ? (
                  <div className="mt-4">
                    <CheckboxGroup
                      title="This user should receive these categories"
                      options={options?.categories || []}
                      values={assignment.categories}
                      onToggle={(value) => onToggleAssignmentCategory(index, value)}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizontal className="mr-2 h-4 w-4" />}
            Assign Tickets Now
          </button>
      </form>
      </div>
    </section>
  );
};
