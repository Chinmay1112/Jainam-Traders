// ==============================================================================
// JAINAM TRADERS - /api/gift-codes ROUTE HANDLER
// Creation and management of stored redemption gift codes.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';
import { canPerformAction } from '@/lib/auth/staff-auth';
import { createGiftCode, getGiftCodes } from '@/lib/gift-codes/gift-code-service';
import { GiftCodeStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const staff = getAuthenticatedStaffFromRequest(request);
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Staff authentication required' }, { status: 401 });
    }

    if (!canPerformAction(staff.role, 'view_gift_codes')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = (searchParams.get('status') as GiftCodeStatus) || undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '15', 10);

    const result = getGiftCodes({
      search,
      status,
      customerId,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch gift codes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = getAuthenticatedStaffFromRequest(request);
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Staff authentication required' }, { status: 401 });
    }

    if (!canPerformAction(staff.role, 'create_gift_code')) {
      return NextResponse.json(
        { error: 'Forbidden: Only store owner or manager can issue gift codes' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.code || typeof body.code !== 'string') {
      return NextResponse.json({ error: 'Gift code string is required' }, { status: 400 });
    }

    const originalValue = Number(body.originalValue);
    if (!originalValue || originalValue <= 0) {
      return NextResponse.json({ error: 'Valid monetary amount (₹) is required' }, { status: 400 });
    }

    const result = createGiftCode({
      code: body.code,
      originalValue,
      customerId: body.customerId,
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      createdBy: staff.staffId,
      createdByName: staff.fullName,
      actorRole: staff.role,
      startsAt: body.startsAt,
      expiresAt: body.expiresAt,
      maxRedemptions: body.maxRedemptions ? Number(body.maxRedemptions) : 1,
      minOrderValue: body.minOrderValue ? Number(body.minOrderValue) : undefined,
      maxDiscount: body.maxDiscount ? Number(body.maxDiscount) : undefined,
      notes: body.notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, giftCode: result.giftCode, rawCode: result.rawCode }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create gift code';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
