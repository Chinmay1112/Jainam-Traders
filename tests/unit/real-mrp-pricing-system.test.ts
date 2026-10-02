import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateDiscountPercentage,
  formatDiscountBadge,
  validateProductPricing,
  calculateOrderPricing,
  ValidatedItem,
} from '@/lib/pricing/engine';
import {
  storeDb,
  createAdminProduct,
  updateAdminProduct,
  createPickupOrder,
} from '@/lib/db/store-service';
import { Product } from '@/lib/types';

describe('Real MRP + Special Selling Price + Automatic Discount System', () => {
  beforeEach(() => {
    // Reset products and audit logs for clean isolation
    storeDb.products = [];
    storeDb.orders = [];
    storeDb.auditLogs = [];
  });

  describe('1. Discount Calculation Formula & Edge Cases', () => {
    it('calculates zero discount when MRP equals Selling Price', () => {
      const discount = calculateDiscountPercentage(1000, 1000);
      expect(discount).toBe(0);
      expect(formatDiscountBadge(1000, 1000)).toBe('No discount');
    });

    it('calculates 10% discount for MRP 1000 and Selling 900', () => {
      const discount = calculateDiscountPercentage(1000, 900);
      expect(discount).toBe(10);
      expect(formatDiscountBadge(1000, 900)).toBe('10% OFF');
    });

    it('calculates 25% discount for MRP 1000 and Selling 750', () => {
      const discount = calculateDiscountPercentage(1000, 750);
      expect(discount).toBe(25);
      expect(formatDiscountBadge(1000, 750)).toBe('25% OFF');
    });

    it('calculates 50% discount for MRP 1000 and Selling 500', () => {
      const discount = calculateDiscountPercentage(1000, 500);
      expect(discount).toBe(50);
      expect(formatDiscountBadge(1000, 500)).toBe('50% OFF');
    });

    it('calculates 100% discount after rounding for MRP 1000 and Selling 1', () => {
      // (1000 - 1) / 1000 * 100 = 99.9 -> rounds to 100
      const discount = calculateDiscountPercentage(1000, 1);
      expect(discount).toBe(100);
      expect(formatDiscountBadge(1000, 1)).toBe('100% OFF');
    });

    it('correctly rounds fractional discounts (MRP 999 / Selling 599 -> 40%)', () => {
      // (999 - 599) / 999 * 100 = 400 / 999 * 100 = 40.0400... -> rounds to 40
      const discount = calculateDiscountPercentage(999, 599);
      expect(discount).toBe(40);
      expect(formatDiscountBadge(999, 599)).toBe('40% OFF');
    });

    it('correctly rounds fractional discounts (MRP 899 / Selling 599 -> 33%)', () => {
      // (899 - 599) / 899 * 100 = 300 / 899 * 100 = 33.3704... -> rounds to 33
      const discount = calculateDiscountPercentage(899, 599);
      expect(discount).toBe(33);
      expect(formatDiscountBadge(899, 599)).toBe('33% OFF');
    });

    it('correctly rounds fractional discounts (MRP 1299 / Selling 849 -> 35%)', () => {
      // (1299 - 849) / 1299 * 100 = 450 / 1299 * 100 = 34.6420... -> rounds to 35
      const discount = calculateDiscountPercentage(1299, 849);
      expect(discount).toBe(35);
      expect(formatDiscountBadge(1299, 849)).toBe('35% OFF');
    });

    it('never displays "0% OFF" for zero-discount items', () => {
      expect(formatDiscountBadge(500, 500)).toBe('No discount');
      expect(formatDiscountBadge(1200, 1200)).not.toContain('0% OFF');
    });
  });

  describe('2. Strict Server-Side Pricing Validation', () => {
    it('accepts valid MRP and Selling Price', () => {
      const result = validateProductPricing(1000, 500);
      expect(result.isValid).toBe(true);
      expect(result.mrp).toBe(1000);
      expect(result.sellingPrice).toBe(500);
      expect(result.discountPercentage).toBe(50);
      expect(result.error).toBeUndefined();
    });

    it('accepts equal MRP and Selling Price (0% discount)', () => {
      const result = validateProductPricing(1000, 1000);
      expect(result.isValid).toBe(true);
      expect(result.discountPercentage).toBe(0);
    });

    it('rejects selling price strictly greater than MRP', () => {
      const result = validateProductPricing(1000, 1200);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot exceed MRP');
    });

    it('rejects zero or negative MRP', () => {
      const zero = validateProductPricing(0, 500);
      expect(zero.isValid).toBe(false);
      expect(zero.error).toContain('greater than zero');

      const negative = validateProductPricing(-500, 500);
      expect(negative.isValid).toBe(false);
      expect(negative.error).toContain('greater than zero');
    });

    it('rejects zero or negative Selling Price', () => {
      const zero = validateProductPricing(1000, 0);
      expect(zero.isValid).toBe(false);
      expect(zero.error).toContain('greater than zero');

      const negative = validateProductPricing(1000, -100);
      expect(negative.isValid).toBe(false);
      expect(negative.error).toContain('greater than zero');
    });

    it('rejects NaN values', () => {
      const result1 = validateProductPricing(NaN, 500);
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('finite numeric amount');

      const result2 = validateProductPricing(1000, 'abc');
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('finite numeric amount');
    });

    it('rejects Infinity values', () => {
      const result1 = validateProductPricing(Infinity, 500);
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('finite numeric amount');

      const result2 = validateProductPricing(1000, Infinity);
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('finite numeric amount');
    });

    it('rejects boolean values', () => {
      const result = validateProductPricing(true, 500);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be boolean');
    });
  });

  describe('3. Admin CRUD, Client Manipulation Rejection & Audit Logging', () => {
    it('creates product and completely ignores client-supplied discount percentage', async () => {
      const created = await createAdminProduct(
        {
          name: 'Handcrafted Sheesham Photo Frame',
          sku: 'JT-PF-001',
          categoryId: 'cat-frames',
          description: 'Solid Sheesham wood frame',
          price: 500,
          mrp: 1000,
          discountPercentage: 99, // Malicious client attempt to claim 99% off
          stockQuantity: 15,
          lowStockThreshold: 3,
          tags: ['frame', 'wood'],
          brand: 'Jainam Heritage',
          isFeatured: true,
          isNewArrival: true,
          isBestSeller: false,
          isActive: true,
          status: 'published',
          thumbnailUrl: '/images/photo-frame.jpg',
          images: ['/images/photo-frame.jpg'],
        } as any,
        'owner-user-1'
      );

      // Server must calculate 50% discount, ignoring client's 99%
      expect(created.mrp).toBe(1000);
      expect(created.price).toBe(500);
      expect(created.discountPercentage).toBe(50);
    });

    it('rejects product creation when selling price exceeds MRP', async () => {
      await expect(
        createAdminProduct(
          {
            name: 'Overpriced Product',
            sku: 'JT-BAD-001',
            slug: 'overpriced-product',
            categoryId: 'cat-1',
            description: 'Test',
            price: 1500,
            mrp: 1000,
            stockQuantity: 10,
            lowStockThreshold: 2,
            minOrderQuantity: 1,
            maxOrderQuantity: 5,
            tags: [],
            brand: 'Jainam',
            isFeatured: false,
            isNewArrival: false,
            isBestSeller: false,
            isActive: true,
            status: 'published',
            thumbnailUrl: '',
            images: [],
          },
          'owner-user-1'
        )
      ).rejects.toThrow('cannot exceed MRP');
    });

    it('records a detailed PRICE_CHANGE audit log when price or MRP is edited', async () => {
      const prod = await createAdminProduct(
        {
          name: 'Vintage Brass Wall Clock',
          sku: 'JT-CK-001',
          slug: 'vintage-brass-wall-clock',
          categoryId: 'cat-clocks',
          description: 'Brass clock',
          price: 500,
          mrp: 1000,
          stockQuantity: 10,
          lowStockThreshold: 2,
          minOrderQuantity: 1,
          maxOrderQuantity: 5,
          tags: [],
          brand: 'Jainam Clocks',
          isFeatured: false,
          isNewArrival: false,
          isBestSeller: false,
          isActive: true,
          status: 'published',
          thumbnailUrl: '',
          images: [],
        },
        'owner-user-1'
      );

      // Staff changes selling price from 500 to 750
      const updated = await updateAdminProduct(
        prod.id,
        {
          price: 750,
          priceChangeReason: 'Post-holiday pricing revision',
        },
        'owner-user-1'
      );

      expect(updated.price).toBe(750);
      expect(updated.mrp).toBe(1000);
      expect(updated.discountPercentage).toBe(25);

      // Verify PRICE_CHANGE audit log
      const priceAudit = storeDb.auditLogs.find(
        (log) => log.action === 'PRICE_CHANGE' && log.entityId === prod.id
      );

      expect(priceAudit).toBeDefined();
      expect(priceAudit?.metadata).toMatchObject({
        productId: prod.id,
        productName: 'Vintage Brass Wall Clock',
        previousMrp: 1000,
        newMrp: 1000,
        previousSellingPrice: 500,
        newSellingPrice: 750,
        calculatedPreviousDiscount: 50,
        calculatedNewDiscount: 25,
        staffUser: 'owner-user-1',
        role: 'owner',
        reason: 'Post-holiday pricing revision',
      });
    });
  });

  describe('4. Historical Order Price Snapshot Integrity', () => {
    it('preserves purchase-time selling price, MRP, and discount percentage after product price changes', async () => {
      // 1. Create product at ₹1000 MRP, ₹500 Selling (50% OFF)
      const product = await createAdminProduct(
        {
          name: 'Marble Pooja Thali',
          sku: 'JT-TH-001',
          slug: 'marble-pooja-thali',
          categoryId: 'cat-pooja',
          description: 'Hand-carved marble thali',
          price: 500,
          mrp: 1000,
          stockQuantity: 20,
          lowStockThreshold: 2,
          minOrderQuantity: 1,
          maxOrderQuantity: 5,
          tags: [],
          brand: 'Jainam',
          isFeatured: false,
          isNewArrival: false,
          isBestSeller: false,
          isActive: true,
          status: 'published',
          thumbnailUrl: '/thali.jpg',
          images: ['/thali.jpg'],
        },
        'owner-user-1'
      );

      // 2. Customer places order for 2 units
      const order = await createPickupOrder({
        customerId: 'cust-123',
        customerName: 'Aarav Patel',
        customerPhone: '+91 90000 00000',
        pickupMode: 'FLEXIBLE',
        items: [{ productId: product.id, quantity: 2 }],
      });

      expect(order.subtotal).toBe(1000); // 2 * 500
      expect(order.totalAmount).toBe(1000);
      expect(order.items[0].unitPrice).toBe(500);
      expect(order.items[0].mrp).toBe(1000);
      expect(order.items[0].discountPercentage).toBe(50);
      expect(order.items[0].totalPrice).toBe(1000);

      // 3. Admin later raises the selling price to ₹750 (25% OFF) and changes product name
      await updateAdminProduct(
        product.id,
        {
          price: 750,
          name: 'Marble Pooja Thali - Deluxe Edition',
        },
        'owner-user-1'
      );

      // 4. Verify historical order is completely untouched
      const savedOrder = storeDb.orders.find((o) => o.id === order.id);
      expect(savedOrder).toBeDefined();
      expect(savedOrder?.subtotal).toBe(1000);
      expect(savedOrder?.totalAmount).toBe(1000);

      const orderItem = savedOrder!.items[0];
      expect(orderItem.unitPrice).toBe(500); // Still purchase price ₹500
      expect(orderItem.mrp).toBe(1000); // Still purchase MRP ₹1000
      expect(orderItem.discountPercentage).toBe(50); // Still purchase discount 50%
      expect(orderItem.totalPrice).toBe(1000);
    });
  });

  describe('5. Checkout & Receipt Line Item Calculations', () => {
    it('correctly calculates order pricing summary with line items', () => {
      const items: ValidatedItem[] = [
        {
          productId: 'prod-1',
          productName: 'Photo Frame',
          unitPrice: 500,
          mrp: 1000,
          quantity: 2,
          totalPrice: 1000,
          thumbnailUrl: '',
        },
        {
          productId: 'prod-2',
          productName: 'Brass Diya',
          unitPrice: 250,
          mrp: 500,
          quantity: 1,
          totalPrice: 250,
          thumbnailUrl: '',
        },
      ];

      const summary = calculateOrderPricing(items);
      expect(summary.subtotal).toBe(1250); // 1000 + 250
      expect(summary.totalMrp).toBe(2500); // (1000 * 2) + 500
      expect(summary.mrpSavings).toBe(1250); // 2500 - 1250
      expect(summary.finalPayableAmount).toBe(1250);
    });
  });
});
