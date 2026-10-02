// ==============================================================================
// JAINAM TRADERS - /api/gift-codes/[id] ROUTE HANDLER
// Update gift code status (PAUSED, ACTIVE, CANCELLED) or assign customer.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';
import { canPerformAction } from '@/lib/auth/staff-auth';
import { updateGiftCodeStatus, assignGiftCodeToCustomer, getGiftCodeRedemptionHistory } from '@/lib/gift-codes/gift-code-service';
import { GiftCodeStatus } from '@/lib/types';
import { storeDb } from '@/lib/db/store-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = getAuthenticatedStaffFromRequest(request);
    if (!staff || !canPerformAction(staff.role, 'view_gift_codes')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gift = storeDb.giftCodes.find((g) => g.id === id);
    if (!gift) {
      return NextResponse.json({ error: 'Gift code not found' }, { status: 404 });
    }

    const redemptions = getGiftCodeRedemptionHistory(gift.id);
    return NextResponse.json({ giftCode: gift, redemptions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve gift code';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = getAuthenticatedStaffFromRequest(request);
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Staff authentication required' }, { status: 401 });
    }

    if (!canPerformAction(staff.role, 'manage_gift_codes')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions' }, { status: 403 });
    }

    const body = await request.json();

    if (body.status) {
      const validStatuses: GiftCodeStatus[] = ['ACTIVE', 'PAUSED', 'CANCELLED'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }

      const res = updateGiftCodeStatus({
        id,
        status: body.status,
        actorId: staff.staffId,
        actorRole: staff.role,
      });

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, giftCode: res.giftCode });
    }

    if (body.customerId) {
      const res = assignGiftCodeToCustomer({
        id,
        customerId: body.customerId,
        customerEmail: body.customerEmail,
        customerName: body.customerName,
        actorId: staff.staffId,
        actorRole: staff.role,
      });

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, giftCode: res.giftCode });
    }

    return NextResponse.json({ error: 'No valid action specified' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update gift code';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
