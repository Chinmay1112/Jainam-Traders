import { Coupon } from '@/lib/types';

export interface RawCheckoutItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface ValidatedItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  unitPrice: number;
  mrp: number;
  quantity: number;
  totalPrice: number;
  thumbnailUrl: string;
}

export interface PricingCalculationResult {
  items: ValidatedItem[];
  subtotal: number;
  totalMrp: number;
  mrpSavings: number;
  couponDiscount: number;
  totalSavings: number;
  finalPayableAmount: number;
  appliedCoupon?: Coupon;
}

/**
 * Validates a coupon against an order subtotal and customer history.
 */
export function validateCoupon(
  coupon: Coupon | null | undefined,
  subtotal: number,
  isCustomerFirstOrder: boolean = false
): { valid: boolean; discountAmount: number; errorReason?: string } {
  if (!coupon) {
    return { valid: false, discountAmount: 0 };
  }

  if (!coupon.isActive) {
    return { valid: false, discountAmount: 0, errorReason: 'Coupon code is no longer active.' };
  }

  const now = new Date();
  if (coupon.startDate && new Date(coupon.startDate) > now) {
    return { valid: false, discountAmount: 0, errorReason: 'Coupon offer has not started yet.' };
  }

  if (coupon.endDate && new Date(coupon.endDate) < now) {
    return { valid: false, discountAmount: 0, errorReason: 'Coupon code has expired.' };
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discountAmount: 0, errorReason: 'Coupon usage limit has been reached.' };
  }

  if (coupon.firstOrderOnly && !isCustomerFirstOrder) {
    return { valid: false, discountAmount: 0, errorReason: 'Coupon is valid only on your first pickup order.' };
  }

  if (subtotal < coupon.minOrderAmount) {
    return {
      valid: false,
      discountAmount: 0,
      errorReason: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon.`,
    };
  }

  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
      discountAmount = coupon.maxDiscount;
    }
  } else {
    discountAmount = Math.min(coupon.discountValue, subtotal);
  }

  return { valid: true, discountAmount };
}

/**
 * Deterministically computes pricing strictly on the server using verified product data.
 */
export function calculateOrderPricing(
  validatedItems: ValidatedItem[],
  coupon?: Coupon | null,
  isCustomerFirstOrder: boolean = false
): PricingCalculationResult {
  const subtotal = validatedItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const totalMrp = validatedItems.reduce((acc, item) => acc + item.mrp * item.quantity, 0);
  const mrpSavings = Math.max(0, totalMrp - subtotal);

  let couponDiscount = 0;
  let appliedCoupon: Coupon | undefined = undefined;

  if (coupon) {
    const check = validateCoupon(coupon, subtotal, isCustomerFirstOrder);
    if (check.valid) {
      couponDiscount = check.discountAmount;
      appliedCoupon = coupon;
    }
  }

  const finalPayableAmount = Math.max(0, subtotal - couponDiscount);
  const totalSavings = mrpSavings + couponDiscount;

  return {
    items: validatedItems,
    subtotal,
    totalMrp,
    mrpSavings,
    couponDiscount,
    totalSavings,
    finalPayableAmount,
    appliedCoupon,
  };
}

/**
 * Calculates discount percentage deterministically from MRP and Selling Price.
 * Formula: Math.round(((mrp - sellingPrice) / mrp) * 100)
 */
export function calculateDiscountPercentage(mrp: number, sellingPrice: number): number {
  if (!Number.isFinite(mrp) || !Number.isFinite(sellingPrice) || mrp <= 0 || sellingPrice <= 0) {
    return 0;
  }
  if (sellingPrice >= mrp) {
    return 0;
  }
  return Math.round(((mrp - sellingPrice) / mrp) * 100);
}

/**
 * Formats discount presentation for UI badges and previews.
 * Zero-discount products return 'No discount' (never '0% OFF').
 */
export function formatDiscountBadge(mrp: number, sellingPrice: number): string {
  const discount = calculateDiscountPercentage(mrp, sellingPrice);
  if (discount <= 0 || sellingPrice >= mrp) {
    return 'No discount';
  }
  return `${discount}% OFF`;
}

export interface PricingValidationResult {
  isValid: boolean;
  error?: string;
  mrp: number;
  sellingPrice: number;
  discountPercentage: number;
}

/**
 * Strict server-side validation for Product Pricing:
 * - MRP must be numeric, > 0, finite
 * - Selling Price must be numeric, > 0, finite, <= MRP
 * - Rejects NaN, Infinity, <= 0, negatives, non-numeric, sellingPrice > MRP
 */
export function validateProductPricing(mrpInput: unknown, sellingPriceInput: unknown): PricingValidationResult {
  if (mrpInput === null || mrpInput === undefined || mrpInput === '') {
    return { isValid: false, error: 'Real MRP is required', mrp: 0, sellingPrice: 0, discountPercentage: 0 };
  }
  if (sellingPriceInput === null || sellingPriceInput === undefined || sellingPriceInput === '') {
    return { isValid: false, error: 'Selling price is required', mrp: 0, sellingPrice: 0, discountPercentage: 0 };
  }

  const mrp = Number(mrpInput);
  const sellingPrice = Number(sellingPriceInput);

  if (typeof mrpInput === 'boolean' || typeof sellingPriceInput === 'boolean') {
    return { isValid: false, error: 'Price values cannot be boolean', mrp: 0, sellingPrice: 0, discountPercentage: 0 };
  }

  if (isNaN(mrp) || !Number.isFinite(mrp)) {
    return { isValid: false, error: 'Real MRP must be a valid, finite numeric amount', mrp: 0, sellingPrice: 0, discountPercentage: 0 };
  }

  if (isNaN(sellingPrice) || !Number.isFinite(sellingPrice)) {
    return { isValid: false, error: 'Selling price must be a valid, finite numeric amount', mrp: 0, sellingPrice: 0, discountPercentage: 0 };
  }

  if (mrp <= 0) {
    return { isValid: false, error: 'Real MRP must be greater than zero', mrp, sellingPrice, discountPercentage: 0 };
  }

  if (sellingPrice <= 0) {
    return { isValid: false, error: 'Selling price must be greater than zero', mrp, sellingPrice, discountPercentage: 0 };
  }

  if (sellingPrice > mrp) {
    return {
      isValid: false,
      error: `Selling price cannot exceed MRP: Selling price (₹${sellingPrice}) cannot exceed MRP (₹${mrp})`,
      mrp,
      sellingPrice,
      discountPercentage: 0,
    };
  }

  const discountPercentage = calculateDiscountPercentage(mrp, sellingPrice);

  return {
    isValid: true,
    mrp,
    sellingPrice,
    discountPercentage,
  };
}

