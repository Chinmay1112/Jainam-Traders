// ==============================================================================
// JAINAM TRADERS - /api/customers/[id] ROUTE HANDLER
// Customer detail, account status updates, self-service profile edits, and anonymization.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';
import { getAuthenticatedCustomer } from '@/lib/auth/customer-auth-server';
import { canPerformAction } from '@/lib/auth/staff-auth';
import {
  getCustomerDetails,
  updateCustomerAccountStatus,
  anonymizeCustomerProfile,
} from '@/lib/crm/crm-service';
import { customerStore } from '@/lib/auth/customer-store';
import { CustomerAccountStatus } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = getAuthenticatedStaffFromRequest(request);

    if (staff) {
      if (!canPerformAction(staff.role, 'view_customers')) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient role permissions to view customer profile' },
          { status: 403 }
        );
      }

      const detail = getCustomerDetails(id, staff.role);
      if (!detail) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      return NextResponse.json(detail);
    }

    // Customer Session
    const customer = await getAuthenticatedCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    // Customer Isolation: Customer can ONLY query their own profile!
    const detail = getCustomerDetails(id, 'customer', customer.id);
    if (!detail) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot access another customer\'s profile' },
        { status: 403 }
      );
    }

    // Guarantee staff notes are NEVER exposed to customer
    delete detail.staffNotes;

    return NextResponse.json(detail);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve customer';
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
    const staff = getAuthenticatedStaffFromRequest(request);

    // 1. Staff modifying customer status (Part 4)
    if (staff) {
      if (body.accountStatus) {
        if (!canPerformAction(staff.role, 'manage_customer_status')) {
          return NextResponse.json(
            { error: 'Forbidden: You do not have permission to change customer status' },
            { status: 403 }
          );
        }

        const validStatuses: CustomerAccountStatus[] = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];
        if (!validStatuses.includes(body.accountStatus)) {
          return NextResponse.json({ error: 'Invalid account status value' }, { status: 400 });
        }

        const res = updateCustomerAccountStatus({
          customerId: id,
          status: body.accountStatus,
          actorId: staff.staffId,
          actorName: staff.fullName,
          actorRole: staff.role,
          reason: body.reason,
        });

        if (!res.success) {
          return NextResponse.json({ error: res.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, customer: res.customer });
      }
    }

    // 2. Customer self-service profile update (Part 11)
    const customer = await getAuthenticatedCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check customer isolation
    if (customer.id !== id && id !== 'me') {
      return NextResponse.json(
        { error: 'Forbidden: You cannot edit another customer\'s profile' },
        { status: 403 }
      );
    }

    // Validate inputs
    const updates: {
      fullName?: string;
      phone?: string;
      address?: string;
      languagePreference?: 'en' | 'hi';
      marketingCommunicationPreference?: boolean;
    } = {};

    if (body.fullName && typeof body.fullName === 'string') updates.fullName = body.fullName;
    if (body.phone && typeof body.phone === 'string') updates.phone = body.phone;
    if (body.address && typeof body.address === 'string') updates.address = body.address;
    if (body.languagePreference && (body.languagePreference === 'en' || body.languagePreference === 'hi')) {
      updates.languagePreference = body.languagePreference;
    }
    if (typeof body.marketingCommunicationPreference === 'boolean') {
      updates.marketingCommunicationPreference = body.marketingCommunicationPreference;
    }

    const updated = customerStore.updateProfile(customer.id, updates);
    if (!updated.success) {
      return NextResponse.json({ error: updated.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, customer: updated.customer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update customer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = getAuthenticatedStaffFromRequest(request);

    if (staff) {
      if (staff.role !== 'owner') {
        return NextResponse.json(
          { error: 'Forbidden: Only store owner can trigger customer privacy deletion' },
          { status: 403 }
        );
      }

      const res = anonymizeCustomerProfile({
        customerId: id,
        actorId: staff.staffId,
        actorRole: 'owner',
      });

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Customer anonymized and deactivated' });
    }

    // Customer self-deletion request (Part 14)
    const customer = await getAuthenticatedCustomer();
    if (!customer || (customer.id !== id && id !== 'me')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = anonymizeCustomerProfile({
      customerId: customer.id,
      actorId: customer.id,
      actorRole: 'customer',
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Account successfully deactivated and personal information anonymized.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
