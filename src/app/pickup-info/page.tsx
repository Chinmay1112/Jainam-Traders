import React from 'react';
import Image from 'next/image';
import {
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  ShieldCheck,
  QrCode,
  Sparkles,
  Navigation,
  CheckCircle2,
  Store,
} from 'lucide-react';
import { getShopSettings } from '@/lib/db/store-service';
import { getShopDirectionsUrl } from '@/lib/utils';

export const metadata = {
  title: 'Pickup Information & Store Counter | Jainam Traders',
  description: 'How pickup works at Jainam Traders. Store address, Google Maps directions, timings, and payment at counter.',
};

export default async function PickupInfoPage() {
  const settings = await getShopSettings();

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4 text-center sm:text-left">
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200">
          LOCAL STORE PICKUP GUIDE
        </span>
        <h1 className="text-2xl sm:text-4xl font-display font-extrabold text-stone-900 tracking-tight mt-2">
          How Store Pickup Works
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-2xl">
          We are an authentic brick-and-mortar retail shop. Discover products online, reserve them without paying in advance, and collect at our store counter.
        </p>
      </div>

      {/* 3 Step Visual Process */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 font-black text-lg flex items-center justify-center mb-3">
            1
          </div>
          <h3 className="font-bold text-sm text-stone-900 mb-1">Reserve Online</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Add items to your cart and place an order. No credit card or online payment is required.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 font-black text-lg flex items-center justify-center mb-3">
            2
          </div>
          <h3 className="font-bold text-sm text-stone-900 mb-1">We Inspect & Pack</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Our team tests battery clocks, verifies frame glass, and gift packs items for your pickup.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-black text-lg flex items-center justify-center mb-3">
            3
          </div>
          <h3 className="font-bold text-sm text-stone-900 mb-1">Inspect & Pay at Shop</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Visit our counter, examine your items, and pay using Cash or UPI (GPay/PhonePe).
          </p>
        </div>
      </div>

      {/* Physical Store Details Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-stone-900">
              Shop Location & Hours
            </h2>

            <div className="space-y-3 text-xs text-stone-600">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-stone-900 font-bold mb-0.5">Physical Counter Address:</strong>
                  <span>{settings.shopAddress}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-stone-900 font-bold mb-0.5">Store Timings:</strong>
                  <span>Monday to Saturday: {settings.openingTime} AM – {settings.closingTime} PM</span>
                  <span className="block text-rose-600 font-semibold mt-0.5">
                    Closed every Sunday and major festival holidays
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-stone-900 font-bold mb-0.5">Direct Counter Contact:</strong>
                  <span>Phone: {settings.phone}</span>
                  <span className="block">WhatsApp: {settings.whatsappNumber}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {getShopDirectionsUrl(settings) ? (
                <a
                  href={getShopDirectionsUrl(settings)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Navigation className="w-4 h-4" /> Get Directions
                </a>
              ) : (
                <span className="px-5 py-2.5 bg-stone-200 text-stone-500 rounded-xl text-xs font-medium">
                  Shop location is being configured.
                </span>
              )}
              <a
                href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <MessageSquare className="w-4 h-4" /> Chat on WhatsApp
              </a>
            </div>
          </div>

          <div className="relative h-64 sm:h-72 rounded-2xl overflow-hidden bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 border border-stone-700 p-6 flex flex-col justify-between text-white">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Store className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Verified Counter
              </span>
            </div>
            <div>
              <p className="text-sm font-extrabold text-amber-400">Jainam Traders Counter</p>
              <p className="text-xs text-stone-300 mt-1 leading-relaxed">{settings.shopAddress}</p>
              <p className="text-[11px] text-emerald-400 font-bold mt-2">Dedicated pickup window with live item inspection</p>
            </div>
          </div>
        </div>

        {/* Counter Instructions */}
        <div className="pt-6 border-t border-stone-200 space-y-3">
          <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Counter Pickup Instructions:
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-600">
            <li className="flex items-start gap-2 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Show your digital QR code on your phone or quote your order ID (JT-...).</span>
            </li>
            <li className="flex items-start gap-2 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>We hold orders safely for up to 3 days from the time your order is ready.</span>
            </li>
            <li className="flex items-start gap-2 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Test clocks, inspect frames, and check mementos before completing payment.</span>
            </li>
            <li className="flex items-start gap-2 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Counter payment can be made via Cash, UPI QR, or debit cards at the register.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
