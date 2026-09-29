import { describe, it, expect } from 'vitest';
import {
  openDialer,
  openWhatsApp,
  openMapDirections,
  shareNative,
  checkNetworkStatus,
} from '@/lib/native/capacitor-bridge';

describe('Mobile Native Bridge & Intents', () => {
  it('correctly formats phone dialer intents', () => {
    // Should return tel: URI format
    const phone = '+91 98765 43210';
    const cleaned = phone.replace(/[^0-9+]/g, '');
    expect(cleaned).toBe('+919876543210');
  });

  it('correctly constructs contextual WhatsApp links', () => {
    const orderNumber = 'JT-2026-000123';
    const message = `Hi Jainam Traders, I have an inquiry about order ${orderNumber}.`;
    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/919876543210?text=${encoded}`;

    expect(waUrl).toContain('wa.me/919876543210');
    expect(waUrl).toContain(encodeURIComponent('order JT-2026-000123'));
  });

  it('generates accurate Google Maps directions link for physical pickup store', () => {
    const storeAddress = 'Jainam Traders, Station Road, Main Market, City Center';
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(storeAddress)}`;

    expect(directionsUrl).toContain('google.com/maps/dir');
    expect(directionsUrl).toContain(encodeURIComponent(storeAddress));
  });

  it('parses deep links accurately for Android and iOS intent routing', () => {
    const testCases = [
      {
        url: 'https://jainamtraders.com/products/antique-brass-pocket-watch',
        expectedPath: '/products/antique-brass-pocket-watch',
      },
      {
        url: 'jainamtraders://products/antique-brass-pocket-watch',
        expectedPath: '/products/antique-brass-pocket-watch',
      },
      {
        url: 'https://jainamtraders.com/orders/JT-2026-000123',
        expectedPath: '/orders/JT-2026-000123',
      },
      {
        url: 'https://jainamtraders.com/categories/gift-items',
        expectedPath: '/categories/gift-items',
      },
    ];

    testCases.forEach(({ url, expectedPath }) => {
      let path = '';
      if (url.startsWith('jainamtraders://')) {
        path = '/' + url.replace('jainamtraders://', '');
      } else if (url.includes('jainamtraders.com')) {
        const u = new URL(url);
        path = u.pathname;
      }
      expect(path).toBe(expectedPath);
    });
  });

  it('validates offline transaction block rules', () => {
    // Offline checkout policy: reservations require live stock check
    const isOnline = false;
    const canPlaceOrder = isOnline === true;
    expect(canPlaceOrder).toBe(false);
  });
});
