'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star, ShoppingBag, Check } from 'lucide-react';
import ProductImage from '@/components/ui/product-image';
import { CustomerProductView } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import { useCart } from '@/lib/context/cart-context';
import { useWishlist } from '@/lib/context/wishlist-context';

interface ProductCardProps {
  product: CustomerProductView;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, items } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const isWishlisted = isInWishlist(product.id);
  const isInCart = items.some((i) => i.productId === product.id);
  const isAvailable = product.availability === 'AVAILABLE';

  // Automatically calculate discount percentage from MRP and Selling Price (Never hardcoded)
  const calculatedDiscount =
    product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <div className="group bg-white rounded-2xl border border-stone-200/90 shadow-sm hover:shadow-elevated transition-all duration-200 flex flex-col overflow-hidden relative">
      {/* Image & Badges */}
      <div className="relative aspect-square w-full bg-stone-100 overflow-hidden">
        <Link href={`/products/${product.slug}`} className="block w-full h-full">
          <ProductImage
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            categoryName={product.categoryName}
            className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {calculatedDiscount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold bg-brand-600 text-white shadow-sm">
              {calculatedDiscount}% OFF
            </span>
          )}
          {product.isBestSeller && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-stone-900 shadow-sm">
              BESTSELLER
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product);
          }}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm transition-all z-10 ${
            isWishlisted
              ? 'bg-rose-50 text-rose-600 border border-rose-200'
              : 'bg-white/80 text-stone-600 hover:text-rose-600 hover:bg-white'
          }`}
          title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Stock status banner (Strictly NO raw numbers shown to customer!) */}
        <div className="absolute bottom-2 left-2 right-2">
          {isAvailable ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" /> Available for pickup
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-900/80 text-stone-300 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5" /> Currently unavailable
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Category */}
          <div className="flex items-center justify-between text-[11px] font-medium text-stone-500 mb-1">
            <span className="truncate max-w-[120px]">{product.brand}</span>
            {product.averageRating && (
              <div className="flex items-center gap-0.5 text-amber-600 font-bold">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{product.averageRating}</span>
                {product.reviewCount && <span className="text-stone-400 text-[10px]">({product.reviewCount})</span>}
              </div>
            )}
          </div>

          {/* Title */}
          <Link href={`/products/${product.slug}`}>
            <h3 className="font-semibold text-xs sm:text-sm text-stone-900 line-clamp-2 hover:text-brand-600 transition-colors leading-snug">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Pricing & Add to Cart */}
        <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-extrabold text-stone-900">
                {formatINR(product.price)}
              </span>
              {product.mrp > product.price && (
                <span className="text-[11px] text-stone-400 line-through">
                  {formatINR(product.mrp)}
                </span>
              )}
            </div>
            <span className="text-[10px] text-amber-700 font-medium">Pay at Shop</span>
          </div>

          <button
            type="button"
            disabled={!isAvailable}
            onClick={() => addItem(product)}
            className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1 active-press transition-all ${
              !isAvailable
                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                : isInCart
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                : 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20'
            }`}
            title="Add to Pickup Cart"
          >
            {isInCart ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Added</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reserve</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
