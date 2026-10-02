'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CanonicalShopInfo, CANONICAL_SHOP_CONFIG } from '@/lib/config/shop-config';

interface ShopContextType {
  shop: CanonicalShopInfo;
  refreshShop: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType>({
  shop: CANONICAL_SHOP_CONFIG,
  refreshShop: async () => {},
});

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [shop, setShop] = useState<CanonicalShopInfo>(CANONICAL_SHOP_CONFIG);

  const refreshShop = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setShop((prev) => ({
          ...prev,
          ...data,
          shopName: data.shopName || prev.shopName,
          shopAddress: data.shopAddress || prev.shopAddress,
          shortAddress: data.shortAddress || prev.shortAddress,
          landmark: data.landmark || prev.landmark,
          phone: data.phone || prev.phone,
          whatsappNumber: data.whatsappNumber || prev.whatsappNumber,
          googleMapsUrl: data.googleMapsUrl || prev.googleMapsUrl,
          googleMapsPlaceUrl: data.googleMapsPlaceUrl || prev.googleMapsPlaceUrl,
          googleMapsPlaceId: data.googleMapsPlaceId || prev.googleMapsPlaceId,
          isLocationVerified: data.isLocationVerified ?? prev.isLocationVerified,
          latitude: data.latitude ?? prev.latitude,
          longitude: data.longitude ?? prev.longitude,
          weeklyClosedDays: data.weeklyClosedDays || prev.weeklyClosedDays,
          openingTime: data.openingTime || prev.openingTime,
          closingTime: data.closingTime || prev.closingTime,
          openingHoursFormatted: `${data.openingTime || prev.openingTime} AM – ${data.closingTime || prev.closingTime} PM (Mon - Sat)`,
        }));
      }
    } catch {
      // Fallback cleanly to CANONICAL_SHOP_CONFIG
    }
  };

  useEffect(() => {
    refreshShop();

    const handleUpdate = () => {
      refreshShop();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('shop-settings-updated', handleUpdate);
      return () => {
        window.removeEventListener('shop-settings-updated', handleUpdate);
      };
    }
  }, []);

  return (
    <ShopContext.Provider value={{ shop, refreshShop }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  const shop = context?.shop || CANONICAL_SHOP_CONFIG;
  return {
    ...shop,
    shop,
    shopSettings: shop,
  };
}

export function useShopActions() {
  const context = useContext(ShopContext);
  return context;
}
