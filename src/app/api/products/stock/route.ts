import { NextRequest, NextResponse } from 'next/server';
import { adjustInventory } from '@/lib/db/store-service';
import { normalizeProductInventory } from '@/lib/inventory/normalizer';
import { enforceStaffRole } from '@/lib/auth/server-guard';

export async function POST(request: NextRequest) {
  // Only Owner and Store Manager can directly mutate stock levels
  const auth = enforceStaffRole(request, ['owner', 'store_manager']);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  try {
    const body = await request.json();
    const { productId, variantId, quantityChange, reason, notes } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    if (quantityChange === undefined || quantityChange === null || quantityChange === 0) {
      return NextResponse.json(
        { error: 'Valid non-zero quantity change is required (+ to add, - to deduct)' },
        { status: 400 }
      );
    }

    const actorId = auth.session.staffId;

    const result = await adjustInventory(
      productId,
      variantId,
      Number(quantityChange),
      reason || 'manual_correction',
      notes || '',
      actorId
    );

    const normalized = normalizeProductInventory(result.product);

    return NextResponse.json({
      success: true,
      product: normalized,
      movement: result.movement,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to adjust stock';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
