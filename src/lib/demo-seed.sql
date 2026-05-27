-- ═══════════════════════════════════════════════════════════════════════
-- TownsHub Demo Account Seed
-- Run this in Supabase SQL Editor AFTER creating the demo auth user.
--
-- Step 1: Go to Supabase → Authentication → Users → "Add user"
--   Email:    demo@townshub.cy
--   Password: Demo1234!
--   (copy the new user UUID — paste it below as DEMO_USER_ID)
--
-- Step 2: Replace <<DEMO_USER_UUID>> with the actual UUID from Step 1
-- Step 3: Run this entire script in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  demo_user_id   UUID := '<<DEMO_USER_UUID>>';   -- ← REPLACE THIS
  tenant_id      UUID := gen_random_uuid();
  -- room type IDs
  rt_standard    UUID := gen_random_uuid();
  rt_deluxe      UUID := gen_random_uuid();
  rt_suite       UUID := gen_random_uuid();
  -- room IDs (15 rooms)
  r101 UUID := gen_random_uuid(); r102 UUID := gen_random_uuid();
  r103 UUID := gen_random_uuid(); r104 UUID := gen_random_uuid();
  r105 UUID := gen_random_uuid(); r201 UUID := gen_random_uuid();
  r202 UUID := gen_random_uuid(); r203 UUID := gen_random_uuid();
  r204 UUID := gen_random_uuid(); r205 UUID := gen_random_uuid();
  r301 UUID := gen_random_uuid(); r302 UUID := gen_random_uuid();
  r303 UUID := gen_random_uuid(); r401 UUID := gen_random_uuid();
  r402 UUID := gen_random_uuid();
  -- guest IDs
  g1  UUID := gen_random_uuid(); g2  UUID := gen_random_uuid();
  g3  UUID := gen_random_uuid(); g4  UUID := gen_random_uuid();
  g5  UUID := gen_random_uuid(); g6  UUID := gen_random_uuid();
  g7  UUID := gen_random_uuid(); g8  UUID := gen_random_uuid();
  g9  UUID := gen_random_uuid(); g10 UUID := gen_random_uuid();
  g11 UUID := gen_random_uuid(); g12 UUID := gen_random_uuid();
  -- booking IDs
  b1  UUID := gen_random_uuid(); b2  UUID := gen_random_uuid();
  b3  UUID := gen_random_uuid(); b4  UUID := gen_random_uuid();
  b5  UUID := gen_random_uuid(); b6  UUID := gen_random_uuid();
  b7  UUID := gen_random_uuid(); b8  UUID := gen_random_uuid();
  b9  UUID := gen_random_uuid(); b10 UUID := gen_random_uuid();
  b11 UUID := gen_random_uuid(); b12 UUID := gen_random_uuid();
  -- invoice IDs
  inv1 UUID := gen_random_uuid(); inv2 UUID := gen_random_uuid();
  inv3 UUID := gen_random_uuid(); inv4 UUID := gen_random_uuid();
  inv5 UUID := gen_random_uuid();

BEGIN

-- ── 1. TENANT ──────────────────────────────────────────────────────────────
INSERT INTO tenants (id, name, slug, email, phone, address, city, country,
  subscription_tier, platform_mode, currency, timezone, check_in_time, check_out_time)
VALUES (
  tenant_id,
  'Limassol Grand Hotel',
  'limassol-grand',
  'info@limassolgrnd.cy',
  '+357 25 000 000',
  '1 Makarios Avenue',
  'Limassol',
  'CY',
  'professional',
  'hotel',
  'EUR',
  'Asia/Nicosia',
  '15:00',
  '11:00'
);

-- ── 2. USERS TABLE ENTRY (links auth.user → tenant) ────────────────────────
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, is_active)
VALUES (demo_user_id, tenant_id, 'demo@townshub.cy', 'Demo', 'Admin', 'admin', true);

-- ── 3. ROOM TYPES ──────────────────────────────────────────────────────────
INSERT INTO room_types (id, tenant_id, name, description, base_rate, max_occupancy, amenities)
VALUES
  (rt_standard, tenant_id, 'Standard Room',
   'Comfortable standard room with garden view, king or twin beds.',
   120, 2, ARRAY['wifi','ac','minibar','safe','tv']),
  (rt_deluxe, tenant_id, 'Deluxe Sea View',
   'Spacious room with panoramic Mediterranean sea views.',
   180, 2, ARRAY['wifi','ac','minibar','safe','tv','sea_view','balcony','bathtub']),
  (rt_suite, tenant_id, 'Executive Suite',
   'Luxury suite with separate living area, jacuzzi and butler service.',
   320, 3, ARRAY['wifi','ac','minibar','safe','tv','sea_view','balcony','jacuzzi','butler','lounge']);

-- ── 4. ROOMS (15 rooms) ────────────────────────────────────────────────────
INSERT INTO rooms (id, tenant_id, number, floor, room_type_id, status, beds, notes)
VALUES
  (r101, tenant_id, '101', 1, rt_standard, 'available',   2, NULL),
  (r102, tenant_id, '102', 1, rt_standard, 'occupied',    2, NULL),
  (r103, tenant_id, '103', 1, rt_standard, 'available',   2, NULL),
  (r104, tenant_id, '104', 1, rt_standard, 'cleaning',    2, NULL),
  (r105, tenant_id, '105', 1, rt_standard, 'occupied',    2, NULL),
  (r201, tenant_id, '201', 2, rt_deluxe,   'occupied',    2, 'Sea view - preferred'),
  (r202, tenant_id, '202', 2, rt_deluxe,   'available',   2, NULL),
  (r203, tenant_id, '203', 2, rt_deluxe,   'occupied',    2, NULL),
  (r204, tenant_id, '204', 2, rt_deluxe,   'available',   2, NULL),
  (r205, tenant_id, '205', 2, rt_deluxe,   'occupied',    2, 'VIP guest request'),
  (r301, tenant_id, '301', 3, rt_suite,    'occupied',    3, NULL),
  (r302, tenant_id, '302', 3, rt_suite,    'available',   3, NULL),
  (r303, tenant_id, '303', 3, rt_suite,    'maintenance', 3, 'Jacuzzi repair scheduled 30 May'),
  (r401, tenant_id, '401', 4, rt_suite,    'occupied',    3, 'Penthouse level'),
  (r402, tenant_id, '402', 4, rt_suite,    'available',   3, 'Penthouse level');

-- ── 5. GUESTS ──────────────────────────────────────────────────────────────
INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
  id_type, id_number, date_of_birth, address, city, country, marketing_consent,
  marketing_consent_date, notes, tags)
VALUES
  (g1,  tenant_id, 'Dimitris',  'Papadopoulos', 'dimitris.p@example.com',  '+357 99 111 001', 'CY', 'passport', 'K12345678', '1985-03-15', '12 Anexartisias St', 'Nicosia',  'CY', true,  NOW() - INTERVAL '60 days', NULL,               ARRAY['returning','vip']),
  (g2,  tenant_id, 'Sarah',     'Mitchell',     'sarah.m@example.com',     '+44 7700 900001', 'GB', 'passport', 'GB8765432', '1990-07-22', '10 Baker St',         'London',   'GB', true,  NOW() - INTERVAL '30 days', NULL,               ARRAY['returning']),
  (g3,  tenant_id, 'Nikos',     'Andreou',      'nikos.a@example.com',     '+357 99 222 003', 'CY', 'id_card',  'CY001234',  '1978-11-08', '5 Gladstonos',        'Limassol', 'CY', false, NULL,                        NULL,               ARRAY[]::text[]),
  (g4,  tenant_id, 'Elena',     'Stavrou',      'elena.s@example.com',     '+357 99 333 004', 'CY', 'passport', 'K98765432', '1992-04-17', '22 Makarios Ave',     'Paphos',   'CY', true,  NOW() - INTERVAL '10 days', NULL,               ARRAY['vip']),
  (g5,  tenant_id, 'Hans',      'Mueller',      'hans.m@example.com',      '+49 152 0000005', 'DE', 'passport', 'DE5678901', '1965-09-30', 'Hauptstrasse 5',      'Berlin',   'DE', true,  NOW() - INTERVAL '45 days', 'Regular visitor',  ARRAY['returning','vip']),
  (g6,  tenant_id, 'Marie',     'Dupont',       'marie.d@example.com',     '+33 6 0000 0006', 'FR', 'passport', 'FR1234567', '1988-01-12', '8 Rue de la Paix',    'Paris',    'FR', false, NULL,                        NULL,               ARRAY[]::text[]),
  (g7,  tenant_id, 'Giorgos',   'Ioannou',      'giorgos.i@example.com',   '+357 99 444 007', 'CY', 'id_card',  'CY009876',  '1975-06-25', '3 Archbishop St',     'Nicosia',  'CY', true,  NOW() - INTERVAL '5 days',  NULL,               ARRAY[]::text[]),
  (g8,  tenant_id, 'Anna',      'Konstantinou', 'anna.k@example.com',      '+357 99 555 008', 'CY', 'passport', 'K11223344', '1983-12-01', '9 Poseidon Ave',      'Larnaca',  'CY', true,  NOW() - INTERVAL '20 days', NULL,               ARRAY['returning']),
  (g9,  tenant_id, 'Yusuf',     'Ozkan',        'yusuf.o@example.com',     '+90 532 000 009', 'TR', 'passport', 'TR9876543', '1991-08-14', 'Istiklal Cad 14',     'Istanbul', 'TR', false, NULL,                        NULL,               ARRAY[]::text[]),
  (g10, tenant_id, 'Olga',      'Ivanova',      'olga.i@example.com',      '+7 916 000 0010', 'RU', 'passport', 'RU7654321', '1979-02-28', 'Tverskaya 10',        'Moscow',   'RU', false, NULL,                        NULL,               ARRAY[]::text[]),
  (g11, tenant_id, 'Marco',     'Rossi',        'marco.r@example.com',     '+39 333 000 0011','IT', 'passport', 'IT3456789', '1986-05-19', 'Via Roma 22',         'Milan',    'IT', true,  NOW() - INTERVAL '15 days', NULL,               ARRAY[]::text[]),
  (g12, tenant_id, 'Sofia',     'Petrou',       'sofia.p@example.com',     '+357 99 666 012', 'CY', 'id_card',  'CY556677',  '1994-10-07', '17 Evagoras Ave',     'Nicosia',  'CY', true,  NOW() - INTERVAL '3 days',  'Honeymoon couple', ARRAY['vip']);

-- ── 6. BOOKINGS ────────────────────────────────────────────────────────────
INSERT INTO bookings (id, tenant_id, guest_id, room_id, room_type_id,
  booking_reference, status, check_in_date, check_out_date,
  room_rate, total_amount, paid_amount, balance_due,
  adults, children, source, special_requests, created_by)
VALUES
  -- Checked in / active
  (b1,  tenant_id, g1,  r102, rt_standard, 'TH-2026-0001', 'checked_in',  '2026-05-25', '2026-05-29', 120, 480, 480,   0, 2, 0, 'direct',       'Early check-in requested',     demo_user_id),
  (b2,  tenant_id, g2,  r105, rt_standard, 'TH-2026-0002', 'checked_in',  '2026-05-26', '2026-05-30', 120, 480, 240, 240, 1, 0, 'booking_com',  NULL,                            demo_user_id),
  (b3,  tenant_id, g4,  r205, rt_deluxe,   'TH-2026-0003', 'checked_in',  '2026-05-24', '2026-05-28', 180, 720, 720,   0, 2, 1, 'direct',       'Champagne on arrival please',   demo_user_id),
  (b4,  tenant_id, g5,  r201, rt_deluxe,   'TH-2026-0004', 'checked_in',  '2026-05-23', '2026-05-30', 180,1260,1260,   0, 2, 0, 'expedia',      'Non-smoking room',              demo_user_id),
  (b5,  tenant_id, g7,  r203, rt_deluxe,   'TH-2026-0005', 'checked_in',  '2026-05-27', '2026-05-29', 180, 360, 180, 180, 2, 0, 'airbnb',       NULL,                            demo_user_id),
  (b6,  tenant_id, g8,  r301, rt_suite,    'TH-2026-0006', 'checked_in',  '2026-05-25', '2026-05-31', 320,1920,1920,   0, 2, 0, 'direct',       'Anniversary stay',              demo_user_id),
  (b7,  tenant_id, g12, r401, rt_suite,    'TH-2026-0007', 'checked_in',  '2026-05-27', '2026-06-03', 320,2240,1120,1120,2, 0, 'direct',       'Honeymoon - rose petals please',demo_user_id),
  -- Confirmed upcoming
  (b8,  tenant_id, g3,  r101, rt_standard, 'TH-2026-0008', 'confirmed',   '2026-06-01', '2026-06-05', 120, 480,   0, 480, 2, 0, 'direct',       NULL,                            demo_user_id),
  (b9,  tenant_id, g6,  r202, rt_deluxe,   'TH-2026-0009', 'confirmed',   '2026-06-03', '2026-06-07', 180, 720, 360, 360, 2, 0, 'booking_com',  'Sea view room preferred',       demo_user_id),
  (b10, tenant_id, g11, r302, rt_suite,    'TH-2026-0010', 'confirmed',   '2026-06-10', '2026-06-15', 320,1600,   0,1600, 2, 1, 'direct',       NULL,                            demo_user_id),
  -- Pending
  (b11, tenant_id, g9,  r103, rt_standard, 'TH-2026-0011', 'pending',     '2026-06-15', '2026-06-18', 120, 360,   0, 360, 1, 0, 'expedia',      NULL,                            demo_user_id),
  -- Checked out (historical)
  (b12, tenant_id, g10, r204, rt_deluxe,   'TH-2026-0012', 'checked_out', '2026-05-10', '2026-05-14', 180, 720, 720,   0, 2, 0, 'hotels_com',   NULL,                            demo_user_id);

-- ── 7. PAYMENTS ────────────────────────────────────────────────────────────
INSERT INTO payments (tenant_id, booking_id, amount, method, status, reference, notes, created_by)
VALUES
  (tenant_id, b1,  480, 'card',   'completed', 'STRIPE-001', 'Full payment at check-in',    demo_user_id),
  (tenant_id, b2,  240, 'cash',   'completed', NULL,         'Deposit on arrival',           demo_user_id),
  (tenant_id, b3,  720, 'card',   'completed', 'STRIPE-003', NULL,                           demo_user_id),
  (tenant_id, b4, 1260, 'card',   'completed', 'STRIPE-004', 'Paid via Expedia',             demo_user_id),
  (tenant_id, b5,  180, 'cash',   'completed', NULL,         'Deposit 50%',                  demo_user_id),
  (tenant_id, b6, 1920, 'card',   'completed', 'STRIPE-006', NULL,                           demo_user_id),
  (tenant_id, b7, 1120, 'bank_transfer', 'completed', 'BT-2026-007', 'First instalment',   demo_user_id),
  (tenant_id, b9,  360, 'card',   'completed', 'STRIPE-009', 'Booking.com deposit',          demo_user_id),
  (tenant_id, b12, 720, 'card',   'completed', 'STRIPE-012', NULL,                           demo_user_id);

-- ── 8. INVOICES ────────────────────────────────────────────────────────────
INSERT INTO invoices (id, tenant_id, booking_id, invoice_number, status,
  subtotal, tax_amount, total_amount, issued_date, due_date, notes)
VALUES
  (inv1, tenant_id, b1,  'INV-2026-001', 'paid',   480,   96,  576, '2026-05-25', '2026-05-25', NULL),
  (inv2, tenant_id, b3,  'INV-2026-002', 'paid',   720,  144,  864, '2026-05-24', '2026-05-24', 'VIP package'),
  (inv3, tenant_id, b4,  'INV-2026-003', 'paid',  1260,  252, 1512, '2026-05-23', '2026-05-23', NULL),
  (inv4, tenant_id, b6,  'INV-2026-004', 'paid',  1920,  384, 2304, '2026-05-25', '2026-05-25', 'Anniversary upgrade included'),
  (inv5, tenant_id, b12, 'INV-2026-005', 'paid',   720,  144,  864, '2026-05-10', '2026-05-10', NULL);

-- ── 9. HOUSEKEEPING TASKS ──────────────────────────────────────────────────
INSERT INTO housekeeping_tasks (tenant_id, room_id, task_type, status, priority, notes, assigned_to, due_date)
VALUES
  (tenant_id, r104, 'cleaning',   'pending',     'high',   'Guest checked out — deep clean needed', demo_user_id, CURRENT_DATE),
  (tenant_id, r303, 'maintenance','in_progress',  'urgent', 'Jacuzzi pump replacement',              demo_user_id, CURRENT_DATE),
  (tenant_id, r202, 'cleaning',   'completed',    'normal', 'Turndown service done',                demo_user_id, CURRENT_DATE),
  (tenant_id, r302, 'inspection', 'pending',      'normal', 'Pre-arrival inspection for new arrival',demo_user_id, CURRENT_DATE + 3);

END $$;

-- ─── After running: verify the seed worked ──────────────────────────────────
-- SELECT count(*) FROM tenants WHERE name = 'Limassol Grand Hotel';
-- SELECT count(*) FROM rooms    WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'limassol-grand');
-- SELECT count(*) FROM bookings WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'limassol-grand');
-- SELECT count(*) FROM guests   WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'limassol-grand');
