// ==============================================================================
// JAINAM TRADERS - /api/customers ROUTE HANDLER
// Server-side paginated, searchable CRM customer list.
// Strictly protected: Only authorized Owner and Store Manager have access.
// Counter staff and unauthorized requests are rejected (401/403).
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';
import { canPerformAction } from '@/lib/auth/staff-auth';
import { getCustomerList } from '@/lib/crm/crm-service';
import { CustomerAccountStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const staff = getAuthenticatedStaffFromRequest(request);
    if (!staff) {
      return NextResponse.json(
        { error: 'Unauthorized: Staff authentication required to access customer CRM' },
        { status: 401 }
      );
    }

    if (!canPerformAction(staff.role, 'view_customers')) {
      return NextResponse.json(
        { error: 'Forbidden: Counter staff does not have access to full customer CRM' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = (searchParams.get('status') as CustomerAccountStatus) || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const sortBy = (searchParams.get('sortBy') as 'name' | 'spend' | 'orders' | 'date') || 'date';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const result = getCustomerList({
      search,
      status,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch customer list';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
