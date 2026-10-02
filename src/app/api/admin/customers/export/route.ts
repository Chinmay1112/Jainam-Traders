// ==============================================================================
// JAINAM TRADERS - /api/admin/customers/export ROUTE HANDLER
// Secure operational customer export strictly restricted to store Owner.
// Never exposes passwords, password hashes, salts, or session tokens.
// Audits every export operation.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';
import { canPerformAction } from '@/lib/auth/staff-auth';
import { getCustomerList } from '@/lib/crm/crm-service';
import { storeDb } from '@/lib/db/store-service';

export async function GET(request: NextRequest) {
  try {
    const staff = getAuthenticatedStaffFromRequest(request);
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Staff authentication required' }, { status: 401 });
    }

    // Strictly Owner Only (Part 39 & 40)
    if (!canPerformAction(staff.role, 'export_customers')) {
      return NextResponse.json(
        { error: 'Forbidden: Only the store Owner is authorized to export customer data' },
        { status: 403 }
      );
    }

    const { customers } = getCustomerList({ page: 1, limit: 1000 });

    // Generate clean CSV with only authorized fields
    const headers = ['Customer ID', 'Full Name', 'Email', 'Phone', 'Account Status', 'Total Orders', 'Total Spend (₹)', 'Registered On'];
    const rows = customers.map((c) => [
      `"${c.id}"`,
      `"${c.fullName.replace(/"/g, '""')}"`,
      `"${c.email.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${c.accountStatus}"`,
      c.orderCount,
      c.totalSpend,
      `"${c.registeredOn}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    // Immutable audit record
    storeDb.logAudit(staff.staffId, staff.role, 'EXPORT_CUSTOMERS', 'customers', 'all', {
      exportedCount: customers.length,
      format: 'csv',
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="jainam_traders_customers_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
