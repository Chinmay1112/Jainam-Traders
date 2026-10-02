// ==============================================================================
// JAINAM TRADERS — PRODUCT SIMILARITY & DUPLICATE CHECK API
// Real-time server-side duplicate check & autocomplete search across multiple fields
// (Requirements 1, 2, 4, 5, 11, 16, 21, 26, 27).
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceStaffRole } from '@/lib/auth/server-guard';
import { storeDb } from '@/lib/db/store-service';
import { findSimilarProducts } from '@/lib/products/duplicate-detector';
import { DuplicateCheckParams } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const auth = enforceStaffRole(request, ['owner', 'store_manager', 'staff']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || searchParams.get('q') || '';
    const sku = searchParams.get('sku') || undefined;
    const barcodeValue = searchParams.get('barcodeValue') || searchParams.get('barcode') || undefined;
    const brand = searchParams.get('brand') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const manufacturerModelNumber = searchParams.get('manufacturerModelNumber') || searchParams.get('modelNumber') || undefined;
    const excludeProductId = searchParams.get('excludeProductId') || undefined;
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

    const params: DuplicateCheckParams = {
      name,
      sku,
      barcodeValue,
      brand,
      categoryId,
      manufacturerModelNumber,
      excludeProductId,
      tags,
    };

    const matches = findSimilarProducts(storeDb.products, params);

    return NextResponse.json({
      success: true,
      matches,
      total: matches.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to search similar products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = enforceStaffRole(request, ['owner', 'store_manager', 'staff']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const body = await request.json();
    const params: DuplicateCheckParams = {
      name: body.name || '',
      sku: body.sku,
      barcodeValue: body.barcodeValue,
      brand: body.brand,
      categoryId: body.categoryId,
      manufacturerModelNumber: body.manufacturerModelNumber,
      excludeProductId: body.excludeProductId,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
    };

    const matches = findSimilarProducts(storeDb.products, params);

    return NextResponse.json({
      success: true,
      matches,
      total: matches.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to check product duplicates';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
