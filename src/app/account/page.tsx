'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  Trash2,
  Sparkles,
  ArrowRight,
  Shield,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import AuthModal from '@/components/auth/auth-modal';
import { formatINR } from '@/lib/utils';
import { GiftCode } from '@/lib/types';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80',
];

export default function AccountPage() {
  const {
    user,
    staffUser,
    role,
    logout,
    logoutStaff,
    updateProfile,
    updateStaffProfile,
  } = useAuth();

  // Active view: 'customer' or 'staff'
  const isStaffLoggedIn = !!staffUser;
  const isCustomerLoggedIn = !!user;

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [savedAddress, setSavedAddress] = useState('');
  const [languagePreference, setLanguagePreference] = useState<'en' | 'hi'>('en');
  const [marketingPref, setMarketingPref] = useState(true);
  const [savedMessage, setSavedMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Customer Gift Codes
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);

  // Deactivation confirmation modal
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivatedMsg, setDeactivatedMsg] = useState('');

  // Hydrate fields based on active session
  useEffect(() => {
    if (isStaffLoggedIn && staffUser) {
      setFullName(staffUser.fullName || '');
      setEmail(staffUser.email || '');
      setPhone(staffUser.phone || '');
      setAvatarUrl(staffUser.avatarUrl || undefined);
    } else if (isCustomerLoggedIn && user) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatarUrl || undefined);
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
  }, [isStaffLoggedIn, staffUser, isCustomerLoggedIn, user]);

  // Handle Photo Upload from device
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarUrl(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // If neither customer nor staff is logged in, show Sign In card
  if (!isStaffLoggedIn && !isCustomerLoggedIn) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm max-w-md mx-auto my-12">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-4">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900">Sign in to your Account</h2>
        <p className="text-xs text-stone-500 mt-1 mb-6">
          Access your pickup order history, staff portal, saved addresses, and profile details.
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

  // Handle Profile Update Submission
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (isStaffLoggedIn && staffUser) {
        // Staff Profile Update
        await updateStaffProfile({
          fullName: fullName.trim(),
          phone: phone.trim(),
          avatarUrl: avatarUrl || '',
        });
      } else if (isCustomerLoggedIn) {
        // Customer Profile Update
        await updateProfile({
          fullName: fullName.trim(),
          phone: phone.trim(),
          avatarUrl: avatarUrl || undefined,
          savedAddress: savedAddress.trim(),
        });

        // Also persist via customer PATCH API
        await fetch('/api/customers/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fullName.trim(),
            phone: phone.trim(),
            address: savedAddress.trim(),
            avatarUrl: avatarUrl || '',
            languagePreference,
            marketingCommunicationPreference: marketingPref,
          }),
        });
      }

      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2500);
    } catch (err: any) {
      alert(err?.message || 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
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

  const displayInitials = (fullName || email || 'User').charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12 px-4 sm:px-0">
      {/* Header Banner */}
      <div className="border-b border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight flex items-center gap-2.5">
            {isStaffLoggedIn ? (
              <>
                <Briefcase className="w-7 h-7 text-amber-600" />
                <span>Staff Account Profile</span>
              </>
            ) : (
              <>
                <User className="w-7 h-7 text-brand-600" />
                <span>Customer Profile</span>
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            {isStaffLoggedIn
              ? 'Update your personnel profile, contact number, and avatar photo across Jainam Traders.'
              : 'Manage your store pickup details, contact number, profile photo, and vouchers.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isStaffLoggedIn ? (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide flex items-center gap-1.5 shadow-sm">
              <Shield className="w-3.5 h-3.5 text-amber-700" />
              ROLE: {staffUser?.role?.replace('_', ' ')}
            </span>
          ) : (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-brand-50 text-brand-800 border border-brand-200 uppercase">
              Role: {role}
            </span>
          )}
        </div>
      </div>

      {/* Staff Quick Link to Admin Console */}
      {isStaffLoggedIn && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">Management Console Active</h3>
              <p className="text-xs text-amber-100">Access store inventory, order pick-up, barcodes, and reports.</p>
            </div>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-white hover:bg-stone-50 text-amber-900 rounded-xl text-xs font-black shadow transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <span>Open Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Success Notification */}
      {savedMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in duration-200 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Profile changes updated and synced everywhere successfully!</span>
        </div>
      )}

      {deactivatedMsg && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-bold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{deactivatedMsg} Signing out...</span>
        </div>
      )}

      {/* Main Profile Form */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
        
        {/* Photo Upload Section */}
        <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-4">
          <label className="block text-xs font-black text-stone-800 uppercase tracking-wide">
            Profile Photo / Avatar
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Avatar Preview */}
            <div className="relative group shrink-0">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center font-display font-extrabold text-3xl shadow-inner border-4 overflow-hidden ${
                  isStaffLoggedIn
                    ? 'border-amber-400 bg-amber-100 text-amber-800'
                    : 'border-brand-300 bg-brand-100 text-brand-700'
                }`}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{displayInitials}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload Photo"
                aria-label="Upload Photo"
                className="absolute bottom-0 right-0 p-2 bg-stone-900 hover:bg-stone-800 text-white rounded-full shadow-lg border-2 border-white transition-all active:scale-95"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Upload Buttons & Presets */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-colors active-press"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Choose Photo</span>
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3.5 py-2 bg-stone-200 hover:bg-rose-100 hover:text-rose-700 text-stone-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Quick Presets */}
              <div className="pt-2 border-t border-stone-200/60">
                <p className="text-[11px] font-semibold text-stone-500 mb-2 flex items-center gap-1 justify-center sm:justify-start">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Or select a preset avatar:</span>
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      aria-label={`Select preset avatar ${idx + 1}`}
                      className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${
                        avatarUrl === url ? 'border-brand-600 scale-105 shadow-sm' : 'border-stone-300'
                      }`}
                    >
                      <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Fields */}
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
                placeholder="Enter your name"
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
              {isStaffLoggedIn
                ? 'Used for counter fulfillment and team communication.'
                : 'Used by Jainam Traders counter staff to notify you when your pickup is ready.'}
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
                className="w-full pl-9 pr-3 py-2.5 bg-stone-100 border border-stone-300 rounded-xl text-xs text-stone-600 cursor-not-allowed focus:outline-none font-mono"
              />
            </div>
            <p className="text-[10px] text-stone-500 mt-1">
              Verified account identity. Contact administration to modify email.
            </p>
          </div>

          {/* Customer-only fields */}
          {!isStaffLoggedIn && (
            <>
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
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-100">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 active-press flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              if (isStaffLoggedIn) await logoutStaff();
              if (isCustomerLoggedIn) await logout();
            }}
            className="px-4 py-2.5 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </form>

      {/* Customer-only: Gift Codes & Vouchers */}
      {!isStaffLoggedIn && (
        <>
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

          {/* Privacy & Account Deactivation Zone */}
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
        </>
      )}
    </div>
  );
}
