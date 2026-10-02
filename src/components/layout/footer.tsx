'use client';

import React from 'react';
import Link from 'next/link';
import {
  MapPin,
  Phone,
  MessageSquare,
  Clock,
  ShieldCheck,
  Sparkles,
  Navigation,
} from 'lucide-react';
import { useShop } from '@/lib/context/shop-context';
import { getShopDirectionsUrl, getStoreLiveStatus, formatTime12h } from '@/lib/utils';

export default function Footer() {
  const shop = useShop();
  const directionsUrl = getShopDirectionsUrl(shop);
  const liveStatus = getStoreLiveStatus(shop);

  const formattedOpen = formatTime12h(shop.openingTime || '07:30');
  const formattedClose = formatTime12h(shop.closingTime || '21:30');

  return (
    <footer className="bg-stone-900 text-stone-300 pt-10 pb-8 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Prominent Shop Information Section */}
        <div className="bg-stone-850/90 rounded-2xl border border-stone-750 p-6 sm:p-8 mb-10 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Identity & Location */}
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  JT
                </div>
                <h3 className="font-display font-extrabold text-xl sm:text-2xl text-white tracking-tight">
                  {shop.shopName || 'Jainam Traders'}
                </h3>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                {shop.brandTagline || 'Gifts • Toys • Accessories • More'}
              </p>

              {shop.shopAddress ? (
                <div className="flex items-start gap-2 pt-1 text-xs text-stone-300">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{shop.shopAddress}</span>
                </div>
              ) : null}

              {/* Dynamic Open / Closed Status */}
              <div className="flex items-center gap-2 pt-1 text-xs font-bold">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    liveStatus.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <span className={liveStatus.isOpen ? 'text-emerald-400' : 'text-rose-400'}>
                  {liveStatus.fullStatus}
                </span>
              </div>
            </div>

            {/* Quick Action Buttons: Get Directions, Call, WhatsApp */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
              {directionsUrl ? (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Get Google Maps Directions to Jainam Traders"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md active-press transition-colors"
                >
                  <Navigation className="w-4 h-4 text-white" />
                  <span>Get Directions</span>
                </a>
              ) : (
                <button
                  disabled
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-700 text-stone-400 text-xs font-medium cursor-not-allowed"
                  title="Shop location is being configured."
                >
                  Shop location is being configured.
                </button>
              )}

              {shop.phone ? (
                <a
                  href={`tel:${shop.phone.replace(/\s+/g, '')}`}
                  aria-label={`Call shop at ${shop.phone}`}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center justify-center gap-2 border border-stone-700 transition-colors"
                >
                  <Phone className="w-4 h-4 text-stone-400" />
                  <span>Call</span>
                </a>
              ) : null}

              {shop.whatsappNumber ? (
                <a
                  href={`https://wa.me/${shop.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Hi Jainam Traders, I have an inquiry regarding pickup')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat with Jainam Traders on WhatsApp"
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
              ) : null}
            </div>
          </div>

          {/* Opening Hours Strip */}
          <div className="mt-5 pt-4 border-t border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-semibold text-stone-300">Opening Hours:</span>
              <span>Mon–Sat: {formattedOpen} – {formattedClose}</span>
              <span className="text-stone-500">•</span>
              <span className="text-rose-400 font-medium">Closed on Sundays</span>
            </div>
            <Link
              href="/pickup-info"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 text-xs font-medium"
            >
              Pickup Guide & FAQs →
            </Link>
          </div>
        </div>

        {/* Supporting Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-xs text-stone-400">
          {/* Column 1: Retail Trust */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> Local Retail Store
            </h4>
            <p className="leading-relaxed mb-3">
              {shop.shopDescription || 'Serving our local community with curated gifts, frames, clocks, toys, and accessories. Reserve online and collect at our store counter.'}
            </p>
          </div>

          {/* Column 2: Pickup Philosophy */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-500" /> Inspect Before Paying
            </h4>
            <ul className="space-y-1.5">
              <li>1. Reserve products online (no advance card charge).</li>
              <li>2. Visit our store counter for pickup.</li>
              <li>3. Inspect items in person, then pay Cash or UPI.</li>
            </ul>
          </div>

          {/* Column 3: Contact & Support */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-400" /> Direct Assistance
            </h4>
            <div className="space-y-1.5">
              {shop.phone ? <p>Phone: <span className="text-stone-200 font-semibold">{shop.phone}</span></p> : null}
              {shop.whatsappNumber ? <p>WhatsApp: <span className="text-stone-200 font-semibold">{shop.whatsappNumber}</span></p> : null}
              {shop.email ? <p>Email: <span className="text-stone-200">{shop.email}</span></p> : null}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} {shop.shopName || 'Jainam Traders'}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Pay at Store Counter Only (Cash or UPI)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
