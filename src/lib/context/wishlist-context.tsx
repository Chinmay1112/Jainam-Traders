'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CustomerProductView } from '@/lib/types';
import { useCart } from './cart-context';

interface WishlistContextType {
  items: CustomerProductView[];
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (product: CustomerProductView) => void;
  removeFromWishlist: (productId: string) => void;
  moveToCart: (product: CustomerProductView) => void;
  wishlistCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const WISHLIST_STORAGE_KEY = 'jt_wishlist_items_v1';

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CustomerProductView[]>([]);
  const { addItem } = useCart();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const isInWishlist = (productId: string) => items.some((i) => i.id === productId);

  const toggleWishlist = (product: CustomerProductView) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === product.id)) {
        return prev.filter((i) => i.id !== product.id);
      }
      return [product, ...prev];
    });
  };

  const removeFromWishlist = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
  };

  const moveToCart = (product: CustomerProductView) => {
    addItem(product);
    removeFromWishlist(product.id);
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        moveToCart,
        wishlistCount: items.length,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
}
