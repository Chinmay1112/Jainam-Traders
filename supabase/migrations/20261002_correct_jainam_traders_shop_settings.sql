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
