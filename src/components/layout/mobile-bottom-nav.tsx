'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid, Search, Heart, ShoppingBag, User } from 'lucide-react';
import { useCart } from '@/lib/context/cart-context';
import { useWishlist } from '@/lib/context/wishlist-context';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { itemCount, setIsCartDrawerOpen } = useCart();
  const { wishlistCount } = useWishlist();

  // Don't show in admin portal
  if (pathname.startsWith('/admin')) {
    return null;
  }

  const navItems = [
    { label: 'Home', href: '/', icon: Home, active: pathname === '/' },
    { label: 'Categories', href: '/categories', icon: Grid, active: pathname.startsWith('/categories') || pathname.startsWith('/category') },
    { label: 'Search', href: '/search', icon: Search, active: pathname.startsWith('/search') },
    { label: 'Wishlist', href: '/wishlist', icon: Heart, badge: wishlistCount, active: pathname.startsWith('/wishlist') },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-lg px-2 py-1.5 safe-area-pb">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] relative rounded-lg active-press transition-colors ${
                item.active ? 'text-brand-600 font-bold' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.active ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-brand-600 text-white rounded-full text-[9px] font-bold w-4 h-4 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* Cart Trigger */}
        <button
          type="button"
          onClick={() => setIsCartDrawerOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 min-w-[56px] relative rounded-lg active-press text-stone-500 hover:text-stone-800"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 stroke-2" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-amber-600 text-white rounded-full text-[9px] font-bold w-4 h-4 flex items-center justify-center animate-pulse">
                {itemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Cart</span>
        </button>

        {/* Account / Orders */}
        <Link
          href="/orders"
          className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] relative rounded-lg active-press transition-colors ${
            pathname.startsWith('/orders') || pathname.startsWith('/account')
              ? 'text-brand-600 font-bold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <User className="w-5 h-5 stroke-2" />
          <span className="text-[10px] mt-0.5 tracking-tight">Orders</span>
        </Link>
      </div>
    </div>
  );
}
