-- ═══════════════════════════════════════════════════════════════════════
-- TownsHub Demo Account Seed  (Limassol Grand Hotel)
-- Run this in Supabase SQL Editor AFTER creating the demo auth user.
--
-- Step 1: Supabase → Authentication → Users → "Add user"
--   Email:    demo@townshub.cy
--   Password: Demo1234!
--   Auto-confirm: ON  ← important
--
-- Step 2: Run this script — UUID is resolved automatically by email.
-- ═══════════════════════════════════════════════════════════════════════

-- Clean up any previous demo run (idempotent)
DELETE FROM tenants WHERE slug = 'limassol-grand';

DO $$
DECLARE
  demo_user_id UUID;
  tenant_id    UUID := gen_random_uuid();

  -- room type IDs
  rt_standard UUID; rt_deluxe UUID; rt_suite UUID;

  -- room IDs (15 rooms)
  r101 UUID; r102 UUID; r103 UUID; r104 UUID; r105 UUID;
  r201 UUID; r202 UUID; r203 UUID; r204 UUID; r205 UUID;
  r301 UUID; r302 UUID; r303 UUID; r401 UUID; r402 UUID;

  -- guest IDs
  g1 UUID; g2 UUID; g3 UUID; g4 UUID; g5 UUID; g6 UUID;
  g7 UUID; g8 UUID; g9 UUID; g10 UUID; g11 UUID; g12 UUID;

  -- booking IDs
  b1 UUID; b2 UUID; b3 UUID; b4 UUID; b5 UUID; b6 UUID;
  b7 UUID; b8 UUID; b9 UUID; b10 UUID; b11 UUID; b12 UUID;

  -- invoice IDs
  inv1 UUID; inv2 UUID; inv3 UUID; inv4 UUID; inv5 UUID;

BEGIN

  -- ── Resolve auth user by email ─────────────────────────────────────
  SELECT id INTO demo_user_id FROM auth.users WHERE email = 'demo@townshub.cy';
  IF demo_user_id IS NULL THEN
    RAISE EXCEPTION 'Demo user not found. Create demo@townshub.cy in Supabase Auth first.';
  END IF;

  -- ── Pre-generate all UUIDs ──────────────────────────────────────────
  rt_standard := gen_random_uuid(); rt_deluxe := gen_random_uuid(); rt_suite := gen_random_uuid();
  r101 := gen_random_uuid(); r102 := gen_random_uuid(); r103 := gen_random_uuid();
  r104 := gen_random_uuid(); r105 := gen_random_uuid(); r201 := gen_random_uuid();
  r202 := gen_random_uuid(); r203 := gen_random_uuid(); r204 := gen_random_uuid();
  r205 := gen_random_uuid(); r301 := gen_random_uuid(); r302 := gen_random_uuid();
  r303 := gen_random_uuid(); r401 := gen_random_uuid(); r402 := gen_random_uuid();
  g1  := gen_random_uuid(); g2  := gen_random_uuid(); g3  := gen_random_uuid();
  g4  := gen_random_uuid(); g5  := gen_random_uuid(); g6  := gen_random_uuid();
  g7  := gen_random_uuid(); g8  := gen_random_uuid(); g9  := gen_random_uuid();
  g10 := gen_random_uuid(); g11 := gen_random_uuid(); g12 := gen_random_uuid();
  b1  := gen_random_uuid(); b2  := gen_random_uuid(); b3  := gen_random_uuid();
  b4  := gen_random_uuid(); b5  := gen_random_uuid(); b6  := gen_random_uuid();
  b7  := gen_random_uuid(); b8  := gen_random_uuid(); b9  := gen_random_uuid();
  b10 := gen_random_uuid(); b11 := gen_random_uuid(); b12 := gen_random_uuid();
  inv1 := gen_random_uuid(); inv2 := gen_random_uuid(); inv3 := gen_random_uuid();
  inv4 := gen_random_uuid(); inv5 := gen_random_uuid();

  -- ── 1. TENANT ────────────────────────────────────────────────────────
  INSERT INTO tenants (id, name, slug, email, phone, address, city, country,
    subscription_tier, subscription_status, currency, timezone)
  VALUES (
    tenant_id, 'Limassol Grand Hotel', 'limassol-grand',
    'info@limassolgrnd.cy', '+357 25 000 000',
    '1 Makarios Avenue', 'Limassol', 'CY',
    'professional', 'active', 'EUR', 'Asia/Nicosia'
  );

  -- ── 2. USER (links auth.user → tenant) ───────────────────────────────
  INSERT INTO users (id, tenant_id, email, full_name, role, is_active)
  VALUES (demo_user_id, tenant_id, 'demo@townshub.cy', 'Demo Admin', 'admin', true);

  -- ── 3. ROOM TYPES ─────────────────────────────────────────────────────
  INSERT INTO room_types (id, tenant_id, name, description, base_price, max_occupancy,
    bed_type, amenities, is_active)
  VALUES
    (rt_standard, tenant_id, 'Standard Room',
     'Comfortable room with garden view, king or twin beds.',
     120, 2, 'Double', ARRAY['WiFi','AC','Mini Bar','Safe','TV'], true),
    (rt_deluxe, tenant_id, 'Deluxe Sea View',
     'Spacious room with panoramic Mediterranean sea views.',
     180, 2, 'King', ARRAY['WiFi','AC','Mini Bar','Safe','TV','Sea View','Balcony','Bathtub'], true),
    (rt_suite, tenant_id, 'Executive Suite',
     'Luxury suite with separate living area, jacuzzi and butler service.',
     320, 3, 'King', ARRAY['WiFi','AC','Mini Bar','Safe','TV','Sea View','Balcony','Jacuzzi','Butler'], true);

  -- ── 4. ROOMS (15 rooms) ───────────────────────────────────────────────
  -- valid statuses: vacant_clean | vacant_dirty | occupied | maintenance | out_of_order
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active)
  VALUES
    (r101, tenant_id, rt_standard, '101', 1, 'vacant_clean',  true),
    (r102, tenant_id, rt_standard, '102', 1, 'occupied',      true),
    (r103, tenant_id, rt_standard, '103', 1, 'vacant_clean',  true),
    (r104, tenant_id, rt_standard, '104', 1, 'vacant_dirty',  true),
    (r105, tenant_id, rt_standard, '105', 1, 'occupied',      true),
    (r201, tenant_id, rt_deluxe,   '201', 2, 'occupied',      true),
    (r202, tenant_id, rt_deluxe,   '202', 2, 'vacant_clean',  true),
    (r203, tenant_id, rt_deluxe,   '203', 2, 'occupied',      true),
    (r204, tenant_id, rt_deluxe,   '204', 2, 'vacant_clean',  true),
    (r205, tenant_id, rt_deluxe,   '205', 2, 'occupied',      true),
    (r301, tenant_id, rt_suite,    '301', 3, 'occupied',      true),
    (r302, tenant_id, rt_suite,    '302', 3, 'vacant_clean',  true),
    (r303, tenant_id, rt_suite,    '303', 3, 'maintenance',   true),
    (r401, tenant_id, rt_suite,    '401', 4, 'occupied',      true),
    (r402, tenant_id, rt_suite,    '402', 4, 'vacant_clean',  true);

  -- ── 5. GUESTS ─────────────────────────────────────────────────────────
  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, total_stays, notes)
  VALUES
    (g1,  tenant_id, 'Dimitris', 'Papadopoulos', 'dimitris.p@example.com',  '+357 99 111 001', 'Cypriot',  'passport',    'K12345678', '1985-03-15', 'Nicosia',  'Cyprus',  4, 'VIP — prefers sea view'),
    (g2,  tenant_id, 'Sarah',    'Mitchell',     'sarah.m@example.com',     '+44 7700 900001', 'British',  'passport',    'GB8765432', '1990-07-22', 'London',   'UK',      2, NULL),
    (g3,  tenant_id, 'Nikos',    'Andreou',      'nikos.a@example.com',     '+357 99 222 003', 'Cypriot',  'national_id', 'CY001234',  '1978-11-08', 'Limassol', 'Cyprus',  1, NULL),
    (g4,  tenant_id, 'Elena',    'Stavrou',      'elena.s@example.com',     '+357 99 333 004', 'Cypriot',  'passport',    'K98765432', '1992-04-17', 'Paphos',   'Cyprus',  3, 'VIP'),
    (g5,  tenant_id, 'Hans',     'Mueller',      'hans.m@example.com',      '+49 152 0000005', 'German',   'passport',    'DE5678901', '1965-09-30', 'Berlin',   'Germany', 7, 'Regular visitor, long-stay'),
    (g6,  tenant_id, 'Marie',    'Dupont',       'marie.d@example.com',     '+33 6 0000 0006', 'French',   'passport',    'FR1234567', '1988-01-12', 'Paris',    'France',  1, NULL),
    (g7,  tenant_id, 'Giorgos',  'Ioannou',      'giorgos.i@example.com',   '+357 99 444 007', 'Cypriot',  'national_id', 'CY009876',  '1975-06-25', 'Nicosia',  'Cyprus',  2, NULL),
    (g8,  tenant_id, 'Anna',     'Konstantinou', 'anna.k@example.com',      '+357 99 555 008', 'Cypriot',  'passport',    'K11223344', '1983-12-01', 'Larnaca',  'Cyprus',  3, 'Anniversary stay'),
    (g9,  tenant_id, 'Yusuf',    'Ozkan',        'yusuf.o@example.com',     '+90 532 000 009', 'Turkish',  'passport',    'TR9876543', '1991-08-14', 'Istanbul', 'Turkey',  1, NULL),
    (g10, tenant_id, 'Olga',     'Ivanova',      'olga.i@example.com',      '+7 916 000 0010', 'Russian',  'passport',    'RU7654321', '1979-02-28', 'Moscow',   'Russia',  2, NULL),
    (g11, tenant_id, 'Marco',    'Rossi',        'marco.r@example.com',     '+39 333 000 0011','Italian',  'passport',    'IT3456789', '1986-05-19', 'Milan',    'Italy',   1, NULL),
    (g12, tenant_id, 'Sofia',    'Petrou',       'sofia.p@example.com',     '+357 99 666 012', 'Cypriot',  'national_id', 'CY556677',  '1994-10-07', 'Nicosia',  'Cyprus',  1, 'Honeymoon couple');

  -- ── 6. BOOKINGS (balance_due is GENERATED — do not insert it) ─────────
  -- valid sources: direct | booking_com | expedia | airbnb | phone | walk_in | other
  INSERT INTO bookings (id, tenant_id, guest_id, room_id, room_type_id,
    booking_reference, status, check_in_date, check_out_date,
    room_rate, total_amount, paid_amount,
    adults, children, source, special_requests, created_by)
  VALUES
    -- Currently checked in
    (b1,  tenant_id, g1,  r102, rt_standard, 'LG-2026-001', 'checked_in',
     CURRENT_DATE - 2, CURRENT_DATE + 2, 120, 480, 480, 2, 0, 'direct',      'Early check-in', demo_user_id),
    (b2,  tenant_id, g2,  r105, rt_standard, 'LG-2026-002', 'checked_in',
     CURRENT_DATE - 1, CURRENT_DATE + 3, 120, 480, 240, 1, 0, 'booking_com', NULL,             demo_user_id),
    (b3,  tenant_id, g4,  r205, rt_deluxe,   'LG-2026-003', 'checked_in',
     CURRENT_DATE - 3, CURRENT_DATE + 1, 180, 720, 720, 2, 1, 'direct',      'Champagne on arrival', demo_user_id),
    (b4,  tenant_id, g5,  r201, rt_deluxe,   'LG-2026-004', 'checked_in',
     CURRENT_DATE - 4, CURRENT_DATE + 3, 180,1260,1260, 2, 0, 'expedia',     'Non-smoking room', demo_user_id),
    (b5,  tenant_id, g7,  r203, rt_deluxe,   'LG-2026-005', 'checked_in',
     CURRENT_DATE,     CURRENT_DATE + 2, 180, 360, 180, 2, 0, 'airbnb',      NULL,             demo_user_id),
    (b6,  tenant_id, g8,  r301, rt_suite,    'LG-2026-006', 'checked_in',
     CURRENT_DATE - 2, CURRENT_DATE + 4, 320,1920,1920, 2, 0, 'direct',      'Anniversary stay', demo_user_id),
    (b7,  tenant_id, g12, r401, rt_suite,    'LG-2026-007', 'checked_in',
     CURRENT_DATE,     CURRENT_DATE + 7, 320,2240,1120, 2, 0, 'direct',      'Honeymoon — rose petals please', demo_user_id),
    -- Confirmed upcoming
    (b8,  tenant_id, g3,  r101, rt_standard, 'LG-2026-008', 'confirmed',
     CURRENT_DATE + 5, CURRENT_DATE + 9,  120, 480,   0, 2, 0, 'direct',     NULL,             demo_user_id),
    (b9,  tenant_id, g6,  r202, rt_deluxe,   'LG-2026-009', 'confirmed',
     CURRENT_DATE + 7, CURRENT_DATE + 11, 180, 720, 360, 2, 0, 'booking_com','Sea view preferred', demo_user_id),
    (b10, tenant_id, g11, r302, rt_suite,    'LG-2026-010', 'confirmed',
     CURRENT_DATE +14, CURRENT_DATE +19, 320,1600,   0, 2, 1, 'direct',      NULL,             demo_user_id),
    -- Pending
    (b11, tenant_id, g9,  r103, rt_standard, 'LG-2026-011', 'pending',
     CURRENT_DATE +20, CURRENT_DATE +23, 120, 360,   0, 1, 0, 'expedia',     NULL,             demo_user_id),
    -- Checked out (historical)
    (b12, tenant_id, g10, r204, rt_deluxe,   'LG-2026-012', 'checked_out',
     CURRENT_DATE -17, CURRENT_DATE -13, 180, 720, 720, 2, 0, 'other',       NULL,             demo_user_id);

  -- ── 7. PAYMENTS ───────────────────────────────────────────────────────
  INSERT INTO payments (tenant_id, booking_id, amount, method, status, reference, notes)
  VALUES
    (tenant_id, b1,  480,  'card',          'completed', 'STRIPE-001', 'Full payment at check-in'),
    (tenant_id, b2,  240,  'cash',          'completed', NULL,         'Deposit on arrival'),
    (tenant_id, b3,  720,  'card',          'completed', 'STRIPE-003', NULL),
    (tenant_id, b4,  1260, 'card',          'completed', 'STRIPE-004', 'Paid via Expedia'),
    (tenant_id, b5,  180,  'cash',          'completed', NULL,         '50% deposit'),
    (tenant_id, b6,  1920, 'card',          'completed', 'STRIPE-006', NULL),
    (tenant_id, b7,  1120, 'bank_transfer', 'completed', 'BT-2026-007','First instalment'),
    (tenant_id, b9,  360,  'card',          'completed', 'STRIPE-009', 'Booking.com deposit'),
    (tenant_id, b12, 720,  'card',          'completed', 'STRIPE-012', NULL);

  -- ── 8. INVOICES ────────────────────────────────────────────────────────
  -- invoices columns: subtotal, vat_amount, total  (NOT tax_amount / total_amount)
  INSERT INTO invoices (id, tenant_id, booking_id, invoice_number, status,
    subtotal, vat_amount, total, issued_date, due_date, notes)
  VALUES
    (inv1, tenant_id, b1,  'INV-LG-001', 'paid',  480,  91.2,  571.2, CURRENT_DATE - 2, CURRENT_DATE - 2, NULL),
    (inv2, tenant_id, b3,  'INV-LG-002', 'paid',  720, 136.8,  856.8, CURRENT_DATE - 3, CURRENT_DATE - 3, 'VIP package'),
    (inv3, tenant_id, b4,  'INV-LG-003', 'paid', 1260, 239.4, 1499.4, CURRENT_DATE - 4, CURRENT_DATE - 4, NULL),
    (inv4, tenant_id, b6,  'INV-LG-004', 'paid', 1920, 364.8, 2284.8, CURRENT_DATE - 2, CURRENT_DATE - 2, 'Anniversary upgrade'),
    (inv5, tenant_id, b12, 'INV-LG-005', 'paid',  720, 136.8,  856.8, CURRENT_DATE -17, CURRENT_DATE -17, NULL);

  -- ── 9. HOUSEKEEPING TASKS ─────────────────────────────────────────────
  -- valid types: checkout_clean | stayover_clean | deep_clean | maintenance | inspection
  INSERT INTO housekeeping_tasks (tenant_id, room_id, type, status, priority, notes, assigned_to)
  VALUES
    (tenant_id, r104, 'checkout_clean', 'pending',     'high',   'Guest checked out — priority clean for next arrival', demo_user_id),
    (tenant_id, r303, 'maintenance',    'in_progress', 'urgent', 'Jacuzzi pump replacement in progress',                demo_user_id),
    (tenant_id, r202, 'stayover_clean', 'completed',   'normal', 'Turndown service done',                              demo_user_id),
    (tenant_id, r302, 'inspection',     'pending',     'normal', 'Pre-arrival inspection for upcoming check-in',       demo_user_id);

END $$;

-- ── Verify the seed worked ─────────────────────────────────────────────────
SELECT 'tenants'  AS tbl, count(*) FROM tenants  WHERE slug = 'limassol-grand'
UNION ALL
SELECT 'rooms',    count(*) FROM rooms    WHERE tenant_id = (SELECT id FROM tenants WHERE slug='limassol-grand')
UNION ALL
SELECT 'guests',   count(*) FROM guests   WHERE tenant_id = (SELECT id FROM tenants WHERE slug='limassol-grand')
UNION ALL
SELECT 'bookings', count(*) FROM bookings WHERE tenant_id = (SELECT id FROM tenants WHERE slug='limassol-grand')
UNION ALL
SELECT 'invoices', count(*) FROM invoices WHERE tenant_id = (SELECT id FROM tenants WHERE slug='limassol-grand');
