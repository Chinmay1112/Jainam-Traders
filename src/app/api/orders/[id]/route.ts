import { NextRequest, NextResponse } from 'next/server';
import { getOrderByNumber, getOrderByQrToken, transitionOrderStatus, updateOrderAdminNotes } from '@/lib/db/store-service';
import { OrderStatus } from '@/lib/types';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';

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
    const nextStatus = body.status as OrderStatus | undefined;
    const note = body.note;
    const adminNotes = body.adminNotes;

    // Role MUST come from server-side authenticated session, NEVER client body!
    const staffSession = getAuthenticatedStaffFromRequest(request);

    let actorRole: 'owner' | 'store_manager' | 'staff' | 'customer' = 'customer';
    let actorId = 'customer';

    if (staffSession) {
      actorRole = staffSession.role;
      actorId = staffSession.staffId;
    } else {
      // Unauthenticated / Customer can ONLY request CANCELLED or RETURN_REQUESTED
      if (nextStatus !== 'CANCELLED' && nextStatus !== 'RETURN_REQUESTED') {
        return NextResponse.json(
          { error: 'Unauthorized: Operational status transitions require authenticated staff session' },
          { status: 403 }
        );
      }
    }

    // Case 1: Staff updating internal admin notes only
    if (adminNotes !== undefined && !nextStatus) {
      if (!staffSession) {
        return NextResponse.json(
          { error: 'Unauthorized: Adding admin notes requires staff session' },
          { status: 403 }
        );
      }
      const updated = await updateOrderAdminNotes(id, adminNotes, actorRole, actorId);
      return NextResponse.json(updated);
    }

    if (!nextStatus) {
      return NextResponse.json({ error: 'New status or adminNotes is required' }, { status: 400 });
    }

    const updated = await transitionOrderStatus(id, nextStatus, actorRole, actorId, note);

    if (adminNotes !== undefined && staffSession) {
      await updateOrderAdminNotes(id, adminNotes, actorRole, actorId);
      updated.adminNotes = adminNotes;
    }

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Status transition failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
