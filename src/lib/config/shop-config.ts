import { ShopSettings } from '@/lib/types';

// ==============================================================================
// JAINAM TRADERS - CANONICAL SHOP CONFIGURATION
// Single source of truth for all store identity, location, contact, and hours.
// Every component, page, receipt, AI prompt, and native bridge MUST read from here.
// ==============================================================================

export const CANONICAL_BRAND_TAGLINE = 'GIFTS • TOYS • ACCESSORIES • MORE';

export interface CanonicalShopInfo extends ShopSettings {
  brandTagline: string;
  shortAddress: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  openingHoursFormatted: string;
  closedDaysFormatted: string;
  supportHoursNotice: string;
  directPhoneRaw: string;
  directWhatsappRaw: string;
}

export const CANONICAL_SHOP_CONFIG: CanonicalShopInfo = {
  id: 'a0000000-0000-0000-0000-000000000001',
  shopName: 'Jainam Traders',
  shopTagline: CANONICAL_BRAND_TAGLINE,
  brandTagline: CANONICAL_BRAND_TAGLINE,
  shopLogoUrl: '/images/jainam-logo.svg',
  // Address is managed by owner via Admin Settings or STORE_ADDRESS environment variable.
  // Until verified address is supplied, no fabricated address is displayed.
  shopAddress: process.env.NEXT_PUBLIC_STORE_ADDRESS || 'Jainam Traders (Location on Google Maps)',
  shortAddress: process.env.NEXT_PUBLIC_STORE_SHORT_ADDRESS || 'Jainam Traders',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  // Authoritative verified Google Maps Place location provided by owner:
  googleMapsUrl: 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
  googleMapsPlaceUrl: 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
  googleMapsPlaceId: undefined,
  isLocationVerified: true,
  locationVerifiedAt: '2026-10-02T07:25:00.000Z',
  locationVerifiedBy: 'Store Owner',
  latitude: 22.2765869,
  longitude: 75.7979897,
  // Contact numbers: strictly configured via environment variables or Admin Settings; zero guessed values.
  phone: process.env.NEXT_PUBLIC_STORE_PHONE || process.env.STORE_CONTACT_PHONE || '',
  whatsappNumber: process.env.NEXT_PUBLIC_STORE_WHATSAPP || process.env.STORE_WHATSAPP_NUMBER || '',
  directPhoneRaw: (process.env.NEXT_PUBLIC_STORE_PHONE || process.env.STORE_CONTACT_PHONE || '').replace(/\D/g, ''),
  directWhatsappRaw: (process.env.NEXT_PUBLIC_STORE_WHATSAPP || process.env.STORE_WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  email: process.env.NEXT_PUBLIC_STORE_EMAIL || process.env.STORE_CONTACT_EMAIL || 'contact@jainamtraders.com',
  openingTime: '07:30',
  closingTime: '21:30',
  openingHoursFormatted: '07:30 AM – 09:30 PM (Mon – Sat)',
  closedDaysFormatted: 'Closed on Sunday',
  weeklyClosedDays: ['Sunday'],
  holidayDates: [],
  supportHoursNotice: 'Open daily 07:30 - 21:30',
  shopDescription:
    'Serving our local community with curated premium photo frames, artistic wall clocks, executive stationery, leather accessories, toys, perfumes, and memorable gifts. Inspect before payment with counter collection.',
  pickupInstructions:
    'Show your Order Number (JT-...) or digital QR code at our counter. Inspect and verify items in person. Payment accepted via Cash or UPI.',
  isModeBSlotsEnabled: true,
  maxOrdersPerSlot: 10,
  socialFacebook: 'https://facebook.com/jainamtraders',
  socialInstagram: 'https://instagram.com/jainamtraders',
  updatedAt: new Date().toISOString(),
};

export function getCanonicalShopConfig(): CanonicalShopInfo {
  return CANONICAL_SHOP_CONFIG;
}
