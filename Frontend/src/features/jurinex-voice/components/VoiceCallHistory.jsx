import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Columns3,
  Download,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
} from 'lucide-react';
import { getVoiceCall, listVoiceCallHistory } from '../api/jurinexVoiceApi';
import VoiceCallDetailDrawer from './VoiceCallDetailDrawer';
import {
  downloadCsv,
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatLatency,
  maskPhone,
  monthStartInput,
  shortCallId,
  titleize,
  todayInput,
} from './voiceCallUtils';

const pageSizes = [11, 25, 50, 100, 200];

const DotValue = ({ value, tone = 'blue' }) => {
  const color =
    tone === 'green'
      ? 'bg-emerald-500'
      : tone === 'red'
        ? 'bg-rose-500'
        : tone === 'muted'
          ? 'bg-slate-300'
          : 'bg-blue-600';
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span>{value}</span>
    </span>
  );
};

const outcomeTone = (value) => {
  if (value === 'successful') return 'green';
  if (value === 'unsuccessful') return 'red';
  return 'muted';
};

const baseColumns = [
  { key: 'time', label: 'Time', render: (row) => formatDateTime(row.started_at), min: '210px' },
  { key: 'duration', label: 'Duration', render: (row) => formatDuration(row.duration_seconds), min: '110px' },
  { key: 'channel', label: 'Channel Type', render: (row) => row.channel_type || '—', min: '140px' },
  { key: 'cost', label: 'Cost', render: (row) => formatCurrency(row.cost_usd), min: '110px' },
  { key: 'session', label: 'Session ID', render: (row) => shortCallId(row.id), min: '260px' },
  {
    key: 'end_reason',
    label: 'End Reason',
    render: (row) => <DotValue value={titleize(row.end_reason)} tone={row.end_reason === 'agent_hangup' ? 'green' : 'blue'} />,
    min: '150px',
  },
  {
    key: 'status',
    label: 'Session Status',
    render: (row) => <DotValue value={titleize(row.status)} tone="muted" />,
    min: '150px',
  },
  {
    key: 'sentiment',
    label: 'User Sentiment',
    render: (row) => <DotValue value={titleize(row.user_sentiment)} tone={row.user_sentiment === 'unknown' ? 'muted' : 'blue'} />,
    min: '160px',
  },
  { key: 'from', label: 'From', render: (row, showPii) => maskPhone(row.twilio_from || row.customer_phone, showPii), min: '160px' },
  { key: 'to', label: 'To', render: (row, showPii) => maskPhone(row.twilio_to, showPii), min: '160px' },
  { key: 'direction', label: 'Direction', render: (row) => titleize(row.direction), min: '130px' },
  {
    key: 'outcome',
    label: 'Session Outcome',
    render: (row) => <DotValue value={titleize(row.session_outcome)} tone={outcomeTone(row.session_outcome)} />,
    min: '170px',
  },
  { key: 'latency', label: 'End to End Latency', render: (row) => formatLatency(row.end_to_end_latency_ms), min: '180px' },
  { key: 'language', label: 'preferred_language', render: (row) => row.preferred_language || '—', min: '170px' },
  {
    key: 'custom',
    label: 'Custom Attributes',
    render: (row) => Object.keys(row.custom_attributes || {}).length || '—',
    min: '170px',
  },
];

const FilterBar = ({
  filters,
  setFilters,
  loading,
  showPii,
  setShowPii,
  onRefresh,
  onExport,
  visibleColumns,
  setVisibleColumns,
}) => {
  const [customizing, setCustomizing] = useState(false);

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-950">Call History</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPii((value) => !value)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Settings2 className="w-4 h-4" />
            {showPii ? 'Hide PII' : 'Show PII'}
          </button>
          <button
            onClick={onExport}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={onRefresh}
            className="inline-flex items-center justify-center w-10 h-10 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            aria-label="Refresh call history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value, page: 1 }))}
              className="bg-transparent outline-none text-sm"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value, page: 1 }))}
              className="bg-transparent outline-none text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filters.direction}
              onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value, page: 1 }))}
              className="bg-transparent outline-none text-sm"
            >
              <option value="">All directions</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
              placeholder="Search"
              className="bg-transparent outline-none text-sm w-44"
            />
          </label>
        </div>

        <div className="relative">
          <button
            onClick={() => setCustomizing((value) => !value)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Columns3 className="w-4 h-4" />
            Customize View
          </button>
          {customizing && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
              {baseColumns.map((column) => (
                <label key={column.key} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key]}
                    onChange={() => toggleColumn(column.key)}
                    className="rounded border-slate-300"
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const VoiceCallHistory = () => {
  const [filters, setFilters] = useState({
    start_date: monthStartInput(),
    end_date: todayInput(),
    direction: '',
    search: '',
    page: 1,
    pageSize: 11,
  });
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPii, setShowPii] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() =>
    baseColumns.reduce((acc, column) => ({ ...acc, [column.key]: column.key !== 'custom' }), {})
  );

  const columns = useMemo(
    () => baseColumns.filter((column) => visibleColumns[column.key]),
    [visibleColumns]
  );

  const offset = (filters.page - 1) * filters.pageSize;
  const totalPages = Math.max(Math.ceil(total / filters.pageSize), 1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listVoiceCallHistory({
        start_date: filters.start_date,
        end_date: filters.end_date,
        direction: filters.direction,
        search: filters.search,
        limit: filters.pageSize,
        offset,
      });
      setCalls(data.calls || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.start_date, filters.end_date, filters.direction, filters.search, filters.page, filters.pageSize]);

  const openDetail = async (callId) => {
    setSelectedCallId(callId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await getVoiceCall(callId);
      setDetail(data);
    } catch (err) {
      setDetail({ call: null, error: err.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const exportRows = () => {
    const header = columns.map((column) => column.label);
    const rows = calls.map((row) =>
      columns.map((column) => {
        if (column.key === 'time') return formatDateTime(row.started_at);
        if (column.key === 'duration') return formatDuration(row.duration_seconds);
        if (column.key === 'channel') return row.channel_type || '';
        if (column.key === 'cost') return formatCurrency(row.cost_usd);
        if (column.key === 'session') return shortCallId(row.id);
        if (column.key === 'end_reason') return titleize(row.end_reason);
        if (column.key === 'status') return titleize(row.status);
        if (column.key === 'sentiment') return titleize(row.user_sentiment);
        if (column.key === 'direction') return titleize(row.direction);
        if (column.key === 'outcome') return titleize(row.session_outcome);
        if (column.key === 'latency') return formatLatency(row.end_to_end_latency_ms);
        if (column.key === 'language') return row.preferred_language || '';
        if (column.key === 'from') return maskPhone(row.twilio_from || row.customer_phone, showPii);
        if (column.key === 'to') return maskPhone(row.twilio_to, showPii);
        if (column.key === 'custom') return JSON.stringify(row.custom_attributes || {});
        return row[column.key] || '';
      })
    );
    downloadCsv(`jurinex-voice-calls-${filters.start_date}-to-${filters.end_date}.csv`, [header, ...rows]);
  };

  return (
    <div className="space-y-3 text-slate-900">
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          loading={loading}
          showPii={showPii}
          setShowPii={setShowPii}
          onRefresh={load}
          onExport={exportRows}
          visibleColumns={visibleColumns}
          setVisibleColumns={setVisibleColumns}
        />
      </section>

      {error && (
        <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg">
          {error}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr className="text-left">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-4 font-medium whitespace-nowrap"
                    style={{ minWidth: column.min }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calls.length === 0 && !loading && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                    No call sessions.
                  </td>
                </tr>
              )}
              {calls.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => openDetail(row.id)}
                  className={`cursor-pointer hover:bg-slate-50 ${
                    selectedCallId === row.id ? 'bg-slate-100' : ''
                  }`}
                >
                  {columns.map((column) => (
                    <td
                      key={`${row.id}-${column.key}`}
                      className="px-4 py-3 text-slate-700 whitespace-nowrap"
                      style={{ minWidth: column.min }}
                    >
                      {column.render(row, showPii)}
                    </td>
                  ))}
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                    Loading calls...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
          <div>
            Page {filters.page} of {totalPages} • Total Session: {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
              disabled={filters.page <= 1}
              className="w-9 h-9 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              ‹
            </button>
            <span className="w-10 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              {filters.page}
            </span>
            <button
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(prev.page + 1, totalPages) }))}
              disabled={filters.page >= totalPages}
              className="w-9 h-9 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              ›
            </button>
            <select
              value={filters.pageSize}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))
              }
              className="h-9 px-3 border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <VoiceCallDetailDrawer
        open={!!selectedCallId}
        loading={detailLoading}
        detail={detail}
        onClose={() => {
          setSelectedCallId(null);
          setDetail(null);
        }}
      />
    </div>
  );
};

export default VoiceCallHistory;
