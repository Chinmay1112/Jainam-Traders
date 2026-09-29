import React from 'react';
import Link from 'next/link';
import { MapPin, Phone, MessageSquare, Clock, ShieldCheck, Sparkles, Navigation } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300 pt-12 pb-8 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Column 1: Store Intro & Trust */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-base shadow">
                JT
              </div>
              <span className="font-display font-bold text-xl text-white">Jainam Traders</span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed mb-4">
              Your trusted local destination for handcrafted photo frames, silent quartz clocks, brass idols,
              mementos, perfumes, executive stationery, and luxury gift hampers.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-800/80 border border-stone-700 text-amber-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Local Retail Shop • Pay at Counter</span>
            </div>
          </div>

          {/* Column 2: Physical Store Location & Timing */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-500" /> Visit Our Store
            </h4>
            <address className="not-italic text-xs text-stone-400 leading-relaxed mb-3">
              Shop No. 4 & 5, Mahaveer Market,
              <br />
              Main Bazar Road, Near Clock Tower
            </address>
            <div className="space-y-1.5 text-xs text-stone-400 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>09:30 AM – 09:30 PM (Mon - Sat)</span>
              </div>
              <div className="text-rose-400 font-medium pl-5.5">Closed on Sundays</div>
            </div>
            <a
              href="https://maps.google.com/?q=Jainam+Traders+Main+Bazar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 underline underline-offset-4"
            >
              <Navigation className="w-3.5 h-3.5" /> Get Google Maps Directions
            </a>
          </div>

          {/* Column 3: Contact & Direct Connect */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-500" /> Connect With Us
            </h4>
            <div className="space-y-3">
              <a
                href="https://wa.me/919876543210?text=Hi%20Jainam%20Traders,%20I%20have%20an%20inquiry%20regarding%20pickup"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/40 text-xs font-semibold transition-colors"
              >
                <MessageSquare className="w-4 h-4" /> Chat on WhatsApp
              </a>
              <a
                href="tel:+919876543210"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700/80 text-stone-200 text-xs font-semibold transition-colors"
              >
                <Phone className="w-4 h-4 text-stone-400" /> Call +91 98765 43210
              </a>
              <p className="text-[11px] text-stone-500">Email: contact@jainamtraders.com</p>
            </div>
          </div>

          {/* Column 4: Pickup Philosophy */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-500" /> Pickup Model
            </h4>
            <ul className="space-y-2 text-xs text-stone-400">
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">1.</span>
                <span>Browse our online catalog and reserve items in your cart.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">2.</span>
                <span>We inspect, test and pack your order at the shop.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">3.</span>
                <span>Collect in person and pay via Cash or UPI at our counter.</span>
              </li>
            </ul>
            <div className="mt-4 pt-3 border-t border-stone-800 flex gap-4 text-xs text-stone-400">
              <Link href="/pickup-info" className="hover:text-white underline">
                Pickup FAQ
              </Link>
              <Link href="/admin" className="hover:text-amber-400 font-medium">
                Admin Portal
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} Jainam Traders. All rights reserved. Built for local retail excellence.</p>
          <div className="flex items-center gap-4">
            <span>Pay at Shop Only (No Advance Online Payments)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
