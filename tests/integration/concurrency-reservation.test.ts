import { describe, it, expect } from 'vitest';
import {
  createAdminProduct,
  createPickupOrder,
  transitionOrderStatus,
  getRawProductById,
  cleanupExpiredReservations,
  recordOrderPayment,
  storeDb,
} from '@/lib/db/store-service';

describe('3. Critical Concurrency & Inventory Reservation Engine', () => {
  it('MANDATORY: allows only ONE of two simultaneous orders to reserve the final remaining unit', async () => {
    // 1. Create a product with strictly 1 unit of stock
    const testProduct = await createAdminProduct({
      name: 'Rare Handcrafted Brass Peacock - Single Unit',
      sku: `JT-RACE-${Date.now()}`,
      slug: `rare-brass-peacock-${Date.now()}`,
      categoryId: 'b0000000-0000-0000-0000-000000000001',
      description: 'Exclusive single unit item for concurrency testing',
      price: 1999,
      mrp: 2999,
      thumbnailUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=600',
      images: [],
      stockQuantity: 1, // EXACTLY 1 REMAINING UNIT
      lowStockThreshold: 1,
      minOrderQuantity: 1,
      maxOrderQuantity: 1,
      tags: ['race-test'],
      brand: 'Heritage Rare',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      isActive: true,
    });

    // 2. Simulate Customer A and Customer B submitting checkout orders concurrently
    const customerAOrderPromise = createPickupOrder({
      customerId: 'cust-race-a',
      customerName: 'Aarav Sharma',
      customerPhone: '9000000001',
      items: [{ productId: testProduct.id, quantity: 1 }],
      pickupMode: 'FLEXIBLE',
    });

    const customerBOrderPromise = createPickupOrder({
      customerId: 'cust-race-b',
      customerName: 'Bhavna Patel',
      customerPhone: '9000000002',
      items: [{ productId: testProduct.id, quantity: 1 }],
      pickupMode: 'FLEXIBLE',
    });

    // 3. Execute concurrently with Promise.allSettled
    const [resultA, resultB] = await Promise.allSettled([
      customerAOrderPromise,
      customerBOrderPromise,
    ]);

    // Exactly one must succeed and one must fail
    const successfulResults = [resultA, resultB].filter((r) => r.status === 'fulfilled');
    const failedResults = [resultA, resultB].filter((r) => r.status === 'rejected');

    expect(successfulResults.length).toBe(1);
    expect(failedResults.length).toBe(1);

    // Verify rejection error message explicitly mentions stock unavailability
    const rejectedReason = (failedResults[0] as PromiseRejectedResult).reason;
    expect(rejectedReason.message).toMatch(/(remaining for pickup|out of stock|insufficient)/i);

    // Verify product state: stockQuantity is 1, reservedStock is 1, available is 0
    const updatedProd = await getRawProductById(testProduct.id);
    expect(updatedProd?.stockQuantity).toBe(1);
    expect(updatedProd?.reservedStock).toBe(1);
  });

  it('safely releases reservation when order is cancelled', async () => {
    // 1. Create a product with 2 units
    const prod = await createAdminProduct({
      name: 'Limited Wall Clock',
      sku: `JT-REL-${Date.now()}`,
      slug: `limited-wall-clock-${Date.now()}`,
      categoryId: 'b0000000-0000-0000-0000-000000000003',
      description: 'Clock for reservation release testing',
      price: 899,
      mrp: 1299,
      thumbnailUrl: '',
      images: [],
      stockQuantity: 2,
      lowStockThreshold: 1,
      minOrderQuantity: 1,
      maxOrderQuantity: 5,
      tags: [],
      brand: 'Chrono',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      isActive: true,
    });

    // 2. Reserve 1 unit
    const order = await createPickupOrder({
      customerId: 'cust-cancel-test',
      customerName: 'Dev Customer',
      customerPhone: '9000000003',
      items: [{ productId: prod.id, quantity: 1 }],
      pickupMode: 'FLEXIBLE',
    });

    let checkProd = await getRawProductById(prod.id);
    expect(checkProd?.reservedStock).toBe(1);

    // 3. Cancel order
    await transitionOrderStatus(order.id, 'CANCELLED', 'customer', 'cust-cancel-test', 'Decided to cancel');

    checkProd = await getRawProductById(prod.id);
    expect(checkProd?.reservedStock).toBe(0);
    expect(checkProd?.stockQuantity).toBe(2);
  });

  it('finalizes permanent stock deduction upon PICKED_UP transition', async () => {
    // 1. Create a product with 5 units
    const prod = await createAdminProduct({
      name: 'Luxury Fountain Pen',
      sku: `JT-PICK-${Date.now()}`,
      slug: `luxury-fountain-pen-${Date.now()}`,
      categoryId: 'b0000000-0000-0000-0000-000000000008',
      description: 'Pen for pickup finalization test',
      price: 500,
      mrp: 800,
      thumbnailUrl: '',
      images: [],
      stockQuantity: 5,
      lowStockThreshold: 1,
      minOrderQuantity: 1,
      maxOrderQuantity: 5,
      tags: [],
      brand: 'Scribe',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      isActive: true,
    });

    // 2. Order 2 units
    const order = await createPickupOrder({
      customerId: 'cust-pickup-test',
      customerName: 'Rohan Gupta',
      customerPhone: '9000000004',
      items: [{ productId: prod.id, quantity: 2 }],
      pickupMode: 'FLEXIBLE',
    });

    // Walk through state machine to READY_FOR_PICKUP
    await transitionOrderStatus(order.id, 'CONFIRMED', 'admin', 'admin-1');
    await transitionOrderStatus(order.id, 'PREPARING', 'store_manager', 'mgr-1');
    await transitionOrderStatus(order.id, 'READY_FOR_PICKUP', 'staff', 'staff-1');

    // Transition to PICKED_UP (Customer pays cash at counter)
    const finalized = await transitionOrderStatus(order.id, 'PICKED_UP', 'staff', 'staff-1', 'Paid via Cash at counter');
    expect(finalized.paymentStatus).toBe('PAID');

    // 3. Check inventory deduction: 5 - 2 = 3 units, 0 reserved
    const checkProd = await getRawProductById(prod.id);
    expect(checkProd?.stockQuantity).toBe(3);
    expect(checkProd?.reservedStock).toBe(0);
  });

  it('enforces order idempotency: retried order request with same idempotencyKey returns existing order without double-booking stock', async () => {
    const prod = await createAdminProduct({
      name: 'Limited Edition Desk Clock',
      sku: `JT-IDEM-${Date.now()}`,
      slug: `limited-desk-clock-${Date.now()}`,
      categoryId: 'b0000000-0000-0000-0000-000000000003',
      description: 'Clock for idempotency verification',
      price: 1200,
      mrp: 1500,
      thumbnailUrl: '',
      images: [],
      stockQuantity: 2,
      lowStockThreshold: 1,
      minOrderQuantity: 1,
      maxOrderQuantity: 5,
      tags: [],
      brand: 'Titan JT',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      isActive: true,
    });

    const idempotencyKey = `idem-key-${Date.now()}`;

    // First attempt: Places order
    const order1 = await createPickupOrder({
      customerId: 'cust-idem-test',
      customerName: 'Sanjay Jain',
      customerPhone: '9000000000',
      idempotencyKey,
      items: [{ productId: prod.id, quantity: 1 }],
      pickupMode: 'FLEXIBLE',
    });

    expect(order1).toBeDefined();
    expect(order1.idempotencyKey).toBe(idempotencyKey);

    const prodAfterFirst = await getRawProductById(prod.id);
    expect(prodAfterFirst?.reservedStock).toBe(1);

    // Second attempt (simulating duplicate click or network retry with same idempotencyKey)
    const order2 = await createPickupOrder({
      customerId: 'cust-idem-test',
      customerName: 'Sanjay Jain',
      customerPhone: '9000000000',
      idempotencyKey,
      items: [{ productId: prod.id, quantity: 1 }],
      pickupMode: 'FLEXIBLE',
    });

    // Must return the exact same order
    expect(order2.id).toBe(order1.id);
    expect(order2.orderNumber).toBe(order1.orderNumber);

    // Reserved stock must NOT be double deducted! Still 1, not 2.
    const prodAfterRetry = await getRawProductById(prod.id);
    expect(prodAfterRetry?.reservedStock).toBe(1);
  });

  it('cleans up expired pickup reservations and releases reserved inventory idempotently', async () => {
    const prod = await createAdminProduct({
      name: 'Antique Wall Mirror',
      sku: `JT-EXP-${Date.now()}`,
      slug: `antique-wall-mirror-${Date.now()}`,
      categoryId: 'b0000000-0000-0000-0000-000000000001',
      description: 'Mirror for expiry cleanup test',
      price: 1800,
      mrp: 2400,
      thumbnailUrl: '',
      images: [],
      stockQuantity: 4,
      lowStockThreshold: 1,
      minOrderQuantity: 1,
      maxOrderQuantity: 5,
      tags: [],
      brand: 'Jainam Heritage',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      isActive: true,
    });

    const order = await createPickupOrder({
      customerId: 'cust-expiry-test',
      customerName: 'Vikas Shah',
      customerPhone: '9000000000',
      items: [{ productId: prod.id, quantity: 2 }],
      pickupMode: 'FLEXIBLE',
    });

    const checkReserved = await getRawProductById(prod.id);
    expect(checkReserved?.reservedStock).toBe(2);

    // Manually backdate the order's reservationExpiresAt to simulate elapsed window
    const targetOrder = storeDb.orders.find((o) => o.id === order.id);
    expect(targetOrder).toBeDefined();
    targetOrder!.reservationExpiresAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

    // Run cleanup
    const cleanupResult = await cleanupExpiredReservations('test_cron');
    expect(cleanupResult.expiredCount).toBeGreaterThanOrEqual(1);
    expect(cleanupResult.expiredOrderNumbers).toContain(order.orderNumber);

    // Order status should be EXPIRED
    expect(targetOrder!.status).toBe('EXPIRED');

    // Reserved stock must be released back to catalogue
    const checkReleased = await getRawProductById(prod.id);
    expect(checkReleased?.reservedStock).toBe(0);

    // Second cleanup run must be idempotent (0 additional orders expired)
    const secondCleanup = await cleanupExpiredReservations('test_cron');
    expect(secondCleanup.expiredOrderNumbers).not.toContain(order.orderNumber);
    const checkStillZero = await getRawProductById(prod.id);
    expect(checkStillZero?.reservedStock).toBe(0);
  });

  it('records counter payment correctly, tracking partial and full payments', async () => {
    const prod = await createAdminProduct({
      name: 'Silver Plated Pooja Thali',
      sku: `JT-PAY-${Date.now()}`,
      slug: `silver-pooja-thali-${Date.now()}`,
      categoryId: 'b0000000-0000-0000-0000-000000000001',
      description: 'Pooja thali for payment recording test',
      price: 1000,
      mrp: 1500,
      thumbnailUrl: '',
      images: [],
      stockQuantity: 5,
      lowStockThreshold: 1,
      minOrderQuantity: 1,
      maxOrderQuantity: 5,
      tags: [],
      brand: 'Jainam Devotional',
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      isActive: true,
    });

    const order = await createPickupOrder({
      customerId: 'cust-pay-test',
      customerName: 'Meena Jain',
      customerPhone: '9000000000',
      items: [{ productId: prod.id, quantity: 1 }],
      pickupMode: 'FLEXIBLE',
    });

    expect(order.paymentStatus).toBe('UNPAID');
    expect(order.amountDue).toBe(1000);
    expect(order.amountReceived).toBe(0);

    // 1. Partial payment at counter (e.g. ₹400 cash deposit)
    const partialOrder = await recordOrderPayment({
      orderId: order.id,
      amountReceived: 400,
      paymentMethod: 'Cash',
      staffId: 'staff-counter-01',
      staffRole: 'staff',
      notes: 'Initial advance cash payment',
    });

    expect(partialOrder.paymentStatus).toBe('PARTIALLY_PAID');
    expect(partialOrder.amountReceived).toBe(400);
    expect(partialOrder.amountDue).toBe(600);
    expect(partialOrder.paymentRecordedBy).toBe('staff-counter-01');

    // 2. Final settlement at counter (remaining ₹600 via UPI)
    const paidOrder = await recordOrderPayment({
      orderId: order.id,
      amountReceived: 600,
      paymentMethod: 'UPI',
      staffId: 'staff-counter-01',
      staffRole: 'staff',
      notes: 'Final UPI balance settlement',
    });

    expect(paidOrder.paymentStatus).toBe('PAID');
    expect(paidOrder.amountReceived).toBe(1000);
    expect(paidOrder.amountDue).toBe(0);
  });
});
