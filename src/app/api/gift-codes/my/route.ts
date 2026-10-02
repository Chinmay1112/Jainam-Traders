// ==============================================================================
// JAINAM TRADERS - /api/gift-codes/my ROUTE HANDLER
// Customer self-service: View gift codes assigned to current customer session.
// Strictly isolated: Customer CANNOT see any other customer's gift codes!
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedCustomer } from '@/lib/auth/customer-auth-server';
import { getCustomerGiftCodes } from '@/lib/gift-codes/gift-code-service';

export async function GET(_request: NextRequest) {
  try {
    const customer = await getAuthenticatedCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }

    const giftCodes = getCustomerGiftCodes(customer.id);
    return NextResponse.json({ giftCodes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve gift codes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
