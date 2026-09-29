'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { useWishlist } from '@/lib/context/wishlist-context';
import { formatINR } from '@/lib/utils';

export default function WishlistPage() {
  const { items, removeFromWishlist, moveToCart } = useWishlist();

  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <Heart className="w-6 h-6 text-brand-600 fill-brand-600" />
            My Wishlist
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Items you have saved to inspect or reserve later.
          </p>
        </div>
        <span className="text-xs font-bold text-stone-500 bg-white px-3 py-1.5 rounded-xl border border-stone-200">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 max-w-md mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4">
            <Heart className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-stone-900">Your wishlist is currently empty</h2>
          <p className="text-xs text-stone-500 mt-1 mb-6">
            Tap the heart icon on any photo frame, clock, or gift to save it for later.
          </p>
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 active-press"
          >
            <span>Explore Gift Collections</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((product) => {
            const isAvailable = product.availability === 'AVAILABLE';
            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-stone-200 p-4 flex gap-4 shadow-sm hover:shadow-elevated transition-all"
              >
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                  <Image src={product.thumbnailUrl} alt={product.name} fill className="object-cover" />
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-stone-900 line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-[11px] text-stone-500">{product.brand}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-sm font-extrabold text-stone-900">{formatINR(product.price)}</span>
                      {product.mrp > product.price && (
                        <span className="text-[11px] text-stone-400 line-through">
                          {formatINR(product.mrp)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => moveToCart(product)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active-press ${
                        isAvailable
                          ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
                          : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{isAvailable ? 'Move to Cart' : 'Unavailable'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromWishlist(product.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
