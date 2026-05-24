-- ═══════════════════════════════════════════════════════════════════
-- TOURISTS HOTEL — SUPPLEMENTARY PMS SEED
-- Covers: Maintenance · F&B · Waitlist · Concierge · Surveys
--         Loyalty · Corporate · Communications · Campaigns · Messages
-- Run AFTER tourists-hotel-pms-seed.sql
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tid UUID; v_uid UUID;

  -- rooms (by number)
  v_r101 UUID; v_r102 UUID; v_r103 UUID; v_r104 UUID;
  v_r201 UUID; v_r203 UUID; v_r204 UUID; v_r205 UUID;
  v_r301 UUID; v_r302 UUID; v_r401 UUID;

  -- guests (by email)
  v_g1 UUID; v_g2 UUID; v_g3 UUID; v_g4 UUID; v_g5 UUID;
  v_g6 UUID; v_g7 UUID; v_g8 UUID; v_g9 UUID; v_g10 UUID;

  -- bookings (by reference)
  v_b1 UUID; v_b2 UUID; v_b3 UUID; v_b4 UUID;
  v_b6 UUID; v_b7 UUID; v_b8 UUID;
  v_b12 UUID; v_b13 UUID; v_b14 UUID;

  -- room types
  v_rt1 UUID; v_rt2 UUID; v_rt3 UUID;

  -- F&B
  v_fbc1 UUID; v_fbc2 UUID; v_fbc3 UUID; v_fbc4 UUID; v_fbc5 UUID;
  v_fbi1 UUID; v_fbi2 UUID; v_fbi3 UUID; v_fbi4 UUID;
  v_fbi5 UUID; v_fbi6 UUID; v_fbi7 UUID; v_fbi8 UUID;
  v_fbo1 UUID; v_fbo2 UUID; v_fbo3 UUID; v_fbo4 UUID;

  -- Concierge categories
  v_cc1 UUID; v_cc2 UUID; v_cc3 UUID; v_cc4 UUID; v_cc5 UUID;

  -- Loyalty accounts
  v_la1 UUID; v_la2 UUID; v_la3 UUID; v_la4 UUID;
  v_la5 UUID; v_la6 UUID; v_la7 UUID; v_la8 UUID;

BEGIN
  -- ── RESOLVE TENANT + STAFF USER ──────────────────────────────────
  SELECT id INTO v_tid FROM tenants WHERE name = 'Tourists Hotel' LIMIT 1;
  IF v_tid IS NULL THEN RAISE EXCEPTION 'Tenant "Tourists Hotel" not found — run base seed first.'; END IF;

  SELECT id INTO v_uid FROM users WHERE tenant_id = v_tid LIMIT 1;

  -- ── RESOLVE ROOMS ─────────────────────────────────────────────────
  SELECT id INTO v_r101 FROM rooms WHERE tenant_id = v_tid AND number = '101' LIMIT 1;
  SELECT id INTO v_r102 FROM rooms WHERE tenant_id = v_tid AND number = '102' LIMIT 1;
  SELECT id INTO v_r103 FROM rooms WHERE tenant_id = v_tid AND number = '103' LIMIT 1;
  SELECT id INTO v_r104 FROM rooms WHERE tenant_id = v_tid AND number = '104' LIMIT 1;
  SELECT id INTO v_r201 FROM rooms WHERE tenant_id = v_tid AND number = '201' LIMIT 1;
  SELECT id INTO v_r203 FROM rooms WHERE tenant_id = v_tid AND number = '203' LIMIT 1;
  SELECT id INTO v_r204 FROM rooms WHERE tenant_id = v_tid AND number = '204' LIMIT 1;
  SELECT id INTO v_r205 FROM rooms WHERE tenant_id = v_tid AND number = '205' LIMIT 1;
  SELECT id INTO v_r301 FROM rooms WHERE tenant_id = v_tid AND number = '301' LIMIT 1;
  SELECT id INTO v_r302 FROM rooms WHERE tenant_id = v_tid AND number = '302' LIMIT 1;
  SELECT id INTO v_r401 FROM rooms WHERE tenant_id = v_tid AND number = '401' LIMIT 1;

  -- ── RESOLVE GUESTS ────────────────────────────────────────────────
  SELECT id INTO v_g1  FROM guests WHERE tenant_id = v_tid AND email = 'j.harrison@gmail.com'       LIMIT 1;
  SELECT id INTO v_g2  FROM guests WHERE tenant_id = v_tid AND email = 'sophie.laurent@outlook.fr'  LIMIT 1;
  SELECT id INTO v_g3  FROM guests WHERE tenant_id = v_tid AND email = 'd.volkov@mail.ru'            LIMIT 1;
  SELECT id INTO v_g4  FROM guests WHERE tenant_id = v_tid AND email = 'maria.papa@gmail.com'        LIMIT 1;
  SELECT id INTO v_g5  FROM guests WHERE tenant_id = v_tid AND email = 'ahmed.rashidi@company.ae'   LIMIT 1;
  SELECT id INTO v_g6  FROM guests WHERE tenant_id = v_tid AND email = 'emma.s@web.de'              LIMIT 1;
  SELECT id INTO v_g7  FROM guests WHERE tenant_id = v_tid AND email = 'y.stavros@cytanet.com.cy'   LIMIT 1;
  SELECT id INTO v_g8  FROM guests WHERE tenant_id = v_tid AND email = 'n.petrova@gmail.com'         LIMIT 1;
  SELECT id INTO v_g9  FROM guests WHERE tenant_id = v_tid AND email = 'r.chen@tech.sg'             LIMIT 1;
  SELECT id INTO v_g10 FROM guests WHERE tenant_id = v_tid AND email = 'i.rossi@libero.it'          LIMIT 1;

  -- ── RESOLVE BOOKINGS ─────────────────────────────────────────────
  SELECT id INTO v_b1  FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-001' LIMIT 1;
  SELECT id INTO v_b2  FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-002' LIMIT 1;
  SELECT id INTO v_b3  FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-003' LIMIT 1;
  SELECT id INTO v_b4  FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-004' LIMIT 1;
  SELECT id INTO v_b6  FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-006' LIMIT 1;
  SELECT id INTO v_b7  FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-007' LIMIT 1;
  SELECT id INTO v_b8  FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-008' LIMIT 1;
  SELECT id INTO v_b12 FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-012' LIMIT 1;
  SELECT id INTO v_b13 FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-013' LIMIT 1;
  SELECT id INTO v_b14 FROM bookings WHERE tenant_id = v_tid AND booking_reference = 'TH-2026-014' LIMIT 1;

  -- ── RESOLVE ROOM TYPES ────────────────────────────────────────────
  SELECT id INTO v_rt1 FROM room_types WHERE tenant_id = v_tid AND name = 'Standard Sea View' LIMIT 1;
  SELECT id INTO v_rt2 FROM room_types WHERE tenant_id = v_tid AND name = 'Deluxe Twin'        LIMIT 1;
  SELECT id INTO v_rt3 FROM room_types WHERE tenant_id = v_tid AND name = 'Junior Suite'       LIMIT 1;

  -- ── MAINTENANCE REQUESTS ──────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM maintenance_requests WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO maintenance_requests
      (tenant_id, room_id, category, description, priority, status, reported_by, created_at)
    VALUES
      (v_tid, v_r204, 'hvac',       'AC unit not cooling. Guest complaints since yesterday evening.',               'urgent', 'in_progress', v_uid, NOW() - INTERVAL '1 day'),
      (v_tid, v_r104, 'plumbing',   'Shower head dripping. Guest reported on check-in.',                          'normal', 'open',        v_uid, NOW() - INTERVAL '2 hours'),
      (v_tid, v_r301, 'electrical', 'Bedside lamp socket not working. Guest cannot charge devices.',               'high',   'open',        v_uid, NOW() - INTERVAL '3 hours'),
      (v_tid, v_r102, 'furniture',  'Wardrobe door hinge broken. Door will not close properly.',                   'low',    'open',        v_uid, NOW() - INTERVAL '1 day'),
      (v_tid, v_r205, 'plumbing',   'Bathroom faucet drips constantly. Needs full replacement.',                   'normal', 'completed',   v_uid, NOW() - INTERVAL '3 days'),
      (v_tid, v_r401, 'hvac',       'Balcony door seal failing — heat entering the Presidential Suite.',           'high',   'assigned',    v_uid, NOW() - INTERVAL '4 hours'),
      (v_tid, v_r103, 'general',    'Pre-arrival check: bathroom light bulb needs replacing.',                     'low',    'completed',   v_uid, NOW() - INTERVAL '5 days'),
      (v_tid, NULL,   'electrical', 'Corridor lighting on Floor 2 flickering between rooms 201–205.',              'normal', 'open',        v_uid, NOW() - INTERVAL '6 hours');

    UPDATE maintenance_requests
      SET resolved_at = NOW() - INTERVAL '1 day',
          resolution_notes = 'Replaced faucet cartridge. Fully resolved.'
      WHERE tenant_id = v_tid AND description LIKE '%faucet%';

    UPDATE maintenance_requests
      SET resolved_at = NOW() - INTERVAL '4 days',
          resolution_notes = 'Replaced bulb. Room ready for guest.'
      WHERE tenant_id = v_tid AND description LIKE '%light bulb%';
  END IF;

  -- ── F&B MENU CATEGORIES ───────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM fb_menu_categories WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO fb_menu_categories (id, tenant_id, name, description, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Breakfast',         'Start your day right — served 07:00–11:00',                1, TRUE)
    RETURNING id INTO v_fbc1;

    INSERT INTO fb_menu_categories (id, tenant_id, name, description, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Mezze & Starters',  'Traditional Cypriot appetisers and small plates',          2, TRUE)
    RETURNING id INTO v_fbc2;

    INSERT INTO fb_menu_categories (id, tenant_id, name, description, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Main Courses',      'Fresh local produce and Mediterranean flavours',            3, TRUE)
    RETURNING id INTO v_fbc3;

    INSERT INTO fb_menu_categories (id, tenant_id, name, description, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Desserts',          'Sweet endings and traditional Cyprus pastries',             4, TRUE)
    RETURNING id INTO v_fbc4;

    INSERT INTO fb_menu_categories (id, tenant_id, name, description, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Drinks',            'Cocktails, wines, fresh juices and hot beverages',         5, TRUE)
    RETURNING id INTO v_fbc5;

    -- ── F&B MENU ITEMS ─────────────────────────────────────────────
    -- Breakfast
    INSERT INTO fb_menu_items (tenant_id, category_id, name, description, price, allergens, tags, is_available, sort_order)
    VALUES
      (v_tid, v_fbc1, 'Full English Breakfast',
       'Eggs your way, back bacon, sausages, baked beans, grilled tomato, mushrooms, toast',
       14.00, ARRAY['gluten','egg'], ARRAY['popular','hearty'], TRUE, 1),
      (v_tid, v_fbc1, 'Cypriot Village Breakfast',
       'Halloumi, olives, village bread, local honey, tahini, fresh tomato, cucumber',
       12.00, ARRAY['dairy','gluten'], ARRAY['local','vegetarian'], TRUE, 2),
      (v_tid, v_fbc1, 'Avocado Toast & Poached Eggs',
       'Smashed avocado on sourdough, two poached eggs, chilli flakes, micro herbs',
       11.00, ARRAY['gluten','egg'], ARRAY['healthy','trendy'], TRUE, 3),
      (v_tid, v_fbc1, 'Fresh Fruit Platter',
       'Seasonal fruits, Greek yogurt, local honey, granola',
       9.00, ARRAY['nuts'], ARRAY['healthy','vegan-option'], TRUE, 4);

    -- Starters
    INSERT INTO fb_menu_items (tenant_id, category_id, name, description, price, allergens, tags, is_available, sort_order)
    VALUES
      (v_tid, v_fbc2, 'Halloumi Saganaki',
       'Pan-fried halloumi with honey, sesame and rocket. A Cyprus classic.',
       9.50, ARRAY['dairy'], ARRAY['vegetarian','popular','local'], TRUE, 1),
      (v_tid, v_fbc2, 'Mezze Plate for Two',
       'Hummus, tzatziki, taramasalata, olives, vine leaves, village bread',
       18.00, ARRAY['gluten','fish','dairy'], ARRAY['sharing','popular'], TRUE, 2),
      (v_tid, v_fbc2, 'Shrimp Saganaki',
       'King prawns in spiced tomato and feta sauce, served with crusty bread',
       14.50, ARRAY['shellfish','dairy','gluten'], ARRAY['seafood','popular'], TRUE, 3);

    -- Mains
    INSERT INTO fb_menu_items (tenant_id, category_id, name, description, price, allergens, tags, is_available, sort_order)
    VALUES
      (v_tid, v_fbc3, 'Grilled Sea Bass',
       'Whole sea bass, grilled over charcoal, lemon butter, capers, roasted vegetables',
       28.00, ARRAY['fish'], ARRAY['fresh','local','gluten-free'], TRUE, 1),
      (v_tid, v_fbc3, 'Lamb Kleftiko',
       'Slow-cooked lamb shoulder, roasted potatoes, sun-dried tomatoes, fresh herbs',
       26.00, ARRAY[]::TEXT[], ARRAY['traditional','local','popular'], TRUE, 2),
      (v_tid, v_fbc3, 'Vegetarian Moussaka',
       'Layered aubergine, courgette, lentils, béchamel. Rich and satisfying.',
       18.00, ARRAY['dairy','egg','gluten'], ARRAY['vegetarian'], TRUE, 3);

    -- Desserts
    INSERT INTO fb_menu_items (tenant_id, category_id, name, description, price, allergens, tags, is_available, sort_order)
    VALUES
      (v_tid, v_fbc4, 'Loukoumades',
       'Traditional honey doughnuts, cinnamon, walnuts, vanilla ice cream',
       7.50, ARRAY['gluten','egg','nuts','dairy'], ARRAY['local','popular'], TRUE, 1),
      (v_tid, v_fbc4, 'Baklava',
       'Layers of filo pastry, mixed nuts, rose water syrup. Served with Greek coffee.',
       7.00, ARRAY['gluten','nuts'], ARRAY['local'], TRUE, 2);

    -- Drinks
    INSERT INTO fb_menu_items (tenant_id, category_id, name, description, price, allergens, tags, is_available, sort_order)
    VALUES
      (v_tid, v_fbc5, 'Cyprus Sunset Cocktail',
       'Vodka, passion fruit, orange juice, grenadine, prosecco float',
       11.00, ARRAY[]::TEXT[], ARRAY['signature','popular'], TRUE, 1),
      (v_tid, v_fbc5, 'Fresh Pressed Orange Juice',
       'Freshly squeezed Cypriot oranges. Pure and refreshing.',
       5.00, ARRAY[]::TEXT[], ARRAY['healthy','non-alcoholic'], TRUE, 2),
      (v_tid, v_fbc5, 'Greek Coffee',
       'Traditional Cypriot coffee served with a cold glass of water',
       3.50, ARRAY[]::TEXT[], ARRAY['hot','traditional'], TRUE, 3);
  ELSE
    -- Categories already exist — just fetch IDs
    SELECT id INTO v_fbc1 FROM fb_menu_categories WHERE tenant_id = v_tid AND name = 'Breakfast'        LIMIT 1;
    SELECT id INTO v_fbc2 FROM fb_menu_categories WHERE tenant_id = v_tid AND name = 'Mezze & Starters' LIMIT 1;
    SELECT id INTO v_fbc3 FROM fb_menu_categories WHERE tenant_id = v_tid AND name = 'Main Courses'     LIMIT 1;
  END IF;

  -- ── F&B ORDERS ────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM fb_orders WHERE tenant_id = v_tid LIMIT 1) THEN
    SELECT id INTO v_fbi1 FROM fb_menu_items WHERE tenant_id = v_tid AND name = 'Halloumi Saganaki'  LIMIT 1;
    SELECT id INTO v_fbi2 FROM fb_menu_items WHERE tenant_id = v_tid AND name = 'Mezze Plate for Two' LIMIT 1;
    SELECT id INTO v_fbi3 FROM fb_menu_items WHERE tenant_id = v_tid AND name = 'Grilled Sea Bass'   LIMIT 1;
    SELECT id INTO v_fbi4 FROM fb_menu_items WHERE tenant_id = v_tid AND name = 'Lamb Kleftiko'      LIMIT 1;
    SELECT id INTO v_fbi5 FROM fb_menu_items WHERE tenant_id = v_tid AND name = 'Loukoumades'        LIMIT 1;
    SELECT id INTO v_fbi6 FROM fb_menu_items WHERE tenant_id = v_tid AND name = 'Cyprus Sunset Cocktail' LIMIT 1;
    SELECT id INTO v_fbi7 FROM fb_menu_items WHERE tenant_id = v_tid AND name = 'Cypriot Village Breakfast' LIMIT 1;
    SELECT id INTO v_fbi8 FROM fb_menu_items WHERE tenant_id = v_tid AND name = 'Full English Breakfast'    LIMIT 1;

    INSERT INTO fb_orders (id, tenant_id, booking_id, room_number, guest_name, order_type, status, subtotal, notes, created_at)
    VALUES (gen_random_uuid(), v_tid, v_b1, '301', 'James Harrison', 'room_service', 'delivered', 37.50,
      'Extra napkins. No noise before 9am.', NOW() - INTERVAL '2 hours')
    RETURNING id INTO v_fbo1;

    INSERT INTO fb_orders (id, tenant_id, booking_id, room_number, guest_name, order_type, status, subtotal, notes, created_at)
    VALUES (gen_random_uuid(), v_tid, v_b2, '401', 'Dmitri Volkov', 'room_service', 'preparing', 67.00,
      'VIP. Present on silver tray with cloth napkin.', NOW() - INTERVAL '25 minutes')
    RETURNING id INTO v_fbo2;

    INSERT INTO fb_orders (id, tenant_id, table_number, guest_name, order_type, status, subtotal, notes, created_at)
    VALUES (gen_random_uuid(), v_tid, 'T4', 'Walk-in Guests', 'table', 'confirmed', 55.00,
      'Table by the window. Shellfish allergy.', NOW() - INTERVAL '15 minutes')
    RETURNING id INTO v_fbo3;

    INSERT INTO fb_orders (id, tenant_id, booking_id, room_number, guest_name, order_type, status, subtotal, created_at)
    VALUES (gen_random_uuid(), v_tid, v_b4, '201', 'Ahmed Al-Rashidi', 'room_service', 'pending', 28.00,
      NOW() - INTERVAL '5 minutes')
    RETURNING id INTO v_fbo4;

    -- Order items (total_price is GENERATED — not included)
    INSERT INTO fb_order_items (order_id, menu_item_id, name, quantity, unit_price)
    VALUES
      (v_fbo1, v_fbi1, 'Halloumi Saganaki', 2, 9.50),
      (v_fbo1, v_fbi4, 'Lamb Kleftiko',     1, 26.00),
      (v_fbo1, v_fbi5, 'Loukoumades',       1, 7.50);

    INSERT INTO fb_order_items (order_id, menu_item_id, name, quantity, unit_price)
    VALUES
      (v_fbo2, v_fbi3, 'Grilled Sea Bass',        2, 28.00),
      (v_fbo2, v_fbi6, 'Cyprus Sunset Cocktail',  2, 11.00);

    INSERT INTO fb_order_items (order_id, menu_item_id, name, quantity, unit_price)
    VALUES
      (v_fbo3, v_fbi2, 'Mezze Plate for Two', 2, 18.00),
      (v_fbo3, v_fbi4, 'Lamb Kleftiko',       1, 26.00);

    INSERT INTO fb_order_items (order_id, menu_item_id, name, quantity, unit_price)
    VALUES
      (v_fbo4, v_fbi7, 'Cypriot Village Breakfast', 2, 12.00),
      (v_fbo4, v_fbi5, 'Loukoumades',               1, 7.50);
  END IF;

  -- ── WAITLIST ENTRIES ──────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM waitlist_entries WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO waitlist_entries (tenant_id, guest_id, room_type_id, check_in_date, check_out_date, adults, children, status, notes, created_at)
    VALUES
      (v_tid, v_g6,  v_rt3, CURRENT_DATE + 3,  CURRENT_DATE + 7,  2, 0, 'waiting',
       'Honeymooners — sea view suite essential. Flexible on dates.', NOW() - INTERVAL '2 days'),
      (v_tid, v_g10, v_rt1, CURRENT_DATE + 1,  CURRENT_DATE + 4,  2, 0, 'offered',
       'Offered room 103 — awaiting guest confirmation.', NOW() - INTERVAL '3 hours'),
      (v_tid, v_g4,  v_rt2, CURRENT_DATE + 5,  CURRENT_DATE + 8,  2, 1, 'waiting',
       'Family with young child. Ground floor preferred.', NOW() - INTERVAL '1 day'),
      (v_tid, v_g8,  v_rt1, CURRENT_DATE,       CURRENT_DATE + 2,  1, 0, 'confirmed',
       'Walk-in waitlist. Assigned room 103 after late checkout.', NOW() - INTERVAL '4 hours');
  END IF;

  -- ── CONCIERGE CATEGORIES ──────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM concierge_categories WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO concierge_categories (id, tenant_id, name, icon, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Restaurants & Dining',  'UtensilsCrossed', 1, TRUE)
    RETURNING id INTO v_cc1;

    INSERT INTO concierge_categories (id, tenant_id, name, icon, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Beaches & Activities',  'Waves',           2, TRUE)
    RETURNING id INTO v_cc2;

    INSERT INTO concierge_categories (id, tenant_id, name, icon, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Transport & Transfers', 'Car',             3, TRUE)
    RETURNING id INTO v_cc3;

    INSERT INTO concierge_categories (id, tenant_id, name, icon, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Shopping & Markets',    'ShoppingBag',     4, TRUE)
    RETURNING id INTO v_cc4;

    INSERT INTO concierge_categories (id, tenant_id, name, icon, sort_order, is_active)
    VALUES (gen_random_uuid(), v_tid, 'Health & Medical',      'Heart',           5, TRUE)
    RETURNING id INTO v_cc5;

    -- ── CONCIERGE ITEMS ────────────────────────────────────────────
    INSERT INTO concierge_items (tenant_id, category_id, title, description, address, phone, distance_minutes, tags, is_active, sort_order)
    VALUES
      (v_tid, v_cc1, 'Linos Inn',
       'Traditional Cypriot taverna. Outstanding kleftiko and meze. Family-run for 30+ years.',
       'Old Town, Kakopetria', '+357 22 922 161', 45, ARRAY['traditional','local','popular'], TRUE, 1),
      (v_tid, v_cc1, 'Il Porto Ristorante',
       'Authentic Italian on the waterfront. Fresh pasta, excellent wine list.',
       'Old Port, Limassol', '+357 25 320 020', 10, ARRAY['italian','seafood','waterfront'], TRUE, 2),
      (v_tid, v_cc1, 'Fish & Chips by the Sea',
       'British classic, crispy battered fish, sea views. Perfect for a casual evening.',
       'Promenade, 50m west of hotel', '+357 99 123 456', 2, ARRAY['british','casual','takeaway'], TRUE, 3),

      (v_tid, v_cc2, 'Nissi Beach',
       'Cyprus''s most iconic beach. Crystal-clear water, water sports, beach clubs.',
       'Ayia Napa — 45 min drive', NULL, 45, ARRAY['beach','popular','swimming'], TRUE, 1),
      (v_tid, v_cc2, 'Aphrodite Hills Golf',
       '18-hole championship golf course with panoramic sea views.',
       'Kouklia — 35 min drive', '+357 26 828 200', 35, ARRAY['golf','sport','scenic'], TRUE, 2),
      (v_tid, v_cc2, 'Paphos Water Park',
       'Thrilling slides and wave pools for all ages. Family favourite.',
       'Paphos — 20 min drive', '+357 26 815 000', 20, ARRAY['waterpark','family','fun'], TRUE, 3),
      (v_tid, v_cc2, 'Troodos Mountain Tour',
       'Pine-covered mountains, Byzantine monasteries and waterfalls. Unforgettable day trip.',
       'Troodos — 1h drive', NULL, 60, ARRAY['nature','cultural','scenic'], TRUE, 4),

      (v_tid, v_cc3, 'Hotel Taxi to Airport',
       'Fixed-rate taxi to Paphos International Airport. Book 24h in advance at reception.',
       'Paphos International Airport', '+357 99 000 111', 20, ARRAY['airport','transfer'], TRUE, 1),
      (v_tid, v_cc3, 'Car Rental — Avis Desk',
       'On-site car rental. International and local driving licences accepted.',
       'Hotel lobby', '+357 26 123 456', 0, ARRAY['car','rental','flexible'], TRUE, 2),

      (v_tid, v_cc4, 'Kings Avenue Mall',
       'Largest mall in Paphos. Fashion, electronics, cinema, dining.',
       'Paphos — 8 min drive', NULL, 8, ARRAY['mall','shopping','air-conditioned'], TRUE, 1),
      (v_tid, v_cc4, 'Paphos Old Town Market',
       'Open-air market selling local produce, spices, souvenirs and handcrafts.',
       'Old Town — 12 min walk', NULL, 12, ARRAY['market','local','authentic'], TRUE, 2),

      (v_tid, v_cc5, 'Paphos General Hospital',
       'Nearest public hospital with A&E. EU health card accepted.',
       'Neophytou Nicolaidi Ave, Paphos', '+357 26 803 100', 15, ARRAY['emergency','hospital'], TRUE, 1),
      (v_tid, v_cc5, 'Iasis 24hr Pharmacy',
       '24-hour pharmacy. English-speaking pharmacist on duty.',
       'Tombs of the Kings Rd — 5 min walk', '+357 26 911 000', 5, ARRAY['pharmacy','24hr'], TRUE, 2);
  END IF;

  -- ── SURVEYS ───────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM surveys WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO surveys (tenant_id, booking_id, guest_id, nps_score, cleanliness_rating, service_rating,
      amenities_rating, overall_rating, comments, would_recommend, submitted_at)
    VALUES
      (v_tid, v_b12, v_g9, 9, 4.5, 5.0, 4.5, 4.8,
       'Exceptional service. The sea bass at dinner was outstanding. Will definitely return.',
       TRUE, NOW() - INTERVAL '4 days'),
      (v_tid, v_b13, v_g7, 8, 5.0, 4.5, 4.0, 4.5,
       'Beautiful hotel and great location. Room spotless. Breakfast could offer more local options.',
       TRUE, NOW() - INTERVAL '3 days'),
      (v_tid, v_b14, v_g4, 7, 4.0, 4.0, 3.5, 4.0,
       'Good stay overall. Pool area a bit crowded on weekends. Staff very friendly.',
       TRUE, NOW() - INTERVAL '1 day');
  END IF;

  -- ── LOYALTY TIERS ─────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM loyalty_tiers WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO loyalty_tiers (tenant_id, name, label, min_points, discount_percentage, perks)
    VALUES
      (v_tid, 'bronze',   'Bronze Member',   0,     0.0,
       ARRAY['Welcome gift','Free Wi-Fi','Priority check-in']),
      (v_tid, 'silver',   'Silver Member',   1000,  5.0,
       ARRAY['5% F&B discount','Room upgrade (subject to availability)','Late check-out 14:00']),
      (v_tid, 'gold',     'Gold Member',     5000,  10.0,
       ARRAY['10% F&B discount','Guaranteed upgrade','Complimentary breakfast','Late check-out 16:00','Airport transfer']),
      (v_tid, 'platinum', 'Platinum Member', 15000, 15.0,
       ARRAY['15% all-round discount','Butler service','Suite upgrade','All meals','Dedicated concierge','VIP airport lounge']);
  END IF;

  -- ── LOYALTY ACCOUNTS ──────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM loyalty_accounts WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO loyalty_accounts (id, tenant_id, guest_id, points_balance, lifetime_points, tier)
    VALUES (gen_random_uuid(), v_tid, v_g1, 2840, 2840, 'silver') RETURNING id INTO v_la1;
    INSERT INTO loyalty_accounts (id, tenant_id, guest_id, points_balance, lifetime_points, tier)
    VALUES (gen_random_uuid(), v_tid, v_g2, 920,  920,  'bronze') RETURNING id INTO v_la2;
    INSERT INTO loyalty_accounts (id, tenant_id, guest_id, points_balance, lifetime_points, tier)
    VALUES (gen_random_uuid(), v_tid, v_g3, 6200, 6200, 'platinum') RETURNING id INTO v_la3;
    INSERT INTO loyalty_accounts (id, tenant_id, guest_id, points_balance, lifetime_points, tier)
    VALUES (gen_random_uuid(), v_tid, v_g4, 345,  345,  'bronze') RETURNING id INTO v_la4;
    INSERT INTO loyalty_accounts (id, tenant_id, guest_id, points_balance, lifetime_points, tier)
    VALUES (gen_random_uuid(), v_tid, v_g5, 3100, 3100, 'gold') RETURNING id INTO v_la5;
    INSERT INTO loyalty_accounts (id, tenant_id, guest_id, points_balance, lifetime_points, tier)
    VALUES (gen_random_uuid(), v_tid, v_g7, 1200, 1200, 'silver') RETURNING id INTO v_la6;
    INSERT INTO loyalty_accounts (id, tenant_id, guest_id, points_balance, lifetime_points, tier)
    VALUES (gen_random_uuid(), v_tid, v_g9, 4200, 4200, 'gold') RETURNING id INTO v_la7;
    INSERT INTO loyalty_accounts (id, tenant_id, guest_id, points_balance, lifetime_points, tier)
    VALUES (gen_random_uuid(), v_tid, v_g8, 580,  580,  'bronze') RETURNING id INTO v_la8;

    -- ── LOYALTY TRANSACTIONS ───────────────────────────────────────
    INSERT INTO loyalty_transactions (account_id, tenant_id, booking_id, type, points, description)
    VALUES
      (v_la1, v_tid, v_b1,  'earn', 925,  'Earned — TH-2026-001 (Junior Suite, 5 nights)'),
      (v_la3, v_tid, v_b2,  'earn', 2660, 'Earned — TH-2026-002 (Presidential Suite, 7 nights)'),
      (v_la2, v_tid, v_b3,  'earn', 500,  'Earned — TH-2026-003 (deposit payment)'),
      (v_la5, v_tid, v_b4,  'earn', 575,  'Earned — TH-2026-004 (Deluxe Twin, 5 nights)'),
      (v_la6, v_tid, v_b7,  'earn', 380,  'Earned — TH-2026-007 (Standard Sea View, 4 nights)'),
      (v_la7, v_tid, v_b12, 'earn', 555,  'Earned — TH-2026-012 (Junior Suite, 3 nights)'),
      (v_la6, v_tid, v_b13, 'earn', 230,  'Earned — TH-2026-013 (Deluxe Twin, 2 nights)'),
      (v_la4, v_tid, v_b14, 'earn', 345,  'Earned — TH-2026-014 (Deluxe Twin, 3 nights)');
  END IF;

  -- ── CORPORATE ACCOUNTS ────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM corporate_accounts WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO corporate_accounts
      (tenant_id, company_name, contact_name, contact_email, contact_phone,
       address, vat_number, credit_limit, current_balance, discount_percentage,
       payment_terms_days, status, notes)
    VALUES
      (v_tid, 'Cyprus Maritime Ltd', 'Andreas Petrou', 'a.petrou@cypmaritime.com', '+357 25 889 900',
       '15 Makarios III Ave, Limassol 3026', 'CY12345678X',
       20000.00, 1250.00, 10.0, 30, 'active',
       'Long-standing corporate client. Hosts regular board meetings and client dinners at the hotel.'),
      (v_tid, 'TechHub Cyprus', 'Elena Voronova', 'e.voronova@techhub.cy', '+357 22 666 777',
       '42 Arch. Makarios III, Nicosia 1065', 'CY87654321Y',
       10000.00, 0.00, 7.5, 15, 'active',
       'Tech startup community hub. Books rooms for visiting investors and speakers.'),
      (v_tid, 'Aphrodite Shipping Co.', 'Stavros Nikolaou', 's.nikolaou@aphroditeshipping.com', '+357 25 360 100',
       'Limassol Port, Limassol 3041', 'CY11223344Z',
       15000.00, 4800.00, 12.0, 45, 'active',
       'Frequent use for crew accommodation and executive visits.');
  END IF;

  -- ── COMMUNICATIONS ────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM communications WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO communications (tenant_id, guest_id, booking_id, type, direction, subject, body, status, sent_at)
    VALUES
      (v_tid, v_g1, v_b1, 'email', 'outbound',
       'Welcome to Tourists Hotel — Your stay is confirmed',
       'Dear James, we are delighted to welcome you. Your Junior Suite is ready from 14:00. We look forward to seeing you!',
       'delivered', NOW() - INTERVAL '4 days'),
      (v_tid, v_g3, v_b2, 'email', 'outbound',
       'Pre-arrival concierge message — Mr Volkov',
       'Dear Dmitri, your Presidential Suite is prepared to your preferences. Your butler Andreas will greet you on arrival.',
       'delivered', NOW() - INTERVAL '2 days'),
      (v_tid, v_g2, v_b3, 'email', 'outbound',
       'Honeymoon Package Confirmation',
       'Congratulations! We have arranged a special honeymoon welcome for your arrival — rose petals, champagne and more await.',
       'delivered', NOW() - INTERVAL '3 days'),
      (v_tid, v_g9, v_b12, 'email', 'outbound',
       'Thank you for staying with us — Robert Chen',
       'Dear Robert, thank you for choosing Tourists Hotel. We hope to welcome you again soon. Your feedback survey is attached.',
       'delivered', NOW() - INTERVAL '4 days'),
      (v_tid, v_g4, v_b14, 'sms', 'outbound',
       NULL,
       'Thank you for your stay at Tourists Hotel, Maria! We hope you enjoyed your visit to Cyprus. Come back soon!',
       'delivered', NOW() - INTERVAL '1 day'),
      (v_tid, v_g1, v_b1, 'whatsapp', 'inbound',
       NULL,
       'Thank you! Yes I would love a 6pm dinner reservation for 2. Please confirm.',
       'read', NOW() - INTERVAL '1 hour'),
      (v_tid, v_g5, v_b4, 'email', 'outbound',
       'Al-Rashidi Family — Welcome!',
       'Dear Ahmed, we have prepared a cot in your room as requested. The kids play area is on level 1. Enjoy your stay!',
       'delivered', NOW() - INTERVAL '3 hours');
  END IF;

  -- ── CAMPAIGNS ─────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM campaigns WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO campaigns (tenant_id, name, subject, body, type, trigger, trigger_days, status, sent_count)
    VALUES
      (v_tid, 'Pre-arrival Welcome',
       'We cannot wait to welcome you!',
       'Dear {{guest_first_name}}, your stay is just {{days_until_checkin}} day(s) away! Here is everything you need to know for a perfect arrival...',
       'email', 'pre_arrival', 3, 'scheduled', 47),
      (v_tid, 'Post-stay Thank You',
       'Thank you for choosing Tourists Hotel',
       'Dear {{guest_first_name}}, thank you for your recent stay. We hope you enjoyed your time in Cyprus. Please share your feedback — it takes just 2 minutes.',
       'email', 'post_stay', 1, 'scheduled', 31),
      (v_tid, 'Mid-stay Concierge',
       'Make the most of your stay',
       'Hi {{guest_first_name}}! Enjoying your stay? We offer free sunset cocktails every evening at the pool bar. Ask reception for details.',
       'sms', 'mid_stay', 2, 'draft', 0);
  END IF;

  -- ── IN-STAY MESSAGES ──────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM messages WHERE tenant_id = v_tid LIMIT 1) THEN
    INSERT INTO messages (tenant_id, booking_id, sender_type, sender_name, body, is_read, created_at)
    VALUES
      (v_tid, v_b1, 'guest', 'James Harrison',
       'Hi, could I get some extra pillows sent to my room? Also, what time does the restaurant open tonight?',
       TRUE, NOW() - INTERVAL '2 hours'),
      (v_tid, v_b1, 'staff', 'Reception Team',
       'Of course Mr Harrison! Extra pillows are on their way. The restaurant opens at 18:30 — shall we reserve a table for you?',
       TRUE, NOW() - INTERVAL '110 minutes'),
      (v_tid, v_b2, 'guest', 'Dmitri Volkov',
       'Please arrange a private car to Limassol port tomorrow at 08:00. Two passengers.',
       FALSE, NOW() - INTERVAL '30 minutes'),
      (v_tid, v_b3, 'guest', 'Sophie Laurent',
       'Bonjour! The room is absolutely beautiful, thank you! Could we order champagne service to the room around 8pm?',
       TRUE, NOW() - INTERVAL '4 hours'),
      (v_tid, v_b3, 'staff', 'Concierge',
       'Bonsoir Sophie! Absolument — champagne and chocolate-covered strawberries will be delivered at 20:00. Congratulations on your honeymoon!',
       TRUE, NOW() - INTERVAL '210 minutes'),
      (v_tid, v_b4, 'guest', 'Ahmed Al-Rashidi',
       'Thank you for the cot, the children love the pool! Could you arrange a family dinner reservation for 7pm tonight?',
       FALSE, NOW() - INTERVAL '1 hour'),
      (v_tid, v_b6, 'guest', 'Robert Chen',
       'Please set room temperature to exactly 19 degrees. Thank you.',
       TRUE, NOW() - INTERVAL '3 hours'),
      (v_tid, v_b6, 'staff', 'Housekeeping',
       'Done, Mr Chen! Room temperature set to 19°C. Let us know if you need any adjustments.',
       TRUE, NOW() - INTERVAL '170 minutes');
  END IF;

  RAISE NOTICE 'Supplementary hotel PMS data seeded for Tourists Hotel: %', v_tid;
END $$;
