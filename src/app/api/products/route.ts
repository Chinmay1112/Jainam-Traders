import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminProduct,
  getAdminProducts,
  getCustomerProducts,
} from '@/lib/db/store-service';
import { enforceStaffRole } from '@/lib/auth/server-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get('admin') === 'true';

    if (isAdmin) {
      const auth = enforceStaffRole(request, ['owner', 'store_manager', 'staff']);
      if ('errorResponse' in auth) {
        return auth.errorResponse;
      }

      const status = searchParams.get('status') as 'all' | 'active' | 'archived' | null;
      const search = searchParams.get('q') || undefined;
      const products = await getAdminProducts({
        status: status || undefined,
        search,
      });
      return NextResponse.json(
        {
          products,
          total: products.length,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
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

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Only Owner and Store Manager can create products
  const auth = enforceStaffRole(request, ['owner', 'store_manager']);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  try {
    const body = await request.json();
    const actorId = auth.session.staffId;
    const product = await createAdminProduct(body, actorId);
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    const isDuplicate = message.includes('Duplicate') || message.includes('DUPLICATE') || message.includes('already exists');
    return NextResponse.json(
      { error: message, isDuplicate },
      { status: isDuplicate ? 409 : 400 }
    );
  }
}
