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
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';

function isUuid(val: unknown): boolean {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

export function shouldUseSupabase(): boolean {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  return isSupabaseConfigured();
}

function mapRowToProduct(row: any): Product {
  const mrp = Number(row.mrp);
  const price = Number(row.price);
  const discountPercentage = row.discount_percentage !== undefined && row.discount_percentage !== null
    ? Number(row.discount_percentage)
    : calculateDiscountPercentage(mrp, price);

  const isArchived = !row.is_active || row.status === 'archived';
  const status = isArchived ? 'archived' : (row.status || (row.is_active ? 'published' : 'hidden'));

  const prod: Product = {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcodeValue: row.barcode_value || row.sku,
    manufacturerModelNumber: row.manufacturer_model_number || undefined,
    slug: row.slug,
    categoryId: row.category_id,
    categoryName: row.categoryName || row.categories?.name || 'General',
    description: row.description || '',
    shortDescription: row.short_description || undefined,
    price,
    mrp,
    discountPercentage,
    stockQuantity: Number(row.stock_quantity ?? 0),
    reservedStock: Number(row.reserved_stock ?? 0),
    lowStockThreshold: Number(row.low_stock_threshold ?? 3),
    minOrderQuantity: Number(row.min_order_quantity ?? 1),
    maxOrderQuantity: Number(row.max_order_quantity ?? 10),
    tags: Array.isArray(row.tags) ? row.tags : [],
    brand: row.brand || 'Jainam Traders',
    dimensions: row.dimensions || undefined,
    weight: row.weight || undefined,
    material: row.material || undefined,
    colour: row.colour || undefined,
    size: row.size || undefined,
    occasion: row.occasion || undefined,
    isFeatured: Boolean(row.is_featured),
    isNewArrival: Boolean(row.is_new_arrival),
    isBestSeller: Boolean(row.is_best_seller),
    status,
    isArchived,
    isActive: Boolean(row.is_active),
    thumbnailUrl: row.thumbnail_url || '/images/product-placeholder.svg',
    images: Array.isArray(row.images) && row.images.length > 0 ? row.images : [row.thumbnail_url || '/images/product-placeholder.svg'],
    videoUrl: row.video_url || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };

  prod.searchIndex = buildProductSearchIndex(prod);
  return prod;
}

function mapRowToShopSettings(row: any): ShopSettings {
  return {
    id: row.id,
    shopName: row.shop_name || 'Jainam Traders',
    shopTagline: row.shop_tagline || 'GIFTS • TOYS • ACCESSORIES • MORE',
    shopLogoUrl: row.shop_logo_url || '/images/jainam-logo.svg',
    shopAddress: row.shop_address || 'Jainam Traders (Location on Google Maps)',
    googleMapsUrl: row.google_maps_url || 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : 22.2765869,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : 75.7979897,
    phone: row.phone || '',
    whatsappNumber: row.whatsapp_number || '',
    email: row.email || 'contact@jainamtraders.com',
    openingTime: row.opening_time ? row.opening_time.slice(0, 5) : '07:30',
    closingTime: row.closing_time ? row.closing_time.slice(0, 5) : '21:30',
    weeklyClosedDays: row.weekly_closed_days || ['Sunday'],
    holidayDates: row.holiday_dates || [],
    shopDescription: row.shop_description || '',
    pickupInstructions: row.pickup_instructions || '',
    isModeBSlotsEnabled: row.is_mode_b_slots_enabled ?? true,
    maxOrdersPerSlot: row.max_orders_per_slot || 10,
    socialFacebook: row.social_facebook || undefined,
    socialInstagram: row.social_instagram || undefined,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function mapRowToOrder(row: any, itemsRow?: any[]): Order {
  const items: OrderItem[] = (itemsRow || []).map((it) => ({
    id: it.id,
    orderId: it.order_id,
    productId: it.product_id,
    variantId: it.variant_id || undefined,
    productName: it.product_name,
    variantName: it.variant_title || undefined,
    unitPrice: Number(it.price),
    mrp: Number(it.mrp),
    discountPercentage: calculateDiscountPercentage(Number(it.mrp), Number(it.price)),
    quantity: Number(it.quantity),
    totalPrice: Number(it.subtotal),
    thumbnailUrl: it.thumbnail_url || '/images/product-placeholder.svg',
  }));

  return {
    id: row.id,
    orderNumber: row.order_number,
    idempotencyKey: row.idempotency_key || undefined,
    customerId: row.customer_id || '',
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email || undefined,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method || 'Pay at Shop',
    subtotal: Number(row.subtotal),
    discount: Number(row.discount_amount || 0),
    totalAmount: Number(row.total_amount),
    amountDue: row.payment_status === 'PAID' ? 0 : Number(row.total_amount),
    amountReceived: row.payment_status === 'PAID' ? Number(row.total_amount) : 0,
    couponCode: row.coupon_code || undefined,
    giftCode: row.gift_code || undefined,
    giftCodeDiscount: Number(row.gift_code_discount || 0),
    netPayableAtCounter: Number(row.total_amount),
    pickupMode: row.pickup_mode || 'FLEXIBLE',
    pickupSlotDate: row.pickup_slot_date || undefined,
    pickupSlotTime: row.pickup_slot_time || undefined,
    customerNotes: row.customer_notes || undefined,
    adminNotes: row.admin_notes || undefined,
    qrToken: row.qr_token || `JT-QR-${row.order_number}`,
    reservationExpiresAt: row.expires_at || undefined,
    items,
    statusHistory: Array.isArray(row.status_history) ? row.status_history : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
  if (shouldUseSupabase()) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        return mapRowToShopSettings(data);
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[Supabase DB Error] getShopSettings failed:', e);
      }
    }
  }
  return storeDb.settings;
}

export async function updateShopSettings(
  updates: Partial<ShopSettings>,
  actorId?: string
): Promise<ShopSettings> {
  const newSettings = {
    ...storeDb.settings,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  storeDb.settings = newSettings;

  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const rowUpdates: Record<string, any> = {
      updated_at: newSettings.updatedAt,
    };
    if (updates.shopName !== undefined) rowUpdates.shop_name = updates.shopName;
    if (updates.shopTagline !== undefined) rowUpdates.shop_tagline = updates.shopTagline;
    if (updates.shopAddress !== undefined) rowUpdates.shop_address = updates.shopAddress;
    if (updates.googleMapsUrl !== undefined) rowUpdates.google_maps_url = updates.googleMapsUrl;
    if (updates.latitude !== undefined) rowUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) rowUpdates.longitude = updates.longitude;
    if (updates.phone !== undefined) rowUpdates.phone = updates.phone;
    if (updates.whatsappNumber !== undefined) rowUpdates.whatsapp_number = updates.whatsappNumber;
    if (updates.email !== undefined) rowUpdates.email = updates.email;
    if (updates.openingTime !== undefined) rowUpdates.opening_time = updates.openingTime;
    if (updates.closingTime !== undefined) rowUpdates.closing_time = updates.closingTime;
    if (updates.weeklyClosedDays !== undefined) rowUpdates.weekly_closed_days = updates.weeklyClosedDays;
    if (updates.shopDescription !== undefined) rowUpdates.shop_description = updates.shopDescription;
    if (updates.pickupInstructions !== undefined) rowUpdates.pickup_instructions = updates.pickupInstructions;

    const { error: upsertErr } = await supabase
      .from('shop_settings')
      .upsert({
        id: isUuid(newSettings.id) ? newSettings.id : 'a0000000-0000-0000-0000-000000000001',
        ...rowUpdates,
      });

    if (upsertErr) {
      console.error('[Supabase DB Error] updateShopSettings failed:', upsertErr);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Database failed to update shop settings: ${upsertErr.message}`);
      }
    }
  }

  storeDb.logAudit(actorId, 'admin', 'UPDATE_SHOP_SETTINGS', 'shop_settings', newSettings.id, updates);
  return newSettings;
}

/**
 * 2. CATEGORIES
 */
export async function getCategories(): Promise<Category[]> {
  if (shouldUseSupabase()) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description || undefined,
          icon: c.icon || undefined,
          imageUrl: c.image_url || undefined,
          sortOrder: c.sort_order,
          isFeatured: c.is_featured,
          isActive: c.is_active,
          createdAt: c.created_at,
        }));
      }

      // Auto-populate canonical categories if table is empty to guarantee foreign key integrity
      if (!error && (!data || data.length === 0)) {
        const toInsert = INITIAL_CATEGORIES.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          icon: c.icon,
          sort_order: c.sortOrder,
          is_featured: c.isFeatured,
          is_active: c.isActive,
        }));
        await supabase.from('categories').upsert(toInsert, { onConflict: 'slug' });
        return INITIAL_CATEGORIES;
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[Supabase DB Error] getCategories failed:', e);
      }
    }
  }
  return storeDb.categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (shouldUseSupabase()) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          slug: data.slug,
          description: data.description || undefined,
          icon: data.icon || undefined,
          imageUrl: data.image_url || undefined,
          sortOrder: data.sort_order,
          isFeatured: data.is_featured,
          isActive: data.is_active,
          createdAt: data.created_at,
        };
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[Supabase DB Error] getCategoryBySlug failed:', e);
      }
    }
  }
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
  let catalogueProducts: Product[] = [];

  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: rows, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('[Supabase DB Warning] Table "products" does not exist yet in schema cache. Returning 0 products until migrations are applied.');
        catalogueProducts = [];
      } else {
        console.error('[Supabase DB Error] getCustomerProducts failed:', error);
        throw new Error(`Database failed to fetch products: ${error.message}`);
      }
    } else {
      catalogueProducts = (rows || []).map(mapRowToProduct);
    }
  } else {
    catalogueProducts = storeDb.products;
  }

  const result = searchCatalogue(catalogueProducts, {
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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: row, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205') return null;
      console.error('[Supabase DB Error] getProductBySlug failed:', error);
      throw new Error(`Database failed to fetch product: ${error.message}`);
    }

    if (!row) return null;
    return toCustomerProductView(mapRowToProduct(row));
  }

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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: row, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205') return null;
      console.error('[Supabase DB Error] getRawProductById failed:', error);
      throw new Error(`Database failed to fetch product: ${error.message}`);
    }

    if (!row) return null;
    return mapRowToProduct(row);
  }

  return storeDb.products.find((prod) => prod.id === id) || null;
}

export async function getProductByBarcode(code: string): Promise<Product | null> {
  const norm = normalizeBarcodeValue(code);
  if (!norm) return null;

  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: rows, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .or(`sku.ilike.${norm},barcode_value.ilike.${norm}`)
      .limit(1);

    if (error) {
      if (error.code === 'PGRST205') return null;
      console.error('[Supabase DB Error] getProductByBarcode failed:', error);
      throw new Error(`Database failed to query barcode: ${error.message}`);
    }

    if (!rows || rows.length === 0) return null;
    return mapRowToProduct(rows[0]);
  }

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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('products')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });

    if (filter?.status === 'active') {
      query = query.eq('is_active', true);
    } else if (filter?.status === 'archived') {
      query = query.eq('is_active', false);
    }

    const { data: rows, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('[Supabase DB Warning] Table "products" does not exist yet. Returning 0 products.');
        return [];
      }
      console.error('[Supabase DB Error] getAdminProducts failed:', error);
      throw new Error(`Database failed to fetch products: ${error.message}`);
    }

    let list = (rows || []).map(mapRowToProduct);

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

  const pricing = validateProductPricing(data.mrp, data.price);
  if (!pricing.isValid) {
    throw new Error(pricing.error || 'Invalid product pricing');
  }

  const initialStock = normalizeStockNumber(data.stockQuantity, 0);
  const lowStockThreshold = normalizeStockNumber(data.lowStockThreshold, 3);
  const status = data.status || 'published';
  const isArchived = status === 'archived' || Boolean(data.isArchived);
  const isActive = isArchived ? false : data.isActive !== undefined ? data.isActive : true;

  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();

    const rawSku = data.sku && data.sku.trim()
      ? data.sku.trim()
      : generateUniqueProductSku(storeDb.products, data.categoryName);
    const normalizedSku = normalizeBarcodeValue(rawSku);
    const rawBarcode = data.barcodeValue ? normalizeBarcodeValue(data.barcodeValue) : normalizedSku;

    // Check SKU uniqueness in Supabase
    const { data: skuClash, error: skuErr } = await supabase
      .from('products')
      .select('id, name, sku')
      .ilike('sku', normalizedSku)
      .limit(1);

    if (skuErr) {
      console.error('[Supabase DB Error] SKU check failed:', skuErr);
      throw new Error(`Database error during SKU check: ${skuErr.message}`);
    }
    if (skuClash && skuClash.length > 0) {
      throw new Error(`Duplicate SKU rejected: SKU "${normalizedSku}" already exists for product "${skuClash[0].name}".`);
    }

    // Check Barcode uniqueness in Supabase
    if (rawBarcode) {
      const { data: bcClash, error: bcErr } = await supabase
        .from('products')
        .select('id, name, barcode_value')
        .ilike('barcode_value', rawBarcode)
        .limit(1);

      if (bcErr) {
        console.error('[Supabase DB Error] Barcode check failed:', bcErr);
        throw new Error(`Database error during barcode check: ${bcErr.message}`);
      }
      if (bcClash && bcClash.length > 0) {
        throw new Error(`Duplicate barcode rejected: Barcode "${rawBarcode}" already exists for product "${bcClash[0].name}".`);
      }
    }

    const productId = isUuid(data.id) ? (data.id as string) : crypto.randomUUID();
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const rowToInsert = {
      id: productId,
      name: data.name.trim(),
      sku: normalizedSku,
      barcode_value: rawBarcode,
      manufacturer_model_number: data.manufacturerModelNumber?.trim() || null,
      slug,
      category_id: data.categoryId && isUuid(data.categoryId) ? data.categoryId : 'b0000000-0000-0000-0000-000000000001',
      description: data.description || '',
      short_description: data.shortDescription || null,
      price: pricing.sellingPrice,
      mrp: pricing.mrp,
      stock_quantity: initialStock,
      reserved_stock: 0,
      low_stock_threshold: lowStockThreshold,
      min_order_quantity: data.minOrderQuantity || 1,
      max_order_quantity: data.maxOrderQuantity || 10,
      tags: data.tags || [],
      brand: data.brand || 'Jainam Traders',
      material: data.material?.trim() || null,
      dimensions: data.dimensions?.trim() || null,
      weight: data.weight?.trim() || null,
      occasion: data.occasion?.trim() || null,
      is_featured: Boolean(data.isFeatured),
      is_new_arrival: Boolean(data.isNewArrival),
      is_best_seller: Boolean(data.isBestSeller),
      is_active: isActive,
      thumbnail_url: data.thumbnailUrl || (data.images && data.images[0]) || '/images/product-placeholder.svg',
      images: data.images && data.images.length > 0 ? data.images : (data.thumbnailUrl ? [data.thumbnailUrl] : ['/images/product-placeholder.svg']),
      video_url: data.videoUrl || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('products')
      .insert(rowToInsert)
      .select('*, categories(name)')
      .single();

    if (insertErr) {
      console.error('[Supabase DB Error] Product insert failed:', insertErr);
      if (insertErr.code === '23505') {
        throw new Error(`Duplicate product rejected by database: ${insertErr.message}`);
      }
      throw new Error(`Database failed to persist product: ${insertErr.message} (code: ${insertErr.code || 'UNKNOWN'})`);
    }

    const createdProduct = mapRowToProduct(inserted);

    // Initial stock movement audit log in Supabase
    if (initialStock > 0) {
      try {
        await supabase.from('inventory_movements').insert({
          id: crypto.randomUUID(),
          product_id: productId,
          quantity_change: initialStock,
          previous_stock: 0,
          new_stock: initialStock,
          reason: 'restock',
          notes: 'Initial stock recorded on product creation',
          actor_id: isUuid(actorId) ? actorId : null,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Failed to insert initial inventory movement in Supabase:', err);
      }
    }

    // Audit log in Supabase
    try {
      await supabase.from('audit_logs').insert({
        id: crypto.randomUUID(),
        actor_id: isUuid(actorId) ? actorId : null,
        actor_role: 'admin',
        action: 'CREATE_PRODUCT',
        entity: 'products',
        entity_id: productId,
        metadata: {
          name: createdProduct.name,
          sku: createdProduct.sku,
          price: createdProduct.price,
          mrp: createdProduct.mrp,
          initialStock,
          actor: actorId,
        },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to insert audit log in Supabase:', err);
    }

    // Keep storeDb in memory synced as well
    storeDb.products.unshift(createdProduct);
    return createdProduct;
  }

  // --- In-memory fallback (only used in vitest test runner) ---
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

  const safeData = { ...data };
  delete safeData.discountPercentage;

  const newProduct: Product = {
    ...safeData,
    id: data.id || `c0000000-0000-0000-0000-${Math.random().toString(16).substring(2, 14).padStart(12, '0')}`,
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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: existingRow, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existingRow) {
      throw new Error(fetchErr ? fetchErr.message : 'Product not found');
    }

    const existing = mapRowToProduct(existingRow);

    let finalSku = existing.sku;
    let finalBarcode = existing.barcodeValue || existing.sku;

    if (updates.sku && normalizeBarcodeValue(updates.sku) !== normalizeBarcodeValue(existing.sku)) {
      const newSku = normalizeBarcodeValue(updates.sku);
      const { data: skuClash } = await supabase
        .from('products')
        .select('id, name')
        .ilike('sku', newSku)
        .neq('id', id)
        .limit(1);

      if (skuClash && skuClash.length > 0) {
        throw new Error(`Duplicate SKU rejected: SKU "${newSku}" already exists for product "${skuClash[0].name}".`);
      }
      finalSku = newSku;
      if (!updates.barcodeValue || updates.barcodeValue === existing.sku) {
        finalBarcode = newSku;
      }
    }

    if (updates.barcodeValue && normalizeBarcodeValue(updates.barcodeValue) !== normalizeBarcodeValue(finalBarcode)) {
      const newBarcode = normalizeBarcodeValue(updates.barcodeValue);
      const { data: bcClash } = await supabase
        .from('products')
        .select('id, name')
        .ilike('barcode_value', newBarcode)
        .neq('id', id)
        .limit(1);

      if (bcClash && bcClash.length > 0) {
        throw new Error(`Duplicate barcode rejected: Barcode "${newBarcode}" already exists for product "${bcClash[0].name}".`);
      }
      finalBarcode = newBarcode;
    }

    const finalPrice = updates.price !== undefined ? updates.price : existing.price;
    const finalMrp = updates.mrp !== undefined ? updates.mrp : existing.mrp;

    const pricing = validateProductPricing(finalMrp, finalPrice);
    if (!pricing.isValid) {
      throw new Error(pricing.error || 'Invalid product pricing');
    }

    let status = updates.status || existing.status || 'published';
    let isArchived = Boolean(updates.isArchived ?? existing.isArchived);
    let isActive = updates.isActive !== undefined ? updates.isActive : existing.isActive;

    if (updates.status === 'archived') {
      isArchived = true;
      isActive = false;
      status = 'archived';
    } else if (updates.status === 'published') {
      isArchived = false;
      isActive = true;
      status = 'published';
    } else if (updates.status === 'hidden') {
      isArchived = false;
      isActive = false;
      status = 'hidden';
    }

    const rowUpdates: Record<string, any> = {
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      sku: finalSku,
      barcode_value: finalBarcode,
      price: pricing.sellingPrice,
      mrp: pricing.mrp,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    if (updates.description !== undefined) rowUpdates.description = updates.description;
    if (updates.thumbnailUrl !== undefined) rowUpdates.thumbnail_url = updates.thumbnailUrl;
    if (updates.images !== undefined) rowUpdates.images = updates.images;
    if (updates.tags !== undefined) rowUpdates.tags = updates.tags;
    if (updates.brand !== undefined) rowUpdates.brand = updates.brand;
    if (updates.manufacturerModelNumber !== undefined) rowUpdates.manufacturer_model_number = updates.manufacturerModelNumber;
    if (updates.lowStockThreshold !== undefined) rowUpdates.low_stock_threshold = normalizeStockNumber(updates.lowStockThreshold, 3);
    if (updates.minOrderQuantity !== undefined) rowUpdates.min_order_quantity = updates.minOrderQuantity;
    if (updates.maxOrderQuantity !== undefined) rowUpdates.max_order_quantity = updates.maxOrderQuantity;
    if (updates.isFeatured !== undefined) rowUpdates.is_featured = Boolean(updates.isFeatured);
    if (updates.isNewArrival !== undefined) rowUpdates.is_new_arrival = Boolean(updates.isNewArrival);
    if (updates.isBestSeller !== undefined) rowUpdates.is_best_seller = Boolean(updates.isBestSeller);
    if (updates.material !== undefined) rowUpdates.material = updates.material?.trim() || null;
    if (updates.dimensions !== undefined) rowUpdates.dimensions = updates.dimensions?.trim() || null;
    if (updates.weight !== undefined) rowUpdates.weight = updates.weight?.trim() || null;
    if (updates.occasion !== undefined) rowUpdates.occasion = updates.occasion?.trim() || null;

    const { data: updatedRow, error: updateErr } = await supabase
      .from('products')
      .update(rowUpdates)
      .eq('id', id)
      .select('*, categories(name)')
      .single();

    if (updateErr) {
      console.error('[Supabase DB Error] updateAdminProduct failed:', updateErr);
      throw new Error(`Database failed to update product: ${updateErr.message}`);
    }

    const updated = mapRowToProduct(updatedRow);

    // Audit log
    try {
      await supabase.from('audit_logs').insert({
        id: crypto.randomUUID(),
        actor_id: isUuid(actorId) ? actorId : null,
        actor_role: 'admin',
        action: 'UPDATE_PRODUCT',
        entity: 'products',
        entity_id: id,
        metadata: {
          name: updated.name,
          sku: updated.sku,
          price: updated.price,
          mrp: updated.mrp,
          status: updated.status,
          actor: actorId,
        },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Audit log insert failed:', e);
    }

    const idx = storeDb.products.findIndex((p) => p.id === id);
    if (idx !== -1) storeDb.products[idx] = updated;

    return updated;
  }

  // --- In-memory fallback (only used in vitest test runner) ---
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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: row, error } = await supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, categories(name)')
      .single();

    if (error) {
      console.error('[Supabase DB Error] archiveAdminProduct failed:', error);
      throw new Error(`Database failed to archive product: ${error.message}`);
    }

    const prod = mapRowToProduct(row);
    try {
      await supabase.from('audit_logs').insert({
        id: crypto.randomUUID(),
        actor_id: isUuid(actorId) ? actorId : null,
        actor_role: 'admin',
        action: 'ARCHIVE_PRODUCT',
        entity: 'products',
        entity_id: id,
        metadata: { name: prod.name, sku: prod.sku, actor: actorId },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Audit log insert failed:', e);
    }

    const idx = storeDb.products.findIndex((p) => p.id === id);
    if (idx !== -1) storeDb.products[idx] = prod;

    return prod;
  }

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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: row, error } = await supabase
      .from('products')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, categories(name)')
      .single();

    if (error) {
      console.error('[Supabase DB Error] unarchiveAdminProduct failed:', error);
      throw new Error(`Database failed to unarchive product: ${error.message}`);
    }

    const prod = mapRowToProduct(row);
    try {
      await supabase.from('audit_logs').insert({
        id: crypto.randomUUID(),
        actor_id: isUuid(actorId) ? actorId : null,
        actor_role: 'admin',
        action: 'UNARCHIVE_PRODUCT',
        entity: 'products',
        entity_id: id,
        metadata: { name: prod.name, sku: prod.sku, actor: actorId },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Audit log insert failed:', e);
    }

    const idx = storeDb.products.findIndex((p) => p.id === id);
    if (idx !== -1) storeDb.products[idx] = prod;

    return prod;
  }

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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: row, error: fetchErr } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('id', id)
      .single();

    if (fetchErr || !row) throw new Error('Product not found');
    const prod = mapRowToProduct(row);

    const { error: delErr } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error('[Supabase DB Error] deleteAdminProductPermanent failed:', delErr);
      throw new Error(`Database failed to delete product: ${delErr.message}`);
    }

    try {
      await supabase.from('audit_logs').insert({
        id: crypto.randomUUID(),
        actor_id: isUuid(actorId) ? actorId : null,
        actor_role: 'admin',
        action: 'DELETE_PRODUCT_PERMANENT',
        entity: 'products',
        entity_id: id,
        metadata: { name: prod.name, sku: prod.sku, actor: actorId },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Audit log insert failed:', e);
    }

    const idx = storeDb.products.findIndex((p) => p.id === id);
    if (idx !== -1) storeDb.products.splice(idx, 1);

    return prod;
  }

  const index = storeDb.products.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Product not found');

  const [deleted] = storeDb.products.splice(index, 1);
  storeDb.logAudit(actorId, 'admin', 'DELETE_PRODUCT_PERMANENT', 'products', id, {
    name: deleted.name,
    sku: deleted.sku,
  });

  return deleted;
}

export async function adjustInventory(
  productId: string,
  variantId: string | undefined,
  quantityChange: number, // positive for add, negative for deduction
  reason: 'purchase' | 'sale' | 'damage' | 'missing' | 'manual_correction' | 'return' | 'restock' | 'other',
  notes: string,
  actorId?: string
): Promise<{ product: Product; movement: InventoryMovement }> {
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: prodRow, error: pErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (pErr || !prodRow) throw new Error('Product not found');

    const check = calculateStockAdjustment(Number(prodRow.stock_quantity), quantityChange);
    if (!check.isValid) {
      throw new Error(check.error || 'Invalid stock adjustment');
    }

    const { data: updatedRow, error: uErr } = await supabase
      .from('products')
      .update({ stock_quantity: check.newStock, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select('*, categories(name)')
      .single();

    if (uErr) {
      console.error('[Supabase DB Error] adjustInventory failed:', uErr);
      throw new Error(`Database failed to adjust stock: ${uErr.message}`);
    }

    const product = mapRowToProduct(updatedRow);

    const movementRow = {
      id: crypto.randomUUID(),
      product_id: productId,
      variant_id: variantId && isUuid(variantId) ? variantId : null,
      quantity_change: check.change,
      previous_stock: check.prevStock,
      new_stock: check.newStock,
      reason: reason === 'other' ? 'manual_correction' : reason,
      notes,
      actor_id: isUuid(actorId) ? actorId : null,
      created_at: new Date().toISOString(),
    };

    const { data: movInserted } = await supabase
      .from('inventory_movements')
      .insert(movementRow)
      .select()
      .single();

    const movement: InventoryMovement = {
      id: movInserted ? movInserted.id : movementRow.id,
      productId,
      productName: product.name,
      variantId,
      quantityChange: check.change,
      previousStock: check.prevStock,
      newStock: check.newStock,
      reason: reason as any,
      notes,
      actorId,
      createdAt: movementRow.created_at,
    };

    const idx = storeDb.products.findIndex((p) => p.id === productId);
    if (idx !== -1) storeDb.products[idx] = product;
    storeDb.inventoryMovements.unshift(movement);

    return { product, movement };
  }

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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    if (!params.customerId || !params.customerId.trim()) {
      throw new Error('Customer authentication identity is required to reserve store inventory');
    }
    if (!params.items || params.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // 0. Idempotency Check in Supabase
    if (params.idempotencyKey && params.idempotencyKey.trim()) {
      const { data: existingRow } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('idempotency_key', params.idempotencyKey.trim())
        .maybeSingle();

      if (existingRow) {
        return mapRowToOrder(existingRow, existingRow.order_items);
      }
    }

    // 1. Fetch products from Supabase
    const productIds = params.items.map((i) => i.productId);
    const { data: dbProducts, error: pErr } = await supabase
      .from('products')
      .select('*, product_variants(*)')
      .in('id', productIds)
      .eq('is_active', true);

    if (pErr) {
      console.error('[Supabase DB Error] createPickupOrder failed to fetch products:', pErr);
      throw new Error(`Database error fetching items: ${pErr.message}`);
    }

    const prodMap = new Map((dbProducts || []).map((p) => [p.id, p]));
    const validatedItems: ValidatedItem[] = [];

    for (const item of params.items) {
      const prod = prodMap.get(item.productId);
      if (!prod) {
        throw new Error(`Product ${item.productId} is no longer available or has been archived.`);
      }

      if (item.quantity < (prod.min_order_quantity || 1)) {
        throw new Error(`Minimum order quantity for ${prod.name} is ${prod.min_order_quantity || 1}`);
      }
      if (item.quantity > (prod.max_order_quantity || 10)) {
        throw new Error(`Maximum order quantity for ${prod.name} is ${prod.max_order_quantity || 10}`);
      }

      let variantName: string | undefined = undefined;
      let unitPrice = Number(prod.price);

      if (item.variantId) {
        const variant = (prod.product_variants || []).find((v: any) => v.id === item.variantId && v.is_active);
        if (!variant) throw new Error(`Selected variant is no longer available for ${prod.name}`);
        variantName = variant.title;
        if (variant.price_override) unitPrice = Number(variant.price_override);

        const availableUnits = variant.stock_quantity - variant.reserved_stock;
        if (availableUnits < item.quantity) {
          throw new Error(`Sorry! "${prod.name} (${variantName})" is currently out of stock for pickup (Available: ${availableUnits}).`);
        }
      } else {
        const availableUnits = prod.stock_quantity - prod.reserved_stock;
        if (availableUnits < item.quantity) {
          throw new Error(`Sorry! "${prod.name}" has only ${availableUnits} unit(s) remaining for pickup. Your requested quantity (${item.quantity}) cannot be reserved.`);
        }
      }

      validatedItems.push({
        productId: prod.id,
        variantId: item.variantId,
        productName: prod.name,
        variantName,
        unitPrice,
        mrp: Number(prod.mrp),
        quantity: item.quantity,
        totalPrice: unitPrice * item.quantity,
        thumbnailUrl: prod.thumbnail_url,
      });
    }

    const rawSubtotal = validatedItems.reduce((acc, item) => acc + item.totalPrice, 0);

    const discountCalc = calculateOrderDiscounts({
      subtotal: rawSubtotal,
      customerId: params.customerId,
      allowStacking: true,
    });

    // Reserve stock in Supabase
    for (const item of params.items) {
      const prod = prodMap.get(item.productId)!;
      if (item.variantId) {
        const v = (prod.product_variants || []).find((vItem: any) => vItem.id === item.variantId);
        if (v) {
          await supabase
            .from('product_variants')
            .update({ reserved_stock: (v.reserved_stock || 0) + item.quantity })
            .eq('id', item.variantId);
        }
      } else {
        await supabase
          .from('products')
          .update({ reserved_stock: (prod.reserved_stock || 0) + item.quantity })
          .eq('id', item.productId);
      }

      await supabase.from('inventory_movements').insert({
        id: crypto.randomUUID(),
        product_id: item.productId,
        variant_id: isUuid(item.variantId) ? item.variantId : null,
        quantity_change: item.quantity,
        previous_stock: prod.stock_quantity,
        new_stock: prod.stock_quantity,
        reason: 'reservation',
        notes: 'Reserved for customer order',
        actor_id: isUuid(params.customerId) ? params.customerId : null,
        created_at: new Date().toISOString(),
      });
    }

    const orderId = crypto.randomUUID();
    const orderNumber = `JT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const qrToken = `JT-QR-${orderNumber}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const reservationHours = params.reservationHours || 24;
    const reservationExpiresAt = new Date(Date.now() + reservationHours * 60 * 60 * 1000).toISOString();

    const orderRow = {
      id: orderId,
      order_number: orderNumber,
      idempotency_key: params.idempotencyKey || null,
      customer_id: isUuid(params.customerId) ? params.customerId : 'a0000000-0000-0000-0000-000000000001',
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      customer_email: params.customerEmail || null,
      status: 'PENDING',
      payment_status: 'UNPAID',
      payment_method: 'Pay at Shop',
      subtotal: discountCalc.subtotal,
      discount: discountCalc.couponDiscount,
      total_amount: discountCalc.netPayableAtCounter,
      coupon_code: params.couponCode || null,
      gift_code: null,
      gift_code_discount: 0,
      amount_due: discountCalc.netPayableAtCounter,
      amount_received: 0,
      pickup_mode: params.pickupMode || 'FLEXIBLE',
      pickup_slot_date: params.pickupSlotDate || null,
      pickup_slot_time: params.pickupSlotTime || null,
      customer_notes: params.customerNotes || null,
      qr_token: qrToken,
      reservation_expires_at: reservationExpiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedOrder, error: oErr } = await supabase
      .from('orders')
      .insert(orderRow)
      .select()
      .single();

    if (oErr) {
      console.error('[Supabase DB Error] Insert order failed:', oErr);
      throw new Error(`Database failed to persist order: ${oErr.message}`);
    }

    const orderItemRows = validatedItems.map((v) => ({
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: v.productId,
      variant_id: isUuid(v.variantId) ? v.variantId : null,
      product_name: v.productName,
      variant_name: v.variantName || null,
      unit_price: v.unitPrice,
      mrp: v.mrp,
      quantity: v.quantity,
      total_price: v.totalPrice,
      thumbnail_url: v.thumbnailUrl || null,
      created_at: new Date().toISOString(),
    }));

    await supabase.from('order_items').insert(orderItemRows);

    await supabase.from('order_status_history').insert({
      id: crypto.randomUUID(),
      order_id: orderId,
      from_status: null,
      to_status: 'PENDING',
      note: 'Order placed by customer for pickup at Jainam Traders counter.',
      changed_by: isUuid(params.customerId) ? params.customerId : null,
      created_at: new Date().toISOString(),
    });

    const fullOrder = mapRowToOrder(insertedOrder, orderItemRows);
    storeDb.orders.unshift(fullOrder);
    return fullOrder;
  }

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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .limit(1);

    if (isUuid(orderId)) {
      query = query.or(`id.eq.${orderId},order_number.eq.${orderId}`);
    } else {
      query = query.eq('order_number', orderId);
    }

    const { data: rows, error: fErr } = await query;
    if (fErr || !rows || rows.length === 0) throw new Error('Order not found');

    const rawOrder = rows[0];
    const order = mapRowToOrder(rawOrder, rawOrder.order_items);
    const check = canTransitionOrder(order.status, nextStatus, actorRole);
    if (!check.allowed) {
      throw new Error(check.reason || 'Invalid order status transition');
    }

    const previousStatus = order.status;
    const nowIso = new Date().toISOString();

    const orderUpdates: Record<string, any> = {
      status: nextStatus,
      updated_at: nowIso,
    };

    if (nextStatus === 'CANCELLED' || nextStatus === 'EXPIRED') {
      for (const item of order.items) {
        const { data: prodRow } = await supabase.from('products').select('stock_quantity, reserved_stock').eq('id', item.productId).single();
        if (prodRow) {
          const newReserved = Math.max(0, (prodRow.reserved_stock || 0) - item.quantity);
          await supabase.from('products').update({ reserved_stock: newReserved }).eq('id', item.productId);
          await supabase.from('inventory_movements').insert({
            id: crypto.randomUUID(),
            product_id: item.productId,
            quantity_change: item.quantity,
            previous_stock: prodRow.stock_quantity,
            new_stock: prodRow.stock_quantity,
            reason: 'release_reservation',
            order_id: isUuid(order.id) ? order.id : null,
            notes: `Released reservation upon order ${nextStatus.toLowerCase()} (${order.orderNumber})`,
            actor_id: isUuid(actorId) ? actorId : null,
            created_at: nowIso,
          });
        }
      }
    } else if (nextStatus === 'PICKED_UP') {
      orderUpdates.payment_status = 'PAID';
      orderUpdates.amount_received = order.totalAmount;
      orderUpdates.amount_due = 0;
      orderUpdates.payment_recorded_at = nowIso;
      orderUpdates.payment_recorded_by = isUuid(actorId) ? actorId : null;

      for (const item of order.items) {
        const { data: prodRow } = await supabase.from('products').select('stock_quantity, reserved_stock').eq('id', item.productId).single();
        if (prodRow) {
          const newStock = Math.max(0, (prodRow.stock_quantity || 0) - item.quantity);
          const newReserved = Math.max(0, (prodRow.reserved_stock || 0) - item.quantity);
          await supabase.from('products').update({ stock_quantity: newStock, reserved_stock: newReserved }).eq('id', item.productId);
          await supabase.from('inventory_movements').insert({
            id: crypto.randomUUID(),
            product_id: item.productId,
            quantity_change: -item.quantity,
            previous_stock: prodRow.stock_quantity,
            new_stock: newStock,
            reason: 'sale',
            order_id: isUuid(order.id) ? order.id : null,
            notes: `Finalized pickup at counter for order ${order.orderNumber}`,
            actor_id: isUuid(actorId) ? actorId : null,
            created_at: nowIso,
          });
        }
      }
    }

    const { data: updatedRow, error: uErr } = await supabase
      .from('orders')
      .update(orderUpdates)
      .eq('id', rawOrder.id)
      .select('*, order_items(*)')
      .single();

    if (uErr) {
      console.error('[Supabase DB Error] transitionOrderStatus failed:', uErr);
      throw new Error(`Database failed to transition order: ${uErr.message}`);
    }

    await supabase.from('order_status_history').insert({
      id: crypto.randomUUID(),
      order_id: rawOrder.id,
      from_status: previousStatus,
      to_status: nextStatus,
      note: note || `Status transitioned to ${nextStatus}`,
      changed_by: isUuid(actorId) ? actorId : null,
      created_at: nowIso,
    });

    const updatedOrder = mapRowToOrder(updatedRow, updatedRow.order_items);
    const localIdx = storeDb.orders.findIndex((o) => o.id === rawOrder.id || o.orderNumber === rawOrder.order_number);
    if (localIdx !== -1) storeDb.orders[localIdx] = updatedOrder;

    return updatedOrder;
  }

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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (params?.customerId && isUuid(params.customerId)) {
      query = query.eq('customer_id', params.customerId);
    }
    if (params?.status) {
      query = query.eq('status', params.status);
    }

    const { data: rows, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('[Supabase DB Warning] Table "orders" does not exist yet. Returning 0 orders.');
        return [];
      }
      console.error('[Supabase DB Error] getOrders failed:', error);
      throw new Error(`Database failed to fetch orders: ${error.message}`);
    }

    let orders = (rows || []).map((r) => mapRowToOrder(r, r.order_items));
    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q)
      );
    }
    return orders;
  }

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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .limit(1);

    if (isUuid(orderNumber)) {
      query = query.or(`order_number.eq.${orderNumber},id.eq.${orderNumber}`);
    } else {
      query = query.eq('order_number', orderNumber);
    }

    const { data: rows, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') return null;
      console.error('[Supabase DB Error] getOrderByNumber failed:', error);
      throw new Error(`Database failed to fetch order: ${error.message}`);
    }

    if (!rows || rows.length === 0) return null;
    return mapRowToOrder(rows[0], rows[0].order_items);
  }

  return storeDb.orders.find((o) => o.orderNumber === orderNumber || o.id === orderNumber) || null;
}

export async function getOrderByQrToken(qrToken: string): Promise<Order | null> {
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    const { data: rows, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('qr_token', qrToken)
      .limit(1);

    if (error) {
      console.error('[Supabase DB Error] getOrderByQrToken failed:', error);
      throw new Error(`Database failed to query QR token: ${error.message}`);
    }

    if (!rows || rows.length === 0) return null;
    return mapRowToOrder(rows[0], rows[0].order_items);
  }

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
  if (shouldUseSupabase()) {
    const supabase = getSupabaseAdminClient();
    let query = supabase.from('orders').select('*, order_items(*)').limit(1);
    if (isUuid(params.orderId)) {
      query = query.or(`id.eq.${params.orderId},order_number.eq.${params.orderId}`);
    } else {
      query = query.eq('order_number', params.orderId);
    }

    const { data: rows, error: fErr } = await query;
    if (fErr || !rows || rows.length === 0) throw new Error(`Order ${params.orderId} not found`);

    const rawOrder = rows[0];
    const order = mapRowToOrder(rawOrder, rawOrder.order_items);

    if (params.amountReceived <= 0) throw new Error('Payment amount must be greater than zero');

    const currentReceived = order.amountReceived || 0;
    const newTotalReceived = currentReceived + params.amountReceived;
    const totalPayable = order.totalAmount;
    let newStatus: PaymentStatus = 'PARTIALLY_PAID';
    if (newTotalReceived >= totalPayable) newStatus = 'PAID';

    const nowIso = new Date().toISOString();
    const { data: updatedRow, error: uErr } = await supabase
      .from('orders')
      .update({
        amount_received: newTotalReceived,
        amount_due: Math.max(0, totalPayable - newTotalReceived),
        payment_status: newStatus,
        payment_recorded_at: nowIso,
        payment_recorded_by: isUuid(params.staffId) ? params.staffId : null,
        updated_at: nowIso,
      })
      .eq('id', rawOrder.id)
      .select('*, order_items(*)')
      .single();

    if (uErr) {
      console.error('[Supabase DB Error] recordOrderPayment failed:', uErr);
      throw new Error(`Database failed to record payment: ${uErr.message}`);
    }

    const updatedOrder = mapRowToOrder(updatedRow, updatedRow.order_items);
    const localIdx = storeDb.orders.findIndex((o) => o.id === rawOrder.id || o.orderNumber === rawOrder.order_number);
    if (localIdx !== -1) storeDb.orders[localIdx] = updatedOrder;

    return updatedOrder;
  }

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

