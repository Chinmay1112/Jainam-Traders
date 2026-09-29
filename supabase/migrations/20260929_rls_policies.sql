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
