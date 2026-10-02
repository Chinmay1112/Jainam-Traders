import { NextRequest, NextResponse } from 'next/server';
import { validateCustomerEmail, isSupabaseConfigured } from '@/lib/auth/customer-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    const { isValid, cleaned } = validateCustomerEmail(email);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter a valid email address (e.g. yourname@gmail.com).',
          hindiError: 'कृपया एक मान्य ईमेल पता दर्ज करें।',
        },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication service is not configured.',
          hindiError: 'प्रमाणीकरण सेवा अभी कॉन्फ़िगर नहीं है।',
        },
        { status: 503 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: cleaned,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email.',
      hindiMessage: 'ओटीपी आपके ईमेल पर भेज दिया गया है।',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process request';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
