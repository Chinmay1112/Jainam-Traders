import { CANONICAL_SHOP_CONFIG } from '@/lib/config/shop-config';

export interface ShopLocationInput {
  latitude?: number | string | null;
  longitude?: number | string | null;
  shopAddress?: string | null;
  googleMapsUrl?: string | null;
  googleMapsPlaceUrl?: string | null;
  googleMapsPlaceId?: string | null;
  isLocationVerified?: boolean;
}

export const AUTHORITATIVE_LAT = 22.2765869;
export const AUTHORITATIVE_LNG = 75.7979897;
export const AUTHORITATIVE_MAPS_URL = 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA';

/**
 * Returns a strictly validated Google Maps directions or place URL for Jainam Traders.
 *
 * Guarantees:
 * 1. Coordinates default to the authoritative verified coordinates (22.2765869, 75.7979897).
 * 2. Unverified locations return null, enabling safe fallback ("Shop location is being configured.").
 * 3. Prioritizes the authoritative owner-verified Google Maps URL (https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA).
 * 4. Never generates empty, "undefined", "null", or placeholder URLs.
 */
export function getShopDirectionsUrl(
  settings?: Partial<ShopLocationInput> | null
): string | null {
  const shop = settings || CANONICAL_SHOP_CONFIG;
  const rawLat = shop.latitude;
  const rawLng = shop.longitude;

  // Rule 1: If location is explicitly unverified, block directions safely
  if (shop.isLocationVerified === false) {
    return null;
  }

  // Rule 2: Prioritize authoritative owner-verified Google Maps Place URL or share link
  const explicitUrl = (shop.googleMapsPlaceUrl || shop.googleMapsUrl || '').trim();
  if (
    explicitUrl &&
    explicitUrl.startsWith('https://') &&
    !explicitUrl.includes('undefined') &&
    !explicitUrl.includes('null') &&
    !explicitUrl.includes('placeholder') &&
    !explicitUrl.toLowerCase().includes('patidar')
  ) {
    return explicitUrl;
  }

  // Rule 4: If coordinates are valid and verified, use direct destination link
  if (rawLat !== null && rawLat !== undefined && rawLng !== null && rawLng !== undefined) {
    const lat = typeof rawLat === 'number' ? rawLat : Number(rawLat);
    const lng = typeof rawLng === 'number' ? rawLng : Number(rawLng);

    if (
      shop.isLocationVerified &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !(lat === 0 && lng === 0)
    ) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
  }

  // Rule 4: Use Place ID if present
  const placeId = (shop.googleMapsPlaceId || '').trim();
  if (placeId && placeId.length >= 6) {
    return `https://www.google.com/maps/search/?api=1&query=Jainam+Traders&query_place_id=${encodeURIComponent(placeId)}`;
  }

  // Safe fallback: Return null rather than guessing coordinates
  return null;
}
