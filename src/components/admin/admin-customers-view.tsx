'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  Eye,
  Phone,
  Mail,
  MessageSquare,
  Clock,
  ShoppingBag,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  X,
  FileText,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { StaffRole } from '@/lib/auth/staff-roles';
import { CustomerAccountStatus, CustomerActivityEvent, CustomerCrmSummary, CustomerProfile, CustomerStaffNote, Order } from '@/lib/types';
import { CustomerListItem } from '@/lib/crm/crm-service';

interface AdminCustomersViewProps {
  staffRole: StaffRole;
  staffName: string;
}

export default function AdminCustomersView({ staffRole, staffName }: AdminCustomersViewProps) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerAccountStatus | ''>('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'spend' | 'orders'>('date');

  // Selected customer for detail drawer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<{
    profile: CustomerProfile;
    summary: CustomerCrmSummary;
    orders: Order[];
    timeline: CustomerActivityEvent[];
    staffNotes?: CustomerStaffNote[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Staff note form
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusChangeSuccess, setStatusChangeSuccess] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('sortBy', sortBy);

      const res = await fetch(`/api/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, sortBy]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const openCustomerDetail = async (id: string) => {
    setSelectedCustomerId(id);
    setLoadingDetail(true);
    setCustomerDetail(null);
    setStatusChangeSuccess('');

    try {
      const res = await fetch(`/api/customers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerDetail(data);
      }
    } catch {
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedCustomerId) return;
    setSavingNote(true);

    try {
      const res = await fetch(`/api/customers/${selectedCustomerId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (customerDetail && data.note) {
          setCustomerDetail({
            ...customerDetail,
            staffNotes: [data.note, ...(customerDetail.staffNotes || [])],
          });
        }
        setNewNote('');
      }
    } catch {
    } finally {
      setSavingNote(false);
    }
  };

  const handleStatusChange = async (newStatus: CustomerAccountStatus) => {
    if (!selectedCustomerId) return;
    setUpdatingStatus(true);
    setStatusChangeSuccess('');

    try {
      const res = await fetch(`/api/customers/${selectedCustomerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountStatus: newStatus,
          reason: `Status changed by ${staffName} (${staffRole})`,
        }),
      });

      if (res.ok) {
        setStatusChangeSuccess(`Account status updated to ${newStatus}`);
        if (customerDetail) {
          setCustomerDetail({
            ...customerDetail,
            profile: { ...customerDetail.profile, accountStatus: newStatus },
          });
        }
        fetchCustomers();
      }
    } catch {
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600" />
            <span>Customer Relationship Management (CRM)</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Authoritative customer records, order histories, internal staff notes, and account security.
          </p>
        </div>

        {staffRole === 'owner' && (
          <a
            href="/api/admin/customers/export"
            download
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-sm transition-all"
          >
            <Download className="w-4 h-4" /> Export Customers (CSV)
          </a>
        )}
      </div>

      {/* Filter and Search Bar (Parts 6 & 42) */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or customer ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as CustomerAccountStatus | '');
                setPage(1);
              }}
              className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
            </select>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'spend' | 'orders')}
            className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none"
          >
            <option value="date">Sort by: Registered Date</option>
            <option value="spend">Sort by: Total Spend</option>
            <option value="orders">Sort by: Order Count</option>
            <option value="name">Sort by: Customer Name</option>
          </select>
        </div>
      </div>

      {/* Customer Table (Part 6) */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Mobile Card List View (< md) */}
        <div className="md:hidden divide-y divide-stone-100">
          {loading ? (
            <div className="p-6 text-center text-stone-400 text-xs">Loading customer records...</div>
          ) : customers.length === 0 ? (
            <div className="p-6 text-center text-stone-500 text-xs space-y-1">
              <p className="font-bold">No customers found</p>
              <p className="text-[11px] text-stone-400">
                {search || statusFilter ? 'Try clearing your search or filter.' : 'Customers will appear here.'}
              </p>
            </div>
          ) : (
            customers.map((c) => (
              <div key={`m-${c.id}`} className="p-4 space-y-3 bg-white hover:bg-stone-50/80 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-stone-900 text-sm">{c.fullName}</div>
                    <div className="text-[10px] text-stone-400 font-mono">{c.id}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                      c.accountStatus === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.accountStatus === 'SUSPENDED'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {c.accountStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Phone</span>
                    <span className="font-medium text-stone-800">{c.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Total Spend</span>
                    <span className="font-bold text-stone-900">{formatINR(c.totalSpend)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Orders</span>
                    <span className="font-medium text-stone-800">{c.orderCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Registered</span>
                    <span className="text-stone-600">{new Date(c.registeredOn).toLocaleDateString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openCustomerDetail(c.id)}
                  className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors active-press"
                >
                  <Eye className="w-4 h-4 text-stone-600" />
                  <span>View Customer Details & Notes</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Orders</th>
                <th className="py-3.5 px-4">Total Spend</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Registered</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400">
                    Loading customer records...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-500 space-y-1">
                    <p className="font-bold">No customers found</p>
                    <p className="text-[11px] text-stone-400">
                      {search || statusFilter ? 'Try clearing your search or filter.' : 'Customers will appear here as they register or place pickup reservations.'}
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900">{c.fullName}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{c.id}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div>{c.phone || '—'}</div>
                      <div className="text-stone-400 text-[11px]">{c.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-stone-900">{c.orderCount}</td>
                    <td className="py-3.5 px-4 font-extrabold text-stone-900">
                      {formatINR(c.totalSpend)}
                    </td>
                    <td className="py-3.5 px-4 text-stone-500">
                      {new Date(c.lastActivityAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          c.accountStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.accountStatus === 'SUSPENDED'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {c.accountStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-500">
                      {new Date(c.registeredOn).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openCustomerDetail(c.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <div>
            Showing {customers.length} of {total} customer{total === 1 ? '' : 's'}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50 font-bold"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 font-bold text-stone-800">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-stone-200 disabled:opacity-40 hover:bg-stone-50 font-bold"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Customer Detail Modal / Drawer (Parts 7, 8, 9, 10, 37) */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
              <div>
                <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-600" />
                  <span>{customerDetail ? customerDetail.profile.fullName : 'Customer Profile'}</span>
                </h3>
                <p className="text-xs text-stone-500 font-mono mt-0.5">ID: {selectedCustomerId}</p>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-12 text-center text-stone-400">Loading customer details...</div>
            ) : !customerDetail ? (
              <div className="p-12 text-center text-stone-500">Customer details unavailable.</div>
            ) : (
              <div className="p-6 space-y-6 flex-1">
                {statusChangeSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{statusChangeSuccess}</span>
                  </div>
                )}

                {/* Status & Support Actions */}
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-600">Account Status:</span>
                    <select
                      value={customerDetail.profile.accountStatus}
                      disabled={updatingStatus}
                      onChange={(e) => handleStatusChange(e.target.value as CustomerAccountStatus)}
                      className="px-3 py-1 bg-white border border-stone-300 rounded-lg text-xs font-black uppercase text-stone-900 focus:outline-none"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                      <option value="DEACTIVATED">DEACTIVATED</option>
                    </select>
                  </div>

                  {/* Customer Direct Support Contact (Part 37) */}
                  <div className="flex items-center gap-2">
                    {customerDetail.profile.phone && (
                      <>
                        <a
                          href={`tel:${customerDetail.profile.phone}`}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                        >
                          <Phone className="w-3 h-3" /> Call
                        </a>
                        <a
                          href={`https://wa.me/91${customerDetail.profile.phone.replace(/\D/g, '').slice(-10)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                        >
                          <MessageSquare className="w-3 h-3" /> WhatsApp
                        </a>
                      </>
                    )}
                    {customerDetail.profile.email && (
                      <a
                        href={`mailto:${customerDetail.profile.email}`}
                        className="px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" /> Email
                      </a>
                    )}
                  </div>
                </div>

                {/* Financial & Activity Summary Metrics (Part 7) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Total Orders</span>
                    <span className="text-base font-black text-stone-900">{customerDetail.summary.totalOrders}</span>
                  </div>
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Pickups Completed</span>
                    <span className="text-base font-black text-emerald-700">{customerDetail.summary.completedPickups}</span>
                  </div>
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Cancelled Orders</span>
                    <span className="text-base font-black text-stone-500">{customerDetail.summary.cancelledOrders}</span>
                  </div>
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Total Value</span>
                    <span className="text-base font-black text-brand-700">{formatINR(customerDetail.summary.totalPurchaseValue)}</span>
                  </div>
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Refunded Amount</span>
                    <span className="text-base font-black text-rose-700">{formatINR(customerDetail.summary.totalRefunded)}</span>
                  </div>
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Gift Voucher Balance</span>
                    <span className="text-base font-black text-amber-700">{formatINR(customerDetail.summary.activeGiftCodeBalance)}</span>
                  </div>
                </div>

                {/* Personal Profile Info */}
                <div className="p-4 bg-white border border-stone-200 rounded-2xl space-y-2 text-xs">
                  <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-2">Profile Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-600">
                    <div>
                      <strong className="text-stone-900">Email:</strong> {customerDetail.profile.email}
                    </div>
                    <div>
                      <strong className="text-stone-900">Phone:</strong> {customerDetail.profile.phone || '—'}
                    </div>
                    <div>
                      <strong className="text-stone-900">Address:</strong> {customerDetail.profile.address || '—'}
                    </div>
                    <div>
                      <strong className="text-stone-900">Language:</strong> {customerDetail.profile.languagePreference === 'hi' ? 'हिंदी (Hindi)' : 'English'}
                    </div>
                    <div>
                      <strong className="text-stone-900">Registered Via:</strong> {customerDetail.profile.authenticationMethod}
                    </div>
                    <div>
                      <strong className="text-stone-900">Registered On:</strong> {new Date(customerDetail.profile.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Internal Staff Notes (Parts 9 & 10: Strictly Owner / Manager ONLY) */}
                {(staffRole === 'owner' || staffRole === 'store_manager') && (
                  <div className="p-5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-amber-700" />
                      <span>Internal Staff Notes (Confidential)</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      These notes are private and never displayed to customers or unauthorized counter personnel.
                    </p>

                    <form onSubmit={handleAddNote} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add internal note (e.g. customer prefers gift wrapping, called about clock)..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={savingNote || !newNote.trim()}
                        className="px-4 py-2 bg-amber-800 hover:bg-amber-900 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" /> Save Note
                      </button>
                    </form>

                    <div className="space-y-2 pt-2">
                      {customerDetail.staffNotes && customerDetail.staffNotes.length > 0 ? (
                        customerDetail.staffNotes.map((note) => (
                          <div key={note.id} className="p-3 bg-white border border-amber-200 rounded-xl space-y-1 text-xs">
                            <p className="text-stone-900 font-medium leading-relaxed">{note.note}</p>
                            <div className="text-[10px] text-stone-400 flex justify-between pt-1 border-t border-stone-100">
                              <span>By {note.authorName} ({note.authorRole})</span>
                              <span>{new Date(note.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-amber-800/70 italic">No internal staff notes recorded yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Customer Orders */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-brand-600" />
                    <span>Recent Orders ({customerDetail.orders.length})</span>
                  </h4>
                  {customerDetail.orders.length === 0 ? (
                    <p className="text-xs text-stone-400">No orders recorded for this customer.</p>
                  ) : (
                    <div className="space-y-2">
                      {customerDetail.orders.map((o) => (
                        <div key={o.id} className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-stone-900">{o.orderNumber}</div>
                            <div className="text-[10px] text-stone-500">
                              {o.items.length} item{o.items.length === 1 ? '' : 's'} • {new Date(o.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-stone-900">{formatINR(o.totalAmount)}</div>
                            <span className="text-[10px] font-bold text-stone-600 uppercase">{o.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity Timeline (Part 8) */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-stone-600" />
                    <span>Activity Timeline</span>
                  </h4>
                  {customerDetail.timeline.length === 0 ? (
                    <p className="text-xs text-stone-400">No recorded timeline events.</p>
                  ) : (
                    <div className="relative pl-6 space-y-4 border-l-2 border-stone-200 text-xs">
                      {customerDetail.timeline.map((evt) => (
                        <div key={evt.id} className="relative group">
                          <div className="w-2.5 h-2.5 rounded-full bg-brand-600 absolute -left-[31px] top-1 border-2 border-white" />
                          <div className="font-bold text-stone-900">{evt.description}</div>
                          <div className="text-[10px] text-stone-400">
                            {new Date(evt.createdAt).toLocaleString()} • {evt.actorRole}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
