'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Star,
  Settings,
  Shield,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  QrCode,
  Printer,
  X,
  Plus,
  RefreshCw,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Eye,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  Order,
  OrderStatus,
  Product,
  ShopSettings,
  Review,
  AuditLog,
  InventoryMovement,
  ReturnRequest,
  RefundRecord,
  UserRole,
} from '@/lib/types';
import { formatINR, formatDate } from '@/lib/utils';
import { getStatusBadgeInfo } from '@/lib/orders/state-machine';
import { useAuth } from '@/lib/context/auth-context';

export default function AdminDashboard() {
  const { user, role, loginAsStaffOrAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'inventory' | 'products' | 'reviews' | 'settings' | 'audit'>('overview');

  // State
  const [analytics, setAnalytics] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [refundRecords, setRefundRecords] = useState<RefundRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  // Search and filter
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [qrInput, setQrInput] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Modals
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockChangeQty, setStockChangeQty] = useState(1);
  const [stockReason, setStockReason] = useState<'restock' | 'damage' | 'missing' | 'manual_correction' | 'purchase'>('restock');
  const [stockNotes, setStockNotes] = useState('');

  // Refund record modal
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'upi' | 'manual'>('cash');
  const [refundReceiptNumber, setRefundReceiptNumber] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  // Add Product modal
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(499);
  const [newProdMrp, setNewProdMrp] = useState(799);
  const [newProdStock, setNewProdStock] = useState(10);
  const [newProdCategory, setNewProdCategory] = useState('b0000000-0000-0000-0000-000000000001');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdImage, setNewProdImage] = useState('https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80');

  const [loading, setLoading] = useState(true);
  const [bannerNotice, setBannerNotice] = useState('');

  // Fetch all admin data
  const refreshData = async () => {
    setLoading(true);
    try {
      const [ordRes, prodRes, setRes, revRes, retRes, refRes] = await Promise.all([
        fetch('/api/orders').then((r) => r.json()),
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
        fetch('/api/reviews?admin=true').then((r) => r.json()),
        fetch('/api/returns').then((r) => r.json()),
        fetch('/api/refunds').then((r) => r.json()),
      ]);

      setOrders(ordRes.orders || []);
      setProducts(prodRes.products || []);
      setSettings(setRes);
      setReviews(revRes.reviews || []);
      setReturnRequests(retRes.requests || []);
      setRefundRecords(refRes.refunds || []);

      // Calculate overview analytics
      const todayStr = new Date().toISOString().split('T')[0];
      const allOrd = ordRes.orders || [];
      const todaysOrders = allOrd.filter((o: Order) => o.createdAt.startsWith(todayStr));
      const pickedUp = allOrd.filter((o: Order) => o.status === 'PICKED_UP');
      const sales = pickedUp.reduce((acc: number, o: Order) => acc + o.totalAmount, 0);

      setAnalytics({
        totalOrders: allOrd.length,
        todaysOrders: todaysOrders.length,
        pending: allOrd.filter((o: Order) => o.status === 'PENDING').length,
        ready: allOrd.filter((o: Order) => o.status === 'READY_FOR_PICKUP').length,
        pickedUp: pickedUp.length,
        totalSales: sales,
      });
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Quick QR or Order ID Scanner lookup
  const handleQrLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) return;
    const clean = qrInput.trim().toUpperCase();
    const found = orders.find(
      (o) => o.orderNumber === clean || o.qrToken === clean || o.id === clean
    );
    if (found) {
      setSelectedOrder(found);
      setActiveTab('orders');
      setBannerNotice(`Loaded Order ${found.orderNumber} for counter pickup verification`);
    } else {
      setBannerNotice(`Order "${clean}" not found. Verify Order ID or QR token.`);
    }
    setQrInput('');
  };

  // State machine transition helper
  const handleTransition = async (orderId: string, nextStatus: OrderStatus, note?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          actorRole: role,
          actorId: user?.id || 'admin',
          note: note || `Admin moved status to ${nextStatus}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transition failed');

      setBannerNotice(`Order ${data.orderNumber} successfully updated to ${nextStatus}`);
      setSelectedOrder(data);
      refreshData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Transition error');
    }
  };

  // Handle stock adjustment
  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;
    try {
      const newStock = Math.max(0, stockProduct.stockQuantity + stockChangeQty);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...stockProduct,
          stockQuantity: newStock,
        }),
      });
      if (res.ok) {
        setBannerNotice(`Stock adjusted for ${stockProduct.name}. New total: ${newStock}`);
        setIsAdjustStockModalOpen(false);
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle record refund
  const handleRecordRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          refundAmount,
          refundMethod,
          receiptNumber: refundReceiptNumber || `REF-${Date.now()}`,
          notes: refundNotes,
          staffId: user?.id || 'staff-1',
          staffName: user?.fullName || 'Counter Staff',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBannerNotice(`Physical refund of ${formatINR(refundAmount)} recorded under receipt ${data.receiptNumber}`);
        setIsRefundModalOpen(false);
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    const matchStatus = orderStatusFilter === 'ALL' || o.status === orderStatusFilter;
    const matchQuery =
      !orderSearch ||
      o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerPhone.includes(orderSearch);
    return matchStatus && matchQuery;
  });

  return (
    <div className="space-y-6">
      {/* Top Admin Header */}
      <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-elevated">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                STORE MANAGEMENT CONSOLE
              </span>
              <span className="text-xs text-stone-400">• Logged as: <strong className="text-amber-400 capitalize">{role}</strong></span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
              Jainam Traders Admin Portal
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              Pickup verification, inventory reservation, order state machine, returns & store configuration.
            </p>
          </div>

          {/* Quick Counter QR / Order ID Scanner */}
          <form onSubmit={handleQrLookup} className="flex gap-2 bg-stone-800/90 p-2 rounded-2xl border border-stone-700/80">
            <div className="relative">
              <QrCode className="w-4 h-4 text-amber-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Scan QR or Enter Order ID..."
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-stone-950 font-bold text-xs rounded-xl transition-colors shrink-0"
            >
              Verify
            </button>
          </form>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-6 mt-4 border-t border-stone-800 text-xs font-bold no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'overview' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Overview
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'orders' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'inventory' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" /> Stock & Reservations
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'products' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" /> Products ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'reviews' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Star className="w-4 h-4" /> Reviews ({reviews.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'settings' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" /> Shop Settings
          </button>
        </div>
      </div>

      {bannerNotice && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 font-bold flex items-center justify-between">
          <span>{bannerNotice}</span>
          <button onClick={() => setBannerNotice('')} className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm">
              <span className="text-xs font-bold text-stone-500 uppercase">Today's Orders</span>
              <p className="text-2xl font-black text-stone-900 mt-1">{analytics.todaysOrders}</p>
            </div>
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
              <span className="text-xs font-bold text-amber-800 uppercase">Pending Review</span>
              <p className="text-2xl font-black text-amber-900 mt-1">{analytics.pending}</p>
            </div>
            <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 shadow-sm">
              <span className="text-xs font-bold text-blue-800 uppercase">Ready at Counter</span>
              <p className="text-2xl font-black text-blue-900 mt-1">{analytics.ready}</p>
            </div>
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
              <span className="text-xs font-bold text-emerald-800 uppercase">Picked Up & Paid</span>
              <p className="text-2xl font-black text-emerald-900 mt-1">{analytics.pickedUp}</p>
            </div>
            <div className="p-5 rounded-2xl bg-purple-50 border border-purple-200 shadow-sm">
              <span className="text-xs font-bold text-purple-800 uppercase">Return Requests</span>
              <p className="text-2xl font-black text-purple-900 mt-1">{returnRequests.length}</p>
            </div>
            <div className="p-5 rounded-2xl bg-stone-900 text-white shadow-sm">
              <span className="text-xs font-bold text-stone-400 uppercase">Counter Revenue</span>
              <p className="text-xl font-black text-amber-400 mt-1">{formatINR(analytics.totalSales)}</p>
            </div>
          </div>

          {/* Quick Counter Operations Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-600" /> Counter Pickup Workflow (Step-by-Step)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="font-extrabold text-brand-600">STEP 1: Verify</span>
                <p className="text-stone-600 mt-1">Scan customer QR or enter Order ID in the top bar.</p>
              </div>
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="font-extrabold text-brand-600">STEP 2: Inspect</span>
                <p className="text-stone-600 mt-1">Present order box to customer for inspection and testing.</p>
              </div>
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="font-extrabold text-brand-600">STEP 3: Collect Payment</span>
                <p className="text-stone-600 mt-1">Collect Cash or UPI payment at register.</p>
              </div>
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="font-extrabold text-brand-600">STEP 4: Mark Picked Up</span>
                <p className="text-stone-600 mt-1">Deducts stock permanently and generates print receipt.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORDER MANAGEMENT & STATE MACHINE */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Order Details Modal / Inspection Panel if selected */}
          {selectedOrder && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-brand-500/40 shadow-elevated space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-brand-700 bg-brand-50 px-3 py-1 rounded-lg border border-brand-200">
                      {selectedOrder.orderNumber}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                      Status: {selectedOrder.status}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900">
                      Payment: {selectedOrder.paymentStatus}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Customer: <strong className="text-stone-900">{selectedOrder.customerName}</strong> • Phone:{' '}
                    <strong className="text-stone-900">{selectedOrder.customerPhone}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" /> Print Receipt
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 text-stone-400 hover:text-stone-700 rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* State Machine Transition Actions */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
                  Valid State Machine Transitions:
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleTransition(selectedOrder.id, 'CONFIRMED')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow"
                      >
                        Confirm Order
                      </button>
                      <button
                        onClick={() => handleTransition(selectedOrder.id, 'CANCELLED')}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
                      >
                        Cancel Order & Release Stock
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'CONFIRMED' && (
                    <>
                      <button
                        onClick={() => handleTransition(selectedOrder.id, 'PREPARING')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow"
                      >
                        Start Packing (Preparing)
                      </button>
                      <button
                        onClick={() => handleTransition(selectedOrder.id, 'CANCELLED')}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'PREPARING' && (
                    <button
                      onClick={() => handleTransition(selectedOrder.id, 'READY_FOR_PICKUP')}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow animate-pulse"
                    >
                      Mark Ready For Pickup
                    </button>
                  )}

                  {selectedOrder.status === 'READY_FOR_PICKUP' && (
                    <button
                      onClick={() => handleTransition(selectedOrder.id, 'PICKED_UP', 'Customer verified items, paid at counter')}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-600/30 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Confirm Pickup & Cash/UPI Payment Received
                    </button>
                  )}

                  {selectedOrder.status === 'RETURN_REQUESTED' && (
                    <>
                      <button
                        onClick={() => handleTransition(selectedOrder.id, 'RETURN_APPROVED')}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
                      >
                        Approve Return
                      </button>
                      <button
                        onClick={() => handleTransition(selectedOrder.id, 'RETURN_REJECTED')}
                        className="px-4 py-2 bg-stone-600 text-white rounded-xl text-xs font-bold"
                      >
                        Reject Return
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'RETURN_APPROVED' && (
                    <button
                      onClick={() => handleTransition(selectedOrder.id, 'RETURNED', 'Customer returned item physically to counter')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                    >
                      Mark Item Returned at Counter
                    </button>
                  )}

                  {selectedOrder.status === 'RETURNED' && (
                    <button
                      onClick={() => {
                        setRefundAmount(selectedOrder.totalAmount);
                        setIsRefundModalOpen(true);
                      }}
                      className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" /> Record Physical Cash / UPI Refund
                    </button>
                  )}
                </div>
              </div>

              {/* Items & Total */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-stone-700 uppercase">Items in this order:</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((i) => (
                    <div key={i.id} className="flex justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                      <div>
                        <span className="font-bold text-stone-900">{i.productName}</span>
                        {i.variantName && <span className="text-stone-500 ml-1">({i.variantName})</span>}
                        <span className="text-stone-400 block">Qty: {i.quantity} × {formatINR(i.unitPrice)}</span>
                      </div>
                      <span className="font-extrabold text-stone-900">{formatINR(i.totalPrice)}</span>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-stone-100 flex justify-between items-center text-sm font-black">
                  <span>Total Payable:</span>
                  <span className="text-brand-700 text-base">{formatINR(selectedOrder.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Orders Filter & Table */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search orders by number, customer, or phone..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white"
                />
              </div>

              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold text-stone-700"
              >
                <option value="ALL">All Statuses ({orders.length})</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PREPARING">Preparing</option>
                <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                <option value="PICKED_UP">Picked Up</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="RETURN_REQUESTED">Return Requested</option>
                <option value="RETURNED">Returned</option>
                <option value="REFUND_RECORDED">Refund Recorded</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-400 uppercase font-semibold">
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Total Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Created</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredOrders.map((ord) => {
                    const b = getStatusBadgeInfo(ord.status);
                    return (
                      <tr key={ord.id} className="hover:bg-stone-50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-brand-700">{ord.orderNumber}</td>
                        <td className="py-3 px-3">
                          <strong className="text-stone-900 block">{ord.customerName}</strong>
                          <span className="text-stone-400 text-[11px]">{ord.customerPhone}</span>
                        </td>
                        <td className="py-3 px-3 text-stone-600">{ord.items.length} items</td>
                        <td className="py-3 px-3 font-extrabold text-stone-900">{formatINR(ord.totalAmount)}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${b.bgClass} ${b.textClass}`}>
                            {b.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-stone-400">{formatDate(ord.createdAt)}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedOrder(ord)}
                            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[11px] font-bold"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY DASHBOARD (Exact vs Reserved vs Available) */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-xl font-display font-extrabold text-stone-900">
                Inventory & Stock Reservation Dashboard
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Staff view of total stock, customer-reserved units, and shelf-available units.
              </p>
            </div>
            <button
              onClick={refreshData}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Stock
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 uppercase font-semibold">
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3 text-center">Total Stock</th>
                  <th className="py-3 px-3 text-center">Reserved Units</th>
                  <th className="py-3 px-3 text-center">Available Units</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Adjust Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((p) => {
                  const available = p.stockQuantity - p.reservedStock;
                  const isLow = available <= p.lowStockThreshold;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="py-3 px-3 font-semibold text-stone-900">{p.name}</td>
                      <td className="py-3 px-3 font-mono text-stone-500">{p.sku}</td>
                      <td className="py-3 px-3 text-center font-bold text-stone-800">{p.stockQuantity}</td>
                      <td className="py-3 px-3 text-center font-bold text-amber-600 bg-amber-50/50">
                        {p.reservedStock}
                      </td>
                      <td className="py-3 px-3 text-center font-black text-emerald-700 bg-emerald-50/50">
                        {available}
                      </td>
                      <td className="py-3 px-3">
                        {available <= 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-max">
                            <AlertTriangle className="w-3 h-3" /> Low Stock ({available})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Healthy
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setStockProduct(p);
                            setIsAdjustStockModalOpen(true);
                          }}
                          className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PRODUCTS MANAGEMENT */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-xl font-display font-extrabold text-stone-900">
                Store Catalogue Management
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Add new items, update prices, and control store availability.
              </p>
            </div>
            <button
              onClick={() => setIsAddProductModalOpen(true)}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" /> Add New Product
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl border border-stone-200 bg-stone-50 flex gap-3">
                <div className="w-16 h-16 rounded-xl bg-white border border-stone-200 overflow-hidden relative shrink-0">
                  <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-stone-900 truncate">{p.name}</h4>
                  <p className="text-[10px] font-mono text-stone-400">{p.sku}</p>
                  <p className="text-xs font-extrabold text-stone-900 mt-1">
                    {formatINR(p.price)} <span className="line-through text-stone-400 font-normal">{formatINR(p.mrp)}</span>
                  </p>
                  <span className="text-[10px] text-stone-500 block">Stock: {p.stockQuantity} (Res: {p.reservedStock})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: REVIEWS MODERATION */}
      {activeTab === 'reviews' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
          <h2 className="text-xl font-display font-extrabold text-stone-900 border-b border-stone-100 pb-4">
            Customer Review Moderation Queue
          </h2>

          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-stone-900 text-xs">{r.customerName}</span>
                    <span className="text-[11px] text-stone-400 ml-2">Order: {r.orderId}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-600">{r.rating} ★</span>
                </div>
                <p className="text-xs text-stone-700">{r.comment}</p>
                <div className="flex gap-2 pt-1">
                  <span className="text-[10px] font-bold uppercase bg-stone-200 px-2 py-0.5 rounded">
                    Status: {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SHOP SETTINGS CONFIGURATION */}
      {activeTab === 'settings' && settings && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6 max-w-3xl">
          <h2 className="text-xl font-display font-extrabold text-stone-900 border-b border-stone-100 pb-4">
            Store Settings & Pickup Configuration
          </h2>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
              });
              if (res.ok) setBannerNotice('Shop settings updated successfully');
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block font-bold text-stone-700 uppercase mb-1">Store Name</label>
              <input
                type="text"
                value={settings.shopName}
                onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 uppercase mb-1">Physical Store Address</label>
              <textarea
                rows={2}
                value={settings.shopAddress}
                onChange={(e) => setSettings({ ...settings, shopAddress: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">Opening Time</label>
                <input
                  type="text"
                  value={settings.openingTime}
                  onChange={(e) => setSettings({ ...settings, openingTime: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">Closing Time</label>
                <input
                  type="text"
                  value={settings.closingTime}
                  onChange={(e) => setSettings({ ...settings, closingTime: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 uppercase mb-1">WhatsApp Number</label>
                <input
                  type="text"
                  value={settings.whatsappNumber}
                  onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 uppercase mb-1">Pickup Instructions</label>
              <textarea
                rows={3}
                value={settings.pickupInstructions}
                onChange={(e) => setSettings({ ...settings, pickupInstructions: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow"
            >
              Save Shop Settings
            </button>
          </form>
        </div>
      )}

      {/* MODAL: ADJUST INVENTORY */}
      {isAdjustStockModalOpen && stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-stone-900 text-base">Adjust Stock: {stockProduct.name}</h3>
            <form onSubmit={handleStockAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Quantity Change (+ to add, - to deduct)</label>
                <input
                  type="number"
                  value={stockChangeQty}
                  onChange={(e) => setStockChangeQty(Number(e.target.value))}
                  className="w-full p-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Reason for Audit Log</label>
                <select
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value as any)}
                  className="w-full p-2 border border-stone-300 rounded-xl"
                >
                  <option value="restock">Restock / New Shipment</option>
                  <option value="purchase">Store Purchase</option>
                  <option value="damage">Damaged in Store</option>
                  <option value="missing">Missing / Inventory Count</option>
                  <option value="manual_correction">Manual Correction</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustStockModalOpen(false)}
                  className="w-1/3 py-2 bg-stone-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-brand-600 text-white rounded-xl font-bold shadow">
                  Save Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PHYSICAL REFUND RECORD (Cash/UPI ledger) */}
      {isRefundModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-stone-900 text-base">Record Counter Cash / UPI Refund</h3>
            <p className="text-xs text-stone-500">
              For order {selectedOrder.orderNumber}. Payment was made at shop, so refund must be given at shop.
            </p>
            <form onSubmit={handleRecordRefund} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Refund Amount (₹)</label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full p-2 border border-stone-300 rounded-xl font-bold text-sm"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Disbursement Method</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="w-full p-2 border border-stone-300 rounded-xl"
                >
                  <option value="cash">Cash (Counter Cash Register)</option>
                  <option value="upi">UPI (GPay/PhonePe to Customer)</option>
                  <option value="manual">Store Credit / Manual</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Receipt Number</label>
                <input
                  type="text"
                  placeholder="e.g. JT-REF-001"
                  value={refundReceiptNumber}
                  onChange={(e) => setRefundReceiptNumber(e.target.value)}
                  className="w-full p-2 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="w-1/3 py-2 bg-stone-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow">
                  Confirm Refund Disbursed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
