'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  MessageSquare,
  QrCode,
  Printer,
  XCircle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';
import { formatINR, formatDate, getShopDirectionsUrl } from '@/lib/utils';
import { getStatusBadgeInfo } from '@/lib/orders/state-machine';
import { useShop } from '@/lib/context/shop-context';
import { useSimpleMode } from '@/lib/context/simple-mode-context';

interface OrderDetailViewProps {
  order: Order;
}

export default function OrderDetailView({ order: initialOrder }: OrderDetailViewProps) {
  const shop = useShop();
  const { isSimpleMode, speakText } = useSimpleMode();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [returnReason, setReturnReason] = useState('Found damaged / scratched');
  const [returnDescription, setReturnDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Generate QR Code on mount
  useEffect(() => {
    QRCode.toDataURL(order.qrToken, { width: 220, margin: 1, color: { dark: '#1C1917', light: '#FFFFFF' } })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR generation failed:', err));
  }, [order.qrToken]);

  const badge = getStatusBadgeInfo(order.status);

  const timelineSteps: { status: OrderStatus; title: string; desc: string }[] = isSimpleMode
    ? [
        { status: 'PENDING', title: '🟡 बुकिंग मिली', desc: `${shop.shopName} को आपका ऑर्डर मिल गया है` },
        { status: 'CONFIRMED', title: '🔵 दुकान ने स्वीकार किया', desc: 'सामान स्टॉक में उपलब्ध है' },
        { status: 'PREPARING', title: '🔵 सामान तैयार हो रहा है', desc: 'काउंटर पर पैकिंग चल रही है' },
        { status: 'READY_FOR_PICKUP', title: '🟢 सामान तैयार है', desc: 'दुकान से आकर ले जाएं' },
        { status: 'PICKED_UP', title: '🏪 सामान ले लिया गया', desc: 'दुकान पर भुगतान पूरा हुआ' },
      ]
    : [
        { status: 'PENDING', title: 'Order Reserved', desc: `Received at ${shop.shopName}` },
        { status: 'CONFIRMED', title: 'Confirmed by Shop', desc: 'Staff validated inventory' },
        { status: 'PREPARING', title: 'Assembling Items', desc: 'Packing at counter' },
        { status: 'READY_FOR_PICKUP', title: 'Ready for Pickup', desc: 'Waiting for you at shop' },
        { status: 'PICKED_UP', title: 'Picked Up & Paid', desc: 'Payment completed at shop' },
      ];

  // Current step index
  const currentStep = badge.stepIndex;

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setActionError('');
    try {
      const res = await fetch(`/api/orders/${order.orderNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CANCELLED',
          actorRole: 'customer',
          actorId: order.customerId,
          note: cancelReason || 'Customer requested cancellation before packaging',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel order');
      setOrder(data);
      setIsCancelModalOpen(false);
      setActionMessage('Your order has been cancelled and reserved items released.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleReturnRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setActionError('');
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          customerId: order.customerId,
          productId: order.items[0]?.productId,
          quantity: order.items[0]?.quantity || 1,
          reason: returnReason,
          description: returnDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit return');
      setOrder({ ...order, status: 'RETURN_REQUESTED' });
      setIsReturnModalOpen(false);
      setActionMessage('Return request submitted. Please bring item to our shop counter for inspection.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Return submission failed');
    } finally {
      setProcessing(false);
    }
  };

  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const canReturn = order.status === 'PICKED_UP';

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs sm:text-sm font-extrabold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-lg border border-brand-200">
              {order.orderNumber}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bgClass} ${badge.textClass}`}>
              {badge.label}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-stone-900">
            Pickup Order Tracking
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Reserved on {formatDate(order.createdAt)} • Mode: {order.pickupMode === 'SLOT' ? `Scheduled (${order.pickupSlotDate} ${order.pickupSlotTime})` : 'Flexible (3-day hold)'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* 2. Visual Vertical Timeline */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
        <h2 className="font-display font-bold text-base text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-600" /> Order Preparation Timeline
        </h2>

        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
          {timelineSteps.map((step, idx) => {
            const isCompleted = currentStep >= idx && currentStep !== -1;
            const isCurrent = currentStep === idx;

            return (
              <div key={step.status} className="relative">
                <div
                  className={`absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-brand-600 border-brand-600 text-white animate-pulse'
                      : 'bg-white border-stone-300 text-stone-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                </div>

                <div>
                  <h3
                    className={`text-xs sm:text-sm font-bold ${
                      isCompleted ? 'text-stone-900' : isCurrent ? 'text-brand-600 font-extrabold' : 'text-stone-400'
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-stone-500">{step.desc}</p>
                </div>
              </div>
            );
          })}

          {order.status === 'CANCELLED' && (
            <div className="relative">
              <div className="absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full bg-rose-600 border-2 border-rose-600 text-white flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-rose-600">Order Cancelled</h3>
                <p className="text-[11px] text-stone-500">Reserved stock released back to store.</p>
              </div>
            </div>
          )}

          {order.status === 'RETURN_REQUESTED' && (
            <div className="relative">
              <div className="absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full bg-purple-600 border-2 border-purple-600 text-white flex items-center justify-center">
                <RotateCcw className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-purple-700">Return Requested</h3>
                <p className="text-[11px] text-stone-500">Awaiting shop counter inspection.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. QR Code & Pickup Counter Presentation Card */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-950 text-white rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-elevated">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              COUNTER VERIFICATION PASS
            </span>
            <h3 className="text-xl sm:text-2xl font-display font-extrabold">
              Show this QR Code at the Counter
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              When visiting {shop.shopName} in {shop.shortAddress}, show this digital QR token or recite your Order ID{' '}
              <strong className="text-white font-mono">{order.orderNumber}</strong>. Our counter staff will retrieve your inspected order box.
            </p>

            <div className="p-3 rounded-xl bg-stone-800/80 border border-stone-700/80 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-400">Total Payable at Counter:</span>
                <span className="font-extrabold text-amber-400 text-sm">{formatINR(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Accepted Payment:</span>
                <span className="font-semibold text-white">Cash or UPI (GPay/PhonePe/Paytm)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <a
                href={`https://wa.me/${shop.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${shop.shopName}, I am inquiring about Order ${order.orderNumber}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Store
              </a>
              <a
                href={`tel:${shop.phone.replace(/\s+/g, '')}`}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-stone-700"
              >
                <Phone className="w-3.5 h-3.5" /> Call Counter
              </a>
              {getShopDirectionsUrl(shop) ? (
                <a
                  href={getShopDirectionsUrl(shop)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" /> Directions
                </a>
              ) : (
                <span className="px-3 py-2 bg-stone-800 text-stone-400 rounded-xl text-xs font-medium">
                  Shop location is being configured.
                </span>
              )}
            </div>
          </div>

          <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-inner">
            {qrDataUrl ? (
              <Image src={qrDataUrl} alt="Order QR Token" width={180} height={180} className="rounded-lg" />
            ) : (
              <div className="w-40 h-40 bg-stone-100 flex items-center justify-center text-stone-400">
                <QrCode className="w-8 h-8" />
              </div>
            )}
            <span className="mt-2 text-[10px] font-mono text-stone-600 font-bold tracking-wider">
              {order.orderNumber}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Ordered Items Breakdown */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
        <h3 className="font-display font-bold text-base text-stone-900 border-b border-stone-100 pb-3">
          Reserved Items ({order.items.length})
        </h3>

        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-4 items-center p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-stone-200 shrink-0 border border-stone-300">
                {item.thumbnailUrl ? (
                  <Image src={item.thumbnailUrl} alt={item.productName} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-stone-900 truncate">{item.productName}</h4>
                {item.variantName && <p className="text-[11px] text-stone-500">Variant: {item.variantName}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                  {item.mrp && item.mrp > item.unitPrice ? (
                    <>
                      <span className="text-stone-400">MRP: <span className="line-through">{formatINR(item.mrp)}</span></span>
                      <span className="font-bold text-stone-900">Price: {formatINR(item.unitPrice)}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-brand-50 text-brand-700 border border-brand-200">
                        {item.discountPercentage ?? Math.round(((item.mrp - item.unitPrice) / item.mrp) * 100)}% OFF
                      </span>
                    </>
                  ) : (
                    <span className="font-bold text-stone-900">Price: {formatINR(item.unitPrice)}</span>
                  )}
                  <span className="text-stone-500">• Qty: {item.quantity}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-400 block font-medium">Total</span>
                <span className="text-xs sm:text-sm font-extrabold text-stone-900">
                  {formatINR(item.totalPrice)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Summary */}
        <div className="pt-4 border-t border-stone-200 space-y-1.5 text-xs text-stone-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatINR(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Discount ({order.couponCode || 'Promo'})</span>
              <span>- {formatINR(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm sm:text-base font-black text-stone-900 pt-2 border-t border-stone-200">
            <span>Payable at Shop</span>
            <span className="text-brand-700">{formatINR(order.totalAmount)}</span>
          </div>
        </div>

        {/* Action Controls: Cancel / Return */}
        <div className="pt-4 border-t border-stone-100 flex flex-wrap gap-3">
          {canCancel && (
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(true)}
              className="px-4 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors"
            >
              Cancel Reservation
            </button>
          )}

          {canReturn && (
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(true)}
              className="px-4 py-2 rounded-xl border border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Request Counter Return
            </button>
          )}
        </div>
      </div>

      {/* Printable Receipt (Hidden in screen view, visible during window.print()) */}
      <div id="printable-receipt" className="hidden">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>{shop.shopName.toUpperCase()}</h2>
          <p style={{ fontSize: '12px' }}>{shop.shopAddress}</p>
          <p style={{ fontSize: '12px' }}>Phone: {shop.phone} • Email: {shop.email}</p>
          <h3 style={{ fontSize: '16px', marginTop: '10px' }}>PICKUP ORDER RECEIPT</h3>
        </div>

        <table style={{ width: '100%', fontSize: '12px', marginBottom: '15px' }}>
          <tbody>
            <tr>
              <td><strong>Order ID:</strong> {order.orderNumber}</td>
              <td style={{ textAlign: 'right' }}><strong>Date:</strong> {formatDate(order.createdAt)}</td>
            </tr>
            <tr>
              <td><strong>Customer:</strong> {order.customerName}</td>
              <td style={{ textAlign: 'right' }}><strong>Phone:</strong> {order.customerPhone}</td>
            </tr>
            <tr>
              <td><strong>Payment Status:</strong> {order.paymentStatus}</td>
              <td style={{ textAlign: 'right' }}><strong>Payment Method:</strong> {order.paymentMethod}</td>
            </tr>
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '15px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid black' }}>
              <th style={{ textAlign: 'left', padding: '5px' }}>Item</th>
              <th style={{ textAlign: 'center', padding: '5px' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '5px' }}>Price</th>
              <th style={{ textAlign: 'right', padding: '5px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '5px' }}>{i.productName} {i.variantName ? `(${i.variantName})` : ''}</td>
                <td style={{ textAlign: 'center', padding: '5px' }}>{i.quantity}</td>
                <td style={{ textAlign: 'right', padding: '5px' }}>{formatINR(i.unitPrice)}</td>
                <td style={{ textAlign: 'right', padding: '5px' }}>{formatINR(i.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>
          Total Paid at Shop: {formatINR(order.totalAmount)}
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '11px' }}>
          <p>Thank you for choosing Jainam Traders! We appreciate your local patronage.</p>
          <p>Counter Returns accepted within 7 days with this receipt and original packaging.</p>
        </div>
      </div>

      {/* Cancellation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">Cancel Pickup Reservation</h3>
            <p className="text-xs text-stone-500">
              Are you sure you want to cancel order {order.orderNumber}? The reserved items will be released back to the shop shelf.
            </p>
            {actionError && <p className="text-xs text-rose-600">{actionError}</p>}
            <textarea
              rows={2}
              placeholder="Reason for cancellation (optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-xl text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="w-1/3 py-2 bg-stone-100 text-stone-700 text-xs font-bold rounded-xl"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleCancelOrder}
                className="flex-1 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl"
              >
                {processing ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Request Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">Submit Counter Return Request</h3>
            <p className="text-xs text-stone-500">
              Items must be in original packaging. You will bring the item to our store counter for inspection.
            </p>
            {actionError && <p className="text-xs text-rose-600">{actionError}</p>}
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-xl text-xs"
            >
              <option value="Found damaged / scratched">Found damaged / scratched</option>
              <option value="Wrong size or color">Wrong size or color</option>
              <option value="Clock movement issue">Clock movement issue</option>
              <option value="Item not as expected">Item not as expected</option>
            </select>
            <textarea
              rows={3}
              placeholder="Please describe the issue..."
              value={returnDescription}
              onChange={(e) => setReturnDescription(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-xl text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="w-1/3 py-2 bg-stone-100 text-stone-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleReturnRequest}
                className="flex-1 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl"
              >
                {processing ? 'Submitting...' : 'Submit Return Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
