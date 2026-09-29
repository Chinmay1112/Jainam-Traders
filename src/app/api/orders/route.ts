import { NextRequest, NextResponse } from 'next/server';
import { createPickupOrder, getOrders } from '@/lib/db/store-service';
import { OrderStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || undefined;
    const status = (searchParams.get('status') as OrderStatus) || undefined;
    const search = searchParams.get('search') || undefined;

    const orders = await getOrders({ customerId, status, search });
    return NextResponse.json({ orders });
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

    const order = await createPickupOrder({
      customerId: body.customerId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      items: body.items,
      couponCode: body.couponCode,
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
