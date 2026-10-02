import { describe, it, expect } from 'vitest';
import { calculateOrderPricing, validateCoupon, ValidatedItem } from '@/lib/pricing/engine';
import { canTransitionOrder } from '@/lib/orders/state-machine';
import { Coupon } from '@/lib/types';

describe('1. Server-Side Pricing Engine', () => {
  const sampleItems: ValidatedItem[] = [
    {
      productId: 'p1',
      productName: 'Handcrafted Rosewood Photo Frame',
      unitPrice: 599,
      mrp: 899,
      quantity: 2,
      totalPrice: 1198,
      thumbnailUrl: '',
    },
    {
      productId: 'p2',
      productName: 'Silent Sweep Wooden Wall Clock',
      unitPrice: 999,
      mrp: 1599,
      quantity: 1,
      totalPrice: 999,
      thumbnailUrl: '',
    },
  ];

  it('correctly calculates subtotal, MRP, and retail savings', () => {
    const result = calculateOrderPricing(sampleItems);
    expect(result.subtotal).toBe(2197); // (599*2) + 999 = 1198 + 999 = 2197
    expect(result.totalMrp).toBe(3397); // (899*2) + 1599 = 1798 + 1599 = 3397
    expect(result.mrpSavings).toBe(1200); // 3397 - 2197 = 1200
    expect(result.finalPayableAmount).toBe(2197);
  });

  it('correctly applies percentage coupon with max discount cap', () => {
    const coupon: Coupon = {
      id: 'c1',
      code: 'FESTIVE15',
      title: 'Festive 15% Off',
      discountType: 'percentage',
      discountValue: 15,
      minOrderAmount: 1499,
      maxDiscount: 250, // Capped at 250
      startDate: new Date('2026-01-01').toISOString(),
      usedCount: 0,
      perCustomerLimit: 1,
      firstOrderOnly: false,
      isActive: true,
    };

    // 15% of 2197 is 329.55, but cap is 250
    const result = calculateOrderPricing(sampleItems, coupon);
    expect(result.couponDiscount).toBe(250);
    expect(result.finalPayableAmount).toBe(2197 - 250);
  });

  it('rejects coupon when subtotal does not meet minOrderAmount', () => {
    const coupon: Coupon = {
      id: 'c2',
      code: 'BIGSPEND',
      title: 'Big Spend',
      discountType: 'fixed',
      discountValue: 500,
      minOrderAmount: 5000,
      startDate: new Date('2026-01-01').toISOString(),
      usedCount: 0,
      perCustomerLimit: 1,
      firstOrderOnly: false,
      isActive: true,
    };

    const check = validateCoupon(coupon, 2197, false);
    expect(check.valid).toBe(false);
    expect(check.discountAmount).toBe(0);
    expect(check.errorReason).toContain('Minimum order amount');
  });

  it('enforces first-order-only coupon rule', () => {
    const coupon: Coupon = {
      id: 'c3',
      code: 'FIRST10',
      title: 'Welcome',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 499,
      startDate: new Date('2026-01-01').toISOString(),
      usedCount: 0,
      perCustomerLimit: 1,
      firstOrderOnly: true,
      isActive: true,
    };

    // Customer is NOT on their first order
    const check = validateCoupon(coupon, 1000, false);
    expect(check.valid).toBe(false);
    expect(check.errorReason).toContain('first pickup order');

    // Customer IS on their first order
    const checkFirst = validateCoupon(coupon, 1000, true);
    expect(checkFirst.valid).toBe(true);
    expect(checkFirst.discountAmount).toBe(100);
  });
});

describe('2. Order State Machine Transition & Authorization', () => {
  it('allows valid normal lifecycle transitions', () => {
    expect(canTransitionOrder('PENDING', 'CONFIRMED', 'admin').allowed).toBe(true);
    expect(canTransitionOrder('CONFIRMED', 'PREPARING', 'store_manager').allowed).toBe(true);
    expect(canTransitionOrder('PREPARING', 'READY_FOR_PICKUP', 'staff').allowed).toBe(true);
    expect(canTransitionOrder('READY_FOR_PICKUP', 'PICKED_UP', 'staff').allowed).toBe(true);
  });

  it('disallows customer from marking order as PICKED_UP (Security Check)', () => {
    const result = canTransitionOrder('READY_FOR_PICKUP', 'PICKED_UP', 'customer');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not authorized');
  });

  it('blocks arbitrary illegal state jump (e.g. PENDING directly to PICKED_UP)', () => {
    const result = canTransitionOrder('PENDING', 'PICKED_UP', 'admin');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Illegal state transition');
  });

  it('allows customer to self-cancel only while PENDING or CONFIRMED', () => {
    expect(canTransitionOrder('PENDING', 'CANCELLED', 'customer').allowed).toBe(true);
    expect(canTransitionOrder('CONFIRMED', 'CANCELLED', 'customer').allowed).toBe(true);

    // Block customer cancellation if already PREPARING or READY
    const prepCancel = canTransitionOrder('PREPARING', 'CANCELLED', 'customer');
    expect(prepCancel.allowed).toBe(false);
    expect(prepCancel.reason).toContain('already preparing');
  });

  it('enforces return lifecycle: PICKED_UP -> RETURN_REQUESTED -> RETURN_APPROVED -> RETURNED -> REFUND_RECORDED', () => {
    expect(canTransitionOrder('PICKED_UP', 'RETURN_REQUESTED', 'customer').allowed).toBe(true);
    expect(canTransitionOrder('RETURN_REQUESTED', 'RETURN_APPROVED', 'admin').allowed).toBe(true);
    expect(canTransitionOrder('RETURN_APPROVED', 'RETURNED', 'store_manager').allowed).toBe(true);
    expect(canTransitionOrder('RETURNED', 'REFUND_RECORDED', 'store_manager').allowed).toBe(true);
  });

  it('allows staff and admin to cancel orders across all active states (PENDING, CONFIRMED, PREPARING, READY_FOR_PICKUP)', () => {
    // Admin cancellations
    expect(canTransitionOrder('PENDING', 'CANCELLED', 'admin').allowed).toBe(true);
    expect(canTransitionOrder('CONFIRMED', 'CANCELLED', 'admin').allowed).toBe(true);
    expect(canTransitionOrder('PREPARING', 'CANCELLED', 'admin').allowed).toBe(true);
    expect(canTransitionOrder('READY_FOR_PICKUP', 'CANCELLED', 'admin').allowed).toBe(true);

    // Staff cancellations when customer calls counter
    expect(canTransitionOrder('PENDING', 'CANCELLED', 'staff').allowed).toBe(true);
    expect(canTransitionOrder('CONFIRMED', 'CANCELLED', 'staff').allowed).toBe(true);
    expect(canTransitionOrder('PREPARING', 'CANCELLED', 'staff').allowed).toBe(true);
    expect(canTransitionOrder('READY_FOR_PICKUP', 'CANCELLED', 'staff').allowed).toBe(true);
  });

  it('disallows cancelling terminal orders (PICKED_UP, CANCELLED, REFUND_RECORDED)', () => {
    expect(canTransitionOrder('PICKED_UP', 'CANCELLED', 'admin').allowed).toBe(false);
    expect(canTransitionOrder('CANCELLED', 'CANCELLED', 'admin').allowed).toBe(false);
    expect(canTransitionOrder('REFUND_RECORDED', 'CANCELLED', 'admin').allowed).toBe(false);
  });
});
