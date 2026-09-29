'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Star,
  Heart,
  ShoppingBag,
  ShieldCheck,
  MapPin,
  Clock,
  ArrowRight,
  Share2,
  CheckCircle2,
  Tag,
  Info,
  Sparkles,
} from 'lucide-react';
import { CustomerProductView, ProductVariant, Review } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import { useCart } from '@/lib/context/cart-context';
import { useWishlist } from '@/lib/context/wishlist-context';
import { useAuth } from '@/lib/context/auth-context';
import AuthModal from '@/components/auth/auth-modal';
import ProductCard from '@/components/store/product-card';

interface ProductDetailViewProps {
  product: CustomerProductView;
  reviews: Review[];
  relatedProducts: CustomerProductView[];
}

export default function ProductDetailView({ product, reviews, relatedProducts }: ProductDetailViewProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { user } = useAuth();

  const [selectedImage, setSelectedImage] = useState(product.thumbnailUrl);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    product.variants && product.variants.length > 0 ? product.variants[0] : undefined
  );
  const [quantity, setQuantity] = useState(1);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Review submission state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrderNumber, setReviewOrderNumber] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const isWishlisted = isInWishlist(product.id);
  const isAvailable = product.availability === 'AVAILABLE';

  const currentPrice = selectedVariant?.priceOverride || product.price;

  const handleAddToCart = () => {
    addItem(product, selectedVariant, quantity);
  };

  const handleReserveNow = () => {
    addItem(product, selectedVariant, quantity);
    router.push('/checkout');
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSubmittingReview(true);
    setReviewError('');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          customerId: user.id,
          customerName: user.fullName,
          orderNumber: reviewOrderNumber.trim(),
          rating: reviewRating,
          title: reviewTitle.trim(),
          comment: reviewComment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      setReviewSuccess(true);
      setTimeout(() => {
        setShowReviewModal(false);
        setReviewSuccess(false);
      }, 2000);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Review submission failed');
    } finally {
      setSubmittingReview(false);
    }
  };

  const allImages = [product.thumbnailUrl, ...(product.images || [])].filter(
    (val, idx, self) => self.indexOf(val) === idx
  );

  return (
    <div className="space-y-12">
      {/* 1. MAIN PRODUCT DETAILS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-sm">
        {/* Left: Gallery */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-inner group">
            <Image
              src={selectedImage}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
            />

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
              {product.discountPercentage > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-brand-600 text-white shadow-md">
                  SAVE {product.discountPercentage}%
                </span>
              )}
              {product.isBestSeller && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-stone-900 shadow-md">
                  BEST SELLER
                </span>
              )}
            </div>

            {/* Share and Wishlist Floating actions */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                className={`p-2.5 rounded-full backdrop-blur-md shadow-md transition-all ${
                  isWishlisted
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-white/80 text-stone-700 hover:text-rose-600 hover:bg-white'
                }`}
                title={isWishlisted ? 'Remove from wishlist' : 'Save to Wishlist'}
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="p-2.5 rounded-full bg-white/80 backdrop-blur-md text-stone-700 hover:text-stone-900 hover:bg-white shadow-md transition-all"
                title="Share product link"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
            {copiedShare && (
              <span className="absolute bottom-4 right-4 bg-stone-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow">
                Link Copied!
              </span>
            )}
          </div>

          {/* Thumbnail list */}
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImage(img)}
                  className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                    selectedImage === img
                      ? 'border-brand-600 shadow-md scale-102'
                      : 'border-stone-200 hover:border-stone-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Image src={img} alt={`${product.name} thumb ${idx}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info, Price, Variants & Actions */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Category & SKU */}
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold uppercase tracking-wider text-brand-700">
                {product.brand}
              </span>
              <span className="font-mono text-stone-400">SKU: {product.sku}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 leading-tight">
              {product.name}
            </h1>

            {/* Rating */}
            {product.averageRating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                  <span className="text-xs font-bold text-amber-900">{product.averageRating}</span>
                </div>
                <span className="text-xs text-stone-500">
                  Based on {product.reviewCount || 1} verified customer pickup reviews
                </span>
              </div>
            )}

            {/* Price section */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 space-y-1">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-black text-stone-900">
                  {formatINR(currentPrice)}
                </span>
                {product.mrp > currentPrice && (
                  <span className="text-sm sm:text-base text-stone-400 line-through">
                    {formatINR(product.mrp)}
                  </span>
                )}
                {product.discountPercentage > 0 && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {product.discountPercentage}% OFF
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">Inclusive of all local shop taxes.</p>
            </div>

            {/* Availability status (Strictly Rule 10: NO RAW STOCK NUMBERS) */}
            <div className="flex items-center gap-2">
              {isAvailable ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Available for pickup</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-300">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Currently unavailable</span>
                </div>
              )}
              <span className="text-xs text-stone-500">• Ready at Jainam Traders counter</span>
            </div>

            {/* Variant Selector */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Select {product.variants[0].variantType.toUpperCase()}:
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedVariant?.id === v.id
                          ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                          : 'bg-stone-50 text-stone-800 hover:bg-stone-100 border-stone-300'
                      }`}
                    >
                      {v.title}
                      {v.priceOverride && ` - ${formatINR(v.priceOverride)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description Preview */}
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed pt-2">
              {product.description}
            </p>

            {/* CRITICAL PICKUP POLICY BANNER */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>STORE PICKUP ONLY • ZERO ADVANCE PAYMENT</span>
              </div>
              <p className="text-xs text-amber-800 leading-tight">
                Payment will be collected at Jainam Traders when you collect your order.
                You are encouraged to inspect and test the item before paying cash or UPI.
              </p>
            </div>
          </div>

          {/* Actions: Quantity + Add to Cart + Reserve Now */}
          <div className="space-y-3 pt-4 border-t border-stone-200">
            <div className="flex items-center gap-3">
              {/* Quantity */}
              <div className="flex items-center border border-stone-300 rounded-xl bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-stone-700 hover:bg-white"
                >
                  -
                </button>
                <span className="w-10 text-center font-bold text-xs sm:text-sm text-stone-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(product.maxOrderQuantity || 10, quantity + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-stone-700 hover:bg-white"
                >
                  +
                </button>
              </div>

              {/* Add to Cart */}
              <button
                type="button"
                disabled={!isAvailable}
                onClick={handleAddToCart}
                className="flex-1 py-3.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-xs sm:text-sm font-bold shadow active-press flex items-center justify-center gap-2 transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Pickup Cart</span>
              </button>
            </div>

            {/* Instant Reserve / Checkout Now */}
            <button
              type="button"
              disabled={!isAvailable}
              onClick={handleReserveNow}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 active-press flex items-center justify-center gap-2 transition-all"
            >
              <span>Reserve Now & Pick Up at Shop</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. SPECIFICATIONS TABLE */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-sm space-y-4">
        <h3 className="text-lg sm:text-xl font-display font-extrabold text-stone-900">
          Product Specifications
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {product.brand && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block mb-0.5">Brand / Collection</span>
              <span className="font-bold text-stone-900">{product.brand}</span>
            </div>
          )}
          {product.material && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block mb-0.5">Primary Material</span>
              <span className="font-bold text-stone-900">{product.material}</span>
            </div>
          )}
          {product.colour && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block mb-0.5">Colour / Polish</span>
              <span className="font-bold text-stone-900">{product.colour}</span>
            </div>
          )}
          {product.dimensions && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block mb-0.5">Dimensions</span>
              <span className="font-bold text-stone-900">{product.dimensions}</span>
            </div>
          )}
          {product.weight && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block mb-0.5">Approx Weight</span>
              <span className="font-bold text-stone-900">{product.weight}</span>
            </div>
          )}
          {product.occasion && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block mb-0.5">Recommended Occasion</span>
              <span className="font-bold text-stone-900">{product.occasion}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. VERIFIED CUSTOMER REVIEWS */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-display font-extrabold text-stone-900">
              Verified Customer Reviews
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Genuine feedback from customers who collected and paid for this product at our shop.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!user) {
                setIsAuthModalOpen(true);
              } else {
                setShowReviewModal(true);
              }
            }}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold active-press transition-colors"
          >
            Write a Verified Review
          </button>
        </div>

        {reviews.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-500">
            No reviews yet for this product. Be the first to collect it from our shop and leave feedback!
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < rev.rating ? 'fill-amber-400 text-amber-500' : 'text-stone-300'
                          }`}
                        />
                      ))}
                    </div>
                    {rev.title && <h4 className="font-bold text-xs sm:text-sm text-stone-900">{rev.title}</h4>}
                  </div>
                  <span className="text-[11px] text-stone-400">
                    {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <p className="text-xs text-stone-700 leading-relaxed">{rev.comment}</p>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-stone-900">{rev.customerName}</span>
                  {rev.isVerifiedPurchase && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified Shop Purchase
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. RELATED PRODUCTS */}
      {relatedProducts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-display font-extrabold text-stone-900">
            You Might Also Like
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* Review Submission Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-stone-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">Submit Verified Review</h3>
            <p className="text-xs text-stone-500">
              Only verified pickups can be reviewed. Please enter your Order ID (JT-...) from your receipt.
            </p>

            {reviewError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {reviewError}
              </div>
            )}
            {reviewSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-bold">
                Review submitted successfully! Thank you.
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Order Number (e.g. JT-2026-000101)
                </label>
                <input
                  type="text"
                  required
                  placeholder="JT-2026-000101"
                  value={reviewOrderNumber}
                  onChange={(e) => setReviewOrderNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= reviewRating ? 'fill-amber-400 text-amber-500' : 'text-stone-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Review Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Beautiful finishing, solid wood"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Feedback / Comments
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Share details about the quality, pickup experience..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="w-1/3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAuthModalOpen && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />}
    </div>
  );
}
