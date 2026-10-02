// ==============================================================================
// JAINAM TRADERS - BARCODE & SKU MANAGEMENT SERVICE
// Enforces:
// 1. One permanent barcode identity per product (derived from SKU)
// 2. No mutable price or inventory in the barcode
// 3. Collision protection & uniqueness validation
// 4. Distinction between Product Code 128 & Order QR code
// ==============================================================================

import { Product, Order } from '@/lib/types';

// Prefix map for common Jainam Traders product categories
const CATEGORY_PREFIX_MAP: Record<string, string> = {
  'photo frames & albums': 'JT-PF',
  'photo frames': 'JT-PF',
  'frames': 'JT-PF',
  'wall clocks & timepieces': 'JT-CK',
  'wall clocks': 'JT-CK',
  'clocks': 'JT-CK',
  'toys & board games': 'JT-TY',
  'toys': 'JT-TY',
  'watches & smart bands': 'JT-WT',
  'watches': 'JT-WT',
  'fashion accessories & bags': 'JT-AC',
  'accessories': 'JT-AC',
  'home decor & brass': 'JT-HD',
  'home decor': 'JT-HD',
  'kitchen & dining': 'JT-KD',
  'stationery & office': 'JT-ST',
  'gifts & festive hampers': 'JT-GF',
  'gifts': 'JT-GF',
};

/**
 * Normalizes SKU and Barcode strings (uppercase, trimmed, no inner spaces)
 */
export function normalizeBarcodeValue(raw: string): string {
  return raw ? raw.trim().toUpperCase() : '';
}

/**
 * Validates SKU and Barcode collision across a list of products
 */
export function checkBarcodeUniqueness(
  products: Product[],
  skuOrBarcode: string,
  excludeProductId?: string
): { isUnique: boolean; conflictProduct?: { id: string; name: string; sku: string } } {
  const normalized = normalizeBarcodeValue(skuOrBarcode);
  if (!normalized) {
    return { isUnique: false };
  }

  const existing = products.find(
    (p) =>
      p.id !== excludeProductId &&
      (normalizeBarcodeValue(p.sku) === normalized ||
        (p.barcodeValue && normalizeBarcodeValue(p.barcodeValue) === normalized))
  );

  if (existing) {
    return {
      isUnique: false,
      conflictProduct: {
        id: existing.id,
        name: existing.name,
        sku: existing.sku,
      },
    };
  }

  return { isUnique: true };
}

/**
 * Generates a unique Jainam Traders SKU
 * Format: JT-[CATEGORY_PREFIX]-[001]
 */
export function generateUniqueProductSku(products: Product[], categoryName?: string): string {
  const normCat = categoryName ? categoryName.toLowerCase().trim() : '';
  let prefix = 'JT-PR';

  for (const [key, pfx] of Object.entries(CATEGORY_PREFIX_MAP)) {
    if (normCat.includes(key) || key.includes(normCat)) {
      prefix = pfx;
      break;
    }
  }

  // Find max sequential number for this prefix
  let maxSeq = 0;
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');

  for (const p of products) {
    const match = p.sku.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}-${String(nextSeq).padStart(3, '0')}`;

  // Extra safety loop against collision
  while (!checkBarcodeUniqueness(products, candidate).isUnique) {
    nextSeq++;
    candidate = `${prefix}-${String(nextSeq).padStart(3, '0')}`;
  }

  return candidate;
}

export type ScanResultType = 'PRODUCT' | 'ORDER' | 'NOT_FOUND';

export interface ScanResolution {
  type: ScanResultType;
  query: string;
  product?: Product;
  order?: Order;
  error?: string;
}

/**
 * Resolves scanned input (from Camera or USB Wedge reader)
 * Distinguishes Product Code 128 (SKU) from Order QR / Order ID
 */
export function resolveScanInput(
  products: Product[],
  orders: Order[],
  rawInput: string
): ScanResolution {
  const clean = normalizeBarcodeValue(rawInput);
  if (!clean) {
    return { type: 'NOT_FOUND', query: rawInput, error: 'Empty scan input' };
  }

  // 1. First check if it matches an Order QR token, Order ID, or Order Number
  const matchedOrder = orders.find(
    (o) =>
      normalizeBarcodeValue(o.orderNumber) === clean ||
      (o.qrToken && normalizeBarcodeValue(o.qrToken) === clean) ||
      normalizeBarcodeValue(o.id) === clean
  );

  if (matchedOrder) {
    return {
      type: 'ORDER',
      query: clean,
      order: matchedOrder,
    };
  }

  // 2. Check if it matches a Product SKU or Barcode
  const matchedProduct = products.find(
    (p) =>
      normalizeBarcodeValue(p.sku) === clean ||
      (p.barcodeValue && normalizeBarcodeValue(p.barcodeValue) === clean)
  );

  if (matchedProduct) {
    return {
      type: 'PRODUCT',
      query: clean,
      product: matchedProduct,
    };
  }

  // 3. Fallback: check if the input is an order number with partial matches
  const partialOrder = orders.find((o) =>
    o.orderNumber.toUpperCase().includes(clean)
  );
  if (partialOrder) {
    return {
      type: 'ORDER',
      query: clean,
      order: partialOrder,
    };
  }

  return {
    type: 'NOT_FOUND',
    query: clean,
    error: `No product or order found matching code "${clean}"`,
  };
}
