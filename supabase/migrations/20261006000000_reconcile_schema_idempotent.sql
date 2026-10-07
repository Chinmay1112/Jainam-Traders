-- ==============================================================================
-- JAINAM TRADERS — AUTHORITATIVE RECONCILIATION & IDEMPOTENCY MIGRATION
-- Safely reconciles all schema objects, policies, indexes, and shop settings.
-- Completely idempotent: safe to execute repeatedly without 42710 conflicts.
-- ==============================================================================

-- 1. ENSURE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENSURE EXPIRED STATUS ON ORDER STATUS ENUM
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.order_status_enum'::regtype
    AND enumlabel = 'EXPIRED'
  ) THEN
    ALTER TYPE public.order_status_enum ADD VALUE 'EXPIRED';
  END IF;
END $$;

-- 3. ENSURE PRODUCT COLUMNS & UNIQUE INDEXES (Requirements 9, 10, 11, 23)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode_value TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer_model_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_unique
  ON public.products (UPPER(TRIM(barcode_value)))
  WHERE barcode_value IS NOT NULL AND barcode_value <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique_ci
  ON public.products (UPPER(TRIM(sku)));

CREATE INDEX IF NOT EXISTS idx_products_model_number
  ON public.products (UPPER(TRIM(manufacturer_model_number)))
  WHERE manufacturer_model_number IS NOT NULL AND manufacturer_model_number <> '';

-- 4. ENSURE ORDER CONCURRENCY & IDEMPOTENCY COLUMNS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN idempotency_key VARCHAR(128) UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'reservation_expires_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN reservation_expires_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'amount_due'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN amount_due NUMERIC(10,2) DEFAULT 0 CHECK (amount_due >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'amount_received'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN amount_received NUMERIC(10,2) DEFAULT 0 CHECK (amount_received >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_recorded_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_recorded_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_recorded_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_recorded_by UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'gift_code'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN gift_code VARCHAR(32);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'gift_code_discount'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN gift_code_discount NUMERIC(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'gift_code_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN gift_code_id UUID REFERENCES public.gift_codes(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'refund_records' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.refund_records ADD COLUMN idempotency_key VARCHAR(128) UNIQUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON public.orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_expiry ON public.orders(reservation_expires_at) WHERE status IN ('PENDING', 'CONFIRMED');

-- 5. IDEMPOTENT RLS POLICIES FOR CRM & GIFT CODES (Solves Error 42710)
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_staff_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer read own gift codes or authorized staff read all" ON public.gift_codes;
CREATE POLICY "Customer read own gift codes or authorized staff read all"
  ON public.gift_codes FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.is_admin_or_staff()
  );

DROP POLICY IF EXISTS "Authorized staff manage gift codes" ON public.gift_codes;
CREATE POLICY "Authorized staff manage gift codes"
  ON public.gift_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'store_manager')
    )
  );

DROP POLICY IF EXISTS "Customer read own redemptions or staff read all" ON public.gift_code_redemptions;
CREATE POLICY "Customer read own redemptions or staff read all"
  ON public.gift_code_redemptions FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.is_admin_or_staff()
  );

DROP POLICY IF EXISTS "Owner and Manager view staff notes" ON public.customer_staff_notes;
CREATE POLICY "Owner and Manager view staff notes"
  ON public.customer_staff_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'store_manager')
    )
  );

DROP POLICY IF EXISTS "Owner and Manager insert staff notes" ON public.customer_staff_notes;
CREATE POLICY "Owner and Manager insert staff notes"
  ON public.customer_staff_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'store_manager')
    )
  );

DROP POLICY IF EXISTS "Staff read customer activity" ON public.customer_activity;
CREATE POLICY "Staff read customer activity"
  ON public.customer_activity FOR SELECT
  USING (public.is_admin_or_staff());

-- 6. AUTHORITATIVE SHOP LOCATION (ZERO UNVERIFIED DATA)
ALTER TABLE public.shop_settings ALTER COLUMN shop_address DROP NOT NULL;
ALTER TABLE public.shop_settings ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.shop_settings ALTER COLUMN whatsapp_number DROP NOT NULL;

DO $$
BEGIN
  UPDATE public.shop_settings
  SET
    shop_name = 'Jainam Traders',
    shop_tagline = 'GIFTS • TOYS • ACCESSORIES • MORE',
    shop_logo_url = '/images/jainam-logo.svg',
    google_maps_url = 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
    latitude = 22.2765869,
    longitude = 75.7979897,
    shop_address = 'Jainam Traders (Location on Google Maps)',
    phone = '',
    whatsapp_number = '',
    email = 'contact@jainamtraders.com',
    opening_time = '07:30:00',
    closing_time = '21:30:00',
    weekly_closed_days = ARRAY['Sunday']::TEXT[],
    shop_description = 'Serving our local community with curated premium photo frames, artistic wall clocks, executive stationery, leather accessories, toys, perfumes, and memorable gifts. Inspect before payment with counter collection.',
    pickup_instructions = 'Show your Order Number (JT-...) or digital QR code at our counter. Inspect and verify items in person. Payment accepted via Cash or UPI.',
    is_mode_b_slots_enabled = TRUE,
    max_orders_per_slot = 10,
    updated_at = NOW();

  IF NOT FOUND THEN
    INSERT INTO public.shop_settings (
      id,
      shop_name,
      shop_tagline,
      shop_logo_url,
      shop_address,
      google_maps_url,
      latitude,
      longitude,
      phone,
      whatsapp_number,
      email,
      opening_time,
      closing_time,
      weekly_closed_days,
      shop_description,
      pickup_instructions,
      is_mode_b_slots_enabled,
      max_orders_per_slot,
      updated_at
    ) VALUES (
      'a0000000-0000-0000-0000-000000000001',
      'Jainam Traders',
      'GIFTS • TOYS • ACCESSORIES • MORE',
      '/images/jainam-logo.svg',
      'Jainam Traders (Location on Google Maps)',
      'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
      22.2765869,
      75.7979897,
      '',
      '',
      'contact@jainamtraders.com',
      '07:30:00',
      '21:30:00',
      ARRAY['Sunday']::TEXT[],
      'Serving our local community with curated premium photo frames, artistic wall clocks, executive stationery, leather accessories, toys, perfumes, and memorable gifts. Inspect before payment with counter collection.',
      'Show your Order Number (JT-...) or digital QR code at our counter. Inspect and verify items in person. Payment accepted via Cash or UPI.',
      TRUE,
      10,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;
