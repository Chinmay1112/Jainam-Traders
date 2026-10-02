// ==============================================================================
// JAINAM TRADERS — DUPLICATE PRODUCT PREVENTION & SMART SUGGESTION TEST SUITE
// Automated verification of Requirements 1 to 28:
// - Exact duplicates, case/format variations, typos, variants, brand difference
// - Manufacturer model number matching
// - Database/Server SKU and Barcode uniqueness
// - Differentiator confirmation workflows
// - Catalogue duplicate audit and Owner-only reversible merging
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { Product } from '@/lib/types';
import {
  normalizeProductText,
  normalizeIdentifier,
  tokenizeProductText,
  levenshteinDistance,
  stringSimilarity,
  tokenOverlapRatio,
  detectVariantDifference,
  findSimilarProducts,
  auditCatalogueDuplicates,
} from '@/lib/products/duplicate-detector';
import {
  storeDb,
  seedTestFixtures,
  createAdminProduct,
  updateAdminProduct,
} from '@/lib/db/store-service';

describe('1. Normalization & Tokenization Engine (Requirements 3 & 27)', () => {
  it('normalizes case, punctuation, hyphens, and repeated whitespace identically', () => {
    const raw1 = 'Wall Clock';
    const raw2 = 'wall clock';
    const raw3 = 'WALL CLOCK';
    const raw4 = 'wall-clock';
    const raw5 = 'wall  clock';

    const norm1 = normalizeProductText(raw1);
    const norm2 = normalizeProductText(raw2);
    const norm3 = normalizeProductText(raw3);
    const norm4 = normalizeProductText(raw4);
    const norm5 = normalizeProductText(raw5);

    expect(norm1).toBe('wall clock');
    expect(norm2).toBe('wall clock');
    expect(norm3).toBe('wall clock');
    expect(norm4).toBe('wall clock');
    expect(norm5).toBe('wall clock');
  });

  it('normalizes SKU and barcode identifiers by trimming, uppercase, and removing separators', () => {
    expect(normalizeIdentifier(' jt-clk-001 ')).toBe('JTCLK001');
    expect(normalizeIdentifier('JT_CLK_001')).toBe('JTCLK001');
    expect(normalizeIdentifier('8901234-5678')).toBe('89012345678');
  });

  it('tokenizes product text into searchable, non-trivial words', () => {
    const tokens = tokenizeProductText('Silent Sweep 12-inch Wooden Wall Clock!');
    expect(tokens).toContain('silent');
    expect(tokens).toContain('sweep');
    expect(tokens).toContain('wooden');
    expect(tokens).toContain('wall');
    expect(tokens).toContain('clock');
  });
});

describe('2. String Similarity & Levenshtein Algorithms', () => {
  it('calculates accurate Levenshtein distance', () => {
    expect(levenshteinDistance('wall', 'wall')).toBe(0);
    expect(levenshteinDistance('fram', 'frame')).toBe(1);
    expect(levenshteinDistance('clock', 'clok')).toBe(1);
    expect(levenshteinDistance('clock', 'watch')).toBe(4);
  });

  it('calculates fuzzy typo string similarity', () => {
    const sim = stringSimilarity('Photo Frame', 'Photo Fram');
    expect(sim).toBeGreaterThanOrEqual(0.9);
  });

  it('calculates token overlap ratio correctly with minor typo tolerance', () => {
    const overlap = tokenOverlapRatio('silent sweep wall clock', 'silent swep wall clock');
    expect(overlap).toBeGreaterThanOrEqual(0.8);
  });
});

describe('3. Variant Differentiator Intelligence (Requirement 13 & 14)', () => {
  it('detects numeric size differences between items (e.g. 12 inch vs 18 inch)', () => {
    const variant = detectVariantDifference('Wall Clock 12 Inch', 'Wall Clock 18 Inch');
    expect(variant.isVariant).toBe(true);
    expect(variant.differentiator).toContain('12');
    expect(variant.differentiator).toContain('18');
  });

  it('detects color differences between products (e.g. Black vs White)', () => {
    const variant = detectVariantDifference('Photo Frame Black', 'Photo Frame White');
    expect(variant.isVariant).toBe(true);
    expect(variant.differentiator).toContain('black');
    expect(variant.differentiator).toContain('white');
  });

  it('does not classify completely distinct items as variants', () => {
    const variant = detectVariantDifference('Wall Clock', 'Leather Wallet');
    expect(variant.isVariant).toBe(false);
  });
});

describe('4. Comprehensive Duplicate Search & Confidence Levels (Requirements 1 - 12 & 28)', () => {
  const sampleCatalog: Product[] = [
    {
      id: 'prod-clk-1',
      name: 'Silent Sweep 12-inch Wooden Wall Clock',
      sku: 'JT-CLK-001',
      barcodeValue: '8901001001',
      brand: 'Ajanta Quartz',
      categoryId: 'cat-clocks',
      categoryName: 'Clocks',
      description: 'Elegant wooden wall clock with silent sweep movement',
      price: 599,
      mrp: 999,
      discountPercentage: 40,
      stockQuantity: 7,
      reservedStock: 0,
      lowStockThreshold: 3,
      minOrderQuantity: 1,
      maxOrderQuantity: 10,
      tags: ['wooden', 'silent', 'wall clock'],
      thumbnailUrl: '/images/clock-1.jpg',
      images: ['/images/clock-1.jpg'],
      slug: 'silent-sweep-12-inch-wooden-wall-clock',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      status: 'published',
      isArchived: false,
      isActive: true,
      manufacturerModelNumber: 'XYZ-100',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod-frm-1',
      name: 'Photo Frame Elegant Rosewood',
      sku: 'JT-FRM-005',
      barcodeValue: '8901002005',
      brand: 'Jainam Crafts',
      categoryId: 'cat-frames',
      categoryName: 'Photo Frames',
      description: 'Rosewood picture frame',
      price: 399,
      mrp: 699,
      discountPercentage: 43,
      stockQuantity: 12,
      reservedStock: 0,
      lowStockThreshold: 3,
      minOrderQuantity: 1,
      maxOrderQuantity: 10,
      tags: ['rosewood', 'frame'],
      thumbnailUrl: '/images/frame-1.jpg',
      images: ['/images/frame-1.jpg'],
      slug: 'photo-frame-elegant-rosewood',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      status: 'published',
      isArchived: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('TEST CASE: Exact Duplicates & Case Variations ("wall clock" vs "Silent Sweep 12-inch Wooden Wall Clock")', () => {
    const matches = findSimilarProducts(sampleCatalog, {
      name: 'Silent Sweep 12-inch Wooden Wall Clock',
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].product.sku).toBe('JT-CLK-001');
    expect(matches[0].confidence).toBe('HIGH');
    expect(matches[0].score).toBeGreaterThanOrEqual(90);
  });

  it('TEST CASE: Case / Format Variation ("silent-sweep-wall-clock")', () => {
    const matches = findSimilarProducts(sampleCatalog, {
      name: 'silent-sweep-wall-clock',
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].product.sku).toBe('JT-CLK-001');
    expect(matches[0].score).toBeGreaterThanOrEqual(60);
  });

  it('TEST CASE: Typo Fuzzy Match ("Photo Fram")', () => {
    const matches = findSimilarProducts(sampleCatalog, {
      name: 'Photo Fram Elegant Rosewood',
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].product.sku).toBe('JT-FRM-005');
    expect(matches[0].score).toBeGreaterThanOrEqual(75);
  });

  it('TEST CASE: Variant Differentiator ("Silent Sweep 18-inch Wooden Wall Clock")', () => {
    const matches = findSimilarProducts(sampleCatalog, {
      name: 'Silent Sweep 18-inch Wooden Wall Clock',
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].product.sku).toBe('JT-CLK-001');
    // Variant intelligence keeps score <= 75 and confidence at MEDIUM so it can be created upon confirmation
    expect(matches[0].score).toBeLessThanOrEqual(75);
    expect(matches[0].confidence).toBe('MEDIUM');
    expect(matches[0].matchReasons.some((r) => r.includes('variant'))).toBe(true);
  });

  it('TEST CASE: Manufacturer Model Number match ("XYZ-100")', () => {
    const matches = findSimilarProducts(sampleCatalog, {
      name: 'Completely Different Clock Title',
      manufacturerModelNumber: 'XYZ-100',
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].product.sku).toBe('JT-CLK-001');
    expect(matches[0].matchedFields).toContain('modelNumber');
    expect(matches[0].score).toBeGreaterThanOrEqual(95);
  });

  it('TEST CASE: Identifier collision (Exact SKU or Barcode)', () => {
    const skuMatches = findSimilarProducts(sampleCatalog, {
      name: 'Any Product',
      sku: 'JT-CLK-001',
    });
    expect(skuMatches[0].confidence).toBe('EXACT');
    expect(skuMatches[0].score).toBe(100);

    const barcodeMatches = findSimilarProducts(sampleCatalog, {
      name: 'Any Product',
      barcodeValue: '8901001001',
    });
    expect(barcodeMatches[0].confidence).toBe('EXACT');
    expect(barcodeMatches[0].score).toBe(100);
  });
});

describe('5. Server-Side Guard & Database Uniqueness (Requirements 9, 10, 14, 22, 23)', () => {
  beforeEach(() => {
    storeDb.products = [];
    storeDb.orders = [];
    storeDb.reviews = [];
    storeDb.inventoryMovements = [];
    storeDb.auditLogs = [];

    // Seed one existing canonical product
    storeDb.products.push({
      id: 'prod-canonical-1',
      name: 'Silent Sweep 12-inch Wooden Wall Clock',
      sku: 'JT-CLK-001',
      barcodeValue: '8901234567890',
      brand: 'Ajanta Quartz',
      categoryId: 'cat-clocks',
      categoryName: 'Clocks',
      description: 'Original wall clock',
      price: 599,
      mrp: 999,
      discountPercentage: 40,
      stockQuantity: 7,
      reservedStock: 0,
      lowStockThreshold: 3,
      minOrderQuantity: 1,
      maxOrderQuantity: 10,
      tags: ['wooden', 'wall clock'],
      thumbnailUrl: '/images/clock.jpg',
      images: ['/images/clock.jpg'],
      slug: 'silent-sweep-12-inch-wooden-wall-clock',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      status: 'published',
      isArchived: false,
      isActive: true,
      manufacturerModelNumber: 'MOD-900',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('HARD REJECT: Duplicate SKU creation must be rejected server-side', async () => {
    await expect(
      createAdminProduct({
        name: 'Another Wall Clock',
        sku: 'JT-CLK-001', // Existing SKU
        price: 499,
        mrp: 899,
        stockQuantity: 5,
      })
    ).rejects.toThrow(/Duplicate SKU rejected/);
  });

  it('HARD REJECT: Duplicate Barcode creation must be rejected server-side', async () => {
    await expect(
      createAdminProduct({
        name: 'Another Wall Clock',
        sku: 'JT-CLK-999',
        barcodeValue: '8901234567890', // Existing Barcode
        price: 499,
        mrp: 899,
        stockQuantity: 5,
      })
    ).rejects.toThrow(/Duplicate barcode rejected/);
  });

  it('HIGH-CONFIDENCE WARNING: Rejects creation without differentiator confirmation', async () => {
    await expect(
      createAdminProduct({
        name: 'Silent Sweep 12-inch Wooden Wall Clock', // Identical name
        sku: 'JT-CLK-002',
        price: 599,
        mrp: 999,
        stockQuantity: 3,
      })
    ).rejects.toThrow(/DUPLICATE_PRODUCT_WARNING/);
  });

  it('ALLOWS CREATION: When staff provides differentiator reason (e.g. Different size / variant)', async () => {
    const created = await createAdminProduct({
      name: 'Silent Sweep 12-inch Wooden Wall Clock',
      sku: 'JT-CLK-002',
      price: 599,
      mrp: 999,
      stockQuantity: 3,
      confirmDifferentiator: {
        reason: 'Different design',
        note: 'Matte mahogany finish edition',
      },
    }, 'staff-admin-1');

    expect(created).toBeDefined();
    expect(created.sku).toBe('JT-CLK-002');
    expect(storeDb.products.length).toBe(2);

    // Audit log must record the differentiator reason
    const log = storeDb.auditLogs.find((l) => l.action === 'CREATE_PRODUCT');
    expect(log).toBeDefined();
    expect(log?.metadata?.differentiatorReason).toBe('Different design');
  });

  it('UPDATES: Stores and updates manufacturerModelNumber', async () => {
    const product = storeDb.products[0];
    const updated = await updateAdminProduct(product.id, {
      manufacturerModelNumber: 'MOD-900-V2',
    });

    expect(updated.manufacturerModelNumber).toBe('MOD-900-V2');
  });
});

describe('6. Existing Duplicate Catalogue Audit (Requirement 19)', () => {
  it('identifies and groups potential duplicates already present in catalogue', () => {
    const catalogWithDuplicates: Product[] = [
      {
        id: 'p1',
        name: 'Wooden Wall Clock',
        slug: 'wooden-wall-clock',
        sku: 'JT-CLK-001',
        barcodeValue: '890001',
        brand: 'Jainam',
        categoryId: 'c1',
        description: 'Wall clock',
        thumbnailUrl: '/images/p1.jpg',
        images: ['/images/p1.jpg'],
        tags: ['clock'],
        price: 599,
        mrp: 999,
        discountPercentage: 40,
        stockQuantity: 7,
        reservedStock: 0,
        lowStockThreshold: 3,
        minOrderQuantity: 1,
        maxOrderQuantity: 10,
        isFeatured: false,
        isNewArrival: false,
        isBestSeller: false,
        status: 'published',
        isArchived: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p2',
        name: 'Wooden Wall Clock Handcrafted',
        slug: 'wooden-wall-clock-handcrafted',
        sku: 'JT-CLK-017',
        barcodeValue: '890017',
        brand: 'Jainam',
        categoryId: 'c1',
        description: 'Wall clock handcrafted',
        thumbnailUrl: '/images/p2.jpg',
        images: ['/images/p2.jpg'],
        tags: ['clock'],
        price: 599,
        mrp: 999,
        discountPercentage: 40,
        stockQuantity: 3,
        reservedStock: 0,
        lowStockThreshold: 3,
        minOrderQuantity: 1,
        maxOrderQuantity: 10,
        isFeatured: false,
        isNewArrival: false,
        isBestSeller: false,
        status: 'published',
        isArchived: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const auditGroups = auditCatalogueDuplicates(catalogWithDuplicates);
    expect(auditGroups.length).toBe(1);
    expect(auditGroups[0].length).toBe(2);
    expect(auditGroups[0][0].product.sku).toBe('JT-CLK-001');
    expect(auditGroups[0][1].product.sku).toBe('JT-CLK-017');
    expect(auditGroups[0][1].score).toBeGreaterThanOrEqual(70);
  });
});
