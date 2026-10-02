// ==============================================================================
// JAINAM TRADERS - PRODUCTION-GRADE CUSTOMER ACCOUNT & PROFILE REPOSITORY
// Server-side authoritative customer identity and CRM business profile storage.
// Enforces:
// 1. Authentication is EXCLUSIVELY managed by Supabase Auth.
// 2. CustomerStore contains business/profile data only (NO passwords, NO hashes, NO salts).
// 3. Customer identity is ALWAYS Supabase user.id.
// 4. One Supabase identity = One persistent Customer Profile.
// 5. Customer Account Status: ACTIVE | SUSPENDED | DEACTIVATED
// 6. Controlled deactivation and privacy anonymization (never deletes historical orders).
// 7. Persistence across Next.js dev server warm requests via global singleton.
// ==============================================================================

import 'server-only';
import crypto from 'crypto';
import { CustomerAccountStatus, CustomerProfile } from '@/lib/types';
import { isStaffEmail } from './staff-auth';

export interface CustomerAccount {
  id: string; // Canonical Supabase Auth user.id
  userId: string; // Canonical Supabase Auth user.id (identical to id)
  email: string;
  fullName: string;
  phone: string;
  address: string;
  avatarUrl?: string;
  languagePreference: 'en' | 'hi';
  authenticationMethod: 'email_password' | 'google' | 'otp';
  accountStatus: CustomerAccountStatus;
  profileCompleted: boolean;
  marketingCommunicationPreference: boolean;
  lastKnownLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string;
  anonymizedAt?: string;
}

// Since CustomerAccount contains zero credentials, CustomerAccount is inherently safe
export type SafeCustomerAccount = CustomerAccount;

export const RESERVED_STAFF_EMAILS = [
  'admin@jainamtraders.com',
  'manager@jainamtraders.com',
  'staff@jainamtraders.com',
];

/**
 * Returns true if an email is reserved for authorized store staff/management
 */
export function isReservedStaffEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.toLowerCase().trim();
  if (RESERVED_STAFF_EMAILS.includes(clean)) return true;
  return isStaffEmail(clean);
}

class CustomerStore {
  // Primary email-indexed map
  private accounts: Map<string, CustomerAccount> = new Map();
  // Secondary index: id -> email
  private idToEmail: Map<string, string> = new Map();
  // Secondary index: userId -> email
  private userIdToEmail: Map<string, string> = new Map();

  constructor() {
    // Production store starts completely clean with ZERO mock customer accounts.
  }

  /**
   * Helper to index an account across maps
   */
  private indexAccount(account: CustomerAccount) {
    this.accounts.set(account.email.toLowerCase(), account);
    this.idToEmail.set(account.id, account.email.toLowerCase());
    this.userIdToEmail.set(account.userId, account.email.toLowerCase());
  }

  /**
   * Find customer by email (case-insensitive)
   */
  public findByEmail(email: string): CustomerAccount | null {
    if (!email) return null;
    const clean = email.toLowerCase().trim();
    return this.accounts.get(clean) || null;
  }

  /**
   * Find customer by internal ID / Supabase user ID
   */
  public findById(id: string): CustomerAccount | null {
    if (!id) return null;
    const email = this.idToEmail.get(id);
    if (email) return this.accounts.get(email) || null;
    for (const acc of this.accounts.values()) {
      if (acc.id === id) return acc;
    }
    return null;
  }

  /**
   * Find customer by Supabase Auth userId
   */
  public findByUserId(userId: string): CustomerAccount | null {
    if (!userId) return null;
    const email = this.userIdToEmail.get(userId);
    if (email) return this.accounts.get(email) || null;
    for (const acc of this.accounts.values()) {
      if (acc.userId === userId) return acc;
    }
    return null;
  }

  /**
   * Find customer by either internal ID or Supabase Auth userId
   */
  public findByIdOrUserId(idOrUserId: string): CustomerAccount | null {
    return this.findById(idOrUserId) || this.findByUserId(idOrUserId);
  }

  /**
   * Find or create persistent customer profile for an authenticated Supabase user
   * Guarantees 1 Supabase Auth Identity = 1 Customer Profile
   */
  public findOrCreateByAuthUser(params: {
    userId: string;
    email: string;
    phone?: string;
    fullName?: string;
    address?: string;
    authenticationMethod?: 'email_password' | 'google' | 'otp';
  }): CustomerAccount {
    const cleanEmail = params.email.toLowerCase().trim();

    // 1. Check existing account by Supabase userId or email
    let existing = this.findByUserId(params.userId) || this.findByEmail(cleanEmail);

    if (existing) {
      // Ensure userId matches Supabase identity
      if (params.userId && existing.userId !== params.userId) {
        existing.userId = params.userId;
        existing.id = params.userId;
        this.indexAccount(existing);
      }
      if (params.fullName && (!existing.fullName || existing.fullName === 'Valued Customer')) {
        existing.fullName = params.fullName.trim();
      }
      if (params.phone && !existing.phone) {
        existing.phone = params.phone.trim();
      }
      if (params.address && !existing.address) {
        existing.address = params.address.trim();
      }
      existing.profileCompleted = Boolean(existing.fullName && existing.phone && existing.address);
      existing.lastKnownLoginAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      return existing;
    }

    // 2. Create new profile linked to Supabase Auth user.id
    const newCustomer: CustomerAccount = {
      id: params.userId,
      userId: params.userId,
      email: cleanEmail,
      fullName: (params.fullName || cleanEmail.split('@')[0]).trim(),
      phone: params.phone?.trim() || '',
      address: params.address?.trim() || '',
      languagePreference: 'en',
      authenticationMethod: params.authenticationMethod || 'email_password',
      accountStatus: 'ACTIVE',
      profileCompleted: Boolean(params.fullName && params.phone && params.address),
      marketingCommunicationPreference: true,
      lastKnownLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.indexAccount(newCustomer);
    return newCustomer;
  }

  /**
   * Register customer profile in CRM from registration flow
   * (Password operations are handled exclusively by Supabase Auth)
   */
  public createAccount(data: {
    userId: string;
    fullName: string;
    phone: string;
    email: string;
    address: string;
    languagePreference?: 'en' | 'hi';
    authenticationMethod?: 'email_password' | 'google' | 'otp';
  }): { success: boolean; customer?: CustomerAccount; error?: string; code?: string } {
    const cleanEmail = data.email.toLowerCase().trim();

    // Check reserved staff email
    if (isReservedStaffEmail(cleanEmail)) {
      return {
        success: false,
        error: 'This email is reserved for store administration.',
        code: 'RESERVED_STAFF_EMAIL',
      };
    }

    // Check duplicate customer email
    if (this.accounts.has(cleanEmail) || this.findByUserId(data.userId)) {
      return {
        success: false,
        error: 'An account already exists with this email.',
        code: 'DUPLICATE_EMAIL',
      };
    }

    const newCustomer: CustomerAccount = {
      id: data.userId,
      userId: data.userId,
      email: cleanEmail,
      fullName: data.fullName.trim(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      languagePreference: data.languagePreference || 'en',
      authenticationMethod: data.authenticationMethod || 'email_password',
      accountStatus: 'ACTIVE',
      profileCompleted: Boolean(data.fullName.trim() && data.phone.trim() && data.address.trim()),
      marketingCommunicationPreference: true,
      lastKnownLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.indexAccount(newCustomer);
    return { success: true, customer: newCustomer };
  }

  /**
   * Upsert or complete customer profile (e.g. from Google OAuth or email sign-up)
   */
  public completeProfile(
    email: string,
    data: {
      userId?: string;
      fullName?: string;
      phone: string;
      address: string;
      languagePreference?: 'en' | 'hi';
      authenticationMethod?: 'email_password' | 'google' | 'otp';
    }
  ): { success: boolean; customer?: CustomerAccount; error?: string } {
    const cleanEmail = email.toLowerCase().trim();
    let account = this.accounts.get(cleanEmail);

    if (!account) {
      const resolvedUserId = data.userId || `cust-${Date.now().toString(36)}`;
      account = {
        id: resolvedUserId,
        userId: resolvedUserId,
        email: cleanEmail,
        fullName: (data.fullName || cleanEmail.split('@')[0]).trim(),
        phone: data.phone?.trim() || '',
        address: data.address?.trim() || '',
        languagePreference: data.languagePreference || 'en',
        authenticationMethod: data.authenticationMethod || 'google',
        accountStatus: 'ACTIVE',
        profileCompleted: Boolean((data.fullName || cleanEmail.split('@')[0]) && data.phone && data.address),
        marketingCommunicationPreference: true,
        lastKnownLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.indexAccount(account);
    } else {
      if (data.fullName) account.fullName = data.fullName.trim();
      if (data.phone !== undefined) account.phone = data.phone.trim();
      if (data.address !== undefined) account.address = data.address.trim();
      if (data.userId && account.userId !== data.userId) {
        account.userId = data.userId;
        account.id = data.userId;
      }
      if (data.languagePreference) account.languagePreference = data.languagePreference;
      account.profileCompleted = Boolean(account.fullName && account.phone && account.address);
      account.updatedAt = new Date().toISOString();
      this.indexAccount(account);
    }

    return { success: true, customer: account };
  }

  /**
   * Update self-service customer profile
   */
  public updateProfile(
    idOrUserId: string,
    updates: {
      fullName?: string;
      phone?: string;
      address?: string;
      avatarUrl?: string;
      languagePreference?: 'en' | 'hi';
      marketingCommunicationPreference?: boolean;
    }
  ): { success: boolean; customer?: CustomerAccount; error?: string } {
    const account = this.findByIdOrUserId(idOrUserId);
    if (!account) {
      return { success: false, error: 'Customer not found.' };
    }

    if (updates.fullName !== undefined) account.fullName = updates.fullName.trim();
    if (updates.phone !== undefined) account.phone = updates.phone.trim();
    if (updates.address !== undefined) account.address = updates.address.trim();
    if (updates.avatarUrl !== undefined) account.avatarUrl = updates.avatarUrl;
    if (updates.languagePreference !== undefined) account.languagePreference = updates.languagePreference;
    if (updates.marketingCommunicationPreference !== undefined) {
      account.marketingCommunicationPreference = updates.marketingCommunicationPreference;
    }

    account.profileCompleted = Boolean(account.fullName && account.phone && account.address);
    account.updatedAt = new Date().toISOString();

    return { success: true, customer: account };
  }

  /**
   * Update customer account status (ACTIVE | SUSPENDED | DEACTIVATED)
   */
  public updateStatus(
    idOrUserId: string,
    status: CustomerAccountStatus
  ): { success: boolean; customer?: CustomerAccount; error?: string } {
    const account = this.findByIdOrUserId(idOrUserId);
    if (!account) {
      return { success: false, error: 'Customer not found.' };
    }

    account.accountStatus = status;
    account.updatedAt = new Date().toISOString();
    if (status === 'DEACTIVATED') {
      account.deactivatedAt = new Date().toISOString();
    }

    return { success: true, customer: account };
  }

  /**
   * Privacy-compliant deactivation & anonymization
   * Scrubs PII while maintaining historical orders and financial integrity.
   */
  public anonymizeAccount(
    idOrUserId: string
  ): { success: boolean; error?: string } {
    const account = this.findByIdOrUserId(idOrUserId);
    if (!account) {
      return { success: false, error: 'Customer not found.' };
    }

    account.accountStatus = 'DEACTIVATED';
    account.fullName = 'Former Customer';
    account.phone = '0000000000';
    account.address = 'Anonymized on Customer Request';
    account.deactivatedAt = new Date().toISOString();
    account.anonymizedAt = new Date().toISOString();
    account.updatedAt = new Date().toISOString();

    return { success: true };
  }

  /**
   * Retrieve all customer accounts safely
   */
  public getAllAccounts(): CustomerAccount[] {
    return Array.from(this.accounts.values());
  }

  public getAllCustomersCount(): number {
    return this.accounts.size;
  }
}

// Preserve across Next.js dev server rebuilds
const globalCustomer = global as unknown as { __jtCustomerStore?: CustomerStore };
export const customerStore = globalCustomer.__jtCustomerStore || new CustomerStore();
if (process.env.NODE_ENV !== 'production') {
  globalCustomer.__jtCustomerStore = customerStore;
}
