-- ====================================================================
-- JAINAM TRADERS: CONSOLIDATED PRODUCTION MIGRATION SCRIPT
-- Copy all contents of this file and paste into Supabase SQL Editor
-- Generated from authoritative migrations in supabase/migrations/
-- ====================================================================


-- ====================================================================
-- MIGRATION: 20260929_init_schema.sql
-- ====================================================================

-- ==============================================================================
-- JAINAM TRADERS - PRODUCTION POSTGRESQL / SUPABASE INITIAL SCHEMA
-- Local Retail Store: Discover -> Reserve -> Pick Up -> Pay at Shop
-- ==============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. ENUMS & DOMAINS
-- ------------------------------------------------------------------------------
CREATE TYPE user_role_enum AS ENUM ('owner', 'admin', 'store_manager', 'staff', 'customer');
CREATE TYPE order_status_enum AS ENUM (
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURN_APPROVED',
  'RETURN_REJECTED',
  'RETURNED',
  'REFUND_RECORDED'
);
CREATE TYPE payment_status_enum AS ENUM (
  'UNPAID',
  'PAID',
  'PARTIALLY_PAID',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);
CREATE TYPE discount_type_enum AS ENUM ('percentage', 'fixed');
CREATE TYPE review_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE refund_method_enum AS ENUM ('cash', 'upi', 'manual');
CREATE TYPE inventory_movement_reason_enum AS ENUM (
  'purchase',
  'sale',
  'damage',
  'missing',
  'manual_correction',
  'return',
  'restock',
  'reservation',
  'release_reservation'
);

-- ------------------------------------------------------------------------------
-- 2. USERS & PROFILES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role user_role_enum NOT NULL DEFAULT 'customer',
  avatar_url TEXT,
  saved_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ------------------------------------------------------------------------------
-- 3. SHOP SETTINGS & BUSINESS HOURS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_name TEXT NOT NULL DEFAULT 'Jainam Traders',
  shop_tagline TEXT DEFAULT 'Your Trusted Local Gift & Stationery Destination',
  shop_logo_url TEXT,
  shop_address TEXT,
  google_maps_url TEXT NOT NULL DEFAULT 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
  latitude NUMERIC(10, 7) DEFAULT 22.2765869,
  longitude NUMERIC(10, 7) DEFAULT 75.7979897,
  phone TEXT,
  whatsapp_number TEXT,
  email TEXT NOT NULL DEFAULT 'contact@jainamtraders.com',
  opening_time TIME NOT NULL DEFAULT '09:30:00',
  closing_time TIME NOT NULL DEFAULT '21:30:00',
  weekly_closed_days TEXT[] DEFAULT ARRAY['Sunday']::TEXT[],
  holiday_dates DATE[] DEFAULT ARRAY[]::DATE[],
  shop_description TEXT DEFAULT 'Specializing in fine gift articles, artistic photo frames, vintage & digital wall clocks, premium wristwatches, leather belts & purses, imported toys, executive stationery, and decorative showpieces.',
  pickup_instructions TEXT DEFAULT 'Orders are held at our dedicated pickup counter for up to 3 days. Please present your Order ID (JT-...) or show your digital QR code upon arrival. Payment can be made at the counter via Cash or UPI.',
  is_mode_b_slots_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_orders_per_slot INT NOT NULL DEFAULT 10,
  social_facebook TEXT,
  social_instagram TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure single settings row pattern
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_shop_settings ON public.shop_settings((TRUE));

-- ------------------------------------------------------------------------------
-- 4. CATEGORIES & SUBCATEGORIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. PRODUCTS & VARIANTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  mrp NUMERIC(10, 2) NOT NULL CHECK (mrp >= price),
  discount_percentage INT GENERATED ALWAYS AS (
    CASE WHEN mrp > 0 THEN ROUND(((mrp - price) / mrp) * 100) ELSE 0 END
  ) STORED,
  thumbnail_url TEXT NOT NULL,
  images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  video_url TEXT,
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_stock INT NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  low_stock_threshold INT NOT NULL DEFAULT 3,
  min_order_quantity INT NOT NULL DEFAULT 1,
  max_order_quantity INT NOT NULL DEFAULT 10,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  brand TEXT DEFAULT 'Jainam Crafts',
  dimensions TEXT,
  weight TEXT,
  material TEXT,
  colour TEXT,
  size TEXT,
  occasion TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_new_arrival BOOLEAN NOT NULL DEFAULT FALSE,
  is_best_seller BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products(price);
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN(tags);

-- Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  variant_type TEXT NOT NULL, -- 'colour', 'size', 'design', 'pack_size'
  variant_value TEXT NOT NULL,
  price_override NUMERIC(10, 2) CHECK (price_override IS NULL OR price_override >= 0),
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_stock INT NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);

-- ------------------------------------------------------------------------------
-- 6. INVENTORY MOVEMENTS (AUDIT TRAIL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity_change INT NOT NULL,
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  reason inventory_movement_reason_enum NOT NULL,
  order_id UUID,
  notes TEXT,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. CARTS & WISHLISTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, product_id, variant_id)
);

CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wishlist_id UUID NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wishlist_id, product_id)
);

-- ------------------------------------------------------------------------------
-- 8. COUPONS & OFFERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  discount_type discount_type_enum NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  max_discount NUMERIC(10, 2),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  usage_limit INT,
  used_count INT NOT NULL DEFAULT 0,
  per_customer_limit INT DEFAULT 1,
  first_order_only BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  badge_text TEXT,
  description TEXT,
  offer_type TEXT NOT NULL DEFAULT 'percentage',
  discount_pct INT,
  min_spend NUMERIC(10, 2),
  banner_image TEXT,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. ORDERS & ORDER ITEMS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE, -- e.g. JT-2026-000101
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  status order_status_enum NOT NULL DEFAULT 'PENDING',
  payment_status payment_status_enum NOT NULL DEFAULT 'UNPAID',
  payment_method TEXT NOT NULL DEFAULT 'Pay at Shop',
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  coupon_code TEXT,
  pickup_mode TEXT NOT NULL DEFAULT 'FLEXIBLE', -- 'FLEXIBLE' or 'SLOT'
  pickup_slot_date DATE,
  pickup_slot_time TEXT,
  customer_notes TEXT,
  admin_notes TEXT,
  qr_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_qr ON public.orders(qr_token);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status order_status_enum,
  to_status order_status_enum NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  discount_applied NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. RETURNS & PHYSICAL REFUND RECORDS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  status order_status_enum NOT NULL DEFAULT 'RETURN_REQUESTED',
  admin_decision_notes TEXT,
  decided_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refund_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_request_id UUID REFERENCES public.return_requests(id) ON DELETE SET NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  refund_amount NUMERIC(10, 2) NOT NULL CHECK (refund_amount > 0),
  refund_method refund_method_enum NOT NULL DEFAULT 'cash',
  receipt_number TEXT NOT NULL,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. REVIEWS (VERIFIED PURCHASE ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT NOT NULL,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  status review_status_enum NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, product_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);

-- ------------------------------------------------------------------------------
-- 12. NOTIFICATIONS & IN-APP SUPPORT CHAT
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  notification_type TEXT NOT NULL DEFAULT 'order',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'RESOLVED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role user_role_enum NOT NULL DEFAULT 'customer',
  message TEXT NOT NULL,
  attachments TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. AUDIT LOGS (IMMUTABLE ENTERPRISE RECORD)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);

-- ------------------------------------------------------------------------------
-- 14. ATOMIC RPC FUNCTIONS (CONCURRENCY-SAFE INVENTORY RESERVATION)
-- ------------------------------------------------------------------------------

-- Reserve stock during checkout with row-level locks
CREATE OR REPLACE FUNCTION public.reserve_order_inventory(
  p_items JSONB -- Array of { "product_id": "...", "variant_id": null|"...", "quantity": 1 }
) RETURNS BOOLEAN AS $$
DECLARE
  v_item RECORD;
  v_curr_stock INT;
  v_reserved INT;
  v_avail INT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, variant_id UUID, quantity INT)
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      -- Lock the variant row
      SELECT stock_quantity, reserved_stock INTO v_curr_stock, v_reserved
      FROM public.product_variants
      WHERE id = v_item.variant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant % not found', v_item.variant_id;
      END IF;

      v_avail := v_curr_stock - v_reserved;
      IF v_avail < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for variant %. Available: %, Requested: %', v_item.variant_id, v_avail, v_item.quantity;
      END IF;

      -- Update reserved stock
      UPDATE public.product_variants
      SET reserved_stock = reserved_stock + v_item.quantity
      WHERE id = v_item.variant_id;
    ELSE
      -- Lock the product row
      SELECT stock_quantity, reserved_stock INTO v_curr_stock, v_reserved
      FROM public.products
      WHERE id = v_item.product_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', v_item.product_id;
      END IF;

      v_avail := v_curr_stock - v_reserved;
      IF v_avail < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %', v_item.product_id, v_avail, v_item.quantity;
      END IF;

      -- Update reserved stock
      UPDATE public.products
      SET reserved_stock = reserved_stock + v_item.quantity
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Release stock when order is cancelled
CREATE OR REPLACE FUNCTION public.release_order_inventory(
  p_order_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN SELECT product_id, variant_id, quantity FROM public.order_items WHERE order_id = p_order_id
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
  END LOOP;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Finalize stock deduction when picked up
CREATE OR REPLACE FUNCTION public.finalize_order_inventory(
  p_order_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN SELECT product_id, variant_id, quantity FROM public.order_items WHERE order_id = p_order_id
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock_quantity = GREATEST(0, stock_quantity - v_item.quantity),
          reserved_stock = GREATEST(0, reserved_stock - v_item.quantity)
      WHERE id = v_item.variant_id;
    ELSE
      UPDATE public.products
      SET stock_quantity = GREATEST(0, stock_quantity - v_item.quantity),
          reserved_stock = GREATEST(0, reserved_stock - v_item.quantity)
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- MIGRATION: 20260929_rls_policies.sql
-- ====================================================================

-- ==============================================================================
-- JAINAM TRADERS - ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper to check user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role_enum AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'admin', 'store_manager', 'staff')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. PROFILES
CREATE POLICY "Users can read own profile or staff can read all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin_or_staff());

CREATE POLICY "Users can update own non-role fields"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin can update any profile"
  ON public.profiles FOR ALL
  USING (public.is_admin_or_owner());

-- 2. SHOP SETTINGS
CREATE POLICY "Public read shop settings"
  ON public.shop_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Admin write shop settings"
  ON public.shop_settings FOR ALL
  USING (public.is_admin_or_owner());

-- 3. CATEGORIES & SUBCATEGORIES
CREATE POLICY "Public read active categories"
  ON public.categories FOR SELECT
  USING (is_active = TRUE OR public.is_admin_or_staff());

CREATE POLICY "Admin write categories"
  ON public.categories FOR ALL
  USING (public.is_admin_or_staff());

CREATE POLICY "Public read active subcategories"
  ON public.subcategories FOR SELECT
  USING (is_active = TRUE OR public.is_admin_or_staff());

CREATE POLICY "Admin write subcategories"
  ON public.subcategories FOR ALL
  USING (public.is_admin_or_staff());

-- 4. PRODUCTS & VARIANTS
CREATE POLICY "Public read active products"
  ON public.products FOR SELECT
  USING (is_active = TRUE OR public.is_admin_or_staff());

CREATE POLICY "Admin write products"
  ON public.products FOR ALL
  USING (public.is_admin_or_staff());

CREATE POLICY "Public read active variants"
  ON public.product_variants FOR SELECT
  USING (is_active = TRUE OR public.is_admin_or_staff());

CREATE POLICY "Admin write variants"
  ON public.product_variants FOR ALL
  USING (public.is_admin_or_staff());

-- 5. CARTS & WISHLISTS
CREATE POLICY "Users access own cart"
  ON public.carts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users access own cart items"
  ON public.cart_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));

CREATE POLICY "Users access own wishlist"
  ON public.wishlists FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users access own wishlist items"
  ON public.wishlist_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.wishlists WHERE wishlists.id = wishlist_items.wishlist_id AND wishlists.user_id = auth.uid()));

-- 6. COUPONS & OFFERS
CREATE POLICY "Public read active coupons and offers"
  ON public.coupons FOR SELECT
  USING (is_active = TRUE OR public.is_admin_or_staff());

CREATE POLICY "Admin write coupons"
  ON public.coupons FOR ALL
  USING (public.is_admin_or_staff());

CREATE POLICY "Public read active offers"
  ON public.offers FOR SELECT
  USING (is_active = TRUE OR public.is_admin_or_staff());

CREATE POLICY "Admin write offers"
  ON public.offers FOR ALL
  USING (public.is_admin_or_staff());

-- 7. ORDERS & ORDER ITEMS
CREATE POLICY "Customer read own orders or staff read all"
  ON public.orders FOR SELECT
  USING (customer_id = auth.uid() OR public.is_admin_or_staff());

CREATE POLICY "Authenticated users can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Staff can update orders"
  ON public.orders FOR UPDATE
  USING (public.is_admin_or_staff());

CREATE POLICY "Customer read own order items or staff read all"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.customer_id = auth.uid() OR public.is_admin_or_staff()))
  );

CREATE POLICY "Staff write order items"
  ON public.order_items FOR ALL
  USING (public.is_admin_or_staff());

CREATE POLICY "View order status history"
  ON public.order_status_history FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_status_history.order_id AND (orders.customer_id = auth.uid() OR public.is_admin_or_staff()))
  );

CREATE POLICY "System/Staff insert order status history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (public.is_admin_or_staff() OR auth.uid() IS NOT NULL);

-- 8. RETURNS & REFUNDS
CREATE POLICY "Customer read own return requests or staff read all"
  ON public.return_requests FOR SELECT
  USING (customer_id = auth.uid() OR public.is_admin_or_staff());

CREATE POLICY "Customer create return request for own order"
  ON public.return_requests FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Staff manage return requests"
  ON public.return_requests FOR UPDATE
  USING (public.is_admin_or_staff());

CREATE POLICY "Staff manage refund records"
  ON public.refund_records FOR ALL
  USING (public.is_admin_or_staff());

-- 9. REVIEWS
CREATE POLICY "Public read approved reviews"
  ON public.reviews FOR SELECT
  USING (status = 'approved' OR customer_id = auth.uid() OR public.is_admin_or_staff());

CREATE POLICY "Customer insert review for own completed order"
  ON public.reviews FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Staff moderate reviews"
  ON public.reviews FOR UPDATE
  USING (public.is_admin_or_staff());

-- 10. NOTIFICATIONS
CREATE POLICY "Users read and update own notifications"
  ON public.notifications FOR ALL
  USING (customer_id = auth.uid());

-- 11. SUPPORT CONVERSATIONS & MESSAGES
CREATE POLICY "Users read own conversations or staff read all"
  ON public.support_conversations FOR SELECT
  USING (customer_id = auth.uid() OR public.is_admin_or_staff());

CREATE POLICY "Users create own support conversation"
  ON public.support_conversations FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Conversation participants read messages"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = support_messages.conversation_id
      AND (c.customer_id = auth.uid() OR public.is_admin_or_staff())
    )
  );

CREATE POLICY "Conversation participants post messages"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = support_messages.conversation_id
      AND (c.customer_id = auth.uid() OR public.is_admin_or_staff())
    )
  );

-- 12. AUDIT LOGS
CREATE POLICY "Admin view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin_or_owner());

-- ====================================================================
-- MIGRATION: 20261002_crm_gift_codes_atomic.sql
-- ====================================================================

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

-- ====================================================================
-- MIGRATION: 20261002_product_duplicate_prevention.sql
-- ====================================================================

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

-- ====================================================================
-- MIGRATION: 20261002_production_order_concurrency_idempotency.sql
-- ====================================================================

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

-- ====================================================================
-- MIGRATION: 20261002_correct_jainam_traders_shop_settings.sql
-- ====================================================================

-- ==============================================================================
-- JAINAM TRADERS - AUTHORITATIVE SHOP INFORMATION & MAPS LOCATION CORRECTION
-- Sets the verified Google Maps location URL and precise GPS coordinates.
-- Clears unverified guessed phone numbers and placeholder street addresses.
-- ==============================================================================

-- 1. ENSURE COLUMNS ARE NULLABLE FOR ZERO-UNVERIFIED-DATA GUARANTEE
ALTER TABLE public.shop_settings ALTER COLUMN shop_address DROP NOT NULL;
ALTER TABLE public.shop_settings ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.shop_settings ALTER COLUMN whatsapp_number DROP NOT NULL;

-- 2. UPDATE OR INSERT THE SINGLE AUTHORITATIVE SHOP SETTINGS RECORD
DO $$
BEGIN
  -- If shop_settings table has existing row, update to authoritative location
  UPDATE public.shop_settings
  SET
    shop_name = 'Jainam Traders',
    shop_tagline = 'GIFTS • TOYS • ACCESSORIES • MORE',
    shop_logo_url = '/images/jainam-logo.svg',
    google_maps_url = 'https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA',
    latitude = 22.2765869,
    longitude = 75.7979897,
    -- Clear unverified guessed address and phone defaults so real verified data is entered by owner
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

  -- If no record exists yet, insert the single canonical settings row
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
