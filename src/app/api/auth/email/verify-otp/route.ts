import { NextRequest, NextResponse } from 'next/server';
import { validateCustomerEmail, isSupabaseConfigured } from '@/lib/auth/customer-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserProfile } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    const { isValid, cleaned } = validateCustomerEmail(email);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address.' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter a valid 6-digit verification code.',
          hindiError: 'कृपया 6 अंकों का मान्य सत्यापन कोड दर्ज करें।',
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
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleaned,
      token: code.trim(),
      type: 'email',
    });

    if (error || !data.user) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || 'Invalid or expired verification code.',
          hindiError: 'गलत या समाप्त हो चुका सत्यापन कोड।',
        },
        { status: 400 }
      );
    }

    const user = data.user;
    const profile: UserProfile = {
      id: user.id,
      fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Valued Customer',
      email: user.email || cleaned,
      phone: user.user_metadata?.phone,
      role: 'customer',
      createdAt: user.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      profile,
      message: 'Email verified successfully.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
