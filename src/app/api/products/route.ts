import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminProduct,
  getAdminProducts,
  getCustomerProducts,
} from '@/lib/db/store-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get('admin') === 'true';

    if (isAdmin) {
      const status = searchParams.get('status') as 'all' | 'active' | 'archived' | null;
      const search = searchParams.get('q') || undefined;
      const products = await getAdminProducts({
        status: status || undefined,
        search,
      });
      return NextResponse.json({
        products,
        total: products.length,
      });
    }

    const categorySlug = searchParams.get('category') || undefined;
    const query = searchParams.get('q') || undefined;
    const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
    const featured = searchParams.get('featured') === 'true';
    const newArrival = searchParams.get('newArrival') === 'true';
    const bestSeller = searchParams.get('bestSeller') === 'true';
    const sort = (searchParams.get('sort') as 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating') || 'relevance';

    const result = await getCustomerProducts({
      categorySlug,
      query,
      minPrice,
      maxPrice,
      featured,
      newArrival,
      bestSeller,
      sort,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actorRole = request.headers.get('x-user-role') || 'admin';
    if (actorRole === 'customer') {
      return NextResponse.json({ error: 'Unauthorized: Only staff and admin can create products' }, { status: 403 });
    }

    const body = await request.json();
    const actorId = request.headers.get('x-user-id') || 'admin-session';
    const product = await createAdminProduct(body, actorId);
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
