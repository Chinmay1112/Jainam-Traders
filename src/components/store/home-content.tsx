'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Clock,
  Phone,
  Gift,
  Star,
  CheckCircle2,
  Navigation,
  Store,
} from 'lucide-react';
import { Category, CustomerProductView } from '@/lib/types';
import ProductCard from '@/components/store/product-card';
import { useSimpleMode } from '@/lib/context/simple-mode-context';
import { useShop } from '@/lib/context/shop-context';
import AasaanModeView from '@/components/store/aasaan-mode-view';
import { getShopDirectionsUrl, getStoreLiveStatus, formatTime12h } from '@/lib/utils';

interface HomeContentProps {
  categories: Category[];
  featuredProducts: CustomerProductView[];
  newArrivals: CustomerProductView[];
  bestSellers: CustomerProductView[];
}

export default function HomeContent({
  categories,
  featuredProducts,
  newArrivals,
  bestSellers,
}: HomeContentProps) {
  const { isSimpleMode } = useSimpleMode();
  const shop = useShop();

  if (isSimpleMode) {
    return <AasaanModeView />;
  }

  return (
    <div className="space-y-10 sm:space-y-16">
      {/* 1. HERO BANNER SECTION */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 text-white shadow-elevated border border-stone-800">
        <div className="absolute inset-0 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl" />

        <div className="relative z-10 max-w-3xl px-6 py-10 sm:px-12 sm:py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Local Retail Store • Pay at Counter</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4">
            Curated Gifts, Clocks & Frames For Every Occasion.
          </h1>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
            Browse our entire retail catalogue online. Reserve your favorites with zero advance payment,
            inspect the products in person, and pay cash or UPI at our {shop.shortAddress} counter.
          </p>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href="/categories"
              className="px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-600/30 flex items-center gap-2 active-press transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Browse All Collections</span>
            </Link>

            <Link
              href="/pickup-info"
              className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm backdrop-blur-md border border-white/20 flex items-center gap-2 active-press transition-all"
            >
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Pickup Instructions</span>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-8 mt-8 border-t border-white/10 text-xs">
            <div>
              <p className="font-extrabold text-lg text-amber-400">Zero Advance</p>
              <p className="text-stone-400">Pay only when you inspect at shop</p>
            </div>
            <div>
              <p className="font-extrabold text-lg text-emerald-400">30 Min Ready</p>
              <p className="text-stone-400">Staff packs & tests your item</p>
            </div>
            <div>
              <p className="font-extrabold text-lg text-brand-300">100% Genuine</p>
              <p className="text-stone-400">Inspected quality guarantee</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. EXPLORE CATEGORIES */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight">
              Explore Collections
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Select department to browse available counter items
            </p>
          </div>
          <Link
            href="/categories"
            className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.slice(0, 6).map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-brand-500 shadow-soft hover:shadow-elevated transition-all flex flex-col items-center text-center"
            >
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden mb-3 bg-amber-500/10 border border-amber-500/20 group-hover:scale-105 transition-transform flex items-center justify-center text-amber-600">
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={cat.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="text-xl sm:text-2xl font-black">{cat.name.slice(0, 1)}</span>
                )}
              </div>
              <h3 className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-brand-600 line-clamp-1 transition-colors">
                {cat.name}
              </h3>
              <span className="text-[10px] text-stone-600 mt-1 group-hover:text-stone-900 font-medium transition-colors">
                Browse Items &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. VALUE PROPOSITION TILES */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-stone-900 mb-1">Free Gift Packing</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Complimentary gift wrapping with ribbons on all mementos, watches, and photo frames.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-stone-900 mb-1">In-Person Inspection</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Touch, test and examine items at our counter before paying single rupee.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-stone-900 mb-1">Pay at Shop (Cash/UPI)</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Pay via Google Pay, PhonePe, Paytm, or Cash directly at our store counter.
            </p>
          </div>
        </div>
      </section>

      {/* 4. FEATURED PRODUCTS GRID */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
              <h2 className="text-xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight">
                Featured For Local Pickup
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Top curated items ready for pickup today
            </p>
          </div>
          <Link
            href="/search?featured=true"
            className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 5. BEST SELLERS */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <h2 className="text-xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight">
                Best Sellers in {shop.shortAddress}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Customer favorites with highest ratings and verified purchases
            </p>
          </div>
          <Link
            href="/search?bestSeller=true"
            className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {bestSellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 6. PHYSICAL STORE COUNTER LOCATION & DIRECTIONS */}
      <section className="bg-stone-900 text-white rounded-3xl p-6 sm:p-10 border border-stone-800 shadow-elevated">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              PHYSICAL STORE ADDRESS
            </span>
            <h3 className="text-2xl sm:text-3xl font-display font-extrabold mt-3 mb-2">
              Visit Our {shop.shortAddress} Counter
            </h3>
            <p className="text-sm text-stone-300 mb-3 leading-relaxed">
              {shop.shopAddress}
            </p>

            {/* Live Store Status */}
            <div className="flex items-center gap-2 mb-4 text-xs font-bold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  getStoreLiveStatus(shop).isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span className={getStoreLiveStatus(shop).isOpen ? 'text-emerald-400' : 'text-rose-400'}>
                {getStoreLiveStatus(shop).fullStatus}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-stone-400 mb-6">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>
                  Monday to Saturday: {formatTime12h(shop.openingTime || '07:30')} – {formatTime12h(shop.closingTime || '21:30')}
                </span>
              </div>
              <div className="text-rose-400 font-medium pl-6">
                Closed on Sundays (and designated market holidays)
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {getShopDirectionsUrl(shop) ? (
                <a
                  href={getShopDirectionsUrl(shop)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-colors"
                >
                  <Navigation className="w-4 h-4" /> Get Directions
                </a>
              ) : (
                <span className="px-5 py-3 bg-stone-750 text-stone-400 rounded-xl text-xs font-medium">
                  Shop location is being configured.
                </span>
              )}
              {shop.whatsappNumber ? (
                <a
                  href={`https://wa.me/${shop.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Hi Jainam Traders, I have an inquiry regarding pickup')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-colors"
                >
                  <Phone className="w-4 h-4" /> Message on WhatsApp
                </a>
              ) : null}
            </div>
          </div>

          <div className="relative h-64 sm:h-80 rounded-2xl overflow-hidden border border-stone-700 bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Store className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Direct Counter Pickup
              </span>
            </div>
            <div className="space-y-2">
              <p className="font-extrabold text-white text-base">Pickup Counter at {shop.shortAddress}</p>
              <p className="text-stone-300 text-xs leading-relaxed">{shop.shopAddress}</p>
              <p className="text-amber-400 text-xs font-bold pt-1">
                Show your digital order QR code or JT order number upon arrival.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
