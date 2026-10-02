// ==============================================================================
// JAINAM TRADERS - /api/gift-codes/validate ROUTE HANDLER
// Server-side validation of gift codes for checkout.
// Never trusts client calculations.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedCustomer } from '@/lib/auth/customer-auth-server';
import { validateGiftCodeForCheckout } from '@/lib/gift-codes/gift-code-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, subtotal } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Please enter a valid gift code' }, { status: 400 });
    }

    const numSubtotal = Number(subtotal);
    if (!Number.isFinite(numSubtotal) || numSubtotal <= 0) {
      return NextResponse.json({ error: 'Invalid order subtotal' }, { status: 400 });
    }

    // Resolve authenticated customer if present
    const customer = await getAuthenticatedCustomer();
    const customerId = customer?.id || body.customerId;

    const result = validateGiftCodeForCheckout({
      code,
      subtotal: numSubtotal,
      customerId,
    });

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, message: result.errorReason || 'Invalid gift code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      code: result.giftCode?.code,
      discountAmount: result.discountAmount,
      remainingBalance: result.giftCode?.remainingValue,
      message: `Gift code ${result.giftCode?.code} applied! ₹${result.discountAmount} will be deducted from your counter payment.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Validation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
