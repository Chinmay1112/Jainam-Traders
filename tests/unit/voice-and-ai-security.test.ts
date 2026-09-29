import { describe, it, expect } from 'vitest';
import { parseSearchQuery, getCustomerProducts, executeAiSupportTool } from '@/lib/db/store-service';

describe('Voice Query Parsing & Hindi/Hinglish Natural Search', () => {
  it('correctly parses colloquial Hindi stop words and extracts product keywords', () => {
    const q1 = parseSearchQuery('photo frame dikhao');
    expect(q1.tokens).toContain('photo');
    expect(q1.tokens).toContain('frame');
    expect(q1.tokens).not.toContain('dikhao');

    const q2 = parseSearchQuery('wall clock chahiye please');
    expect(q2.tokens).toContain('wall');
    expect(q2.tokens).toContain('clock');
    expect(q2.tokens).not.toContain('chahiye');
    expect(q2.tokens).not.toContain('please');

    const q3 = parseSearchQuery('perfume hai?');
    expect(q3.tokens).toContain('perfume');
    expect(q3.tokens).not.toContain('hai');
  });

  it('correctly extracts natural price/budget constraints from spoken queries', () => {
    const res1 = parseSearchQuery('500 rupaye ke andar gift dikhao');
    expect(res1.inferredMaxPrice).toBe(500);
    expect(res1.tokens).toContain('gift');

    const res2 = parseSearchQuery('under 1000 brass idol');
    expect(res2.inferredMaxPrice).toBe(1000);
    expect(res2.tokens).toContain('brass');
    expect(res2.tokens).toContain('idol');

    const res3 = parseSearchQuery('gifts below 750 rs');
    expect(res3.inferredMaxPrice).toBe(750);
  });

  it('retrieves relevant products when queried with colloquial phrasing', async () => {
    // 1. "photo frame dikhao"
    const frames = await getCustomerProducts({ query: 'photo frame dikhao' });
    expect(frames.products.length).toBeGreaterThan(0);
    expect(frames.products.every((p) => p.name.toLowerCase().includes('frame') || p.tags.includes('photo frame'))).toBe(true);

    // 2. "500 ke andar gift"
    const budgetGifts = await getCustomerProducts({ query: '500 ke andar gift' });
    expect(budgetGifts.products.length).toBeGreaterThan(0);
    expect(budgetGifts.products.every((p) => p.price <= 500)).toBe(true);

    // 3. "wall clock dikhao"
    const clocks = await getCustomerProducts({ query: 'wall clock dikhao' });
    expect(clocks.products.length).toBeGreaterThan(0);
    expect(clocks.products.some((p) => p.name.toLowerCase().includes('clock'))).toBe(true);
  });

  it('safely handles malicious, empty, or special character queries without crashing', async () => {
    const malicious1 = await getCustomerProducts({ query: '<script>alert("xss")</script>' });
    expect(Array.isArray(malicious1.products)).toBe(true);

    const malicious2 = await getCustomerProducts({ query: "' OR '1'='1" });
    expect(Array.isArray(malicious2.products)).toBe(true);

    const empty = await getCustomerProducts({ query: '   ' });
    expect(empty.products.length).toBeGreaterThan(0);

    const longQuery = await getCustomerProducts({ query: 'a'.repeat(500) });
    expect(Array.isArray(longQuery.products)).toBe(true);
  });
});

describe('AI Support Security & Privacy Safeguards', () => {
  it('never exposes exact stock numbers through AI support tools', async () => {
    const resultsStr = await executeAiSupportTool('search_products', { query: 'frame' });
    const results = JSON.parse(resultsStr);
    expect(results.length).toBeGreaterThan(0);

    for (const item of results) {
      // Must only show availability string, not raw stock units
      expect(item.availability).toMatch(/Available for pickup|Currently Out of Stock/);
      expect(item.stockQuantity).toBeUndefined();
      expect(item.reservedStock).toBeUndefined();
    }
  });

  it('never exposes customer phone numbers, emails, or addresses in order status tool', async () => {
    const orderStatusStr = await executeAiSupportTool('get_order_status', { orderNumber: 'JT-2026-0001' });
    const orderInfo = JSON.parse(orderStatusStr);
    if (!orderInfo.error) {
      expect(orderInfo.customerPhone).toBeUndefined();
      expect(orderInfo.customerEmail).toBeUndefined();
      expect(orderInfo.shippingAddress).toBeUndefined();
      expect(orderInfo.status).toBeDefined();
      expect(orderInfo.totalAmount).toBeDefined();
    }
  });

  it('returns valid shop location and opening hours without inventing details', async () => {
    const infoStr = await executeAiSupportTool('get_shop_information', {});
    const info = JSON.parse(infoStr);
    expect(info.shopName).toBe('Jainam Traders');
    expect(info.address).toContain('Mahaveer Market, Main Bazar Road');
    expect(info.openingTime).toBe('09:30');
    expect(info.closingTime).toBe('21:30');
    expect(info.weeklyClosedDays).toContain('Sunday');
  });
});
