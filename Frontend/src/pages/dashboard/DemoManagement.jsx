import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar, Clock, Mail, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Plus, Trash2, Send, ChevronLeft, ChevronRight, Search, FileUp,
  Eye, Users, Layers, CalendarCheck, BarChart3, Zap, X, ChevronDown,
} from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { API_BASE_URL, getToken } from '../../config';

const MySwal = withReactContent(Swal);

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtIST = (d, opts = {}) =>
  d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts }) : '—';
const fmtDate     = (d) => fmtIST(d, { dateStyle: 'medium' });
const fmtTime     = (d) => fmtIST(d, { timeStyle: 'short' });
const fmtDateTime = (d) => fmtIST(d, { dateStyle: 'medium', timeStyle: 'short' });

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-800 border-amber-200',    icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 border-blue-200',       icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200',          icon: XCircle },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
);

const BOOKINGS_PER_PAGE = 20;

// ══════════════════════════════════════════════════════════════════════════════
const DemoManagement = () => {
  const [activeTab, setActiveTab] = useState('bookings');

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Bookings ───────────────────────────────────────────────────────────────
  const [bookings, setBookings]           = useState([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPage, setBookingsPage]   = useState(1);
  const [statusFilter, setStatusFilter]   = useState('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError]     = useState(null);
  const [updatingStatus, setUpdatingStatus]   = useState(null);
  const [sendingInvite, setSendingInvite]     = useState(null);
  const [deletingBooking, setDeletingBooking] = useState(null);
  const [expandedBooking, setExpandedBooking] = useState(null);

  // ── Slots ──────────────────────────────────────────────────────────────────
  const [slots, setSlots]               = useState([]);
  const [slotsTotal, setSlotsTotal]     = useState(0);
  const [slotsFilter, setSlotsFilter]   = useState('all');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError]     = useState(null);
  const [deletingSlot, setDeletingSlot] = useState(null);

  // Add slot form
  const [showAddSlot, setShowAddSlot]         = useState(false);
  const [newSlotDate, setNewSlotDate]         = useState('');
  const [newSlotStart, setNewSlotStart]       = useState('10:00');
  const [newSlotEnd, setNewSlotEnd]           = useState('11:00');
  const [addingSlot, setAddingSlot]           = useState(false);
  const [addSlotError, setAddSlotError]       = useState(null);

  // Generate slots
  const [generateDays, setGenerateDays]       = useState(7);
  const [generatingSlots, setGeneratingSlots] = useState(false);

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/admin/demo/stats`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) setStats(json);
    } catch { /* silent */ } finally { setStatsLoading(false); }
  }, []);

  const fetchBookings = useCallback(async (page = 1) => {
    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const qs  = new URLSearchParams({ page, limit: BOOKINGS_PER_PAGE, status: statusFilter, search: bookingSearch });
      const res  = await fetch(`${API_BASE_URL}/admin/demo/bookings?${qs}`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) { setBookings(json.bookings); setBookingsTotal(json.total); setBookingsPage(page); }
      else setBookingsError(json.error || 'Failed to load bookings');
    } catch (err) { setBookingsError(err.message); }
    finally { setBookingsLoading(false); }
  }, [statusFilter, bookingSearch]);

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const qs  = new URLSearchParams({ filter: slotsFilter, limit: 200 });
      const res  = await fetch(`${API_BASE_URL}/admin/demo/slots?${qs}`, { headers: authHeader() });
      const json = await res.json();
      if (json.success) { setSlots(json.slots); setSlotsTotal(json.total); }
      else setSlotsError(json.error || 'Failed to load slots');
    } catch (err) { setSlotsError(err.message); }
    finally { setSlotsLoading(false); }
  }, [slotsFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (activeTab === 'bookings') fetchBookings(1); }, [activeTab, statusFilter]);
  useEffect(() => { if (activeTab === 'slots') fetchSlots(); }, [activeTab, slotsFilter]);

  // ── Booking actions ────────────────────────────────────────────────────────
  const handleStatusUpdate = async (bookingId, newStatus) => {
    setUpdatingStatus(bookingId);
    try {
      const res  = await fetch(`${API_BASE_URL}/admin/demo/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
        fetchStats();
      }
    } finally { setUpdatingStatus(null); }
  };

  const handleSendInvite = async (booking) => {
    const result = await MySwal.fire({
      title: 'Send Demo Invite?',
      html:  `Send a booking confirmation email to<br/><strong>${booking.email}</strong>?`,
      icon:  'question',
      showCancelButton: true,
      confirmButtonColor: '#4338ca',
      confirmButtonText: '✉️ Yes, Send Invite',
      cancelButtonText:  'Cancel',
    });
    if (!result.isConfirmed) return;

    setSendingInvite(booking.id);
    try {
      const res  = await fetch(`${API_BASE_URL}/admin/demo/bookings/${booking.id}/send-invite`, {
        method: 'POST',
        headers: authHeader(),
      });
      const json = await res.json();
      if (json.success) {
        MySwal.fire({ icon: 'success', title: 'Invite Sent!', text: json.message, timer: 2500, showConfirmButton: false });
        fetchBookings(bookingsPage);
        fetchStats();
      } else {
        MySwal.fire({ icon: 'error', title: 'Failed', text: json.error });
      }
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally { setSendingInvite(null); }
  };

  const handleDeleteBooking = async (bookingId) => {
    const result = await MySwal.fire({
      title: 'Delete Booking?',
      text:  'This action cannot be undone. The slot will be freed.',
      icon:  'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    setDeletingBooking(bookingId);
    try {
      await fetch(`${API_BASE_URL}/admin/demo/bookings/${bookingId}`, { method: 'DELETE', headers: authHeader() });
      fetchBookings(bookingsPage);
      fetchStats();
    } finally { setDeletingBooking(null); }
  };

  // ── Slot actions ───────────────────────────────────────────────────────────
  const handleAddSlot = async () => {
    if (!newSlotDate) { setAddSlotError('Please select a date'); return; }
    setAddingSlot(true);
    setAddSlotError(null);
    try {
      const start_time = new Date(`${newSlotDate}T${newSlotStart}:00+05:30`).toISOString();
      const end_time   = new Date(`${newSlotDate}T${newSlotEnd}:00+05:30`).toISOString();
      const res  = await fetch(`${API_BASE_URL}/admin/demo/slots`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_time, end_time }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddSlot(false);
        setNewSlotDate('');
        setNewSlotStart('10:00');
        setNewSlotEnd('11:00');
        fetchSlots();
        fetchStats();
      } else {
        setAddSlotError(json.error || 'Failed to add slot');
      }
    } catch (err) { setAddSlotError(err.message); }
    finally { setAddingSlot(false); }
  };

  const handleGenerateSlots = async () => {
    setGeneratingSlots(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/admin/demo/slots/generate`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: generateDays }),
      });
      const json = await res.json();
      if (json.success) {
        MySwal.fire({
          icon: 'success',
          title: 'Slots Generated!',
          html: `<b>${json.created}</b> new slots created.<br/>${json.skipped ? `${json.skipped} already existed.` : ''}`,
          timer: 3000, showConfirmButton: false,
        });
        fetchSlots();
        fetchStats();
      } else {
        MySwal.fire({ icon: 'error', title: 'Failed', text: json.error });
      }
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally { setGeneratingSlots(false); }
  };

  const handleDeleteSlot = async (slotId) => {
    const result = await MySwal.fire({
      title: 'Delete Slot?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    setDeletingSlot(slotId);
    try {
      const res  = await fetch(`${API_BASE_URL}/admin/demo/slots/${slotId}`, { method: 'DELETE', headers: authHeader() });
      const json = await res.json();
      if (!json.success) MySwal.fire({ icon: 'error', title: 'Error', text: json.error });
      fetchSlots();
      fetchStats();
    } finally { setDeletingSlot(null); }
  };

  // ── CSV download ───────────────────────────────────────────────────────────
  const downloadCSV = () => {
    const rows = [
      ['#', 'Name', 'Email', 'Company', 'Scheduled At (IST)', 'Status', 'Notes', 'Created At'],
      ...bookings.map((b, i) => [
        i + 1, b.name, b.email, b.company || '',
        fmtDateTime(b.scheduled_at), b.status, `"${(b.notes || '').replace(/"/g, '""')}"`,
        fmtDateTime(b.created_at),
      ]),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `demo-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const totalPages = Math.ceil(bookingsTotal / BOOKINGS_PER_PAGE);

  // ── Hour options for slot picker ───────────────────────────────────────────
  const HOURS = Array.from({ length: 8 }, (_, i) => {
    const h = String(10 + i).padStart(2, '0');
    return { value: `${h}:00`, label: `${h}:00` };
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-7 h-7 text-indigo-600" />
            Demo Booking Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage product demo sessions, slots, and email invites</p>
        </div>
        <button
          onClick={() => { fetchStats(); activeTab === 'bookings' ? fetchBookings(bookingsPage) : fetchSlots(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${statsLoading || bookingsLoading || slotsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Bookings"  value={stats.bookings.total}     icon={Users}         color="bg-indigo-500" />
          <StatCard label="Pending"         value={stats.bookings.pending}   icon={Clock}         color="bg-amber-500" />
          <StatCard label="Confirmed"       value={stats.bookings.confirmed} icon={CheckCircle}   color="bg-blue-500" />
          <StatCard label="Completed"       value={stats.bookings.completed} icon={Zap}           color="bg-emerald-500" />
          <StatCard label="Cancelled"       value={stats.bookings.cancelled} icon={XCircle}       color="bg-red-500" />
          <StatCard label="Available Slots" value={stats.slots?.available}   icon={CalendarCheck} color="bg-violet-500"
            sub={`${stats.slots?.total ?? 0} total`} />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {[
            { key: 'bookings', label: 'Demo Bookings',  icon: Users },
            { key: 'slots',    label: 'Slot Management', icon: Calendar },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ══════════════════════════ BOOKINGS TAB ═══════════════════════════════ */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Status filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'all',       label: 'All' },
                { value: 'pending',   label: 'Pending' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ].map(b => (
                <button
                  key={b.value}
                  onClick={() => { setStatusFilter(b.value); setBookingsPage(1); }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    statusFilter === b.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, email, company…"
                  value={bookingSearch}
                  onChange={e => setBookingSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchBookings(1)}
                  className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-56"
                />
              </div>
              <button
                onClick={() => fetchBookings(1)}
                disabled={bookingsLoading}
                className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${bookingsLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={downloadCSV}
                disabled={bookings.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-40"
              >
                <FileUp className="w-4 h-4" /> Download CSV
              </button>
            </div>
          </div>

          {/* Error */}
          {bookingsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {bookingsError}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {bookingsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="py-16 text-center">
                <CalendarCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">No demo bookings found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#', 'Name & Email', 'Company', 'Scheduled At (IST)', 'Status', 'Update Status', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bookings.map((b, i) => (
                      <React.Fragment key={b.id}>
                        <tr className="hover:bg-indigo-50/30 transition-colors group">
                          <td className="px-5 py-3.5 text-sm text-gray-400">
                            {(bookingsPage - 1) * BOOKINGS_PER_PAGE + i + 1}
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-gray-900">{b.name}</p>
                            <p className="text-sm text-gray-500">{b.email}</p>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-600">
                            {b.company || <span className="text-gray-300 italic">—</span>}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <p className="text-sm font-medium text-gray-800">{fmtDate(b.start_time || b.scheduled_at)}</p>
                            <p className="text-sm text-gray-500">
                              {b.start_time
                                ? `${fmtTime(b.start_time)} – ${fmtTime(b.end_time)}`
                                : fmtTime(b.scheduled_at)} IST
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="relative inline-block">
                              <select
                                value={b.status}
                                disabled={updatingStatus === b.id}
                                onChange={e => handleStatusUpdate(b.id, e.target.value)}
                                className="pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                              >
                                {['pending', 'confirmed', 'cancelled', 'completed'].map(s => (
                                  <option key={s} value={s}>{STATUS_CFG[s]?.label}</option>
                                ))}
                              </select>
                              {updatingStatus === b.id
                                ? <RefreshCw className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-500 animate-spin" />
                                : <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                              }
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              {/* Expand */}
                              <button
                                onClick={() => setExpandedBooking(expandedBooking === b.id ? null : b.id)}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition"
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {/* Send Invite */}
                              <button
                                onClick={() => handleSendInvite(b)}
                                disabled={sendingInvite === b.id}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-indigo-50 hover:text-indigo-700 transition disabled:opacity-50"
                                title="Send invite email"
                              >
                                {sendingInvite === b.id
                                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                                  : <Mail className="w-4 h-4" />}
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteBooking(b.id)}
                                disabled={deletingBooking === b.id}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                                title="Delete booking"
                              >
                                {deletingBooking === b.id
                                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {expandedBooking === b.id && (
                          <tr>
                            <td colSpan={7} className="bg-indigo-50/40 px-8 py-4 border-t border-indigo-100">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Booking ID</p>
                                  <p className="font-mono text-gray-700">#{b.id}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Slot ID</p>
                                  <p className="text-gray-700">{b.slot_id || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Created</p>
                                  <p className="text-gray-700">{fmtDateTime(b.created_at)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Last Updated</p>
                                  <p className="text-gray-700">{fmtDateTime(b.updated_at)}</p>
                                </div>
                                {b.notes && (
                                  <div className="col-span-2 sm:col-span-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p>
                                    <p className="text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">{b.notes}</p>
                                  </div>
                                )}
                                <div className="col-span-2 sm:col-span-4 flex gap-3 pt-1">
                                  <button
                                    onClick={() => handleSendInvite(b)}
                                    disabled={sendingInvite === b.id}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                                  >
                                    <Send className="w-4 h-4" />
                                    {sendingInvite === b.id ? 'Sending…' : 'Send Invite Email'}
                                  </button>
                                  <button
                                    onClick={() => setExpandedBooking(null)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-white transition"
                                  >
                                    <X className="w-4 h-4" /> Close
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!bookingsLoading && bookingsTotal > BOOKINGS_PER_PAGE && (
              <div className="px-5 py-3.5 flex items-center justify-between border-t border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-500">
                  {(bookingsPage - 1) * BOOKINGS_PER_PAGE + 1}–{Math.min(bookingsPage * BOOKINGS_PER_PAGE, bookingsTotal)} of {bookingsTotal}
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => fetchBookings(bookingsPage - 1)}
                    disabled={bookingsPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-500">{bookingsPage} / {totalPages}</span>
                  <button
                    onClick={() => fetchBookings(bookingsPage + 1)}
                    disabled={bookingsPage >= totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-40"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════ SLOTS TAB ════════════════════════════════ */}
      {activeTab === 'slots' && (
        <div className="space-y-4">

          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Generate default slots */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Generate Default Slots</p>
                  <p className="text-xs text-gray-500">Mon–Fri, 10 AM – 5 PM IST (hourly)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Working days:</label>
                  <input
                    type="number" min={1} max={30} value={generateDays}
                    onChange={e => setGenerateDays(parseInt(e.target.value) || 7)}
                    className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleGenerateSlots}
                  disabled={generatingSlots}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {generatingSlots
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <CalendarCheck className="w-4 h-4" />}
                  Generate
                </button>
              </div>
            </div>

            {/* Add custom slot */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Plus className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Add Custom Slot</p>
                    <p className="text-xs text-gray-500">Add a specific date & time (IST)</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowAddSlot(v => !v); setAddSlotError(null); }}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  {showAddSlot ? 'Cancel' : 'Add Slot'}
                </button>
              </div>

              {showAddSlot && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Date (IST)</label>
                      <input
                        type="date"
                        value={newSlotDate}
                        onChange={e => setNewSlotDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 10)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Start (IST)</label>
                      <select
                        value={newSlotStart}
                        onChange={e => setNewSlotStart(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      >
                        {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">End (IST)</label>
                      <select
                        value={newSlotEnd}
                        onChange={e => setNewSlotEnd(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      >
                        {HOURS.slice(1).map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                        <option value="17:00">17:00</option>
                      </select>
                    </div>
                  </div>
                  {addSlotError && (
                    <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{addSlotError}</p>
                  )}
                  <button
                    onClick={handleAddSlot}
                    disabled={addingSlot}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {addingSlot ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {addingSlot ? 'Adding…' : 'Add Slot'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Slot filter + error */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5">
              {[
                { value: 'all',       label: 'All Slots' },
                { value: 'available', label: 'Available' },
                { value: 'booked',    label: 'Booked' },
              ].map(b => (
                <button
                  key={b.value}
                  onClick={() => setSlotsFilter(b.value)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    slotsFilter === b.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">{slotsTotal} slots</p>
          </div>

          {slotsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {slotsError}
            </div>
          )}

          {/* Slots table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {slotsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
              </div>
            ) : slots.length === 0 ? (
              <div className="py-16 text-center">
                <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">No slots found</p>
                <p className="text-xs text-gray-400 mt-1">Generate default slots or add a custom one above</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#', 'Date (IST)', 'Time (IST)', 'Duration', 'Status', 'Booked By', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-sm font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {slots.map((s, i) => {
                      const durationMin = s.end_time
                        ? Math.round((new Date(s.end_time) - new Date(s.start_time)) / 60000)
                        : null;
                      return (
                        <tr key={s.id} className={`hover:bg-gray-50/60 transition-colors ${s.is_booked ? 'bg-blue-50/20' : ''}`}>
                          <td className="px-5 py-3.5 text-sm text-gray-400">{i + 1}</td>
                          <td className="px-5 py-3.5 font-medium text-gray-800 whitespace-nowrap">
                            {fmtDate(s.start_time)}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                            {fmtTime(s.start_time)} – {fmtTime(s.end_time)} IST
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-500">
                            {durationMin ? `${durationMin} min` : '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            {s.is_booked ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-100 text-blue-800 border-blue-200">
                                <CheckCircle className="w-3 h-3" /> Booked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200">
                                <CalendarCheck className="w-3 h-3" /> Available
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {s.is_booked && s.booked_by_name ? (
                              <div>
                                <p className="font-medium text-gray-800">{s.booked_by_name}</p>
                                <p className="text-xs text-gray-500">{s.booked_by_email}</p>
                              </div>
                            ) : (
                              <span className="text-gray-300 italic text-sm">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {!s.is_booked && (
                              <button
                                onClick={() => handleDeleteSlot(s.id)}
                                disabled={deletingSlot === s.id}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                                title="Delete slot"
                              >
                                {deletingSlot === s.id
                                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoManagement;
