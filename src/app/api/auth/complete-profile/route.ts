// ==============================================================================
// JAINAM TRADERS - COMPLETE PROFILE ENDPOINT
// Completes first-time Google OAuth profile setup (Phone, Address, Password).
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { validatePickupPhone, isRealSupabaseConfigured } from '@/lib/auth/customer-auth';
import { customerStore } from '@/lib/auth/customer-store';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, address, password, fullName } = body;

    if (!email || !phone || !address) {
      return NextResponse.json(
        { error: 'Email, mobile number, and address are required.' },
        { status: 400 }
      );
    }

    const { isValid: isPhoneValid, cleaned: cleanPhone } = validatePickupPhone(String(phone));
    if (!isPhoneValid) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit Indian mobile number.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Update in Supabase if real Supabase configured
    if (isRealSupabaseConfigured()) {
      try {
        const supabase = await createServerSupabaseClient();
        const updatePayload: any = {
          data: {
            phone: cleanPhone,
            saved_address: String(address).trim(),
          },
        };
        if (fullName) updatePayload.data.full_name = String(fullName).trim();
        if (password && String(password).length >= 6) {
          updatePayload.password = String(password);
        }

        await supabase.auth.updateUser(updatePayload);
      } catch {
        // Fall back to local customer store
      }
    }

    // 2. Update Customer Store (Profile CRM only)
    const res = customerStore.completeProfile(cleanEmail, {
      fullName: fullName ? String(fullName).trim() : undefined,
      phone: cleanPhone,
      address: String(address).trim(),
    });

    return NextResponse.json({
      success: true,
      message: 'Profile completed successfully.',
      user: res.customer,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to complete profile';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
