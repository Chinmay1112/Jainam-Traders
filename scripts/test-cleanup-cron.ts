import { cleanupExpiredReservations, createAdminProduct, createPickupOrder, storeDb } from '../src/lib/db/store-service';

async function testCleanupCron() {
  console.log('Testing cleanupExpiredReservations cron logic...');

  // 1. Create a product and order with 1 unit
  const prod = await createAdminProduct({
    name: 'Cron Test Clock',
    sku: `JT-CRON-${Date.now()}`,
    slug: `cron-test-clock-${Date.now()}`,
    categoryId: 'b0000000-0000-0000-0000-000000000003',
    description: 'Test clock for cron verification',
    price: 999,
    mrp: 1499,
    thumbnailUrl: '',
    images: [],
    stockQuantity: 5,
    lowStockThreshold: 1,
    minOrderQuantity: 1,
    maxOrderQuantity: 5,
    tags: [],
    brand: 'Cron Brand',
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    isActive: true,
  });

  const order = await createPickupOrder({
    customerId: 'cust-cron-test',
    customerName: 'Cron Customer',
    customerPhone: '9000000000',
    items: [{ productId: prod.id, quantity: 1 }],
    pickupMode: 'FLEXIBLE',
  });

  console.log(`Created order ${order.orderNumber} with status ${order.status}, initial reservedStock: 1`);

  // 2. Simulate expired reservation deadline
  const target = storeDb.orders.find((o) => o.id === order.id);
  target!.reservationExpiresAt = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

  // 3. Run cleanup
  const run1 = await cleanupExpiredReservations('system_cron_tester');
  console.log(`Cleanup run 1: expiredCount=${run1.expiredCount}, orderNumbers=${run1.expiredOrderNumbers.join(', ')}`);
  if (!run1.expiredOrderNumbers.includes(order.orderNumber)) {
    throw new Error('Order was not expired by cleanup!');
  }

  const updatedProd = storeDb.products.find((p) => p.id === prod.id);
  console.log(`Product reserved stock after cleanup: ${updatedProd?.reservedStock} (expected: 0)`);
  if (updatedProd?.reservedStock !== 0) {
    throw new Error('Stock was not released back!');
  }

  // 4. Repeated run (idempotency check)
  const run2 = await cleanupExpiredReservations('system_cron_tester');
  console.log(`Cleanup run 2 (idempotent): expiredCount=${run2.expiredCount} (expected: 0)`);
  if (run2.expiredOrderNumbers.includes(order.orderNumber)) {
    throw new Error('Order was repeatedly expired!');
  }

  console.log('[PASS] Reservation expiry cleanup and stock restoration verified as fully functional and idempotent!');
}

testCleanupCron().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
