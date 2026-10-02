// ==============================================================================
// JAINAM TRADERS - /api/customers/me ROUTE HANDLER
// Customer Self-Service endpoint for current authenticated session.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedCustomer } from '@/lib/auth/customer-auth-server';
import { customerStore } from '@/lib/auth/customer-store';
import { getCustomerDetails, anonymizeCustomerProfile } from '@/lib/crm/crm-service';

export async function GET(_request: NextRequest) {
  try {
    const customer = await getAuthenticatedCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }

    const details = getCustomerDetails(customer.id, 'customer', customer.id);
    if (!details) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    delete details.staffNotes;
    return NextResponse.json(details);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const customer = await getAuthenticatedCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }

    const body = await request.json();
    const updates: {
      fullName?: string;
      phone?: string;
      address?: string;
      avatarUrl?: string;
      languagePreference?: 'en' | 'hi';
      marketingCommunicationPreference?: boolean;
    } = {};

    if (body.fullName && typeof body.fullName === 'string') updates.fullName = body.fullName;
    if (body.phone && typeof body.phone === 'string') updates.phone = body.phone;
    if (body.address && typeof body.address === 'string') updates.address = body.address;
    if (body.avatarUrl && typeof body.avatarUrl === 'string') updates.avatarUrl = body.avatarUrl;
    if (body.languagePreference && (body.languagePreference === 'en' || body.languagePreference === 'hi')) {
      updates.languagePreference = body.languagePreference;
    }
    if (typeof body.marketingCommunicationPreference === 'boolean') {
      updates.marketingCommunicationPreference = body.marketingCommunicationPreference;
    }

    const res = customerStore.updateProfile(customer.id, updates);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, customer: res.customer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const customer = await getAuthenticatedCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
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
    const message = err instanceof Error ? err.message : 'Failed to deactivate account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
