// ==============================================================================
// JAINAM TRADERS - /api/customers/[id]/notes ROUTE HANDLER
// Internal CRM staff notes.
// STRICT PRIVACY: Restricted to Owner and Store Manager ONLY.
// Counter staff and customers receive 403 Forbidden.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';
import { canPerformAction } from '@/lib/auth/staff-auth';
import { addCustomerStaffNote } from '@/lib/crm/crm-service';
import { storeDb } from '@/lib/db/store-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = getAuthenticatedStaffFromRequest(request);

    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Staff authentication required' }, { status: 401 });
    }

    if (!canPerformAction(staff.role, 'add_customer_note')) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient role permissions to view internal notes' },
        { status: 403 }
      );
    }

    const notes = storeDb.customerNotes.filter((n) => n.customerId === id);
    return NextResponse.json({ notes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch notes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = getAuthenticatedStaffFromRequest(request);

    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Staff authentication required' }, { status: 401 });
    }

    if (!canPerformAction(staff.role, 'add_customer_note')) {
      return NextResponse.json(
        { error: 'Forbidden: Counter staff is not authorized to create internal notes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (!body.note || typeof body.note !== 'string' || !body.note.trim()) {
      return NextResponse.json({ error: 'Note text cannot be empty' }, { status: 400 });
    }

    const result = addCustomerStaffNote({
      customerId: id,
      note: body.note,
      authorId: staff.staffId,
      authorName: staff.fullName,
      authorRole: staff.role,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, note: result.note }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save note';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
