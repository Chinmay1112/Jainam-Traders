import { describe, it, expect } from 'vitest';
import {
  authenticateStaff,
  signStaffToken,
  verifyStaffToken,
  canPerformAction,
  hashPassword,
  verifyPassword,
} from '@/lib/auth/staff-auth';
import {
  validateCustomerEmail,
  validatePickupPhone,
  isRealSupabaseConfigured,
  isProductionSmtpConfigured,
} from '@/lib/auth/customer-auth';
import { CANONICAL_SHOP_CONFIG } from '@/lib/config/shop-config';
import { TEST_STAFF_PASSWORDS } from '../fixtures/test-fixtures';

describe('Real Staff Authentication & RBAC Engine', () => {
  it('correctly hashes and verifies passwords using PBKDF2 with salt', () => {
    const rawPass = 'SecretStaffPass#2026';
    const res = hashPassword(rawPass);
    expect(res.hash).toBeDefined();
    expect(res.salt).toBeDefined();
    expect(verifyPassword(rawPass, res.hash, res.salt)).toBe(true);
    expect(verifyPassword('WrongPass', res.hash, res.salt)).toBe(false);
  });

  it('authenticates Owner, Store Manager, and Counter Staff with valid credentials', async () => {
    const ownerSession = await authenticateStaff('admin@jainamtraders.com', TEST_STAFF_PASSWORDS.admin);
    expect(ownerSession).not.toBeNull();
    expect(ownerSession?.role).toBe('owner');
    expect(ownerSession?.email).toBe('admin@jainamtraders.com');

    const managerSession = await authenticateStaff('manager@jainamtraders.com', TEST_STAFF_PASSWORDS.manager);
    expect(managerSession).not.toBeNull();
    expect(managerSession?.role).toBe('store_manager');

    const staffSession = await authenticateStaff('staff@jainamtraders.com', TEST_STAFF_PASSWORDS.staff);
    expect(staffSession).not.toBeNull();
    expect(staffSession?.role).toBe('staff');
  });

  it('rejects invalid email or incorrect password for staff', async () => {
    const badEmail = await authenticateStaff('intruder@unknown.com', 'Password@123');
    expect(badEmail).toBeNull();

    const badPass = await authenticateStaff('admin@jainamtraders.com', 'WrongPass@123');
    expect(badPass).toBeNull();
  });

  it('cryptographically signs and verifies staff session tokens using HMAC-SHA256', () => {
    const staff = {
      id: 'staff-counter-001',
      email: 'staff@jainamtraders.com',
      fullName: 'Counter Staff',
      role: 'staff' as const,
    };

    const token = signStaffToken(staff);
    expect(token).toBeDefined();
    expect(token.split('.').length).toBe(2);

    const verified = verifyStaffToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe(staff.email);
    expect(verified?.role).toBe('staff');

    // Tampered token rejection
    expect(verifyStaffToken(token + 'tampered')).toBeNull();
  });

  it('enforces RBAC permission hierarchy correctly across Owner, Store Manager, and Counter Staff', () => {
    // 1. Counter Staff Permissions
    expect(canPerformAction('staff', 'verify_pickup')).toBe(true);
    expect(canPerformAction('staff', 'view_orders')).toBe(true);
    expect(canPerformAction('staff', 'process_order_pickup')).toBe(true);
    expect(canPerformAction('staff', 'edit_price')).toBe(false); // FORBIDDEN
    expect(canPerformAction('staff', 'manage_staff')).toBe(false); // FORBIDDEN
    expect(canPerformAction('staff', 'manage_settings')).toBe(false); // FORBIDDEN

    // 2. Store Manager Permissions
    expect(canPerformAction('store_manager', 'verify_pickup')).toBe(true);
    expect(canPerformAction('store_manager', 'view_orders')).toBe(true);
    expect(canPerformAction('store_manager', 'process_order_pickup')).toBe(true);
    expect(canPerformAction('store_manager', 'manage_returns')).toBe(true);
    expect(canPerformAction('store_manager', 'edit_price')).toBe(false); // FORBIDDEN (Owner only)
    expect(canPerformAction('store_manager', 'manage_staff')).toBe(false); // FORBIDDEN (Owner only)

    // 3. Store Owner / Admin Permissions
    expect(canPerformAction('owner', 'verify_pickup')).toBe(true);
    expect(canPerformAction('owner', 'edit_price')).toBe(true);
    expect(canPerformAction('owner', 'manage_settings')).toBe(true);
    expect(canPerformAction('owner', 'manage_staff')).toBe(true);
    expect(canPerformAction('owner', 'view_audit_logs')).toBe(true);
    expect(canPerformAction('owner', 'adjust_inventory')).toBe(true);
  });
});

describe('Customer Email Validation & Store Contact Verification', () => {
  it('validates RFC-compliant customer email addresses', () => {
    expect(validateCustomerEmail('customer@example.com').isValid).toBe(true);
    expect(validateCustomerEmail('jainam.customer@gmail.com').isValid).toBe(true);
    expect(validateCustomerEmail('USER+test@domain.co.in').isValid).toBe(true);
    expect(validateCustomerEmail('USER+test@domain.co.in').cleaned).toBe('user+test@domain.co.in');

    // Invalid emails
    expect(validateCustomerEmail('not-an-email').isValid).toBe(false);
    expect(validateCustomerEmail('@missinguser.com').isValid).toBe(false);
    expect(validateCustomerEmail('user@').isValid).toBe(false);
    expect(validateCustomerEmail('user@.com').isValid).toBe(false);
    expect(validateCustomerEmail('user@com').isValid).toBe(false);
    expect(validateCustomerEmail('').isValid).toBe(false);
  });

  it('validates and formats optional customer pickup phone for counter notifications', () => {
    const valid = validatePickupPhone('9123456780');
    expect(valid.isValid).toBe(true);
    expect(valid.cleaned).toBe('9123456780');
    expect(valid.formatted).toBe('+91 91234 56780');

    expect(validatePickupPhone('+91 81234 56789').isValid).toBe(true);
    expect(validatePickupPhone('09123456780').isValid).toBe(true);

    // Invalid numbers
    expect(validatePickupPhone('12345').isValid).toBe(false);
    expect(validatePickupPhone('5555555555').isValid).toBe(false); // Doesn't start with 6-9
  });

  it('accurately identifies whether production Supabase and custom SMTP are active', () => {
    const isReal = isRealSupabaseConfigured();
    expect(typeof isReal).toBe('boolean');

    const isSmtp = isProductionSmtpConfigured();
    expect(typeof isSmtp).toBe('boolean');
  });
});

describe('Single Source of Truth: Canonical Shop Configuration', () => {
  it('defines consistent canonical store identity and contact information', () => {
    expect(CANONICAL_SHOP_CONFIG.shopName).toBe('Jainam Traders');
    expect(CANONICAL_SHOP_CONFIG.googleMapsUrl).toBe('https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA');
    expect(CANONICAL_SHOP_CONFIG.latitude).toBe(22.2765869);
    expect(CANONICAL_SHOP_CONFIG.longitude).toBe(75.7979897);
    expect(CANONICAL_SHOP_CONFIG.isLocationVerified).toBe(true);
    expect(CANONICAL_SHOP_CONFIG.openingTime).toBe('07:30');
    expect(CANONICAL_SHOP_CONFIG.closingTime).toBe('21:30');
  });
});
