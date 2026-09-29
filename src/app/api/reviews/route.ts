import { NextRequest, NextResponse } from 'next/server';
import { getAdminReviews, getProductReviews, moderateReview, submitProductReview } from '@/lib/db/store-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const admin = searchParams.get('admin') === 'true';

    if (admin) {
      const reviews = await getAdminReviews();
      return NextResponse.json({ reviews });
    }

    if (!productId) {
      return NextResponse.json({ error: 'productId parameter is required' }, { status: 400 });
    }

    const reviews = await getProductReviews(productId);
    return NextResponse.json({ reviews });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch reviews';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, customerId, customerName, orderNumber, rating, title, comment, images } = body;

    if (!productId || !customerId || !orderNumber || !rating || !comment) {
      return NextResponse.json({ error: 'Missing required review fields' }, { status: 400 });
    }

    const review = await submitProductReview(
      productId,
      customerId,
      customerName,
      orderNumber,
      Number(rating),
      title || '',
      comment,
      images || []
    );

    return NextResponse.json(review, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Review submission failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, status, actorId } = body;

    if (!reviewId || !status) {
      return NextResponse.json({ error: 'reviewId and status are required' }, { status: 400 });
    }

    const updated = await moderateReview(reviewId, status, actorId || 'admin');
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Review moderation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
