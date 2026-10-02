// ==============================================================================
// JAINAM TRADERS - UNIFIED AUTHENTICATION ENDPOINT
// Single entry point for both Staff and Customer credentials.
// The server determines the account type from trusted server-side records.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { isStaffEmail, staffStore, verifyPassword, createStaffToken } from '@/lib/auth/staff-auth';
import { STAFF_COOKIE_NAME, CUSTOMER_COOKIE_NAME } from '@/lib/auth/server-guard';
import { customerStore } from '@/lib/auth/customer-store';
import { isRealSupabaseConfigured } from '@/lib/auth/customer-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawIdentifier = body.email || body.identifier;
    const password = body.password;

    if (!rawIdentifier || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const cleanIdentifier = String(rawIdentifier).trim().toLowerCase();

    // --------------------------------------------------------------------------
    // 1. Check if identifier belongs to an authorized staff account
    // --------------------------------------------------------------------------
    if (isStaffEmail(cleanIdentifier)) {
      const staffAccount = staffStore.findByEmailOrUsername(cleanIdentifier);
      if (!staffAccount || !staffAccount.isActive) {
        // Generic error: avoid leaking staff existence
        return NextResponse.json(
          { error: 'Invalid email or password.' },
          { status: 401 }
        );
      }

      const isMatch = verifyPassword(String(password), staffAccount.passwordHash, staffAccount.salt);
      if (!isMatch) {
        return NextResponse.json(
          { error: 'Invalid email or password.' },
          { status: 401 }
        );
      }

      staffStore.updateLastLogin(staffAccount.id);
      const token = createStaffToken(staffAccount);

      const response = NextResponse.json({
        success: true,
        isStaff: true,
        role: staffAccount.role,
        redirectTo: '/admin',
        user: {
          id: staffAccount.id,
          email: staffAccount.email,
          fullName: staffAccount.fullName,
          role: staffAccount.role,
        },
      });

      // Set secure HTTP-only staff session cookie
      response.cookies.set(STAFF_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600, // 7 days
      });

      return response;
    }

    // --------------------------------------------------------------------------
    // 2. Otherwise authenticate as Customer via Supabase Auth
    // --------------------------------------------------------------------------
    if (!isRealSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Authentication service is not configured.' },
        { status: 503 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanIdentifier,
      password: String(password),
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const user = data.user;
    return NextResponse.json({
      success: true,
      isStaff: false,
      role: 'customer',
      redirectTo: '/',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Valued Customer',
        phone: user.user_metadata?.phone,
        role: 'customer',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Authentication failure';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
