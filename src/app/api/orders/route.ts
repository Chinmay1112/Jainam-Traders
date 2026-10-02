import { NextRequest, NextResponse } from 'next/server';
import { createPickupOrder, getOrders } from '@/lib/db/store-service';
import { OrderStatus } from '@/lib/types';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';
import { getAuthenticatedCustomer } from '@/lib/auth/customer-auth-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || undefined;
    const status = (searchParams.get('status') as OrderStatus) || undefined;
    const search = searchParams.get('search') || undefined;

    const staffSession = getAuthenticatedStaffFromRequest(request);

    // If staff session is present, allow querying global orders or specific customer
    if (staffSession) {
      const orders = await getOrders({ customerId, status, search });
      return NextResponse.json({ orders });
    }

    // Customer Session isolation check
    const customer = await getAuthenticatedCustomer();
    if (customer) {
      // Customer can ONLY view their own orders
      if (customerId && customerId !== customer.id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only access your own orders' },
          { status: 403 }
        );
      }
      const orders = await getOrders({ customerId: customer.id, status, search });
      return NextResponse.json({ orders });
    }

    // Fallback: If customerId is provided directly (e.g. from local test client)
    if (customerId) {
      const orders = await getOrders({ customerId, status, search });
      return NextResponse.json({ orders });
    }

    return NextResponse.json(
      { error: 'Unauthorized: Authentication required to query store orders' },
      { status: 401 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch orders';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Server-side validation
    if (!body.customerId || !body.customerName || !body.customerPhone) {
      return NextResponse.json(
        { error: 'Customer name and phone number are required to reserve pickup order' },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Order must have at least one item' }, { status: 400 });
    }

    // Check if authenticated customer session overrides client customerId
    const staffSession = getAuthenticatedStaffFromRequest(request);
    let resolvedCustomerId = body.customerId;

    if (!staffSession) {
      const customer = await getAuthenticatedCustomer();
      if (!customer) {
        // Strictly require authenticated customer session in production to prevent unverified guest reservations
        if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
          return NextResponse.json(
            { error: 'Authentication required. Guests cannot place orders or reserve store products.' },
            { status: 401 }
          );
        }
      } else {
        resolvedCustomerId = customer.id;
      }
    }

    const idempotencyKey = body.idempotencyKey || request.headers.get('x-idempotency-key') || undefined;

    const order = await createPickupOrder({
      customerId: resolvedCustomerId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      idempotencyKey,
      items: body.items,
      couponCode: body.couponCode,
      giftCode: body.giftCode,
      pickupMode: body.pickupMode || 'FLEXIBLE',
      pickupSlotDate: body.pickupSlotDate,
      pickupSlotTime: body.pickupSlotTime,
      customerNotes: body.customerNotes,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create order';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
