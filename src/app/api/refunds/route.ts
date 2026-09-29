import { NextRequest, NextResponse } from 'next/server';
import { getRefundRecords, recordPhysicalRefund } from '@/lib/db/store-service';

export async function GET() {
  try {
    const refunds = await getRefundRecords();
    return NextResponse.json({ refunds });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch refunds';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, returnRequestId, refundAmount, refundMethod, receiptNumber, notes, staffId, staffName } = body;

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
      staffId || 'staff-1',
      staffName || 'Counter Staff'
    );

    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Recording refund failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
