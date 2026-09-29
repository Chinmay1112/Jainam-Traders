import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Gift, ArrowRight } from 'lucide-react';
import { getCategories } from '@/lib/db/store-service';

export const metadata = {
  title: 'Categories & Departments | Jainam Traders',
  description: 'Explore all product categories available for pickup at Jainam Traders.',
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 tracking-tight">
          All Store Departments
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Browse our complete local retail selection. Select a category to view all available items for pickup.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${cat.slug}`}
            className="group bg-white rounded-2xl p-4 border border-stone-200 shadow-sm hover:shadow-elevated hover:border-brand-500/40 transition-all flex gap-4 items-center"
          >
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
              {cat.imageUrl ? (
                <Image
                  src={cat.imageUrl}
                  alt={cat.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-brand-600">
                  <Gift className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-stone-900 group-hover:text-brand-600 transition-colors truncate">
                {cat.name}
              </h2>
              <p className="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed">
                {cat.description || 'View all items available in this category for pickup.'}
              </p>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-600">
                <span>Browse Products</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
