// ==============================================================================
// JAINAM TRADERS - CLIENT-SAFE CUSTOMER AUTHENTICATION ENGINE
// Provides RFC-compliant email validation, Supabase config checks, and cooldowns.
// Safe for both Client Components and Server Components.
// ==============================================================================

/**
 * Standard RFC 5322 compliant email validator
 */
export function validateCustomerEmail(rawEmail: string): { isValid: boolean; cleaned: string } {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { isValid: false, cleaned: '' };
  }
  const cleaned = rawEmail.trim().toLowerCase();
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  const isValid = emailRegex.test(cleaned) && cleaned.length <= 254;
  return { isValid, cleaned };
}

/**
 * Check if a real Supabase project is configured
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) return false;
  if (url.includes('placeholder') || anonKey.includes('placeholder')) return false;
  if (url.includes('mock-') || anonKey.includes('mock-')) return false;
  if (!url.startsWith('https://')) return false;
  return true;
}

export const isRealSupabaseConfigured = isSupabaseConfigured;

/**
 * Check if production SMTP provider is configured for Supabase email delivery.
 */
export function isProductionSmtpConfigured(): boolean {
  if (!isRealSupabaseConfigured()) return false;
  const hasEnvSmtp =
    !!process.env.SMTP_HOST ||
    !!process.env.RESEND_API_KEY ||
    !!process.env.SENDGRID_API_KEY ||
    !!process.env.AWS_SES_ACCESS_KEY ||
    process.env.SUPABASE_SMTP_CONFIGURED === 'true';
  return hasEnvSmtp || process.env.NODE_ENV === 'production';
}

/**
 * Validate customer contact phone (only used optionally during checkout for store pickup updates)
 * Does NOT require SMS OTP.
 */
export function validatePickupPhone(raw: string): { isValid: boolean; cleaned: string; formatted: string } {
  if (!raw || typeof raw !== 'string') {
    return { isValid: false, cleaned: '', formatted: '' };
  }
  const digits = raw.replace(/\D/g, '');
  let cleaned = digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    cleaned = digits.substring(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    cleaned = digits.substring(1);
  }

  const isValid = /^[6-9]\d{9}$/.test(cleaned);
  return {
    isValid,
    cleaned,
    formatted: `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`,
  };
}

/**
 * Email OTP resend cooldown duration in seconds
 */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
