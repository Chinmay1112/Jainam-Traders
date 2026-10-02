import { NextRequest, NextResponse } from 'next/server';
import { recordOrderPayment } from '@/lib/db/store-service';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staffSession = getAuthenticatedStaffFromRequest(request);

    if (!staffSession) {
      return NextResponse.json(
        { error: 'Unauthorized: Recording counter payment requires an active staff session' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const amountReceived = Number(body.amountReceived);
    const paymentMethod = body.paymentMethod === 'UPI' ? 'UPI' : 'Cash';
    const notes = body.notes ? String(body.notes).trim() : undefined;

    if (isNaN(amountReceived) || amountReceived <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount. Amount received must be greater than zero.' },
        { status: 400 }
      );
    }

    const updatedOrder = await recordOrderPayment({
      orderId: id,
      amountReceived,
      paymentMethod,
      staffId: staffSession.staffId || staffSession.email,
      staffRole: staffSession.role,
      notes,
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Successfully recorded ${paymentMethod} payment of ₹${amountReceived} for order ${updatedOrder.orderNumber}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record counter payment';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
