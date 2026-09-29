import React from 'react';
import { notFound } from 'next/navigation';
import { getOrderByNumber } from '@/lib/db/store-service';
import OrderDetailView from './order-detail-view';

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrderPageProps) {
  const { id } = await params;
  return {
    title: `Order ${id} Tracking | Jainam Traders`,
    description: `Track pickup preparation status and show your digital QR code for order ${id}.`,
  };
}

export default async function OrderDetailPage({ params }: OrderPageProps) {
  const { id } = await params;
  const order = await getOrderByNumber(id);
  if (!order) notFound();

  return <OrderDetailView order={order} />;
}
