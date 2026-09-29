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
} from 'lucide-react';
import { getCustomerProducts, getCategories, getShopSettings } from '@/lib/db/store-service';
import ProductCard from '@/components/store/product-card';
import { formatINR } from '@/lib/utils';

export default async function HomePage() {
  const [categories, featuredResult, newArrivalsResult, bestSellersResult, settings] = await Promise.all([
    getCategories(),
    getCustomerProducts({ featured: true, limit: 8 }),
    getCustomerProducts({ newArrival: true, limit: 4 }),
    getCustomerProducts({ bestSeller: true, limit: 8 }),
    getShopSettings(),
  ]);

  return (
    <div className="space-y-10 sm:space-y-16">
      {/* 1. HERO BANNER SECTION */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 text-white shadow-elevated border border-stone-800">
        <div className="absolute inset-0 opacity-25 mix-blend-overlay">
          <Image
            src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1600&auto=format&fit=crop&q=80"
            alt="Jainam Traders Gift Collection"
            fill
            priority
            className="object-cover"
          />
        </div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl" />

        <div className="relative z-10 max-w-3xl px-6 py-10 sm:px-12 sm:py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Local Retail Store • 18+ Years of Trust</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4">
            Curated Gifts, Clocks & Frames For Every Occasion.
          </h1>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
            Browse our entire retail catalogue online. Reserve your favorites with zero advance payment,
            inspect the products in person, and pay cash or UPI at our Main Bazar shop.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/categories"
              className="px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/30 flex items-center gap-2 active-press transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Explore Catalogue</span>
            </Link>

            <Link
              href="/pickup-info"
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-semibold backdrop-blur-md flex items-center gap-2 transition-colors"
            >
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Shop Location & Timings</span>
            </Link>
          </div>

          {/* Quick Pillars */}
          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-3 gap-3 text-center sm:text-left">
            <div>
              <p className="text-base sm:text-lg font-bold text-amber-400">100%</p>
              <p className="text-[11px] text-stone-400">In-Person Inspection</p>
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-amber-400">₹0</p>
              <p className="text-[11px] text-stone-400">Advance Fees</p>
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-amber-400">3 Days</p>
              <p className="text-[11px] text-stone-400">Counter Hold Period</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORIES SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-stone-900 tracking-tight">
              Explore Collections
            </h2>
            <p className="text-xs sm:text-sm text-stone-500">Pick from our hand-curated store departments</p>
          </div>
          <Link
            href="/categories"
            className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.slice(0, 6).map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group bg-white rounded-2xl p-3 sm:p-4 border border-stone-200/90 shadow-sm hover:shadow-elevated hover:border-brand-500/40 transition-all text-center flex flex-col items-center justify-between"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-stone-100 group-hover:bg-brand-50 flex items-center justify-center text-brand-600 mb-2 overflow-hidden relative transition-colors">
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={cat.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <Gift className="w-6 h-6" />
                )}
              </div>
              <h3 className="font-semibold text-xs sm:text-sm text-stone-900 group-hover:text-brand-600 transition-colors line-clamp-1">
                {cat.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. FEATURED STORE ITEMS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700 mb-0.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Recommended Picks</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-stone-900 tracking-tight">
              Featured For Store Pickup
            </h2>
          </div>
          <Link
            href="/search?featured=true"
            className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <span>See More</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {featuredResult.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 4. VALUE DEALS UNDER ₹699 */}
      <section className="rounded-3xl bg-gradient-to-r from-amber-500/10 via-brand-500/10 to-amber-500/10 border border-amber-300/60 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase bg-amber-600 text-white">
              POCKET FRIENDLY
            </span>
            <h3 className="text-xl sm:text-2xl font-display font-bold text-stone-900 mt-2">
              Top Gift Ideas Under ₹699
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              Thoughtful mementos, desk clocks, journals and accessories ready at our counter.
            </p>
          </div>
          <Link
            href="/search?maxPrice=699"
            className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow active-press"
          >
            View All Under ₹699
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {bestSellersResult.products
            .filter((p) => p.price <= 699)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>

      {/* 5. BEST SELLERS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 mb-0.5">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>Customer Favorites</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-stone-900 tracking-tight">
              Best Sellers in Main Bazar
            </h2>
          </div>
          <Link
            href="/search?bestSeller=true"
            className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {bestSellersResult.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 6. WHY JAINAM TRADERS - LOCAL TRUST PILLARS */}
      <section className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-sm">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">
            AUTHENTIC LOCAL COMMERCE
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 mt-1">
            Why Shop with Jainam Traders?
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            We combine the convenience of modern online browsing with the peace of mind of a physical shop.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-stone-900 mb-1">Zero Advance Risk</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Reserve your items online. Never worry about fake deliveries or refund delays. Pay only after touching and inspecting.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-800 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-stone-900 mb-1">Pre-Inspected & Tested</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Clocks are tested with fresh batteries, frames checked for zero scratches, and mementos carefully packed before your arrival.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-stone-900 mb-1">Quick 3-Day Counter Hold</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Orders are placed on hold for up to 3 days. Visit at your convenience during regular store hours (09:30 - 21:30).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center mb-3">
              <Phone className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-stone-900 mb-1">Direct Store Help</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Speak directly with our store staff via WhatsApp or Phone anytime. Real people who know every item in stock.
            </p>
          </div>
        </div>
      </section>

      {/* 7. PHYSICAL SHOP LOCATION & PICKUP BANNER */}
      <section className="rounded-3xl bg-stone-900 text-white p-6 sm:p-10 border border-stone-800 shadow-elevated">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              PHYSICAL STORE ADDRESS
            </span>
            <h3 className="text-2xl sm:text-3xl font-display font-extrabold mt-3 mb-2">
              Visit Our Main Bazar Counter
            </h3>
            <p className="text-sm text-stone-300 mb-4 leading-relaxed">
              {settings.shopAddress}
            </p>

            <div className="space-y-2 text-xs text-stone-400 mb-6">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Monday to Saturday: {settings.openingTime} AM – {settings.closingTime} PM</span>
              </div>
              <div className="text-rose-400 font-medium pl-6">
                Closed on Sundays (and designated market holidays)
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={settings.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-colors"
              >
                <Navigation className="w-4 h-4" /> Open in Google Maps
              </a>
              <a
                href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-colors"
              >
                <Phone className="w-4 h-4" /> Message on WhatsApp
              </a>
            </div>
          </div>

          <div className="relative h-64 sm:h-80 rounded-2xl overflow-hidden border border-stone-700 bg-stone-800">
            <Image
              src="https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80"
              alt="Jainam Traders Physical Store Counter"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-5">
              <div className="text-xs">
                <p className="font-bold text-white text-sm">Pickup Counter at Mahaveer Market</p>
                <p className="text-stone-300">Show your digital order QR code or JT order number upon arrival.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
