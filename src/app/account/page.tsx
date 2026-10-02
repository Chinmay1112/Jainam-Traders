'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Heart,
  Save,
  LogOut,
  CheckCircle2,
  Gift,
  Globe,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import AuthModal from '@/components/auth/auth-modal';
import { formatINR } from '@/lib/utils';
import { GiftCode } from '@/lib/types';

export default function AccountPage() {
  const { user, role, logout, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savedAddress, setSavedAddress] = useState(user?.savedAddress || '');
  const [languagePreference, setLanguagePreference] = useState<'en' | 'hi'>('en');
  const [marketingPref, setMarketingPref] = useState(true);
  const [savedMessage, setSavedMessage] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Customer Gift Codes (Part 24)
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);

  // Deactivation confirmation modal
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivatedMsg, setDeactivatedMsg] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      if (user.phone) setPhone(user.phone);
      if (user.email) setEmail(user.email);
      if (user.savedAddress) setSavedAddress(user.savedAddress);
      if (user.languagePreference) setLanguagePreference(user.languagePreference);

      // Fetch customer gift codes
      setLoadingGifts(true);
      fetch('/api/gift-codes/my')
        .then((res) => res.json())
        .then((data) => {
          if (data.giftCodes) setGiftCodes(data.giftCodes);
        })
        .catch(() => {})
        .finally(() => setLoadingGifts(false));
    }
  }, [user]);

  if (!user) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm max-w-md mx-auto my-12">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-4">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900">Sign in to your Account</h2>
        <p className="text-xs text-stone-500 mt-1 mb-6">
          Access your pickup order history, saved addresses, gift codes, and wishlist.
        </p>
        <button
          type="button"
          onClick={() => setIsAuthModalOpen(true)}
          className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 active-press"
        >
          Sign In Now
        </button>
        {isAuthModalOpen && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />}
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      savedAddress: savedAddress.trim(),
    });

    // Also persist via customer PATCH API
    try {
      await fetch('/api/customers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: savedAddress.trim(),
          languagePreference,
          marketingCommunicationPreference: marketingPref,
        }),
      });
    } catch {}

    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const res = await fetch('/api/customers/me', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setDeactivatedMsg(data.message || 'Account deactivated.');
        setTimeout(() => logout(), 2000);
      }
    } catch {
      alert('Unable to process request right now.');
    } finally {
      setDeactivating(false);
      setShowDeactivateConfirm(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight">
            Customer Profile
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Manage your store pickup details, language, and redemption vouchers.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
          Role: {role}
        </span>
      </div>

      {savedMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Profile updated successfully!</span>
        </div>
      )}

      {deactivatedMsg && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600" />
          <span>{deactivatedMsg} Signing out...</span>
        </div>
      )}

      {/* Profile Form (Part 11) */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="tel"
                placeholder="+91 90000 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <p className="text-[10px] text-stone-500 mt-1">
              Used by Jainam Traders counter staff to notify you when your pickup is ready.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
              Email Address (Login Identity)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="email"
                readOnly
                value={email}
                className="w-full pl-9 pr-3 py-2.5 bg-stone-100 border border-stone-300 rounded-xl text-xs text-stone-600 cursor-not-allowed focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-stone-500 mt-1">
              Primary identity verified via Supabase Authentication.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
              Saved Address / Landmark
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="e.g. Near Town Clock Tower, Station Road"
                value={savedAddress}
                onChange={(e) => setSavedAddress(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
              Preferred Language
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <select
                value={languagePreference}
                onChange={(e) => setLanguagePreference(e.target.value as 'en' | 'hi')}
                className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700">
              <input
                type="checkbox"
                checked={marketingPref}
                onChange={(e) => setMarketingPref(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Receive WhatsApp updates for store offers & festivals</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-100">
          <button
            type="submit"
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 active-press flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Save Profile Changes
          </button>

          <button
            type="button"
            onClick={logout}
            className="px-4 py-2.5 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </form>

      {/* My Gift Codes (Part 24) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
            <Gift className="w-5 h-5 text-amber-600" />
            <span>My Gift Codes & Stored Value</span>
          </div>
          <span className="text-xs text-stone-500">Apply at counter checkout</span>
        </div>

        {loadingGifts ? (
          <p className="text-xs text-stone-400 py-3">Loading vouchers...</p>
        ) : giftCodes.length === 0 ? (
          <div className="p-4 bg-stone-50 rounded-2xl text-center text-xs text-stone-500">
            No active gift codes currently assigned to your account.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {giftCodes.map((gc) => (
              <div
                key={gc.id}
                className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-2 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-sm tracking-wider text-amber-950">
                    {gc.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      gc.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : gc.status === 'REDEEMED'
                        ? 'bg-stone-200 text-stone-600'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {gc.status}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-stone-600">Remaining Balance:</span>
                  <span className="font-extrabold text-brand-700 text-sm">
                    {formatINR(gc.remainingValue)}
                  </span>
                </div>
                <div className="text-[10px] text-stone-500 flex justify-between pt-1 border-t border-amber-100">
                  <span>Original: {formatINR(gc.originalValue)}</span>
                  <span>{gc.expiresAt ? `Expires: ${new Date(gc.expiresAt).toLocaleDateString()}` : 'No Expiry'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/orders"
          className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-elevated transition-all flex items-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-stone-900 group-hover:text-brand-600 transition-colors">
              My Pickup Orders
            </h3>
            <p className="text-xs text-stone-500">Track readiness & show QR codes</p>
          </div>
        </Link>

        <Link
          href="/wishlist"
          className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-elevated transition-all flex items-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-stone-900 group-hover:text-brand-600 transition-colors">
              Saved Wishlist
            </h3>
            <p className="text-xs text-stone-500">Move items to cart with one tap</p>
          </div>
        </Link>
      </div>

      {/* Privacy & Account Deactivation Zone (Part 14) */}
      <div className="p-5 bg-stone-50 border border-stone-200 rounded-3xl space-y-3 text-xs">
        <div className="flex items-center gap-2 text-stone-700 font-bold">
          <ShieldCheck className="w-4 h-4 text-stone-500" />
          <span>Privacy & Account Options</span>
        </div>
        <p className="text-stone-500 leading-relaxed">
          You may request account deactivation. Your personally identifying information will be scrubbed while business order receipts remain archived for store tax and financial integrity.
        </p>
        <button
          type="button"
          onClick={() => setShowDeactivateConfirm(true)}
          className="text-rose-700 font-bold hover:underline"
        >
          Request Account Deactivation / Anonymization
        </button>

        {showDeactivateConfirm && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 mt-2">
            <div className="flex items-center gap-2 text-rose-800 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Confirm Account Deactivation</span>
            </div>
            <p className="text-rose-700 text-[11px]">
              Are you sure? You will be signed out and unable to place future orders with this account.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deactivating}
                onClick={handleDeactivate}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                {deactivating ? 'Deactivating...' : 'Yes, Deactivate Account'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeactivateConfirm(false)}
                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
