import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { getAuthenticatedStaff } from '@/lib/auth/server-guard';
import { canPerformAction } from '@/lib/auth/staff-roles';
import AdminGiftCodesView from '@/components/admin/admin-gift-codes-view';

export const metadata = {
  title: 'Gift Code Management | Jainam Traders',
  description: 'Manage store stored-value redemption gift vouchers and track balances.',
};

export default async function AdminGiftCodesPage() {
  const staff = await getAuthenticatedStaff();

  if (!staff) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-stone-200 shadow-xl text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-xl font-black text-stone-900">Staff Authentication Required</h1>
          <p className="text-xs text-stone-600">Please sign in as authorized staff to manage gift codes.</p>
          <Link
            href="/admin"
            className="inline-block px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs"
          >
            Go to Staff Portal
          </Link>
        </div>
      </div>
    );
  }

  if (!canPerformAction(staff.role, 'view_gift_codes')) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-stone-200 shadow-xl text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
          <h1 className="text-xl font-black text-stone-900">Access Restricted</h1>
          <p className="text-xs text-stone-600">
            Counter staff does not have permission to manage gift codes.
          </p>
          <Link
            href="/admin"
            className="inline-block px-5 py-2.5 bg-stone-900 text-white font-bold rounded-xl text-xs"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>

      <AdminGiftCodesView staffRole={staff.role} staffName={staff.fullName} />
    </div>
  );
}
