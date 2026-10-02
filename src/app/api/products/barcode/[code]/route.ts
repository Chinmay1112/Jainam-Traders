import { NextRequest, NextResponse } from 'next/server';
import { getProductByBarcode, toCustomerProductView } from '@/lib/db/store-service';
import { getAuthenticatedStaffFromRequest } from '@/lib/auth/server-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Barcode or SKU code is required' }, { status: 400 });
    }

    const decodedCode = decodeURIComponent(code.trim());
    const product = await getProductByBarcode(decodedCode);

    if (!product) {
      return NextResponse.json(
        { error: `Product with barcode or SKU "${decodedCode}" not found`, code: decodedCode },
        { status: 404 }
      );
    }

    // Security Rule 20: Only staff authorization exposes internal inventory quantities
    const staffSession = getAuthenticatedStaffFromRequest(request);
    if (!staffSession) {
      const customerSafe = toCustomerProductView(product);
      return NextResponse.json({
        found: true,
        isStaff: false,
        product: customerSafe,
      });
    }

    return NextResponse.json({
      found: true,
      isStaff: true,
      product,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to lookup barcode';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
