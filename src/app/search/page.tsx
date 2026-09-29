import React from 'react';
import Link from 'next/link';
import { Search, Sparkles, Filter } from 'lucide-react';
import { getCustomerProducts } from '@/lib/db/store-service';
import ProductCard from '@/components/store/product-card';

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    featured?: string;
    newArrival?: string;
    bestSeller?: string;
    maxPrice?: string;
    minPrice?: string;
    sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  }>;
}

export const metadata = {
  title: 'Search Store Catalogue | Jainam Traders',
  description: 'Search photo frames, wall clocks, wristwatches, brass mementos, leather accessories and gifts.',
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || '';
  const featured = params.featured === 'true';
  const newArrival = params.newArrival === 'true';
  const bestSeller = params.bestSeller === 'true';
  const minPrice = params.minPrice ? Number(params.minPrice) : undefined;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : undefined;
  const sort = params.sort || 'relevance';

  const { products, total } = await getCustomerProducts({
    query,
    featured,
    newArrival,
    bestSeller,
    minPrice,
    maxPrice,
    sort,
  });

  const popularSearches = ['Photo Frame', 'Wooden Clock', 'Brass Ganesha', 'Leather Belt', 'RC Car', 'Rollerball Pen', 'Perfume'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-stone-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-brand-600" />
              {query ? `Search results for "${query}"` : 'Store Search'}
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Found <span className="font-bold text-brand-600">{total}</span> items matching your search criteria
            </p>
          </div>

          {/* Popular Search tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-stone-400">Popular:</span>
            {popularSearches.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="px-2.5 py-1 bg-stone-100 hover:bg-brand-50 hover:text-brand-700 text-stone-600 rounded-full text-xs font-medium transition-colors"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {products.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 shadow-sm max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-stone-900">No matching items found</h2>
          <p className="text-xs text-stone-500 mt-1 mb-6">
            We couldn&apos;t find anything matching &quot;{query}&quot;. Check your spelling or browse our popular gift departments.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/categories"
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow active-press"
            >
              Browse Categories
            </Link>
            <Link
              href="/"
              className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold"
            >
              Return Home
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
