import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';

export async function GET(request: NextRequest) {
  const session = getAuthenticatedStaffFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false, staff: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    staff: {
      id: session.staffId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
    },
  });
}
