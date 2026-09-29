import React from 'react';
import { notFound } from 'next/navigation';
import { getProductBySlug, getProductReviews, getCustomerProducts } from '@/lib/db/store-service';
import ProductDetailView from './product-detail-view';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Product Not Found | Jainam Traders' };

  return {
    title: `${product.name} | Jainam Traders Pickup Store`,
    description: product.shortDescription || product.description,
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      images: [product.thumbnailUrl],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [reviews, relatedResult] = await Promise.all([
    getProductReviews(product.id),
    getCustomerProducts({ categorySlug: undefined, limit: 4 }),
  ]);

  const relatedProducts = relatedResult.products.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <ProductDetailView
      product={product}
      reviews={reviews}
      relatedProducts={relatedProducts}
    />
  );
}
