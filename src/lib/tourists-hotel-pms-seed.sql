-- ═══════════════════════════════════════════════════════════════════
-- TOURISTS HOTEL — HOTEL PMS DEMO DATA SEED
-- Run in Supabase SQL Editor (postgres role)
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tid  UUID;

  -- room types
  v_rt1  UUID; v_rt2 UUID; v_rt3 UUID; v_rt4 UUID;

  -- rooms
  v_r101 UUID; v_r102 UUID; v_r103 UUID; v_r104 UUID; v_r105 UUID;
  v_r201 UUID; v_r202 UUID; v_r203 UUID; v_r204 UUID; v_r205 UUID;
  v_r301 UUID; v_r302 UUID; v_r303 UUID; v_r304 UUID; v_r305 UUID;
  v_r401 UUID; v_r402 UUID; v_r403 UUID;

  -- guests
  v_g1 UUID; v_g2 UUID; v_g3 UUID; v_g4 UUID; v_g5 UUID;
  v_g6 UUID; v_g7 UUID; v_g8 UUID; v_g9 UUID; v_g10 UUID;

  -- bookings
  v_b1  UUID; v_b2  UUID; v_b3  UUID; v_b4  UUID; v_b5  UUID;
  v_b6  UUID; v_b7  UUID; v_b8  UUID; v_b9  UUID; v_b10 UUID;
  v_b11 UUID; v_b12 UUID; v_b13 UUID; v_b14 UUID; v_b15 UUID;

BEGIN
  -- ── TENANT ───────────────────────────────────────────────────────
  SELECT id INTO v_tid FROM tenants WHERE name = 'Tourists Hotel' LIMIT 1;
  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'Tenant "Tourists Hotel" not found.';
  END IF;

  -- ── ROOM TYPES ────────────────────────────────────────────────────
  INSERT INTO room_types (id, tenant_id, name, description, base_price, max_occupancy, max_children,
    bed_type, size_sqm, amenities, sort_order, is_active)
  VALUES
    (gen_random_uuid(), v_tid, 'Standard Sea View', 'Comfortable room with stunning sea views, modern bathroom, and all essential amenities.',
     95.00, 2, 1, 'Double', 28.0, ARRAY['Sea View','AC','WiFi','Mini Bar','Safe','Flat Screen TV'], 1, TRUE)
  RETURNING id INTO v_rt1;

  INSERT INTO room_types (id, tenant_id, name, description, base_price, max_occupancy, max_children,
    bed_type, size_sqm, amenities, sort_order, is_active)
  VALUES
    (gen_random_uuid(), v_tid, 'Deluxe Twin', 'Spacious twin room ideal for friends or families. Garden or pool view.',
     115.00, 3, 2, 'Twin', 32.0, ARRAY['Pool View','AC','WiFi','Mini Bar','Safe','Flat Screen TV','Balcony'], 2, TRUE)
  RETURNING id INTO v_rt2;

  INSERT INTO room_types (id, tenant_id, name, description, base_price, max_occupancy, max_children,
    bed_type, size_sqm, amenities, sort_order, is_active)
  VALUES
    (gen_random_uuid(), v_tid, 'Junior Suite', 'Elegant suite with separate lounge area, panoramic sea views, and premium toiletries.',
     185.00, 2, 1, 'King', 48.0, ARRAY['Panoramic Sea View','AC','WiFi','Mini Bar','Safe','Smart TV','Sofa Lounge','Nespresso','Balcony'], 3, TRUE)
  RETURNING id INTO v_rt3;

  INSERT INTO room_types (id, tenant_id, name, description, base_price, max_occupancy, max_children,
    bed_type, size_sqm, amenities, sort_order, is_active)
  VALUES
    (gen_random_uuid(), v_tid, 'Presidential Suite', 'The ultimate luxury experience with private terrace, jacuzzi, and butler service.',
     380.00, 4, 2, 'King', 95.0, ARRAY['Private Terrace','Jacuzzi','AC','WiFi','Full Bar','Safe','Smart TV','Butler Service','Dining Area','Sea View'], 4, TRUE)
  RETURNING id INTO v_rt4;

  -- ── ROOMS ─────────────────────────────────────────────────────────
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt1, '101', 1, 'occupied',     TRUE) RETURNING id INTO v_r101;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt1, '102', 1, 'occupied',     TRUE) RETURNING id INTO v_r102;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt1, '103', 1, 'vacant_clean', TRUE) RETURNING id INTO v_r103;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt1, '104', 1, 'vacant_dirty', TRUE) RETURNING id INTO v_r104;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt2, '105', 1, 'occupied',     TRUE) RETURNING id INTO v_r105;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt2, '201', 2, 'occupied',     TRUE) RETURNING id INTO v_r201;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt2, '202', 2, 'vacant_clean', TRUE) RETURNING id INTO v_r202;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt2, '203', 2, 'occupied',     TRUE) RETURNING id INTO v_r203;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt2, '204', 2, 'maintenance',  TRUE) RETURNING id INTO v_r204;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt2, '205', 2, 'occupied',     TRUE) RETURNING id INTO v_r205;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt3, '301', 3, 'occupied',     TRUE) RETURNING id INTO v_r301;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt3, '302', 3, 'occupied',     TRUE) RETURNING id INTO v_r302;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt3, '303', 3, 'vacant_clean', TRUE) RETURNING id INTO v_r303;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt3, '304', 3, 'vacant_clean', TRUE) RETURNING id INTO v_r304;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt3, '305', 3, 'occupied',     TRUE) RETURNING id INTO v_r305;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt4, '401', 4, 'occupied',     TRUE) RETURNING id INTO v_r401;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt4, '402', 4, 'vacant_clean', TRUE) RETURNING id INTO v_r402;
  INSERT INTO rooms (id, tenant_id, room_type_id, number, floor, status, is_active) VALUES (gen_random_uuid(), v_tid, v_rt4, '403', 4, 'vacant_clean', TRUE) RETURNING id INTO v_r403;

  -- ── GUESTS ────────────────────────────────────────────────────────
  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'James', 'Harrison', 'j.harrison@gmail.com', '+44 7700 900 100',
    'British', 'passport', 'GB123456A', '1978-04-12', 'London', 'United Kingdom',
    'gold', 4, 2840.00, ARRAY['returning','vip','direct'], 'Prefers high floor, sea view. Always requests extra pillows.')
  RETURNING id INTO v_g1;

  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'Sophie', 'Laurent', 'sophie.laurent@outlook.fr', '+33 6 12 34 56 78',
    'French', 'passport', 'FR789012B', '1985-09-22', 'Paris', 'France',
    'silver', 2, 920.00, ARRAY['honeymoon','direct'], 'Honeymoon stay. Arranged champagne welcome.')
  RETURNING id INTO v_g2;

  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'Dmitri', 'Volkov', 'd.volkov@mail.ru', '+7 916 123 4567',
    'Russian', 'passport', 'RU345678C', '1972-01-30', 'Moscow', 'Russia',
    'platinum', 7, 6200.00, ARRAY['vip','long-stay','corporate'], 'Long-term corporate client. Always books presidential suite.')
  RETURNING id INTO v_g3;

  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'Maria', 'Papadaki', 'maria.papa@gmail.com', '+30 697 123 456',
    'Greek', 'national_id', 'GR567890D', '1990-06-15', 'Athens', 'Greece',
    'regular', 1, 345.00, ARRAY['leisure','booking.com'], 'First visit. Arrived via Booking.com.')
  RETURNING id INTO v_g4;

  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'Ahmed', 'Al-Rashidi', 'ahmed.rashidi@company.ae', '+971 50 123 4567',
    'Emirati', 'passport', 'AE901234E', '1968-11-05', 'Dubai', 'UAE',
    'gold', 3, 3100.00, ARRAY['vip','business','family'], 'Travels with family. Requires two connecting rooms.')
  RETURNING id INTO v_g5;

  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'Emma', 'Schneider', 'emma.s@web.de', '+49 171 234 5678',
    'German', 'passport', 'DE234567F', '1995-03-28', 'Munich', 'Germany',
    'regular', 1, 460.00, ARRAY['solo','leisure','airbnb'], 'Solo traveller. Quiet room requested.')
  RETURNING id INTO v_g6;

  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'Yannis', 'Stavros', 'y.stavros@cytanet.com.cy', '+357 99 456 789',
    'Cypriot', 'national_id', 'CY345678G', '1982-07-19', 'Limassol', 'Cyprus',
    'silver', 3, 1200.00, ARRAY['local','business','returning'], 'Local businessman, uses hotel for corporate events.')
  RETURNING id INTO v_g7;

  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'Natalia', 'Petrova', 'n.petrova@gmail.com', '+357 96 789 012',
    'Russian', 'passport', 'RU678901H', '1988-12-03', 'Nicosia', 'Cyprus',
    'regular', 2, 580.00, ARRAY['expat','leisure'], 'Based in Cyprus, comes for weekend breaks.')
  RETURNING id INTO v_g8;

  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'Robert', 'Chen', 'r.chen@tech.sg', '+65 9123 4567',
    'Singaporean', 'passport', 'SG012345I', '1975-08-22', 'Singapore', 'Singapore',
    'gold', 5, 4200.00, ARRAY['business','vip','tech'], 'Tech executive. Very specific about room temperature.')
  RETURNING id INTO v_g9;

  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, nationality,
    id_type, id_number, date_of_birth, city, country, vip_status, total_stays, total_spent, tags, notes)
  VALUES (gen_random_uuid(), v_tid, 'Isabella', 'Rossi', 'i.rossi@libero.it', '+39 347 123 4567',
    'Italian', 'passport', 'IT456789J', '1992-02-14', 'Milan', 'Italy',
    'regular', 1, 230.00, ARRAY['leisure','expedia'], 'Travelling with partner. Late check-out requested.')
  RETURNING id INTO v_g10;

  -- ── BOOKINGS (balance_due is a generated column — not included) ───
  -- Checked in
  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, adults, children, status, source,
    room_rate, total_amount, paid_amount, special_requests, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-001', v_g1, v_r301, v_rt3,
    CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days',
    (CURRENT_DATE - INTERVAL '2 days')::TIMESTAMP + TIME '14:30',
    2, 0, 'checked_in', 'direct', 185.00, 925.00, 925.00, 'High floor, sea view. Extra pillows.', TRUE)
  RETURNING id INTO v_b1;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, adults, children, status, source,
    room_rate, total_amount, paid_amount, special_requests, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-002', v_g3, v_r401, v_rt4,
    CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '6 days',
    (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP + TIME '15:00',
    2, 0, 'checked_in', 'direct', 380.00, 2660.00, 2660.00, 'Butler service. Champagne on arrival.', TRUE)
  RETURNING id INTO v_b2;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, adults, children, status, source,
    room_rate, total_amount, paid_amount, special_requests, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-003', v_g2, v_r302, v_rt3,
    CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '4 days',
    (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP + TIME '13:45',
    2, 0, 'checked_in', 'direct', 185.00, 925.00, 500.00, 'Honeymoon. Rose petals and champagne please.', TRUE)
  RETURNING id INTO v_b3;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, adults, children, status, source,
    room_rate, total_amount, paid_amount, special_requests, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-004', v_g5, v_r201, v_rt2,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '5 days',
    CURRENT_DATE::TIMESTAMP + TIME '12:00',
    2, 2, 'checked_in', 'direct', 115.00, 575.00, 575.00, 'Family with two children. Cot needed.', FALSE)
  RETURNING id INTO v_b4;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, adults, children, status, source,
    room_rate, total_amount, paid_amount, internal_notes, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-005', v_g7, v_r101, v_rt1,
    CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '2 days',
    (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP + TIME '16:30',
    1, 0, 'checked_in', 'direct', 95.00, 285.00, 285.00, 'Corporate rate applied.', TRUE)
  RETURNING id INTO v_b5;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, adults, children, status, source,
    room_rate, total_amount, paid_amount, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-006', v_g9, v_r305, v_rt3,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days',
    CURRENT_DATE::TIMESTAMP + TIME '11:00',
    1, 0, 'checked_in', 'direct', 185.00, 555.00, 555.00, FALSE)
  RETURNING id INTO v_b6;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, adults, children, status, source,
    room_rate, total_amount, paid_amount, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-007', v_g8, v_r102, v_rt1,
    CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '1 day',
    (CURRENT_DATE - INTERVAL '3 days')::TIMESTAMP + TIME '15:20',
    2, 0, 'checked_in', 'direct', 95.00, 380.00, 380.00, TRUE)
  RETURNING id INTO v_b7;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, adults, children, status, source,
    room_rate, total_amount, paid_amount, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-008', v_g4, v_r203, v_rt2,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days',
    CURRENT_DATE::TIMESTAMP + TIME '14:00',
    2, 0, 'checked_in', 'booking_com', 115.00, 345.00, 345.00, FALSE)
  RETURNING id INTO v_b8;

  -- Confirmed (arriving soon)
  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, adults, children, status, source,
    room_rate, total_amount, paid_amount, special_requests, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-009', v_g6, v_r103, v_rt1,
    CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '5 days',
    1, 0, 'confirmed', 'airbnb', 95.00, 380.00, 190.00, 'Quiet room, away from lifts.', FALSE)
  RETURNING id INTO v_b9;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, adults, children, status, source,
    room_rate, total_amount, paid_amount, special_requests, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-010', v_g10, v_r202, v_rt2,
    CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days',
    2, 0, 'confirmed', 'expedia', 115.00, 345.00, 0.00, 'Late check-out if possible.', FALSE)
  RETURNING id INTO v_b10;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, adults, children, status, source,
    room_rate, total_amount, paid_amount, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-011', v_g1, v_r401, v_rt4,
    CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '21 days',
    2, 0, 'confirmed', 'direct', 380.00, 2660.00, 1330.00, TRUE)
  RETURNING id INTO v_b11;

  -- Checked out (historical)
  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, actual_check_out, adults, children, status, source,
    room_rate, total_amount, paid_amount, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-012', v_g9, v_r303, v_rt3,
    CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '4 days',
    (CURRENT_DATE - INTERVAL '7 days')::TIMESTAMP + TIME '15:00',
    (CURRENT_DATE - INTERVAL '4 days')::TIMESTAMP + TIME '11:30',
    1, 0, 'checked_out', 'direct', 185.00, 555.00, 555.00, TRUE)
  RETURNING id INTO v_b12;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, actual_check_out, adults, children, status, source,
    room_rate, total_amount, paid_amount, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-013', v_g7, v_r205, v_rt2,
    CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '3 days',
    (CURRENT_DATE - INTERVAL '5 days')::TIMESTAMP + TIME '13:00',
    (CURRENT_DATE - INTERVAL '3 days')::TIMESTAMP + TIME '10:00',
    2, 1, 'checked_out', 'direct', 115.00, 230.00, 230.00, TRUE)
  RETURNING id INTO v_b13;

  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, actual_check_in, actual_check_out, adults, children, status, source,
    room_rate, total_amount, paid_amount, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-014', v_g4, v_r105, v_rt2,
    CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE - INTERVAL '1 day',
    (CURRENT_DATE - INTERVAL '4 days')::TIMESTAMP + TIME '14:00',
    (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP + TIME '11:00',
    2, 0, 'checked_out', 'booking_com', 115.00, 345.00, 345.00, FALSE)
  RETURNING id INTO v_b14;

  -- Cancelled
  INSERT INTO bookings (id, tenant_id, booking_reference, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, adults, children, status, source,
    room_rate, total_amount, paid_amount, special_requests, pre_checkin_completed)
  VALUES (gen_random_uuid(), v_tid, 'TH-2026-015', v_g10, v_r304, v_rt3,
    CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '3 days',
    2, 0, 'cancelled', 'expedia', 185.00, 925.00, 0.00,
    'Guest changed travel dates', FALSE)
  RETURNING id INTO v_b15;

  -- ── HOUSEKEEPING TASKS ────────────────────────────────────────────
  INSERT INTO housekeeping_tasks (tenant_id, room_id, type, status, priority, notes)
  VALUES
    (v_tid, v_r104, 'checkout_clean', 'pending',     'high',   'Guest checked out this morning. Priority clean for 2pm arrival.'),
    (v_tid, v_r204, 'maintenance',    'in_progress', 'urgent', 'AC unit faulty. Maintenance team on site.'),
    (v_tid, v_r101, 'stayover_clean', 'pending',     'normal', 'Daily stayover clean. Guest out until 5pm.'),
    (v_tid, v_r203, 'stayover_clean', 'completed',   'normal', 'Completed at 10:30am. Extra towels left as requested.'),
    (v_tid, v_r301, 'stayover_clean', 'pending',     'high',   'VIP guest (James Harrison). White glove service required.'),
    (v_tid, v_r401, 'deep_clean',     'pending',     'urgent', 'Presidential suite prep for Volkov. Champagne and chocolates on side table.'),
    (v_tid, v_r302, 'stayover_clean', 'in_progress', 'high',   'Honeymoon suite. Fresh rose petals requested by guest.'),
    (v_tid, v_r103, 'inspection',     'pending',     'normal', 'Pre-arrival inspection for tomorrow check-in (Schneider).'),
    (v_tid, v_r202, 'inspection',     'pending',     'normal', 'Pre-arrival inspection for day-after-tomorrow check-in.'),
    (v_tid, v_r305, 'stayover_clean', 'completed',   'normal', 'Completed. Guest requested no disturbance after 2pm.');

  -- ── PAYMENTS ──────────────────────────────────────────────────────
  INSERT INTO payments (tenant_id, booking_id, amount, method, status, reference, notes)
  VALUES
    (v_tid, v_b1,  925.00,  'card',          'completed', 'PAY-B1-001',  'Full payment on check-in'),
    (v_tid, v_b2,  2660.00, 'bank_transfer', 'completed', 'PAY-B2-001',  'Wire transfer pre-arrival'),
    (v_tid, v_b3,  500.00,  'card',          'completed', 'PAY-B3-001',  'Deposit on booking'),
    (v_tid, v_b4,  575.00,  'cash',          'completed', 'PAY-B4-001',  'Cash on check-in'),
    (v_tid, v_b5,  285.00,  'card',          'completed', 'PAY-B5-001',  'Corporate card'),
    (v_tid, v_b6,  555.00,  'card',          'completed', 'PAY-B6-001',  'Amex card'),
    (v_tid, v_b7,  380.00,  'card',          'completed', 'PAY-B7-001',  'Visa debit'),
    (v_tid, v_b8,  345.00,  'card',          'completed', 'PAY-B8-001',  'Booking.com collect'),
    (v_tid, v_b9,  190.00,  'card',          'completed', 'PAY-B9-001',  '50% deposit'),
    (v_tid, v_b11, 1330.00, 'bank_transfer', 'completed', 'PAY-B11-001', '50% advance payment'),
    (v_tid, v_b12, 555.00,  'card',          'completed', 'PAY-B12-001', 'Full payment on check-in'),
    (v_tid, v_b13, 230.00,  'cash',          'completed', 'PAY-B13-001', 'Cash settlement'),
    (v_tid, v_b14, 345.00,  'card',          'completed', 'PAY-B14-001', 'Booking.com collect');

  RAISE NOTICE 'Hotel PMS demo data seeded for Tourists Hotel: %', v_tid;
END $$;
