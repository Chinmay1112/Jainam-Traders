import { NextRequest, NextResponse } from 'next/server';
import {
  archiveAdminProduct,
  getRawProductById,
  unarchiveAdminProduct,
  updateAdminProduct,
} from '@/lib/db/store-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getRawProductById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actorRole = request.headers.get('x-user-role') || 'admin';
    if (actorRole === 'customer') {
      return NextResponse.json(
        { error: 'Unauthorized: Only staff and admin can edit products' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const actorId = request.headers.get('x-user-id') || 'admin-session';

    if (action === 'archive') {
      const product = await archiveAdminProduct(id, actorId);
      return NextResponse.json({ success: true, product, message: 'Product archived successfully' });
    }

    if (action === 'unarchive') {
      const product = await unarchiveAdminProduct(id, actorId);
      return NextResponse.json({ success: true, product, message: 'Product restored to storefront' });
    }

    const body = await request.json();
    const product = await updateAdminProduct(id, body, actorId);
    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update product';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actorRole = request.headers.get('x-user-role') || 'admin';
    if (actorRole === 'customer') {
      return NextResponse.json(
        { error: 'Unauthorized: Customers cannot archive products' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const actorId = request.headers.get('x-user-id') || 'admin-session';

    // Soft delete / Archive: never hard-delete products with historical orders
    const product = await archiveAdminProduct(id, actorId);
    return NextResponse.json({
      success: true,
      product,
      message: 'Product archived successfully (preserved for historical orders & reviews)',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to archive product';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
