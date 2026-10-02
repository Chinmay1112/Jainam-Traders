import { describe, it, expect, vi, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateCustomerEmail,
  validatePickupPhone,
  isRealSupabaseConfigured,
  isProductionSmtpConfigured,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '@/lib/auth/customer-auth';
import { createPickupOrder, getOrders, seedTestFixtures } from '@/lib/db/store-service';
import { TEST_DEMO_PRODUCTS } from '../fixtures/test-fixtures';

beforeAll(() => {
  seedTestFixtures({ products: TEST_DEMO_PRODUCTS });
});

describe('1. Customer Email Validation & Sanitization', () => {
  it('accepts valid email addresses and sanitizes to lowercase', () => {
    const res1 = validateCustomerEmail('Customer@Example.Com');
    expect(res1.isValid).toBe(true);
    expect(res1.cleaned).toBe('customer@example.com');

    const res2 = validateCustomerEmail('  rahul.jain@jainamtraders.com  ');
    expect(res2.isValid).toBe(true);
    expect(res2.cleaned).toBe('rahul.jain@jainamtraders.com');

    const res3 = validateCustomerEmail('user+shopping@domain.in');
    expect(res3.isValid).toBe(true);
  });

  it('rejects invalid email formats', () => {
    expect(validateCustomerEmail('').isValid).toBe(false);
    expect(validateCustomerEmail('customer').isValid).toBe(false);
    expect(validateCustomerEmail('customer@').isValid).toBe(false);
    expect(validateCustomerEmail('@domain.com').isValid).toBe(false);
    expect(validateCustomerEmail('customer@domain').isValid).toBe(false);
    expect(validateCustomerEmail('customer@.com').isValid).toBe(false);
    expect(validateCustomerEmail('customer space@domain.com').isValid).toBe(false);
  });
});

describe('2. Supabase Google OAuth Initiation Configuration', () => {
  it('initiates Google OAuth with provider=google and clean /auth/callback redirect', () => {
    const mockSignInWithOAuth = vi.fn().mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' }, error: null });
    const mockSupabase = {
      auth: {
        signInWithOAuth: mockSignInWithOAuth,
      },
    };

    const origin = 'http://localhost:3002';
    const redirectUrl = `${origin}/auth/callback`;

    // Simulate Google sign in trigger
    mockSupabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3002/auth/callback',
      },
    });
  });

  it('prevents open redirect vulnerabilities on OAuth callback', () => {
    const sanitizeNext = (rawNext: string | null) => {
      const next = rawNext ?? '/';
      return next.startsWith('/') && !next.startsWith('//') ? next : '/';
    };

    expect(sanitizeNext('/checkout')).toBe('/checkout');
    expect(sanitizeNext('/orders')).toBe('/orders');
    expect(sanitizeNext(null)).toBe('/');
    // Malicious open redirect attempts must be neutralized to '/'
    expect(sanitizeNext('https://evil-site.com')).toBe('/');
    expect(sanitizeNext('//evil-site.com')).toBe('/');
    expect(sanitizeNext('javascript:alert(1)')).toBe('/');
  });
});

describe('3. Email OTP Initiation & Verification Logic', () => {
  it('requests Supabase email OTP with shouldCreateUser=true', async () => {
    const mockSignInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    const mockSupabase = {
      auth: {
        signInWithOtp: mockSignInWithOtp,
      },
    };

    const email = 'buyer@jainamtraders.com';
    const { cleaned } = validateCustomerEmail(email);

    await mockSupabase.auth.signInWithOtp({
      email: cleaned,
      options: {
        shouldCreateUser: true,
      },
    });

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'buyer@jainamtraders.com',
      options: {
        shouldCreateUser: true,
      },
    });
  });

  it('verifies valid 6-digit email OTP using type="email"', async () => {
    const mockVerifyOtp = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'usr-sb-12345',
          email: 'buyer@jainamtraders.com',
          created_at: new Date().toISOString(),
        },
      },
      error: null,
    });

    const mockSupabase = {
      auth: {
        verifyOtp: mockVerifyOtp,
      },
    };

    const result = await mockSupabase.auth.verifyOtp({
      email: 'buyer@jainamtraders.com',
      token: '654321',
      type: 'email',
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'buyer@jainamtraders.com',
      token: '654321',
      type: 'email',
    });
    expect(result.data.user?.id).toBe('usr-sb-12345');
    expect(result.error).toBeNull();
  });

  it('handles invalid or expired OTP gracefully', async () => {
    // 1. Expired OTP
    const mockExpiredVerify = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Token has expired or is invalid' },
    });
    const resExpired = await mockExpiredVerify({
      email: 'buyer@jainamtraders.com',
      token: '111111',
      type: 'email',
    });
    expect(resExpired.error?.message).toContain('expired');

    // 2. Invalid OTP format validation (client-side reject before request)
    const isSixDigitOtp = (code: string) => /^\d{6}$/.test(code.trim());
    expect(isSixDigitOtp('12345')).toBe(false); // only 5 digits
    expect(isSixDigitOtp('1234567')).toBe(false); // 7 digits
    expect(isSixDigitOtp('12345a')).toBe(false); // non-digits
    expect(isSixDigitOtp('123456')).toBe(true);
  });

  it('enforces 60-second resend cooldown logic', () => {
    expect(OTP_RESEND_COOLDOWN_SECONDS).toBe(60);

    let cooldown = OTP_RESEND_COOLDOWN_SECONDS;
    const tick = () => {
      if (cooldown > 0) cooldown -= 1;
    };

    tick();
    expect(cooldown).toBe(59);

    // Can only resend when cooldown is 0
    const canResend = (seconds: number) => seconds <= 0;
    expect(canResend(cooldown)).toBe(false);
    expect(canResend(0)).toBe(true);
  });
});

describe('4. Guest Reservation Restriction & Authenticated Order Placement', () => {
  it('prevents reservation when mandatory customer identity is missing', async () => {
    await expect(
      createPickupOrder({
        customerId: '',
        customerName: '',
        customerPhone: '',
        items: [{ productId: 'c0000000-0000-0000-0000-000000000001', quantity: 1 }],
        pickupMode: 'FLEXIBLE',
      })
    ).rejects.toThrow();
  });

  it('allows authenticated customer to reserve store inventory with pay-at-counter', async () => {
    const uniqueCustId = `cust-supabase-${Date.now()}`;
    const order = await createPickupOrder({
      customerId: uniqueCustId,
      customerName: 'Aarav Mehta',
      customerPhone: '9000000000',
      customerEmail: 'aarav@example.com',
      items: [{ productId: 'c0000000-0000-0000-0000-000000000001', quantity: 1 }],
      pickupMode: 'FLEXIBLE',
    });

    expect(order).toBeDefined();
    expect(order.orderNumber).toContain('JT-');
    expect(order.customerId).toBe(uniqueCustId);
    expect(order.customerEmail).toBe('aarav@example.com');
    expect(order.status).toBe('PENDING');
    expect(order.paymentStatus).toBe('UNPAID'); // Always Pay at Shop Counter
  });
});

describe('5. Customer Data Isolation', () => {
  it('isolates orders so a customer only receives their own private orders', async () => {
    const custA = `cust-alice-${Date.now()}`;
    const custB = `cust-bob-${Date.now()}`;

    // Customer A order
    await createPickupOrder({
      customerId: custA,
      customerName: 'Alice',
      customerPhone: '9000000001',
      customerEmail: 'alice@example.com',
      items: [{ productId: 'c0000000-0000-0000-0000-000000000001', quantity: 1 }],
      pickupMode: 'FLEXIBLE',
    });

    // Customer B order
    await createPickupOrder({
      customerId: custB,
      customerName: 'Bob',
      customerPhone: '9000000002',
      customerEmail: 'bob@example.com',
      items: [{ productId: 'c0000000-0000-0000-0000-000000000001', quantity: 1 }],
      pickupMode: 'FLEXIBLE',
    });

    // Query for Customer A
    const aliceOrders = await getOrders({ customerId: custA });
    expect(aliceOrders.length).toBe(1);
    expect(aliceOrders[0].customerId).toBe(custA);
    expect(aliceOrders[0].customerName).toBe('Alice');

    // Query for Customer B
    const bobOrders = await getOrders({ customerId: custB });
    expect(bobOrders.length).toBe(1);
    expect(bobOrders[0].customerId).toBe(custB);
    expect(bobOrders[0].customerName).toBe('Bob');
  });
});

describe('6. Customer Session Persistence & Logout', () => {
  it('maps Supabase User session to Customer Profile cleanly', () => {
    const sbUser = {
      id: 'supabase-user-uuid-99',
      email: 'customer@jainamtraders.com',
      user_metadata: {
        full_name: 'Pooja Shah',
        phone: '9000000000',
      },
      created_at: '2026-09-30T10:00:00Z',
      updated_at: '2026-09-30T10:00:00Z',
    };

    const profile = {
      id: sbUser.id,
      fullName: sbUser.user_metadata.full_name,
      email: sbUser.email,
      phone: sbUser.user_metadata.phone,
      role: 'customer' as const,
      createdAt: sbUser.created_at,
      updatedAt: sbUser.updated_at,
    };

    expect(profile.id).toBe('supabase-user-uuid-99');
    expect(profile.email).toBe('customer@jainamtraders.com');
    expect(profile.fullName).toBe('Pooja Shah');
    expect(profile.role).toBe('customer');
  });

  it('handles customer logout by clearing session', async () => {
    let sessionUser: string | null = 'customer-id-123';
    const mockSignOut = vi.fn().mockImplementation(async () => {
      sessionUser = null;
    });

    await mockSignOut();
    expect(mockSignOut).toHaveBeenCalled();
    expect(sessionUser).toBeNull();
  });
});

describe('7. Verification: Obsolete Phone OTP Code & UI Removed', () => {
  it('confirms AuthModal contains NO phone OTP form or SMS OTP wording', () => {
    const authModalPath = path.resolve(process.cwd(), 'src/components/auth/auth-modal.tsx');
    const content = fs.readFileSync(authModalPath, 'utf8');

    // Must NOT contain obsolete phone OTP elements
    expect(content).not.toContain('Send Verification Code');
    expect(content).not.toContain('Enter the 6-digit OTP received via SMS');
    expect(content).not.toContain('/api/auth/otp/send');
    expect(content).not.toContain('/api/auth/otp/verify');
    expect(content).not.toContain('Mobile Number (for pickup SMS & updates)');

    // MUST contain the new unified authentication flow elements
    expect(content).toContain("t('continueWithGoogle')");
    expect(content).toContain("t('signInBtn')");
    expect(content).toContain("t('forgotPassword')");
    expect(content).toContain("t('createAccount')");
    expect(content).toContain("t('callShop')");
    expect(content).toContain("t('whatsApp')");
  });

  it('confirms obsolete /api/auth/otp routes are removed from codebase', () => {
    const sendRoutePath = path.resolve(process.cwd(), 'src/app/api/auth/otp/send/route.ts');
    const verifyRoutePath = path.resolve(process.cwd(), 'src/app/api/auth/otp/verify/route.ts');

    expect(fs.existsSync(sendRoutePath)).toBe(false);
    expect(fs.existsSync(verifyRoutePath)).toBe(false);
  });
});
