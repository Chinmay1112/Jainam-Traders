/**
 * JAINAM TRADERS - STRICT INVENTORY NORMALIZATION & CALCULATION ENGINE
 * Guarantees zero NaN, undefined, null, or Infinity in inventory values.
 * Enforces non-negative integers for totalStock, reservedStock, and availableStock.
 */

export interface NormalizedInventory {
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  stockStatus: 'healthy' | 'low_stock' | 'out_of_stock' | 'archived';
  hasWarning: boolean;
  warningMessage?: string;
}

/**
 * Normalizes any unknown input into a valid non-negative integer.
 * Guarantees output is an integer >= 0, never NaN, null, undefined, or Infinity.
 */
export function normalizeStockNumber(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') {
    return Math.max(0, Math.trunc(fallback) || 0);
  }

  let num: number;
  if (typeof val === 'number') {
    num = val;
  } else if (typeof val === 'string') {
    const cleaned = val.trim();
    num = Number(cleaned);
  } else {
    return Math.max(0, Math.trunc(fallback) || 0);
  }

  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return Math.max(0, Math.trunc(fallback) || 0);
  }

  return Math.max(0, Math.trunc(num));
}

/**
 * Calculates and strictly normalizes all inventory dimensions for a product.
 * totalStock: non-negative integer
 * reservedStock: non-negative integer
 * availableStock: Math.max(0, totalStock - reservedStock)
 */
export function normalizeProductInventory(
  product: {
    stockQuantity?: unknown;
    reservedStock?: unknown;
    lowStockThreshold?: unknown;
    isArchived?: boolean;
    status?: string;
  } | null | undefined
): NormalizedInventory {
  if (!product) {
    return {
      totalStock: 0,
      reservedStock: 0,
      availableStock: 0,
      lowStockThreshold: 3,
      isLowStock: false,
      isOutOfStock: true,
      stockStatus: 'out_of_stock',
      hasWarning: false,
    };
  }

  const totalStock = normalizeStockNumber(product.stockQuantity, 0);
  let reservedStock = normalizeStockNumber(product.reservedStock, 0);
  const lowStockThreshold = normalizeStockNumber(product.lowStockThreshold, 3);

  let hasWarning = false;
  let warningMessage: string | undefined = undefined;

  // Anomaly safeguard: if customer reservations exceed total stock in DB
  if (reservedStock > totalStock) {
    hasWarning = true;
    warningMessage = `Data inconsistency: Reserved units (${reservedStock}) exceed total stock (${totalStock}). Available clamped to 0.`;
  }

  const availableStock = Math.max(0, totalStock - reservedStock);
  const isArchived = Boolean(
    product.isArchived || product.status === 'archived'
  );

  const isOutOfStock = availableStock <= 0;
  const isLowStock = !isOutOfStock && availableStock <= lowStockThreshold;

  let stockStatus: 'healthy' | 'low_stock' | 'out_of_stock' | 'archived';
  if (isArchived) {
    stockStatus = 'archived';
  } else if (isOutOfStock) {
    stockStatus = 'out_of_stock';
  } else if (isLowStock) {
    stockStatus = 'low_stock';
  } else {
    stockStatus = 'healthy';
  }

  return {
    totalStock,
    reservedStock,
    availableStock,
    lowStockThreshold,
    isLowStock,
    isOutOfStock,
    stockStatus,
    hasWarning,
    warningMessage,
  };
}

/**
 * Validates and calculates a stock adjustment change.
 * Prevents resulting total stock from ever dropping below zero.
 */
export function calculateStockAdjustment(
  currentTotalStock: unknown,
  quantityChange: unknown
): {
  isValid: boolean;
  prevStock: number;
  newStock: number;
  change: number;
  error?: string;
} {
  const prevStock = normalizeStockNumber(currentTotalStock, 0);

  // Validate change
  if (quantityChange === null || quantityChange === undefined || quantityChange === '') {
    return {
      isValid: false,
      prevStock,
      newStock: prevStock,
      change: 0,
      error: 'Please enter a valid stock adjustment quantity.',
    };
  }

  const rawChange = Number(quantityChange);
  if (!Number.isFinite(rawChange) || Number.isNaN(rawChange)) {
    return {
      isValid: false,
      prevStock,
      newStock: prevStock,
      change: 0,
      error: 'Invalid stock adjustment value. Must be a finite integer.',
    };
  }

  const change = Math.trunc(rawChange);
  if (change === 0) {
    return {
      isValid: false,
      prevStock,
      newStock: prevStock,
      change: 0,
      error: 'Quantity change cannot be 0.',
    };
  }

  const resultingStock = prevStock + change;

  if (resultingStock < 0) {
    return {
      isValid: false,
      prevStock,
      newStock: prevStock,
      change,
      error: `Cannot reduce stock below zero. Current stock is ${prevStock}, requested deduction is ${Math.abs(change)}.`,
    };
  }

  return {
    isValid: true,
    prevStock,
    newStock: resultingStock,
    change,
  };
}
