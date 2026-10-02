// ==============================================================================
// JAINAM TRADERS - ENTERPRISE DATA SERVICE & INVENTORY ENGINE
// Ensures ACID-compliant concurrency safety, RLS enforcement & audit logging
// ==============================================================================

import {
  AppNotification,
  AuditLog,
  Category,
  Coupon,
  CustomerProductView,
  InventoryMovement,
  Offer,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Product,
  RefundMethod,
  RefundRecord,
  ReturnRequest,
  Review,
  ShopSettings,
  SupportConversation,
  SupportMessage,
  UserRole,
  GiftCode,
  GiftCodeRedemption,
  CustomerStaffNote,
  CustomerActivityEvent,
} from '@/lib/types';
import { INITIAL_CATEGORIES, INITIAL_COUPONS, INITIAL_OFFERS, INITIAL_PRODUCTS, INITIAL_SHOP_SETTINGS } from './initial-data';
import { canTransitionOrder } from '@/lib/orders/state-machine';
import {
  calculateOrderPricing,
  calculateDiscountPercentage,
  validateProductPricing,
  RawCheckoutItem,
  ValidatedItem,
} from '@/lib/pricing/engine';
import { calculateOrderDiscounts } from '@/lib/pricing/discount-engine';
import { customerStore } from '@/lib/auth/customer-store';
import {
  normalizeStockNumber,
  normalizeProductInventory,
  calculateStockAdjustment,
} from '@/lib/inventory/normalizer';
import { searchCatalogue } from '@/lib/search/search-engine';
import { extractSearchIntent } from '@/lib/search/normalizer';
import { buildProductSearchIndex } from '@/lib/search/product-indexer';
import {
  generateUniqueProductSku,
  checkBarcodeUniqueness,
  normalizeBarcodeValue,
} from '@/lib/barcode/barcode-service';
import { hashGiftCode, normalizeGiftCode } from '@/lib/gift-codes/gift-code-service';
import { findSimilarProducts } from '@/lib/products/duplicate-detector';

// Global in-memory storage for high-concurrency local development & automated test execution
class StoreDataStore {
  public settings: ShopSettings = { ...INITIAL_SHOP_SETTINGS };
  public categories: Category[] = [...INITIAL_CATEGORIES];
  public products: Product[] = [];
  public coupons: Coupon[] = [];
  public offers: Offer[] = [];
  public orders: Order[] = [];
  public returnRequests: ReturnRequest[] = [];
  public refundRecords: RefundRecord[] = [];
  public reviews: Review[] = [];
  public notifications: AppNotification[] = [];
  public supportConversations: SupportConversation[] = [];
  public inventoryMovements: InventoryMovement[] = [];
  public auditLogs: AuditLog[] = [];
  public giftCodes: GiftCode[] = [];
  public giftCodeRedemptions: GiftCodeRedemption[] = [];
  public customerNotes: CustomerStaffNote[] = [];
  public customerActivity: CustomerActivityEvent[] = [];
  private orderCounter: number = 100;

  // Concurrency mutex lock to prevent race conditions during inventory reservation
  private reservationLock: Promise<void> = Promise.resolve();

  constructor() {
    // Production store starts completely clean with ZERO demo records.
    // Real products, orders, and reviews are added by actual store operations.
  }

  /**
   * Test fixture loader — isolated strictly for automated test suites (vitest)
   */
  public seedTestFixtures(fixtures: {
    products?: Product[];
    orders?: Order[];
    reviews?: Review[];
    coupons?: Coupon[];
    offers?: Offer[];
  }) {
    if (fixtures.products) this.products = JSON.parse(JSON.stringify(fixtures.products));
    if (fixtures.orders) this.orders = JSON.parse(JSON.stringify(fixtures.orders));
    if (fixtures.reviews) this.reviews = JSON.parse(JSON.stringify(fixtures.reviews));
    if (fixtures.coupons) this.coupons = JSON.parse(JSON.stringify(fixtures.coupons));
    if (fixtures.offers) this.offers = JSON.parse(JSON.stringify(fixtures.offers));
  }

  // Generate readable unique order numbers: JT-2026-000101
  public generateNextOrderNumber(): string {
    this.orderCounter += 1;
    const year = new Date().getFullYear();
    const formatted = String(this.orderCounter).padStart(6, '0');
    return `JT-${year}-${formatted}`;
  }

  // Acquire concurrency reservation lock
  public async withReservationLock<T>(fn: () => Promise<T>): Promise<T> {
    let releaseLock: () => void;
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const currentLock = this.reservationLock;
    this.reservationLock = this.reservationLock.then(() => nextLock);

    await currentLock;
    try {
      return await fn();
    } finally {
      releaseLock!();
    }
  }

  // Audit logging helper
  public logAudit(actorId: string | undefined, actorRole: string | undefined, action: string, entity: string, entityId: string, metadata: Record<string, unknown> = {}) {
    this.auditLogs.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      actorId,
      actorRole,
      action,
      entity,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
    });
  }
}

// Global singleton instance across requests
const globalForStore = globalThis as unknown as { storeDb: StoreDataStore };
export const storeDb = globalForStore.storeDb || new StoreDataStore();
if (process.env.NODE_ENV !== 'production') globalForStore.storeDb = storeDb;

/**
 * Isolated fixture seeder for automated test suites
 */
export function seedTestFixtures(fixtures?: {
  products?: Product[];
  orders?: Order[];
  reviews?: Review[];
  coupons?: Coupon[];
  offers?: Offer[];
}) {
  if (fixtures) {
    storeDb.seedTestFixtures(fixtures);
  }
}

// ==============================================================================
// PUBLIC SERVICE API METHODS
// ==============================================================================

/**
 * 1. SHOP SETTINGS
 */
export async function getShopSettings(): Promise<ShopSettings> {
  return storeDb.settings;
}

export async function updateShopSettings(
  updates: Partial<ShopSettings>,
  actorId?: string
): Promise<ShopSettings> {
  storeDb.settings = {
    ...storeDb.settings,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  storeDb.logAudit(actorId, 'admin', 'UPDATE_SHOP_SETTINGS', 'shop_settings', storeDb.settings.id, updates);
  return storeDb.settings;
}

/**
 * 2. CATEGORIES
 */
export async function getCategories(): Promise<Category[]> {
  return storeDb.categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return storeDb.categories.find((c) => c.slug === slug && c.isActive) || null;
}

/**
 * 3. PRODUCTS & SEARCH
 */
export interface ProductFilterParams {
  categorySlug?: string;
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating';
  limit?: number;
  offset?: number;
}

// Convert internal Product to customer-safe view (Rule 10: NEVER show raw stock numbers to customers)
export function toCustomerProductView(product: Product): CustomerProductView {
  const { availableStock } = normalizeProductInventory(product);
  let availability: 'AVAILABLE' | 'OUT_OF_STOCK' | 'COMING_SOON' = 'AVAILABLE';

  const isArchived = Boolean(product.isArchived || product.status === 'archived');
  if (!product.isActive || isArchived) {
    availability = 'COMING_SOON';
  } else if (availableStock <= 0) {
    availability = 'OUT_OF_STOCK';
  }

  // Strip exact stock numbers
  const { stockQuantity: _sq, reservedStock: _rs, lowStockThreshold: _lst, ...safeProduct } = product;
  void _sq;
  void _rs;
  void _lst;

  return {
    ...safeProduct,
    availability,
  };
}

export { parseSearchQuery, type ParsedSearchQuery } from '@/lib/search/search-engine';

export async function getCustomerProducts(params: ProductFilterParams = {}): Promise<{
  products: CustomerProductView[];
  total: number;
  suggestedAlternatives?: { label: string; query: string; categorySlug: string }[];
}> {
  const result = searchCatalogue(storeDb.products, {
    query: params.query,
    categorySlug: params.categorySlug,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    featured: params.featured,
    newArrival: params.newArrival,
    bestSeller: params.bestSeller,
    sort: params.sort,
    limit: params.limit,
  });

  const offset = params.offset || 0;
  const limit = params.limit || 50;
  const paginated = params.limit ? result.products : result.products.slice(offset, offset + limit);

  return {
    products: paginated.map(toCustomerProductView),
    total: result.total,
    suggestedAlternatives: result.suggestedAlternatives,
  };
}


export async function getProductBySlug(slug: string): Promise<CustomerProductView | null> {
  const p = storeDb.products.find(
    (prod) =>
      prod.slug === slug &&
      prod.isActive &&
      !prod.isArchived &&
      prod.status !== 'archived' &&
      prod.status !== 'draft' &&
      prod.status !== 'hidden'
  );
  if (!p) return null;
  return toCustomerProductView(p);
}

export async function getRawProductById(id: string): Promise<Product | null> {
  return storeDb.products.find((prod) => prod.id === id) || null;
}

export async function getProductByBarcode(code: string): Promise<Product | null> {
  const norm = normalizeBarcodeValue(code);
  if (!norm) return null;
  return (
    storeDb.products.find(
      (prod) =>
        normalizeBarcodeValue(prod.sku) === norm ||
        (prod.barcodeValue && normalizeBarcodeValue(prod.barcodeValue) === norm)
    ) || null
  );
}

/**
 * 4. ADMIN INVENTORY & PRODUCT MANAGEMENT
 */
export async function getAdminProducts(filter?: {
  status?: 'all' | 'active' | 'archived';
  search?: string;
}): Promise<Product[]> {
  let list = storeDb.products.map((p) => {
    const inv = normalizeProductInventory(p);
    return {
      ...p,
      stockQuantity: inv.totalStock,
      reservedStock: inv.reservedStock,
      lowStockThreshold: inv.lowStockThreshold,
      isArchived: Boolean(p.isArchived || p.status === 'archived'),
      status: p.status || (p.isArchived ? 'archived' : p.isActive ? 'published' : 'hidden'),
    };
  });

  if (filter?.status === 'active') {
    list = list.filter((p) => !p.isArchived && p.status !== 'archived');
  } else if (filter?.status === 'archived') {
    list = list.filter((p) => p.isArchived || p.status === 'archived');
  }

  if (filter?.search && filter.search.trim()) {
    const q = filter.search.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
    );
  }

  return list;
}

export async function createAdminProduct(
  data: Partial<Product> & {
    name: string;
    price: number;
    mrp: number;
    confirmDifferentiator?: { reason: string; note?: string };
    bypassDuplicateReason?: string;
  },
  actorId?: string
): Promise<Product> {
  if (!data.name || !data.name.trim()) throw new Error('Product name is required');

  // If SKU is missing or empty, generate a unique Jainam Traders SKU automatically
  const rawSku = data.sku && data.sku.trim()
    ? data.sku.trim()
    : generateUniqueProductSku(storeDb.products, data.categoryName);
  const normalizedSku = normalizeBarcodeValue(rawSku);

  // Barcode / SKU collision protection
  const skuCheck = checkBarcodeUniqueness(storeDb.products, normalizedSku);
  if (!skuCheck.isUnique) {
    throw new Error(`Duplicate SKU rejected: SKU "${normalizedSku}" already exists for product "${skuCheck.conflictProduct?.name}".`);
  }

  const rawBarcode = data.barcodeValue ? normalizeBarcodeValue(data.barcodeValue) : normalizedSku;
  const barcodeCheck = checkBarcodeUniqueness(storeDb.products, rawBarcode);
  if (!barcodeCheck.isUnique) {
    throw new Error(`Duplicate barcode rejected: Barcode "${rawBarcode}" already exists for product "${barcodeCheck.conflictProduct?.name}".`);
  }

  // Multi-field duplicate similarity verification (Requirements 5, 6, 14, 22)
  const differentiatorProvided = Boolean(data.bypassDuplicateReason || data.confirmDifferentiator?.reason);
  if (!differentiatorProvided) {
    const similarProducts = findSimilarProducts(storeDb.products, {
      name: data.name,
      sku: normalizedSku,
      barcodeValue: rawBarcode,
      brand: data.brand,
      categoryId: data.categoryId,
      manufacturerModelNumber: data.manufacturerModelNumber,
    });

    const highConfidenceMatch = similarProducts.find(
      (m) => m.confidence === 'EXACT' || (m.confidence === 'HIGH' && m.score >= 85)
    );

    if (highConfidenceMatch) {
      throw new Error(
        `DUPLICATE_PRODUCT_WARNING: Possible duplicate detected with existing product "${highConfidenceMatch.product.name}" (SKU: ${highConfidenceMatch.product.sku}, Confidence: ${highConfidenceMatch.confidence}). To proceed, use the existing product or specify a differentiator reason.`
      );
    }
  }

  const pricing = validateProductPricing(data.mrp, data.price);
  if (!pricing.isValid) {
    throw new Error(pricing.error || 'Invalid product pricing');
  }

  const initialStock = normalizeStockNumber(data.stockQuantity, 0);
  const lowStockThreshold = normalizeStockNumber(data.lowStockThreshold, 3);
  const status = data.status || 'published';
  const isArchived = status === 'archived' || Boolean(data.isArchived);
  const isActive = isArchived ? false : data.isActive !== undefined ? data.isActive : true;

  const safeData = { ...data };
  delete safeData.discountPercentage;

  const newProduct: Product = {
    ...safeData,
    id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: data.name,
    sku: normalizedSku,
    barcodeValue: rawBarcode,
    manufacturerModelNumber: data.manufacturerModelNumber?.trim() || undefined,
    slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    categoryId: data.categoryId || 'b0000000-0000-0000-0000-000000000001',
    categoryName: data.categoryName || 'General',
    description: data.description || '',
    price: pricing.sellingPrice,
    mrp: pricing.mrp,
    discountPercentage: pricing.discountPercentage,
    stockQuantity: initialStock,
    reservedStock: 0,
    lowStockThreshold,
    minOrderQuantity: data.minOrderQuantity || 1,
    maxOrderQuantity: data.maxOrderQuantity || 10,
    tags: data.tags || [],
    brand: data.brand || 'Jainam Traders',
    isFeatured: Boolean(data.isFeatured),
    isNewArrival: Boolean(data.isNewArrival),
    isBestSeller: Boolean(data.isBestSeller),
    status,
    isArchived,
    isActive,
    thumbnailUrl: data.thumbnailUrl || (data.images && data.images[0]) || '/images/product-placeholder.svg',
    images: data.images && data.images.length > 0 ? data.images : (data.thumbnailUrl ? [data.thumbnailUrl] : ['/images/product-placeholder.svg']),
    videoUrl: data.videoUrl,
    searchKeywords: data.searchKeywords,
    searchIndex: buildProductSearchIndex({ ...safeData, sku: normalizedSku, barcodeValue: rawBarcode, manufacturerModelNumber: data.manufacturerModelNumber, price: pricing.sellingPrice, mrp: pricing.mrp }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  storeDb.products.unshift(newProduct);

  // Record initial stock movement audit log if stock > 0
  if (initialStock > 0) {
    const initMovement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      productId: newProduct.id,
      productName: newProduct.name,
      quantityChange: initialStock,
      previousStock: 0,
      newStock: initialStock,
      reason: 'restock',
      notes: 'Initial stock recorded on product creation',
      actorId,
      createdAt: new Date().toISOString(),
    };
    storeDb.inventoryMovements.unshift(initMovement);
  }

  storeDb.logAudit(actorId, 'admin', 'CREATE_PRODUCT', 'products', newProduct.id, {
    name: newProduct.name,
    sku: newProduct.sku,
    barcodeValue: newProduct.barcodeValue,
    manufacturerModelNumber: newProduct.manufacturerModelNumber,
    differentiatorReason: data.confirmDifferentiator?.reason || data.bypassDuplicateReason,
    differentiatorNote: data.confirmDifferentiator?.note,
    initialStock,
    price: newProduct.price,
    mrp: newProduct.mrp,
    discountPercentage: newProduct.discountPercentage,
  });

  return newProduct;
}

export async function updateAdminProduct(
  id: string,
  updates: Partial<Product> & { priceChangeReason?: string },
  actorId?: string
): Promise<Product> {
  const index = storeDb.products.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Product not found');

  const existing = storeDb.products[index];

  // SKU and Barcode Collision Verification
  let finalSku = existing.sku;
  let finalBarcode = existing.barcodeValue || existing.sku;

  if (updates.sku && normalizeBarcodeValue(updates.sku) !== normalizeBarcodeValue(existing.sku)) {
    const newSku = normalizeBarcodeValue(updates.sku);
    const skuCheck = checkBarcodeUniqueness(storeDb.products, newSku, id);
    if (!skuCheck.isUnique) {
      throw new Error(`Duplicate SKU rejected: SKU "${newSku}" already exists for product "${skuCheck.conflictProduct?.name}".`);
    }
    finalSku = newSku;
    // By default, if barcode derived from SKU, keep in sync
    if (!updates.barcodeValue || updates.barcodeValue === existing.sku) {
      finalBarcode = newSku;
    }
  }

  if (updates.barcodeValue && normalizeBarcodeValue(updates.barcodeValue) !== normalizeBarcodeValue(finalBarcode)) {
    const newBarcode = normalizeBarcodeValue(updates.barcodeValue);
    const bcCheck = checkBarcodeUniqueness(storeDb.products, newBarcode, id);
    if (!bcCheck.isUnique) {
      throw new Error(`Duplicate barcode rejected: Barcode "${newBarcode}" already exists for product "${bcCheck.conflictProduct?.name}".`);
    }
    finalBarcode = newBarcode;
  }

  // Price validation: selling price must not exceed MRP
  const finalPrice = updates.price !== undefined ? updates.price : existing.price;
  const finalMrp = updates.mrp !== undefined ? updates.mrp : existing.mrp;

  const pricing = validateProductPricing(finalMrp, finalPrice);
  if (!pricing.isValid) {
    throw new Error(pricing.error || 'Invalid product pricing');
  }

  const isPriceChanged = existing.mrp !== pricing.mrp || existing.price !== pricing.sellingPrice;
  const prevDiscount = calculateDiscountPercentage(existing.mrp, existing.price);

  // Protect inventory and server-derived values from direct tampering
  const safeUpdates: Partial<Product> & { priceChangeReason?: string } = { ...updates };
  delete safeUpdates.reservedStock;
  delete safeUpdates.stockQuantity;
  delete (safeUpdates as Record<string, unknown>).discountPercentage;

  let status = safeUpdates.status || existing.status || 'published';
  let isArchived = Boolean(safeUpdates.isArchived ?? existing.isArchived);
  let isActive = safeUpdates.isActive !== undefined ? safeUpdates.isActive : existing.isActive;

  if (safeUpdates.status === 'archived') {
    isArchived = true;
    isActive = false;
    status = 'archived';
  } else if (safeUpdates.status === 'published') {
    isArchived = false;
    isActive = true;
    status = 'published';
  } else if (safeUpdates.status === 'hidden') {
    isArchived = false;
    isActive = false;
    status = 'hidden';
  }

  const updated: Product = {
    ...existing,
    ...safeUpdates,
    sku: finalSku,
    barcodeValue: finalBarcode,
    price: pricing.sellingPrice,
    mrp: pricing.mrp,
    discountPercentage: pricing.discountPercentage,
    status,
    isArchived,
    isActive,
    updatedAt: new Date().toISOString(),
  };

  updated.searchIndex = buildProductSearchIndex(updated);

  storeDb.products[index] = updated;

  // Record PRICE_CHANGE audit log whenever MRP or Selling Price changes
  if (isPriceChanged) {
    storeDb.logAudit(actorId, 'admin', 'PRICE_CHANGE', 'products', id, {
      productId: id,
      productName: updated.name,
      previousMrp: existing.mrp,
      newMrp: pricing.mrp,
      previousSellingPrice: existing.price,
      newSellingPrice: pricing.sellingPrice,
      calculatedPreviousDiscount: prevDiscount,
      calculatedNewDiscount: pricing.discountPercentage,
      staffUser: actorId || 'system',
      role: 'owner',
      timestamp: new Date().toISOString(),
      reason: safeUpdates.priceChangeReason || (safeUpdates as Record<string, unknown>).reason || 'Price updated in admin catalogue',
    });
  }

  storeDb.logAudit(actorId, 'admin', 'UPDATE_PRODUCT', 'products', id, {
    name: updated.name,
    sku: updated.sku,
    price: updated.price,
    mrp: updated.mrp,
    discountPercentage: updated.discountPercentage,
    status: updated.status,
  });

  return updated;
}

export async function archiveAdminProduct(id: string, actorId?: string): Promise<Product> {
  const index = storeDb.products.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Product not found');

  const existing = storeDb.products[index];
  existing.isArchived = true;
  existing.status = 'archived';
  existing.isActive = false;
  existing.updatedAt = new Date().toISOString();

  storeDb.products[index] = existing;
  storeDb.logAudit(actorId, 'admin', 'ARCHIVE_PRODUCT', 'products', id, {
    name: existing.name,
    sku: existing.sku,
  });

  return existing;
}

export async function unarchiveAdminProduct(id: string, actorId?: string): Promise<Product> {
  const index = storeDb.products.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Product not found');

  const existing = storeDb.products[index];
  existing.isArchived = false;
  existing.status = 'published';
  existing.isActive = true;
  existing.updatedAt = new Date().toISOString();

  storeDb.products[index] = existing;
  storeDb.logAudit(actorId, 'admin', 'UNARCHIVE_PRODUCT', 'products', id, {
    name: existing.name,
    sku: existing.sku,
  });

  return existing;
}

export async function deleteAdminProductPermanent(id: string, actorId?: string): Promise<Product> {
  const index = storeDb.products.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Product not found');

  const removed = storeDb.products.splice(index, 1)[0];
  storeDb.logAudit(actorId, 'admin', 'PERMANENT_DELETE_PRODUCT', 'products', id, {
    name: removed.name,
    sku: removed.sku,
  });

  return removed;
}

export async function adjustInventory(
  productId: string,
  variantId: string | undefined,
  quantityChange: number, // positive for add, negative for deduction
  reason: 'purchase' | 'sale' | 'damage' | 'missing' | 'manual_correction' | 'return' | 'restock' | 'other',
  notes: string,
  actorId?: string
): Promise<{ product: Product; movement: InventoryMovement }> {
  return storeDb.withReservationLock(async () => {
    const product = storeDb.products.find((p) => p.id === productId);
    if (!product) throw new Error('Product not found');

    const check = calculateStockAdjustment(product.stockQuantity, quantityChange);
    if (!check.isValid) {
      throw new Error(check.error || 'Invalid stock adjustment');
    }

    const prevStock = check.prevStock;
    const newStock = check.newStock;
    product.stockQuantity = newStock;
    product.updatedAt = new Date().toISOString();

    const movement: InventoryMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId,
      productName: product.name,
      variantId,
      quantityChange: check.change,
      previousStock: prevStock,
      newStock,
      reason: reason as any,
      notes,
      actorId,
      createdAt: new Date().toISOString(),
    };

    storeDb.inventoryMovements.unshift(movement);
    storeDb.logAudit(actorId, 'staff', 'ADJUST_INVENTORY', 'inventory', productId, {
      productName: product.name,
      quantityChange: check.change,
      reason,
      prevStock,
      newStock,
      notes,
    });

    return { product, movement };
  });
}

/**
 * 5. ATOMIC ORDER CREATION & INVENTORY RESERVATION (CONCURRENCY-SAFE)
 */
export interface CreateOrderParams {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  idempotencyKey?: string;
  reservationHours?: number;
  items: RawCheckoutItem[];
  couponCode?: string;
  giftCode?: string;
  pickupMode: 'FLEXIBLE' | 'SLOT';
  pickupSlotDate?: string;
  pickupSlotTime?: string;
  customerNotes?: string;
}

export async function createPickupOrder(params: CreateOrderParams): Promise<Order> {
  // Execute within concurrency reservation lock to guarantee no double-booking of last unit
  return storeDb.withReservationLock(async () => {
    // 0. Idempotency Check: if identical request key already exists, return existing order
    if (params.idempotencyKey && params.idempotencyKey.trim()) {
      const existing = storeDb.orders.find((o) => o.idempotencyKey === params.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    if (!params.customerId || !params.customerId.trim()) {
      throw new Error('Customer authentication identity is required to reserve store inventory');
    }

    if (!params.items || params.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // 0. Enforce Customer Account Status (Part 4)
    const custAccount =
      customerStore.findByIdOrUserId(params.customerId) ||
      (params.customerEmail ? customerStore.findByEmail(params.customerEmail) : null);

    if (custAccount) {
      if (custAccount.accountStatus === 'SUSPENDED') {
        throw new Error('Your customer account is currently suspended. You cannot place new reservations or pickup orders.');
      }
      if (custAccount.accountStatus === 'DEACTIVATED') {
        throw new Error('Your customer account has been deactivated. Please contact store management.');
      }
    }

    const validatedItems: ValidatedItem[] = [];

    // 1. Validate existence and stock availability
    for (const item of params.items) {
      const prod = storeDb.products.find(
        (p) => p.id === item.productId && p.isActive && !p.isArchived && p.status !== 'archived'
      );
      if (!prod) {
        throw new Error(`Product ${item.productId} is no longer available or has been archived.`);
      }

      if (item.quantity < (prod.minOrderQuantity || 1)) {
        throw new Error(`Minimum order quantity for ${prod.name} is ${prod.minOrderQuantity || 1}`);
      }
      if (item.quantity > (prod.maxOrderQuantity || 10)) {
        throw new Error(`Maximum order quantity for ${prod.name} is ${prod.maxOrderQuantity || 10}`);
      }

      // Check variant if applicable
      let variantName: string | undefined = undefined;
      let unitPrice = prod.price;

      if (item.variantId) {
        const variant = prod.variants?.find((v) => v.id === item.variantId && v.isActive);
        if (!variant) {
          throw new Error(`Selected variant is no longer available for ${prod.name}`);
        }
        variantName = variant.title;
        if (variant.priceOverride) unitPrice = variant.priceOverride;

        const availableUnits = variant.stockQuantity - variant.reservedStock;
        if (availableUnits < item.quantity) {
          throw new Error(
            `Sorry! "${prod.name} (${variantName})" is currently out of stock for pickup (Available: ${availableUnits}).`
          );
        }
      } else {
        const availableUnits = prod.stockQuantity - prod.reservedStock;
        if (availableUnits < item.quantity) {
          throw new Error(
            `Sorry! "${prod.name}" has only ${availableUnits} unit(s) remaining for pickup. Your requested quantity (${item.quantity}) cannot be reserved.`
          );
        }
      }

      validatedItems.push({
        productId: prod.id,
        variantId: item.variantId,
        productName: prod.name,
        variantName,
        unitPrice,
        mrp: prod.mrp,
        quantity: item.quantity,
        totalPrice: unitPrice * item.quantity,
        thumbnailUrl: prod.thumbnailUrl,
      });
    }

    const rawSubtotal = validatedItems.reduce((acc, item) => acc + item.totalPrice, 0);

    // 2. Resolve Coupon
    let coupon: Coupon | undefined = undefined;
    if (params.couponCode) {
      coupon = storeDb.coupons.find((c) => c.code.toUpperCase() === params.couponCode!.toUpperCase());
    }

    // 3. Resolve Gift Code (Part 25 & 26)
    let giftCodeItem: GiftCode | undefined = undefined;
    if (params.giftCode) {
      const cleanGift = normalizeGiftCode(params.giftCode);
      const codeHash = hashGiftCode(cleanGift);
      giftCodeItem = storeDb.giftCodes.find((g) => g.codeHash === codeHash || g.code === cleanGift);
      if (!giftCodeItem) {
        throw new Error(`Gift code '${cleanGift}' does not exist.`);
      }
    }

    const previousOrdersCount = storeDb.orders.filter((o) => o.customerId === params.customerId).length;
    const isFirstOrder = previousOrdersCount === 0;

    // 4. Centralized Stacking & Discount Engine (Part 34)
    const discountCalc = calculateOrderDiscounts({
      subtotal: rawSubtotal,
      coupon,
      giftCode: giftCodeItem,
      customerId: custAccount?.id || params.customerId,
      isCustomerFirstOrder: isFirstOrder,
      allowStacking: true,
    });

    if (discountCalc.couponError && params.couponCode) {
      throw new Error(discountCalc.couponError);
    }
    if (discountCalc.giftCodeError && params.giftCode) {
      throw new Error(discountCalc.giftCodeError);
    }

    // 5. Atomically Reserve Inventory with Rollback Protection
    const reservedRollbackList: Array<{ productId: string; variantId?: string; quantity: number }> = [];
    try {
      for (const item of params.items) {
        const prod = storeDb.products.find((p) => p.id === item.productId)!;
        if (item.variantId) {
          const variant = prod.variants?.find((v) => v.id === item.variantId)!;
          const availableUnits = variant.stockQuantity - variant.reservedStock;
          if (availableUnits < item.quantity) {
            throw new Error(
              `Sorry! "${prod.name} (${variant.title})" is currently out of stock for pickup (Available: ${availableUnits}).`
            );
          }
          variant.reservedStock += item.quantity;
          reservedRollbackList.push({ productId: prod.id, variantId: item.variantId, quantity: item.quantity });
        } else {
          const availableUnits = prod.stockQuantity - prod.reservedStock;
          if (availableUnits < item.quantity) {
            throw new Error(
              `Sorry! "${prod.name}" has only ${availableUnits} unit(s) remaining for pickup. Your requested quantity (${item.quantity}) cannot be reserved.`
            );
          }
          prod.reservedStock += item.quantity;
          reservedRollbackList.push({ productId: prod.id, quantity: item.quantity });
        }

        // Audit movement
        storeDb.inventoryMovements.unshift({
          id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: prod.id,
          productName: prod.name,
          variantId: item.variantId,
          quantityChange: item.quantity,
          previousStock: prod.stockQuantity,
          newStock: prod.stockQuantity,
          reason: 'reservation',
          notes: `Reserved for customer order`,
          actorId: params.customerId,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (reserveError) {
      // Rollback all partial reservations for this order
      for (const rb of reservedRollbackList) {
        const prod = storeDb.products.find((p) => p.id === rb.productId);
        if (prod) {
          if (rb.variantId) {
            const v = prod.variants?.find((varItem) => varItem.id === rb.variantId);
            if (v) v.reservedStock = Math.max(0, v.reservedStock - rb.quantity);
          } else {
            prod.reservedStock = Math.max(0, prod.reservedStock - rb.quantity);
          }
        }
      }
      throw reserveError;
    }

    // 6. Update coupon usage count if applied
    if (discountCalc.appliedCoupon) {
      const cIndex = storeDb.coupons.findIndex((c) => c.id === discountCalc.appliedCoupon!.id);
      if (cIndex !== -1) {
        storeDb.coupons[cIndex].usedCount += 1;
      }
    }

    const orderNumber = storeDb.generateNextOrderNumber();
    const qrToken = `JT-QR-${orderNumber}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // 7. Atomically Redeem Gift Code if applied (Part 26 & 28)
    let appliedGiftDiscount = 0;
    let appliedGiftId: string | undefined = undefined;
    let appliedGiftCodeStr: string | undefined = undefined;

    if (giftCodeItem && discountCalc.giftCodeDiscount > 0) {
      appliedGiftDiscount = discountCalc.giftCodeDiscount;
      appliedGiftId = giftCodeItem.id;
      appliedGiftCodeStr = giftCodeItem.maskedCode; // Order snapshot always stores maskedCode!

      if (giftCodeItem.remainingValue < appliedGiftDiscount || giftCodeItem.status !== 'ACTIVE') {
        throw new Error(`Gift code balance is no longer available.`);
      }

      const previousVal = giftCodeItem.remainingValue;
      const newVal = previousVal - appliedGiftDiscount;
      if (newVal < 0) {
        throw new Error('Gift code balance cannot be negative.');
      }

      giftCodeItem.remainingValue = newVal;
      giftCodeItem.redemptionCount += 1;
      if (newVal === 0 || giftCodeItem.redemptionCount >= giftCodeItem.maxRedemptions) {
        giftCodeItem.status = 'REDEEMED';
      }
      giftCodeItem.updatedAt = new Date().toISOString();

      // Record immutable redemption audit record
      storeDb.giftCodeRedemptions.unshift({
        id: `red-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        giftCodeId: giftCodeItem.id,
        code: giftCodeItem.maskedCode,
        orderId: '', // Populated below
        orderNumber,
        customerId: params.customerId,
        customerName: params.customerName,
        amountApplied: appliedGiftDiscount,
        previousRemainingValue: previousVal,
        newRemainingValue: newVal,
        action: 'REDEEMED',
        actorId: params.customerId,
        actorRole: 'customer',
        idempotencyKey: `ord-${orderNumber}-gift`,
        timestamp: new Date().toISOString(),
      });
    }

    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Update orderId on redemption log if created
    if (storeDb.giftCodeRedemptions[0]?.orderNumber === orderNumber) {
      storeDb.giftCodeRedemptions[0].orderId = orderId;
    }

    const reservationHours = params.reservationHours || 24;
    const reservationExpiresAt = new Date(Date.now() + reservationHours * 60 * 60 * 1000).toISOString();

    const order: Order = {
      id: orderId,
      orderNumber,
      idempotencyKey: params.idempotencyKey,
      customerId: params.customerId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      paymentMethod: 'Pay at Shop',
      subtotal: discountCalc.subtotal,
      discount: discountCalc.couponDiscount,
      totalAmount: discountCalc.netPayableAtCounter,
      amountDue: discountCalc.netPayableAtCounter,
      amountReceived: 0,
      couponCode: discountCalc.appliedCoupon?.code,
      giftCode: appliedGiftCodeStr,
      giftCodeDiscount: appliedGiftDiscount,
      giftCodeId: appliedGiftId,
      netPayableAtCounter: discountCalc.netPayableAtCounter,
      pickupMode: params.pickupMode,
      pickupSlotDate: params.pickupSlotDate,
      pickupSlotTime: params.pickupSlotTime,
      customerNotes: params.customerNotes,
      qrToken,
      reservationExpiresAt,
      items: validatedItems.map((v) => ({
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId,
        productId: v.productId,
        variantId: v.variantId,
        productName: v.productName,
        variantName: v.variantName,
        unitPrice: v.unitPrice,
        mrp: v.mrp,
        discountPercentage: calculateDiscountPercentage(v.mrp, v.unitPrice),
        quantity: v.quantity,
        totalPrice: v.totalPrice,
        thumbnailUrl: v.thumbnailUrl,
      })),
      statusHistory: [
        {
          id: `hist-${Date.now()}`,
          orderId,
          toStatus: 'PENDING',
          note: 'Order placed by customer for pickup at Jainam Traders counter.',
          changedBy: params.customerId,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storeDb.orders.unshift(order);

    // Record immutable customer activity event (Part 8)
    storeDb.customerActivity.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customerId: params.customerId,
      eventType: 'ORDER_PLACED',
      description: `Placed pickup order ${order.orderNumber} for ₹${order.totalAmount} (Payable at shop).`,
      actorId: params.customerId,
      actorRole: 'customer',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        giftCode: order.giftCode,
        giftCodeDiscount: order.giftCodeDiscount,
        payableAtCounter: order.totalAmount,
      },
      createdAt: new Date().toISOString(),
    });

    // Notify customer
    storeDb.notifications.unshift({
      id: `notif-${Date.now()}`,
      customerId: params.customerId,
      title: 'Order Placed Successfully',
      message: `Your pickup order ${order.orderNumber} (₹${order.totalAmount}) has been received by Jainam Traders.`,
      linkUrl: `/orders/${order.orderNumber}`,
      isRead: false,
      notificationType: 'order',
      createdAt: new Date().toISOString(),
    });

    storeDb.logAudit(params.customerId, 'customer', 'CREATE_ORDER', 'orders', order.id, {
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      giftCode: order.giftCode,
      giftCodeDiscount: order.giftCodeDiscount,
    });

    return order;
  });
}

/**
 * 6. ORDER TRANSITION STATE MACHINE (Strict Enforcement)
 */
export async function transitionOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  actorRole: UserRole,
  actorId?: string,
  note?: string
): Promise<Order> {
  return storeDb.withReservationLock(async () => {
    const order = storeDb.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!order) throw new Error('Order not found');

    const check = canTransitionOrder(order.status, nextStatus, actorRole);
    if (!check.allowed) {
      throw new Error(check.reason || 'Invalid order status transition');
    }

    const previousStatus = order.status;
    order.status = nextStatus;
    order.updatedAt = new Date().toISOString();

    // Side effect 1: If CANCELLED or EXPIRED, release reserved stock back to available pool
    if (nextStatus === 'CANCELLED' || nextStatus === 'EXPIRED') {
      for (const item of order.items) {
        const prod = storeDb.products.find((p) => p.id === item.productId);
        if (prod) {
          if (item.variantId) {
            const v = prod.variants?.find((varItem) => varItem.id === item.variantId);
            if (v) v.reservedStock = Math.max(0, v.reservedStock - item.quantity);
          } else {
            prod.reservedStock = Math.max(0, prod.reservedStock - item.quantity);
          }

          storeDb.inventoryMovements.unshift({
            id: `rel-${Date.now()}`,
            productId: prod.id,
            productName: prod.name,
            variantId: item.variantId,
            quantityChange: item.quantity,
            previousStock: prod.stockQuantity,
            newStock: prod.stockQuantity,
            reason: 'release_reservation',
            orderId: order.id,
            notes: `Released reservation upon order ${nextStatus.toLowerCase()} (${order.orderNumber})`,
            actorId,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Restore gift code if redeemed on this order (Part 26 & 29)
      if (order.giftCodeId || order.giftCode) {
        const redemptions = storeDb.giftCodeRedemptions.filter(
          (r) => (r.orderId === order.id || r.orderNumber === order.orderNumber) && r.action === 'REDEEMED'
        );

        for (const red of redemptions) {
          const gift = storeDb.giftCodes.find((g) => g.id === red.giftCodeId);
          if (gift) {
            const previousRemaining = gift.remainingValue;
            const newRemaining = Math.min(gift.originalValue, previousRemaining + red.amountApplied);

            gift.remainingValue = newRemaining;
            gift.redemptionCount = Math.max(0, gift.redemptionCount - 1);
            if (gift.status === 'REDEEMED') {
              gift.status = 'ACTIVE';
            }
            gift.updatedAt = new Date().toISOString();

            storeDb.giftCodeRedemptions.unshift({
              id: `rest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              giftCodeId: gift.id,
              code: gift.maskedCode,
              orderId: order.id,
              orderNumber: order.orderNumber,
              customerId: red.customerId,
              customerName: red.customerName,
              amountApplied: red.amountApplied,
              previousRemainingValue: previousRemaining,
              newRemainingValue: newRemaining,
              action: 'RESTORED',
              actorId: actorId || 'system',
              actorRole: actorRole || 'system',
              reason: `Order ${nextStatus.toLowerCase()} before pickup`,
              timestamp: new Date().toISOString(),
            });

            storeDb.logAudit(actorId, actorRole, 'RESTORE_GIFT_CODE', 'gift_codes', gift.id, {
              orderNumber: order.orderNumber,
              amountRestored: red.amountApplied,
              newRemainingValue: newRemaining,
            });
          }
        }
      }

      // Customer activity log for cancellation or expiration
      storeDb.customerActivity.unshift({
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        customerId: order.customerId,
        eventType: nextStatus === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_EXPIRED',
        description: `Order ${order.orderNumber} was ${nextStatus.toLowerCase()}.`,
        actorId,
        actorRole: actorRole === 'customer' ? 'customer' : 'staff',
        createdAt: new Date().toISOString(),
      });
    }

    // Side effect 2: If PICKED_UP, finalize deduction (decrement stockQuantity and reservedStock) & mark PAID
    if (nextStatus === 'PICKED_UP') {
      order.paymentStatus = 'PAID';
      order.amountReceived = order.totalAmount;
      order.amountDue = 0;
      order.paymentRecordedAt = new Date().toISOString();
      order.paymentRecordedBy = actorId || 'counter_staff';
      for (const item of order.items) {
        const prod = storeDb.products.find((p) => p.id === item.productId);
        if (prod) {
          const prev = prod.stockQuantity;
          if (item.variantId) {
            const v = prod.variants?.find((varItem) => varItem.id === item.variantId);
            if (v) {
              v.stockQuantity = Math.max(0, v.stockQuantity - item.quantity);
              v.reservedStock = Math.max(0, v.reservedStock - item.quantity);
            }
          } else {
            prod.stockQuantity = Math.max(0, prod.stockQuantity - item.quantity);
            prod.reservedStock = Math.max(0, prod.reservedStock - item.quantity);
          }

          storeDb.inventoryMovements.unshift({
            id: `sale-${Date.now()}`,
            productId: prod.id,
            productName: prod.name,
            variantId: item.variantId,
            quantityChange: -item.quantity,
            previousStock: prev,
            newStock: prod.stockQuantity,
            reason: 'sale',
            orderId: order.id,
            notes: `Finalized pickup at counter for order ${order.orderNumber}`,
            actorId,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Record history entry
    order.statusHistory.unshift({
      id: `hist-${Date.now()}`,
      orderId: order.id,
      fromStatus: previousStatus,
      toStatus: nextStatus,
      note: note || `Status transitioned to ${nextStatus}`,
      changedBy: actorId,
      createdAt: new Date().toISOString(),
    });

    // Customer notification
    let notifTitle = `Order Update: ${nextStatus}`;
    let notifMessage = `Your order ${order.orderNumber} status changed to ${nextStatus}.`;
    if (nextStatus === 'CONFIRMED') {
      notifTitle = 'Order Confirmed by Jainam Traders';
      notifMessage = `We have confirmed your order ${order.orderNumber} and started assembling your items.`;
    } else if (nextStatus === 'READY_FOR_PICKUP') {
      notifTitle = 'Your Order is Ready for Pickup!';
      notifMessage = `Order ${order.orderNumber} is packed and ready at our counter. Please visit during store hours (07:30 - 21:30) to collect and pay.`;
    } else if (nextStatus === 'PICKED_UP') {
      notifTitle = 'Order Picked Up & Paid';
      notifMessage = `Thank you for shopping with Jainam Traders! We hope you love your purchase.`;
    } else if (nextStatus === 'CANCELLED') {
      notifTitle = 'Order Reservation Cancelled';
      notifMessage = `Your reservation ${order.orderNumber} has been cancelled. Reserved inventory was released back to the store.`;
    } else if (nextStatus === 'EXPIRED') {
      notifTitle = 'Pickup Reservation Expired';
      notifMessage = `Your pickup reservation ${order.orderNumber} has expired. Reserved inventory was released back to the store.`;
    }

    storeDb.notifications.unshift({
      id: `notif-${Date.now()}`,
      customerId: order.customerId,
      title: notifTitle,
      message: notifMessage,
      linkUrl: `/orders/${order.orderNumber}`,
      isRead: false,
      notificationType: 'order',
      createdAt: new Date().toISOString(),
    });

    storeDb.logAudit(actorId, actorRole, 'TRANSITION_ORDER_STATUS', 'orders', order.id, {
      fromStatus: previousStatus,
      toStatus: nextStatus,
      note,
    });

    return order;
  });
}

/**
 * Update internal admin notes for an order
 */
export async function updateOrderAdminNotes(
  orderId: string,
  adminNotes: string,
  actorRole: UserRole,
  actorId?: string
): Promise<Order> {
  const order = storeDb.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) throw new Error('Order not found');

  order.adminNotes = adminNotes;
  order.updatedAt = new Date().toISOString();

  storeDb.logAudit(actorId, actorRole, 'UPDATE_ORDER_NOTES', 'orders', order.id, {
    orderNumber: order.orderNumber,
    adminNotes,
  });

  return order;
}

/**
 * 7. ORDER QUERY METHODS
 */
export async function getOrders(params?: { customerId?: string; status?: OrderStatus; search?: string }): Promise<Order[]> {
  let list = storeDb.orders;
  if (params?.customerId) {
    list = list.filter((o) => o.customerId === params.customerId);
  }
  if (params?.status) {
    list = list.filter((o) => o.status === params.status);
  }
  if (params?.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q)
    );
  }
  return list;
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  return storeDb.orders.find((o) => o.orderNumber === orderNumber || o.id === orderNumber) || null;
}

export async function getOrderByQrToken(qrToken: string): Promise<Order | null> {
  return storeDb.orders.find((o) => o.qrToken === qrToken) || null;
}

/**
 * 8. RETURNS & PHYSICAL REFUND RECORDS (Cash / UPI Store Ledger)
 */
export interface CreateReturnRequestParams {
  orderId: string;
  customerId: string;
  productId: string;
  quantity: number;
  reason: string;
  description?: string;
  images?: string[];
}

export async function submitReturnRequest(params: CreateReturnRequestParams): Promise<ReturnRequest> {
  const order = storeDb.orders.find((o) => o.id === params.orderId || o.orderNumber === params.orderId);
  if (!order) throw new Error('Order not found');
  if (order.customerId !== params.customerId) throw new Error('Unauthorized');
  if (order.status !== 'PICKED_UP') {
    throw new Error('Returns can only be requested for orders that have already been picked up from the store.');
  }

  const product = storeDb.products.find((p) => p.id === params.productId);

  const req: ReturnRequest = {
    id: `ret-${Date.now()}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerId: params.customerId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    productId: params.productId,
    productName: product?.name || 'Unknown item',
    quantity: params.quantity,
    reason: params.reason,
    description: params.description,
    images: params.images || [],
    status: 'RETURN_REQUESTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  storeDb.returnRequests.unshift(req);
  order.status = 'RETURN_REQUESTED';

  storeDb.logAudit(params.customerId, 'customer', 'SUBMIT_RETURN_REQUEST', 'return_requests', req.id, {
    orderNumber: order.orderNumber,
    reason: params.reason,
  });

  return req;
}

export async function processReturnDecision(
  returnRequestId: string,
  decision: 'RETURN_APPROVED' | 'RETURN_REJECTED' | 'RETURNED',
  adminNotes: string,
  actorId: string
): Promise<ReturnRequest> {
  const req = storeDb.returnRequests.find((r) => r.id === returnRequestId);
  if (!req) throw new Error('Return request not found');

  req.status = decision;
  req.adminDecisionNotes = adminNotes;
  req.decidedBy = actorId;
  req.updatedAt = new Date().toISOString();

  const order = storeDb.orders.find((o) => o.id === req.orderId);
  if (order) {
    order.status = decision;
  }

  // Notify customer
  storeDb.notifications.unshift({
    id: `notif-${Date.now()}`,
    customerId: req.customerId,
    title: `Return Request ${decision === 'RETURN_APPROVED' ? 'Approved' : decision === 'RETURN_REJECTED' ? 'Rejected' : 'Item Received'}`,
    message:
      decision === 'RETURN_APPROVED'
        ? `Your return request for order ${order?.orderNumber} has been approved. Please bring the product to Jainam Traders for inspection.`
        : adminNotes,
    linkUrl: `/orders/${order?.orderNumber}`,
    isRead: false,
    notificationType: 'return',
    createdAt: new Date().toISOString(),
  });

  storeDb.logAudit(actorId, 'admin', 'PROCESS_RETURN', 'return_requests', req.id, { decision, adminNotes });
  return req;
}

export async function recordPhysicalRefund(
  orderId: string,
  returnRequestId: string | undefined,
  refundAmount: number,
  refundMethod: RefundMethod,
  receiptNumber: string,
  notes: string,
  staffId: string,
  staffName: string,
  idempotencyKey?: string
): Promise<RefundRecord> {
  const order = storeDb.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) throw new Error('Order not found');

  // 1. Idempotency Check: if refund with this idempotencyKey or receiptNumber already exists, return existing
  if (idempotencyKey) {
    const existingByIdempotency = storeDb.refundRecords.find((r) => r.idempotencyKey === idempotencyKey);
    if (existingByIdempotency) return existingByIdempotency;
  }
  const existingByReceipt = storeDb.refundRecords.find((r) => r.receiptNumber === receiptNumber && r.orderId === order.id);
  if (existingByReceipt) return existingByReceipt;

  const maxCashPaid = order.netPayableAtCounter ?? order.totalAmount;
  if ((refundMethod === 'cash' || refundMethod === 'upi') && refundAmount > maxCashPaid) {
    throw new Error(
      `Cash/UPI refund amount (₹${refundAmount}) cannot exceed the customer's actual counter payment (₹${maxCashPaid}). If a gift code was used, the gift code balance must be restored.`
    );
  }

  // Side effect: If order had a redeemed gift code, restore balance back to gift code (Part 29)
  // Enforce idempotency: only restore if not already restored for this order
  const alreadyRestored = storeDb.giftCodeRedemptions.some(
    (r) => (r.orderId === order.id || r.orderNumber === order.orderNumber) && r.action === 'RESTORED'
  );

  if (!alreadyRestored && (order.giftCodeId || order.giftCode)) {
    const redemptions = storeDb.giftCodeRedemptions.filter(
      (r) => (r.orderId === order.id || r.orderNumber === order.orderNumber) && r.action === 'REDEEMED'
    );
    for (const red of redemptions) {
      const gift = storeDb.giftCodes.find((g) => g.id === red.giftCodeId);
      if (gift) {
        const prev = gift.remainingValue;
        const restoredAmt = Math.min(gift.originalValue - prev, red.amountApplied);
        if (restoredAmt > 0) {
          gift.remainingValue = prev + restoredAmt;
          gift.redemptionCount = Math.max(0, gift.redemptionCount - 1);
          if (gift.status === 'REDEEMED') gift.status = 'ACTIVE';
          gift.updatedAt = new Date().toISOString();

          storeDb.giftCodeRedemptions.unshift({
            id: `rest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            giftCodeId: gift.id,
            code: gift.maskedCode,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId: red.customerId,
            customerName: red.customerName,
            amountApplied: restoredAmt,
            previousRemainingValue: prev,
            newRemainingValue: gift.remainingValue,
            action: 'RESTORED',
            actorId: staffId,
            actorRole: 'staff',
            reason: `Restored on return/refund for order ${order.orderNumber}`,
            idempotencyKey: `ref-rest-${order.id}-${gift.id}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  const record: RefundRecord = {
    id: `ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    returnRequestId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    refundAmount,
    refundMethod,
    receiptNumber,
    notes,
    recordedBy: staffId,
    staffName,
    idempotencyKey,
    createdAt: new Date().toISOString(),
  };

  storeDb.refundRecords.unshift(record);
  order.status = 'REFUND_RECORDED';
  order.paymentStatus = 'REFUNDED';

  if (returnRequestId) {
    const req = storeDb.returnRequests.find((r) => r.id === returnRequestId);
    if (req) req.status = 'REFUND_RECORDED';
  }

  // Record customer activity
  storeDb.customerActivity.unshift({
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    customerId: order.customerId,
    eventType: 'REFUND_RECORDED',
    description: `Refund of ₹${refundAmount} recorded via ${refundMethod.toUpperCase()} (Receipt: ${receiptNumber}).`,
    actorId: staffId,
    actorRole: 'staff',
    createdAt: new Date().toISOString(),
  });

  storeDb.logAudit(staffId, 'store_manager', 'RECORD_REFUND', 'refund_records', record.id, {
    refundAmount,
    refundMethod,
    receiptNumber,
    orderNumber: order.orderNumber,
  });

  return record;
}

export async function getReturnRequests(): Promise<ReturnRequest[]> {
  return storeDb.returnRequests;
}

export async function getRefundRecords(): Promise<RefundRecord[]> {
  return storeDb.refundRecords;
}

/**
 * 9. VERIFIED REVIEWS (Only for customers who picked up the product)
 */
export async function getProductReviews(productId: string): Promise<Review[]> {
  return storeDb.reviews.filter((r) => r.productId === productId && r.status === 'approved');
}

export async function submitProductReview(
  productId: string,
  customerId: string,
  customerName: string,
  orderNumber: string,
  rating: number,
  title: string,
  comment: string,
  images: string[] = []
): Promise<Review> {
  // Verify purchase: customer must have an order with this product in 'PICKED_UP' or return state
  const verifiedOrder = storeDb.orders.find(
    (o) =>
      o.customerId === customerId &&
      (o.orderNumber === orderNumber || o.id === orderNumber) &&
      (o.status === 'PICKED_UP' || o.status === 'RETURNED' || o.status === 'REFUND_RECORDED') &&
      o.items.some((i) => i.productId === productId)
  );

  if (!verifiedOrder) {
    throw new Error(
      'Verified Purchase Required: Only customers who have physically collected and paid for this item at Jainam Traders can submit a review.'
    );
  }

  // Prevent duplicate review for same order & product
  const existing = storeDb.reviews.find(
    (r) => r.customerId === customerId && r.productId === productId && r.orderId === verifiedOrder.orderNumber
  );
  if (existing) {
    throw new Error('You have already submitted a review for this purchase.');
  }

  const prod = storeDb.products.find((p) => p.id === productId);

  const review: Review = {
    id: `rev-${Date.now()}`,
    productId,
    productName: prod?.name,
    customerId,
    customerName,
    orderId: verifiedOrder.orderNumber,
    rating,
    title,
    comment,
    images,
    isVerifiedPurchase: true,
    status: 'approved', // Auto-approved or moderation queue
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  storeDb.reviews.unshift(review);

  // Recalculate average rating on product
  const allApproved = storeDb.reviews.filter((r) => r.productId === productId && r.status === 'approved');
  const avg = allApproved.reduce((acc, r) => acc + r.rating, 0) / allApproved.length;
  if (prod) {
    prod.averageRating = Math.round(avg * 10) / 10;
    prod.reviewCount = allApproved.length;
  }

  return review;
}

export async function getAdminReviews(): Promise<Review[]> {
  return storeDb.reviews;
}

export async function moderateReview(reviewId: string, status: 'approved' | 'rejected', actorId: string): Promise<Review> {
  const r = storeDb.reviews.find((item) => item.id === reviewId);
  if (!r) throw new Error('Review not found');
  r.status = status;
  r.updatedAt = new Date().toISOString();
  storeDb.logAudit(actorId, 'admin', 'MODERATE_REVIEW', 'reviews', reviewId, { status });
  return r;
}

/**
 * 10. NOTIFICATIONS
 */
export async function getCustomerNotifications(customerId: string): Promise<AppNotification[]> {
  return storeDb.notifications.filter((n) => n.customerId === customerId);
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const n = storeDb.notifications.find((notif) => notif.id === id);
  if (n) n.isRead = true;
}

/**
 * 11. IN-APP SUPPORT & AI ASSISTANT RETRIEVAL
 */
export async function getSupportConversations(customerId?: string): Promise<SupportConversation[]> {
  if (customerId) {
    return storeDb.supportConversations.filter((c) => c.customerId === customerId);
  }
  return storeDb.supportConversations;
}

export async function sendSupportMessage(
  conversationId: string | null,
  customerId: string,
  customerName: string,
  customerPhone: string,
  message: string,
  senderRole: UserRole,
  orderId?: string
): Promise<{ conversation: SupportConversation; message: SupportMessage }> {
  let conv = conversationId ? storeDb.supportConversations.find((c) => c.id === conversationId) : null;

  if (!conv) {
    conv = {
      id: `conv-${Date.now()}`,
      customerId,
      customerName,
      customerPhone,
      orderId,
      status: 'OPEN',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storeDb.supportConversations.unshift(conv);
  }

  const msg: SupportMessage = {
    id: `msg-${Date.now()}`,
    conversationId: conv.id,
    senderId: customerId,
    senderRole,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  conv.messages.push(msg);
  conv.updatedAt = new Date().toISOString();

  return { conversation: conv, message: msg };
}

/**
 * AI Tool Calling Engine for customer support questions
 * (Rule 30: AI retrieves real data and NEVER invents stock, prices, or store hours)
 */
export async function executeAiSupportTool(
  toolName: string,
  args: Record<string, string | number | undefined>
): Promise<string> {
  switch (toolName) {
    case 'get_shop_information': {
      const s = storeDb.settings;
      return JSON.stringify({
        shopName: s.shopName,
        address: s.shopAddress,
        openingTime: s.openingTime,
        closingTime: s.closingTime,
        weeklyClosedDays: s.weeklyClosedDays,
        phone: s.phone,
        whatsapp: s.whatsappNumber,
        pickupInstructions: s.pickupInstructions,
        googleMaps: s.googleMapsUrl,
      });
    }

    case 'search_products': {
      const q = String(args.query || '');
      const results = storeDb.products
        .filter((p) => p.isActive && p.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 5)
        .map((p) => ({
          name: p.name,
          price: `₹${p.price}`,
          mrp: `₹${p.mrp}`,
          availability: p.stockQuantity - p.reservedStock > 0 ? 'Available for pickup' : 'Currently Out of Stock',
          category: p.categoryName,
        }));
      return JSON.stringify(results);
    }

    case 'get_product_availability': {
      const slug = String(args.slug || args.productName || '').toLowerCase();
      const p = storeDb.products.find(
        (prod) => prod.slug.includes(slug) || prod.name.toLowerCase().includes(slug)
      );
      if (!p) return JSON.stringify({ error: 'Product not found in Jainam Traders catalogue' });
      const available = p.stockQuantity - p.reservedStock;
      return JSON.stringify({
        productName: p.name,
        price: `₹${p.price}`,
        availableForPickup: available > 0,
        status: available > 0 ? 'Available for pickup' : 'Currently Unavailable',
      });
    }

    case 'get_order_status': {
      const orderNumber = String(args.orderNumber || '');
      const order = storeDb.orders.find((o) => o.orderNumber === orderNumber);
      if (!order) return JSON.stringify({ error: `Order ${orderNumber} not found` });
      return JSON.stringify({
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: `₹${order.totalAmount}`,
        pickupMode: order.pickupMode,
        createdAt: order.createdAt,
      });
    }

    case 'get_return_policy': {
      return JSON.stringify({
        policy:
          'Customers may return products at our physical store counter within 7 days of pickup with original packaging and receipt/order ID. Refunds are issued in Cash or UPI directly at the counter after inspection.',
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool ${toolName}` });
  }
}

/**
 * 12. COUPONS & OFFERS ADMIN
 */
export async function getCoupons(): Promise<Coupon[]> {
  return storeDb.coupons;
}

export async function createCoupon(coupon: Omit<Coupon, 'id' | 'usedCount'>, actorId?: string): Promise<Coupon> {
  const newCoupon: Coupon = {
    ...coupon,
    id: `coup-${Date.now()}`,
    usedCount: 0,
  };
  storeDb.coupons.unshift(newCoupon);
  storeDb.logAudit(actorId, 'admin', 'CREATE_COUPON', 'coupons', newCoupon.id, { code: newCoupon.code });
  return newCoupon;
}

export async function getOffers(): Promise<Offer[]> {
  return storeDb.offers.filter((o) => o.isActive);
}

/**
 * 13. AUDIT LOGS & ANALYTICS
 */
export async function getAuditLogs(): Promise<AuditLog[]> {
  return storeDb.auditLogs;
}

export async function getInventoryMovements(): Promise<InventoryMovement[]> {
  return storeDb.inventoryMovements;
}

export async function getDashboardAnalytics(): Promise<{
  totalOrders: number;
  todaysOrders: number;
  pendingOrders: number;
  readyForPickup: number;
  pickedUpToday: number;
  totalSalesValue: number;
  lowStockCount: number;
  returnRequestsCount: number;
  totalProducts: number;
  recentOrders: Order[];
}> {
  const todayStr = new Date().toISOString().split('T')[0];
  const todaysOrders = storeDb.orders.filter((o) => o.createdAt.startsWith(todayStr));
  const pickedUpToday = todaysOrders.filter((o) => o.status === 'PICKED_UP');

  const pendingOrders = storeDb.orders.filter((o) => o.status === 'PENDING').length;
  const readyForPickup = storeDb.orders.filter((o) => o.status === 'READY_FOR_PICKUP').length;
  const lowStockCount = storeDb.products.filter(
    (p) => p.stockQuantity - p.reservedStock <= p.lowStockThreshold
  ).length;

  const totalSalesValue = storeDb.orders
    .filter((o) => o.status === 'PICKED_UP')
    .reduce((acc, o) => acc + o.totalAmount, 0);

  return {
    totalOrders: storeDb.orders.length,
    todaysOrders: todaysOrders.length,
    pendingOrders,
    readyForPickup,
    pickedUpToday: pickedUpToday.length,
    totalSalesValue,
    lowStockCount,
    returnRequestsCount: storeDb.returnRequests.filter((r) => r.status === 'RETURN_REQUESTED').length,
    totalProducts: storeDb.products.length,
    recentOrders: storeDb.orders.slice(0, 10),
  };
}

export interface RecordPaymentParams {
  orderId: string;
  amountReceived: number;
  paymentMethod: 'Cash' | 'UPI';
  staffId: string;
  staffRole: UserRole;
  notes?: string;
}

/**
 * Record Counter Payment (Cash or UPI) at Jainam Traders shop counter.
 * Pay at Shop is the authoritative payment method.
 */
export async function recordOrderPayment(params: RecordPaymentParams): Promise<Order> {
  return storeDb.withReservationLock(async () => {
    const order = storeDb.orders.find((o) => o.id === params.orderId || o.orderNumber === params.orderId);
    if (!order) {
      throw new Error(`Order ${params.orderId} not found`);
    }

    if (params.amountReceived <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const currentReceived = order.amountReceived || 0;
    const newTotalReceived = currentReceived + params.amountReceived;
    const totalPayable = order.totalAmount;

    let newStatus: PaymentStatus = 'PARTIALLY_PAID';
    if (newTotalReceived >= totalPayable) {
      newStatus = 'PAID';
    }

    order.amountReceived = newTotalReceived;
    order.amountDue = Math.max(0, totalPayable - newTotalReceived);
    order.paymentStatus = newStatus;
    order.paymentRecordedAt = new Date().toISOString();
    order.paymentRecordedBy = params.staffId;
    order.updatedAt = new Date().toISOString();

    storeDb.logAudit(params.staffId, params.staffRole, 'RECORD_COUNTER_PAYMENT', 'orders', order.id, {
      orderNumber: order.orderNumber,
      amountRecorded: params.amountReceived,
      newTotalReceived,
      amountDue: order.amountDue,
      paymentMethod: params.paymentMethod,
      paymentStatus: newStatus,
      notes: params.notes,
    });

    return order;
  });
}

/**
 * Server-side cleanup mechanism/cron-safe function for expired reservations.
 * Finds PENDING and CONFIRMED orders whose reservationExpiresAt has passed,
 * releases reserved inventory back to catalogue, and restores any gift codes.
 */
export async function cleanupExpiredReservations(actorId: string = 'system_cron'): Promise<{
  expiredCount: number;
  expiredOrderNumbers: string[];
}> {
  const now = new Date();
  const expiredOrders = storeDb.orders.filter((o) => {
    if (o.status !== 'PENDING' && o.status !== 'CONFIRMED') return false;
    if (!o.reservationExpiresAt) return false;
    return new Date(o.reservationExpiresAt) <= now;
  });

  const expiredOrderNumbers: string[] = [];

  for (const order of expiredOrders) {
    await transitionOrderStatus(
      order.id,
      'EXPIRED',
      'admin',
      actorId,
      'Auto-expired by reservation cleanup: pickup deadline elapsed without confirmation/collection'
    );
    expiredOrderNumbers.push(order.orderNumber);
  }

  return {
    expiredCount: expiredOrderNumbers.length,
    expiredOrderNumbers,
  };
}

