'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Phone,
  User,
  QrCode,
  DollarSign,
  ArrowRight,
  Sparkles,
  PackageCheck,
  AlertCircle,
  X,
  CreditCard,
  IndianRupee,
} from 'lucide-react';
import { Product, Order } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import ProductImage from '@/components/ui/product-image';
import { StaffSession } from '@/lib/auth/staff-roles';

interface AdminAssistCustomerProps {
  products: Product[];
  currentStaff?: StaffSession;
  onOrderCreated?: (order: Order) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export function AdminAssistCustomer({
  products,
  currentStaff,
  onOrderCreated,
}: AdminAssistCustomerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [basket, setBasket] = useState<CartItem[]>([]);

  // Walk-in Customer Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Created Order Receipt Modal
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Extract unique categories
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.categoryId && p.categoryName) {
        map.set(p.categoryId, p.categoryName);
      }
    });
    return Array.from(map.entries());
  }, [products]);

  // Filtered products (only active, non-archived)
  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive || p.isArchived || p.status === 'archived') return false;
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesBrand = (p.brand || '').toLowerCase().includes(q);
        return matchesName || matchesSku || matchesBrand;
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Basket calculations
  const basketTotal = useMemo(() => {
    return basket.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [basket]);

  const basketCount = useMemo(() => {
    return basket.reduce((acc, item) => acc + item.quantity, 0);
  }, [basket]);

  const addToBasket = (product: Product) => {
    const available = Math.max(0, product.stockQuantity - product.reservedStock);
    if (available <= 0) return;

    setBasket((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= available) return prev;
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setBasket((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const available = Math.max(0, item.product.stockQuantity - item.product.reservedStock);
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > available) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromBasket = (productId: string) => {
    setBasket((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleCreateWalkInOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (basket.length === 0) {
      setErrorMsg('Basket is empty. Please add at least one product.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 10) {
      setErrorMsg('Valid 10-digit customer mobile number is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        customerId: `walkin-${Date.now()}`,
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim(),
        pickupMode: 'FLEXIBLE',
        customerNotes: customerNotes ? `[Staff Assisted - ${currentStaff?.fullName || 'Counter Staff'}] ${customerNotes}` : `[Staff Assisted - ${currentStaff?.fullName || 'Counter Staff'}] Walk-in customer order`,
        items: basket.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create assisted order');
      }

      setCreatedOrder(data);
      setBasket([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerNotes('');
      if (onOrderCreated) {
        onOrderCreated(data);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Order creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (orderId: string, amount: number, method: 'Cash' | 'UPI') => {
    setRecordingPayment(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountReceived: amount,
          paymentMethod: method,
          notes: `Walk-in payment recorded by ${currentStaff?.fullName || 'Counter Staff'}`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Payment recording failed');
      }

      setPaymentSuccess(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Payment recording failed');
    } finally {
      setRecordingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Banner */}
      <div className="p-4 bg-gradient-to-r from-stone-900 to-stone-800 rounded-3xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-500 text-stone-950 flex items-center justify-center font-black">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight">Counter Staff: Assist Customer Mode</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Safe Walk-In
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Browse catalogue, show available stock, and quickly book walk-in orders with counter payment recording.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 bg-stone-800 rounded-xl border border-stone-700 text-xs font-mono text-stone-300">
            Staff: {currentStaff?.fullName || 'Counter Staff'} ({currentStaff?.role || 'staff'})
          </div>
        </div>
      </div>

      {/* Main Grid: Products (2/3) + Basket & Order Builder (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Product Search & Catalogue */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search products by title, SKU, or brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All Items ({products.length})
              </button>
              {categories.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setSelectedCategory(id)}
                  className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all ${
                    selectedCategory === id
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {availableProducts.map((p) => {
              const available = Math.max(0, p.stockQuantity - p.reservedStock);
              const isOut = available <= 0;

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl p-3 border transition-all flex flex-col justify-between ${
                    isOut
                      ? 'border-stone-200 opacity-60'
                      : 'border-stone-200 hover:border-brand-500 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="aspect-square w-full rounded-xl overflow-hidden bg-stone-50 border border-stone-100 relative">
                      <ProductImage
                        src={p.thumbnailUrl || (p.images && p.images[0]) || '/images/product-placeholder.svg'}
                        alt={p.name}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          isOut
                            ? 'bg-rose-100 text-rose-700'
                            : available <= 3
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : `${available} Available`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-400 font-mono block truncate">{p.sku}</span>
                      <h4 className="text-xs font-bold text-stone-900 line-clamp-2 leading-tight mt-0.5">
                        {p.name}
                      </h4>
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between gap-1">
                    <div>
                      <span className="text-xs font-black text-stone-900 block">{formatINR(p.price)}</span>
                      {p.mrp > p.price && (
                        <span className="text-[10px] text-stone-400 line-through">{formatINR(p.mrp)}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isOut}
                      onClick={() => addToBasket(p)}
                      className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-30 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {availableProducts.length === 0 && (
            <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
              <p className="text-xs text-stone-500 font-bold">No available products found matching your filter.</p>
            </div>
          )}
        </div>

        {/* Right Column: Customer Details & Order Builder */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-2xs space-y-5 sticky top-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-extrabold text-stone-900">Walk-in Customer Order</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-stone-100 text-stone-700">
                {basketCount} items
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Selected Items List */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 no-scrollbar">
              {basket.map((item) => (
                <div
                  key={item.product.id}
                  className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate flex-1">
                    <span className="font-bold text-stone-900 block truncate">{item.product.name}</span>
                    <span className="text-[11px] text-stone-500">{formatINR(item.product.price)} each</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 rounded-md bg-white border border-stone-200 flex items-center justify-center font-bold hover:bg-stone-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold w-5 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 rounded-md bg-white border border-stone-200 flex items-center justify-center font-bold hover:bg-stone-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromBasket(item.product.id)}
                      className="p-1 text-stone-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {basket.length === 0 && (
                <div className="py-8 text-center text-stone-400 text-xs">
                  Basket is empty. Select products on the left to assemble order.
                </div>
              )}
            </div>

            {/* Total Summary */}
            {basket.length > 0 && (
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between font-bold text-sm">
                <span className="text-stone-600">Total Payable:</span>
                <span className="text-stone-900 font-black text-base">{formatINR(basketTotal)}</span>
              </div>
            )}

            {/* Customer Details Form */}
            <form onSubmit={handleCreateWalkInOrder} className="space-y-3 pt-2 border-t border-stone-100">
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Customer Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    maxLength={10}
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Customer Name (Optional)
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Walk-in customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Staff Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. In-store gift wrapping requested"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || basket.length === 0}
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md shadow-brand-600/30 flex items-center justify-center gap-2 transition-all mt-4"
              >
                {isSubmitting ? 'Creating Order...' : 'Book Walk-in Order &amp; Generate QR'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Created Order Success Receipt Modal */}
      {createdOrder && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-stone-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-stone-900 text-base">Order Created Successfully</h3>
              </div>
              <button onClick={() => { setCreatedOrder(null); setPaymentSuccess(false); }} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-center">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider block">Order Reference</span>
              <span className="text-2xl font-black font-mono text-brand-700 block">{createdOrder.orderNumber}</span>
              <span className="text-xs text-stone-600 block">
                Customer: <strong>{createdOrder.customerName}</strong> ({createdOrder.customerPhone})
              </span>
              <span className="text-lg font-black text-stone-900 block mt-2">
                Payable: {formatINR(createdOrder.totalAmount)}
              </span>
            </div>

            {paymentSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <span className="text-xs font-black text-emerald-900 block">Counter Payment Recorded &bull; PAID</span>
                <p className="text-[11px] text-emerald-700">Receipt and inventory deduction have been finalized.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <span className="text-xs font-bold text-stone-700 block">Collect Counter Payment Now:</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={recordingPayment}
                    onClick={() => handleRecordPayment(createdOrder.id, createdOrder.totalAmount, 'Cash')}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow flex items-center justify-center gap-1.5"
                  >
                    <IndianRupee className="w-3.5 h-3.5" /> Cash Received
                  </button>
                  <button
                    type="button"
                    disabled={recordingPayment}
                    onClick={() => handleRecordPayment(createdOrder.id, createdOrder.totalAmount, 'UPI')}
                    className="py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-extrabold shadow flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> UPI Received
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => { setCreatedOrder(null); setPaymentSuccess(false); }}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all"
            >
              Close &amp; Assist Next Customer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
