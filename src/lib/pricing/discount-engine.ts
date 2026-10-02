// ==============================================================================
// JAINAM TRADERS - CENTRALIZED DISCOUNT & REDEMPTION ENGINE
// Handles deterministic pricing, promotional coupons, gift codes, and stacking rules.
// Rule 1: At most ONE promotional coupon per order.
// Rule 2: At most ONE gift code per order.
// Rule 3: Stacking: Coupon is applied first against subtotal, then gift code applies
//         against the remaining balance.
// Rule 4: Final net payable amount at the shop counter can never be negative.
// Rule 5: Pure server-side determinism with zero client-dictated discounts.
// ==============================================================================

import { Coupon, GiftCode } from '@/lib/types';
import { validateCoupon } from './engine';

export interface DiscountCalculationParams {
  subtotal: number;
  coupon?: Coupon | null;
  giftCode?: GiftCode | null;
  customerId?: string;
  isCustomerFirstOrder?: boolean;
  allowStacking?: boolean; // Default true: Gift Code + 1 Coupon allowed
}

export interface DiscountEngineResult {
  subtotal: number;
  couponDiscount: number;
  appliedCoupon?: Coupon;
  couponError?: string;

  giftCodeDiscount: number;
  appliedGiftCode?: GiftCode;
  giftCodeError?: string;

  totalDiscount: number;
  netPayableAtCounter: number; // Amount customer actually pays in Cash/UPI at Jainam Traders counter
}

/**
 * Validates a gift code against order subtotal and customer eligibility.
 */
export function validateGiftCodeEligibility(
  giftCode: GiftCode | null | undefined,
  subtotal: number,
  customerId?: string
): { valid: boolean; discountAmount: number; errorReason?: string } {
  if (!giftCode) {
    return { valid: false, discountAmount: 0 };
  }

  if (giftCode.status !== 'ACTIVE') {
    return {
      valid: false,
      discountAmount: 0,
      errorReason: `Gift code is currently ${giftCode.status.toLowerCase()}.`,
    };
  }

  const now = new Date();
  if (giftCode.startsAt && new Date(giftCode.startsAt) > now) {
    return { valid: false, discountAmount: 0, errorReason: 'Gift code is not active yet.' };
  }

  if (giftCode.expiresAt && new Date(giftCode.expiresAt) < now) {
    return { valid: false, discountAmount: 0, errorReason: 'Gift code has expired.' };
  }

  if (giftCode.remainingValue <= 0) {
    return { valid: false, discountAmount: 0, errorReason: 'Gift code has zero remaining balance.' };
  }

  if (giftCode.maxRedemptions && giftCode.redemptionCount >= giftCode.maxRedemptions) {
    return { valid: false, discountAmount: 0, errorReason: 'Gift code redemption limit reached.' };
  }

  // Customer eligibility check
  if (giftCode.customerId) {
    if (!customerId || customerId.trim() !== giftCode.customerId.trim()) {
      return {
        valid: false,
        discountAmount: 0,
        errorReason: 'This gift code is assigned to a specific customer account.',
      };
    }
  }

  // Minimum order check
  if (giftCode.minOrderValue && subtotal < giftCode.minOrderValue) {
    return {
      valid: false,
      discountAmount: 0,
      errorReason: `Minimum order subtotal of ₹${giftCode.minOrderValue} required for this gift code.`,
    };
  }

  // Calculate discount amount up to remaining value and subtotal
  let discountAmount = Math.min(giftCode.remainingValue, subtotal);
  if (giftCode.maxDiscount && discountAmount > giftCode.maxDiscount) {
    discountAmount = giftCode.maxDiscount;
  }

  return { valid: true, discountAmount };
}

/**
 * Centralized calculation of all discounts and net counter payable balance
 */
export function calculateOrderDiscounts(
  params: DiscountCalculationParams
): DiscountEngineResult {
  const {
    subtotal,
    coupon,
    giftCode,
    customerId,
    isCustomerFirstOrder = false,
    allowStacking = true,
  } = params;

  let couponDiscount = 0;
  let appliedCoupon: Coupon | undefined = undefined;
  let couponError: string | undefined = undefined;

  let giftCodeDiscount = 0;
  let appliedGiftCode: GiftCode | undefined = undefined;
  let giftCodeError: string | undefined = undefined;

  // Step 1: Apply promotional coupon first
  if (coupon) {
    const couponCheck = validateCoupon(coupon, subtotal, isCustomerFirstOrder);
    if (couponCheck.valid) {
      couponDiscount = couponCheck.discountAmount;
      appliedCoupon = coupon;
    } else {
      couponError = couponCheck.errorReason || 'Coupon is invalid.';
    }
  }

  // Step 2: Check stacking policy
  const balanceAfterCoupon = Math.max(0, subtotal - couponDiscount);

  if (giftCode) {
    if (appliedCoupon && !allowStacking) {
      giftCodeError = 'Gift codes cannot be combined with promotional coupons on this order.';
    } else {
      const giftCheck = validateGiftCodeEligibility(giftCode, balanceAfterCoupon, customerId);
      if (giftCheck.valid) {
        giftCodeDiscount = Math.min(giftCheck.discountAmount, balanceAfterCoupon);
        appliedGiftCode = giftCode;
      } else {
        giftCodeError = giftCheck.errorReason || 'Gift code is invalid.';
      }
    }
  }

  const totalDiscount = couponDiscount + giftCodeDiscount;
  const netPayableAtCounter = Math.max(0, subtotal - totalDiscount);

  return {
    subtotal,
    couponDiscount,
    appliedCoupon,
    couponError,
    giftCodeDiscount,
    appliedGiftCode,
    giftCodeError,
    totalDiscount,
    netPayableAtCounter,
  };
}
