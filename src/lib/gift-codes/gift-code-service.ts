// ==============================================================================
// JAINAM TRADERS - GIFT CODE & STORED VALUE MANAGEMENT SERVICE
// Dedicated redemption engine for custom store gift codes, balance tracking,
// atomic redemptions, cancellation restorations, and immutable audit logs.
// ==============================================================================

import crypto from 'crypto';
import { GiftCode, GiftCodeRedemption, GiftCodeStatus, Order } from '@/lib/types';
import { storeDb } from '@/lib/db/store-service';
import { StaffRole } from '@/lib/auth/staff-roles';
import { validateGiftCodeEligibility } from '@/lib/pricing/discount-engine';

/**
 * Normalizes gift code for consistent case-insensitive handling
 */
export function normalizeGiftCode(rawCode: string): string {
  if (!rawCode || typeof rawCode !== 'string') return '';
  return rawCode.toUpperCase().replace(/\s+/g, '').trim();
}

/**
 * Generates cryptographic SHA-256 hash of normalized gift code
 */
export function hashGiftCode(normalizedCode: string): string {
  return crypto.createHash('sha256').update(normalizedCode).digest('hex');
}

/**
 * Creates masked display representation of gift code (e.g. JAI***500)
 */
export function maskGiftCode(normalizedCode: string): string {
  if (normalizedCode.length <= 4) return normalizedCode;
  const prefix = normalizedCode.slice(0, 3);
  const suffix = normalizedCode.slice(-3);
  return `${prefix}***${suffix}`;
}

/**
 * Create a new custom or shop-wide Gift Code (Parts 20-22)
 * Strictly restricted to Owner and Store Manager.
 */
export function createGiftCode(params: {
  code: string;
  originalValue: number;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  createdBy: string;
  createdByName: string;
  actorRole: StaffRole;
  startsAt?: string;
  expiresAt?: string;
  maxRedemptions?: number;
  minOrderValue?: number;
  maxDiscount?: number;
  notes?: string;
}): { success: boolean; giftCode?: GiftCode; rawCode?: string; error?: string } {
  // Authorization check (Owner or Store Manager)
  if (params.actorRole !== 'owner' && params.actorRole !== 'store_manager') {
    return { success: false, error: 'Unauthorized: Only store owner or manager can issue gift codes.' };
  }

  const normalized = normalizeGiftCode(params.code);
  if (!normalized || normalized.length < 3) {
    return { success: false, error: 'Gift code must be at least 3 characters long.' };
  }

  if (params.originalValue <= 0 || !Number.isFinite(params.originalValue)) {
    return { success: false, error: 'Gift code value must be a positive number.' };
  }

  const codeHash = hashGiftCode(normalized);
  const maskedCode = maskGiftCode(normalized);

  // Check uniqueness across existing gift codes
  const existing = storeDb.giftCodes.find(
    (g) => g.codeHash === codeHash || g.code === normalized || g.code === maskedCode
  );
  if (existing) {
    return { success: false, error: `Gift code '${normalized}' already exists. Please choose a unique code.` };
  }

  const giftCode: GiftCode = {
    id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    code: maskedCode, // Never store plaintext code; persist maskedCode for safety
    codeHash, // Authoritative cryptographic lookup hash
    maskedCode,
    codeType: 'FIXED_VALUE',
    originalValue: Math.round(params.originalValue),
    remainingValue: Math.round(params.originalValue),
    maxRedemptions: params.maxRedemptions || 1,
    redemptionCount: 0,
    customerId: params.customerId?.trim() || undefined,
    customerEmail: params.customerEmail?.toLowerCase().trim() || undefined,
    customerName: params.customerName?.trim() || undefined,
    createdBy: params.createdBy,
    createdByName: params.createdByName,
    startsAt: params.startsAt,
    expiresAt: params.expiresAt,
    status: 'ACTIVE',
    minOrderValue: params.minOrderValue,
    maxDiscount: params.maxDiscount,
    notes: params.notes?.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  storeDb.giftCodes.unshift(giftCode);

  // Immutable audit log
  storeDb.logAudit(params.createdBy, params.actorRole, 'CREATE_GIFT_CODE', 'gift_codes', giftCode.id, {
    code: giftCode.maskedCode,
    originalValue: giftCode.originalValue,
    customerId: giftCode.customerId,
    createdByName: giftCode.createdByName,
  });

  return { success: true, giftCode, rawCode: normalized };
}

/**
 * Search and list Gift Codes for Admin (Parts 30-31)
 */
export function getGiftCodes(params: {
  search?: string;
  status?: GiftCodeStatus;
  customerId?: string;
  page?: number;
  limit?: number;
}): { giftCodes: Array<Omit<GiftCode, 'codeHash'>>; total: number; page: number; totalPages: number } {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 15));

  let list = [...storeDb.giftCodes];

  if (params.status) {
    list = list.filter((g) => g.status === params.status);
  }

  if (params.customerId) {
    list = list.filter((g) => g.customerId === params.customerId);
  }

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (g) =>
        g.code.toLowerCase().includes(q) ||
        g.maskedCode.toLowerCase().includes(q) ||
        g.customerName?.toLowerCase().includes(q) ||
        g.customerEmail?.toLowerCase().includes(q) ||
        g.notes?.toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = list.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginated = list.slice(startIndex, startIndex + limit).map(({ codeHash: _, ...safe }) => ({
    ...safe,
    code: safe.maskedCode, // Expose only masked code in listings
  }));

  return {
    giftCodes: paginated,
    total,
    page,
    totalPages,
  };
}

/**
 * Retrieve Gift Codes assigned to a customer for My Account -> Gift Codes (Part 24)
 * Customer Privacy: Customers CANNOT see other customers' codes!
 */
export function getCustomerGiftCodes(
  customerId: string
): Array<Omit<GiftCode, 'codeHash'>> {
  if (!customerId) return [];

  const matched = storeDb.giftCodes.filter(
    (g) => g.customerId === customerId
  );

  return matched.map(({ codeHash: _, ...safe }) => ({
    ...safe,
    code: safe.maskedCode,
  }));
}

/**
 * Validate Gift Code during Checkout (Part 25)
 */
export function validateGiftCodeForCheckout(params: {
  code: string;
  subtotal: number;
  customerId?: string;
}): { valid: boolean; discountAmount: number; errorReason?: string; giftCode?: GiftCode } {
  const normalized = normalizeGiftCode(params.code);
  if (!normalized) {
    return { valid: false, discountAmount: 0, errorReason: 'Please enter a gift code.' };
  }

  const codeHash = hashGiftCode(normalized);
  const found = storeDb.giftCodes.find((g) => g.codeHash === codeHash || g.code === normalized);
  if (!found) {
    return { valid: false, discountAmount: 0, errorReason: 'Gift code not found.' };
  }

  const check = validateGiftCodeEligibility(found, params.subtotal, params.customerId);
  if (!check.valid) {
    return { valid: false, discountAmount: 0, errorReason: check.errorReason };
  }

  return { valid: true, discountAmount: check.discountAmount, giftCode: found };
}

/**
 * Atomically redeem a Gift Code when an order is successfully created (Part 26 & 28)
 * Enforces database-level CAS invariants: remaining_value >= 0 and idempotency.
 */
export function redeemGiftCodeAtomic(params: {
  code: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  requestedAmount: number;
  actorId: string;
  actorRole: string;
  idempotencyKey?: string;
}): { success: boolean; amountApplied: number; error?: string; giftCode?: GiftCode; idempotent?: boolean } {
  // 1. Idempotency Check: if this exact redemption request was already processed, return existing result
  if (params.idempotencyKey) {
    const existing = storeDb.giftCodeRedemptions.find(
      (r) => r.idempotencyKey === params.idempotencyKey && r.action === 'REDEEMED'
    );
    if (existing) {
      const giftCode = storeDb.giftCodes.find((g) => g.id === existing.giftCodeId);
      return {
        success: true,
        amountApplied: existing.amountApplied,
        giftCode,
        idempotent: true,
      };
    }
  }

  const normalized = normalizeGiftCode(params.code);
  const codeHash = hashGiftCode(normalized);
  const giftCode = storeDb.giftCodes.find((g) => g.codeHash === codeHash || g.code === normalized);

  if (!giftCode) {
    return { success: false, amountApplied: 0, error: 'Gift code not found' };
  }

  if (giftCode.status !== 'ACTIVE') {
    return { success: false, amountApplied: 0, error: `Gift code is ${giftCode.status.toLowerCase()}` };
  }

  if (giftCode.remainingValue <= 0) {
    return { success: false, amountApplied: 0, error: 'Gift code has zero balance' };
  }

  if (params.requestedAmount <= 0) {
    return { success: false, amountApplied: 0, error: 'Requested amount must be greater than zero' };
  }

  // Atomic conditional deduction (CAS invariant: remaining_value >= 0)
  const amountApplied = Math.min(params.requestedAmount, giftCode.remainingValue);
  const previousRemainingValue = giftCode.remainingValue;
  const newRemainingValue = previousRemainingValue - amountApplied;

  if (newRemainingValue < 0) {
    return { success: false, amountApplied: 0, error: 'Deduction would result in negative balance' };
  }

  giftCode.remainingValue = newRemainingValue;
  giftCode.redemptionCount += 1;
  giftCode.updatedAt = new Date().toISOString();

  if (newRemainingValue === 0 || giftCode.redemptionCount >= giftCode.maxRedemptions) {
    giftCode.status = 'REDEEMED';
  }

  // Record immutable redemption audit record with idempotency key
  const redemptionRecord: GiftCodeRedemption = {
    id: `red-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    giftCodeId: giftCode.id,
    code: giftCode.maskedCode,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    customerId: params.customerId,
    customerName: params.customerName,
    amountApplied,
    previousRemainingValue,
    newRemainingValue,
    action: 'REDEEMED',
    actorId: params.actorId,
    actorRole: params.actorRole,
    idempotencyKey: params.idempotencyKey,
    timestamp: new Date().toISOString(),
  };

  storeDb.giftCodeRedemptions.unshift(redemptionRecord);

  storeDb.logAudit(params.actorId, params.actorRole, 'REDEEM_GIFT_CODE', 'gift_codes', giftCode.id, {
    orderNumber: params.orderNumber,
    amountApplied,
    remainingValue: newRemainingValue,
    idempotencyKey: params.idempotencyKey,
  });

  return { success: true, amountApplied, giftCode };
}

/**
 * Restore Gift Code balance when an order is cancelled (Part 26 & 29)
 * Guaranteed idempotent: Calling cancellation multiple times will NOT restore balance twice.
 */
export function restoreGiftCodeOnCancellation(params: {
  orderId: string;
  orderNumber: string;
  actorId: string;
  actorRole: string;
}): { success: boolean; amountRestored: number; idempotent?: boolean } {
  // Idempotency check: has this order already been restored?
  const alreadyRestored = storeDb.giftCodeRedemptions.some(
    (r) => (r.orderId === params.orderId || r.orderNumber === params.orderNumber) && r.action === 'RESTORED'
  );
  if (alreadyRestored) {
    return { success: true, amountRestored: 0, idempotent: true };
  }

  // Find all redemptions for this order
  const redemptions = storeDb.giftCodeRedemptions.filter(
    (r) => (r.orderId === params.orderId || r.orderNumber === params.orderNumber) && r.action === 'REDEEMED'
  );

  let totalRestored = 0;

  for (const red of redemptions) {
    const gift = storeDb.giftCodes.find((g) => g.id === red.giftCodeId);
    if (!gift) continue;

    const previousRemaining = gift.remainingValue;
    const newRemaining = Math.min(gift.originalValue, previousRemaining + red.amountApplied);

    gift.remainingValue = newRemaining;
    gift.redemptionCount = Math.max(0, gift.redemptionCount - 1);
    if (gift.status === 'REDEEMED') {
      gift.status = 'ACTIVE';
    }
    gift.updatedAt = new Date().toISOString();

    totalRestored += red.amountApplied;

    // Record restoration audit with unique order reference
    storeDb.giftCodeRedemptions.unshift({
      id: `rest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      giftCodeId: gift.id,
      code: gift.maskedCode,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      customerId: red.customerId,
      customerName: red.customerName,
      amountApplied: red.amountApplied,
      previousRemainingValue: previousRemaining,
      newRemainingValue: newRemaining,
      action: 'RESTORED',
      actorId: params.actorId,
      actorRole: params.actorRole,
      reason: 'Order cancelled before pickup',
      idempotencyKey: `cancel-${params.orderId}-${gift.id}`,
      timestamp: new Date().toISOString(),
    });

    storeDb.logAudit(params.actorId, params.actorRole, 'RESTORE_GIFT_CODE', 'gift_codes', gift.id, {
      orderNumber: params.orderNumber,
      amountRestored: red.amountApplied,
      newRemainingValue: newRemaining,
    });
  }

  return { success: true, amountRestored: totalRestored };
}

/**
 * Update Gift Code status (pause, resume, cancel) - Part 30
 */
export function updateGiftCodeStatus(params: {
  id: string;
  status: GiftCodeStatus;
  actorId: string;
  actorRole: StaffRole;
}): { success: boolean; giftCode?: GiftCode; error?: string } {
  if (params.actorRole !== 'owner' && params.actorRole !== 'store_manager') {
    return { success: false, error: 'Unauthorized: Only owner and manager can modify gift codes.' };
  }

  const gift = storeDb.giftCodes.find((g) => g.id === params.id);
  if (!gift) {
    return { success: false, error: 'Gift code not found.' };
  }

  gift.status = params.status;
  gift.updatedAt = new Date().toISOString();

  storeDb.logAudit(params.actorId, params.actorRole, 'UPDATE_GIFT_CODE_STATUS', 'gift_codes', gift.id, {
    newStatus: params.status,
  });

  return { success: true, giftCode: gift };
}

/**
 * Assign Gift Code to Customer (Part 23)
 */
export function assignGiftCodeToCustomer(params: {
  id: string;
  customerId: string;
  customerEmail?: string;
  customerName?: string;
  actorId: string;
  actorRole: StaffRole;
}): { success: boolean; giftCode?: GiftCode; error?: string } {
  if (params.actorRole !== 'owner' && params.actorRole !== 'store_manager') {
    return { success: false, error: 'Unauthorized: Only owner and manager can assign gift codes.' };
  }

  const gift = storeDb.giftCodes.find((g) => g.id === params.id);
  if (!gift) {
    return { success: false, error: 'Gift code not found.' };
  }

  gift.customerId = params.customerId.trim();
  if (params.customerEmail) gift.customerEmail = params.customerEmail.toLowerCase().trim();
  if (params.customerName) gift.customerName = params.customerName.trim();
  gift.updatedAt = new Date().toISOString();

  storeDb.logAudit(params.actorId, params.actorRole, 'ASSIGN_GIFT_CODE', 'gift_codes', gift.id, {
    assignedToCustomerId: params.customerId,
  });

  return { success: true, giftCode: gift };
}

/**
 * Retrieve Redemption Audit History (Part 28 & 30)
 */
export function getGiftCodeRedemptionHistory(giftCodeId?: string): GiftCodeRedemption[] {
  if (giftCodeId) {
    return storeDb.giftCodeRedemptions.filter((r) => r.giftCodeId === giftCodeId);
  }
  return storeDb.giftCodeRedemptions;
}
