import { NextRequest, NextResponse } from 'next/server';
import { adjustInventory } from '@/lib/db/store-service';
import { normalizeProductInventory } from '@/lib/inventory/normalizer';

export async function POST(request: NextRequest) {
  try {
    const actorRole = request.headers.get('x-user-role') || 'staff';
    if (actorRole === 'customer') {
      return NextResponse.json(
        { error: 'Unauthorized: Customers cannot mutate inventory' },
        { status: 403 }
      );
    }

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

    const actorId = request.headers.get('x-user-id') || 'staff-session';

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
      product: result.product,
      movement: result.movement,
      normalized,
      message: `Stock successfully adjusted for "${result.product.name}". New Total Stock: ${normalized.totalStock} (Available: ${normalized.availableStock})`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stock adjustment failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
