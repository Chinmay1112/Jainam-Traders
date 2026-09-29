import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Network } from '@capacitor/network';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';

export const isNative = Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

/**
 * 1. STATUS BAR & SPLASH INITIALIZER
 */
export async function initializeNativeWindow() {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#FAF8F5' });
    await SplashScreen.hide();
  } catch (err) {
    console.warn('Native status bar/splash init error:', err);
  }
}

/**
 * 2. ANDROID BACK BUTTON HANDLER
 * Handles:
 * - Closing open modal/drawer first if active
 * - router.back() if history exists
 * - Double tap to exit when at root page
 */
export function registerAndroidBackButton(
  hasOpenModal: () => boolean,
  closeModal: () => void,
  canGoBack: () => boolean,
  navigateBack: () => void
) {
  if (!isNative || getPlatform() !== 'android') return () => {};

  let lastBackPress = 0;

  const backHandler = App.addListener('backButton', ({ canGoBack: capCanGoBack }) => {
    // Priority 1: Close active modal or drawer
    if (hasOpenModal()) {
      closeModal();
      return;
    }

    // Priority 2: Navigate back in history if not at root
    if (canGoBack() && window.location.pathname !== '/') {
      navigateBack();
      return;
    }

    // Priority 3: At root - exit only on deliberate double tap within 2 seconds
    const now = Date.now();
    if (now - lastBackPress < 2000) {
      App.exitApp();
    } else {
      lastBackPress = now;
      console.log('Press back again to exit Jainam Traders');
    }
  });

  return () => {
    backHandler.then((handle) => handle.remove());
  };
}

/**
 * 3. DEEP LINK HANDLER
 * Handles universal links e.g. https://jainamtraders.com/products/rosewood-frame
 * and custom app schemes e.g. jainamtraders://orders/JT-2026-000101
 */
export function registerDeepLinkListener(onNavigate: (path: string) => void) {
  if (!isNative) return () => {};

  const sub = App.addListener('appUrlOpen', (data) => {
    try {
      const url = new URL(data.url);
      // Extract pathname + search
      let internalPath = url.pathname;
      if (url.search) internalPath += url.search;

      // Handle custom scheme e.g. jainamtraders://orders/123
      if (data.url.startsWith('jainamtraders://')) {
        internalPath = '/' + data.url.replace('jainamtraders://', '');
      }

      if (internalPath) {
        onNavigate(internalPath);
      }
    } catch (e) {
      console.warn('Failed to parse deep link URL:', data.url, e);
    }
  });

  return () => {
    sub.then((h) => h.remove());
  };
}

/**
 * 4. PUSH NOTIFICATIONS
 */
export async function initializePushNotifications(
  onNotificationTapped: (payload: { orderNumber?: string; url?: string }) => void
) {
  if (!isNative) return null;

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission denied by customer');
      return null;
    }

    await PushNotifications.register();

    // Listen for registration token
    PushNotifications.addListener('registration', (token) => {
      console.log('Push device token registered:', token.value);
    });

    // Listen for notification tapped action
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      const data = notification.notification.data || {};
      const orderNumber = data.orderNumber || data.order_id;
      const targetUrl = data.url || (orderNumber ? `/orders/${orderNumber}` : undefined);

      onNotificationTapped({ orderNumber, url: targetUrl });
    });

    return true;
  } catch (err) {
    console.warn('Failed to initialize native push notifications:', err);
    return null;
  }
}

/**
 * 5. NATIVE SHARING
 */
export async function nativeShareProduct(title: string, text: string, url: string) {
  if (isNative) {
    try {
      await Share.share({
        title,
        text,
        url,
        dialogTitle: 'Share with friends',
      });
      return true;
    } catch {
      // User cancelled
      return false;
    }
  }

  // Web fallback: navigator.share or clipboard
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch {
      return false;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
    return true;
  }

  return false;
}

/**
 * 6. HAPTIC FEEDBACK
 */
export async function triggerHaptic(type: 'light' | 'success' | 'warning' = 'light') {
  if (!isNative) return;
  try {
    if (type === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (type === 'warning') {
      await Haptics.notification({ type: NotificationType.Warning });
    }
  } catch {
    // ignore
  }
}

/**
 * 7. CAMERA & PHOTO PICKER WITH CLIENT COMPRESSION
 * Used for verified review photos & support attachments.
 */
export async function capturePhotoOrPick(): Promise<string | null> {
  if (isNative) {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // Allows customer to choose Camera or Photos gallery
        width: 1200,
        height: 1200,
        correctOrientation: true,
      });
      return image.dataUrl || null;
    } catch (err) {
      console.warn('Camera capture cancelled or failed:', err);
      return null;
    }
  }

  // Web fallback using file input picker
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      // Check max size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size too large. Maximum allowed size is 5MB.');
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/**
 * 8. NETWORK STATUS & OFFLINE LISTENER
 */
export async function getCurrentNetworkStatus(): Promise<boolean> {
  try {
    const status = await Network.getStatus();
    return status.connected;
  } catch {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}

export function subscribeNetworkStatus(onStatusChange: (connected: boolean) => void) {
  const handler = Network.addListener('networkStatusChange', (status) => {
    onStatusChange(status.connected);
  });

  const onlineListener = () => onStatusChange(true);
  const offlineListener = () => onStatusChange(false);
  window.addEventListener('online', onlineListener);
  window.addEventListener('offline', offlineListener);

  return () => {
    handler.then((h) => h.remove());
    window.removeEventListener('online', onlineListener);
    window.removeEventListener('offline', offlineListener);
  };
}

/**
 * 9. NATIVE DIALER & MAPS INTENTS
 */
export function openNativeDialer(phoneNumber: string) {
  const clean = phoneNumber.replace(/[^0-9+]/g, '');
  window.location.href = `tel:${clean}`;
}

export function openWhatsAppChat(number: string, text: string = '') {
  const clean = number.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  const url = `https://wa.me/${clean}?text=${encodedText}`;
  window.open(url, '_blank');
}

export function openDirectionsInMaps(address: string, lat: number = 19.076, lng: number = 72.8777) {
  const encoded = encodeURIComponent(address);
  if (isNative && getPlatform() === 'ios') {
    window.open(`maps://?q=${encoded}`, '_system');
  } else if (isNative && getPlatform() === 'android') {
    window.open(`geo:${lat},${lng}?q=${encoded}`, '_system');
  } else {
    window.open(`https://maps.google.com/?q=${encoded}`, '_blank');
  }
}
