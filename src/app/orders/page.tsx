'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight, Search, Clock, QrCode } from 'lucide-react';
import { Order } from '@/lib/types';
import { useAuth } from '@/lib/context/auth-context';
import { formatINR, formatDate } from '@/lib/utils';
import { getStatusBadgeInfo } from '@/lib/orders/state-machine';

export default function CustomerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchOrderNumber, setSearchOrderNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const url = user ? `/api/orders?customerId=${user.id}` : '/api/orders';
        const res = await fetch(url);
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (err) {
        console.error('Failed to load orders', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [user]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchOrderNumber.trim()) {
      window.location.href = `/orders/${searchOrderNumber.trim().toUpperCase()}`;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight">
            My Pickup Orders
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Track preparation progress, view digital counter QR passes, and inspect order details.
          </p>
        </div>

        {/* Quick order ID lookup for guests */}
        <form onSubmit={handleLookup} className="flex gap-2">
          <input
            type="text"
            placeholder="Search Order (e.g. JT-2026-...)"
            value={searchOrderNumber}
            onChange={(e) => setSearchOrderNumber(e.target.value)}
            className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold"
          >
            Track
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-stone-500">Loading your orders...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-stone-900">No pickup orders yet</h2>
          <p className="text-xs text-stone-500 mt-1 mb-6">
            You haven&apos;t reserved any products yet. Browse our collection and reserve items with zero advance payment!
          </p>
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 active-press"
          >
            <span>Explore Products</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => {
            const badge = getStatusBadgeInfo(ord.status);
            return (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-elevated transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                      {ord.orderNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.bgClass} ${badge.textClass}`}>
                      {badge.label}
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 font-medium">
                    {ord.items.length} {ord.items.length === 1 ? 'item' : 'items'} •{' '}
                    <span className="font-bold text-stone-900">{formatINR(ord.totalAmount)}</span>
                    <span className="text-amber-800 text-[11px] ml-1.5 font-medium">(Pay at Shop)</span>
                  </p>

                  <p className="text-[11px] text-stone-400">
                    Placed on {formatDate(ord.createdAt)} • Pickup Mode: {ord.pickupMode}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <Link
                    href={`/orders/${ord.orderNumber}`}
                    className="flex-1 sm:flex-none px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active-press transition-colors shadow-sm"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View Pass & Status</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
