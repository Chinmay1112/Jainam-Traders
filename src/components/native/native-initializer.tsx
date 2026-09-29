'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  initializeNativeWindow,
  registerAndroidBackButton,
  registerDeepLinkListener,
  initializePushNotifications,
} from '@/lib/native/capacitor-bridge';
import { useCart } from '@/lib/context/cart-context';

export default function NativeInitializer() {
  const router = useRouter();
  const { isCartDrawerOpen, setIsCartDrawerOpen } = useCart();

  useEffect(() => {
    // 1. Initialize native status bar style and hide splash screen
    initializeNativeWindow();

    // 2. Register Android Back Button
    const unregisterBack = registerAndroidBackButton(
      () => isCartDrawerOpen,
      () => setIsCartDrawerOpen(false),
      () => window.history.length > 1,
      () => router.back()
    );

    // 3. Register Deep Links
    const unregisterDeepLinks = registerDeepLinkListener((internalPath) => {
      console.log('Navigating via native deep link:', internalPath);
      router.push(internalPath);
    });

    // 4. Initialize Push Notifications
    initializePushNotifications(({ url }) => {
      if (url) {
        console.log('Navigating from push notification tap:', url);
        router.push(url);
      }
    });

    return () => {
      unregisterBack();
      unregisterDeepLinks();
    };
  }, [router, isCartDrawerOpen, setIsCartDrawerOpen]);

  return null;
}
