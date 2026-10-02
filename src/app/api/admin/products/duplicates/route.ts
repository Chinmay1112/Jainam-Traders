// ==============================================================================
// JAINAM TRADERS — CATALOGUE DUPLICATE AUDIT & SAFE OWNER MERGE API
// (Requirements 19 & 20: Duplicate Product Audit and Owner-authorized product merge)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceStaffRole } from '@/lib/auth/server-guard';
import { storeDb } from '@/lib/db/store-service';
import { auditCatalogueDuplicates } from '@/lib/products/duplicate-detector';
import { InventoryMovement } from '@/lib/types';

/**
 * GET /api/admin/products/duplicates
 * Returns grouped candidates of potential duplicate products currently in the catalogue.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = enforceStaffRole(request, ['owner', 'store_manager']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const duplicateGroups = auditCatalogueDuplicates(storeDb.products);

    return NextResponse.json({
      success: true,
      groups: duplicateGroups,
      totalGroups: duplicateGroups.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to audit duplicate products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/products/duplicates
 * Safely merge two duplicate products.
 * STRICT SECURITY: OWNER ROLE ONLY.
 * Never deletes order snapshots; consolidates inventory, re-links reviews, archives source.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Owner role
    const auth = enforceStaffRole(request, ['owner']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const body = await request.json();
    const { sourceProductId, targetProductId, differentiatorReason, notes, previewOnly } = body;

    if (!sourceProductId || !targetProductId) {
      return NextResponse.json(
        { error: 'Both sourceProductId and targetProductId are required for product merge' },
        { status: 400 }
      );
    }

    if (sourceProductId === targetProductId) {
      return NextResponse.json(
        { error: 'Cannot merge a product into itself' },
        { status: 400 }
      );
    }

    const source = storeDb.products.find((p) => p.id === sourceProductId);
    const target = storeDb.products.find((p) => p.id === targetProductId);

    if (!source) {
      return NextResponse.json({ error: `Source product "${sourceProductId}" not found` }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ error: `Target product "${targetProductId}" not found` }, { status: 404 });
    }

    // 2. Calculate affected business entities (Impact Audit)
    const affectedOrders = storeDb.orders.filter((o) =>
      o.items.some((item) => item.productId === sourceProductId)
    );
    const affectedReviews = storeDb.reviews.filter((r) => r.productId === sourceProductId);
    const stockToTransfer = source.stockQuantity;

    const impactSummary = {
      sourceProduct: {
        id: source.id,
        name: source.name,
        sku: source.sku,
        barcodeValue: source.barcodeValue || source.sku,
        currentStock: source.stockQuantity,
      },
      targetProduct: {
        id: target.id,
        name: target.name,
        sku: target.sku,
        barcodeValue: target.barcodeValue || target.sku,
        currentStock: target.stockQuantity,
        newStock: target.stockQuantity + stockToTransfer,
      },
      ordersAffectedCount: affectedOrders.length,
      reviewsAffectedCount: affectedReviews.length,
      stockToTransfer,
    };

    // If staff is just requesting an impact preview before confirming:
    if (previewOnly) {
      return NextResponse.json({
        success: true,
        preview: true,
        impact: impactSummary,
      });
    }

    // 3. EXECUTE SAFE MERGE
    const actorId = auth.session.staffId;

    // A. Transfer inventory to canonical target
    if (stockToTransfer > 0) {
      const prevStock = target.stockQuantity;
      target.stockQuantity += stockToTransfer;
      target.updatedAt = new Date().toISOString();

      const invMovement: InventoryMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId: target.id,
        productName: target.name,
        quantityChange: stockToTransfer,
        previousStock: prevStock,
        newStock: target.stockQuantity,
        reason: 'restock',
        notes: `Merged stock (+${stockToTransfer}) from duplicate SKU "${source.sku}" (${source.name}). Reason: ${differentiatorReason || 'Consolidation'}. ${notes || ''}`.trim(),
        actorId,
        createdAt: new Date().toISOString(),
      };
      storeDb.inventoryMovements.unshift(invMovement);
    }

    // B. Re-link customer reviews to target product
    affectedReviews.forEach((rev) => {
      rev.productId = target.id;
      rev.updatedAt = new Date().toISOString();
    });

    // C. Preserve historical order snapshots (Requirement 20)
    // Orders keep their orderItem name, sku, price intact, but we annotate with internal note
    affectedOrders.forEach((ord) => {
      ord.adminNotes = ord.adminNotes
        ? `${ord.adminNotes}\n[Product Merge] SKU ${source.sku} consolidated into canonical SKU ${target.sku}`
        : `[Product Merge] SKU ${source.sku} consolidated into canonical SKU ${target.sku}`;
    });

    // D. Soft-archive source product (Preserve historical reference, disable from active sale)
    source.stockQuantity = 0;
    source.isArchived = true;
    source.status = 'archived';
    source.isActive = false;
    source.updatedAt = new Date().toISOString();
    source.searchKeywords = `${source.searchKeywords || ''} [MERGED_INTO:${target.sku}]`;

    // E. Comprehensive Audit Log
    storeDb.logAudit(actorId, auth.session.role, 'MERGE_PRODUCTS', 'products', target.id, {
      sourceProductId: source.id,
      sourceSku: source.sku,
      sourceName: source.name,
      targetProductId: target.id,
      targetSku: target.sku,
      targetName: target.name,
      stockTransferred: stockToTransfer,
      ordersAffectedCount: affectedOrders.length,
      reviewsAffectedCount: affectedReviews.length,
      differentiatorReason,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully merged product "${source.name}" (${source.sku}) into "${target.name}" (${target.sku}).`,
      targetProduct: target,
      impact: impactSummary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to merge products';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
