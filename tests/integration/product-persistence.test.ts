// ==============================================================================
// JAINAM TRADERS — PRODUCT PERSISTENCE & CRUD INTEGRATION REGRESSION TESTS
// Verifies HTTP Route Handlers for:
// 1. Create product -> Read products -> Created product exists
// 2. Write -> New request -> Read -> Product matches
// 3. Update product -> Read product -> Changes reflected
// 4. Archive product -> Read products -> Filtered by status
// 5. Adjust stock -> Read product -> Stock reflected
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getProductsRoute, POST as postCreateProduct } from '@/app/api/products/route';
import { GET as getProductByIdRoute, PATCH as patchProductByIdRoute } from '@/app/api/products/[id]/route';
import { POST as postAdjustStock } from '@/app/api/products/stock/route';
import { storeDb } from '@/lib/db/store-service';
import { createStaffToken, staffStore } from '@/lib/auth/staff-auth';
import { STAFF_COOKIE_NAME } from '@/lib/auth/server-guard';

describe('Product Persistence & Cross-Request CRUD Integration', () => {
  let ownerToken: string;

  beforeEach(() => {
    storeDb.products = [];
    storeDb.inventoryMovements = [];
    storeDb.auditLogs = [];

    const ownerAcc = staffStore.findByEmailOrUsername('admin@jainamtraders.com')!;
    ownerToken = createStaffToken(ownerAcc);
  });

  it('1. Create product -> Read products -> Created product exists (Write -> New Request -> Read)', async () => {
    // Phase 1: POST /api/products
    const createReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'TEST-PERSISTENCE-CHECK',
        sku: 'JT-PERSIST-001',
        brand: 'Jainam Traders',
        categoryId: 'b0000000-0000-0000-0000-000000000001',
        categoryName: 'Gift Articles & Mementos',
        description: 'Automated cross-request persistence test',
        price: 150,
        mrp: 200,
        stockQuantity: 10,
        lowStockThreshold: 3,
        status: 'published',
      }),
    });

    const createRes = await postCreateProduct(createReq);
    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    expect(createdData.success).toBe(true);
    expect(createdData.product).toBeDefined();
    expect(createdData.product.name).toBe('TEST-PERSISTENCE-CHECK');
    expect(createdData.product.sku).toBe('JT-PERSIST-001');
    expect(createdData.product.stockQuantity).toBe(10);
    const createdId = createdData.product.id;

    // Phase 2: GET /api/products?admin=true (Brand new request)
    const listReq = new NextRequest('http://localhost:3000/api/products?admin=true', {
      method: 'GET',
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
    });

    const listRes = await getProductsRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.products).toBeDefined();
    expect(listData.total).toBeGreaterThanOrEqual(1);

    const found = listData.products.find((p: any) => p.id === createdId || p.sku === 'JT-PERSIST-001');
    expect(found).toBeDefined();
    expect(found.name).toBe('TEST-PERSISTENCE-CHECK');
    expect(found.price).toBe(150);
    expect(found.mrp).toBe(200);
    expect(found.stockQuantity).toBe(10);
  });

  it('2. Update product -> New request -> Read product -> Changes persisted', async () => {
    // 1. Create product first
    const createReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Initial Product Name',
        sku: 'JT-UPDATE-001',
        price: 250,
        mrp: 300,
        stockQuantity: 5,
        status: 'published',
      }),
    });
    const createRes = await postCreateProduct(createReq);
    const { product: created } = await createRes.json();

    // 2. PATCH /api/products/[id]
    const patchReq = new NextRequest(`http://localhost:3000/api/products/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Updated Product Name',
        price: 280,
        mrp: 350,
      }),
    });

    const patchRes = await patchProductByIdRoute(patchReq, {
      params: Promise.resolve({ id: created.id }),
    });
    expect(patchRes.status).toBe(200);

    // 3. GET /api/products/[id] (New Request)
    const getReq = new NextRequest(`http://localhost:3000/api/products/${created.id}`, {
      method: 'GET',
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
    });

    const getRes = await getProductByIdRoute(getReq, {
      params: Promise.resolve({ id: created.id }),
    });
    expect(getRes.status).toBe(200);
    const { product: reloaded } = await getRes.json();
    expect(reloaded.name).toBe('Updated Product Name');
    expect(reloaded.price).toBe(280);
    expect(reloaded.mrp).toBe(350);
  });

  it('3. Archive product -> Filtered by status in subsequent request', async () => {
    // 1. Create product
    const createReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Product to Archive',
        sku: 'JT-ARCHIVE-001',
        price: 100,
        mrp: 120,
        stockQuantity: 4,
        status: 'published',
      }),
    });
    const createRes = await postCreateProduct(createReq);
    const { product: created } = await createRes.json();

    // 2. Archive action
    const archiveReq = new NextRequest(`http://localhost:3000/api/products/${created.id}?action=archive`, {
      method: 'PATCH',
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
    });
    const archiveRes = await patchProductByIdRoute(archiveReq, {
      params: Promise.resolve({ id: created.id }),
    });
    expect(archiveRes.status).toBe(200);

    // 3. Query active products -> Must not contain archived product
    const activeReq = new NextRequest('http://localhost:3000/api/products?admin=true&status=active', {
      method: 'GET',
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
    });
    const activeRes = await getProductsRoute(activeReq);
    const activeData = await activeRes.json();
    const foundInActive = activeData.products.find((p: any) => p.id === created.id);
    expect(foundInActive).toBeUndefined();

    // 4. Query archived products -> Must contain archived product
    const archivedReq = new NextRequest('http://localhost:3000/api/products?admin=true&status=archived', {
      method: 'GET',
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
    });
    const archivedRes = await getProductsRoute(archivedReq);
    const archivedData = await archivedRes.json();
    const foundInArchived = archivedData.products.find((p: any) => p.id === created.id);
    expect(foundInArchived).toBeDefined();
    expect(foundInArchived.isArchived).toBe(true);
  });

  it('4. Adjust stock -> New request -> Stock quantity reflected', async () => {
    // 1. Create product with initial stock 10
    const createReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Stock Adjustment Test',
        sku: 'JT-STOCK-001',
        price: 100,
        mrp: 120,
        stockQuantity: 10,
        status: 'published',
      }),
    });
    const createRes = await postCreateProduct(createReq);
    const { product: created } = await createRes.json();

    // 2. Adjust stock (+5)
    const stockReq = new NextRequest('http://localhost:3000/api/products/stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
      body: JSON.stringify({
        productId: created.id,
        quantityChange: 5,
        reason: 'restock',
        notes: 'Restocked by counter staff',
      }),
    });
    const stockRes = await postAdjustStock(stockReq);
    expect(stockRes.status).toBe(200);

    // 3. Read back product in new request
    const getReq = new NextRequest(`http://localhost:3000/api/products/${created.id}`, {
      method: 'GET',
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${ownerToken}`,
      },
    });
    const getRes = await getProductByIdRoute(getReq, {
      params: Promise.resolve({ id: created.id }),
    });
    const { product: reloaded } = await getRes.json();
    expect(reloaded.stockQuantity).toBe(15);
  });
});
