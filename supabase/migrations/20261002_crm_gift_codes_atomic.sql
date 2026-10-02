-- ==============================================================================
-- JAINAM TRADERS - CRM & GIFT CODE ATOMIC SCHEMA, RPCs & RLS POLICIES
-- Provides database-level atomicity, row locks, idempotency & strict RLS
-- ==============================================================================

-- 1. GIFT CODES TABLE
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash VARCHAR(64) UNIQUE NOT NULL,
  masked_code VARCHAR(32) NOT NULL,
  code_type VARCHAR(20) NOT NULL DEFAULT 'FIXED_VALUE',
  original_value NUMERIC(10,2) NOT NULL CHECK (original_value > 0),
  remaining_value NUMERIC(10,2) NOT NULL CHECK (remaining_value >= 0),
  max_redemptions INTEGER NOT NULL DEFAULT 1 CHECK (max_redemptions > 0),
  redemption_count INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  created_by UUID,
  created_by_name TEXT NOT NULL DEFAULT 'Store Management',
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'EXPIRED', 'REDEEMED', 'CANCELLED')),
  min_order_value NUMERIC(10,2),
  max_discount NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_codes_hash ON public.gift_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_gift_codes_customer ON public.gift_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_gift_codes_status ON public.gift_codes(status);

-- 2. GIFT CODE REDEMPTIONS AUDIT & TRANSACTION TABLE
CREATE TABLE IF NOT EXISTS public.gift_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_code_id UUID NOT NULL REFERENCES public.gift_codes(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number VARCHAR(32) NOT NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  amount_applied NUMERIC(10,2) NOT NULL CHECK (amount_applied > 0),
  previous_remaining_value NUMERIC(10,2) NOT NULL,
  new_remaining_value NUMERIC(10,2) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('REDEEMED', 'RESTORED', 'CANCELLED_HOLD')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  idempotency_key VARCHAR(128) UNIQUE,
  reason TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemptions_gift_code ON public.gift_code_redemptions(gift_code_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_order ON public.gift_code_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON public.gift_code_redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_idempotency ON public.gift_code_redemptions(idempotency_key);

-- 3. CUSTOMER STAFF NOTES TABLE (INTERNAL CRM ONLY)
CREATE TABLE IF NOT EXISTS public.customer_staff_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL,
  staff_name TEXT NOT NULL,
  staff_role VARCHAR(20) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cust_notes_customer ON public.customer_staff_notes(customer_id);

-- 4. CUSTOMER ACTIVITY TIMELINE (INTERNAL CRM)
CREATE TABLE IF NOT EXISTS public.customer_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  actor_id TEXT,
  actor_role TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cust_activity_customer ON public.customer_activity(customer_id);

-- 5. IDEMPOTENCY KEY ON REFUND RECORDS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'refund_records' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.refund_records ADD COLUMN idempotency_key VARCHAR(128) UNIQUE;
  END IF;
END $$;

-- ==============================================================================
-- 6. ATOMIC DATABASE FUNCTIONS (STORED PROCEDURES FOR MULTI-INSTANCE CONCURRENCY)
-- ==============================================================================

-- A. ATOMIC GIFT CODE REDEMPTION WITH ROW LOCK & IDEMPOTENCY
CREATE OR REPLACE FUNCTION public.redeem_gift_code_atomic(
  p_code_hash VARCHAR,
  p_order_id UUID,
  p_order_number VARCHAR,
  p_customer_id UUID,
  p_customer_name TEXT,
  p_requested_amount NUMERIC,
  p_actor_id TEXT,
  p_actor_role TEXT,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_gift RECORD;
  v_amount_applied NUMERIC;
  v_new_remaining NUMERIC;
  v_existing_redemption RECORD;
BEGIN
  -- Idempotency check: Has this exact request already been processed?
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_redemption
    FROM public.gift_code_redemptions
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'amountApplied', v_existing_redemption.amount_applied,
        'newRemainingValue', v_existing_redemption.new_remaining_value
      );
    END IF;
  END IF;

  -- Row-level lock: blocks all concurrent instances from reading/modifying this code
  SELECT * INTO v_gift
  FROM public.gift_codes
  WHERE code_hash = p_code_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift code not found.');
  END IF;

  IF v_gift.status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift code is ' || lower(v_gift.status) || '.');
  END IF;

  IF v_gift.remaining_value <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift code has zero balance.');
  END IF;

  IF v_gift.starts_at IS NOT NULL AND v_gift.starts_at > NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift code is not active yet.');
  END IF;

  IF v_gift.expires_at IS NOT NULL AND v_gift.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gift code has expired.');
  END IF;

  IF v_gift.customer_id IS NOT NULL AND (p_customer_id IS NULL OR v_gift.customer_id <> p_customer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This gift code is assigned to a specific customer account.');
  END IF;

  -- Calculate atomic deduction
  v_amount_applied := LEAST(p_requested_amount, v_gift.remaining_value);
  v_new_remaining := v_gift.remaining_value - v_amount_applied;

  -- Atomic conditional update
  UPDATE public.gift_codes
  SET remaining_value = v_new_remaining,
      redemption_count = redemption_count + 1,
      status = CASE WHEN v_new_remaining = 0 OR redemption_count + 1 >= max_redemptions THEN 'REDEEMED' ELSE status END,
      updated_at = NOW()
  WHERE id = v_gift.id
  AND remaining_value >= v_amount_applied;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Concurrent modification detected. Please retry.');
  END IF;

  -- Record audit redemption ledger
  INSERT INTO public.gift_code_redemptions (
    gift_code_id, code, order_id, order_number, customer_id, customer_name,
    amount_applied, previous_remaining_value, new_remaining_value,
    action, actor_id, actor_role, idempotency_key, timestamp
  ) VALUES (
    v_gift.id, v_gift.masked_code, p_order_id, p_order_number, p_customer_id, p_customer_name,
    v_amount_applied, v_gift.remaining_value, v_new_remaining,
    'REDEEMED', p_actor_id, p_actor_role, p_idempotency_key, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'amountApplied', v_amount_applied,
    'previousRemainingValue', v_gift.remaining_value,
    'newRemainingValue', v_new_remaining,
    'giftCodeId', v_gift.id,
    'maskedCode', v_gift.masked_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. ATOMIC INVENTORY RESERVATION WITH ROW LOCKING
CREATE OR REPLACE FUNCTION public.reserve_inventory_atomic(
  p_items JSONB,
  p_customer_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INTEGER;
  v_prod RECORD;
BEGIN
  -- Validate and conditionally update each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_variant_id := CASE WHEN v_item->>'variantId' IS NOT NULL THEN (v_item->>'variantId')::UUID ELSE NULL END;
    v_quantity := (v_item->>'quantity')::INTEGER;

    IF v_variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET reserved_stock = reserved_stock + v_quantity
      WHERE id = v_variant_id
      AND is_active = TRUE
      AND (stock_quantity - reserved_stock) >= v_quantity;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient variant inventory for product ID %', v_product_id;
      END IF;
    ELSE
      UPDATE public.products
      SET reserved_stock = reserved_stock + v_quantity
      WHERE id = v_product_id
      AND is_active = TRUE
      AND is_archived = FALSE
      AND (stock_quantity - reserved_stock) >= v_quantity;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient inventory for product ID %', v_product_id;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. ATOMIC IDEMPOTENT GIFT CODE RESTORATION ON CANCELLATION
CREATE OR REPLACE FUNCTION public.restore_gift_code_cancellation_atomic(
  p_order_id UUID,
  p_order_number VARCHAR,
  p_actor_id TEXT,
  p_actor_role TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_already_restored BOOLEAN;
  v_red RECORD;
  v_total_restored NUMERIC := 0;
BEGIN
  -- Idempotency check: has this order already been restored?
  SELECT EXISTS (
    SELECT 1 FROM public.gift_code_redemptions
    WHERE order_id = p_order_id AND action = 'RESTORED'
  ) INTO v_already_restored;

  IF v_already_restored THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'amountRestored', 0);
  END IF;

  -- Iterate through redemptions and restore
  FOR v_red IN
    SELECT * FROM public.gift_code_redemptions
    WHERE order_id = p_order_id AND action = 'REDEEMED'
  LOOP
    UPDATE public.gift_codes
    SET remaining_value = LEAST(original_value, remaining_value + v_red.amount_applied),
        redemption_count = GREATEST(0, redemption_count - 1),
        status = 'ACTIVE',
        updated_at = NOW()
    WHERE id = v_red.gift_code_id;

    INSERT INTO public.gift_code_redemptions (
      gift_code_id, code, order_id, order_number, customer_id, customer_name,
      amount_applied, previous_remaining_value, new_remaining_value,
      action, actor_id, actor_role, reason, timestamp
    ) VALUES (
      v_red.gift_code_id, v_red.code, p_order_id, p_order_number, v_red.customer_id, v_red.customer_name,
      v_red.amount_applied, v_red.new_remaining_value, LEAST(v_red.new_remaining_value + v_red.amount_applied, 999999),
      'RESTORED', p_actor_id, p_actor_role, 'Order cancelled before pickup', NOW()
    );

    v_total_restored := v_total_restored + v_red.amount_applied;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'amountRestored', v_total_restored);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES FOR CRM & GIFT CODES
-- ==============================================================================

ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_staff_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_activity ENABLE ROW LEVEL SECURITY;

-- GIFT CODES: Customer reads own assigned codes; Staff reads all (manager/owner)
CREATE POLICY "Customer read own gift codes or authorized staff read all"
  ON public.gift_codes FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.is_admin_or_staff()
  );

CREATE POLICY "Authorized staff manage gift codes"
  ON public.gift_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'store_manager')
    )
  );

-- GIFT CODE REDEMPTIONS: Customer reads own order redemptions; Staff reads all
CREATE POLICY "Customer read own redemptions or staff read all"
  ON public.gift_code_redemptions FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.is_admin_or_staff()
  );

-- CUSTOMER STAFF NOTES: Strictly Owner & Manager only; Counter Staff & Customers BLOCKED
CREATE POLICY "Owner and Manager view staff notes"
  ON public.customer_staff_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'store_manager')
    )
  );

CREATE POLICY "Owner and Manager insert staff notes"
  ON public.customer_staff_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'store_manager')
    )
  );

-- CUSTOMER ACTIVITY: Customer cannot browse raw activity; Staff read
CREATE POLICY "Staff read customer activity"
  ON public.customer_activity FOR SELECT
  USING (public.is_admin_or_staff());
