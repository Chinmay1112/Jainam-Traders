// ==============================================================================
// JAINAM TRADERS - /api/admin/audit-logs ROUTE HANDLER
// Immutable system audit trail restricted to store Owner.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';
import { canPerformAction } from '@/lib/auth/staff-auth';
import { storeDb } from '@/lib/db/store-service';

export async function GET(request: NextRequest) {
  try {
    const staff = getAuthenticatedStaffFromRequest(request);
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Staff authentication required' }, { status: 401 });
    }

    if (!canPerformAction(staff.role, 'view_audit_logs')) {
      return NextResponse.json(
        { error: 'Forbidden: Only the store Owner is authorized to view audit logs' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity') || undefined;
    const action = searchParams.get('action') || undefined;

    let logs = storeDb.auditLogs;
    if (entity) {
      logs = logs.filter((l) => l.entity === entity);
    }
    if (action) {
      logs = logs.filter((l) => l.action.toLowerCase().includes(action.toLowerCase()));
    }

    return NextResponse.json({ logs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch audit logs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
