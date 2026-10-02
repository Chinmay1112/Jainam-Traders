import { NextRequest, NextResponse } from 'next/server';
import {
  archiveAdminProduct,
  deleteAdminProductPermanent,
  getRawProductById,
  unarchiveAdminProduct,
  updateAdminProduct,
} from '@/lib/db/store-service';
import { enforceStaffRole, getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';

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

    const staffSession = getAuthenticatedStaffFromRequest(request);
    // If not authenticated staff, strip internal warehouse stock numbers
    if (!staffSession) {
      const { stockQuantity: _, reservedStock: __, lowStockThreshold: ___, ...customerSafe } = product;
      return NextResponse.json({ product: customerSafe });
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
  // Only Owner and Store Manager can edit products
  const auth = enforceStaffRole(request, ['owner', 'store_manager']);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const actorId = auth.session.staffId;

    if (action === 'archive') {
      const product = await archiveAdminProduct(id, actorId);
      return NextResponse.json({ success: true, product, message: 'Product archived successfully' });
    }

    if (action === 'unarchive') {
      const product = await unarchiveAdminProduct(id, actorId);
      return NextResponse.json({ success: true, product, message: 'Product restored to storefront' });
    }

    const body = await request.json();

    // Counter Staff and Store Manager CANNOT change product prices. Only Owner/Admin can change prices.
    if ((body.price !== undefined || body.mrp !== undefined) && auth.session.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only the Store Owner can change product pricing' },
        { status: 403 }
      );
    }

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
  // Only Owner and Store Manager can archive products
  const auth = enforceStaffRole(request, ['owner', 'store_manager']);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  try {
    const { id } = await params;
    const actorId = auth.session.staffId;
    const isPermanent = request.nextUrl.searchParams.get('permanent') === 'true';

    if (isPermanent) {
      const product = await deleteAdminProductPermanent(id, actorId);
      return NextResponse.json({
        success: true,
        product,
        message: 'Product permanently deleted',
      });
    }

    const product = await archiveAdminProduct(id, actorId);
    return NextResponse.json({
      success: true,
      product,
      message: 'Product archived successfully (preserved for historical orders & reviews)',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete product';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
