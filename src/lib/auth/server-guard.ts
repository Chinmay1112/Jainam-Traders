import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from './staff-auth';
import { StaffSession, StaffRole, canPerformAction } from './staff-roles';
import { cookies } from 'next/headers';

export const STAFF_COOKIE_NAME = 'jt_staff_token';
export const CUSTOMER_COOKIE_NAME = 'jt_customer_token';

// Extract staff session from request cookies or headers
export function getAuthenticatedStaffFromRequest(request: NextRequest): StaffSession | null {
  // 1. Check HTTP-only cookie
  const cookie = request.cookies.get(STAFF_COOKIE_NAME)?.value;
  if (cookie) {
    const session = verifyStaffToken(cookie);
    if (session) return session;
  }

  // 2. Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const session = verifyStaffToken(token);
    if (session) return session;
  }

  return null;
}

// Server Component helper using next/headers cookies()
export async function getAuthenticatedStaff(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyStaffToken(token);
}

// Route Handler Authorization Enforcer
export function enforceStaffRole(
  request: NextRequest,
  allowedRoles: StaffRole[] = ['owner', 'store_manager', 'staff']
): { session: StaffSession } | { errorResponse: NextResponse } {
  const session = getAuthenticatedStaffFromRequest(request);

  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Staff authentication required' },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(session.role)) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Insufficient role permissions' },
        { status: 403 }
      ),
    };
  }

  return { session };
}
