// ==============================================================================
// JAINAM TRADERS - CUSTOMER REGISTRATION ENDPOINT
// Enforces:
// 1. One email = one customer account
// 2. Strict rejection of reserved staff emails
// 3. Indian phone format and address validation
// 4. Supabase Auth registration with metadata
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validateCustomerEmail, validatePickupPhone, isRealSupabaseConfigured } from '@/lib/auth/customer-auth';
import { customerStore, isReservedStaffEmail } from '@/lib/auth/customer-store';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CUSTOMER_COOKIE_NAME } from '@/lib/auth/server-guard';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, phone, email, address, password } = body;

    // 1. Required fields check
    if (!fullName || !phone || !email || !address || !password) {
      return NextResponse.json(
        { error: 'All fields (full name, phone, email, address, password) are required.' },
        { status: 400 }
      );
    }

    // 2. Email format validation
    const { isValid: isEmailValid, cleaned: cleanEmail } = validateCustomerEmail(String(email));
    if (!isEmailValid) {
      return NextResponse.json(
        { error: 'Please enter a valid email address (e.g. name@gmail.com).' },
        { status: 400 }
      );
    }

    // 3. Reserved staff email check
    if (isReservedStaffEmail(cleanEmail)) {
      return NextResponse.json(
        {
          error: 'This email is reserved for store administration. Please sign in or use your personal email.',
          code: 'RESERVED_STAFF_EMAIL',
        },
        { status: 400 }
      );
    }

    // 4. Indian phone format check
    const { isValid: isPhoneValid, cleaned: cleanPhone } = validatePickupPhone(String(phone));
    if (!isPhoneValid) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit Indian mobile number (starting with 6-9).' },
        { status: 400 }
      );
    }

    // 5. Password strength check
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    // 6. Check duplicate email in local customer store
    const existingLocal = customerStore.findByEmail(cleanEmail);
    if (existingLocal) {
      return NextResponse.json(
        {
          error: 'An account already exists with this email. Please sign in or use Forgot Password.',
          code: 'DUPLICATE_EMAIL',
        },
        { status: 409 }
      );
    }

    // 7. Register in Supabase Auth
    if (!isRealSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Authentication service is not configured.' },
        { status: 503 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: String(password),
      options: {
        data: {
          full_name: String(fullName).trim(),
          phone: cleanPhone,
          saved_address: String(address).trim(),
        },
      },
    });

    if (error) {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('already registered') || errorMsg.includes('user already exists')) {
        return NextResponse.json(
          {
            error: 'An account already exists with this email. Please sign in or use Forgot Password.',
            code: 'DUPLICATE_EMAIL',
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Record customer business profile in customerStore linked to Supabase Auth user.id
    const userId = data.user?.id || `cust-${Date.now().toString(36)}`;
    customerStore.createAccount({
      userId,
      fullName: String(fullName).trim(),
      phone: cleanPhone,
      email: cleanEmail,
      address: String(address).trim(),
    });

    return NextResponse.json({
      success: true,
      message: 'Account created successfully.',
      user: {
        id: data.user?.id,
        email: cleanEmail,
        fullName: String(fullName).trim(),
        phone: cleanPhone,
        role: 'customer',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signup error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
