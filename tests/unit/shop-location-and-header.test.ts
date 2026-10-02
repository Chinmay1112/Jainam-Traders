import { describe, it, expect } from 'vitest';
import { getShopDirectionsUrl } from '@/lib/location/directions';
import { getStoreLiveStatus, formatTime12h } from '@/lib/location/shop-status';
import { CANONICAL_SHOP_CONFIG } from '@/lib/config/shop-config';

describe('Shop Location & Google Maps Directions Engine', () => {
  it('safely blocks directions when location is unverified', () => {
    const unverifiedUrl = getShopDirectionsUrl({
      isLocationVerified: false,
      googleMapsPlaceUrl: 'https://maps.google.com/?q=some-location',
    });
    expect(unverifiedUrl).toBeNull();
  });

  it('strictly validates coordinate ranges (-90..90, -180..180) and rejects invalid locations', () => {
    const invalidUrl = getShopDirectionsUrl({
      latitude: 999,
      longitude: 999,
      isLocationVerified: true,
      googleMapsPlaceUrl: '',
      googleMapsUrl: '',
    });
    expect(invalidUrl).toBeNull();
  });

  it('uses authoritative owner-provided Google Maps location for Jainam Traders', () => {
    const url = getShopDirectionsUrl({
      isLocationVerified: true,
      googleMapsPlaceUrl: 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
    });

    expect(url).toBe('https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA');
    expect(url).not.toContain('undefined');
    expect(url).not.toContain('null');
    expect(url?.toLowerCase()).not.toContain('patidar');
  });

  it('canonical shop configuration uses owner-verified link with verified coordinates', () => {
    const canonicalUrl = getShopDirectionsUrl();
    expect(canonicalUrl).toBe(CANONICAL_SHOP_CONFIG.googleMapsUrl);
    expect(CANONICAL_SHOP_CONFIG.latitude).toBe(22.2765869);
    expect(CANONICAL_SHOP_CONFIG.longitude).toBe(75.7979897);
    expect(CANONICAL_SHOP_CONFIG.isLocationVerified).toBe(true);
    expect(CANONICAL_SHOP_CONFIG.googleMapsUrl).toBe('https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA');
  });

  it('supports Google Maps Place ID format when available', () => {
    const urlWithPlaceId = getShopDirectionsUrl({
      isLocationVerified: true,
      googleMapsPlaceId: '11npvmc_v9',
      googleMapsPlaceUrl: '',
      googleMapsUrl: '',
    });

    expect(urlWithPlaceId).toBe(
      'https://www.google.com/maps/search/?api=1&query=Jainam+Traders&query_place_id=11npvmc_v9'
    );
  });

  it('rejects placeholder URLs and returns null gracefully when location data is empty', () => {
    const emptyUrl = getShopDirectionsUrl({
      isLocationVerified: true,
      latitude: null,
      longitude: null,
      googleMapsPlaceUrl: '',
      googleMapsUrl: 'https://maps.google.com/?q=placeholder',
    });
    expect(emptyUrl).toBeNull();

    const nullDataUrl = getShopDirectionsUrl({
      isLocationVerified: true,
      latitude: null,
      longitude: null,
      googleMapsPlaceUrl: '',
      googleMapsUrl: '',
    });
    expect(nullDataUrl).toBeNull();
  });

  it('guarantees no undefined or null appears in the generated URL', () => {
    const url = getShopDirectionsUrl({
      isLocationVerified: true,
      googleMapsPlaceUrl: 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
    });
    expect(url).toBeDefined();
    expect(url).not.toMatch(/undefined|null/i);
  });
});

describe('Store Live Open/Closed Status (Asia/Kolkata)', () => {
  it('formats 24h time strings to friendly 12h AM/PM format', () => {
    expect(formatTime12h('07:30')).toBe('7:30 AM');
    expect(formatTime12h('21:30')).toBe('9:30 PM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('00:15')).toBe('12:15 AM');
  });

  it('returns Open now during normal working hours on an open day', () => {
    // 2026-10-01 is a Thursday, 12:00 UTC -> 17:30 IST (inside 07:30-21:30)
    const midDayThursday = new Date('2026-10-01T12:00:00.000Z');
    const status = getStoreLiveStatus(
      {
        openingTime: '07:30',
        closingTime: '21:30',
        weeklyClosedDays: ['Sunday'],
      },
      midDayThursday
    );

    expect(status.isOpen).toBe(true);
    expect(status.statusBadge).toBe('Open now');
    expect(status.detailText).toBe('Closes at 9:30 PM');
    expect(status.fullStatus).toBe('Open now • Closes at 9:30 PM');
  });

  it('returns Closed when current time is after closing time on a weekday', () => {
    // 2026-10-01 (Thursday) 17:00 UTC -> 22:30 IST (after 21:30)
    const nightThursday = new Date('2026-10-01T17:00:00.000Z');
    const status = getStoreLiveStatus(
      {
        openingTime: '07:30',
        closingTime: '21:30',
        weeklyClosedDays: ['Sunday'],
      },
      nightThursday
    );

    expect(status.isOpen).toBe(false);
    expect(status.statusBadge).toBe('Closed');
    expect(status.detailText).toBe('Opens tomorrow at 7:30 AM');
  });

  it('returns Closed today when current day is Sunday', () => {
    // 2026-10-04 is a Sunday
    const sundayDate = new Date('2026-10-04T07:00:00.000Z'); // 12:30 IST
    const status = getStoreLiveStatus(
      {
        openingTime: '07:30',
        closingTime: '21:30',
        weeklyClosedDays: ['Sunday'],
      },
      sundayDate
    );

    expect(status.isOpen).toBe(false);
    expect(status.statusBadge).toBe('Closed today');
    expect(status.detailText).toContain('Opens tomorrow at 7:30 AM');
  });

  it('correctly calculates next open day as Monday when store closes on Saturday night', () => {
    // 2026-10-03 is a Saturday, 17:00 UTC -> 22:30 IST (after closing on Saturday)
    const saturdayNight = new Date('2026-10-03T17:00:00.000Z');
    const status = getStoreLiveStatus(
      {
        openingTime: '07:30',
        closingTime: '21:30',
        weeklyClosedDays: ['Sunday'],
      },
      saturdayNight
    );

    expect(status.isOpen).toBe(false);
    expect(status.statusBadge).toBe('Closed');
    expect(status.detailText).toBe('Opens Monday at 7:30 AM');
  });
});

describe('Canonical Shop Configuration Integrity', () => {
  it('contains genuine retail configuration with zero Patidar references or guessed coordinates', () => {
    expect(CANONICAL_SHOP_CONFIG.shopName).toBe('Jainam Traders');
    expect(CANONICAL_SHOP_CONFIG.latitude).toBe(22.2765869);
    expect(CANONICAL_SHOP_CONFIG.longitude).toBe(75.7979897);
    expect(CANONICAL_SHOP_CONFIG.googleMapsUrl).toBe('https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA');
    expect(CANONICAL_SHOP_CONFIG.isLocationVerified).toBe(true);
    expect(CANONICAL_SHOP_CONFIG.openingTime).toBe('07:30');
    expect(CANONICAL_SHOP_CONFIG.closingTime).toBe('21:30');
  });
});
