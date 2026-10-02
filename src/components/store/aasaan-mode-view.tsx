'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingBag,
  Mic,
  Search,
  Heart,
  ShoppingCart,
  Package,
  MapPin,
  Phone,
  Volume2,
  ArrowRight,
  MessageSquare,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { useSimpleMode } from '@/lib/context/simple-mode-context';
import { useShop } from '@/lib/context/shop-context';
import { useAuth } from '@/lib/context/auth-context';
import { useLanguage, LanguageSwitch } from '@/lib/context/language-context';
import AuthModal from '@/components/auth/auth-modal';
import { getShopDirectionsUrl } from '@/lib/utils';
import VoiceSearchModal from './voice-search-modal';

interface AasaanModeViewProps {
  onOpenCart?: () => void;
}

export default function AasaanModeView({ onOpenCart }: AasaanModeViewProps) {
  const { toggleSimpleMode, speakText } = useSimpleMode();
  const { language, t } = useLanguage();
  const shop = useShop();
  const { user } = useAuth();
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const visualCategories = [
    {
      nameHindi: 'गिफ्ट और उपहार',
      nameEng: 'Gifts & Hampers',
      slug: 'gifts-mementos',
      icon: '🎁',
      bgGradient: 'from-amber-500/20 to-orange-500/20 border-amber-300',
      badgeColor: 'bg-amber-100 text-amber-900',
    },
    {
      nameHindi: 'फोटो फ्रेम',
      nameEng: 'Photo Frames',
      slug: 'photo-frames',
      icon: '🖼️',
      bgGradient: 'from-rose-500/20 to-pink-500/20 border-rose-300',
      badgeColor: 'bg-rose-100 text-rose-900',
    },
    {
      nameHindi: 'दीवार घड़ी',
      nameEng: 'Wall Clocks',
      slug: 'clocks',
      icon: '🕐',
      bgGradient: 'from-blue-500/20 to-indigo-500/20 border-blue-300',
      badgeColor: 'bg-blue-100 text-blue-900',
    },
    {
      nameHindi: 'पर्स और वॉलेट',
      nameEng: 'Purses & Wallets',
      slug: 'leather-accessories',
      icon: '👛',
      bgGradient: 'from-emerald-500/20 to-teal-500/20 border-emerald-300',
      badgeColor: 'bg-emerald-100 text-emerald-900',
    },
    {
      nameHindi: 'इत्र और परफ्यूम',
      nameEng: 'Perfumes',
      slug: 'perfumes-fragrances',
      icon: '🧴',
      bgGradient: 'from-purple-500/20 to-fuchsia-500/20 border-purple-300',
      badgeColor: 'bg-purple-100 text-purple-900',
    },
    {
      nameHindi: 'खिलौने और गेम्स',
      nameEng: 'Toys & Games',
      slug: 'toys-games',
      icon: '🧸',
      bgGradient: 'from-yellow-500/20 to-amber-500/20 border-yellow-300',
      badgeColor: 'bg-yellow-100 text-yellow-900',
    },
    {
      nameHindi: 'पेन और स्टेशनरी',
      nameEng: 'Pens & Stationery',
      slug: 'stationery',
      icon: '✏️',
      bgGradient: 'from-cyan-500/20 to-sky-500/20 border-cyan-300',
      badgeColor: 'bg-cyan-100 text-cyan-900',
    },
    {
      nameHindi: 'शोपीस व मूर्तियां',
      nameEng: 'Idols & Showpieces',
      slug: 'decorative',
      icon: '🏆',
      bgGradient: 'from-violet-500/20 to-purple-500/20 border-violet-300',
      badgeColor: 'bg-violet-100 text-violet-900',
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner: Mode Indicator & Switch Back */}
      <div className="bg-amber-500 text-stone-950 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="w-12 h-12 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center text-2xl font-black shrink-0">
            आ
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              आसान मोड (Aasaan Mode)
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-stone-900">
              बड़ी लिखावट, बोलकर खोज, और बिना किसी परेशानी के आसान खरीदारी।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center sm:justify-end shrink-0">
          <div className="bg-stone-950/90 rounded-xl p-1">
            <LanguageSwitch />
          </div>
          <button
            type="button"
            onClick={toggleSimpleMode}
            className="px-4 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-900 text-white font-bold text-xs sm:text-sm flex items-center gap-2 active-press transition-all shrink-0"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>{language === 'hi' ? 'सामान्य मोड (Normal)' : 'Normal Mode'}</span>
          </button>
        </div>
      </div>

      {/* 8 Primary Action Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 flex items-center gap-2">
            <span>आप क्या करना चाहते हैं?</span>
            <button
              type="button"
              onClick={() => speakText('आप क्या करना चाहते हैं? नीचे दिए गए बटनों को दबाएं।')}
              className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-full"
              title="बोलकर सुनें"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. बोलकर खोजें (Voice Search) */}
          <button
            type="button"
            onClick={() => setIsVoiceOpen(true)}
            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-brand-600 to-amber-600 text-white flex flex-col items-center justify-center text-center shadow-md hover:shadow-lg active-press transition-all min-h-[120px] group"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Mic className="w-7 h-7 text-white" />
            </div>
            <span className="font-extrabold text-base sm:text-lg leading-tight">बोलकर खोजें</span>
            <span className="text-[11px] text-white/80 mt-0.5">Voice Search</span>
          </button>

          {/* 2. सारा सामान देखें (Browse All Goods) */}
          <Link
            href="/categories"
            className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-brand-200 hover:border-brand-500 text-stone-900 flex flex-col items-center justify-center text-center shadow-sm active-press transition-all min-h-[120px] group"
          >
            <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">🛍️</span>
            <span className="font-extrabold text-base sm:text-lg leading-tight">सामान देखें</span>
            <span className="text-[11px] text-stone-500 mt-0.5">All Categories</span>
          </Link>

          {/* 3. सामान खोजें (Text Search) */}
          <Link
            href="/search"
            className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-stone-200 hover:border-brand-500 text-stone-900 flex flex-col items-center justify-center text-center shadow-sm active-press transition-all min-h-[120px] group"
          >
            <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">🔎</span>
            <span className="font-extrabold text-base sm:text-lg leading-tight">सामान खोजें</span>
            <span className="text-[11px] text-stone-500 mt-0.5">Search Items</span>
          </Link>

          {/* 4. मेरा सामान (Cart) */}
          <button
            type="button"
            onClick={onOpenCart || (() => {})}
            className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-amber-200 hover:border-amber-500 text-stone-900 flex flex-col items-center justify-center text-center shadow-sm active-press transition-all min-h-[120px] group"
          >
            <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">🛒</span>
            <span className="font-extrabold text-base sm:text-lg leading-tight">मेरा सामान</span>
            <span className="text-[11px] text-stone-500 mt-0.5">Pickup Cart</span>
          </button>

          {/* 5. पसंद की चीज़ें (Wishlist) */}
          <Link
            href="/wishlist"
            className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-rose-200 hover:border-rose-500 text-stone-900 flex flex-col items-center justify-center text-center shadow-sm active-press transition-all min-h-[120px] group"
          >
            <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">❤️</span>
            <span className="font-extrabold text-base sm:text-lg leading-tight">पसंद की चीज़ें</span>
            <span className="text-[11px] text-stone-500 mt-0.5">My Wishlist</span>
          </Link>

          {/* 6. मेरा ऑर्डर (Track Order) */}
          <Link
            href="/orders"
            className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-blue-200 hover:border-blue-500 text-stone-900 flex flex-col items-center justify-center text-center shadow-sm active-press transition-all min-h-[120px] group"
          >
            <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">📦</span>
            <span className="font-extrabold text-base sm:text-lg leading-tight">मेरा ऑर्डर</span>
            <span className="text-[11px] text-stone-500 mt-0.5">Track Order</span>
          </Link>

          {/* 7. दुकान कहाँ है? (Map Directions) */}
          {getShopDirectionsUrl(shop) ? (
            <a
              href={getShopDirectionsUrl(shop)!}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-500 text-stone-900 flex flex-col items-center justify-center text-center shadow-sm active-press transition-all min-h-[120px] group"
            >
              <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">📍</span>
              <span className="font-extrabold text-base sm:text-lg leading-tight">दुकान कहाँ है?</span>
              <span className="text-[11px] text-stone-500 mt-0.5">Shop Location</span>
            </a>
          ) : (
            <div className="p-4 sm:p-5 rounded-2xl bg-stone-100 border-2 border-stone-200 text-stone-400 flex flex-col items-center justify-center text-center min-h-[120px]">
              <span className="text-3xl mb-1 opacity-40">📍</span>
              <span className="font-bold text-sm leading-tight text-stone-600">दुकान लोकेशन</span>
              <span className="text-[10px] text-stone-500 mt-0.5">Shop location is being configured.</span>
            </div>
          )}

          {/* 8. दुकान पर बात करें (Call Shop) */}
          <a
            href={`tel:${shop.phone.replace(/\s+/g, '')}`}
            className="p-4 sm:p-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex flex-col items-center justify-center text-center shadow-md active-press transition-all min-h-[120px] group"
          >
            <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">📞</span>
            <span className="font-extrabold text-base sm:text-lg leading-tight">फोन पर बात करें</span>
            <span className="text-[11px] text-white/80 mt-0.5">Call Store</span>
          </a>
        </div>
      </div>

      {/* Aasaan Customer Authentication Card */}
      {!user && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-brand-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl shrink-0">
              👤
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-extrabold text-stone-900 leading-tight">
                ग्राहक लॉगिन (Customer Sign In)
              </h4>
              <p className="text-xs text-stone-600 mt-0.5">
                सामान सुरक्षित बुक करने और अपना ऑर्डर देखने के लिए लॉगिन करें।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-sm active-press transition-all"
            >
              <span>{language === 'hi' ? '🟢 Google से जारी रखें' : '🟢 Continue with Google'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-sm active-press transition-all"
            >
              <span>{language === 'hi' ? '🔑 ईमेल व पासवर्ड से लॉगिन' : '🔑 Sign In with Email & Password'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-stone-100 text-xs font-bold text-stone-700">
            <a
              href={`tel:${shop.phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-1.5 hover:text-brand-600"
            >
              <span>📞 दुकान पर फोन करें</span>
            </a>
            <span className="text-stone-300">•</span>
            <a
              href={`https://wa.me/${shop.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('नमस्ते जैनम ट्रेडर्स, मुझे ऑर्डर और सामान खरीदने में मदद चाहिए')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-brand-600"
            >
              <span>💬 WhatsApp पर मदद लें</span>
            </a>
          </div>
        </div>
      )}

      {/* Visual Category Cards (Image-First with Hindi Labels & Audio Playback) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-stone-900">
              फोटो देखकर सामान चुनें (Select by Pictures)
            </h3>
            <p className="text-xs text-stone-600 mt-0.5">
              अपनी पसंद के फोटो पर टच करें
            </p>
          </div>
          <Link
            href="/categories"
            className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            सभी श्रेणियां <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {visualCategories.map((cat) => (
            <div
              key={cat.slug}
              className="bg-white rounded-2xl overflow-hidden border-2 border-stone-200 hover:border-brand-500 shadow-sm transition-all flex flex-col group"
            >
              <Link
                href={`/category/${cat.slug}`}
                className={`block relative h-36 w-full overflow-hidden bg-gradient-to-br ${cat.bgGradient} flex flex-col items-center justify-center border-b group-hover:scale-105 transition-transform duration-300`}
              >
                <span className="text-5xl mb-1 drop-shadow-sm select-none">{cat.icon}</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${cat.badgeColor} mt-1`}>
                  {cat.nameEng}
                </span>
              </Link>

              <div className="p-3 flex items-center justify-between gap-1">
                <Link href={`/category/${cat.slug}`} className="flex-1">
                  <h4 className="font-bold text-sm text-stone-900 group-hover:text-brand-600 transition-colors">
                    {cat.nameHindi}
                  </h4>
                  <span className="text-[11px] text-stone-500 block">{cat.nameEng}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => speakText(cat.nameHindi, 'hi-IN')}
                  aria-label={`Listen to ${cat.nameHindi}`}
                  title="बोलकर सुनें"
                  className="p-2 text-stone-500 hover:text-brand-600 hover:bg-stone-100 rounded-full active-press transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prominent Store Assistance & Payment Guidance */}
      <div className="bg-white rounded-3xl p-6 border-2 border-amber-300 shadow-sm text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="space-y-1">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
            दुकान पर भुगतान नियम
          </span>
          <h4 className="text-base sm:text-lg font-extrabold text-stone-900 mt-2">
            पैसे अभी नहीं देने हैं!
          </h4>
          <p className="text-xs sm:text-sm text-stone-600 max-w-xl">
            वेबसाइट पर केवल सामान बुक करें। हमारी दुकान ({shop.shopAddress}) पर आकर सामान देखें, परखें और फिर Cash या UPI (फोनपे / गूगलपे) से भुगतान करें।
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          <a
            href={`tel:${shop.phone.replace(/\s+/g, '')}`}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active-press transition-all"
          >
            <Phone className="w-4 h-4" />
            <span>दुकान पर कॉल करें</span>
          </a>
          <a
            href={`https://wa.me/${shop.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('नमस्ते जैनम ट्रेडर्स, मुझे सामान खरीदने में मदद चाहिए')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active-press transition-all"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp पर पूछें</span>
          </a>
        </div>
      </div>

      {/* Mount Voice Search Modal */}
      {isVoiceOpen && <VoiceSearchModal isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} />}

      {/* Mount Aasaan Auth Modal */}
      {isAuthOpen && <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />}
    </div>
  );
}
