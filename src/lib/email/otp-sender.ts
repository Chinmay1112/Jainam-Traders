// ==============================================================================
// JAINAM TRADERS - PRODUCTION LIVE EMAIL OTP SENDER ENGINE
// Sends verified 6-digit OTP emails directly through SMTP (e.g. Gmail / Resend).
// NEVER logs or reveals plain OTP tokens.
// ==============================================================================

import 'server-only';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

interface PendingOtp {
  hashedToken: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

// In-memory store for active OTP verification challenges
const otpStore = new Map<string, PendingOtp>();

function getOtpSecret(): string {
  const secret =
    process.env.CUSTOMER_SESSION_SECRET ||
    process.env.ADMIN_BOOTSTRAP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[SECURITY] Critical Configuration Error: CUSTOMER_SESSION_SECRET, ADMIN_BOOTSTRAP_SECRET, or SUPABASE_SERVICE_ROLE_KEY must be configured in production for OTP hashing.'
      );
    }
    return 'jt_dev_otp_salt_ephemeral';
  }
  return secret;
}

const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_MS = 60 * 1000; // 60 seconds

function hashToken(email: string, token: string): string {
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${email.toLowerCase()}:${token.trim()}`)
    .digest('hex');
}

/**
 * Returns true if server SMTP configuration is present
 */
export function isSmtpConfigured(): boolean {
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  return pass.trim().length > 0;
}

/**
 * Create SMTP Transporter
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || process.env.STORE_CONTACT_EMAIL || 'jainamtraders82@gmail.com';
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user: user.trim(),
      pass: pass.replace(/\s+/g, ''),
    },
  });
}

/**
 * Send real 6-digit OTP email to customer
 */
export async function sendOtpEmail(
  email: string
): Promise<{ success: boolean; error?: string; hindiError?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  // Cooldown check
  const existing = otpStore.get(cleanEmail);
  const now = Date.now();
  if (existing && now - existing.lastSentAt < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return {
      success: false,
      error: `Please wait ${remaining} seconds before requesting a new code.`,
      hindiError: `कृपया नया कोड मंगवाने से पहले ${remaining} सेकंड प्रतीक्षा करें।`,
    };
  }

  if (!isSmtpConfigured()) {
    return {
      success: false,
      error:
        'Live SMTP credentials are not configured. Please configure SMTP_PASS (Google App Password) in .env.local to activate live email delivery.',
      hindiError:
        'लाइव ईमेल सेवा अभी कॉन्फ़िगर नहीं है। कृपया .env.local में SMTP_PASS दर्ज करें।',
    };
  }

  // Generate cryptographically secure 6-digit OTP (100000 - 999999)
  const token = crypto.randomInt(100000, 1000000).toString();
  const hashedToken = hashToken(cleanEmail, token);

  otpStore.set(cleanEmail, {
    hashedToken,
    expiresAt: now + OTP_EXPIRATION_MS,
    lastSentAt: now,
    attempts: 0,
  });

  const senderEmail = process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || 'jainamtraders82@gmail.com';
  const senderName = process.env.SMTP_SENDER_NAME || 'Jainam Traders';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your Jainam Traders Login Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7f5f0; margin: 0; padding: 24px; color: #1c1917;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e7e5e4; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
    <div style="background: #1c1917; color: #ffffff; padding: 28px 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; color: #f59e0b; font-weight: 800; letter-spacing: -0.5px;">Jainam Traders</h1>
      <p style="margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #a8a29e;">Gifts • Photo Frames • Clocks • Toys</p>
    </div>
    <div style="padding: 36px 28px; text-align: center;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">Your Jainam Traders Login Code</h2>
      <p style="margin: 0 0 24px 0; font-size: 14px; color: #57534e;">Use this code to sign in to Jainam Traders.</p>
      <div style="background: #fafaf9; border: 2px dashed #d6d3d1; border-radius: 12px; padding: 18px 24px; display: inline-block; margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 700; color: #78716c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Your one-time login code:</div>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #b45309;">${token}</div>
      </div>
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #78716c;"><strong>Do not share this code with anyone.</strong></p>
      <p style="margin: 0; font-size: 12px; color: #a8a29e;">Your code expires in 10 minutes according to store authentication policy.</p>
    </div>
    <div style="background: #fafaf9; padding: 16px 24px; text-align: center; border-top: 1px solid #f5f5f4; font-size: 11px; color: #78716c;">
      Jainam Traders • Main road karahi, Teh- Maheshwar, Khargone<br/>
      If you did not request this code, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
  `;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: cleanEmail,
      subject: 'Your Jainam Traders Login Code',
      html: htmlContent,
      text: `Your Jainam Traders login code is: ${token}. Use this code to sign in. Do not share this code with anyone.`,
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'SMTP delivery error';
    return {
      success: false,
      error: `Failed to deliver email: ${msg}`,
      hindiError: 'ईमेल भेजने में विफल। कृपया सेटिंग्स जांचें।',
    };
  }
}

/**
 * Verify 6-digit OTP submitted by customer
 */
export function verifyOtpEmail(
  email: string,
  token: string
): { success: boolean; error?: string; hindiError?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();

  const record = otpStore.get(cleanEmail);
  if (!record) {
    return {
      success: false,
      error: 'No active OTP request found for this email. Please request a new code.',
      hindiError: 'इस ईमेल के लिए कोई सक्रिय कोड नहीं मिला। कृपया नया कोड मंगवाएं।',
    };
  }

  const now = Date.now();
  if (now > record.expiresAt) {
    otpStore.delete(cleanEmail);
    return {
      success: false,
      error: 'The verification code has expired. Please request a new OTP.',
      hindiError: 'सत्यापन कोड समाप्त हो चुका है। कृपया नया कोड मंगवाएं।',
    };
  }

  if (record.attempts >= 5) {
    otpStore.delete(cleanEmail);
    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a new code.',
      hindiError: 'बहुत अधिक गलत प्रयास। कृपया नया कोड मंगवाएं।',
    };
  }

  record.attempts += 1;

  const expectedHash = hashToken(cleanEmail, cleanToken);
  const isValid = crypto.timingSafeEqual(
    Buffer.from(record.hashedToken, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );

  if (!isValid) {
    return {
      success: false,
      error: 'Incorrect verification code. Please check your inbox and try again.',
      hindiError: 'गलत सत्यापन कोड। कृपया अपना इनबॉक्स देखें और पुनः प्रयास करें।',
    };
  }

  // Verified successfully - consume OTP immediately (prevent replay)
  otpStore.delete(cleanEmail);
  return { success: true };
}
