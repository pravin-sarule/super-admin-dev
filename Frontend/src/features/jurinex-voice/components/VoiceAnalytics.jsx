import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar, Filter, RefreshCw, RotateCcw, BarChart3 } from 'lucide-react';
import { getVoiceCallAnalytics } from '../api/jurinexVoiceApi';
import {
  COLORS,
  formatDateLabel,
  formatDurationLong,
  formatLatency,
  formatPercent,
  monthStartInput,
  titleize,
  todayInput,
} from './voiceCallUtils';

const ChartCard = ({ title, subtitle = 'All agents', children, className = '' }) => (
  <section className={`bg-white border border-slate-200 rounded-lg p-5 min-h-[260px] ${className}`}>
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
    {children}
  </section>
);

const MetricCard = ({ label, value }) => (
  <section className="bg-white border border-slate-200 rounded-lg p-5 min-h-[126px]">
    <p className="text-sm font-semibold text-slate-950">{label}</p>
    <p className="text-xs text-slate-400 mt-1">All agents</p>
    <div className="text-3xl font-semibold text-slate-950 mt-4">{value}</div>
  </section>
);

const EmptyChart = () => (
  <div className="h-52 flex items-center justify-center text-sm text-slate-400">
    No data
  </div>
);

const toDistribution = (rows = []) =>
  rows
    .filter((row) => Number(row.value) > 0)
    .map((row) => ({
      name: titleize(row.label),
      value: Number(row.value) || 0,
      raw: row.label,
    }));

const Donut = ({ data }) => {
  if (!data.length) return <EmptyChart />;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={96} paddingAngle={0}>
            {data.map((entry, index) => (
              <Cell key={entry.raw || entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${value} (${total ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
              name,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="square"
            wrapperStyle={{ fontSize: 12, overflow: 'hidden' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

const AnalyticsFilter = ({ filters, setFilters, loading, onRefresh }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2 text-slate-950">
      <BarChart3 className="w-4 h-4 text-slate-500" />
      <h2 className="text-base font-semibold">Analytics</h2>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700">
        <Calendar className="w-4 h-4 text-slate-500" />
        <input
          type="date"
          value={filters.start_date}
          onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
          className="bg-transparent outline-none text-sm"
        />
        <span className="text-slate-400">to</span>
        <input
          type="date"
          value={filters.end_date}
          onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
          className="bg-transparent outline-none text-sm"
        />
      </label>
      <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700">
        <Filter className="w-4 h-4 text-slate-500" />
        <select
          value={filters.direction}
          onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value }))}
          className="bg-transparent outline-none text-sm"
        >
          <option value="">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
      </label>
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  </div>
);

const VoiceAnalytics = () => {
  const [filters, setFilters] = useState({
    start_date: monthStartInput(),
    end_date: todayInput(),
    direction: '',
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVoiceCallAnalytics({
        ...filters,
        timezone: 'Asia/Kolkata',
      });
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.start_date, filters.end_date, filters.direction]);

  const summary = analytics?.summary || {};
  const timeseries = useMemo(
    () =>
      (analytics?.timeseries || []).map((row) => ({
        ...row,
        date_label: formatDateLabel(row.date),
        call_count: Number(row.call_count) || 0,
        total_duration_seconds: Number(row.total_duration_seconds) || 0,
        avg_latency_ms: Number(row.avg_latency_ms) || 0,
        peak_concurrency: Number(row.peak_concurrency) || 0,
        success_percent: Math.round((Number(row.success_rate) || 0) * 100),
        picked_up_percent: Math.round((Number(row.picked_up_rate) || 0) * 100),
        transfer_percent: Math.round((Number(row.transfer_rate) || 0) * 100),
      })),
    [analytics]
  );

  const distributions = analytics?.distributions || {};
  const agentMetrics = (analytics?.agent_metrics || []).map((row) => ({
    agent_name: row.agent_name,
    success_rate: Math.round((Number(row.success_rate) || 0) * 100),
    picked_up_rate: Math.round((Number(row.picked_up_rate) || 0) * 100),
    transfer_rate: Math.round((Number(row.transfer_rate) || 0) * 100),
  }));

  return (
    <div className="space-y-3 text-slate-900">
      <AnalyticsFilter filters={filters} setFilters={setFilters} loading={loading} onRefresh={load} />

      {error && (
        <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard label="Call Counts" value={summary.call_count ?? 0} />
        <MetricCard label="Call Duration" value={formatDurationLong(summary.total_duration_seconds)} />
        <MetricCard label="Call Latency" value={formatLatency(summary.avg_latency_ms)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <ChartCard title="Call Counts" className="xl:col-span-2 min-h-[382px]">
          {timeseries.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeseries} margin={{ top: 14, right: 18, bottom: 8, left: -16 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="date_label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="call_count"
                    name="Call counts"
                    stroke="#5f85f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Concurrency Used" className="min-h-[382px]">
          {timeseries.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries} margin={{ top: 14, right: 18, bottom: 8, left: -16 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="date_label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="peak_concurrency"
                    name="Concurrency used"
                    stroke="#5f85f6"
                    fill="#dbeafe"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ChartCard title="Call Successful">
          <Donut data={toDistribution(distributions.outcome)} />
        </ChartCard>
        <ChartCard title="Disconnection Reason">
          <Donut data={toDistribution(distributions.end_reason)} />
        </ChartCard>
        <ChartCard title="User Sentiment">
          <Donut data={toDistribution(distributions.sentiment)} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ChartCard title="Phone inbound/outbound">
          <Donut data={toDistribution(distributions.direction)} />
        </ChartCard>
        <ChartCard title="Average Latency">
          {timeseries.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeseries} margin={{ top: 10, right: 18, bottom: 8, left: -10 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="date_label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => formatLatency(value)} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="avg_latency_ms" name="End to end latency" fill="#5f85f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
        <ChartCard title="Call Duration">
          {timeseries.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeseries} margin={{ top: 10, right: 18, bottom: 8, left: -10 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="date_label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => formatDurationLong(value)} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total_duration_seconds" name="Call duration" fill="#5f85f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ChartCard title="Call Successful Rate">
          {agentMetrics.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentMetrics} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 26 }}>
                  <CartesianGrid stroke="#eef2f7" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="agent_name" type="category" width={96} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Call successful rate']} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="success_rate" name="Call successful rate" fill="#5f85f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
        <ChartCard title="Call Picked Up Rate">
          {agentMetrics.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentMetrics} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 26 }}>
                  <CartesianGrid stroke="#eef2f7" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="agent_name" type="category" width={96} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Call picked up rate']} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="picked_up_rate" name="Call picked up rate" fill="#5f85f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
        <ChartCard title="Call Transfer Rate">
          <div className="flex h-56 items-center justify-center">
            <div className="text-center">
              <div className="text-5xl font-semibold text-slate-950">
                {formatPercent(summary.transfer_rate)}
              </div>
              <p className="text-xs text-slate-400 mt-2">Transfers requested</p>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default VoiceAnalytics;
