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
  Sparkles,
  Camera,
  Play,
} from 'lucide-react';
import ProductImage from '@/components/ui/product-image';
import { CustomerProductView, ProductVariant, Review } from '@/lib/types';
import { formatINR } from '@/lib/utils';
import { useCart } from '@/lib/context/cart-context';
import { useWishlist } from '@/lib/context/wishlist-context';
import { useAuth } from '@/lib/context/auth-context';
import { useSimpleMode } from '@/lib/context/simple-mode-context';
import { useShop } from '@/lib/context/shop-context';
import AuthModal from '@/components/auth/auth-modal';
import ProductCard from '@/components/store/product-card';
import { nativeShareProduct, triggerHaptic, capturePhotoOrPick } from '@/lib/native/capacitor-bridge';

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
  const [activeMedia, setActiveMedia] = useState<'image' | 'video'>('image');
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
  const [reviewPhoto, setReviewPhoto] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const isWishlisted = isInWishlist(product.id);
  const isAvailable = product.availability === 'AVAILABLE';

  const currentPrice = selectedVariant?.priceOverride || product.price;
  const discountPct = product.mrp > currentPrice ? Math.round(((product.mrp - currentPrice) / product.mrp) * 100) : 0;

  const { isSimpleMode } = useSimpleMode();
  const { shopSettings } = useShop();
  const [showSpecs, setShowSpecs] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeakProduct = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }
    let text = `इसकी कीमत ${currentPrice} रुपये है।`;
    if (product.mrp > currentPrice && discountPct > 0) {
      text += ` MRP ${product.mrp} रुपये है। आपको ${discountPct} प्रतिशत की बचत हो रही है।`;
    }
    text += ` यह दुकान पर ${isAvailable ? 'उपलब्ध है' : 'अभी उपलब्ध नहीं है'}।`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const [authMessage, setAuthMessage] = useState('Please sign in to reserve this item.');

  const handleAddToCart = () => {
    triggerHaptic('light');
    addItem(product, selectedVariant, quantity);
  };

  const handleReserveNow = () => {
    triggerHaptic('light');
    addItem(product, selectedVariant, quantity);
    if (!user) {
      setAuthMessage('Please sign in to reserve this item.');
      setIsAuthModalOpen(true);
      return;
    }
    router.push('/checkout');
  };

  const handleShare = async () => {
    const canonicalUrl = typeof window !== 'undefined' ? window.location.href : `https://jainamtraders.com/products/${product.slug}`;
    const shared = await nativeShareProduct(
      product.name,
      `Check out ${product.name} at Jainam Traders! Reserve online and pay at our shop counter.`,
      canonicalUrl
    );
    if (!shared && navigator.clipboard) {
      navigator.clipboard.writeText(canonicalUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const handlePickReviewPhoto = async () => {
    const photo = await capturePhotoOrPick();
    if (photo) {
      setReviewPhoto(photo);
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
          images: reviewPhoto ? [reviewPhoto] : [],
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

  const allImages = [product.thumbnailUrl, ...(product.images || [])]
    .filter((val): val is string => Boolean(val && val.trim().length > 0))
    .filter((val, idx, self) => self.indexOf(val) === idx);

  if (isSimpleMode) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-stone-700 font-bold px-4 py-2 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors"
        >
          ← वापस जाएं (Go Back)
        </button>

        <div className="bg-white rounded-3xl p-6 border-2 border-stone-200 shadow-md space-y-6">
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-sm">
            {activeMedia === 'video' && product.videoUrl ? (
              <video
                src={product.videoUrl}
                controls
                muted
                playsInline
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <ProductImage
                src={selectedImage}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 600px"
                categoryName={product.categoryName}
                className="object-cover"
              />
            )}
          </div>

          {product.videoUrl && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setActiveMedia(activeMedia === 'video' ? 'image' : 'video')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors border border-stone-200 shadow-2xs"
              >
                <Play className="w-4 h-4 text-brand-600 fill-current" />
                {activeMedia === 'video' ? '📷 फोटो देखें (View Photos)' : '▶ वीडियो देखें (Watch Video)'}
              </button>
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 leading-tight">
            {product.name}
          </h1>

          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-black text-brand-600">
              {formatINR(currentPrice)}
            </div>
            {product.mrp > currentPrice && (
              <div className="text-base text-stone-500 font-medium">
                पहले <span className="line-through">{formatINR(product.mrp)}</span>
              </div>
            )}
            {discountPct > 0 && (
              <div className="inline-block mt-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl font-black text-sm">
                🎉 {discountPct}% की बचत
              </div>
            )}
          </div>

          <div className="p-3 rounded-2xl text-center font-bold text-base">
            {isAvailable ? (
              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                🟢 दुकान पर उपलब्ध है (Available at Shop)
              </span>
            ) : (
              <span className="text-rose-700 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                🔴 अभी उपलब्ध नहीं है (Currently Out of Stock)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => toggleWishlist(product)}
              className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-black text-sm sm:text-base border-2 transition-all ${
                isWishlisted
                  ? 'bg-rose-50 text-rose-600 border-rose-300'
                  : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <span className="text-2xl">❤️</span>
              <span>{isWishlisted ? 'पसंद सूची में है' : 'पसंद करें'}</span>
            </button>

            <button
              type="button"
              onClick={handleSpeakProduct}
              className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-black text-sm sm:text-base border-2 transition-all ${
                isSpeaking
                  ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                  : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className="text-2xl">🎤</span>
              <span>{isSpeaking ? 'रुकें' : 'सुनें (Listen)'}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={!isAvailable}
            onClick={handleReserveNow}
            className="w-full py-5 bg-brand-600 hover:bg-brand-700 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-2xl text-lg sm:text-xl font-black shadow-lg shadow-brand-600/30 flex items-center justify-center gap-3 transition-transform active:scale-95"
          >
            <span className="text-2xl">🛍️</span>
            <span>दुकान पर रखें (Reserve at Shop)</span>
          </button>

          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center text-sm font-medium text-stone-600">
            💡 पैसे अभी ऑनलाइन नहीं देने हैं। दुकान पर आकर सामान देखकर Cash या UPI से भुगतान करें।
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <a
              href={`tel:${shopSettings.phone}`}
              className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 font-bold text-center flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
            >
              <span className="text-xl">📞</span>
              <span>दुकान पर फोन करें</span>
            </a>
            <a
              href={`https://wa.me/${shopSettings.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`नमस्ते, मुझे "${product.name}" के बारे में पूछना है।`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 font-bold text-center flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
            >
              <span className="text-xl">💬</span>
              <span>WhatsApp पर पूछें</span>
            </a>
          </div>

          <div className="border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={() => setShowSpecs(!showSpecs)}
              className="w-full py-3 px-4 bg-stone-100 hover:bg-stone-200 rounded-xl font-bold text-stone-800 text-sm flex items-center justify-between transition-colors"
            >
              <span>{showSpecs ? '▲ कम जानकारी देखें' : '▼ और जानकारी देखें (More Details)'}</span>
            </button>

            {showSpecs && (
              <div className="mt-4 space-y-3 text-sm text-stone-700 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <p className="leading-relaxed">{product.description}</p>
                {product.brand && (
                  <div><strong className="text-stone-900">ब्रांड:</strong> {product.brand}</div>
                )}
                {product.material && (
                  <div><strong className="text-stone-900">सामग्री:</strong> {product.material}</div>
                )}
                {product.dimensions && (
                  <div><strong className="text-stone-900">नाप (Dimensions):</strong> {product.dimensions}</div>
                )}
                <div className="text-xs text-stone-500 pt-2 border-t border-stone-200">
                  दुकान का पता: {shopSettings.shortAddress}, {shopSettings.city}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* 1. MAIN PRODUCT DETAILS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-sm">
        {/* Left: Gallery */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-inner group">
            {activeMedia === 'video' && product.videoUrl ? (
              <video
                src={product.videoUrl}
                controls
                muted
                playsInline
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <ProductImage
                src={selectedImage}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                categoryName={product.categoryName}
                className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
              />
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10 pointer-events-none">
              {discountPct > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-brand-600 text-white shadow-md">
                  {discountPct}% OFF
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
          {(allImages.length > 1 || product.videoUrl) && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedImage(img);
                    setActiveMedia('image');
                  }}
                  className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                    activeMedia === 'image' && selectedImage === img
                      ? 'border-brand-600 shadow-md scale-102 ring-2 ring-brand-500/20'
                      : 'border-stone-200 hover:border-stone-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <ProductImage
                    src={img}
                    alt={`${product.name} thumb ${idx + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}

              {product.videoUrl && (
                <button
                  type="button"
                  onClick={() => setActiveMedia('video')}
                  className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border-2 flex flex-col items-center justify-center gap-1 bg-stone-900 text-white transition-all ${
                    activeMedia === 'video'
                      ? 'border-brand-600 ring-2 ring-brand-500 shadow-md scale-102'
                      : 'border-stone-700 opacity-80 hover:opacity-100'
                  }`}
                  title="Watch Product Video"
                >
                  <Play className="w-5 h-5 text-brand-400 fill-current" />
                  <span className="text-[10px] font-black tracking-wider">VIDEO</span>
                </button>
              )}
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
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 space-y-2">
              <div className="flex flex-wrap items-baseline gap-4 sm:gap-6">
                <div>
                  <span className="text-xs font-bold text-stone-500 block">Special Price:</span>
                  <span className="text-2xl sm:text-3xl font-black text-stone-900">
                    {formatINR(currentPrice)}
                  </span>
                </div>
                {product.mrp > currentPrice && (
                  <div>
                    <span className="text-xs font-medium text-stone-400 block">MRP:</span>
                    <span className="text-base sm:text-lg text-stone-400 line-through">
                      {formatINR(product.mrp)}
                    </span>
                  </div>
                )}
                {discountPct > 0 && (
                  <div className="self-end pb-1">
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
                      {discountPct}% OFF
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-stone-500">Inclusive of all local shop taxes. Pay at Jainam Traders counter.</p>
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

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Add Product Photo (Optional)
                </label>
                {reviewPhoto ? (
                  <div className="flex items-center gap-3 p-2 bg-stone-50 border border-stone-200 rounded-xl">
                    <img src={reviewPhoto} alt="Review attachment" className="w-12 h-12 object-cover rounded-lg" />
                    <span className="text-xs text-emerald-700 font-bold">Photo attached</span>
                    <button
                      type="button"
                      onClick={() => setReviewPhoto(null)}
                      className="text-stone-400 hover:text-rose-600 text-xs ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handlePickReviewPhoto}
                    className="w-full py-2.5 px-3 border-2 border-dashed border-stone-300 hover:border-brand-500 rounded-xl text-xs font-bold text-stone-600 hover:text-brand-600 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Camera className="w-4 h-4" /> Take Photo / Pick from Gallery
                  </button>
                )}
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

      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => router.push('/checkout')}
          message={authMessage}
        />
      )}
    </div>
  );
}
