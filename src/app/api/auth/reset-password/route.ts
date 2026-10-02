// ==============================================================================
// JAINAM TRADERS - RESET PASSWORD ENDPOINT
// Verifies OTP code and sets new password for verified customer.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validateCustomerEmail, isRealSupabaseConfigured } from '@/lib/auth/customer-auth';
import { customerStore } from '@/lib/auth/customer-store';
import { verifyOtpEmail } from '@/lib/email/otp-sender';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, newPassword } = body;

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { error: 'Email, verification code, and new password are required.' },
        { status: 400 }
      );
    }

    const { isValid, cleaned: cleanEmail } = validateCustomerEmail(String(email));
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 }
      );
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    // 1. Verify 6-digit OTP code
    const verification = verifyOtpEmail(cleanEmail, String(otp));
    if (!verification.success) {
      return NextResponse.json(
        { error: verification.error || 'Incorrect or expired verification code.' },
        { status: 400 }
      );
    }

    // 2. Update password in Supabase Auth (Customer passwords managed exclusively by Supabase)
    if (isRealSupabaseConfigured()) {
      try {
        const supabase = await createServerSupabaseClient();
        const { error: sbError } = await supabase.auth.updateUser({ password: String(newPassword) });
        if (sbError) {
          return NextResponse.json({ error: sbError.message }, { status: 400 });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update credentials in authentication provider.';
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been changed successfully. You can now sign in.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Reset password error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
