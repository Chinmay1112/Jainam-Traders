'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import { useShop } from '@/lib/context/shop-context';
import { useLanguage, LanguageSwitch } from '@/lib/context/language-context';
import { createClient } from '@/lib/supabase/client';
import { isRealSupabaseConfigured, validateCustomerEmail, validatePickupPhone } from '@/lib/auth/customer-auth';

type AuthView =
  | 'signin'
  | 'signup'
  | 'forgot-password'
  | 'verify-otp'
  | 'set-new-password'
  | 'complete-profile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  message?: string;
  initialView?: AuthView;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  message,
  initialView = 'signin',
}: AuthModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shop = useShop();
  const { login, signup, user } = useAuth();
  const { t, language } = useLanguage();

  // Active view state
  const [view, setView] = useState<AuthView>(initialView);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password / OTP / Reset fields
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [noAccountFound, setNoAccountFound] = useState(false);

  // UI status
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Handle URL query for profile completion
  useEffect(() => {
    if (searchParams.get('complete_profile') === 'true') {
      setView('complete-profile');
    }
  }, [searchParams]);

  // Countdown timer for OTP cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Reset form states when modal opens
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessNotice('');
      setNoAccountFound(false);
      setView(initialView);
      if (user && view !== 'complete-profile') {
        // If already authenticated and profile complete, close
        if (user.phone && user.savedAddress) {
          onClose();
        }
      }
    }
  }, [isOpen, initialView, user, onClose]);

  if (!isOpen) return null;

  // ----------------------------------------------------------------------------
  // 1. UNIFIED SIGN IN HANDLER (Customer OR Staff)
  // ----------------------------------------------------------------------------
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError(t('fillRequired'));
      return;
    }

    setLoading(true);
    try {
      const res = await login(cleanEmail, password);

      if (!res.success) {
        setError(res.error || t('invalidCredentials'));
        setLoading(false);
        return;
      }

      if (res.isStaff) {
        // Authorized Staff detected -> Navigate directly to protected /admin dashboard
        onClose();
        router.push('/admin');
        window.location.href = '/admin';
        return;
      }

      // Customer signed in successfully -> Keep on storefront / continue reservation
      setSuccessNotice('Signed in successfully!');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 350);
    } catch {
      setError(t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 2. CUSTOMER SIGNUP HANDLER
  // ----------------------------------------------------------------------------
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');

    if (!fullName.trim() || !phone.trim() || !email.trim() || !address.trim() || !password) {
      setError(t('fillRequired'));
      return;
    }

    const { isValid: isEmailValid, cleaned: cleanEmail } = validateCustomerEmail(email);
    if (!isEmailValid) {
      setError(t('emailPlaceholder'));
      return;
    }

    const { isValid: isPhoneValid, cleaned: cleanPhone } = validatePickupPhone(phone);
    if (!isPhoneValid) {
      setError(t('invalidPhone'));
      return;
    }

    if (password.length < 6) {
      setError(t('passwordWeak'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await signup({
        fullName: fullName.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        address: address.trim(),
        password,
      });

      if (!res.success) {
        setError(res.error || 'Failed to create account.');
        setLoading(false);
        return;
      }

      setSuccessNotice('Account created successfully!');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 3. GOOGLE OAUTH HANDLER
  // ----------------------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      if (!isRealSupabaseConfigured()) {
        setError('Authentication service is not configured.');
        setGoogleLoading(false);
        return;
      }

      const supabase = createClient();
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (oauthError) {
        setError(oauthError.message || 'Google sign-in could not be initiated.');
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication service is not configured.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 4. FORGOT PASSWORD - REQUEST OTP
  // ----------------------------------------------------------------------------
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');
    setNoAccountFound(false);

    const { isValid, cleaned: cleanEmail } = validateCustomerEmail(email);
    if (!isValid) {
      setError(t('emailPlaceholder'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (res.status === 404 || data.canSignup) {
        setNoAccountFound(true);
        setError(t('noAccountFound'));
        setLoading(false);
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || 'Unable to process recovery request.');
        setLoading(false);
        return;
      }

      setResendCooldown(60);
      setSuccessNotice(t('otpSentSuccess'));
      setView('verify-otp');
    } catch {
      setError('Failed to reach authentication service.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 5. VERIFY RECOVERY OTP
  // ----------------------------------------------------------------------------
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      // Step to new password entry
      setView('set-new-password');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 6. SAVE NEW PASSWORD
  // ----------------------------------------------------------------------------
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');

    if (password.length < 6) {
      setError(t('passwordWeak'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpCode.trim(),
          newPassword: password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to update password.');
        setLoading(false);
        return;
      }

      setSuccessNotice(t('passwordChangedSuccess'));
      setTimeout(() => {
        setPassword('');
        setConfirmPassword('');
        setOtpCode('');
        setView('signin');
      }, 1500);
    } catch {
      setError('Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 7. COMPLETE PROFILE (Google First-Time Setup)
  // ----------------------------------------------------------------------------
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { isValid: isPhoneValid, cleaned: cleanPhone } = validatePickupPhone(phone);
    if (!isPhoneValid) {
      setError(t('invalidPhone'));
      return;
    }

    if (!address.trim()) {
      setError(t('fillRequired'));
      return;
    }

    if (password.length < 6) {
      setError(t('passwordWeak'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email || email.trim(),
          fullName: fullName.trim() || user?.fullName,
          phone: cleanPhone,
          address: address.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not complete profile.');
        setLoading(false);
        return;
      }

      setSuccessNotice('Profile completed successfully!');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 600);
    } catch {
      setError('Network failure while saving profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Top Header Strip */}
        <div className="bg-[#1C1917] px-6 py-4 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-amber-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
              JT
            </span>
            <div>
              <h2 id="auth-modal-title" className="text-white font-extrabold text-base tracking-tight leading-none">
                {t('brandName')}
              </h2>
              <span className="text-[10px] text-amber-400 font-semibold tracking-wide uppercase">
                {t('localPickupStore')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Language Switch [ हिंदी | English ] */}
            <LanguageSwitch />

            {/* Close Button with accessible min 44x44px touch target */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close authentication modal"
              className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors active-press"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* External Message Alert if passed (e.g. from checkout) */}
          {message && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-900 font-medium">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* Feedback Banners */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {successNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successNotice}</div>
            </div>
          )}

          {/* ================================================================ */}
          {/* VIEW 1: SIGN IN (UNIFIED CUSTOMER + STAFF) */}
          {/* ================================================================ */}
          {view === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-stone-900">{t('signInTitle')}</h3>
                <p className="text-xs text-stone-600 mt-1">{t('brandTagline')}</p>
              </div>

              {/* Email Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    autoComplete="username email"
                    className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    {t('password')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setSuccessNotice('');
                      setView('forgot-password');
                    }}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold hover:underline"
                  >
                    {t('forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : t('signInBtn')}
              </button>

              {/* Create Account Switch */}
              <div className="text-center text-xs text-stone-600 pt-1">
                <span>{t('dontHaveAccount')}{' '}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessNotice('');
                    setView('signup');
                  }}
                  className="text-brand-600 font-bold hover:underline"
                >
                  {t('createAccount')}
                </button>
              </div>

              {/* OR Divider */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold text-stone-400">
                  <span className="bg-white px-3 tracking-widest">{t('orDivider')}</span>
                </div>
              </div>

              {/* Continue with Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm hover:shadow transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{googleLoading ? 'Connecting...' : t('continueWithGoogle')}</span>
              </button>
            </form>
          )}

          {/* ================================================================ */}
          {/* VIEW 2: CUSTOMER SIGN UP */}
          {/* ================================================================ */}
          {view === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <h3 className="text-xl font-bold text-stone-900">{t('createAccount')}</h3>
                <p className="text-xs text-stone-600 mt-1">
                  {language === 'hi'
                    ? 'दुकान से पिकअप के लिए अपना व्यक्तिगत खाता बनाएँ।'
                    : 'Create your customer account to reserve items for pickup.'}
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('fullName')}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('fullNamePlaceholder')}
                    className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('mobileNumber')}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('mobilePlaceholder')}
                    className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('address')}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('addressPlaceholder')}
                    className="w-full pl-10 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium resize-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    {t('password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full pl-3 pr-8 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    {t('confirmPassword')}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat"
                      className="w-full pl-3 pr-8 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : t('createAccount')}
              </button>

              <div className="text-center text-xs text-stone-600 pt-1">
                <span>{t('alreadyHaveAccount')}{' '}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessNotice('');
                    setView('signin');
                  }}
                  className="text-brand-600 font-bold hover:underline"
                >
                  {t('signInBtn')}
                </button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* VIEW 3: FORGOT PASSWORD - EMAIL SUBMISSION */}
          {/* ================================================================ */}
          {view === 'forgot-password' && (
            <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setView('signin');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 mb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> {t('backToSignIn')}
                </button>
                <h3 className="text-xl font-bold text-stone-900">{t('resetPasswordTitle')}</h3>
                <p className="text-xs text-stone-600 mt-1">{t('resetPasswordSubtitle')}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50"
              >
                {loading ? 'Checking...' : t('continueBtn')}
              </button>

              {noAccountFound && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                  <p className="text-xs text-amber-900 font-medium">{t('noAccountFound')}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setNoAccountFound(false);
                      setView('signup');
                    }}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    {t('createAccount')}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* ================================================================ */}
          {/* VIEW 4: VERIFY RECOVERY OTP */}
          {/* ================================================================ */}
          {view === 'verify-otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => setView('forgot-password')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 mb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <h3 className="text-xl font-bold text-stone-900">{t('enterOtp')}</h3>
                <p className="text-xs text-stone-600 mt-1">{t('otpSubtitle')}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full py-3 px-4 text-center tracking-[8px] font-mono text-xl font-bold bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50"
              >
                {t('verifyCodeBtn')}
              </button>

              <div className="text-center text-xs text-stone-500">
                {resendCooldown > 0 ? (
                  <span>{t('waitSeconds', { sec: resendCooldown })}</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleForgotPasswordRequest}
                    className="text-brand-600 font-bold hover:underline"
                  >
                    {t('resendOtp')}
                  </button>
                )}
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* VIEW 5: SET NEW PASSWORD */}
          {/* ================================================================ */}
          {view === 'set-new-password' && (
            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-stone-900">{t('setNewPassword')}</h3>
                <p className="text-xs text-stone-600 mt-1">{t('setNewPasswordSubtitle')}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('newPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-3 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('confirmPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-3 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50"
              >
                {loading ? 'Saving...' : t('saveNewPassword')}
              </button>
            </form>
          )}

          {/* ================================================================ */}
          {/* VIEW 6: GOOGLE FIRST-TIME PROFILE SETUP */}
          {/* ================================================================ */}
          {view === 'complete-profile' && (
            <form onSubmit={handleCompleteProfile} className="space-y-3.5">
              <div>
                <h3 className="text-xl font-bold text-stone-900">{t('completeProfileTitle')}</h3>
                <p className="text-xs text-stone-600 mt-1">{t('completeProfileSubtitle')}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('fullName')}
                </label>
                <input
                  type="text"
                  required
                  value={fullName || user?.fullName || ''}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('email')}
                </label>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={user?.email || email}
                  className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('mobileNumber')}
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('mobilePlaceholder')}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {t('address')}
                </label>
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('addressPlaceholder')}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    {t('password')}
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    {t('confirmPassword')}
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50"
              >
                {loading ? 'Saving Profile...' : t('completeProfileBtn')}
              </button>
            </form>
          )}

          {/* Need help? Direct Contact Buttons */}
          <div className="pt-2 border-t border-stone-100">
            <div className="text-[11px] text-center text-stone-500 font-semibold mb-2">
              {t('needHelp')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`tel:${shop.phone.replace(/\s+/g, '')}`}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-stone-600" />
                <span className="truncate">{t('callShop')}</span>
              </a>
              <a
                href={`https://wa.me/${shop.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                  'Hello Jainam Traders, I need assistance with my account or pickup order.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span className="truncate">{t('whatsApp')}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
