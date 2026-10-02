// ==============================================================================
// JAINAM TRADERS - FORGOT PASSWORD ENDPOINT
// Checks if account exists before sending recovery OTP code.
// Does NOT create user accounts during recovery.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validateCustomerEmail, isRealSupabaseConfigured } from '@/lib/auth/customer-auth';
import { customerStore, isReservedStaffEmail } from '@/lib/auth/customer-store';
import { sendOtpEmail } from '@/lib/email/otp-sender';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    const { isValid, cleaned: cleanEmail } = validateCustomerEmail(String(email));
    if (!isValid) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (isReservedStaffEmail(cleanEmail)) {
      return NextResponse.json(
        {
          error: 'Staff passwords cannot be reset via customer recovery. Please contact the store owner.',
          isStaff: true,
        },
        { status: 400 }
      );
    }

    if (!isRealSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Authentication service is not configured.' },
        { status: 503 }
      );
    }

    // 1. Check if customer account exists in Supabase
    let userExists = false;
    try {
      const supabase = await createServerSupabaseClient();
      // Trigger password reset email from Supabase without auto-creating user
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/reset-password`,
      });

        if (resetError) {
          const msg = resetError.message.toLowerCase();
          if (msg.includes('not found') || msg.includes('does not exist')) {
            return NextResponse.json(
              {
                success: false,
                exists: false,
                error: 'No account found with this email.',
                canSignup: true,
              },
              { status: 404 }
            );
          }
        }
        userExists = true;
      } catch {
        // Fall back to local check
      }

    const localAccount = customerStore.findByEmail(cleanEmail);
    if (localAccount) {
      userExists = true;
    }

    if (!userExists) {
      return NextResponse.json(
        {
          success: false,
          exists: false,
          error: 'No account found with this email.',
          canSignup: true,
        },
        { status: 404 }
      );
    }

    // 2. Deliver verified 6-digit recovery OTP code via SMTP
    const delivery = await sendOtpEmail(cleanEmail);

    if (!delivery.success) {
      return NextResponse.json(
        {
          success: false,
          error: delivery.error || 'Failed to deliver recovery code. Please check SMTP configuration.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      exists: true,
      message: 'A 6-digit verification code has been sent to your email.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Forgot password error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
