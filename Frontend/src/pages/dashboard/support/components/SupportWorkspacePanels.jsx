import React from 'react';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
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
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

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
  <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold text-slate-950">{value}</p>
      </div>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </div>
);

const CHART_NEW = '#2563eb';
const CHART_SOLVED = '#059669';
const CHART_BAR = '#2563eb';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
          {item.name}: <span className="ml-0.5 font-semibold text-slate-900">{item.value}</span>
        </p>
      ))}
    </div>
  );
};

const ChartLegendDot = ({ color, label }) => (
  <span className="flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    {label}
  </span>
);

const TicketTrendChart = ({ data }) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">Ticket trend</h4>
        <p className="mt-0.5 text-xs text-slate-500">New vs. solved tickets per day.</p>
      </div>
      <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
        <ChartLegendDot color={CHART_NEW} label="New" />
        <ChartLegendDot color={CHART_SOLVED} label="Solved" />
      </div>
    </div>
    <div className="mt-4 h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis allowDecimals={false} width={44} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
          <Line type="monotone" dataKey="created" name="New" stroke={CHART_NEW} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="solved" name="Solved" stroke={CHART_SOLVED} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const StatusBreakdownChart = ({ data, title = 'Status breakdown', subtitle = 'All tickets by current status.' }) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
    <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
    <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
    <div className="mt-4 h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 6 }} barCategoryGap={12}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
          <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="value" name="Tickets" fill={CHART_BAR} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
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

const DetailMetricCard = ({ label, value, accent = 'bg-slate-100 text-slate-700' }) => {
  const dotColor = (accent || '').split(' ').find((token) => token.startsWith('text-')) || 'text-slate-400';
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${dotColor}`} />
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.1em] text-slate-500">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
};

const HorizontalBarChart = ({ title, description, data = [] }) => {
  const normalizedData = data
    .map((item) => ({
      ...item,
      value: toMetricValue(item.value),
    }))
    .filter((item) => item.label);
  const maxValue = Math.max(...normalizedData.map((item) => item.value), 0);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BarChart3 className="h-4 w-4 text-slate-400" />
        {title}
      </div>
      {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}

      <div className="mt-4 space-y-3">
        {normalizedData.length > 0 ? (
          normalizedData.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="font-semibold text-slate-950">{item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${item.color || 'bg-blue-500'}`}
                  style={{ width: getBarWidth(item.value, maxValue) }}
                />
              </div>
              {item.helper ? <p className="text-xs leading-5 text-slate-500">{item.helper}</p> : null}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
            No data available yet.
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

      <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Support Admin</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{manager.manager_name}</h3>
            <p className="mt-1 truncate text-sm text-slate-500">{manager.manager_email} · {teamName}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Assigned by admin</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-900">{ticketsAssignedByAdmin}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Users created</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-900">{supportUsersCreated}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Solved today</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-900">{solvedTickets}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Queue closed</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-900">{teamSolvedTickets}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

        <StatusBreakdownChart
          title={reports.length > 0 ? 'Solved today by support user' : 'Solved ticket snapshot'}
          subtitle={
            reports.length > 0
              ? 'Tickets each support user closed today.'
              : "Today's solved workload alongside the queue totals."
          }
          data={solvedPerformanceData.map((entry) => ({
            label: entry.label,
            value: toMetricValue(entry.value),
          }))}
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
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Super Admin Monitoring</h2>
            <p className="mt-1 text-sm text-slate-500">
              Support admins, their created users, and ticket load across the hierarchy.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Shield} label="Support Admins" value={overview.support_admin_count ?? 0} accent="bg-violet-50 text-violet-700" />
            <SummaryCard icon={Users} label="Support Users" value={overview.support_user_count ?? 0} accent="bg-blue-50 text-blue-700" />
            <SummaryCard icon={Ticket} label="Managed Ticket Pool" value={overview.managed_ticket_pool ?? 0} accent="bg-amber-50 text-amber-700" />
            <SummaryCard icon={CheckCircle2} label="Delegated Tickets" value={overview.delegated_ticket_count ?? 0} accent="bg-emerald-50 text-emerald-700" />
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-slate-50/50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">All Support Tickets</h3>
                <p className="mt-0.5 text-sm text-slate-500">Live totals across the platform.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Trend</span>
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

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <TicketTrendChart
                data={filteredDailyTrends.map((entry) => ({
                  label: entry.label,
                  created: toMetricValue(entry.created_count),
                  solved: toMetricValue(entry.solved_count),
                }))}
              />
              <StatusBreakdownChart
                data={[
                  { label: 'Open', value: toMetricValue(universal.open_tickets) },
                  { label: 'Pending', value: toMetricValue(universal.pending_tickets) },
                  { label: 'In Progress', value: toMetricValue(universal.in_progress_tickets) },
                  { label: 'Resolved', value: toMetricValue(universal.resolved_tickets) },
                  { label: 'Closed', value: toMetricValue(universal.closed_tickets) },
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

// Hoisted to module scope: if this lived inside MemberModal it would be a new
// component identity on every render, remounting the inputs and dropping focus
// after each keystroke.
const SectionCard = ({ icon: Icon, heading, note, children }) => (
  <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-slate-900">{heading}</h4>
        {note ? <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p> : null}
      </div>
    </div>
    {children}
  </section>
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
  const isCreate = mode === 'create';

  const labelClassName = 'mb-2 block text-sm font-semibold text-slate-700';
  const helperClassName = 'mt-2 text-xs leading-5 text-slate-500';
  const requiredMark = <span className="text-rose-500">*</span>;
  const pillClassName =
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition';

  const defaultQueueLabel = form.default_queue
    ? queueLabels[form.default_queue] || formatLabel(form.default_queue)
    : '—';

  return (
    <div className={modalBackdropClassName}>
      <div className="flex min-h-full items-center justify-center py-4">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Support Team</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm text-slate-500">
                Create a support user under your team. This user can only work on tickets that belong to your support queue.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-600">
                  <Ticket className="h-3.5 w-3.5 text-slate-400" />
                  {defaultQueueLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium ${
                    form.is_blocked
                      ? 'border-slate-200 bg-slate-100 text-slate-600'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${form.is_blocked ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                  {form.is_blocked ? 'Blocked' : 'Active'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
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
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/50 px-6 py-6">
              <SectionCard icon={UserRound} heading="Account details">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className={labelClassName}>Name {isCreate ? requiredMark : null}</span>
                    <input
                      value={form.name}
                      onChange={(event) => onChange('name', event.target.value)}
                      className={inputClassName}
                      placeholder="Support user name"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Email {requiredMark}</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => onChange('email', event.target.value)}
                      className={inputClassName}
                      placeholder="name@company.com"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>
                      Password{' '}
                      {isCreate ? requiredMark : <span className="font-normal text-slate-400">(optional)</span>}
                    </span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => onChange('password', event.target.value)}
                      className={inputClassName}
                      placeholder={isCreate ? 'Create a password' : 'Leave blank to keep current password'}
                    />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Team / Group Name</span>
                    <input
                      value={form.team_name || ''}
                      onChange={(event) => onChange('team_name', event.target.value)}
                      className={inputClassName}
                      placeholder={
                        form.hierarchy_role === 'support_admin'
                          ? 'Example: Pending Team'
                          : 'Same as parent team or subgroup name'
                      }
                    />
                    <p className={helperClassName}>
                      Used as the group name for analytics, filters, and queue management.
                    </p>
                  </label>

                  <label className="block md:col-span-2">
                    <span className={labelClassName}>Default Queue</span>
                    <select
                      value={form.default_queue}
                      onChange={(event) => onChange('default_queue', event.target.value)}
                      className={`${inputClassName} md:max-w-sm`}
                    >
                      {queueOptions.map((queue) => (
                        <option key={queue} value={queue}>
                          {queueLabels[queue] || formatLabel(queue)}
                        </option>
                      ))}
                    </select>
                    <p className={helperClassName}>
                      {form.hierarchy_role === 'support_admin'
                        ? 'Support admins usually start on All Tickets because they manage the full team queue.'
                        : 'The first screen this account sees after login.'}
                    </p>
                  </label>
                </div>
              </SectionCard>

              <SectionCard
                icon={Ticket}
                heading="Ticket scope"
                note="Applies only inside your support-admin queue. Does not grant access to other admins' tickets."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(queuePermissionMeta).map(([key, meta]) => {
                    const selected = Boolean(form.permissions[key]);
                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                          selected ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => onTogglePermission(key)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-700">{meta.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">{meta.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard icon={Filter} heading="Priorities & categories">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="mb-3 text-sm font-semibold text-slate-700">Priorities this user can work on</p>
                    <div className="flex flex-wrap gap-2">
                      {priorityOptions.map((option) => {
                        const selected = form.allowed_priorities.includes(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onTogglePriority(option.value)}
                            className={`${pillClassName} ${
                              selected
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-semibold text-slate-700">Categories this user can work on</p>
                    <div className="flex flex-wrap gap-2">
                      {categoryOptions.map((option) => {
                        const selected = form.allowed_categories.includes(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onToggleCategory(option.value)}
                            className={`${pillClassName} ${
                              selected
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon={Settings2} heading="Access control">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_blocked)}
                    onChange={(event) => onChange('is_blocked', event.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Block this user from logging in</span>
                </label>
              </SectionCard>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-5">
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
                {isCreate ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Module-scoped helpers (kept out of BulkAssignPanel so their identity is
// stable across renders — a nested component would remount inputs and drop focus).
const AssignStep = ({ number, icon: Icon, heading, children }) => (
  <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
        {number}
      </span>
      <Icon className="h-4 w-4 text-slate-400" />
      <h4 className="text-sm font-semibold text-slate-900">{heading}</h4>
    </div>
    {children}
  </div>
);

const ChoiceCard = ({ active, onClick, title, desc }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex-1 rounded-2xl border px-4 py-3 text-left transition ${
      active ? 'border-blue-300 bg-blue-50/70 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:bg-slate-50'
    }`}
  >
    <span className={`block text-sm font-semibold ${active ? 'text-blue-800' : 'text-slate-800'}`}>{title}</span>
    <span className="mt-1 block text-xs leading-5 text-slate-500">{desc}</span>
  </button>
);

export const BulkAssignPanel = ({
  viewer,
  members,
  options,
  summary,
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
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const scopes = (viewer?.available_scopes || []).filter((scope) => scope !== 'archived');
  const isExactCounts = form.strategy === 'fixed_quota';
  const reassign = Boolean(form.reassign_existing);
  const assignments = form.assignments || [];
  const selectedCount = assignments.filter((entry) => entry.admin_id).length;
  const totalExact = assignments.reduce((sum, entry) => sum + Math.max(0, Number(entry.quota || 0)), 0);

  const availableCount = summary
    ? reassign
      ? summary[form.scope]
      : summary.unassigned
    : undefined;
  const availableLabel = reassign
    ? `in ${queueLabels[form.scope] || formatLabel(form.scope)}`
    : 'unassigned right now';

  return (
    <section className={`${CARD_CLASS_NAME} overflow-hidden`}>
      <div className="space-y-6 px-6 py-6 lg:px-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Assignment Center</p>
          <h2 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-slate-950">Assign Tickets</h2>
          <p className="mt-2 text-sm text-slate-500">
            Hand tickets from your queue to your support users in three quick steps.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <AssignStep number="1" icon={UserRound} heading="Who should get the tickets?">
            <div className="space-y-3">
              {assignments.map((assignment, index) => (
                <div key={`assignment-${index}`} className="flex flex-wrap items-center gap-3">
                  <select
                    value={assignment.admin_id}
                    onChange={(event) => onAssignmentChange(index, 'admin_id', event.target.value)}
                    className={`${inputClassName} min-w-[16rem] flex-1`}
                  >
                    <option value="">Select support user…</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.email})
                      </option>
                    ))}
                  </select>
                  {isExactCounts ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={assignment.quota ?? 1}
                        onChange={(event) => onAssignmentChange(index, 'quota', event.target.value)}
                        className={`${inputClassName} w-24`}
                      />
                      <span className="text-xs font-medium text-slate-500">tickets</span>
                    </div>
                  ) : null}
                  {assignments.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveAssignment(index)}
                      className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove support user"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={onAddAssignment}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another user
              </button>
            </div>
          </AssignStep>

          <AssignStep number="2" icon={Ticket} heading="Which tickets should they get?">
            <div className="flex flex-col gap-2 sm:flex-row">
              <ChoiceCard
                active={!reassign}
                onClick={() => onChange('reassign_existing', false)}
                title="Unassigned only"
                desc="Hand out tickets that nobody is working on yet."
              />
              <ChoiceCard
                active={reassign}
                onClick={() => onChange('reassign_existing', true)}
                title="Reassign existing"
                desc="Also move tickets that are already assigned to someone."
              />
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Pull from queue</span>
                <select
                  value={form.scope}
                  onChange={(event) => onChange('scope', event.target.value)}
                  className={`${inputClassName} min-w-[12rem]`}
                >
                  {scopes.map((scope) => (
                    <option key={scope} value={scope}>
                      {queueLabels[scope] || formatLabel(scope)}
                    </option>
                  ))}
                </select>
              </label>
              {typeof availableCount === 'number' ? (
                <span
                  className={`mb-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    availableCount === 0
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {availableCount} {availableCount === 1 ? 'ticket' : 'tickets'} {availableLabel}
                </span>
              ) : null}
            </div>

            {!reassign && availableCount === 0 ? (
              <p className="mt-2 text-xs leading-5 text-amber-700">
                There are no unassigned tickets to hand out. Switch to “Reassign existing” to move tickets that are already assigned.
              </p>
            ) : null}
          </AssignStep>

          <AssignStep number="3" icon={Shuffle} heading="How should they be split?">
            <div className="flex flex-col gap-2 sm:flex-row">
              <ChoiceCard
                active={!isExactCounts}
                onClick={() => onChange('strategy', 'round_robin')}
                title="Split evenly"
                desc="Share tickets one by one across the selected users."
              />
              <ChoiceCard
                active={isExactCounts}
                onClick={() => onChange('strategy', 'fixed_quota')}
                title="Set exact number"
                desc="Choose how many tickets each user gets (set it in step 1)."
              />
            </div>
            {!isExactCounts ? (
              <label className="mt-4 block max-w-xs">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Up to how many tickets in total?</span>
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
          </AssignStep>

          <div className="rounded-3xl border border-slate-200/70 bg-white">
            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-700"
            >
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                Advanced filters (optional)
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            {showAdvanced ? (
              <div className="space-y-4 border-t border-slate-200/70 px-5 py-4">
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
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/70 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {selectedCount === 0
                ? 'Select at least one support user above.'
                : isExactCounts
                  ? `Ready to assign ${totalExact} ticket${totalExact === 1 ? '' : 's'} across ${selectedCount} user${selectedCount === 1 ? '' : 's'}.`
                  : `Ready to split up to ${form.limit} ticket${Number(form.limit) === 1 ? '' : 's'} evenly across ${selectedCount} user${selectedCount === 1 ? '' : 's'}.`}
            </p>
            <button
              type="submit"
              disabled={loading || selectedCount === 0}
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizontal className="mr-2 h-4 w-4" />}
              Assign Tickets
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
