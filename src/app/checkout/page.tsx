'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShoppingBag,
  ShieldCheck,
  MapPin,
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  User,
  Phone,
  Mail,
  Tag,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useCart } from '@/lib/context/cart-context';
import { useAuth } from '@/lib/context/auth-context';
import { formatINR } from '@/lib/utils';
import AuthModal from '@/components/auth/auth-modal';
import { triggerHaptic, getCurrentNetworkStatus } from '@/lib/native/capacitor-bridge';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, totalMrp, mrpSavings, couponCode, couponDiscount, finalTotal, clearCart } = useCart();
  const { user } = useAuth();

  // Customer input form
  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerNotes, setCustomerNotes] = useState('');

  // Pickup mode
  const [pickupMode, setPickupMode] = useState<'FLEXIBLE' | 'SLOT'>('FLEXIBLE');
  const [pickupSlotDate, setPickupSlotDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [pickupSlotTime, setPickupSlotTime] = useState('11:00 AM – 01:00 PM');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Sync user state if updated
  React.useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.fullName);
      if (!customerPhone && user.phone) setCustomerPhone(user.phone);
      if (!customerEmail && user.email) setCustomerEmail(user.email);
    }
  }, [user]);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 max-w-md mx-auto my-12 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900">Your cart is empty</h2>
        <p className="text-xs text-stone-500 mt-1 mb-6">
          Add some items to your cart before proceeding to checkout.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 active-press"
        >
          <span>Browse Catalogue</span>
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage('Please provide a valid 10-digit mobile number for order pickup notifications');
      return;
    }

    const isConnected = await getCurrentNetworkStatus();
    if (!isConnected) {
      setErrorMessage('You are currently offline. An active internet connection is required to reserve store inventory.');
      return;
    }

    setLoading(true);

    try {
      const orderPayload = {
        customerId: user.id,
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        customerEmail: customerEmail.trim() || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        couponCode: couponCode || undefined,
        pickupMode,
        pickupSlotDate: pickupMode === 'SLOT' ? pickupSlotDate : undefined,
        pickupSlotTime: pickupMode === 'SLOT' ? pickupSlotTime : undefined,
        customerNotes: customerNotes.trim() || undefined,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place pickup order');
      }

      // Haptic confirmation
      triggerHaptic('success');

      // Clear cart
      clearCart();

      // Redirect to confirmation & live tracking page
      router.push(`/orders/${data.orderNumber}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Order reservation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight">
          Reserve for Store Pickup
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Review your items, choose pickup preferences, and confirm reservation. Zero online payment needed.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-800 font-medium">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Preferences */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Customer Information Card */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="font-display font-bold text-base text-stone-900 flex items-center gap-2">
                <User className="w-4 h-4 text-brand-600" /> 1. Customer Details
              </h2>
              {!user && (
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 underline"
                >
                  Sign in with Phone
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-stone-500">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="98765 43210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Email Address (Optional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Pickup Mode Selection Card */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
            <h2 className="font-display font-bold text-base text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-3">
              <MapPin className="w-4 h-4 text-amber-600" /> 2. Pickup Preference
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mode A */}
              <div
                onClick={() => setPickupMode('FLEXIBLE')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  pickupMode === 'FLEXIBLE'
                    ? 'border-brand-600 bg-brand-50/40 shadow-sm'
                    : 'border-stone-200 hover:border-stone-300 bg-stone-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs sm:text-sm text-stone-900">Mode A: Flexible Pickup</span>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      pickupMode === 'FLEXIBLE' ? 'border-brand-600' : 'border-stone-400'
                    }`}
                  >
                    {pickupMode === 'FLEXIBLE' && <div className="w-2 h-2 rounded-full bg-brand-600" />}
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">
                  We prepare your order immediately. Collect anytime within 3 days during shop hours.
                </p>
              </div>

              {/* Mode B */}
              <div
                onClick={() => setPickupMode('SLOT')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  pickupMode === 'SLOT'
                    ? 'border-brand-600 bg-brand-50/40 shadow-sm'
                    : 'border-stone-200 hover:border-stone-300 bg-stone-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs sm:text-sm text-stone-900">Mode B: Scheduled Slot</span>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      pickupMode === 'SLOT' ? 'border-brand-600' : 'border-stone-400'
                    }`}
                  >
                    {pickupMode === 'SLOT' && <div className="w-2 h-2 rounded-full bg-brand-600" />}
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">
                  Select a specific day and time window for priority counter packaging.
                </p>
              </div>
            </div>

            {/* Slot options if Mode B is active */}
            {pickupMode === 'SLOT' && (
              <div className="pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                    Pickup Date
                  </label>
                  <input
                    type="date"
                    value={pickupSlotDate}
                    onChange={(e) => setPickupSlotDate(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                    Time Window
                  </label>
                  <select
                    value={pickupSlotTime}
                    onChange={(e) => setPickupSlotTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white"
                  >
                    <option value="10:00 AM – 12:00 PM">Morning (10:00 AM – 12:00 PM)</option>
                    <option value="12:00 PM – 03:00 PM">Afternoon (12:00 PM – 03:00 PM)</option>
                    <option value="04:00 PM – 07:00 PM">Evening (04:00 PM – 07:00 PM)</option>
                    <option value="07:00 PM – 09:30 PM">Night (07:00 PM – 09:30 PM)</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                Special Instructions / Gift Packing Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Please wrap in festive paper, or call me before packing."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white"
              />
            </div>
          </div>

          {/* 3. Shop Counter Address Box */}
          <div className="p-4 rounded-2xl bg-stone-900 text-white space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <MapPin className="w-4 h-4" />
              <span>COLLECTION COUNTER</span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Jainam Traders • Shop No. 4 & 5, Mahaveer Market, Main Bazar Road, Near Clock Tower.
              <br />
              Store Hours: 09:30 AM to 09:30 PM (Closed on Sundays).
            </p>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
            <h2 className="font-display font-bold text-base text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-3">
              <ShoppingBag className="w-4 h-4 text-brand-600" /> Order Summary
            </h2>

            {/* Items list */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 items-center">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                    <Image src={item.thumbnailUrl} alt={item.productName} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-stone-900 truncate">{item.productName}</h4>
                    <p className="text-[10px] text-stone-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-xs font-extrabold text-stone-900 shrink-0">
                    {formatINR(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="pt-3 border-t border-stone-100 space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Items MRP Total</span>
                <span className="line-through">{formatINR(totalMrp)}</span>
              </div>
              <div className="flex justify-between">
                <span>Catalogue Price</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {mrpSavings > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Retail MRP Savings</span>
                  <span>- {formatINR(mrpSavings)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Coupon ({couponCode})</span>
                  <span>- {formatINR(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-stone-900 pt-2 border-t border-stone-200">
                <span>Pay at Counter</span>
                <span className="text-brand-700">{formatINR(finalTotal)}</span>
              </div>
            </div>

            {/* Explicit Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Payment Method: PAY AT SHOP</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                No money is deducted online. You will inspect the items and pay directly at Jainam Traders via Cash or UPI upon pickup.
              </p>
            </div>

            {/* Submit Reservation Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-brand-600 hover:bg-brand-700 disabled:bg-stone-300 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 active-press transition-all"
            >
              {loading ? (
                <span>Securing Inventory...</span>
              ) : (
                <>
                  <span>Confirm Pickup Reservation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          message="Please sign in with your name and mobile number to complete your pickup reservation."
        />
      )}
    </div>
  );
}
