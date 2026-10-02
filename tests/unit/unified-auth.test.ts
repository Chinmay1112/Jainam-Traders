import { describe, it, expect, beforeEach } from 'vitest';
import {
  authenticateStaff,
  isStaffEmail,
  verifyStaffToken,
  createStaffToken,
  canPerformAction,
  staffStore,
  hashPassword,
  verifyPassword,
} from '@/lib/auth/staff-auth';
import {
  customerStore,
  isReservedStaffEmail,
} from '@/lib/auth/customer-store';
import { TRANSLATIONS, getTranslation, Language } from '@/lib/i18n/translations';
import { verifyOtpEmail } from '@/lib/email/otp-sender';
import { TEST_STAFF_PASSWORDS } from '../fixtures/test-fixtures';

describe('Unified Authentication & Security Suite', () => {
  beforeEach(() => {
    // Fresh test context
  });

  // =========================================================================
  // 1. STAFF AUTHENTICATION (Server-Determined)
  // =========================================================================
  describe('Staff Authentication & RBAC', () => {
    it('authenticates Owner (admin@jainamtraders.com) with correct role and capabilities', async () => {
      expect(isStaffEmail('admin@jainamtraders.com')).toBe(true);
      const session = await authenticateStaff('admin@jainamtraders.com', TEST_STAFF_PASSWORDS.admin);
      expect(session).not.toBeNull();
      expect(session?.role).toBe('owner');
      expect(session?.email).toBe('admin@jainamtraders.com');

      // Verify owner permissions
      expect(canPerformAction('owner', 'manage_settings')).toBe(true);
      expect(canPerformAction('owner', 'manage_staff')).toBe(true);
      expect(canPerformAction('owner', 'change_prices')).toBe(true);
      expect(canPerformAction('owner', 'view_full_analytics')).toBe(true);
    });

    it('authenticates Manager (manager@jainamtraders.com) with correct role and capabilities', async () => {
      expect(isStaffEmail('manager@jainamtraders.com')).toBe(true);
      const session = await authenticateStaff('manager@jainamtraders.com', TEST_STAFF_PASSWORDS.manager);
      expect(session).not.toBeNull();
      expect(session?.role).toBe('store_manager');

      // Verify manager permissions (can manage products and orders, cannot change base settings or staff)
      expect(canPerformAction('store_manager', 'manage_products')).toBe(true);
      expect(canPerformAction('store_manager', 'process_order_pickup')).toBe(true);
      expect(canPerformAction('store_manager', 'manage_settings')).toBe(false);
      expect(canPerformAction('store_manager', 'manage_staff')).toBe(false);
    });

    it('authenticates Counter Staff (staff@jainamtraders.com) with restricted counter capabilities', async () => {
      expect(isStaffEmail('staff@jainamtraders.com')).toBe(true);
      const session = await authenticateStaff('staff@jainamtraders.com', TEST_STAFF_PASSWORDS.staff);
      expect(session).not.toBeNull();
      expect(session?.role).toBe('staff');

      // Counter staff can verify orders and pickup, but cannot alter products or store settings
      expect(canPerformAction('staff', 'view_orders')).toBe(true);
      expect(canPerformAction('staff', 'verify_pickup')).toBe(true);
      expect(canPerformAction('staff', 'process_order_pickup')).toBe(true);
      expect(canPerformAction('staff', 'manage_products')).toBe(false);
      expect(canPerformAction('staff', 'change_prices')).toBe(false);
    });

    it('rejects staff login with invalid password without exposing role details', async () => {
      const session = await authenticateStaff('admin@jainamtraders.com', 'WrongPassword!99');
      expect(session).toBeNull();
    });

    it('rejects unknown staff email', async () => {
      const session = await authenticateStaff('impostor@jainamtraders.com', TEST_STAFF_PASSWORDS.admin);
      expect(session).toBeNull();
      expect(isStaffEmail('impostor@jainamtraders.com')).toBe(false);
    });
  });

  // =========================================================================
  // 2. CUSTOMER SIGNUP & EMAIL UNIQUENESS
  // =========================================================================
  describe('Customer Signup & Identity Invariants', () => {
    const testEmail = `customer_${Date.now()}@example.com`;

    it('registers a new customer with valid inputs', () => {
      const result = customerStore.createAccount({
        userId: 'auth-user-aarav-1',
        fullName: 'Aarav Mehta',
        phone: '9000000000',
        email: testEmail,
        address: '14 MG Road, Indore, MP',
      });

      expect(result.success).toBe(true);
      expect(result.customer).toBeDefined();
      expect(result.customer?.email).toBe(testEmail.toLowerCase());
      expect(result.customer?.fullName).toBe('Aarav Mehta');
      expect(result.customer?.phone).toBe('9000000000');
      expect(result.customer?.address).toBe('14 MG Road, Indore, MP');
    });

    it('strictly prevents duplicate customer registration with the same email', () => {
      const duplicateResult = customerStore.createAccount({
        userId: 'auth-user-dup-2',
        fullName: 'Another Person',
        phone: '9123456780',
        email: testEmail,
        address: 'Different Street, Indore',
      });

      expect(duplicateResult.success).toBe(false);
      expect(duplicateResult.code).toBe('DUPLICATE_EMAIL');
      expect(duplicateResult.error).toContain('already exists');
    });

    it('strictly prohibits signup using reserved staff emails', () => {
      expect(isReservedStaffEmail('admin@jainamtraders.com')).toBe(true);
      expect(isReservedStaffEmail('manager@jainamtraders.com')).toBe(true);
      expect(isReservedStaffEmail('staff@jainamtraders.com')).toBe(true);

      const staffSignupResult = customerStore.createAccount({
        userId: 'auth-user-fake-admin',
        fullName: 'Fake Admin',
        phone: '9988776655',
        email: 'admin@jainamtraders.com',
        address: 'Jainam Traders HQ',
      });

      expect(staffSignupResult.success).toBe(false);
      expect(staffSignupResult.code).toBe('RESERVED_STAFF_EMAIL');
      expect(staffSignupResult.error).toContain('reserved');
    });
  });

  // =========================================================================
  // 3. CUSTOMER LOGIN & PASSWORD AUTH
  // =========================================================================
  describe('Customer Profile CRM & Supabase Auth Separation', () => {
    const loginEmail = `login_test_${Date.now()}@example.com`;

    it('creates profile in customerStore without storing passwords or password hashes', () => {
      const created = customerStore.createAccount({
        userId: 'supabase-user-uuid-999',
        fullName: 'Kavita Sharma',
        phone: '9826012345',
        email: loginEmail,
        address: '52 Sarafa Bazaar, Indore',
      });

      expect(created.success).toBe(true);
      expect(created.customer).toBeDefined();
      expect(created.customer?.email).toBe(loginEmail.toLowerCase());
      expect(created.customer?.fullName).toBe('Kavita Sharma');
      expect(created.customer?.userId).toBe('supabase-user-uuid-999');

      // Verify CustomerStore contains business data ONLY: NO passwordHash, NO salt, NO authenticate method
      const custRecord = created.customer as unknown as Record<string, unknown>;
      expect(custRecord.passwordHash).toBeUndefined();
      expect(custRecord.passwordSalt).toBeUndefined();
      expect(custRecord.salt).toBeUndefined();
      expect((customerStore as unknown as Record<string, unknown>).authenticate).toBeUndefined();
    });

    it('ensures single identity per Supabase user ID across profile completion and queries', () => {
      const existing = customerStore.findByIdOrUserId('supabase-user-uuid-999');
      expect(existing).toBeDefined();
      expect(existing?.email).toBe(loginEmail.toLowerCase());

      const byEmail = customerStore.findByEmail(loginEmail);
      expect(byEmail).toBeDefined();
      expect(byEmail?.userId).toBe('supabase-user-uuid-999');
      expect(byEmail?.id).toBe(existing?.id);
    });

    it('rejects unknown or invalid customer lookups safely', () => {
      const unknown = customerStore.findByIdOrUserId('nonexistent-uuid');
      expect(unknown).toBeNull();
      const unknownEmail = customerStore.findByEmail('nonexistent@example.com');
      expect(unknownEmail).toBeNull();
    });
  });

  // =========================================================================
  // 4. FORGOT PASSWORD & OTP RECOVERY FLOW
  // =========================================================================
  describe('Forgot Password & Recovery Flow', () => {
    const forgotEmail = `forgot_${Date.now()}@example.com`;

    it('verifies non-existent email lookup returns null in customer identity store', () => {
      const found = customerStore.findByEmail('completely_unknown@example.com');
      expect(found).toBeNull();
    });

    it('creates customer profile in CRM and retrieves profile by email or userId', () => {
      const createRes = customerStore.createAccount({
        userId: 'sb-ramesh-101',
        fullName: 'Ramesh Patel',
        phone: '9893012345',
        email: forgotEmail,
        address: '88 Rajwada, Indore',
      });
      expect(createRes.success).toBe(true);
      expect(createRes.customer?.id).toBe('sb-ramesh-101');
      expect(createRes.customer?.accountStatus).toBe('ACTIVE');

      const byEmail = customerStore.findByEmail(forgotEmail);
      expect(byEmail).toBeDefined();
      expect(byEmail?.fullName).toBe('Ramesh Patel');

      const byUserId = customerStore.findByUserId('sb-ramesh-101');
      expect(byUserId).toBeDefined();
      expect(byUserId?.email).toBe(forgotEmail.toLowerCase());
    });

    it('rejects duplicate customer registration for existing email', () => {
      const dup = customerStore.createAccount({
        userId: 'sb-ramesh-duplicate',
        fullName: 'Ramesh Duplicate',
        phone: '9893012345',
        email: forgotEmail,
        address: 'Another address',
      });
      expect(dup.success).toBe(false);
      expect(dup.code).toBe('DUPLICATE_EMAIL');
    });
  });

  // =========================================================================
  // 5. GOOGLE AUTH & FIRST-TIME PROFILE SETUP
  // =========================================================================
  describe('Google OAuth & Profile Completion Flow', () => {
    const googleEmail = `google_user_${Date.now()}@gmail.com`;

    it('completes first-time Google customer profile with mobile and address', () => {
      const result = customerStore.completeProfile(googleEmail, {
        userId: 'google-uid-priya',
        fullName: 'Priya Joshi',
        phone: '9425012345',
        address: '21 Chhappan Dukan, Indore',
      });

      expect(result.success).toBe(true);
      expect(result.customer).toBeDefined();
      expect(result.customer?.email).toBe(googleEmail.toLowerCase());
      expect(result.customer?.phone).toBe('9425012345');
      expect(result.customer?.userId).toBe('google-uid-priya');
      expect(result.customer?.fullName).toBe('Priya Joshi');
    });

    it('prevents creating duplicate account when Google user later tries to signup with same email', () => {
      const duplicateSignup = customerStore.createAccount({
        userId: 'impostor-uid',
        fullName: 'Priya Joshi Impostor',
        phone: '9999999999',
        email: googleEmail,
        address: 'Another address',
      });

      expect(duplicateSignup.success).toBe(false);
      expect(duplicateSignup.code).toBe('DUPLICATE_EMAIL');
    });
  });

  // =========================================================================
  // 6. BILINGUAL TRANSLATION & I18N SUPPORT
  // =========================================================================
  describe('Bilingual (Hindi / English) UX Support', () => {
    it('provides accurate Hindi and English translations for core auth labels', () => {
      expect(getTranslation('en', 'signInTitle')).toBe('Sign In');
      expect(getTranslation('hi', 'signInTitle')).toBe('लॉग इन करें');

      expect(getTranslation('en', 'createAccount')).toBe('Create Account');
      expect(getTranslation('hi', 'createAccount')).toBe('नया खाता बनाएँ');

      expect(getTranslation('en', 'forgotPassword')).toBe('Forgot Password?');
      expect(getTranslation('hi', 'forgotPassword')).toBe('पासवर्ड भूल गए?');

      expect(getTranslation('en', 'continueWithGoogle')).toBe('Continue with Google');
      expect(getTranslation('hi', 'continueWithGoogle')).toBe('Google से जारी रखें');

      expect(getTranslation('en', 'callShop')).toBe('Call Jainam Traders');
      expect(getTranslation('hi', 'callShop')).toBe('दुकान पर फोन करें');

      expect(getTranslation('en', 'whatsApp')).toBe('WhatsApp Jainam Traders');
      expect(getTranslation('hi', 'whatsApp')).toBe('WhatsApp पर मदद लें');
    });

    it('contains no placeholder or empty strings in either language dictionary', () => {
      const keys = Object.keys(TRANSLATIONS.en) as (keyof typeof TRANSLATIONS.en)[];
      for (const k of keys) {
        expect(TRANSLATIONS.en[k]).toBeTruthy();
        expect(TRANSLATIONS.hi[k]).toBeTruthy();
        expect(typeof TRANSLATIONS.en[k]).toBe('string');
        expect(typeof TRANSLATIONS.hi[k]).toBe('string');
      }
    });
  });

  // =========================================================================
  // 7. SECURITY & ADMIN PROTECTION GUARANTEES
  // =========================================================================
  describe('Security & Admin Protection Guarantees', () => {
    it('invalid or forged token cannot pass staff verification', () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature';
      const staff = verifyStaffToken(invalidToken);
      expect(staff).toBeNull();
    });

    it('staff session token is cryptographically signed and verifiable', () => {
      const ownerAcc = staffStore.findByEmailOrUsername('admin@jainamtraders.com');
      expect(ownerAcc).not.toBeNull();
      const token = createStaffToken(ownerAcc!);
      const verified = verifyStaffToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.role).toBe('owner');
      expect(verified?.email).toBe('admin@jainamtraders.com');
    });

    it('PBKDF2 staff password hashing produces unique salts and matches constant-time verification', () => {
      const pass = 'SecretPass@2026';
      const hash1 = hashPassword(pass);
      const hash2 = hashPassword(pass);

      // Salts must differ
      expect(hash1.salt).not.toBe(hash2.salt);
      expect(hash1.hash).not.toBe(hash2.hash);

      // Both must verify correctly
      expect(verifyPassword(pass, hash1.hash, hash1.salt)).toBe(true);
      expect(verifyPassword(pass, hash2.hash, hash2.salt)).toBe(true);
      expect(verifyPassword('WrongPass', hash1.hash, hash1.salt)).toBe(false);
    });
  });
});
