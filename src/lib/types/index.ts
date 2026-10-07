// ==============================================================================
// JAINAM TRADERS - CORE DOMAIN TYPES & INTERFACES
// ==============================================================================

export type UserRole = 'owner' | 'admin' | 'store_manager' | 'staff' | 'customer';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'RETURNED'
  | 'REFUND_RECORDED';

export type PaymentStatus =
  | 'UNPAID'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type RefundMethod = 'cash' | 'upi' | 'manual';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type InventoryMovementReason =
  | 'purchase'
  | 'sale'
  | 'damage'
  | 'missing'
  | 'manual_correction'
  | 'return'
  | 'restock'
  | 'reservation'
  | 'release_reservation';

export type CustomerAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface CustomerStaffNote {
  id: string;
  customerId: string;
  note: string;
  authorId: string;
  authorName: string;
  authorRole: 'owner' | 'store_manager' | 'staff';
  createdAt: string;
}

export type CustomerActivityEventType =
  | 'ACCOUNT_CREATED'
  | 'LOGIN'
  | 'PROFILE_COMPLETED'
  | 'PROFILE_UPDATED'
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_READY'
  | 'ORDER_PICKED_UP'
  | 'ORDER_CANCELLED'
  | 'ORDER_EXPIRED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'RETURNED'
  | 'REFUND_RECORDED'
  | 'REVIEW_SUBMITTED'
  | 'GIFT_CODE_ISSUED'
  | 'GIFT_CODE_REDEEMED'
  | 'GIFT_CODE_RESTORED'
  | 'STATUS_CHANGED';

export interface CustomerActivityEvent {
  id: string;
  customerId: string;
  eventType: CustomerActivityEventType;
  description: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  actorRole: 'customer' | 'staff' | 'system';
  createdAt: string;
}

export type GiftCodeStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'REDEEMED' | 'CANCELLED';
export type GiftCodeType = 'FIXED_VALUE';

export interface GiftCode {
  id: string;
  code: string;
  codeHash: string;
  maskedCode: string;
  codeType: GiftCodeType;
  originalValue: number;
  remainingValue: number;
  maxRedemptions: number;
  redemptionCount: number;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  createdBy: string;
  createdByName: string;
  startsAt?: string;
  expiresAt?: string;
  status: GiftCodeStatus;
  minOrderValue?: number;
  maxDiscount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GiftCodeRedemption {
  id: string;
  giftCodeId: string;
  code: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  amountApplied: number;
  previousRemainingValue: number;
  newRemainingValue: number;
  action: 'REDEEMED' | 'RESTORED' | 'CANCELLED_HOLD';
  actorId: string;
  actorRole: string;
  idempotencyKey?: string;
  reason?: string;
  timestamp: string;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  languagePreference: 'en' | 'hi';
  authenticationMethod: 'email_password' | 'google' | 'otp';
  accountStatus: CustomerAccountStatus;
  profileCompleted: boolean;
  marketingCommunicationPreference: boolean;
  lastKnownLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string;
  anonymizedAt?: string;
}

export interface CustomerCrmSummary {
  totalOrders: number;
  completedPickups: number;
  cancelledOrders: number;
  totalPurchaseValue: number;
  totalRefunded: number;
  activeGiftCodeBalance: number;
  reviewsCount: number;
  wishlistCount: number;
}

export interface UserProfile {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string;
  savedAddress?: string;
  accountStatus?: CustomerAccountStatus;
  languagePreference?: 'en' | 'hi';
  profileCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopSettings {
  id: string;
  shopName: string;
  shopTagline: string;
  brandTagline?: string;
  shopLogoUrl?: string;
  shopAddress: string;
  shortAddress?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  googleMapsUrl: string;
  googleMapsPlaceUrl?: string;
  googleMapsPlaceId?: string;
  isLocationVerified?: boolean;
  locationVerifiedAt?: string;
  locationVerifiedBy?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone: string;
  whatsappNumber: string;
  email: string;
  openingTime: string; // "09:30"
  closingTime: string; // "21:30"
  weeklyClosedDays: string[]; // ['Sunday']
  holidayDates: string[];
  shopDescription: string;
  pickupInstructions: string;
  isModeBSlotsEnabled: boolean;
  maxOrdersPerSlot: number;
  socialFacebook?: string;
  socialInstagram?: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  title: string;
  variantType: 'colour' | 'size' | 'design' | 'pack_size' | string;
  variantValue: string;
  priceOverride?: number;
  stockQuantity: number;
  reservedStock: number;
  images?: string[];
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcodeValue?: string; // Derived from SKU or custom unique barcode value
  slug: string;
  categoryId: string;
  categoryName?: string;
  categorySlug?: string;
  subcategoryId?: string;
  description: string;
  shortDescription?: string;
  price: number;
  mrp: number;
  discountPercentage: number;
  thumbnailUrl: string;
  images: string[];
  videoUrl?: string;
  stockQuantity: number; // Server-only, hidden from customer
  reservedStock: number; // Server-only, hidden from customer
  lowStockThreshold: number;
  minOrderQuantity: number;
  maxOrderQuantity: number;
  tags: string[];
  brand: string;
  dimensions?: string;
  weight?: string;
  material?: string;
  colour?: string;
  size?: string;
  occasion?: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  status?: 'published' | 'draft' | 'hidden' | 'archived';
  isArchived?: boolean;
  variants?: ProductVariant[];
  averageRating?: number;
  reviewCount?: number;
  searchKeywords?: string;
  manufacturerModelNumber?: string;
  searchIndex?: string[];
  createdAt: string;
  updatedAt: string;
}

export type DuplicateConfidence = 'EXACT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SimilarProductMatch {
  product: Product;
  score: number; // 0 to 100
  confidence: DuplicateConfidence;
  matchedFields: Array<'sku' | 'barcode' | 'modelNumber' | 'exactName' | 'fuzzyName' | 'brandCategory' | 'tags'>;
  matchReasons: string[];
}

export interface DuplicateCheckParams {
  name: string;
  sku?: string;
  barcodeValue?: string;
  brand?: string;
  categoryId?: string;
  subcategoryId?: string;
  tags?: string[];
  manufacturerModelNumber?: string;
  excludeProductId?: string;
}

export interface DuplicateAuditGroup {
  groupId: string;
  canonicalProduct: Product;
  similarProducts: Array<{
    product: Product;
    score: number;
    reasons: string[];
  }>;
}

// Customer safe view where exact stock number is hidden
export interface CustomerProductView extends Omit<Product, 'stockQuantity' | 'reservedStock' | 'lowStockThreshold'> {
  availability: 'AVAILABLE' | 'OUT_OF_STOCK' | 'COMING_SOON';
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Cart {
  id: string;
  userId?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  appliedCoupon?: Coupon;
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  product: Product;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  startDate: string;
  endDate?: string;
  usageLimit?: number;
  usedCount: number;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  isActive: boolean;
}

export interface Offer {
  id: string;
  title: string;
  badgeText?: string;
  description?: string;
  offerType: string;
  discountPct?: number;
  minSpend?: number;
  bannerImage?: string;
  linkUrl?: string;
  isActive: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  unitPrice: number;
  mrp?: number;
  discountPercentage?: number;
  quantity: number;
  totalPrice: number;
  thumbnailUrl?: string;
}

export interface OrderStatusHistoryItem {
  id: string;
  orderId: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  note?: string;
  changedBy?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. JT-2026-000101
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  idempotencyKey?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'Pay at Shop';
  subtotal: number;
  discount: number;
  totalAmount: number;
  couponCode?: string;
  giftCode?: string;
  giftCodeDiscount?: number;
  giftCodeId?: string;
  netPayableAtCounter?: number;
  amountDue?: number;
  amountReceived?: number;
  paymentRecordedAt?: string;
  paymentRecordedBy?: string;
  pickupMode: 'FLEXIBLE' | 'SLOT';
  pickupSlotDate?: string;
  pickupSlotTime?: string;
  customerNotes?: string;
  adminNotes?: string;
  qrToken: string;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryItem[];
  reservationExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber?: string;
  orderItemId?: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  productId: string;
  productName?: string;
  variantId?: string;
  quantity: number;
  reason: string;
  description?: string;
  images: string[];
  status: OrderStatus;
  adminDecisionNotes?: string;
  decidedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRecord {
  id: string;
  returnRequestId?: string;
  orderId: string;
  orderNumber?: string;
  refundAmount: number;
  refundMethod: RefundMethod;
  receiptNumber: string;
  notes?: string;
  recordedBy: string;
  staffName?: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  productName?: string;
  customerId: string;
  customerName: string;
  orderId: string;
  rating: number; // 1 - 5
  title?: string;
  comment: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  customerId: string;
  title: string;
  message: string;
  linkUrl?: string;
  isRead: boolean;
  notificationType: 'order' | 'offer' | 'system' | 'return';
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: UserRole;
  message: string;
  attachments?: string[];
  isRead: boolean;
  createdAt: string;
}

export interface SupportConversation {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  orderId?: string;
  status: 'OPEN' | 'RESOLVED';
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName?: string;
  variantId?: string;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: InventoryMovementReason;
  orderId?: string;
  notes?: string;
  actorId?: string;
  createdAt: string;
}
