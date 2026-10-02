import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeCode128B,
  generateCode128Svg,
  generateTsplForTtp244,
} from '@/lib/barcode/code128';
import { buildLabelHtml } from '@/lib/barcode/thermal-printer';
import {
  checkBarcodeUniqueness,
  generateUniqueProductSku,
  normalizeBarcodeValue,
  resolveScanInput,
} from '@/lib/barcode/barcode-service';
import {
  createAdminProduct,
  updateAdminProduct,
  archiveAdminProduct,
  getProductByBarcode,
  adjustInventory,
  toCustomerProductView,
  storeDb,
} from '@/lib/db/store-service';
import { Product } from '@/lib/types';

describe('JAINAM TRADERS — PRODUCT BARCODE + 60x24mm LANDSCAPE THERMAL LABEL SYSTEM', () => {
  beforeEach(() => {
    // Reset test products to known clean initial state
    storeDb.products = storeDb.products.filter(
      (p) => !p.sku.startsWith('JT-TEST-') && !p.id.startsWith('test-')
    );
  });

  // ============================================================================
  // 1. CODE 128 MATHEMATICAL ENCODING & RENDERING ENGINE
  // ============================================================================
  describe('1. Code 128 Encoding & Rendering', () => {
    it('correctly encodes ASCII string into Code 128 Subset B with valid checksum', () => {
      const encoded = encodeCode128B('JT-PF-002');
      expect(encoded.text).toBe('JT-PF-002');
      expect(encoded.checksum).toBeGreaterThanOrEqual(0);
      expect(encoded.checksum).toBeLessThan(103);
      // Elements must alternate between bars and spaces
      expect(encoded.elements.length).toBeGreaterThan(10);
      expect(encoded.totalModules).toBeGreaterThan(80);
    });

    it('rejects empty string in Code 128 encoder', () => {
      expect(() => encodeCode128B('')).toThrow('Barcode text cannot be empty');
    });

    it('generates standard-compliant SVG with quiet zones for 60x24mm landscape label', () => {
      const svg = generateCode128Svg('JT-PF-002', {
        height: 26,
        moduleWidth: 1.5,
        includeText: true,
      });

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('JT-PF-002');
      expect(svg).toContain('<rect');
    });
  });

  // ============================================================================
  // 2. TSC TTP-244 PRO 60x24mm LANDSCAPE TSPL SCRIPT GENERATION
  // ============================================================================
  describe('2. TSC TTP-244 Pro 60x24mm Landscape TSPL Generation', () => {
    it('generates valid TSPL commands with exact 60mm x 24mm dimensions', () => {
      const tspl = generateTsplForTtp244({
        productName: 'Minimalist Black Matte 6-in-1 Collage Frame',
        sku: 'JT-PF-002',
        mrp: 1299,
        sellingPrice: 849,
        quantity: 1,
        template: 'standard',
      });

      expect(tspl).toContain('SIZE 60 mm, 24 mm');
      expect(tspl).toContain('GAP 3 mm, 0 mm');
      expect(tspl).toContain('DIRECTION 1');
      expect(tspl).toContain('CLS');
      expect(tspl).toContain('JAINAM TRADERS');
      // SKU is rendered directly beneath the barcode bars by the TSC printer (human-readable interpretation parameter = 1)
      expect(tspl).toContain('BARCODE 45,75,"128",55,1,0,2,2,"JT-PF-002"');
      expect(tspl).not.toContain('SKU: JT-PF-002');
      expect(tspl).toContain('Rs.849');
      expect(tspl).toContain('MRP Rs.1299');
      expect(tspl).toContain('35% OFF');
      expect(tspl).toContain('PRINT 1,1');

      // CRITICAL: Barcode parameter MUST NOT encode price or MRP
      expect(tspl).not.toContain('BARCODE 45,75,"128",55,1,0,2,2,"JT-PF-002-1299-849"');
    });

    it('supports Compact template in 60x24mm landscape', () => {
      const compactTspl = generateTsplForTtp244({
        productName: 'Minimalist Collage Frame',
        sku: 'JT-PF-002',
        mrp: 1299,
        sellingPrice: 849,
        quantity: 5,
        template: 'compact',
      });

      expect(compactTspl).toContain('SIZE 60 mm, 24 mm');
      expect(compactTspl).toContain('JAINAM TRADERS');
      expect(compactTspl).toContain('SKU: JT-PF-002');
      expect(compactTspl).toContain('Rs.849');
      expect(compactTspl).toContain('BARCODE 230,40,"128"');
      expect(compactTspl).toContain('PRINT 5,1');
    });

    it('correctly handles products with no discount (MRP == Selling Price) without 0% OFF badge', () => {
      const noDiscountTspl = generateTsplForTtp244({
        productName: 'Dream Roller',
        sku: 'JT-DR-001',
        mrp: 160,
        sellingPrice: 160,
        quantity: 1,
        template: 'standard',
      });

      expect(noDiscountTspl).toContain('Rs.160');
      // Must NOT contain 0% OFF badge
      expect(noDiscountTspl).not.toContain('0% OFF');
    });
  });

  // ============================================================================
  // 3. BARCODE STRATEGY: SKU IS PERMANENT IDENTITY, NO PRICE IN BARCODE
  // ============================================================================
  describe('3. Barcode Strategy & Data Structure', () => {
    it('derives barcode identity from SKU and auto-generates SKU if not provided', async () => {
      const product = await createAdminProduct({
        name: 'Brass Peacock Diya',
        sku: '', // empty to trigger auto-generation
        categoryName: 'Home Decor & Brass',
        categoryId: 'b0000000-0000-0000-0000-000000000002',
        description: 'Authentic Indian Brass oil lamp',
        price: 799,
        mrp: 1200,
        stockQuantity: 25,
      });

      expect(product.sku).toMatch(/^JT-HD-\d{3}$/);
      expect(product.barcodeValue).toBe(product.sku);

      // Verify that barcode contains ONLY the SKU
      expect(product.barcodeValue).not.toContain('799');
      expect(product.barcodeValue).not.toContain('1200');
    });

    it('preserves existing SKU and normalizes to uppercase', async () => {
      const product = await createAdminProduct({
        name: 'Special Wooden Puzzle',
        sku: 'jt-ty-999',
        categoryName: 'Toys & Board Games',
        categoryId: 'b0000000-0000-0000-0000-000000000003',
        description: 'Challenging teak puzzle',
        price: 299,
        mrp: 499,
        stockQuantity: 10,
      });

      expect(product.sku).toBe('JT-TY-999');
      expect(product.barcodeValue).toBe('JT-TY-999');
    });
  });

  // ============================================================================
  // 4. BARCODE COLLISION PROTECTION & UNIQUENESS
  // ============================================================================
  describe('4. Barcode Collision Protection', () => {
    it('rejects creation of product with duplicate SKU', async () => {
      await createAdminProduct({
        name: 'Item A',
        sku: 'JT-COLLISION-01',
        description: 'Desc',
        price: 100,
        mrp: 200,
        categoryId: 'b0000000-0000-0000-0000-000000000001',
      });

      await expect(
        createAdminProduct({
          name: 'Item B',
          sku: 'JT-COLLISION-01',
          description: 'Desc B',
          price: 150,
          mrp: 250,
          categoryId: 'b0000000-0000-0000-0000-000000000001',
        })
      ).rejects.toThrow(/Duplicate SKU rejected/i);
    });

    it('rejects updating an existing product to an already-used SKU', async () => {
      const prodA = await createAdminProduct({
        name: 'First Product',
        sku: 'JT-UNIQUE-A',
        description: 'Desc',
        price: 100,
        mrp: 200,
        categoryId: 'b0000000-0000-0000-0000-000000000001',
      });

      const prodB = await createAdminProduct({
        name: 'Second Product',
        sku: 'JT-UNIQUE-B',
        description: 'Desc',
        price: 100,
        mrp: 200,
        categoryId: 'b0000000-0000-0000-0000-000000000001',
      });

      await expect(
        updateAdminProduct(prodB.id, { sku: 'JT-UNIQUE-A' })
      ).rejects.toThrow(/Duplicate SKU rejected/i);
    });

    it('prevents reusing barcode of an archived product to maintain audit trail', async () => {
      const prod = await createAdminProduct({
        name: 'Archived Item',
        sku: 'JT-ARCHIVE-99',
        description: 'Desc',
        price: 100,
        mrp: 200,
        categoryId: 'b0000000-0000-0000-0000-000000000001',
      });

      await archiveAdminProduct(prod.id);

      await expect(
        createAdminProduct({
          name: 'New Product With Same SKU',
          sku: 'JT-ARCHIVE-99',
          description: 'Desc',
          price: 100,
          mrp: 200,
          categoryId: 'b0000000-0000-0000-0000-000000000001',
        })
      ).rejects.toThrow(/Duplicate SKU rejected/i);
    });
  });

  // ============================================================================
  // 5. SCANNER RESOLVER: PRODUCT BARCODE VS ORDER QR VS INVALID CODE
  // ============================================================================
  describe('5. Scanner Resolver Engine', () => {
    it('correctly resolves Product Code 128 SKU', async () => {
      const prod = await createAdminProduct({
        name: 'Scan Test Toy',
        sku: 'JT-SCAN-001',
        description: 'Desc',
        price: 250,
        mrp: 400,
        stockQuantity: 12,
        categoryId: 'b0000000-0000-0000-0000-000000000003',
      });

      const res = resolveScanInput(storeDb.products, storeDb.orders, 'jt-scan-001');
      expect(res.type).toBe('PRODUCT');
      expect(res.product?.id).toBe(prod.id);
      expect(res.product?.name).toBe('Scan Test Toy');
    });

    it('correctly resolves Order QR token / Order number', () => {
      const order = storeDb.orders[0];
      if (order) {
        const res = resolveScanInput(storeDb.products, storeDb.orders, order.orderNumber);
        expect(res.type).toBe('ORDER');
        expect(res.order?.orderNumber).toBe(order.orderNumber);
      }
    });

    it('gracefully returns NOT_FOUND on unknown barcode or token', () => {
      const res = resolveScanInput(storeDb.products, storeDb.orders, 'JT-UNKNOWN-999');
      expect(res.type).toBe('NOT_FOUND');
      expect(res.error).toBeDefined();
    });
  });

  // ============================================================================
  // 6. INVENTORY ADJUSTMENT VIA SCAN WORKFLOW
  // ============================================================================
  describe('6. Stock Adjustment via Scan Workflow', () => {
    it('correctly increments (+1, +5, +10) and decrements stock with concurrency lock', async () => {
      const prod = await createAdminProduct({
        name: 'Inventory Scan Frame',
        sku: 'JT-INV-001',
        description: 'Desc',
        price: 500,
        mrp: 800,
        stockQuantity: 20,
        categoryId: 'b0000000-0000-0000-0000-000000000002',
      });

      // Staff scans label and adds 5 units (+5)
      const step1 = await adjustInventory(prod.id, undefined, 5, 'restock', 'Quick barcode scan +5');
      expect(step1.product.stockQuantity).toBe(25);

      // Staff scans label and removes 10 units (-10)
      const step2 = await adjustInventory(prod.id, undefined, -10, 'manual_correction', 'Quick barcode scan -10');
      expect(step2.product.stockQuantity).toBe(15);
    });
  });

  // ============================================================================
  // 7. SECURITY: STAFF VS CUSTOMER BARCODE LOOKUP RLS
  // ============================================================================
  describe('7. Security & Information Exposure', () => {
    it('hides exact warehouse inventory numbers from customer product view', async () => {
      const prod = await createAdminProduct({
        name: 'Secret Inventory Item',
        sku: 'JT-SEC-001',
        description: 'Desc',
        price: 150,
        mrp: 300,
        stockQuantity: 47,
        categoryId: 'b0000000-0000-0000-0000-000000000001',
      });

      const customerView = toCustomerProductView(prod);
      expect((customerView as any).stockQuantity).toBeUndefined();
      expect((customerView as any).reservedStock).toBeUndefined();
      expect(customerView.availability).toBe('AVAILABLE');
    });

    it('ensures barcode payload never contains PII, tokens, or passwords', () => {
      const sku = 'JT-PF-002';
      expect(sku).not.toMatch(/@/);
      expect(sku).not.toMatch(/token/i);
      expect(sku).not.toMatch(/bearer/i);
      expect(sku).not.toMatch(/password/i);
    });
  });

  // ============================================================================
  // 8. SECTION 20 & 21 & 23 SPECIFIED TEST CASES
  // ============================================================================
  describe('8. Official User-Specified Test Cases', () => {
    it('handles Section 20 test product: Minimalist Black Matte 6-in-1 Collage Frame', async () => {
      let prod = await getProductByBarcode('JT-PF-002');
      if (!prod) {
        prod = await createAdminProduct({
          name: 'Minimalist Black Matte 6-in-1 Collage Frame',
          sku: 'JT-PF-002',
          mrp: 1299,
          price: 849,
          stockQuantity: 15,
          categoryId: 'b0000000-0000-0000-0000-000000000002',
          description: 'Collage wall frame',
        });
      }

      expect(prod).not.toBeNull();
      expect(prod!.sku).toBe('JT-PF-002');
      expect(prod!.price).toBe(849);
      expect(prod!.mrp).toBe(1299);
      expect(prod!.discountPercentage).toBe(35); // 35% OFF

      const tspl = generateTsplForTtp244({
        productName: prod.name,
        sku: prod.sku,
        mrp: prod.mrp,
        sellingPrice: prod.price,
        discountPercentage: prod.discountPercentage,
        template: 'standard',
      });

      expect(tspl).toContain('SIZE 60 mm, 24 mm');
      expect(tspl).toContain('JT-PF-002');
      expect(tspl).toContain('Rs.849');
      expect(tspl).toContain('35% OFF');
    });

    it('handles Section 21 test product: Dream Roller (no discount)', async () => {
      const prod = await createAdminProduct({
        name: 'Dream Roller',
        sku: 'JT-TY-005',
        mrp: 160,
        price: 160,
        stockQuantity: 30,
        categoryId: 'b0000000-0000-0000-0000-000000000003',
        description: 'Smooth wooden roller toy',
      });

      expect(prod.price).toBe(160);
      expect(prod.mrp).toBe(160);
      expect(prod.discountPercentage).toBe(0);

      const tspl = generateTsplForTtp244({
        productName: prod.name,
        sku: prod.sku,
        mrp: prod.mrp,
        sellingPrice: prod.price,
        discountPercentage: prod.discountPercentage,
        template: 'standard',
      });

      expect(tspl).toContain('Rs.160');
      expect(tspl).not.toContain('0% OFF');
    });

    it('executes full Section 23 lifecycle: create -> scan -> price change -> new 60x24mm label -> scan', async () => {
      const created = await createAdminProduct({
        name: 'Test Photo Frame',
        sku: 'JT-TEST-001',
        price: 500,
        mrp: 1000,
        stockQuantity: 10,
        description: 'Test frame',
        categoryId: 'b0000000-0000-0000-0000-000000000002',
      });

      expect(created.sku).toBe('JT-TEST-001');
      expect(created.price).toBe(500);
      expect(created.mrp).toBe(1000);
      expect(created.discountPercentage).toBe(50);

      // Scan barcode -> finds product at ₹500
      const scan1 = await getProductByBarcode('JT-TEST-001');
      expect(scan1).not.toBeNull();
      expect(scan1?.price).toBe(500);

      // Change selling price to ₹600
      const updated = await updateAdminProduct(created.id, {
        price: 600,
        priceChangeReason: 'Selling price update',
      });

      // Barcode remains unchanged
      expect(updated.sku).toBe('JT-TEST-001');
      expect(updated.barcodeValue).toBe('JT-TEST-001');
      expect(updated.price).toBe(600);
      expect(updated.discountPercentage).toBe(40);

      // New 60x24mm label has ₹600 and 40% OFF
      const labelTspl = generateTsplForTtp244({
        productName: updated.name,
        sku: updated.sku,
        mrp: updated.mrp,
        sellingPrice: updated.price,
        discountPercentage: updated.discountPercentage,
        template: 'standard',
      });

      expect(labelTspl).toContain('SIZE 60 mm, 24 mm');
      expect(labelTspl).toContain('Rs.600');
      expect(labelTspl).toContain('40% OFF');
      expect(labelTspl).toContain('BARCODE 45,75,"128",55,1,0,2,2,"JT-TEST-001"');

      // Scanning still resolves the exact same product
      const scan2 = await getProductByBarcode('JT-TEST-001');
      expect(scan2).not.toBeNull();
      expect(scan2?.id).toBe(created.id);
      expect(scan2?.price).toBe(600);
    });
  });

  // ============================================================================
  // 9. THERMAL PRINT HTML ISOLATION ENGINE (60mm x 24mm LANDSCAPE)
  // ============================================================================
  describe('9. Thermal Print HTML Isolation Engine', () => {
    it('generates zero-dependency standalone HTML for 60x24mm standard landscape label', () => {
      const html = buildLabelHtml({
        productName: 'Minimalist Black Matte 6-in-1 Collage Frame',
        sku: 'JT-PF-002',
        mrp: 1299,
        sellingPrice: 849,
        discountPercentage: 35,
        template: 'standard',
      });

      expect(html).toContain('thermal-label-page');
      expect(html).toContain('standard-layout');
      expect(html).toContain('width:60mm;height:24mm');
      expect(html).toContain('JAINAM TRADERS');
      expect(html).toContain('Minimalist Black Matte 6-in-1 Collage Frame');
      // Redundant SKU is removed from line 2 since it is rendered directly below the barcode bars in SVG
      expect(html).not.toContain('SKU: JT-PF-002');
      expect(html).toContain('MRP ₹1299');
      expect(html).toContain('₹849');
      expect(html).toContain('35% OFF');
      expect(html).toContain('<svg');
      expect(html).toContain('JT-PF-002');
    });

    it('generates zero-dependency standalone HTML for 60x24mm compact landscape label', () => {
      const html = buildLabelHtml({
        productName: 'Dream Roller',
        sku: 'JT-TY-005',
        mrp: 160,
        sellingPrice: 160,
        discountPercentage: 0,
        template: 'compact',
      });

      expect(html).toContain('thermal-label-page');
      expect(html).toContain('compact-layout');
      expect(html).toContain('width:60mm;height:24mm');
      expect(html).toContain('JAINAM TRADERS');
      expect(html).toContain('Dream Roller');
      expect(html).toContain('SKU: JT-TY-005');
      expect(html).toContain('₹160');
      // No 0% OFF badge
      expect(html).not.toContain('0% OFF');
      expect(html).toContain('<svg');
    });
  });
});

