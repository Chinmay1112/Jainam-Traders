// ==============================================================================
// JAINAM TRADERS - /api/coupons/validate ROUTE HANDLER
// Server-side promotional coupon validation.
// Evaluates active dates, min order amount, max discount, customer eligibility, and limits.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedCustomer } from '@/lib/auth/customer-auth-server';
import { validateCoupon } from '@/lib/pricing/engine';
import { storeDb } from '@/lib/db/store-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, subtotal } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Please enter a coupon code' }, { status: 400 });
    }

    const numSubtotal = Number(subtotal);
    if (!Number.isFinite(numSubtotal) || numSubtotal <= 0) {
      return NextResponse.json({ error: 'Invalid order subtotal' }, { status: 400 });
    }

    const clean = code.toUpperCase().trim();
    const coupon = storeDb.coupons.find((c) => c.code.toUpperCase() === clean);

    if (!coupon) {
      return NextResponse.json(
        { valid: false, message: 'Invalid coupon code.' },
        { status: 400 }
      );
    }

    // Determine if first order for customer
    const customer = await getAuthenticatedCustomer();
    let isCustomerFirstOrder = false;
    if (customer) {
      const orderCount = storeDb.orders.filter((o) => o.customerId === customer.id).length;
      isCustomerFirstOrder = orderCount === 0;
    }

    const validation = validateCoupon(coupon, numSubtotal, isCustomerFirstOrder);

    if (!validation.valid) {
      return NextResponse.json(
        { valid: false, message: validation.errorReason || 'Coupon cannot be applied.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discountAmount: validation.discountAmount,
      message: `Coupon ${coupon.code} applied! ₹${validation.discountAmount} discount applied.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Coupon validation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
