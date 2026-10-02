import { NextRequest, NextResponse } from 'next/server';
import { getRefundRecords, recordPhysicalRefund } from '@/lib/db/store-service';
import { enforceStaffRole } from '@/lib/auth/server-guard';

export async function GET(request: NextRequest) {
  // Only Owner and Store Manager can view internal refund financial ledgers
  const auth = enforceStaffRole(request, ['owner', 'store_manager']);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  try {
    const refunds = await getRefundRecords();
    return NextResponse.json({ refunds });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch refunds';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Only Owner and Store Manager can execute and record counter refunds
  const auth = enforceStaffRole(request, ['owner', 'store_manager']);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  try {
    const body = await request.json();
    const { orderId, returnRequestId, refundAmount, refundMethod, receiptNumber, notes } = body;

    if (!orderId || !refundAmount || !refundMethod || !receiptNumber) {
      return NextResponse.json({ error: 'Missing mandatory refund ledger fields' }, { status: 400 });
    }

    const record = await recordPhysicalRefund(
      orderId,
      returnRequestId,
      Number(refundAmount),
      refundMethod,
      receiptNumber,
      notes || '',
      auth.session.staffId,
      auth.session.fullName
    );

    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Recording refund failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
