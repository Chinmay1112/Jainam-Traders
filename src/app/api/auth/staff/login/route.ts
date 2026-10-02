import { NextRequest, NextResponse } from 'next/server';
import { staffStore, verifyPassword, createStaffToken } from '@/lib/auth/staff-auth';
import { STAFF_COOKIE_NAME } from '@/lib/auth/server-guard';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email/Username and Password are required' },
        { status: 400 }
      );
    }

    const account = staffStore.findByEmailOrUsername(String(identifier));
    if (!account) {
      return NextResponse.json(
        { error: 'Invalid staff credentials' },
        { status: 401 }
      );
    }

    if (!account.isActive) {
      return NextResponse.json(
        { error: 'Staff account has been deactivated. Please contact the owner.' },
        { status: 403 }
      );
    }

    const isMatch = verifyPassword(String(password), account.passwordHash, account.salt);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid staff credentials' },
        { status: 401 }
      );
    }

    staffStore.updateLastLogin(account.id);
    const token = createStaffToken(account);

    const response = NextResponse.json({
      success: true,
      staff: {
        id: account.id,
        email: account.email,
        fullName: account.fullName,
        role: account.role,
      },
    });

    // Set secure HTTP-only cookie
    response.cookies.set(STAFF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 3600, // 12 hours
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
