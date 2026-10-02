import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Store } from 'lucide-react';
import { getAuthenticatedStaff } from '@/lib/auth/server-guard';
import AdminDashboard from './admin-dashboard';

export const metadata = {
  title: 'Staff Portal | Jainam Traders',
  description: 'Protected store management console for authorized Jainam Traders staff.',
};

export default async function AdminPage() {
  const staff = await getAuthenticatedStaff();

  // Protected route: If not authenticated staff, deny access and guide to storefront
  if (!staff) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-stone-200 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8 text-amber-700" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Staff Access Required</h1>
            <p className="text-xs text-stone-600 leading-relaxed">
              This management console is restricted to authorized Jainam Traders personnel.
              Please sign in with your credentials from the main storefront Sign In dialog.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/?auth=signin"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99]"
            >
              <Store className="w-4 h-4" /> Go to Storefront Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <AdminDashboard initialStaff={staff} />;
}
