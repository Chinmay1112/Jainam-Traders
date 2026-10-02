'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useLanguage, LanguageSwitch } from '@/lib/context/language-context';
import { validateCustomerEmail } from '@/lib/auth/customer-auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [canSignup, setCanSignup] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCanSignup(false);

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
        setError(t('noAccountFound'));
        setCanSignup(true);
        setLoading(false);
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to send recovery code.');
        setLoading(false);
        return;
      }

      setSuccess(t('otpSentSuccess'));
      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(cleanEmail)}`);
      }, 1200);
    } catch {
      setError('Connection failure. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1C1917] px-6 py-4 flex items-center justify-between text-white">
          <Link href="/?auth=signin" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4 text-stone-400" />
            <span className="text-xs font-semibold">{t('backToSignIn')}</span>
          </Link>
          <LanguageSwitch />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-inner">
            <KeyRound className="w-6 h-6 text-amber-700" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">{t('resetPasswordTitle')}</h1>
            <p className="text-xs text-stone-600 mt-1">{t('resetPasswordSubtitle')}</p>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Sending code...' : t('continueBtn')}
          </button>

          {canSignup && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
              <p className="text-xs text-amber-900 font-medium">{t('noAccountFound')}</p>
              <Link
                href="/signup"
                className="block w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold text-center shadow-sm"
              >
                {t('createAccount')}
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
