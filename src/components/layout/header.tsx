'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  ShieldCheck,
  LogOut,
  X,
  Mic,
  Eye,
  Globe,
  Package,
  ChevronDown,
} from 'lucide-react';
import { useCart } from '@/lib/context/cart-context';
import { useWishlist } from '@/lib/context/wishlist-context';
import { useAuth } from '@/lib/context/auth-context';
import { useSimpleMode } from '@/lib/context/simple-mode-context';
import { useLanguage } from '@/lib/context/language-context';
import AuthModal from '@/components/auth/auth-modal';
import VoiceSearchModal from '@/components/store/voice-search-modal';
import { CANONICAL_BRAND_TAGLINE } from '@/lib/config/shop-config';

export default function Header() {
  const router = useRouter();
  const { itemCount, setIsCartDrawerOpen } = useCart();
  const { wishlistCount } = useWishlist();
  const { user, staffUser, role, logout, logoutStaff } = useAuth();
  const { isSimpleMode, toggleSimpleMode } = useSimpleMode();
  const { language, setLanguage, t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for auth query param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') === 'signin' || params.get('signin') === 'true') {
        setIsAuthModalOpen(true);
      }
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const isStaffLoggedIn = !!staffUser;
  const isCustomerLoggedIn = !!user && !staffUser;
  const isLoggedIn = isStaffLoggedIn || isCustomerLoggedIn;

  const displayName = isStaffLoggedIn
    ? staffUser?.fullName || 'Staff Member'
    : user?.fullName || 'Valued Customer';

  const displayEmail = isStaffLoggedIn
    ? staffUser?.email || ''
    : user?.email || user?.phone || '';

  const displayAvatar = isStaffLoggedIn
    ? staffUser?.avatarUrl
    : user?.avatarUrl;

  const displayRole = (isStaffLoggedIn ? staffUser?.role : role || 'CUSTOMER').toUpperCase();

  return (
    <>
      {/* Primary Clean Header — Top announcement bar permanently removed */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-3 sm:gap-6">
            {/* 1. JT Logo & Branding */}
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-brand-600 to-amber-600 flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:shadow-brand-500/20 group-hover:scale-105 transition-all">
                JT
              </div>
              <div className="flex flex-col">
                <span className="font-display font-extrabold text-lg sm:text-2xl tracking-tight text-stone-900 group-hover:text-brand-600 transition-colors">
                  Jainam Traders
                </span>
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                  {CANONICAL_BRAND_TAGLINE}
                </span>
              </div>
            </Link>

            {/* 2. Desktop Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex flex-1 max-w-lg relative items-center"
            >
              <input
                type="text"
                placeholder={language === 'hi' ? 'फोटो फ्रेम, घड़ियां, खिलौने, गिफ्ट खोजें...' : 'Search photo frames, brass idols, wall clocks, watches...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search store catalogue"
                className="w-full pl-10 pr-20 py-2.5 bg-stone-100/80 border border-stone-300/80 rounded-full text-sm text-stone-900 placeholder:text-stone-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5" />
              <div className="absolute right-2.5 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search text"
                    className="text-stone-400 hover:text-stone-600 p-1 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsVoiceModalOpen(true)}
                  aria-label="Voice search / बोलकर खोजें"
                  title="Voice search / बोलकर खोजें"
                  className="p-1.5 text-stone-500 hover:text-brand-600 hover:bg-stone-200/60 rounded-full transition-colors active-press"
                >
                  <Mic className="w-4 h-4 text-brand-600" />
                </button>
              </div>
            </form>

            {/* Right Main Navigation Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* 3. Categories */}
              <Link
                href="/categories"
                className="hidden lg:flex items-center gap-1 px-3 py-2 text-sm font-semibold text-stone-700 hover:text-brand-600 rounded-lg hover:bg-stone-100 transition-colors"
              >
                {language === 'hi' ? 'श्रेणियां' : 'Categories'}
              </Link>

              {/* 4. Track Orders */}
              <Link
                href="/orders"
                className="hidden lg:flex items-center gap-1 px-3 py-2 text-sm font-semibold text-stone-700 hover:text-brand-600 rounded-lg hover:bg-stone-100 transition-colors"
              >
                {language === 'hi' ? 'ऑर्डर ट्रैक करें' : 'Track Orders'}
              </Link>

              {/* 5. Wishlist (Always Visible in Header) */}
              <Link
                href="/wishlist"
                aria-label={`Wishlist with ${wishlistCount} items`}
                className="p-2 sm:p-2.5 rounded-full text-stone-700 hover:text-brand-600 hover:bg-stone-100 relative active-press transition-colors"
                title="Wishlist"
              >
                <Heart className="w-5 h-5 sm:w-6 sm:h-6" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-brand-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* 6. Cart */}
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(true)}
                aria-label={`Pickup Cart with ${itemCount} items`}
                className="p-2 sm:p-2.5 rounded-full text-stone-700 hover:text-brand-600 hover:bg-stone-100 relative active-press transition-colors"
                title="Pickup Cart"
              >
                <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
                {itemCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-amber-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm animate-pulse">
                    {itemCount}
                  </span>
                )}
              </button>

              {/* 7. Profile Menu Button & Dropdown */}
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                  aria-expanded={isAccountMenuOpen}
                  aria-label="Profile and settings menu"
                  className={`flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-2 rounded-full sm:rounded-lg text-sm font-medium border transition-colors ${
                    isLoggedIn
                      ? 'border-stone-200 hover:bg-stone-100 text-stone-800'
                      : 'border-stone-300 hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center overflow-hidden shrink-0 ${
                      isStaffLoggedIn
                        ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400'
                        : isLoggedIn
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {displayAvatar ? (
                      <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                    ) : isLoggedIn ? (
                      displayName.charAt(0).toUpperCase()
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <span className="hidden sm:inline max-w-[90px] truncate text-xs font-semibold">
                    {isLoggedIn ? displayName.split(' ')[0] : (language === 'hi' ? 'प्रोफ़ाइल' : 'Profile')}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400 hidden sm:inline" />
                </button>

                {/* Profile Dropdown Menu */}
                {isAccountMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-stone-200 py-2.5 z-50 text-sm animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* User Header / Guest Header */}
                    {isLoggedIn ? (
                      <div className="px-4 py-2.5 border-b border-stone-100 flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center overflow-hidden shrink-0 ${
                            isStaffLoggedIn
                              ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                              : 'bg-brand-100 text-brand-700'
                          }`}
                        >
                          {displayAvatar ? (
                            <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                          ) : (
                            displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-stone-900 truncate">{displayName}</p>
                          {displayEmail && <p className="text-xs text-stone-500 truncate">{displayEmail}</p>}
                          <span
                            className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              isStaffLoggedIn
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            Role: {displayRole}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-2.5 border-b border-stone-100">
                        <p className="font-bold text-stone-900">
                          {language === 'hi' ? 'जैनम ट्रेडर्स में स्वागत है' : 'Welcome to Jainam Traders'}
                        </p>
                        <p className="text-xs text-stone-500 mb-2">
                          {language === 'hi' ? 'ऑर्डर और प्रोफाइल के लिए साइन इन करें' : 'Sign in to manage orders & profile'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            setIsAuthModalOpen(true);
                          }}
                          className="w-full py-2 px-3 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm text-center transition-colors"
                        >
                          {t('signInBtn')} / Register
                        </button>
                      </div>
                    )}

                    {/* Admin Console for Staff/Manager/Owner ONLY */}
                    {isStaffLoggedIn && (
                      <div className="py-1 border-b border-stone-100">
                        <Link
                          href="/admin"
                          onClick={() => setIsAccountMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 hover:bg-amber-50 text-amber-900 font-bold transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4 text-amber-600" />
                          <span>Admin Console</span>
                        </Link>
                      </div>
                    )}

                    {/* Accessibility & Settings Section */}
                    <div className="px-4 py-2.5 space-y-2.5 border-b border-stone-100 bg-stone-50/60">
                      {/* Simple Mode Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-amber-600" />
                          <div>
                            <p className="text-xs font-bold text-stone-800">
                              {language === 'hi' ? 'आसान मोड' : 'Simple Mode'}
                            </p>
                            <p className="text-[10px] text-stone-500">
                              {language === 'hi' ? 'बड़ा टेक्स्ट और आसान बटन' : 'Larger text & simplified view'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isSimpleMode}
                          onClick={toggleSimpleMode}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                            isSimpleMode ? 'bg-amber-500' : 'bg-stone-300'
                          }`}
                        >
                          <span className="sr-only">Toggle Simple Mode</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              isSimpleMode ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Language Selection */}
                      <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-brand-600" />
                          <div>
                            <p className="text-xs font-bold text-stone-800">
                              {language === 'hi' ? 'भाषा' : 'Language'}
                            </p>
                            <p className="text-[10px] text-stone-500">हिन्दी / English</p>
                          </div>
                        </div>
                        <div
                          role="group"
                          aria-label="Language selection"
                          className="inline-flex rounded-lg bg-stone-200/80 p-0.5 text-xs font-bold"
                        >
                          <button
                            type="button"
                            onClick={() => setLanguage('hi')}
                            aria-pressed={language === 'hi'}
                            className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${
                              language === 'hi'
                                ? 'bg-white text-stone-900 shadow-sm font-extrabold'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            हिन्दी
                          </button>
                          <button
                            type="button"
                            onClick={() => setLanguage('en')}
                            aria-pressed={language === 'en'}
                            className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${
                              language === 'en'
                                ? 'bg-white text-stone-900 shadow-sm font-extrabold'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            English
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Navigation Items */}
                    <div className="py-1">
                      <Link
                        href="/orders"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-stone-50 text-stone-700 font-medium transition-colors"
                      >
                        <Package className="w-4 h-4 text-stone-400" />
                        <span>{language === 'hi' ? 'मेरे ऑर्डर' : 'My Orders'}</span>
                      </Link>

                      {isLoggedIn && (
                        <Link
                          href="/account"
                          onClick={() => setIsAccountMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 hover:bg-stone-50 text-stone-700 font-medium transition-colors"
                        >
                          <User className="w-4 h-4 text-stone-400" />
                          <span>{language === 'hi' ? 'खाता विवरण' : 'My Profile'}</span>
                        </Link>
                      )}
                    </div>

                    {/* Sign Out Button */}
                    {isLoggedIn && (
                      <div className="border-t border-stone-100 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (staffUser) await logoutStaff();
                            if (user) await logout();
                            setIsAccountMenuOpen(false);
                          }}
                          className="w-full text-left flex items-center gap-2.5 px-4 py-2 hover:bg-rose-50 text-rose-700 font-semibold transition-colors"
                        >
                          <LogOut className="w-4 h-4 text-rose-500" />
                          <span>{language === 'hi' ? 'साइन आउट' : 'Sign Out'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Search Bar Row */}
          <div className="md:hidden pb-3">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                type="text"
                placeholder={language === 'hi' ? 'फोटो फ्रेम, घड़ियां, खिलौने खोजें...' : 'Search gifts, frames, clocks, toys...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search store catalogue"
                className="w-full pl-9 pr-16 py-2 bg-stone-100 border border-stone-300 rounded-full text-xs text-stone-900 placeholder:text-stone-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3" />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="text-stone-400 p-1 rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsVoiceModalOpen(true)}
                  aria-label="Voice search / बोलकर खोजें"
                  title="Voice search / बोलकर खोजें"
                  className="p-1 text-brand-600 hover:text-brand-700 active-press"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      {/* Voice Search Modal */}
      <VoiceSearchModal isOpen={isVoiceModalOpen} onClose={() => setIsVoiceModalOpen(false)} />

      {/* Auth Modal */}
      {isAuthModalOpen && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />}
    </>
  );
}
