'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CustomerProductView, ProductVariant } from '@/lib/types';

export interface CartLineItem {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  price: number;
  mrp: number;
  quantity: number;
  thumbnailUrl: string;
}

interface CartContextType {
  items: CartLineItem[];
  itemCount: number;
  subtotal: number;
  totalMrp: number;
  mrpSavings: number;
  couponCode: string;
  couponDiscount: number;
  finalTotal: number;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
  addItem: (product: CustomerProductView, variant?: ProductVariant, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'jt_cart_items_v1';
const COUPON_STORAGE_KEY = 'jt_cart_coupon_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [couponCode, setCouponCode] = useState<string>('');
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
      const storedCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
      if (storedCoupon) setCouponCode(storedCoupon);
    } catch {
      // ignore
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  useEffect(() => {
    try {
      if (couponCode) {
        localStorage.setItem(COUPON_STORAGE_KEY, couponCode);
      } else {
        localStorage.removeItem(COUPON_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [couponCode]);

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalMrp = items.reduce((acc, item) => acc + item.mrp * item.quantity, 0);
  const mrpSavings = Math.max(0, totalMrp - subtotal);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Compute coupon discount reactively
  useEffect(() => {
    if (!couponCode) {
      setCouponDiscount(0);
      return;
    }
    const code = couponCode.toUpperCase().trim();
    if (code === 'FIRST10' && subtotal >= 499) {
      const disc = Math.min(200, Math.round((subtotal * 10) / 100));
      setCouponDiscount(disc);
    } else if (code === 'JAINAM100' && subtotal >= 999) {
      setCouponDiscount(100);
    } else if (code === 'FESTIVE15' && subtotal >= 1499) {
      const disc = Math.min(350, Math.round((subtotal * 15) / 100));
      setCouponDiscount(disc);
    } else {
      setCouponDiscount(0);
    }
  }, [couponCode, subtotal]);

  const finalTotal = Math.max(0, subtotal - couponDiscount);

  const addItem = (product: CustomerProductView, variant?: ProductVariant, quantity: number = 1) => {
    setItems((prev) => {
      const lineId = variant ? `${product.id}-${variant.id}` : product.id;
      const existing = prev.find((i) => i.id === lineId);
      const unitPrice = variant?.priceOverride || product.price;

      if (existing) {
        return prev.map((i) =>
          i.id === lineId ? { ...i, quantity: Math.min(10, i.quantity + quantity) } : i
        );
      }

      return [
        ...prev,
        {
          id: lineId,
          productId: product.id,
          variantId: variant?.id,
          productName: product.name,
          variantName: variant?.title,
          price: unitPrice,
          mrp: product.mrp,
          quantity: Math.min(10, Math.max(1, quantity)),
          thumbnailUrl: product.thumbnailUrl,
        },
      ];
    });
    setIsCartDrawerOpen(true);
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: Math.min(10, quantity) } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    setCouponCode('');
    setCouponDiscount(0);
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(COUPON_STORAGE_KEY);
  };

  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string }> => {
    const clean = code.toUpperCase().trim();
    if (clean === 'FIRST10') {
      if (subtotal < 499) {
        return { success: false, message: 'Minimum order amount for FIRST10 is ₹499' };
      }
      setCouponCode('FIRST10');
      return { success: true, message: 'Welcome Coupon FIRST10 applied! (10% Off)' };
    }

    if (clean === 'JAINAM100') {
      if (subtotal < 999) {
        return { success: false, message: 'Minimum order amount for JAINAM100 is ₹999' };
      }
      setCouponCode('JAINAM100');
      return { success: true, message: 'Flat ₹100 Off coupon applied successfully!' };
    }

    if (clean === 'FESTIVE15') {
      if (subtotal < 1499) {
        return { success: false, message: 'Minimum order amount for FESTIVE15 is ₹1499' };
      }
      setCouponCode('FESTIVE15');
      return { success: true, message: 'Festive Celebration 15% discount applied!' };
    }

    return { success: false, message: 'Invalid or expired coupon code' };
  };

  const removeCoupon = () => {
    setCouponCode('');
    setCouponDiscount(0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        totalMrp,
        mrpSavings,
        couponCode,
        couponDiscount,
        finalTotal,
        isCartDrawerOpen,
        setIsCartDrawerOpen,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
