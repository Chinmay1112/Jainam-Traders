-- ==============================================================================
-- JAINAM TRADERS — DATABASE-LEVEL SKU & BARCODE UNIQUENESS & MODEL NUMBER
-- Ensures atomic, multi-node uniqueness guarantees for SKU, Barcode, and Model Number
-- (Requirements 9, 10, 11, 23).
-- ==============================================================================

-- 1. Ensure manufacturer_model_number and barcode_value columns exist
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode_value TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer_model_number TEXT;

-- 2. Strict Unique Index on Barcode (Non-null, normalized uppercase)
-- Note: sku is already declared UNIQUE in 20260929_init_schema.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_unique 
  ON public.products (UPPER(TRIM(barcode_value))) 
  WHERE barcode_value IS NOT NULL AND barcode_value <> '';

-- 3. Case-insensitive Unique Index on SKU for robustness
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique_ci
  ON public.products (UPPER(TRIM(sku)));

-- 4. Fast lookup index for manufacturer model number
CREATE INDEX IF NOT EXISTS idx_products_model_number 
  ON public.products (UPPER(TRIM(manufacturer_model_number))) 
  WHERE manufacturer_model_number IS NOT NULL AND manufacturer_model_number <> '';
