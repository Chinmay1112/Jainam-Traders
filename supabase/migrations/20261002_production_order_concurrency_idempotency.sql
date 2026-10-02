-- ==============================================================================
-- JAINAM TRADERS - PRODUCTION ORDER CONCURRENCY, IDEMPOTENCY & RESERVATION EXPIRY
-- Provides database-level atomicity, row locks, idempotency & clean expiry releases
-- ==============================================================================

-- 1. ADD 'EXPIRED' TO ORDER STATUS ENUM IF NOT PRESENT
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

-- 2. ADD COLUMNS FOR ORDER IDEMPOTENCY, RESERVATION EXPIRY & COUNTER PAYMENTS
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
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON public.orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_expiry ON public.orders(reservation_expires_at) WHERE status IN ('PENDING', 'CONFIRMED');

-- ==============================================================================
-- 3. ATOMIC IDEMPOTENT ORDER CREATION WITH DATABASE-LEVEL STOCK RESERVATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_pickup_order_atomic(
  p_idempotency_key VARCHAR,
  p_customer_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_total_amount NUMERIC,
  p_coupon_code TEXT,
  p_gift_code TEXT,
  p_gift_code_id UUID,
  p_gift_code_discount NUMERIC,
  p_pickup_mode TEXT,
  p_pickup_slot_date DATE,
  p_pickup_slot_time TEXT,
  p_customer_notes TEXT,
  p_reservation_hours INT DEFAULT 24
)
RETURNS JSONB AS $$
DECLARE
  v_existing_order RECORD;
  v_new_order_id UUID;
  v_order_number TEXT;
  v_qr_token TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INT;
  v_unit_price NUMERIC;
  v_mrp NUMERIC;
  v_prod_name TEXT;
  v_variant_name TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Idempotency Check: if identical key already exists, return existing order
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT * INTO v_existing_order
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'orderId', v_existing_order.id,
        'orderNumber', v_existing_order.order_number,
        'status', v_existing_order.status
      );
    END IF;
  END IF;

  -- 2. Atomically reserve inventory for all items (locks rows & validates quantity)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_variant_id := CASE WHEN v_item->>'variantId' IS NOT NULL AND v_item->>'variantId' <> '' THEN (v_item->>'variantId')::UUID ELSE NULL END;
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
        RAISE EXCEPTION 'Insufficient stock quantity for product ID %', v_product_id;
      END IF;
    END IF;
  END LOOP;

  -- 3. Calculate reservation expiry
  v_expires_at := NOW() + (p_reservation_hours || ' hours')::INTERVAL;
  v_new_order_id := gen_random_uuid();
  v_order_number := 'JT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
  v_qr_token := 'JT-QR-' || v_order_number || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));

  -- 4. Insert order record
  INSERT INTO public.orders (
    id,
    order_number,
    idempotency_key,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    status,
    payment_status,
    payment_method,
    subtotal,
    discount,
    total_amount,
    coupon_code,
    gift_code,
    gift_code_id,
    gift_code_discount,
    amount_due,
    amount_received,
    pickup_mode,
    pickup_slot_date,
    pickup_slot_time,
    customer_notes,
    qr_token,
    reservation_expires_at,
    created_at,
    updated_at
  ) VALUES (
    v_new_order_id,
    v_order_number,
    p_idempotency_key,
    p_customer_id,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    'PENDING',
    'UNPAID',
    'Pay at Shop',
    p_subtotal,
    p_discount,
    p_total_amount,
    p_coupon_code,
    p_gift_code,
    p_gift_code_id,
    p_gift_code_discount,
    p_total_amount,
    0,
    COALESCE(p_pickup_mode, 'FLEXIBLE'),
    p_pickup_slot_date,
    p_pickup_slot_time,
    p_customer_notes,
    v_qr_token,
    v_expires_at,
    NOW(),
    NOW()
  );

  -- 5. Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_variant_id := CASE WHEN v_item->>'variantId' IS NOT NULL AND v_item->>'variantId' <> '' THEN (v_item->>'variantId')::UUID ELSE NULL END;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unitPrice')::NUMERIC;
    v_prod_name := COALESCE(v_item->>'productName', 'Product');
    v_variant_name := v_item->>'variantName';

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      variant_name,
      unit_price,
      quantity,
      total_price
    ) VALUES (
      v_new_order_id,
      v_product_id,
      v_variant_id,
      v_prod_name,
      v_variant_name,
      v_unit_price,
      v_quantity,
      v_unit_price * v_quantity
    );

    -- Record inventory movement
    INSERT INTO public.inventory_movements (
      product_id,
      variant_id,
      quantity_change,
      previous_stock,
      new_stock,
      reason,
      order_id,
      notes,
      actor_id,
      created_at
    ) VALUES (
      v_product_id,
      v_variant_id,
      v_quantity,
      0,
      0,
      'reservation',
      v_new_order_id,
      'Reserved for customer pickup order ' || v_order_number,
      p_customer_id,
      NOW()
    );
  END LOOP;

  -- 6. Insert initial status history
  INSERT INTO public.order_status_history (
    order_id,
    from_status,
    to_status,
    note,
    changed_by,
    created_at
  ) VALUES (
    v_new_order_id,
    NULL,
    'PENDING',
    'Customer reserved order for shop pickup',
    p_customer_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'orderId', v_new_order_id,
    'orderNumber', v_order_number,
    'status', 'PENDING',
    'reservationExpiresAt', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 4. ATOMIC RESERVATION EXPIRY CLEANUP (CRON & BACKGROUND SAFE)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations_atomic(
  p_actor_id TEXT DEFAULT 'system_cron'
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_expired_count INT := 0;
  v_expired_numbers TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_order IN
    SELECT * FROM public.orders
    WHERE status IN ('PENDING', 'CONFIRMED')
    AND reservation_expires_at IS NOT NULL
    AND reservation_expires_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 1. Release reserved inventory
    FOR v_item IN
      SELECT * FROM public.order_items
      WHERE order_id = v_order.id
    LOOP
      IF v_item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET reserved_stock = GREATEST(0, reserved_stock - v_item.quantity)
        WHERE id = v_item.variant_id;
      ELSE
        UPDATE public.products
        SET reserved_stock = GREATEST(0, reserved_stock - v_item.quantity)
        WHERE id = v_item.product_id;
      END IF;

      INSERT INTO public.inventory_movements (
        product_id,
        variant_id,
        quantity_change,
        previous_stock,
        new_stock,
        reason,
        order_id,
        notes,
        created_at
      ) VALUES (
        v_item.product_id,
        v_item.variant_id,
        v_item.quantity,
        0,
        0,
        'release_reservation',
        v_order.id,
        'Released expired reservation for order ' || v_order.order_number,
        NOW()
      );
    END LOOP;

    -- 2. Restore gift code if redeemed
    IF v_order.gift_code_id IS NOT NULL THEN
      PERFORM public.restore_gift_code_cancellation_atomic(
        v_order.id,
        v_order.order_number,
        p_actor_id,
        'system'
      );
    END IF;

    -- 3. Transition order status to EXPIRED
    UPDATE public.orders
    SET status = 'EXPIRED',
        updated_at = NOW()
    WHERE id = v_order.id;

    -- 4. Record status history
    INSERT INTO public.order_status_history (
      order_id,
      from_status,
      to_status,
      note,
      created_at
    ) VALUES (
      v_order.id,
      v_order.status,
      'EXPIRED',
      'Order automatically expired because pickup deadline elapsed without collection',
      NOW()
    );

    v_expired_count := v_expired_count + 1;
    v_expired_numbers := array_append(v_expired_numbers, v_order.order_number);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expiredCount', v_expired_count,
    'expiredOrderNumbers', v_expired_numbers
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 5. ATOMIC COUNTER PAYMENT RECORDING
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_counter_payment_atomic(
  p_order_id UUID,
  p_amount_received NUMERIC,
  p_payment_method TEXT,
  p_staff_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_new_received NUMERIC;
  v_new_due NUMERIC;
  v_new_status payment_status_enum;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF p_amount_received <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount received must be greater than zero');
  END IF;

  v_new_received := COALESCE(v_order.amount_received, 0) + p_amount_received;
  v_new_due := GREATEST(0, v_order.total_amount - v_new_received);

  IF v_new_due = 0 THEN
    v_new_status := 'PAID';
  ELSE
    v_new_status := 'PARTIALLY_PAID';
  END IF;

  UPDATE public.orders
  SET amount_received = v_new_received,
      amount_due = v_new_due,
      payment_status = v_new_status,
      payment_method = p_payment_method,
      payment_recorded_at = NOW(),
      payment_recorded_by = p_staff_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'orderNumber', v_order.order_number,
    'amountReceived', v_new_received,
    'amountDue', v_new_due,
    'paymentStatus', v_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
