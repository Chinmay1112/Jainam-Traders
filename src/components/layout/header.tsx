'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  MapPin,
  Clock,
  Sparkles,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { useCart } from '@/lib/context/cart-context';
import { useWishlist } from '@/lib/context/wishlist-context';
import { useAuth } from '@/lib/context/auth-context';
import { isStoreCurrentlyOpen } from '@/lib/utils';
import AuthModal from '@/components/auth/auth-modal';

export default function Header() {
  const router = useRouter();
  const { itemCount, setIsCartDrawerOpen } = useCart();
  const { wishlistCount } = useWishlist();
  const { user, role, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [storeStatus, setStoreStatus] = useState({ isOpen: true, message: 'Open now until 21:30' });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  useEffect(() => {
    setStoreStatus(isStoreCurrentlyOpen('09:30', '21:30', ['Sunday']));
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      {/* Top Announcement & Pickup Notice Banner */}
      <div className="bg-[#1C1917] text-stone-200 text-xs py-1.5 px-4 font-medium border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3 h-3 mr-1 text-amber-400" /> LOCAL PICKUP STORE
            </span>
            <span className="hidden sm:inline text-stone-400">|</span>
            <span className="truncate">Reserve online • Inspect items in person • Pay Cash or UPI at Counter</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${storeStatus.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className={storeStatus.isOpen ? 'text-emerald-400' : 'text-rose-400'}>{storeStatus.message}</span>
            </div>
            <Link
              href="/pickup-info"
              className="hover:text-amber-400 underline decoration-amber-500/50 underline-offset-2 flex items-center gap-1"
            >
              <MapPin className="w-3 h-3 text-amber-400" /> Main Bazar Shop
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-3 sm:gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-brand-600 to-amber-600 flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:shadow-brand-500/20 group-hover:scale-105 transition-all">
                JT
              </div>
              <div className="flex flex-col">
                <span className="font-display font-extrabold text-lg sm:text-2xl tracking-tight text-stone-900 group-hover:text-brand-600 transition-colors">
                  Jainam Traders
                </span>
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                  Gifts • Frames • Clocks • Retail
                </span>
              </div>
            </Link>

            {/* Desktop Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex flex-1 max-w-lg relative items-center"
            >
              <input
                type="text"
                placeholder="Search photo frames, brass idols, wall clocks, watches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-stone-100/80 border border-stone-300/80 rounded-full text-sm text-stone-900 placeholder:text-stone-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-600 transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>

            {/* Right Action Icons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/categories"
                className="hidden lg:flex items-center gap-1 px-3 py-2 text-sm font-medium text-stone-700 hover:text-brand-600 rounded-lg hover:bg-stone-100 transition-colors"
              >
                Categories
              </Link>

              <Link
                href="/orders"
                className="hidden lg:flex items-center gap-1 px-3 py-2 text-sm font-medium text-stone-700 hover:text-brand-600 rounded-lg hover:bg-stone-100 transition-colors"
              >
                Track Orders
              </Link>

              {/* Wishlist Button */}
              <Link
                href="/wishlist"
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

              {/* Cart Button */}
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(true)}
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

              {/* User Account Button & Dropdown */}
              <div className="relative">
                {user ? (
                  <button
                    type="button"
                    onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                    className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-2 rounded-full sm:rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100 border border-stone-200"
                  >
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline max-w-[90px] truncate text-xs font-semibold">
                      {user.fullName.split(' ')[0]}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-full sm:rounded-lg shadow-sm active-press transition-all"
                  >
                    <User className="w-4 h-4" />
                    <span>Sign In</span>
                  </button>
                )}

                {/* Account Menu Dropdown */}
                {isAccountMenuOpen && user && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-stone-200 py-2 z-50 text-sm animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseLeave={() => setIsAccountMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-stone-100">
                      <p className="font-semibold text-stone-900 truncate">{user.fullName}</p>
                      <p className="text-xs text-stone-500 truncate">{user.phone || user.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700">
                        Role: {role}
                      </span>
                    </div>

                    <Link
                      href="/account"
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-stone-50 text-stone-700"
                    >
                      <User className="w-4 h-4 text-stone-400" /> My Profile
                    </Link>

                    <Link
                      href="/orders"
                      onClick={() => setIsAccountMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-stone-50 text-stone-700"
                    >
                      <ShoppingBag className="w-4 h-4 text-stone-400" /> My Pickup Orders
                    </Link>

                    {(role === 'owner' || role === 'admin' || role === 'store_manager' || role === 'staff') && (
                      <Link
                        href="/admin"
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-amber-50 text-amber-900 font-medium"
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-600" /> Staff / Admin Portal
                      </Link>
                    )}

                    <div className="border-t border-stone-100 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setIsAccountMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-rose-50 text-rose-700"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" /> Sign Out
                    </button>
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
                placeholder="Search gifts, frames, clocks, toys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-stone-100 border border-stone-300 rounded-full text-xs text-stone-900 placeholder:text-stone-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-stone-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      {isAuthModalOpen && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />}
    </>
  );
}
