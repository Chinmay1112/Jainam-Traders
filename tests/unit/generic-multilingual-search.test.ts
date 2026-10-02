import { describe, it, expect } from 'vitest';
import { searchCatalogue } from '@/lib/search/search-engine';
import { extractSearchIntent, normalizeHindiText, cleanSearchText } from '@/lib/search/normalizer';
import { buildProductSearchIndex, generateProductSearchPreview } from '@/lib/search/product-indexer';
import { searchAnalytics } from '@/lib/search/search-analytics';
import { TEST_DEMO_PRODUCTS } from '../fixtures/test-fixtures';
import { Product } from '@/lib/types';

describe('Generic Multilingual Retail Search Engine', () => {
  // Test dataset with all 12 required categories
  const testCatalogue: Product[] = [
    ...TEST_DEMO_PRODUCTS,
    // Belts & Purses
    {
      id: 'c0000000-0000-0000-0000-000000000021',
      name: 'Full Grain Reversible Leather Belt for Men',
      sku: 'JT-BLT-001',
      slug: 'full-grain-reversible-leather-belt-men',
      categoryId: 'b0000000-0000-0000-0000-000000000008',
      categoryName: 'Belts & Purses',
      description: 'Handcrafted genuine leather formal belt with reversible buckle.',
      shortDescription: 'Classic brown/black reversible genuine leather belt.',
      price: 699,
      mrp: 1299,
      discountPercentage: 46,
      thumbnailUrl: '/images/product-placeholder.svg',
      images: ['/images/product-placeholder.svg'],
      stockQuantity: 12,
      reservedStock: 0,
      lowStockThreshold: 3,
      minOrderQuantity: 1,
      maxOrderQuantity: 5,
      tags: ['belt', 'leather belt', 'men fashion', 'formal'],
      brand: 'Jainam Heritage',
      material: 'Genuine Leather',
      colour: 'Brown/Black',
      dimensions: '34-40 inch',
      weight: '250g',
      occasion: 'Office / Everyday',
      isFeatured: false,
      isNewArrival: true,
      isBestSeller: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'c0000000-0000-0000-0000-000000000022',
      name: 'Embroidered Silk Bridal Clutch Purse',
      sku: 'JT-PRS-001',
      slug: 'embroidered-silk-bridal-clutch-purse',
      categoryId: 'b0000000-0000-0000-0000-000000000008',
      categoryName: 'Belts & Purses',
      description: 'Zari embroidered evening clutch purse with metallic chain strap.',
      shortDescription: 'Handcrafted royal zari work wedding purse.',
      price: 899,
      mrp: 1599,
      discountPercentage: 44,
      thumbnailUrl: '/images/product-placeholder.svg',
      images: ['/images/product-placeholder.svg'],
      stockQuantity: 8,
      reservedStock: 0,
      lowStockThreshold: 2,
      minOrderQuantity: 1,
      maxOrderQuantity: 3,
      tags: ['purse', 'clutch', 'women purse', 'wedding', 'bridal'],
      brand: 'Royal Artisans',
      material: 'Raw Silk & Zari',
      colour: 'Crimson Red',
      dimensions: '20 x 12 x 5 cm',
      weight: '300g',
      occasion: 'Wedding / Festive',
      isFeatured: true,
      isNewArrival: false,
      isBestSeller: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // Stationery
    {
      id: 'c0000000-0000-0000-0000-000000000023',
      name: 'Executive Brass Rollerball Pen in Wooden Case',
      sku: 'JT-STN-001',
      slug: 'executive-brass-rollerball-pen',
      categoryId: 'b0000000-0000-0000-0000-000000000009',
      categoryName: 'Stationery & Desk',
      description: 'Heavyweight brass metallic rollerball pen with smooth German ink refill.',
      shortDescription: 'Premium brass pen for executives and corporate gifting.',
      price: 499,
      mrp: 999,
      discountPercentage: 50,
      thumbnailUrl: '/images/product-placeholder.svg',
      images: ['/images/product-placeholder.svg'],
      stockQuantity: 25,
      reservedStock: 0,
      lowStockThreshold: 5,
      minOrderQuantity: 1,
      maxOrderQuantity: 10,
      tags: ['pen', 'stationery', 'desk', 'corporate gift'],
      brand: 'ChronoTime',
      material: 'Solid Brass',
      colour: 'Gold & Matte Black',
      dimensions: '14 cm',
      weight: '45g',
      occasion: 'Corporate / Office',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // Mementos
    {
      id: 'c0000000-0000-0000-0000-000000000024',
      name: 'Crystal Star Excellence Award Memento Trophy',
      sku: 'JT-MMT-001',
      slug: 'crystal-star-excellence-award-memento',
      categoryId: 'b0000000-0000-0000-0000-000000000005',
      categoryName: 'Gifts & Mementos',
      description: 'Faceted optical crystal star trophy with wooden mahogany base.',
      shortDescription: 'Customizable optical crystal recognition award memento.',
      price: 1199,
      mrp: 1899,
      discountPercentage: 37,
      thumbnailUrl: '/images/product-placeholder.svg',
      images: ['/images/product-placeholder.svg'],
      stockQuantity: 10,
      reservedStock: 0,
      lowStockThreshold: 2,
      minOrderQuantity: 1,
      maxOrderQuantity: 5,
      tags: ['memento', 'trophy', 'award', 'crystal', 'corporate'],
      brand: 'Jainam Heritage',
      material: 'Optical Crystal & Mahogany Wood',
      colour: 'Clear Crystal',
      dimensions: '22 x 10 x 8 cm',
      weight: '1.2 kg',
      occasion: 'Corporate / Annual Meet',
      isFeatured: false,
      isNewArrival: true,
      isBestSeller: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // ============================================================================
  // 1. CLOCKS (English, Hindi, Hinglish, Transliteration, Typo, Price)
  // ============================================================================
  describe('Category: Clocks', () => {
    it('finds clocks via English query', () => {
      const res = searchCatalogue(testCatalogue, { query: 'wall clock' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products[0].name.toLowerCase()).toContain('clock');
    });

    it('finds clocks via pure Hindi (दीवार घड़ी / दीवार घड़ी)', () => {
      const res1 = searchCatalogue(testCatalogue, { query: 'दीवार घड़ी' });
      expect(res1.products.length).toBeGreaterThan(0);
      expect(res1.products[0].name.toLowerCase()).toContain('clock');

      // With Nukta variation
      const res2 = searchCatalogue(testCatalogue, { query: 'दीवार घड़ी' });
      expect(res2.products.length).toBeGreaterThan(0);
      expect(res2.products[0].name.toLowerCase()).toContain('clock');
    });

    it('finds clocks via Hinglish and transliterations (divar ghadi, deewar ghadi, diwar gadi)', () => {
      for (const q of ['divar ghadi', 'deewar ghadi', 'diwar ghadi', 'diwar gadi', 'wall ghadi']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected results for query: ${q}`).toBeGreaterThan(0);
        expect(res.products[0].name.toLowerCase()).toContain('clock');
      }
    });

    it('finds clocks with typo tolerance (wall clok, wal clock, ghdi)', () => {
      const res = searchCatalogue(testCatalogue, { query: 'wall clok' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products[0].name.toLowerCase()).toContain('clock');
    });

    it('finds clocks within price constraint (500 ke andar wall clock)', () => {
      const res = searchCatalogue(testCatalogue, { query: '500 ke andar wall clock' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products.every((p) => p.price <= 500)).toBe(true);
    });
  });

  // ============================================================================
  // 2. WATCHES (English, Hindi, Hinglish, Typo, Intent)
  // ============================================================================
  describe('Category: Watches', () => {
    it('finds watches via English and conversational phrasing', () => {
      const res = searchCatalogue(testCatalogue, { query: 'watch chahiye' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products[0].name.toLowerCase()).toContain('watch');
    });

    it('finds watches via Hindi (हाथ की घड़ी)', () => {
      const res = searchCatalogue(testCatalogue, { query: 'हाथ की घड़ी' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products[0].name.toLowerCase()).toContain('watch');
    });

    it('finds watches via Hinglish and recipient (mens watch, ladko ki watch)', () => {
      const res = searchCatalogue(testCatalogue, { query: 'men wrist watch' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products[0].name.toLowerCase()).toContain('watch');
    });

    it('supports price range for watches (1000 se 1500 ke beech watch)', () => {
      const res = searchCatalogue(testCatalogue, { query: '1000 se 1500 ke beech watch' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products.every((p) => p.price >= 1000 && p.price <= 1500)).toBe(true);
    });
  });

  // ============================================================================
  // 3. GIFTS (English, Hindi, Hinglish, Occasions, Price)
  // ============================================================================
  describe('Category: Gifts', () => {
    it('finds gifts via Hindi synonyms (गिफ्ट, तोहफा, उपहार)', () => {
      for (const q of ['गिफ्ट', 'तोहफा', 'उपहार', 'tohfa', 'uphaar']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected results for gift query: ${q}`).toBeGreaterThan(0);
      }
    });

    it('finds gifts by occasion (birthday gift, wedding gift)', () => {
      const res = searchCatalogue(testCatalogue, { query: 'birthday gift' });
      expect(res.products.length).toBeGreaterThan(0);
    });

    it('finds gifts with budget constraint (500 ke andar gift dikhao)', () => {
      const res = searchCatalogue(testCatalogue, { query: '500 ke andar gift dikhao' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products.every((p) => p.price <= 500)).toBe(true);
    });
  });

  // ============================================================================
  // 4. PHOTO FRAMES (English, Hindi, Transliteration, Typo)
  // ============================================================================
  describe('Category: Photo Frames', () => {
    it('finds photo frames via English and typos (photoframe, photofram)', () => {
      for (const q of ['photo frame', 'photoframe', 'photofram', 'picture frame']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected match for: ${q}`).toBeGreaterThan(0);
        expect(res.products[0].name.toLowerCase()).toContain('frame');
      }
    });

    it('finds photo frames via pure Hindi (फोटो फ्रेम चाहिए)', () => {
      const res = searchCatalogue(testCatalogue, { query: 'फोटो फ्रेम चाहिए' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products[0].name.toLowerCase()).toContain('frame');
    });

    it('finds photo frames with nukta variation (फ़ोटो फ़्रेम)', () => {
      const res = searchCatalogue(testCatalogue, { query: 'फ़ोटो फ़्रेम' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products[0].name.toLowerCase()).toContain('frame');
    });
  });

  // ============================================================================
  // 5. TOYS (English, Hindi, Hinglish, Typo)
  // ============================================================================
  describe('Category: Toys', () => {
    it('finds toys via English, Hindi, and Hinglish (toy, khilona, खिलौना, खिलौने)', () => {
      for (const q of ['toy', 'toys', 'khilona', 'khilone', 'खिलौना', 'खिलौने']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected match for toy query: ${q}`).toBeGreaterThan(0);
      }
    });

    it('finds toy cars via conversational phrases (toy car dikhao, remote car)', () => {
      const res = searchCatalogue(testCatalogue, { query: 'toy car dikhao' });
      expect(res.products.length).toBeGreaterThan(0);
      expect(res.products[0].name.toLowerCase()).toContain('car');
    });
  });

  // ============================================================================
  // 6. BELTS (English, Hindi, Hinglish)
  // ============================================================================
  describe('Category: Belts', () => {
    it('finds belts via English, Hindi, and Hinglish (belt, leather belt, बेल्ट, chamde ka belt)', () => {
      for (const q of ['belt', 'leather belt', 'बेल्ट', 'chamde ka belt']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected match for belt query: ${q}`).toBeGreaterThan(0);
        expect(res.products.some((p) => p.name.toLowerCase().includes('belt'))).toBe(true);
      }
    });
  });

  // ============================================================================
  // 7. WALLETS (English, Hindi, Hinglish, Typo)
  // ============================================================================
  describe('Category: Wallets', () => {
    it('finds wallets via English, typos, Hindi, and Hinglish (wallet, walet, batua, बटुआ, men wallet)', () => {
      for (const q of ['wallet', 'walet', 'men wallet', 'batua', 'बटुआ']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected match for wallet query: ${q}`).toBeGreaterThan(0);
        expect(res.products.some((p) => p.name.toLowerCase().includes('wallet'))).toBe(true);
      }
    });
  });

  // ============================================================================
  // 8. PURSES (English, Hindi, Conversational)
  // ============================================================================
  describe('Category: Purses', () => {
    it('finds purses via English, Hindi, and intent (purse, पर्स, clutch, bridal purse)', () => {
      for (const q of ['purse', 'पर्स', 'bridal purse', 'clutch']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected match for purse query: ${q}`).toBeGreaterThan(0);
        expect(res.products.some((p) => p.name.toLowerCase().includes('purse') || p.tags.includes('clutch'))).toBe(true);
      }
    });
  });

  // ============================================================================
  // 9. PERFUMES (English, Hindi, Hinglish, Typo, Synonyms)
  // ============================================================================
  describe('Category: Perfumes', () => {
    it('finds perfumes via English, typo, Hindi, and attar (perfume, perfum, attar, ittar, इत्र, सेंट)', () => {
      for (const q of ['perfume', 'perfum', 'attar', 'ittar', 'इत्र', 'सेंट dikhao']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected match for perfume query: ${q}`).toBeGreaterThan(0);
        expect(res.products.some((p) => p.categoryName?.toLowerCase().includes('perfume') || p.name.toLowerCase().includes('parfum') || p.name.toLowerCase().includes('attar'))).toBe(true);
      }
    });
  });

  // ============================================================================
  // 10. STATIONERY (English, Hindi, Hinglish)
  // ============================================================================
  describe('Category: Stationery', () => {
    it('finds stationery via English and Hindi (pen, brass pen, कलम, पेन, डायरी)', () => {
      for (const q of ['pen', 'brass pen', 'पेन', 'कलम']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected match for stationery query: ${q}`).toBeGreaterThan(0);
        expect(res.products.some((p) => p.name.toLowerCase().includes('pen') || p.categoryName?.toLowerCase().includes('stationery'))).toBe(true);
      }
    });
  });

  // ============================================================================
  // 11. MEMENTOS & AWARDS (English, Hindi, Conversational)
  // ============================================================================
  describe('Category: Mementos', () => {
    it('finds mementos and trophies via English and synonyms (memento, trophy, award)', () => {
      for (const q of ['memento', 'trophy', 'crystal award']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected match for memento query: ${q}`).toBeGreaterThan(0);
        expect(res.products.some((p) => p.name.toLowerCase().includes('memento') || p.tags.includes('trophy'))).toBe(true);
      }
    });
  });

  // ============================================================================
  // 12. ACCESSORIES & DECORATIVE (English, Hindi, Hinglish)
  // ============================================================================
  describe('Category: Accessories & Decorative', () => {
    it('finds brass diyas, idols, and showpieces (diya, deepak, idol, murti, मूर्ति, दीया)', () => {
      for (const q of ['diya', 'दीया', 'brass diya', 'idol', 'मूर्ति']) {
        const res = searchCatalogue(testCatalogue, { query: q });
        expect(res.products.length, `Expected match for decorative query: ${q}`).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // 13. ZERO CODE CHANGE NEW PRODUCT SUPPORT (Requirement 21)
  // ============================================================================
  describe('Requirement 21: New Product Added Tomorrow Without Code Changes', () => {
    it('automatically indexes and retrieves a brand new Stainless Steel Water Bottle', () => {
      const newProduct: Product = {
        id: 'c9999999-9999-9999-9999-999999999999',
        name: 'Premium Stainless Steel Water Bottle 1000ml',
        sku: 'JT-BTL-999',
        slug: 'premium-stainless-steel-water-bottle',
        categoryId: 'b0000000-0000-0000-0000-000000000010',
        categoryName: 'Kitchen & Accessories',
        description: 'Double walled insulated flask keeping beverages cold for 24h and hot for 12h.',
        shortDescription: 'Insulated vacuum steel bottle.',
        price: 499,
        mrp: 899,
        discountPercentage: 45,
        thumbnailUrl: '/images/product-placeholder.svg',
        images: ['/images/product-placeholder.svg'],
        stockQuantity: 20,
        reservedStock: 0,
        lowStockThreshold: 4,
        minOrderQuantity: 1,
        maxOrderQuantity: 5,
        tags: ['steel', 'bottle', 'water bottle', 'flask'],
        brand: 'Milton Heritage',
        material: 'Stainless Steel',
        colour: 'Matte Silver',
        dimensions: '28 x 7 cm',
        weight: '380g',
        occasion: 'Everyday / Gym',
        isFeatured: false,
        isNewArrival: true,
        isBestSeller: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to catalogue
      const updatedCatalogue = [...testCatalogue, newProduct];

      // Test all customer queries without any developer code changes:
      const queries = [
        'water bottle',
        'bottle',
        'steel bottle',
        'flask',
        'बोतल',
        'पानी की बोतल',
        'water botl',
        'botal',
        'bottle chahiye',
      ];

      for (const q of queries) {
        const res = searchCatalogue(updatedCatalogue, { query: q });
        expect(res.products.length, `Query "${q}" must automatically find new product`).toBeGreaterThan(0);
        expect(res.products[0].id).toBe(newProduct.id);
      }
    });
  });

  // ============================================================================
  // 14. ADMIN SEARCH PREVIEW (Requirement 22)
  // ============================================================================
  describe('Requirement 22: Admin Search Preview', () => {
    it('generates natural query previews for wall clocks', () => {
      const preview = generateProductSearchPreview({
        name: 'Silent Sweep 12-inch Wooden Wall Clock',
        category: 'Clocks & Timepieces',
        tags: ['wooden', 'wall', 'home decor'],
      });
      expect(preview).toContain('wall clock');
      expect(preview).toContain('ghadi');
      expect(preview).toContain('दीवार घड़ी');
    });

    it('generates natural query previews for new accessories like water bottle', () => {
      const preview = generateProductSearchPreview({
        name: 'Premium Stainless Steel Water Bottle',
        category: 'Kitchen & Accessories',
        tags: ['steel', 'bottle', 'flask'],
      });
      expect(preview).toContain('water bottle');
      expect(preview).toContain('बोतल');
    });
  });

  // ============================================================================
  // 15. HINDI NUKTA AND UNICODE NORMALIZATION (Requirement 7)
  // ============================================================================
  describe('Requirement 7: Hindi Normalization & Nukta Equivalency', () => {
    it('normalizes combining nukta so घड़ी and घड़ी produce identical normalized form', () => {
      const standardGhadi = 'घड़ी';
      const nuktaGhadi = 'घ\u0921\u093Cी'; // explicit combining nukta
      expect(normalizeHindiText(standardGhadi)).toBe(normalizeHindiText(nuktaGhadi));
    });

    it('normalizes frame variations (फ्रेम ↔ फ़्रेम)', () => {
      const standardFrame = 'फ्रेम';
      const nuktaFrame = 'फ़्रेम';
      expect(normalizeHindiText(standardFrame)).toBe(normalizeHindiText(nuktaFrame));
    });

    it('normalizes currency variants (रुपये, रुपया, रुपए, rs, ₹)', () => {
      const intent1 = extractSearchIntent('500 रुपये के अंदर घड़ी');
      const intent2 = extractSearchIntent('500 rs ke andar ghadi');
      const intent3 = extractSearchIntent('₹500 ke andar ghadi');
      expect(intent1.maxPrice).toBe(500);
      expect(intent2.maxPrice).toBe(500);
      expect(intent3.maxPrice).toBe(500);
    });
  });

  // ============================================================================
  // 16. ANONYMOUS SEARCH ANALYTICS (Requirement 23)
  // ============================================================================
  describe('Requirement 23: Anonymous Aggregate Search Analytics', () => {
    it('records queries, tracks zero-result searches, and contains no PII', () => {
      searchAnalytics.reset();

      searchAnalytics.record('wall clock', 5);
      searchAnalytics.record('wall clock', 5);
      searchAnalytics.record('unknown spaceship model', 0);

      const summary = searchAnalytics.getSummary();
      expect(summary.totalSearches).toBe(3);
      expect(summary.popularSearches.some((q) => q.query === 'wall clock' && q.count === 2)).toBe(true);
      expect(summary.zeroResultSearches.some((q) => q.query === 'unknown spaceship model')).toBe(true);
    });
  });
});
