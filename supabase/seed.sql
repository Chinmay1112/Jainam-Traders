-- ==============================================================================
-- JAINAM TRADERS - COMPREHENSIVE SEED DATA
-- 30 Realistic Retail & Gift Products, Real INR Prices, Categories, Settings
-- ==============================================================================

-- 1. SHOP SETTINGS
INSERT INTO public.shop_settings (
  id,
  shop_name,
  shop_tagline,
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
  is_mode_b_slots_enabled
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Jainam Traders',
  'GIFTS • TOYS • ACCESSORIES • MORE',
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
  'Serving our local community for over 18 years. Premium photo frames, artistic wall clocks, executive stationery, leather accessories, toys, and memorable mementos.',
  'Show your Order Number (JT-...) or digital QR code at our counter. Orders are inspected and packed with care. Payment accepted via Cash or UPI at collection.',
  TRUE
) ON CONFLICT DO NOTHING;

-- 2. CATEGORIES
INSERT INTO public.categories (id, name, slug, description, icon, is_featured, sort_order) VALUES
('b0000000-0000-0000-0000-000000000001', 'Gift Articles & Mementos', 'gifts-mementos', 'Curated gift hampers, crystal mementos, brass idols & trophy pieces', 'Gift', TRUE, 1),
('b0000000-0000-0000-0000-000000000002', 'Photo Frames & Albums', 'photo-frames', 'Wooden, acrylic, metallic and collage photo frames', 'Image', TRUE, 2),
('b0000000-0000-0000-0000-000000000003', 'Clocks & Timepieces', 'clocks', 'Vintage pendulum, silent sweep wall clocks, and digital desk clocks', 'Clock', TRUE, 3),
('b0000000-0000-0000-0000-000000000004', 'Watches & Smart Bands', 'watches', 'Analog quartz wristwatches and daily activity bands for men and women', 'Watch', TRUE, 4),
('b0000000-0000-0000-0000-000000000005', 'Leather Belts & Purses', 'belts-purses', 'Genuine and cruelty-free faux leather wallets, cardholders, belts and clutches', 'Briefcase', TRUE, 5),
('b0000000-0000-0000-0000-000000000006', 'Perfumes & Fragrances', 'perfumes', 'Long-lasting luxury EDPs, attars, and body mists', 'Sparkles', FALSE, 6),
('b0000000-0000-0000-0000-000000000007', 'Toys & Board Games', 'toys-games', 'STEM learning toys, educational board games, remote cars, and soft plushes', 'Gamepad2', TRUE, 7),
('b0000000-0000-0000-0000-000000000008', 'Executive Stationery', 'stationery', 'Fine metal rollerball pens, leather planners, desk organizers, and art kits', 'PenTool', FALSE, 8),
('b0000000-0000-0000-0000-000000000009', 'Decorative & Home Showpieces', 'decorative', 'Handcrafted resin statues, brass diyas, feng shui crystals, and tabletop art', 'Heart', TRUE, 9)
ON CONFLICT (slug) DO NOTHING;

-- 3. PRODUCTS (30 REALISTIC ITEMS ACROSS CATEGORIES)
INSERT INTO public.products (
  id, name, sku, slug, category_id, description, short_description, price, mrp,
  thumbnail_url, images, stock_quantity, reserved_stock, low_stock_threshold,
  tags, brand, material, colour, dimensions, weight, occasion, is_featured, is_new_arrival, is_best_seller
) VALUES
-- Photo Frames
('c0000000-0000-0000-0000-000000000001', 'Handcrafted Rosewood 8x10 Photo Frame', 'JT-PF-001', 'handcrafted-rosewood-8x10-photo-frame', 'b0000000-0000-0000-0000-000000000002',
 'Elevate your cherished family memories with this solid Indian rosewood frame. Features polished brass corner accents, anti-glare museum glass, and dual orientation tabletop kickstand and wall hanging hooks.',
 'Solid Indian rosewood frame with brass corner accents and anti-glare glass.',
 599.00, 899.00,
 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80'],
 15, 0, 3, ARRAY['photo frame', 'rosewood', 'home decor', 'memories', 'gift'], 'Jainam Heritage', 'Solid Sheesham Rosewood & Glass', 'Natural Brown', '25 x 30 x 2 cm', '450g', 'Anniversary / Housewarming', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000002', 'Minimalist Black Matte 6-in-1 Collage Frame', 'JT-PF-002', 'minimalist-black-matte-collage-frame', 'b0000000-0000-0000-0000-000000000002',
 'Stunning horizontal/vertical modern gallery collage frame holding six 4x6 photos. Perfect for family timelines, graduation memories, and holiday snapshots.',
 'Modern multi-aperture gallery frame holding six 4x6 photos.',
 849.00, 1299.00,
 'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=800&auto=format&fit=crop&q=80'],
 12, 0, 2, ARRAY['collage', 'gallery wall', 'black frame', 'modern'], 'Urban Vista', 'Engineered Wood & Acrylic', 'Matte Black', '48 x 36 x 2.5 cm', '750g', 'Birthday / Family', FALSE, TRUE, TRUE),

('c0000000-0000-0000-0000-000000000003', 'Antique Gold Filigree Tabletop Frame 5x7', 'JT-PF-003', 'antique-gold-filigree-tabletop-frame-5x7', 'b0000000-0000-0000-0000-000000000002',
 'Intricately embossed royal Mughal-inspired filigree gold plated brass frame. Adds vintage grandeur to bedside consoles and study tables.',
 'Royal filigree metal embossed photo frame with velvet backing.',
 499.00, 750.00,
 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80'],
 20, 0, 4, ARRAY['antique', 'gold frame', 'vintage', 'filigree'], 'Royal Artisans', 'Cast Zinc Alloy & Gold Finish', 'Antique Gold', '18 x 23 x 2 cm', '380g', 'Wedding / Festival', TRUE, FALSE, FALSE),

-- Clocks
('c0000000-0000-0000-0000-000000000004', 'Silent Sweep 12-inch Wooden Wall Clock', 'JT-CK-001', 'silent-sweep-12-inch-wooden-wall-clock', 'b0000000-0000-0000-0000-000000000003',
 'Ultra-quiet continuous sweep quartz movement without annoying ticking sounds. Handcrafted teakwood frame with large embossed 3D numerals legible from across the room.',
 'Noiseless Japanese sweep quartz movement with natural teakwood bezel.',
 999.00, 1599.00,
 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=800&auto=format&fit=crop&q=80'],
 10, 0, 3, ARRAY['clock', 'wooden clock', 'silent clock', 'wall decor'], 'ChronoTime', 'Teakwood & Mineral Glass', 'Walnut Brown', '30 cm Diameter', '820g', 'Housewarming / Office', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000005', 'Vintage Railway Station Double-Sided Wall Clock', 'JT-CK-002', 'vintage-railway-station-double-sided-clock', 'b0000000-0000-0000-0000-000000000003',
 'Victorian wrought iron station clock with 360-degree rotation bracket. Double-faced dial allows viewing time from both directions in hallways and living rooms.',
 'Classic double-sided railway station clock with ornate forged iron bracket.',
 1799.00, 2499.00,
 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1508057198894-247b23fe5ade?w=800&auto=format&fit=crop&q=80'],
 6, 0, 2, ARRAY['vintage clock', 'railway clock', 'double sided', 'wrought iron'], 'Grand Central', 'Cast Iron & Glass', 'Antique Black', '35 x 30 x 10 cm', '1.8 kg', 'Housewarming', FALSE, TRUE, FALSE),

('c0000000-0000-0000-0000-000000000006', 'Smart LED Wooden Desk Alarm Clock with Temperature', 'JT-CK-003', 'smart-led-wooden-desk-alarm-clock', 'b0000000-0000-0000-0000-000000000003',
 'Modern acoustic-sensor digital block clock. Display lights up with a gentle tap or sound. Displays 12/24 hour time, date, and ambient room temperature.',
 'Modern triangular timber desk clock with hidden LED display.',
 699.00, 1099.00,
 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&auto=format&fit=crop&q=80'],
 14, 0, 3, ARRAY['desk clock', 'led clock', 'alarm', 'smart gadget'], 'Nordic Living', 'MDF Wood Grain Finish', 'Bamboo Light Oak', '15 x 7 x 4 cm', '240g', 'Work Desk / Student', FALSE, FALSE, TRUE),

-- Watches
('c0000000-0000-0000-0000-000000000007', 'Classic Brown Leather Analog Watch - Men', 'JT-WT-001', 'classic-brown-leather-analog-watch-men', 'b0000000-0000-0000-0000-000000000004',
 'Sophisticated champagne dial with Roman hour indices, date window, and supple genuine leather strap. 3 ATM water resistant casing.',
 'Timeless dress watch with champagne dial and top-grain leather band.',
 1299.00, 1999.00,
 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80'],
 18, 0, 4, ARRAY['watch', 'mens watch', 'leather strap', 'quartz'], 'Krono Royal', 'Stainless Steel & Leather', 'Rose Gold / Tan Brown', '42mm Dial', '65g', 'Birthday / Groom', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000008', 'Rose Gold Mesh Strap Minimalist Watch - Women', 'JT-WT-002', 'rose-gold-mesh-strap-minimalist-watch-women', 'b0000000-0000-0000-0000-000000000004',
 'Ultra-slim 7mm profile watch featuring mother-of-pearl dial with Swarovski crystal markers and adjustable magnetic Milanese mesh strap.',
 'Ultra-slim rose gold Milanese watch with Swarovski crystal indices.',
 1499.00, 2299.00,
 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=800&auto=format&fit=crop&q=80'],
 11, 0, 3, ARRAY['womens watch', 'rose gold', 'mesh strap', 'slender'], 'Aura Elegance', 'Stainless Steel Mesh & Mineral Glass', 'Rose Gold', '32mm Dial', '48g', 'Anniversary / Gifting', TRUE, TRUE, FALSE),

-- Belts & Purses
('c0000000-0000-0000-0000-000000000009', 'Full-Grain Leather Reversible Formal Belt', 'JT-BL-001', 'full-grain-leather-reversible-formal-belt', 'b0000000-0000-0000-0000-000000000005',
 'Two-in-one wardrobe staple. Twist the brushed chrome alloy buckle to switch between classic Black and rich Dark Brown. Hand-stitched edges.',
 'Reversible 2-in-1 genuine leather belt (Black & Dark Brown) with swivel buckle.',
 699.00, 1199.00,
 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&auto=format&fit=crop&q=80'],
 25, 0, 5, ARRAY['belt', 'leather belt', 'reversible', 'formal'], 'Equator Leather', '100% Genuine Bovine Leather', 'Black / Dark Brown', '35mm Width, Sizes 30-42', '190g', 'Formal / Executive Gift', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000010', 'RFID Blocking Men Leather Bifold Wallet with Coin Pocket', 'JT-WL-001', 'rfid-blocking-leather-bifold-wallet', 'b0000000-0000-0000-0000-000000000005',
 'Handcrafted hunter leather wallet embedded with military-grade RFID lining to prevent digital skimming. Holds 8 cards, 2 currency compartments, and a snap coin pouch.',
 'Supple hunter leather wallet with RFID anti-theft shield and dual cash slots.',
 549.00, 899.00,
 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80'],
 22, 0, 4, ARRAY['wallet', 'leather wallet', 'rfid', 'gift for him'], 'Equator Leather', 'Distressed Hunter Leather', 'Vintage Tan', '11.5 x 9.5 x 2 cm', '95g', 'Birthday / Father Day', FALSE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000011', 'Embroidered Silk Party Clutch with Detachable Chain', 'JT-PS-001', 'embroidered-silk-party-clutch', 'b0000000-0000-0000-0000-000000000005',
 'Exquisite Zari hand-embroidered festive clutch box with crystal studded clasp. Accommodates smartphones up to 6.7 inches, cards, and makeup essentials.',
 'Handmade raw silk clutch with antique golden Zari thread embroidery.',
 899.00, 1499.00,
 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&auto=format&fit=crop&q=80'],
 16, 0, 3, ARRAY['clutch', 'purse', 'zari', 'wedding accessory'], 'Virasat Crafts', 'Raw Silk, Metal Box, Velvet Lining', 'Deep Maroon Gold', '20 x 12 x 5 cm', '320g', 'Wedding / Sangeet', TRUE, TRUE, FALSE),

-- Gift Articles & Mementos
('c0000000-0000-0000-0000-000000000012', 'Pure Brass Lord Ganesha Idol on Lotus Base', 'JT-GF-001', 'pure-brass-lord-ganesha-idol', 'b0000000-0000-0000-0000-000000000001',
 'Auspicous solid brass sculpted Vinayaka idol seated on a sacred lotus pediment. Finished with antique lacquer that resists tarnishing. Comes in a royal velvet gift box.',
 'Heavyweight 100% solid yellow brass Ganpati Bappa idol in velvet gift box.',
 1249.00, 1899.00,
 'https://images.unsplash.com/photo-1567591414240-e22e9e6ffcf1?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1567591414240-e22e9e6ffcf1?w=800&auto=format&fit=crop&q=80'],
 8, 0, 2, ARRAY['brass idol', 'ganesha', 'auspicious', 'pooja', 'diwali gift'], 'Jainam Heritage', 'Solid Cast Brass', 'Antique Brass Polish', '14 x 10 x 8 cm', '750g', 'Housewarming / Diwali / Pooja', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000013', 'Laser-Engraved Crystal 3D Globe Paperweight Memento', 'JT-GF-002', 'laser-engraved-crystal-3d-globe-memento', 'b0000000-0000-0000-0000-000000000001',
 'Optically pure K9 lead-free crystal sphere with laser micro-etched world topography. Heavy facet-cut square base suitable for corporate awards and farewell gifting.',
 'K9 crystal globe memento with laser inner-engraving and beveled glass base.',
 649.00, 999.00,
 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80'],
 15, 0, 3, ARRAY['memento', 'crystal', 'paperweight', 'corporate gift'], 'Lumin Crystal', 'K9 Optical Crystal', 'Transparent Prismatic', '8 x 8 x 10 cm', '620g', 'Farewell / Corporate Milestone', FALSE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000014', 'Executive 3-Piece Gift Hamper (Pen, Keychain & Cardholder)', 'JT-GF-003', 'executive-3-piece-gift-hamper', 'b0000000-0000-0000-0000-000000000001',
 'Curated premium set containing a matte metal rollerball pen, stitched leather keychain with hook, and magnetic steel cardholder. Packed in a satin-lined hardboard case.',
 'Complete corporate gifting trio in a magnetic presentation box.',
 799.00, 1299.00,
 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800&auto=format&fit=crop&q=80'],
 20, 0, 4, ARRAY['gift set', 'pen set', 'corporate gift', 'hamper'], 'Executive Elite', 'Metal Alloy & Vegan Leather', 'Gunmetal Matte Black', '22 x 16 x 4 cm', '420g', 'Corporate / Promotion / Birthday', TRUE, TRUE, TRUE),

-- Perfumes
('c0000000-0000-0000-0000-000000000015', 'Oud Royale Eau De Parfum 100ml', 'JT-PF-010', 'oud-royale-eau-de-parfum-100ml', 'b0000000-0000-0000-0000-000000000006',
 'A deep oriental blend of Cambodian agarwood, Damascus rose, warm amber, and smoky leather. Formulated with 20% perfume oil concentration for 12+ hour longevity.',
 'Long-lasting oriental woody fragrance with notes of Oud, Rose, and Amber.',
 1199.00, 1850.00,
 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&auto=format&fit=crop&q=80'],
 14, 0, 3, ARRAY['perfume', 'oud', 'fragrance', 'luxury edp'], 'Nectar Scents', 'Fine Fragrance Essence in Glass Flacon', 'Gold Amber Flacon', '100 ml', '310g', 'Evening / Festive Wear', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000016', 'White Jasmine & Citrus Fresh Body Mist 200ml', 'JT-PF-011', 'white-jasmine-citrus-fresh-body-mist', 'b0000000-0000-0000-0000-000000000006',
 'Breezy everyday all-over spritz blending Indian Mogra jasmine, Italian bergamot, and soothing green tea extracts. Enriched with aloe vera.',
 'Refreshing floral-citrus mist infused with natural jasmine and aloe vera.',
 399.00, 599.00,
 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=800&auto=format&fit=crop&q=80'],
 30, 0, 6, ARRAY['body mist', 'jasmine', 'fragrance', 'daily wear'], 'Flora Botanica', 'Alcohol-Free Botanical Formulation', 'Crystal Clear Spray Bottle', '200 ml', '250g', 'Daily Freshness / Summer', FALSE, TRUE, FALSE),

-- Toys & Games
('c0000000-0000-0000-0000-000000000017', 'High-Speed Rechargeable RC Drift Stunt Car', 'JT-TY-001', 'high-speed-rechargeable-rc-stunt-car', 'b0000000-0000-0000-0000-000000000007',
 '360-degree rotating double-sided tumbling stunt vehicle with LED flashing headlights and rugged off-road rubber crawler wheels. Includes rechargeable USB battery pack.',
 '360° tumbling dual-sided remote control car with light effects and USB charger.',
 899.00, 1499.00,
 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=800&auto=format&fit=crop&q=80'],
 16, 0, 4, ARRAY['toys', 'rc car', 'remote control', 'kids gift'], 'HyperDrift Toys', 'Non-Toxic ABS Impact-Resistant Plastic', 'Fire Red / Neon Blue', '18 x 16 x 8 cm', '460g', 'Kids Birthday (Ages 5+)', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000018', 'Classic Wooden Chess & Checkers 2-in-1 Magnetic Set', 'JT-TY-002', 'classic-wooden-chess-magnetic-set', 'b0000000-0000-0000-0000-000000000007',
 'Hand-carved Staunton design rosewood pieces with felted bottoms and gentle magnetic hold. Folding wooden board stores all pieces securely with velvet interior.',
 'Handmade magnetic folding wooden chessboard with dual games (Chess & Checkers).',
 749.00, 1199.00,
 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&auto=format&fit=crop&q=80'],
 14, 0, 3, ARRAY['chess', 'board game', 'wooden chess', 'brain toy'], 'Grandmaster Woodcraft', 'Indian Sheesham Wood & Brass Latches', 'Natural Wood Grain & Maple Inlay', '30 x 30 x 3 cm (Folded: 30x15x6)', '680g', 'Family Games / Intelligence Gift', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000019', 'Giant Cuddly Brown Teddy Bear (3 Feet / 90 cm)', 'JT-TY-003', 'giant-cuddly-brown-teddy-bear-90cm', 'b0000000-0000-0000-0000-000000000007',
 'Super-soft huggable plush teddy bear filled with hypoallergenic virgin PP cotton. Wearing a jaunty satin red bow. Safe for all ages with securely stitched eyes.',
 'Ultra-soft 3-foot huggable plush teddy bear with hypoallergenic filling.',
 999.00, 1699.00,
 'https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=800&auto=format&fit=crop&q=80'],
 9, 0, 2, ARRAY['teddy bear', 'soft toy', 'plush', 'cute gift'], 'Snuggle Joy', 'Super-Soft Velboa Plush & PP Cotton', 'Warm Honey Caramel', '90 x 40 x 30 cm', '1.1 kg', 'Valentine / Birthday / Baby Shower', FALSE, TRUE, TRUE),

-- Stationery
('c0000000-0000-0000-0000-000000000020', 'Signature Heavyweight Brass Rollerball Pen in Wooden Box', 'JT-ST-001', 'signature-brass-rollerball-pen-in-box', 'b0000000-0000-0000-0000-000000000008',
 'Perfect center-of-gravity brass barrel with threaded cap and German Schmidt 0.5mm ceramic rollerball refill for buttery smooth writing. Includes matching walnut display case.',
 'Precision balanced brass writing instrument with Schmidt ink refill & wooden case.',
 699.00, 1100.00,
 'https://images.unsplash.com/photo-1585336261026-6fb7bc068fa1?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1585336261026-6fb7bc068fa1?w=800&auto=format&fit=crop&q=80'],
 20, 0, 4, ARRAY['pen', 'brass pen', 'executive stationery', 'luxury writing'], 'Atelier Scribe', 'Solid Turned Brass & Walnut Case', 'Vintage Antique Brass', '14 cm Length, 12mm Diameter', '52g (pen)', 'Promotion / Graduation / Signing', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000021', 'Handmade Leather Bound Diary Journal (200 Deckle Pages)', 'JT-ST-002', 'handmade-leather-bound-journal', 'b0000000-0000-0000-0000-000000000008',
 'Rustic embossed leather journal bound with authentic wraparound strap. Filled with 200 pages of recycled cotton deckle paper that resists fountain pen bleeding.',
 'Artisanal refillable leather notebook with fountain-pen-friendly cotton parchment.',
 449.00, 750.00,
 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80'],
 24, 0, 5, ARRAY['journal', 'diary', 'leather notebook', 'sketchbook'], 'Artisan Parchment', 'Genuine Goat Leather & Cotton Rag Paper', 'Antique Saddle Tan', '18 x 13 x 3.5 cm (A5 format)', '380g', 'Travel / Poetry / Personal Growth', FALSE, TRUE, TRUE),

('c0000000-0000-0000-0000-000000000022', 'Multi-Compartment Wooden Desktop Organizer Stand', 'JT-ST-003', 'wooden-desktop-organizer-stand', 'b0000000-0000-0000-0000-000000000008',
 'Keep your workstation clutter-free. 6 custom compartments for pens, sticky notes, paperclips, business cards, plus integrated smartphone charging slot.',
 'Ergonomic pinewood desktop caddy with phone dock and stationery drawers.',
 549.00, 899.00,
 'https://images.unsplash.com/photo-1507842229440-279efb9a6744?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1507842229440-279efb9a6744?w=800&auto=format&fit=crop&q=80'],
 15, 0, 3, ARRAY['desk organizer', 'stationery stand', 'office decor', 'wooden craft'], 'CraftSpace', 'Kiln-Dried Pine Wood', 'Honey Pine Polish', '24 x 14 x 11 cm', '510g', 'Office Opening / Teacher Day', FALSE, FALSE, FALSE),

-- Decorative Showpieces
('c0000000-0000-0000-0000-000000000023', 'Meditating Buddha Fountain with Warm LED Waterfall', 'JT-DC-001', 'meditating-buddha-led-water-fountain', 'b0000000-0000-0000-0000-000000000009',
 'Create a calming sanctuary in your home. Polyresin indoor water fountain with gentle cascading stream, rotating glass crystal sphere, and submerged amber glow LED.',
 'Indoor tranquil meditation fountain with circulating pump and crystal sphere.',
 1299.00, 1999.00,
 'https://images.unsplash.com/photo-1608755728617-aefab37d2edd?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1608755728617-aefab37d2edd?w=800&auto=format&fit=crop&q=80'],
 8, 0, 2, ARRAY['fountain', 'buddha', 'water fountain', 'feng shui', 'peace'], 'Nirvana Living', 'High-Density Polyresin & Acrylic', 'Stone Grey & Bronze Robe', '28 x 20 x 20 cm', '1.4 kg', 'Housewarming / Spa / Meditation Room', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000024', 'Hand-Painted Ceramic Peacock Showpiece Pair', 'JT-DC-002', 'hand-painted-ceramic-peacock-pair', 'b0000000-0000-0000-0000-000000000009',
 'Dazzling dual peacock sculptures adorned with royal blue glazed enamel and fine golden feather detailing. Symbol of grace, protection, and prosperity.',
 'Set of 2 handcrafted ceramic peacocks with vibrant cobalt enamel and gold glaze.',
 899.00, 1399.00,
 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80'],
 12, 0, 3, ARRAY['peacock', 'ceramic', 'showpiece', 'table decor', 'living room'], 'Mayur Arts', 'Glazed Fine Ceramic Pottery', 'Cobalt Royal Blue & Gold', '22 x 10 x 8 cm each', '900g (pair)', 'Wedding Gift / Living Room', FALSE, TRUE, FALSE),

('c0000000-0000-0000-0000-000000000025', 'Traditional Brass Akhand Diya with Glass Chimney', 'JT-DC-003', 'traditional-brass-akhand-diya-with-glass', 'b0000000-0000-0000-0000-000000000009',
 'Heavy brass oil lamp with borosilicate heat-resistant glass chimney. Designed to burn continuously for extended hours during pujas without blowing out from drafts.',
 'Wind-resistant pure brass temple diya with protective borosilicate glass.',
 499.00, 799.00,
 'https://images.unsplash.com/photo-1605371924599-2d0365da1ae0?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1605371924599-2d0365da1ae0?w=800&auto=format&fit=crop&q=80'],
 28, 0, 5, ARRAY['diya', 'brass lamp', 'akhand diya', 'pooja', 'mandir'], 'Jainam Heritage', 'Solid Virgin Brass & Borosilicate Glass', 'Golden Brass Sheen', '16 x 11 x 11 cm', '390g', 'Diwali / Mandir / Daily Aarti', TRUE, FALSE, TRUE),

-- Sunglasses
('c0000000-0000-0000-0000-000000000026', 'Classic Polarized Aviator Sunglasses with Hard Case', 'JT-SG-001', 'classic-polarized-aviator-sunglasses', 'b0000000-0000-0000-0000-000000000004',
 'High-definition TAC polarized lenses offering 100% UV400 glare protection. Ultra-lightweight corrosion-resistant stainless metal alloy frame with soft silicone nose pads.',
 'Classic teardrop aviator shades with UV400 polarized glare reduction lenses.',
 699.00, 1199.00,
 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80'],
 20, 0, 4, ARRAY['sunglasses', 'aviator', 'polarized', 'eyewear', 'fashion'], 'Solaris Optics', 'Stainless Steel Alloy & TAC Lens', 'Gunmetal Green Tint', 'Standard Medium Fit (58-14-138)', '32g', 'Travel / Driving / Summer Gift', TRUE, FALSE, TRUE),

-- Bags
('c0000000-0000-0000-0000-000000000027', 'Canvas & Leather Accent Travel Duffle Bag', 'JT-BG-001', 'canvas-leather-travel-duffle-bag', 'b0000000-0000-0000-0000-000000000005',
 'Heavy-duty 16oz waxed cotton canvas bag reinforced with genuine leather handles and brass rivets. Separate shoe compartment and padded shoulder strap.',
 'Spacious 40L weekend canvas duffle bag with dedicated ventilated shoe pocket.',
 1599.00, 2499.00,
 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80'],
 10, 0, 2, ARRAY['duffle bag', 'travel bag', 'canvas bag', 'weekend trip'], 'Wanderlust Gear', '16oz Water-Repellent Canvas & Leather', 'Olive Drab Green & Cognac Brown', '52 x 28 x 26 cm (40L Capacity)', '980g', 'Travel / Gym / Weekend Trip', TRUE, TRUE, FALSE),

-- Additional high-affinity retail gift items
('c0000000-0000-0000-0000-000000000028', 'Rotating Aromatherapy Ultrasonic Diffuser & Night Lamp', 'JT-GF-004', 'rotating-aroma-diffuser-lamp', 'b0000000-0000-0000-0000-000000000001',
 'Whisper-quiet 300ml ultrasonic cool mist humidifier with 7 soothing ambient LED lights. Includes 2 bottles of pure lavender and lemongrass essential oils.',
 '300ml ultrasonic aroma mister with color-changing mood lamp & essential oils.',
 849.00, 1399.00,
 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&auto=format&fit=crop&q=80'],
 16, 0, 3, ARRAY['aroma diffuser', 'essential oils', 'night lamp', 'wellness gift'], 'ZenOasis', 'BPA-Free Polypropylene & Wood Grain Base', 'Light Woodgrain', '14 x 14 x 16 cm', '380g', 'Wellness / Relaxation / New Home', FALSE, TRUE, TRUE),

('c0000000-0000-0000-0000-000000000029', 'Kids Magnetic Building Blocks Stem Tiles Set (64 Pcs)', 'JT-TY-004', 'kids-magnetic-building-blocks-64pcs', 'b0000000-0000-0000-0000-000000000007',
 'Vibrant 3D magnetic geometric tiles that easily snap together to build castles, rockets, towers, and vehicles. Sparks creativity and spatial reasoning in young children.',
 '64-piece educational magnetic constructor blocks with rounded safety corners.',
 999.00, 1699.00,
 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80'],
 18, 0, 4, ARRAY['stem toys', 'magnetic tiles', 'educational', 'creative play'], 'BrainCraft Kids', 'Food-Grade Non-Toxic ABS Plastic & NdFeB Magnets', 'Rainbow Translucent Assorted', 'Box: 28 x 22 x 6 cm', '850g', 'Kids Birthday (Ages 3-10)', TRUE, FALSE, TRUE),

('c0000000-0000-0000-0000-000000000030', 'Handcrafted Wooden Music Box - Bohemian Tune', 'JT-GF-005', 'handcrafted-wooden-music-box', 'b0000000-0000-0000-0000-000000000001',
 'Mini vintage hand-cranked musical box. No batteries required. Turn the handle to play a crisp mechanical chime melody. Laser-carved floral patterns on lid.',
 'Vintage hand-crank mechanical music box with carved wood floral motifs.',
 349.00, 599.00,
 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=600&auto=format&fit=crop&q=80',
 ARRAY['https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=800&auto=format&fit=crop&q=80'],
 30, 0, 5, ARRAY['music box', 'vintage gift', 'nostalgia', 'pocket gift'], 'Melody Craft', 'Natural Birch Plywood & Steel Movement', 'Vintage Oak Finish', '6.5 x 5 x 4 cm', '95g', 'Friendship / Return Gift / Romantic', FALSE, FALSE, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 4. SAMPLE VARIANTS FOR SELECT PRODUCTS
INSERT INTO public.product_variants (id, product_id, sku, title, variant_type, variant_value, price_override, stock_quantity, reserved_stock) VALUES
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'JT-PF-001-8X10', '8 x 10 Inches', 'size', '8x10 inch', 599.00, 10, 0),
('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'JT-PF-001-12X15', '12 x 15 Inches', 'size', '12x15 inch', 899.00, 5, 0),
('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000007', 'JT-WT-001-TAN', 'Tan Brown Strap', 'colour', 'Tan Brown', 1299.00, 10, 0),
('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000007', 'JT-WT-001-BLK', 'Classic Black Strap', 'colour', 'Classic Black', 1299.00, 8, 0)
ON CONFLICT (sku) DO NOTHING;

-- 5. COUPONS
INSERT INTO public.coupons (
  id, code, title, description, discount_type, discount_value, min_order_amount, max_discount, usage_limit, is_active, first_order_only
) VALUES
('e0000000-0000-0000-0000-000000000001', 'FIRST10', 'Welcome 10% Off', 'Get 10% discount on your very first pickup order from Jainam Traders', 'percentage', 10.00, 499.00, 200.00, 1000, TRUE, TRUE),
('e0000000-0000-0000-0000-000000000002', 'JAINAM100', 'Flat ₹100 Off', 'Enjoy ₹100 instant discount on orders above ₹999', 'fixed', 100.00, 999.00, 100.00, 500, TRUE, FALSE),
('e0000000-0000-0000-0000-000000000003', 'FESTIVE15', 'Festive Celebration 15% Off', 'Special festive season savings on all gift articles above ₹1499', 'percentage', 15.00, 1499.00, 350.00, 300, TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;

-- 6. PROMOTIONAL OFFERS
INSERT INTO public.offers (
  id, title, badge_text, description, offer_type, discount_pct, min_spend, banner_image, link_url, is_active
) VALUES
('f0000000-0000-0000-0000-000000000001', 'Grand Festive Gift Mela', 'LIMITED TIME', 'Up to 35% off on handcrafted wooden photo frames, clocks & executive hampers', 'percentage', 35, 999.00, 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&auto=format&fit=crop&q=80', '/category/gifts-mementos', TRUE),
('f0000000-0000-0000-0000-000000000002', 'Pay at Shop Special Privilege', 'ZERO ONLINE FEE', 'Reserve your items online now, inspect them in person, and pay cash/UPI at counter.', 'fixed', 0, 0, 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=1200&auto=format&fit=crop&q=80', '/pickup-info', TRUE)
ON CONFLICT DO NOTHING;
