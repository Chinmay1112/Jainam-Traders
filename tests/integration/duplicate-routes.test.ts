// ==============================================================================
// JAINAM TRADERS — DUPLICATE API ROUTES INTEGRATION TEST SUITE
// Verifies HTTP Route Handlers for /api/products/similar & /api/admin/products/duplicates
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getSimilarProducts, POST as postSimilarProducts } from '@/app/api/products/similar/route';
import { GET as getDuplicatesAudit, POST as postMergeProducts } from '@/app/api/admin/products/duplicates/route';
import { POST as postCreateProduct } from '@/app/api/products/route';
import { storeDb, createAdminProduct } from '@/lib/db/store-service';
import { createStaffToken, staffStore } from '@/lib/auth/staff-auth';
import { STAFF_COOKIE_NAME } from '@/lib/auth/server-guard';

describe('Duplicate Prevention API Routes Integration', () => {
  let ownerToken: string;
  let managerToken: string;
  let staffToken: string;

  beforeEach(() => {
    storeDb.products = [];
    storeDb.orders = [];
    storeDb.reviews = [];
    storeDb.inventoryMovements = [];
    storeDb.auditLogs = [];

    const ownerAcc = staffStore.findByEmailOrUsername('admin@jainamtraders.com')!;
    ownerToken = createStaffToken(ownerAcc);

    const managerAcc = staffStore.findByEmailOrUsername('manager@jainamtraders.com')!;
    managerToken = createStaffToken(managerAcc);

    const staffAcc = staffStore.findByEmailOrUsername('staff@jainamtraders.com')!;
    staffToken = createStaffToken(staffAcc);

    // Seed existing products
    storeDb.products.push({
      id: 'prod-clock-base',
      name: 'Silent Sweep 12-inch Wooden Wall Clock',
      slug: 'silent-sweep-12-inch-wooden-wall-clock',
      sku: 'JT-CLK-001',
      barcodeValue: '8901234001',
      brand: 'Ajanta Quartz',
      categoryId: 'cat-clocks',
      categoryName: 'Clocks',
      description: 'Original wooden wall clock',
      price: 599,
      mrp: 999,
      discountPercentage: 40,
      stockQuantity: 7,
      reservedStock: 0,
      lowStockThreshold: 3,
      minOrderQuantity: 1,
      maxOrderQuantity: 10,
      tags: ['wooden', 'wall clock'],
      thumbnailUrl: '/images/clock-1.jpg',
      images: ['/images/clock-1.jpg'],
      status: 'published',
      isArchived: false,
      isActive: true,
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      manufacturerModelNumber: 'XYZ-100',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    storeDb.products.push({
      id: 'prod-clock-dup',
      name: 'Wooden Wall Clock Silent Sweep',
      slug: 'wooden-wall-clock-silent-sweep',
      sku: 'JT-CLK-017',
      barcodeValue: '8901234017',
      brand: 'Ajanta Quartz',
      categoryId: 'cat-clocks',
      categoryName: 'Clocks',
      description: 'Duplicate wall clock entry',
      price: 599,
      mrp: 999,
      discountPercentage: 40,
      stockQuantity: 3,
      reservedStock: 0,
      lowStockThreshold: 3,
      minOrderQuantity: 1,
      maxOrderQuantity: 10,
      tags: ['wooden', 'wall clock'],
      thumbnailUrl: '/images/clock-2.jpg',
      images: ['/images/clock-2.jpg'],
      status: 'published',
      isArchived: false,
      isActive: true,
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      manufacturerModelNumber: 'XYZ-100',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('GET /api/products/similar rejects unauthenticated access', async () => {
    const req = new NextRequest('http://localhost:3000/api/products/similar?name=Wall+Clock');
    const res = await getSimilarProducts(req);
    expect(res.status).toBe(401);
  });

  it('GET /api/products/similar returns ranked similar products for staff', async () => {
    const req = new NextRequest('http://localhost:3000/api/products/similar?name=Wall+Clock', {
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${staffToken}`,
      },
    });

    const res = await getSimilarProducts(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.matches.length).toBeGreaterThan(0);
    expect(data.matches[0].product.name).toContain('Wall Clock');
  });

  it('POST /api/products/similar detects model number matches', async () => {
    const req = new NextRequest('http://localhost:3000/api/products/similar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STAFF_COOKIE_NAME}=${managerToken}`,
      },
      body: JSON.stringify({
        name: 'New Custom Clock',
        manufacturerModelNumber: 'XYZ-100',
      }),
    });

    const res = await postSimilarProducts(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.matches.length).toBeGreaterThan(0);
    expect(data.matches[0].matchedFields).toContain('modelNumber');
  });

  it('GET /api/admin/products/duplicates returns catalogue duplicate groups', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/products/duplicates', {
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
    });

    const res = await getDuplicatesAudit(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.groups.length).toBe(1);
    expect(data.groups[0].length).toBe(2);
  });

  it('POST /api/admin/products/duplicates rejects merge from non-Owner staff', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/products/duplicates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STAFF_COOKIE_NAME}=${managerToken}`, // Manager, not Owner
      },
      body: JSON.stringify({
        sourceProductId: 'prod-clock-dup',
        targetProductId: 'prod-clock-base',
      }),
    });

    const res = await postMergeProducts(req);
    // Strict RBAC: Owner only
    expect(res.status).toBe(403);
  });

  it('POST /api/admin/products/duplicates executes safe owner merge with inventory consolidation', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/products/duplicates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`, // Authorized Owner
      },
      body: JSON.stringify({
        sourceProductId: 'prod-clock-dup',
        targetProductId: 'prod-clock-base',
        differentiatorReason: 'Duplicate created accidentally by staff',
      }),
    });

    const res = await postMergeProducts(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify inventory consolidation: Base had 7, Dup had 3 -> Total = 10
    const targetProduct = storeDb.products.find((p) => p.id === 'prod-clock-base');
    const sourceProduct = storeDb.products.find((p) => p.id === 'prod-clock-dup');

    expect(targetProduct?.stockQuantity).toBe(10);
    expect(sourceProduct?.stockQuantity).toBe(0);
    expect(sourceProduct?.isArchived).toBe(true);
    expect(sourceProduct?.status).toBe('archived');

    // Verify inventory movement was recorded
    const movement = storeDb.inventoryMovements.find((m) => m.productId === 'prod-clock-base');
    expect(movement).toBeDefined();
    expect(movement?.quantityChange).toBe(3);
    expect(movement?.reason).toBe('restock');

    // Verify audit log
    const audit = storeDb.auditLogs.find((l) => l.action === 'MERGE_PRODUCTS');
    expect(audit).toBeDefined();
    expect(audit?.metadata?.stockTransferred).toBe(3);
  });
});
