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
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-stone-200 shadow-sm max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mx-auto mb-4 border border-amber-200">
            <Search className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-stone-900">
            {query ? `"${query}" के लिए कोई उत्पाद नहीं मिला` : 'No matching items found'}
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-2 mb-6">
            We searched across product names, categories, tags, transliteration, and synonyms. Check your spelling or browse our departments below.
          </p>

          {/* क्या आप ये देखना चाहेंगे? Suggestion alternatives */}
          <div className="bg-stone-50 rounded-xl p-5 border border-stone-200 mb-6 text-left">
            <p className="text-sm font-bold text-stone-800 flex items-center gap-1.5 mb-3">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>क्या आप ये देखना चाहेंगे? (Explore Departments):</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Link
                href="/search?q=wall%20clock"
                className="px-3 py-2 bg-white hover:bg-amber-50 hover:border-amber-400 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 text-center transition-all shadow-2xs"
              >
                🕐 घड़ियाँ (Wall Clocks)
              </Link>
              <Link
                href="/search?q=gift"
                className="px-3 py-2 bg-white hover:bg-amber-50 hover:border-amber-400 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 text-center transition-all shadow-2xs"
              >
                🎁 गिफ्ट (Gifts)
              </Link>
              <Link
                href="/search?q=photo%20frame"
                className="px-3 py-2 bg-white hover:bg-amber-50 hover:border-amber-400 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 text-center transition-all shadow-2xs"
              >
                🖼️ फोटो फ्रेम (Photo Frames)
              </Link>
              <Link
                href="/search?q=watch"
                className="px-3 py-2 bg-white hover:bg-amber-50 hover:border-amber-400 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 text-center transition-all shadow-2xs"
              >
                ⌚ हाथ की घड़ी (Watches)
              </Link>
              <Link
                href="/search?q=wallet"
                className="px-3 py-2 bg-white hover:bg-amber-50 hover:border-amber-400 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 text-center transition-all shadow-2xs"
              >
                👛 पर्स व बेल्ट (Wallets)
              </Link>
              <Link
                href="/search?q=toy"
                className="px-3 py-2 bg-white hover:bg-amber-50 hover:border-amber-400 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 text-center transition-all shadow-2xs"
              >
                🧸 खिलौने (Toys)
              </Link>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Link
              href="/categories"
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow active-press"
            >
              Browse All Categories
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
