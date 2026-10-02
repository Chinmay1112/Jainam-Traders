import React from 'react';
import Link from 'next/link';
import { Home, Search, ShoppingBag } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-12">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mb-6">
        <ShoppingBag className="w-8 h-8" />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-3 py-1 rounded-full mb-3">
        Page Not Found
      </span>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 mb-3 font-display">
        Looking for a Gift or Item?
      </h1>
      <p className="text-stone-600 max-w-md text-sm sm:text-base mb-8">
        We couldn&apos;t find the page or order you were looking for. Browse our active catalogue or search for gifts, clocks, and frames.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-sm active-press transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Return Home</span>
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 font-semibold text-sm border border-stone-300 active-press transition-all"
        >
          <Search className="w-4 h-4" />
          <span>Search Catalogue</span>
        </Link>
      </div>
    </div>
  );
}
