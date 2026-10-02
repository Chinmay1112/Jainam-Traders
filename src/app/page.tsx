import React from 'react';
import { getCustomerProducts, getCategories } from '@/lib/db/store-service';
import HomeContent from '@/components/store/home-content';

export const metadata = {
  title: 'Jainam Traders | Gifts • Toys • Accessories • More | Retail Store',
  description:
    'Jainam Traders — GIFTS • TOYS • ACCESSORIES • MORE. Discover & reserve gifts, photo frames, wall clocks, watches, leather purses, toys, and stationery online. Inspect and pay at our physical retail store.',
};

export default async function HomePage() {
  const [categories, featuredResult, newArrivalsResult, bestSellersResult] = await Promise.all([
    getCategories(),
    getCustomerProducts({ featured: true, limit: 8 }),
    getCustomerProducts({ newArrival: true, limit: 4 }),
    getCustomerProducts({ bestSeller: true, limit: 8 }),
  ]);

  return (
    <HomeContent
      categories={categories}
      featuredProducts={featuredResult.products}
      newArrivals={newArrivalsResult.products}
      bestSellers={bestSellersResult.products}
    />
  );
}
