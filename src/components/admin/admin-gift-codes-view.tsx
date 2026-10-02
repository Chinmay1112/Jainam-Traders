'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Gift,
  Search,
  Filter,
  Plus,
  Play,
  Pause,
  Ban,
  Clock,
  CheckCircle2,
  X,
  History,
  Copy,
} from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { StaffRole } from '@/lib/auth/staff-roles';
import { GiftCode, GiftCodeRedemption, GiftCodeStatus } from '@/lib/types';

interface AdminGiftCodesViewProps {
  staffRole: StaffRole;
  staffName: string;
}

export default function AdminGiftCodesView({ staffRole, staffName }: AdminGiftCodesViewProps) {
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GiftCodeStatus | ''>('');

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createValue, setCreateValue] = useState(500);
  const [createCustomerId, setCreateCustomerId] = useState('');
  const [createCustomerEmail, setCreateCustomerEmail] = useState('');
  const [createCustomerName, setCreateCustomerName] = useState('');
  const [createMaxUses, setCreateMaxUses] = useState(1);
  const [createExpiresAt, setCreateExpiresAt] = useState('');
  const [createMinOrder, setCreateMinOrder] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Audit History Modal State
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<GiftCodeRedemption[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchGiftCodes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));

      const res = await fetch(`/api/gift-codes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGiftCodes(data.giftCodes || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchGiftCodes();
  }, [fetchGiftCodes]);

  const handleCreateGiftCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');

    try {
      const res = await fetch('/api/gift-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: createCode.trim().toUpperCase(),
          originalValue: Number(createValue),
          customerId: createCustomerId.trim() || undefined,
          customerEmail: createCustomerEmail.trim() || undefined,
          customerName: createCustomerName.trim() || undefined,
          maxRedemptions: Number(createMaxUses) || 1,
          expiresAt: createExpiresAt || undefined,
          minOrderValue: createMinOrder ? Number(createMinOrder) : undefined,
          notes: createNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create gift code.');
        return;
      }

      setSuccessBanner(
        `Gift Code ${data.rawCode || data.giftCode.code} (Value ₹${data.giftCode.originalValue}) created successfully! Note: Copy this code now. For security, raw codes are never stored or displayed again; only masked codes are kept.`
      );
      setShowCreateModal(false);
      setCreateCode('');
      setCreateValue(500);
      setCreateCustomerId('');
      setCreateCustomerEmail('');
      setCreateCustomerName('');
      setCreateNotes('');
      fetchGiftCodes();
    } catch {
      setCreateError('Network error while creating gift code.');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: GiftCodeStatus) => {
    try {
      const res = await fetch(`/api/gift-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchGiftCodes();
      }
    } catch {}
  };

  const openAuditHistory = async (id: string) => {
    setSelectedGiftId(id);
    setLoadingAudit(true);
    setRedemptions([]);

    try {
      const res = await fetch(`/api/gift-codes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRedemptions(data.redemptions || []);
      }
    } catch {
    } finally {
      setLoadingAudit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Gift className="w-6 h-6 text-brand-600" />
            <span>Gift Codes & Stored Value Redemption</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Create customer-assigned or shop-wide redemption vouchers with remaining balance tracking.
          </p>
        </div>

        {(staffRole === 'owner' || staffRole === 'store_manager') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 active-press transition-all"
          >
            <Plus className="w-4 h-4" /> Issue New Gift Code
          </button>
        )}
      </div>

      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner('')} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by code, assigned customer, or notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as GiftCodeStatus | '');
              setPage(1);
            }}
            className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="REDEEMED">REDEEMED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Gift Codes Table (Part 30) */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Mobile Card List View (< md) */}
        <div className="md:hidden divide-y divide-stone-100">
          {loading ? (
            <div className="p-6 text-center text-stone-400 text-xs">Loading gift codes...</div>
          ) : giftCodes.length === 0 ? (
            <div className="p-6 text-center text-stone-500 text-xs space-y-1">
              <p className="font-bold">No gift codes found</p>
              <p className="text-[11px] text-stone-400">
                {search || statusFilter ? 'Try clearing your search or status filter.' : 'Click "Issue New Gift Code" to create custom store redemption vouchers.'}
              </p>
            </div>
          ) : (
            giftCodes.map((g) => (
              <div key={`m-${g.id}`} className="p-4 space-y-3 bg-white hover:bg-stone-50/80 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-black text-stone-900 tracking-wider text-sm">
                      {g.maskedCode || g.code}
                    </div>
                    {g.notes && <div className="text-[11px] text-stone-500">{g.notes}</div>}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                      g.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : g.status === 'PAUSED'
                        ? 'bg-amber-100 text-amber-900'
                        : g.status === 'REDEEMED'
                        ? 'bg-stone-200 text-stone-600'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {g.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Remaining</span>
                    <span className="font-black text-brand-700 text-sm">{formatINR(g.remainingValue)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Original</span>
                    <span className="font-bold text-stone-800">{formatINR(g.originalValue)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Redemptions</span>
                    <span className="font-medium text-stone-800">{g.redemptionCount} / {g.maxRedemptions}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold block">Assigned To</span>
                    <span className="font-medium text-stone-800 truncate block">
                      {g.customerName || g.customerEmail || 'Shop-wide'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 gap-2">
                  <button
                    type="button"
                    onClick={() => openAuditHistory(g.id)}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors active-press"
                  >
                    <History className="w-4 h-4 text-stone-600" />
                    <span>Redemption Ledger</span>
                  </button>

                  {(staffRole === 'owner' || staffRole === 'store_manager') && (
                    <div className="flex items-center gap-1">
                      {g.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(g.id, 'PAUSED')}
                          title="Pause Code"
                          className="p-2 rounded-xl text-amber-600 hover:bg-amber-50 border border-amber-200 transition-colors"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : g.status === 'PAUSED' ? (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(g.id, 'ACTIVE')}
                          title="Resume Code"
                          className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      ) : null}

                      {g.status !== 'CANCELLED' && g.status !== 'REDEEMED' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(g.id, 'CANCELLED')}
                          title="Cancel Code"
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Original Value</th>
                <th className="py-3.5 px-4">Remaining Balance</th>
                <th className="py-3.5 px-4">Assigned Customer</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Redemptions</th>
                <th className="py-3.5 px-4">Expiry</th>
                <th className="py-3.5 px-4">Created By</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-400">
                    Loading gift codes...
                  </td>
                </tr>
              ) : giftCodes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-500 space-y-1">
                    <p className="font-bold">No gift codes found</p>
                    <p className="text-[11px] text-stone-400">
                      {search || statusFilter ? 'Try clearing your search or status filter.' : 'Click "Issue New Gift Code" to create custom store redemption vouchers.'}
                    </p>
                  </td>
                </tr>
              ) : (
                giftCodes.map((g) => (
                  <tr key={g.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-black text-stone-900 tracking-wider text-sm">{g.maskedCode || g.code}</div>
                      {g.notes && <div className="text-[10px] text-stone-400 truncate max-w-[150px]">{g.notes}</div>}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-stone-900">{formatINR(g.originalValue)}</td>
                    <td className="py-3.5 px-4 font-black text-brand-700">{formatINR(g.remainingValue)}</td>
                    <td className="py-3.5 px-4">
                      {g.customerName || g.customerEmail ? (
                        <div>
                          <div className="font-bold text-stone-900">{g.customerName || 'Customer'}</div>
                          <div className="text-[10px] text-stone-400">{g.customerEmail}</div>
                        </div>
                      ) : (
                        <span className="text-stone-400 italic">Shop-wide (Anyone)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          g.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : g.status === 'PAUSED'
                            ? 'bg-amber-100 text-amber-900'
                            : g.status === 'REDEEMED'
                            ? 'bg-stone-200 text-stone-600'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-700">
                      {g.redemptionCount} / {g.maxRedemptions}
                    </td>
                    <td className="py-3.5 px-4 text-stone-500">
                      {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : 'No expiry'}
                    </td>
                    <td className="py-3.5 px-4 text-stone-500 text-[11px]">{g.createdByName}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openAuditHistory(g.id)}
                          title="View Redemption History"
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        {(staffRole === 'owner' || staffRole === 'store_manager') && (
                          <>
                            {g.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleStatusChange(g.id, 'PAUSED')}
                                title="Pause Code"
                                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            ) : g.status === 'PAUSED' ? (
                              <button
                                onClick={() => handleStatusChange(g.id, 'ACTIVE')}
                                title="Resume Code"
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            ) : null}

                            {g.status !== 'CANCELLED' && g.status !== 'REDEEMED' && (
                              <button
                                onClick={() => handleStatusChange(g.id, 'CANCELLED')}
                                title="Cancel Code"
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <div>
            Showing {giftCodes.length} of {total} gift code{total === 1 ? '' : 's'}
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

      {/* Create Gift Code Modal (Part 21) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <Gift className="w-5 h-5 text-brand-600" />
                <span>Issue Custom Gift Code</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateGiftCode} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">
                  Gift Code (Letters & Numbers)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. JAINAM500"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl uppercase font-mono font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const randomSuffix = Math.floor(100 + Math.random() * 900);
                      setCreateCode(`JT${createValue || 500}-${randomSuffix}`);
                    }}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">
                  Redemption Monetary Value (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={createValue}
                  onChange={(e) => setCreateValue(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 uppercase mb-1">
                    Max Redemptions
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={createMaxUses}
                    onChange={(e) => setCreateMaxUses(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 uppercase mb-1">
                    Min Order Subtotal (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Optional"
                    value={createMinOrder}
                    onChange={(e) => setCreateMinOrder(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={createExpiresAt}
                  onChange={(e) => setCreateExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 border-t border-stone-100">
                <label className="block font-bold text-stone-700 uppercase mb-1">
                  Assign To Specific Customer (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Customer ID or registered email (Leave blank for shop-wide)"
                  value={createCustomerEmail}
                  onChange={(e) => setCreateCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">
                  Internal Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival gift voucher, Diwali campaign"
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 text-white rounded-xl font-bold shadow-md shadow-brand-500/20 active-press transition-all"
                >
                  {creating ? 'Creating...' : 'Create & Activate Gift Code'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redemption Audit Modal (Part 28) */}
      {selectedGiftId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                <span>Gift Code Redemption Audit Trail</span>
              </h3>
              <button
                onClick={() => setSelectedGiftId(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingAudit ? (
              <p className="text-xs text-stone-400 py-6 text-center">Loading audit history...</p>
            ) : redemptions.length === 0 ? (
              <p className="text-xs text-stone-500 py-6 text-center">
                This gift code has not been redeemed on any order yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {redemptions.map((r) => (
                  <div key={r.id} className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900">
                        {r.action === 'REDEEMED' ? 'Deducted on Order' : 'Restored'} {r.orderNumber}
                      </span>
                      <span
                        className={`font-black ${
                          r.action === 'REDEEMED' ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {r.action === 'REDEEMED' ? `- ${formatINR(r.amountApplied)}` : `+ ${formatINR(r.amountApplied)}`}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-500 flex justify-between">
                      <span>Balance: {formatINR(r.previousRemainingValue)} → {formatINR(r.newRemainingValue)}</span>
                      <span>{new Date(r.timestamp).toLocaleString()}</span>
                    </div>
                    {r.reason && (
                      <p className="text-[10px] text-stone-400 italic pt-0.5">{r.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
