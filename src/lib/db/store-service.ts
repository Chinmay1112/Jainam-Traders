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
} from '@/lib/types';
import { INITIAL_CATEGORIES, INITIAL_COUPONS, INITIAL_OFFERS, INITIAL_PRODUCTS, INITIAL_SHOP_SETTINGS } from './initial-data';
import { canTransitionOrder } from '@/lib/orders/state-machine';
import { calculateOrderPricing, RawCheckoutItem, ValidatedItem } from '@/lib/pricing/engine';
import {
  normalizeStockNumber,
  normalizeProductInventory,
  calculateStockAdjustment,
} from '@/lib/inventory/normalizer';

// Global in-memory storage for high-concurrency local development & automated test execution
class StoreDataStore {
  public settings: ShopSettings = { ...INITIAL_SHOP_SETTINGS };
  public categories: Category[] = [...INITIAL_CATEGORIES];
  public products: Product[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
  public coupons: Coupon[] = JSON.parse(JSON.stringify(INITIAL_COUPONS));
  public offers: Offer[] = JSON.parse(JSON.stringify(INITIAL_OFFERS));
  public orders: Order[] = [];
  public returnRequests: ReturnRequest[] = [];
  public refundRecords: RefundRecord[] = [];
  public reviews: Review[] = [];
  public notifications: AppNotification[] = [];
  public supportConversations: SupportConversation[] = [];
  public inventoryMovements: InventoryMovement[] = [];
  public auditLogs: AuditLog[] = [];
  private orderCounter: number = 100;

  // Concurrency mutex lock to prevent race conditions during inventory reservation
  private reservationLock: Promise<void> = Promise.resolve();

  constructor() {
    this.seedInitialReviews();
  }

  private seedInitialReviews() {
    this.reviews = [
      {
        id: 'rev-001',
        productId: 'c0000000-0000-0000-0000-000000000001',
        productName: 'Handcrafted Rosewood 8x10 Photo Frame',
        customerId: 'cust-demo-1',
        customerName: 'Rajesh K. Mehta',
        orderId: 'JT-2026-000095',
        rating: 5,
        title: 'Outstanding quality Sheesham wood!',
        comment:
          'Picked up from the Main Bazar shop. The wood carving and glass finish are top-notch. Much better than online pictures!',
        isVerifiedPurchase: true,
        status: 'approved',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        id: 'rev-002',
        productId: 'c0000000-0000-0000-0000-000000000004',
        productName: 'Silent Sweep 12-inch Wooden Wall Clock',
        customerId: 'cust-demo-2',
        customerName: 'Priya Sharma',
        orderId: 'JT-2026-000096',
        rating: 5,
        title: 'Truly noiseless and beautiful dial',
        comment:
          'Completely silent sweep, perfect for bedroom. Store staff tested the quartz battery right before giving it to me at the counter.',
        isVerifiedPurchase: true,
        status: 'approved',
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
    ];
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stockQuantity, reservedStock, lowStockThreshold, ...safeProduct } = product;

  return {
    ...safeProduct,
    availability,
  };
}

export async function getCustomerProducts(params: ProductFilterParams = {}): Promise<{
  products: CustomerProductView[];
  total: number;
}> {
  let list = storeDb.products.filter((p) => p.isActive && !p.isArchived && p.status !== 'archived');

  // Category filter
  if (params.categorySlug) {
    const category = storeDb.categories.find((c) => c.slug === params.categorySlug);
    if (category) {
      list = list.filter((p) => p.categoryId === category.id);
    }
  }

  // Search query with basic typo tolerance and SKU/tag/brand matching
  if (params.query && params.query.trim()) {
    const q = params.query.toLowerCase().trim().replace(/[\s-_]+/g, '');
    list = list.filter((p) => {
      const nameMatch = p.name.toLowerCase().replace(/[\s-_]+/g, '').includes(q);
      const skuMatch = p.sku.toLowerCase().includes(q);
      const brandMatch = p.brand.toLowerCase().includes(q);
      const tagMatch = p.tags.some((t) => t.toLowerCase().replace(/[\s-_]+/g, '').includes(q));
      const descMatch = p.shortDescription?.toLowerCase().includes(q);
      return nameMatch || skuMatch || brandMatch || tagMatch || descMatch;
    });
  }

  // Price range
  if (params.minPrice !== undefined) {
    list = list.filter((p) => p.price >= params.minPrice!);
  }
  if (params.maxPrice !== undefined) {
    list = list.filter((p) => p.price <= params.maxPrice!);
  }

  // Badges
  if (params.featured) list = list.filter((p) => p.isFeatured);
  if (params.newArrival) list = list.filter((p) => p.isNewArrival);
  if (params.bestSeller) list = list.filter((p) => p.isBestSeller);

  // Sorting
  if (params.sort) {
    switch (params.sort) {
      case 'price_asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'newest':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      default:
        break;
    }
  }

  const total = list.length;
  const offset = params.offset || 0;
  const limit = params.limit || 50;
  const paginated = list.slice(offset, offset + limit);

  return {
    products: paginated.map(toCustomerProductView),
    total,
  };
}

export async function getProductBySlug(slug: string): Promise<CustomerProductView | null> {
  const p = storeDb.products.find(
    (prod) => prod.slug === slug && prod.isActive && !prod.isArchived && prod.status !== 'archived'
  );
  if (!p) return null;
  return toCustomerProductView(p);
}

export async function getRawProductById(id: string): Promise<Product | null> {
  return storeDb.products.find((prod) => prod.id === id) || null;
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
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'discountPercentage'>,
  actorId?: string
): Promise<Product> {
  if (!data.name || !data.name.trim()) throw new Error('Product name is required');
  if (!data.sku || !data.sku.trim()) throw new Error('Product SKU is required');
  if (data.price <= 0) throw new Error('Selling price must be greater than zero');
  if (data.mrp < data.price) throw new Error('Selling price cannot exceed MRP');

  const discountPct = data.mrp > 0 ? Math.round(((data.mrp - data.price) / data.mrp) * 100) : 0;
  const initialStock = normalizeStockNumber(data.stockQuantity, 0);
  const lowStockThreshold = normalizeStockNumber(data.lowStockThreshold, 3);
  const status = data.status || 'published';
  const isArchived = status === 'archived' || Boolean(data.isArchived);
  const isActive = isArchived ? false : data.isActive !== undefined ? data.isActive : true;

  const newProduct: Product = {
    ...data,
    id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    discountPercentage: discountPct,
    stockQuantity: initialStock,
    reservedStock: 0,
    lowStockThreshold,
    status,
    isArchived,
    isActive,
    thumbnailUrl: data.thumbnailUrl || '/images/product-placeholder.svg',
    images: data.images && data.images.length > 0 ? data.images : [data.thumbnailUrl || '/images/product-placeholder.svg'],
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
    initialStock,
    price: newProduct.price,
    mrp: newProduct.mrp,
  });

  return newProduct;
}

export async function updateAdminProduct(
  id: string,
  updates: Partial<Product>,
  actorId?: string
): Promise<Product> {
  const index = storeDb.products.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Product not found');

  const existing = storeDb.products[index];

  // Price validation: selling price must not exceed MRP
  const finalPrice = updates.price !== undefined ? updates.price : existing.price;
  const finalMrp = updates.mrp !== undefined ? updates.mrp : existing.mrp;
  if (finalPrice <= 0) throw new Error('Selling price must be greater than 0');
  if (finalPrice > finalMrp) throw new Error(`Selling price (₹${finalPrice}) cannot exceed MRP (₹${finalMrp})`);

  // Protect inventory from direct edits: stock must be changed via adjust stock
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { reservedStock, stockQuantity, ...safeUpdates } = updates;

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

  const discountPercentage =
    finalMrp > 0 ? Math.round(((finalMrp - finalPrice) / finalMrp) * 100) : 0;

  const updated: Product = {
    ...existing,
    ...safeUpdates,
    price: finalPrice,
    mrp: finalMrp,
    discountPercentage,
    status,
    isArchived,
    isActive,
    updatedAt: new Date().toISOString(),
  };

  storeDb.products[index] = updated;
  storeDb.logAudit(actorId, 'admin', 'UPDATE_PRODUCT', 'products', id, {
    name: updated.name,
    sku: updated.sku,
    price: updated.price,
    mrp: updated.mrp,
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
  items: RawCheckoutItem[];
  couponCode?: string;
  pickupMode: 'FLEXIBLE' | 'SLOT';
  pickupSlotDate?: string;
  pickupSlotTime?: string;
  customerNotes?: string;
}

export async function createPickupOrder(params: CreateOrderParams): Promise<Order> {
  // Execute within concurrency reservation lock to guarantee no double-booking of last unit
  return storeDb.withReservationLock(async () => {
    if (!params.items || params.items.length === 0) {
      throw new Error('Order must contain at least one item');
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

    // 2. Validate Coupon and calculate pricing server-side
    let coupon: Coupon | undefined = undefined;
    if (params.couponCode) {
      coupon = storeDb.coupons.find((c) => c.code.toUpperCase() === params.couponCode!.toUpperCase());
    }

    const previousOrdersCount = storeDb.orders.filter((o) => o.customerId === params.customerId).length;
    const isFirstOrder = previousOrdersCount === 0;

    const pricing = calculateOrderPricing(validatedItems, coupon, isFirstOrder);

    // 3. Atomically Reserve Inventory
    for (const item of params.items) {
      const prod = storeDb.products.find((p) => p.id === item.productId)!;
      if (item.variantId) {
        const variant = prod.variants?.find((v) => v.id === item.variantId)!;
        variant.reservedStock += item.quantity;
      } else {
        prod.reservedStock += item.quantity;
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

    // 4. Update coupon usage count if applied
    if (pricing.appliedCoupon) {
      const cIndex = storeDb.coupons.findIndex((c) => c.id === pricing.appliedCoupon!.id);
      if (cIndex !== -1) {
        storeDb.coupons[cIndex].usedCount += 1;
      }
    }

    const orderNumber = storeDb.generateNextOrderNumber();
    const qrToken = `JT-QR-${orderNumber}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const order: Order = {
      id: `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orderNumber,
      customerId: params.customerId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      paymentMethod: 'Pay at Shop',
      subtotal: pricing.subtotal,
      discount: pricing.couponDiscount,
      totalAmount: pricing.finalPayableAmount,
      couponCode: pricing.appliedCoupon?.code,
      pickupMode: params.pickupMode,
      pickupSlotDate: params.pickupSlotDate,
      pickupSlotTime: params.pickupSlotTime,
      customerNotes: params.customerNotes,
      qrToken,
      items: validatedItems.map((v) => ({
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: '',
        productId: v.productId,
        variantId: v.variantId,
        productName: v.productName,
        variantName: v.variantName,
        unitPrice: v.unitPrice,
        quantity: v.quantity,
        totalPrice: v.totalPrice,
        thumbnailUrl: v.thumbnailUrl,
      })),
      statusHistory: [
        {
          id: `hist-${Date.now()}`,
          orderId: '',
          toStatus: 'PENDING',
          note: 'Order placed by customer for pickup at Jainam Traders counter.',
          changedBy: params.customerId,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Link back IDs
    order.items.forEach((item) => (item.orderId = order.id));
    order.statusHistory.forEach((h) => (h.orderId = order.id));

    storeDb.orders.unshift(order);

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

    // Side effect 1: If CANCELLED, release reserved stock back to available pool
    if (nextStatus === 'CANCELLED') {
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
            notes: `Released reservation upon order cancellation (${order.orderNumber})`,
            actorId,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Side effect 2: If PICKED_UP, finalize deduction (decrement stockQuantity and reservedStock) & mark PAID
    if (nextStatus === 'PICKED_UP') {
      order.paymentStatus = 'PAID';
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
      notifMessage = `Order ${order.orderNumber} is packed and ready at our counter. Please visit during store hours (09:30 - 21:30) to collect and pay.`;
    } else if (nextStatus === 'PICKED_UP') {
      notifTitle = 'Order Picked Up & Paid';
      notifMessage = `Thank you for shopping with Jainam Traders! We hope you love your purchase.`;
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
  staffName: string
): Promise<RefundRecord> {
  const order = storeDb.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) throw new Error('Order not found');

  const record: RefundRecord = {
    id: `ref-${Date.now()}`,
    returnRequestId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    refundAmount,
    refundMethod,
    receiptNumber,
    notes,
    recordedBy: staffId,
    staffName,
    createdAt: new Date().toISOString(),
  };

  storeDb.refundRecords.unshift(record);
  order.status = 'REFUND_RECORDED';
  order.paymentStatus = 'REFUNDED';

  if (returnRequestId) {
    const req = storeDb.returnRequests.find((r) => r.id === returnRequestId);
    if (req) req.status = 'REFUND_RECORDED';
  }

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
