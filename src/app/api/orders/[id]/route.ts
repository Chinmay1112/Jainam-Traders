import { NextRequest, NextResponse } from 'next/server';
import { getOrderByNumber, getOrderByQrToken, transitionOrderStatus } from '@/lib/db/store-service';
import { OrderStatus, UserRole } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const byQr = searchParams.get('byQr') === 'true';

    const order = byQr ? await getOrderByQrToken(id) : await getOrderByNumber(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const nextStatus = body.status as OrderStatus;
    const actorRole = (body.actorRole as UserRole) || 'customer';
    const actorId = body.actorId || 'anon';
    const note = body.note;

    if (!nextStatus) {
      return NextResponse.json({ error: 'New status is required' }, { status: 400 });
    }

    const updated = await transitionOrderStatus(id, nextStatus, actorRole, actorId, note);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Status transition failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
