import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaffFromRequest, STAFF_COOKIE_NAME } from '@/lib/auth/server-guard';
import { staffStore, createStaffToken } from '@/lib/auth/staff-auth';

export async function GET(request: NextRequest) {
  const session = getAuthenticatedStaffFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false, staff: null }, { status: 401 });
  }

  // Also lookup latest from in-memory store if available
  const latestAccount = staffStore.findById(session.staffId);

  return NextResponse.json({
    authenticated: true,
    staff: {
      id: session.staffId,
      email: session.email,
      fullName: latestAccount?.fullName || session.fullName,
      role: session.role,
      phone: latestAccount?.phone || session.phone,
      avatarUrl: latestAccount?.avatarUrl || session.avatarUrl,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = getAuthenticatedStaffFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Staff session required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fullName, phone, avatarUrl } = body;

    const updatedAccount = staffStore.updateProfile(session.staffId, {
      fullName,
      phone,
      avatarUrl,
    });

    if (!updatedAccount) {
      return NextResponse.json({ error: 'Staff account not found' }, { status: 404 });
    }

    const updatedToken = createStaffToken(updatedAccount);
    const response = NextResponse.json({
      success: true,
      staff: {
        id: updatedAccount.id,
        email: updatedAccount.email,
        fullName: updatedAccount.fullName,
        role: updatedAccount.role,
        phone: updatedAccount.phone,
        avatarUrl: updatedAccount.avatarUrl,
      },
    });

    response.cookies.set(STAFF_COOKIE_NAME, updatedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600, // 7 days
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update staff profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
