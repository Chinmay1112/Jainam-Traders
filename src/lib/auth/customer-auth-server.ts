// ==============================================================================
// JAINAM TRADERS - SERVER-SIDE CUSTOMER AUTH HELPER
// Uses next/headers cookies and Supabase SSR Server Client.
// Server Component / Route Handler ONLY.
// ==============================================================================

import { UserProfile } from '@/lib/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { customerStore } from './customer-store';

/**
 * Server-side helper to retrieve verified customer from Supabase SSR session or customer cookie
 */
export async function getAuthenticatedCustomer(): Promise<UserProfile | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Supabase Auth user present (e.g. Google OAuth or Supabase Email)
    const existingCust =
      customerStore.findByUserId(user.id) ||
      (user.email ? customerStore.findByEmail(user.email) : null);

    if (existingCust) {
      existingCust.userId = user.id;
      existingCust.id = user.id;
      return {
        id: user.id,
        fullName: existingCust.fullName,
        email: existingCust.email,
        phone: existingCust.phone,
        role: 'customer',
        savedAddress: existingCust.address,
        accountStatus: existingCust.accountStatus,
        languagePreference: existingCust.languagePreference,
        profileCompleted: existingCust.profileCompleted,
        avatarUrl: user.user_metadata?.avatar_url || undefined,
        createdAt: existingCust.createdAt,
        updatedAt: existingCust.updatedAt,
      };
    }

    // Auto-link newly authenticated Supabase customer into customerStore
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Valued Customer';
    const email = user.email || `${user.id}@customer.jainamtraders.com`;

    const cust = customerStore.findOrCreateByAuthUser({
      userId: user.id,
      email,
      fullName,
      phone: user.phone || user.user_metadata?.phone || '',
      address: user.user_metadata?.saved_address || '',
      authenticationMethod: user.app_metadata?.provider === 'google' ? 'google' : 'email_password',
    });

    return {
      id: user.id,
      fullName: cust.fullName,
      email: cust.email,
      phone: cust.phone || undefined,
      role: 'customer',
      savedAddress: cust.address || undefined,
      accountStatus: cust.accountStatus,
      languagePreference: cust.languagePreference,
      profileCompleted: cust.profileCompleted,
      avatarUrl: user.user_metadata?.avatar_url || undefined,
      createdAt: user.created_at || new Date().toISOString(),
      updatedAt: user.updated_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Server-side helper for route handlers with NextRequest
 */
export async function getAuthenticatedCustomerFromRequest(
  _request?: NextRequest
): Promise<UserProfile | null> {
  return getAuthenticatedCustomer();
}
