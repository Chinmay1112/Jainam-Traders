// ==============================================================================
// JAINAM TRADERS — CATEGORY PAGE FILTERING & RESOLUTION REGRESSION TESTS
// Verifies:
// A. Product exists + search -> visible
// B. Product exists + correct category -> visible on category page
// C. Product in another category -> does not appear
// D. Archived product -> does not appear
// E. Inactive product -> does not appear
// F. Category with zero products -> correctly shows empty state
// G. Category slug/URL correctly resolves to canonical category
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { searchCatalogue } from '@/lib/search/search-engine';
import { getCustomerProducts, getCategoryBySlug, storeDb } from '@/lib/db/store-service';
import { Product } from '@/lib/types';

describe('Category Page Filtering & Slug Resolution Regression Suite', () => {
  const toyProduct: Product = {
    id: 'a2dd492a-9a2b-462a-bab2-8be1eab95988',
    name: 'Car Wahh',
    sku: 'JT-TOY-001',
    barcodeValue: 'JT-TOY-001',
    slug: 'car-wahh',
    categoryId: 'b0000000-0000-0000-0000-000000000007',
    categoryName: 'Toys & Board Games',
    categorySlug: 'toys-games',
    description: 'High-speed remote control car toy',
    price: 720,
    mrp: 800,
    discountPercentage: 10,
    thumbnailUrl: '/images/product-placeholder.svg',
    images: ['/images/product-placeholder.svg'],
    stockQuantity: 2,
    reservedStock: 0,
    lowStockThreshold: 1,
    minOrderQuantity: 1,
    maxOrderQuantity: 10,
    tags: ['car', 'toy', 'remote control'],
    brand: 'Jainam Traders',
    isFeatured: false,
    isNewArrival: true,
    isBestSeller: false,
    isActive: true,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const giftProduct: Product = {
    id: 'b1111111-1111-4111-8111-111111111111',
    name: 'Crystal Trophy Memento',
    sku: 'JT-GIFT-001',
    barcodeValue: 'JT-GIFT-001',
    slug: 'crystal-trophy-memento',
    categoryId: 'b0000000-0000-0000-0000-000000000001',
    categoryName: 'Gift Articles & Mementos',
    categorySlug: 'gifts-mementos',
    description: 'Engraved crystal memento piece',
    price: 450,
    mrp: 500,
    discountPercentage: 10,
    thumbnailUrl: '/images/product-placeholder.svg',
    images: ['/images/product-placeholder.svg'],
    stockQuantity: 5,
    reservedStock: 0,
    lowStockThreshold: 1,
    minOrderQuantity: 1,
    maxOrderQuantity: 5,
    tags: ['gift', 'memento', 'crystal'],
    brand: 'Jainam Traders',
    isFeatured: true,
    isNewArrival: false,
    isBestSeller: false,
    isActive: true,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const archivedToy: Product = {
    ...toyProduct,
    id: 'archived-toy-001',
    name: 'Old Broken Car',
    sku: 'JT-OLD-TOY',
    status: 'archived',
    isArchived: true,
    isActive: false,
  };

  const inactiveToy: Product = {
    ...toyProduct,
    id: 'inactive-toy-001',
    name: 'Hidden Draft Car',
    sku: 'JT-DRAFT-TOY',
    status: 'draft',
    isActive: false,
  };

  beforeEach(() => {
    storeDb.products = [toyProduct, giftProduct, archivedToy, inactiveToy];
  });

  it('A. Product exists + search -> visible in search results', async () => {
    const res = await getCustomerProducts({ query: 'car wahh' });
    expect(res.total).toBe(1);
    expect(res.products[0].name).toBe('Car Wahh');
    expect(res.products[0].price).toBe(720);
    expect(res.products[0].availability).toBe('AVAILABLE');
  });

  it('B. Product exists + correct category -> visible on category page', async () => {
    const res = await getCustomerProducts({ categorySlug: 'toys-games' });
    expect(res.total).toBe(1);
    expect(res.products[0].name).toBe('Car Wahh');
    expect(res.products[0].categoryId).toBe('b0000000-0000-0000-0000-000000000007');
    expect(res.products[0].categoryName).toBe('Toys & Board Games');
  });

  it('C. Product in another category -> does not appear on wrong category page', async () => {
    const res = await getCustomerProducts({ categorySlug: 'gifts-mementos' });
    expect(res.total).toBe(1);
    expect(res.products[0].name).toBe('Crystal Trophy Memento');
    // Toy must NOT be in gifts
    const foundToy = res.products.find((p) => p.name === 'Car Wahh');
    expect(foundToy).toBeUndefined();
  });

  it('D. Archived product -> does not appear in category catalogue', async () => {
    const res = await getCustomerProducts({ categorySlug: 'toys-games' });
    const foundArchived = res.products.find((p) => p.id === 'archived-toy-001');
    expect(foundArchived).toBeUndefined();
  });

  it('E. Inactive / draft product -> does not appear in category catalogue', async () => {
    const res = await getCustomerProducts({ categorySlug: 'toys-games' });
    const foundInactive = res.products.find((p) => p.id === 'inactive-toy-001');
    expect(foundInactive).toBeUndefined();
  });

  it('F. Category with zero products -> correctly returns empty array', async () => {
    // 'watches' category has no seeded products
    const res = await getCustomerProducts({ categorySlug: 'watches' });
    expect(res.total).toBe(0);
    expect(res.products).toHaveLength(0);
  });

  it('G. Category slug correctly resolves to canonical category', async () => {
    const category = await getCategoryBySlug('toys-games');
    expect(category).not.toBeNull();
    expect(category?.id).toBe('b0000000-0000-0000-0000-000000000007');
    expect(category?.name).toBe('Toys & Board Games');
    expect(category?.slug).toBe('toys-games');
  });

  it('H. Handles category filter even if product row only had categoryName without categorySlug', () => {
    const rawProdWithoutSlug: Product = {
      ...toyProduct,
      categorySlug: undefined,
    };
    const res = searchCatalogue([rawProdWithoutSlug], { categorySlug: 'toys-games' });
    expect(res.total).toBe(1);
    expect(res.products[0].name).toBe('Car Wahh');
  });
});
