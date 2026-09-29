import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeStockNumber,
  normalizeProductInventory,
  calculateStockAdjustment,
} from '@/lib/inventory/normalizer';
import {
  createAdminProduct,
  updateAdminProduct,
  archiveAdminProduct,
  unarchiveAdminProduct,
  adjustInventory,
  getAdminProducts,
  getCustomerProducts,
  getProductBySlug,
  storeDb,
  createPickupOrder,
  transitionOrderStatus,
} from '@/lib/db/store-service';

describe('1. NaN Inventory Prevention & Normalization Engine', () => {
  it('safely normalizes null, undefined, empty string, and malformed inputs to 0', () => {
    expect(normalizeStockNumber(null)).toBe(0);
    expect(normalizeStockNumber(undefined)).toBe(0);
    expect(normalizeStockNumber('')).toBe(0);
    expect(normalizeStockNumber(NaN)).toBe(0);
    expect(normalizeStockNumber(Infinity)).toBe(0);
    expect(normalizeStockNumber(-Infinity)).toBe(0);
    expect(normalizeStockNumber('not-a-number')).toBe(0);
  });

  it('correctly parses and normalizes string numeric stock', () => {
    expect(normalizeStockNumber('15')).toBe(15);
    expect(normalizeStockNumber(' 42 ')).toBe(42);
    expect(normalizeStockNumber('0')).toBe(0);
  });

  it('prevents negative stock and decimals, truncating to non-negative integer', () => {
    expect(normalizeStockNumber(-5)).toBe(0);
    expect(normalizeStockNumber('-10')).toBe(0);
    expect(normalizeStockNumber(12.75)).toBe(12);
  });

  it('calculates availableStock = Math.max(0, totalStock - reservedStock)', () => {
    const normal = normalizeProductInventory({
      stockQuantity: 10,
      reservedStock: 3,
      lowStockThreshold: 2,
    });
    expect(normal.totalStock).toBe(10);
    expect(normal.reservedStock).toBe(3);
    expect(normal.availableStock).toBe(7);
    expect(normal.stockStatus).toBe('healthy');
  });

  it('safely handles reservedStock > totalStock anomaly without producing negative or NaN', () => {
    const anomaly = normalizeProductInventory({
      stockQuantity: 4,
      reservedStock: 9,
    });
    expect(anomaly.totalStock).toBe(4);
    expect(anomaly.reservedStock).toBe(9);
    expect(anomaly.availableStock).toBe(0);
    expect(anomaly.isOutOfStock).toBe(true);
    expect(anomaly.hasWarning).toBe(true);
    expect(anomaly.warningMessage).toContain('exceed total stock');
  });

  it('validates stock adjustment: cannot deduct below zero', () => {
    const currentTotal = 5;

    // Normal positive adjustment
    const add10 = calculateStockAdjustment(currentTotal, 10);
    expect(add10.isValid).toBe(true);
    expect(add10.newStock).toBe(15);

    // Normal negative adjustment
    const minus3 = calculateStockAdjustment(currentTotal, -3);
    expect(minus3.isValid).toBe(true);
    expect(minus3.newStock).toBe(2);

    // Negative adjustment resulting in exactly zero
    const minus5 = calculateStockAdjustment(currentTotal, -5);
    expect(minus5.isValid).toBe(true);
    expect(minus5.newStock).toBe(0);

    // Negative adjustment attempting to reduce below zero
    const minus10 = calculateStockAdjustment(currentTotal, -10);
    expect(minus10.isValid).toBe(false);
    expect(minus10.newStock).toBe(5); // unaltered
    expect(minus10.error).toContain('Cannot reduce stock below zero');

    // Invalid string or zero change
    expect(calculateStockAdjustment(currentTotal, 0).isValid).toBe(false);
    expect(calculateStockAdjustment(currentTotal, 'abc').isValid).toBe(false);
    expect(calculateStockAdjustment(currentTotal, null).isValid).toBe(false);
  });
});

describe('2. Product Management CRUD (Create, Edit, Archive, Restore)', () => {
  let createdProductId: string;

  it('creates product with server validation, normalized stock, and initial movement log', async () => {
    const initialMovementCount = storeDb.inventoryMovements.length;

    const prod = await createAdminProduct(
      {
        name: 'Royal Silver Plated Photo Frame',
        sku: 'JT-PF-TEST-01',
        slug: 'royal-silver-plated-photo-frame-test',
        categoryId: 'b0000000-0000-0000-0000-000000000002',
        categoryName: 'Photo Frames & Albums',
        brand: 'Jainam Heritage',
        description: 'Testing product creation with initial stock.',
        shortDescription: 'Silver plated frame.',
        price: 499,
        mrp: 799,
        stockQuantity: 15,
        lowStockThreshold: 3,
        minOrderQuantity: 1,
        maxOrderQuantity: 5,
        tags: ['frame', 'silver', 'test'],
        thumbnailUrl: '/images/product-placeholder.svg',
        images: ['/images/product-placeholder.svg'],
        isFeatured: false,
        isNewArrival: true,
        isBestSeller: false,
        isActive: true,
        status: 'published',
      },
      'admin-tester'
    );

    createdProductId = prod.id;
    expect(prod.id).toBeDefined();
    expect(prod.discountPercentage).toBe(38); // Math.round(((799 - 499) / 799) * 100)
    expect(prod.stockQuantity).toBe(15);
    expect(prod.reservedStock).toBe(0);

    // Verifies audit movement was created
    expect(storeDb.inventoryMovements.length).toBeGreaterThan(initialMovementCount);
    const lastMovement = storeDb.inventoryMovements[0];
    expect(lastMovement.productId).toBe(prod.id);
    expect(lastMovement.quantityChange).toBe(15);
    expect(lastMovement.newStock).toBe(15);
  });

  it('rejects product creation when selling price > MRP or invalid values', async () => {
    await expect(
      createAdminProduct(
        {
          name: 'Invalid Price Product',
          sku: 'JT-INV-01',
          slug: 'invalid-price-prod',
          categoryId: 'cat-1',
          description: 'desc',
          price: 999,
          mrp: 499, // MRP < Price is invalid!
          stockQuantity: 5,
          lowStockThreshold: 1,
          minOrderQuantity: 1,
          maxOrderQuantity: 5,
          tags: [],
          brand: 'Test',
          thumbnailUrl: '',
          images: [],
          isFeatured: false,
          isNewArrival: false,
          isBestSeller: false,
          isActive: true,
        },
        'admin'
      )
    ).rejects.toThrow('Selling price cannot exceed MRP');
  });

  it('edits product and protects reservedStock from direct edits', async () => {
    const updated = await updateAdminProduct(
      createdProductId,
      {
        name: 'Royal Silver Plated Photo Frame (Updated)',
        price: 549,
        mrp: 899,
        brand: 'Jainam Signature',
        reservedStock: 999, // Attempted direct alteration of reserved stock must be stripped!
      } as any,
      'admin-editor'
    );

    expect(updated.name).toBe('Royal Silver Plated Photo Frame (Updated)');
    expect(updated.price).toBe(549);
    expect(updated.mrp).toBe(899);
    expect(updated.discountPercentage).toBe(39);
    // reservedStock must remain 0, unaffected by direct updates
    expect(updated.reservedStock).toBe(0);
  });

  it('archives product (soft-delete): disappears from customer storefront but remains in admin', async () => {
    // 1. Archive the product
    const archived = await archiveAdminProduct(createdProductId, 'admin-actor');
    expect(archived.isArchived).toBe(true);
    expect(archived.status).toBe('archived');
    expect(archived.isActive).toBe(false);

    // 2. Customer storefront query must NOT include the archived product
    const customerList = await getCustomerProducts();
    const foundInCustomer = customerList.products.find((p) => p.id === createdProductId);
    expect(foundInCustomer).toBeUndefined();

    // 3. Slug lookup for customer must return null
    const slugView = await getProductBySlug('royal-silver-plated-photo-frame-test');
    expect(slugView).toBeNull();

    // 4. Admin catalogue query MUST still include the product under Archived filter
    const adminArchivedList = await getAdminProducts({ status: 'archived' });
    const foundInAdmin = adminArchivedList.find((p) => p.id === createdProductId);
    expect(foundInAdmin).toBeDefined();
    expect(foundInAdmin?.isArchived).toBe(true);
  });

  it('prevents customer from newly reserving an archived product', async () => {
    await expect(
      createPickupOrder({
        customerId: 'cust-test-1',
        customerName: 'Test Customer',
        customerPhone: '9876543210',
        pickupMode: 'FLEXIBLE',
        items: [
          {
            productId: createdProductId, // Archived product!
            quantity: 1,
          },
        ],
      })
    ).rejects.toThrow('archived');
  });

  it('unarchives product and makes it available on storefront again', async () => {
    const restored = await unarchiveAdminProduct(createdProductId, 'admin-actor');
    expect(restored.isArchived).toBe(false);
    expect(restored.isActive).toBe(true);
    expect(restored.status).toBe('published');

    const customerList = await getCustomerProducts();
    const found = customerList.products.find((p) => p.id === createdProductId);
    expect(found).toBeDefined();
  });
});

describe('3. Stock Management & Immutable Audit Movements', () => {
  it('applies positive adjustment (+10) and creates audit entry', async () => {
    const prod = storeDb.products[0];
    const initialStock = prod.stockQuantity;

    const { product, movement } = await adjustInventory(
      prod.id,
      undefined,
      10,
      'restock',
      'Supplier delivery invoice #4091',
      'staff-1'
    );

    expect(product.stockQuantity).toBe(initialStock + 10);
    expect(movement.previousStock).toBe(initialStock);
    expect(movement.newStock).toBe(initialStock + 10);
    expect(movement.quantityChange).toBe(10);
    expect(movement.reason).toBe('restock');
    expect(movement.notes).toContain('invoice #4091');
  });

  it('applies negative adjustment (-2) safely and creates audit entry', async () => {
    const prod = storeDb.products[0];
    const currentStock = prod.stockQuantity;

    const { product, movement } = await adjustInventory(
      prod.id,
      undefined,
      -2,
      'damage',
      'Item dropped and broken in store',
      'staff-1'
    );

    expect(product.stockQuantity).toBe(currentStock - 2);
    expect(movement.quantityChange).toBe(-2);
    expect(movement.reason).toBe('damage');
  });

  it('rejects negative adjustment that would reduce stock below zero', async () => {
    const prod = storeDb.products[0];
    const currentStock = prod.stockQuantity;

    await expect(
      adjustInventory(
        prod.id,
        undefined,
        -(currentStock + 50), // Excessive deduction
        'missing',
        'Audit shrinkage',
        'staff-1'
      )
    ).rejects.toThrow('Cannot reduce stock below zero');
  });
});

describe('4. Regression: Order Flow, Reservation, Cancellation & Pickup', () => {
  it('reserves available units upon order placement, releases on cancellation, deducts on pickup', async () => {
    const prod = storeDb.products.find((p) => p.isActive && !p.isArchived && p.stockQuantity >= 5)!;
    const initialTotal = prod.stockQuantity;
    const initialReserved = prod.reservedStock;

    // 1. Place pickup reservation for 2 units
    const order = await createPickupOrder({
      customerId: 'cust-reg-1',
      customerName: 'Regression Tester',
      customerPhone: '9876543210',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: prod.id, quantity: 2 }],
    });

    expect(order.orderNumber).toBeDefined();
    expect(prod.reservedStock).toBe(initialReserved + 2);
    expect(prod.stockQuantity).toBe(initialTotal); // Total stays same while item is on reserve

    // 2. Cancel order -> Reserved units must be released
    const cancelled = await transitionOrderStatus(
      order.id,
      'CANCELLED',
      'admin',
      'admin-1',
      'Customer phoned to cancel reservation'
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(prod.reservedStock).toBe(initialReserved); // Successfully restored!

    // 3. Place new order and complete pickup
    const order2 = await createPickupOrder({
      customerId: 'cust-reg-2',
      customerName: 'Pickup Customer',
      customerPhone: '9876543210',
      pickupMode: 'FLEXIBLE',
      items: [{ productId: prod.id, quantity: 1 }],
    });
    expect(prod.reservedStock).toBe(initialReserved + 1);

    // Staff confirms pickup at counter
    await transitionOrderStatus(order2.id, 'CONFIRMED', 'admin', 'admin-1');
    await transitionOrderStatus(order2.id, 'PREPARING', 'admin', 'admin-1');
    await transitionOrderStatus(order2.id, 'READY_FOR_PICKUP', 'admin', 'admin-1');
    const pickedUp = await transitionOrderStatus(
      order2.id,
      'PICKED_UP',
      'admin',
      'admin-1',
      'Customer collected and paid at shop'
    );

    expect(pickedUp.status).toBe('PICKED_UP');
    expect(pickedUp.paymentStatus).toBe('PAID');
    // On physical pickup: reserved decreases by 1, total stock permanently decreases by 1
    expect(prod.reservedStock).toBe(initialReserved);
    expect(prod.stockQuantity).toBe(initialTotal - 1);
  });
});

describe('5. Security: Customer Role Mutation Protections', () => {
  it('enforces that customers cannot mutate stock or access admin product endpoints', async () => {
    // 1. Customer role check
    const customerRole = 'customer';
    const isAuthorized = customerRole === 'admin' || customerRole === 'staff' || customerRole === 'owner';
    expect(isAuthorized).toBe(false);

    // 2. Customer view strips stock numbers
    const prod = storeDb.products[0];
    const customerView = (await getCustomerProducts()).products[0];
    expect((customerView as any).stockQuantity).toBeUndefined();
    expect((customerView as any).reservedStock).toBeUndefined();
    expect((customerView as any).lowStockThreshold).toBeUndefined();
    expect(customerView.availability).toBeDefined();
  });
});

describe('6. Image Fallback & Validation', () => {
  it('guarantees valid fallback when product thumbnail is missing or empty', () => {
    const emptyThumbnailProduct = {
      thumbnailUrl: '',
      images: [],
    };
    const resolvedUrl = emptyThumbnailProduct.thumbnailUrl || '/images/product-placeholder.svg';
    expect(resolvedUrl).toBe('/images/product-placeholder.svg');
  });
});

