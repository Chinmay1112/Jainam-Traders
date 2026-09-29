import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Filter, SlidersHorizontal } from 'lucide-react';
import { getCategoryBySlug, getCustomerProducts, getCategories } from '@/lib/db/store-service';
import ProductCard from '@/components/store/product-card';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating';
    minPrice?: string;
    maxPrice?: string;
  }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: 'Category Not Found | Jainam Traders' };
  return {
    title: `${category.name} | Jainam Traders`,
    description: category.description || `Reserve ${category.name} online for store pickup at Jainam Traders.`,
  };
}

export default async function CategoryDetailPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const sParams = await searchParams;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const minPrice = sParams.minPrice ? Number(sParams.minPrice) : undefined;
  const maxPrice = sParams.maxPrice ? Number(sParams.maxPrice) : undefined;
  const sort = sParams.sort || 'relevance';

  const { products, total } = await getCustomerProducts({
    categorySlug: slug,
    minPrice,
    maxPrice,
    sort,
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-stone-500">
        <Link href="/" className="hover:text-stone-900">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/categories" className="hover:text-stone-900">
          Categories
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-semibold text-stone-900 truncate">{category.name}</span>
      </nav>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200">
            DEPARTMENT CATALOGUE
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-stone-900 mt-2">
            {category.name}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 max-w-2xl mt-1 leading-relaxed">
            {category.description}
          </p>
        </div>

        <div className="text-xs font-semibold text-stone-600 bg-stone-50 px-4 py-2 rounded-xl border border-stone-200 shrink-0">
          Showing <span className="text-brand-600 font-bold">{total}</span> items ready for pickup
        </div>
      </div>

      {/* Filter and Sort Bar */}
      <div className="bg-white rounded-xl p-3 border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-stone-700 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500" /> Filter Price:
          </span>
          <Link
            href={`/category/${slug}`}
            className={`px-3 py-1 rounded-lg border ${
              !minPrice && !maxPrice
                ? 'bg-stone-900 text-white border-stone-900 font-bold'
                : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border-stone-200'
            }`}
          >
            All
          </Link>
          <Link
            href={`/category/${slug}?maxPrice=699`}
            className={`px-3 py-1 rounded-lg border ${
              maxPrice === 699
                ? 'bg-stone-900 text-white border-stone-900 font-bold'
                : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border-stone-200'
            }`}
          >
            Under ₹699
          </Link>
          <Link
            href={`/category/${slug}?minPrice=700&maxPrice=1499`}
            className={`px-3 py-1 rounded-lg border ${
              minPrice === 700
                ? 'bg-stone-900 text-white border-stone-900 font-bold'
                : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border-stone-200'
            }`}
          >
            ₹700 – ₹1,499
          </Link>
          <Link
            href={`/category/${slug}?minPrice=1500`}
            className={`px-3 py-1 rounded-lg border ${
              minPrice === 1500
                ? 'bg-stone-900 text-white border-stone-900 font-bold'
                : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border-stone-200'
            }`}
          >
            ₹1,500+
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold text-stone-700">Sort by:</span>
          <Link
            href={`/category/${slug}?sort=price_asc${minPrice ? `&minPrice=${minPrice}` : ''}${maxPrice ? `&maxPrice=${maxPrice}` : ''}`}
            className={`px-2.5 py-1 rounded-md border ${
              sort === 'price_asc' ? 'bg-amber-100 border-amber-300 font-bold text-amber-900' : 'hover:bg-stone-100'
            }`}
          >
            Price: Low to High
          </Link>
          <Link
            href={`/category/${slug}?sort=rating${minPrice ? `&minPrice=${minPrice}` : ''}${maxPrice ? `&maxPrice=${maxPrice}` : ''}`}
            className={`px-2.5 py-1 rounded-md border ${
              sort === 'rating' ? 'bg-amber-100 border-amber-300 font-bold text-amber-900' : 'hover:bg-stone-100'
            }`}
          >
            Top Rated
          </Link>
        </div>
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-stone-200">
          <p className="text-base font-bold text-stone-800">No products found in this filter range.</p>
          <p className="text-xs text-stone-500 mt-1 mb-4">Try clearing price filters to see all available items.</p>
          <Link
            href={`/category/${slug}`}
            className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl"
          >
            Clear Filters
          </Link>
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
