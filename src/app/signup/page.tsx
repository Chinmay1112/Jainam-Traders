'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Phone, Mail, MapPin, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import { useLanguage, LanguageSwitch } from '@/lib/context/language-context';
import { validateCustomerEmail, validatePickupPhone } from '@/lib/auth/customer-auth';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const { t, language } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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

      setSuccess(
        language === 'hi'
          ? 'खाता सफलतापूर्वक बन गया! दुकान पर भेजा जा रहा है...'
          : 'Account created successfully! Redirecting to storefront...'
      );
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1C1917] px-6 py-4 flex items-center justify-between text-white">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4 text-stone-400" />
            <span className="text-sm font-semibold">{t('brandName')}</span>
          </Link>
          <LanguageSwitch />
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">{t('createAccount')}</h1>
            <p className="text-xs text-stone-600 mt-1">
              {language === 'hi'
                ? 'दुकान से सामान लेने और बिना अग्रिम भुगतान रिज़र्व करने के लिए अपना खाता बनाएँ।'
                : 'Sign up to reserve gifts, clocks, and accessories for counter pickup.'}
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-medium">{success}</div>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">{t('fullName')}</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('fullNamePlaceholder')}
                className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">{t('mobileNumber')}</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder={t('mobilePlaceholder')}
                className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">{t('email')}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">{t('address')}</label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('addressPlaceholder')}
                className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">{t('password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full pl-3 pr-8 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">{t('confirmPassword')}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat"
                  className="w-full pl-3 pr-8 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : t('createAccount')}
          </button>

          <div className="text-center text-xs text-stone-600 pt-2">
            <span>{t('alreadyHaveAccount')}{' '}</span>
            <Link href="/?auth=signin" className="text-brand-600 font-bold hover:underline">
              {t('signInBtn')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
