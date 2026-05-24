-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- TOWNSHUB PROPERTY MODULE â€” DEMO DATA SEED
-- Run in Supabase SQL Editor (postgres role)
-- Targets the first tenant named "Townshub"
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Ensure settings column exists
ALTER TABLE properties ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

DO $$
DECLARE
  v_tid    UUID;  -- tenant id

  -- owners
  v_own1   UUID; v_own2 UUID; v_own3 UUID;

  -- properties
  v_p1     UUID; v_p2 UUID; v_p3 UUID;

  -- units â€“ Sunrise Apartments
  v_u101   UUID; v_u102 UUID; v_u103 UUID;
  v_u104   UUID; v_u105 UUID; v_u106 UUID;

  -- units â€“ Palm Court Villas
  v_uVA    UUID; v_uVB    UUID;
  v_uO1    UUID; v_uO2    UUID;

  -- units â€“ Ocean View Commercial
  v_uS1    UUID; v_uS2    UUID;
  v_uS3    UUID; v_uS4    UUID;

  -- renters
  v_r1 UUID; v_r2 UUID; v_r3 UUID; v_r4 UUID;
  v_r5 UUID; v_r6 UUID; v_r7 UUID; v_r8 UUID;

  -- leases
  v_l1 UUID; v_l2 UUID; v_l3 UUID; v_l4 UUID;
  v_l5 UUID; v_l6 UUID; v_l7 UUID; v_l8 UUID;

BEGIN
  -- â”€â”€ TENANT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_tid
  FROM tenants
  WHERE name = 'Tourists Hotel'
  ORDER BY created_at
  LIMIT 1;

  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'No tenant named "Tourists Hotel" found. Update the WHERE clause to match your tenant name.';
  END IF;

  -- â”€â”€ PROPERTY OWNERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO property_owners (id, tenant_id, first_name, last_name, email, phone,
    id_type, id_number, address, city, country,
    bank_name, bank_iban, tax_number, management_fee_rate, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'George', 'Papadopoulos', 'george.papa@gmail.com', '+357 99 100 200',
     'national_id', 'CY123456', '12 Makarios Ave', 'Limassol', 'Cyprus',
     'Bank of Cyprus', 'CY01 0020 0195 0000 3572 5601 010', 'CY12345678C',
     10.00, 'Long-term client, owns Sunrise Apartments portfolio.')
  RETURNING id INTO v_own1;

  INSERT INTO property_owners (id, tenant_id, first_name, last_name, company_name, email, phone,
    id_type, id_number, address, city, country,
    bank_name, bank_iban, tax_number, vat_number, management_fee_rate, management_fee_type, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'Maria', 'Stavrou', 'Stavrou Real Estate Ltd', 'maria@stavrourealestate.cy', '+357 99 300 400',
     'company_reg', 'HE123789', '5 Arch Makarios III', 'Nicosia', 'Cyprus',
     'Hellenic Bank', 'CY01 0040 0195 0000 1234 5678 901', 'CY98765432V', 'CY98765432',
     8.00, 'percentage', 'Corporate client, prefers monthly statements by the 5th.')
  RETURNING id INTO v_own2;

  INSERT INTO property_owners (id, tenant_id, first_name, last_name, email, phone,
    id_type, id_number, address, city, country,
    bank_name, bank_iban, management_fee_rate, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'Andreas', 'Christodoulou', 'a.christodoulou@outlook.com', '+357 99 500 600',
     'passport', 'P12345678', '88 Poseidonos Ave', 'Paphos', 'Cyprus',
     'Alpha Bank', 'CY01 0090 0195 0000 9876 5432 100',
     12.00, 'Commercial property investor. Owns Ocean View Commercial Centre.')
  RETURNING id INTO v_own3;

  -- â”€â”€ PROPERTIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO properties (id, tenant_id, owner_id, name, type, address, city, district, country,
    postal_code, total_units, year_built, total_area_sqm, description, amenities, is_active, settings)
  VALUES
    (gen_random_uuid(), v_tid, v_own1,
     'Sunrise Apartments', 'residential',
     '24 Gladstonos Street', 'Limassol', 'Limassol District', 'Cyprus', '3032',
     6, 2008, 680.00,
     'Modern residential block in the heart of Limassol. Walking distance to the sea and city centre.',
     ARRAY['Covered Parking','Elevator','Security Camera','Intercom','Gym','Rooftop Terrace'],
     TRUE,
     '{"tagline":"Modern living by the Mediterranean","primary_color":"#0B1F4B","accent_color":"#C9A84C","website_url":"https://sunrise-limassol.cy","marketing_description":"Sunrise Apartments offers contemporary city living with sea views, premium finishes, and 24/7 security. Ideally located near Limassol marina.","social_instagram":"instagram.com/sunriseapts","listing_platforms":["Airbnb","Booking.com","Direct"]}'::jsonb)
  RETURNING id INTO v_p1;

  INSERT INTO properties (id, tenant_id, owner_id, name, type, address, city, district, country,
    postal_code, total_units, year_built, total_area_sqm, description, amenities, is_active, settings)
  VALUES
    (gen_random_uuid(), v_tid, v_own2,
     'Palm Court Villas', 'mixed_use',
     '15 Spyrou Kyprianou Ave', 'Nicosia', 'Nicosia District', 'Cyprus', '1075',
     4, 2015, 820.00,
     'Exclusive mixed-use development featuring luxury villas and premium office suites in Nicosia.',
     ARRAY['Private Garden','Swimming Pool','24hr Security','Concierge','EV Charging','Parking'],
     TRUE,
     '{"tagline":"Exclusive living & working in Nicosia","primary_color":"#1A3A2A","accent_color":"#D4AF37","website_url":"https://palmcourt.cy","marketing_description":"Palm Court Villas combines luxury residential villas with premium office space in Nicosia''s most sought-after address.","social_instagram":"instagram.com/palmcourt.cy","social_facebook":"facebook.com/palmcourtvillas","listing_platforms":["Direct","VRBO"]}'::jsonb)
  RETURNING id INTO v_p2;

  INSERT INTO properties (id, tenant_id, owner_id, name, type, address, city, district, country,
    postal_code, total_units, year_built, total_area_sqm, description, amenities, is_active, settings)
  VALUES
    (gen_random_uuid(), v_tid, v_own3,
     'Ocean View Commercial Centre', 'commercial',
     '3 Poseidonos Avenue', 'Paphos', 'Paphos District', 'Cyprus', '8042',
     4, 2019, 940.00,
     'Grade-A commercial centre with sea views. Ideal for offices, retail, and logistics.',
     ARRAY['High-Speed Fibre','Loading Bay','CCTV','Generator Backup','Air Conditioning','Ample Parking'],
     TRUE,
     '{"tagline":"Prime commercial space with sea views","primary_color":"#1C3557","accent_color":"#E8A020","marketing_description":"Ocean View Commercial Centre offers state-of-the-art workspace in Paphos with panoramic sea views, grade-A fittings, and superb connectivity.","listing_platforms":["Direct","Expedia"]}'::jsonb)
  RETURNING id INTO v_p3;

  -- â”€â”€ UNITS â€” Sunrise Apartments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p1, v_own1, '101', 1, 'apartment', 85.00, 2, 1, 1, 'furnished',   'occupied', 850.00, ARRAY['Sea View','Balcony','Built-in Wardrobes'])
  RETURNING id INTO v_u101;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p1, v_own1, '102', 1, 'apartment', 65.00, 1, 1, 1, 'furnished',   'occupied', 700.00, ARRAY['Balcony','Renovated Kitchen'])
  RETURNING id INTO v_u102;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p1, v_own1, '103', 2, 'apartment', 110.00, 3, 2, 2, 'furnished',   'occupied', 1200.00, ARRAY['Corner Unit','City View','Large Terrace'])
  RETURNING id INTO v_u103;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p1, v_own1, '104', 2, 'studio', 45.00, 0, 1, 0, 'furnished',       'vacant',   550.00, ARRAY['Open Plan','Modern Finish'])
  RETURNING id INTO v_u104;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p1, v_own1, '105', 3, 'apartment', 80.00, 2, 1, 1, 'semi_furnished','maintenance', 800.00, ARRAY['Mountain View','Storage Room'])
  RETURNING id INTO v_u105;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p1, v_own1, 'PH-01', 4, 'penthouse', 150.00, 3, 2, 2, 'furnished',  'vacant',   1800.00, ARRAY['360Â° Views','Private Pool','Smart Home','Wine Cellar'])
  RETURNING id INTO v_u106;

  -- â”€â”€ UNITS â€” Palm Court Villas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p2, v_own2, 'Villa A', 1, 'villa', 200.00, 4, 3, 2, 'furnished',  'occupied', 2200.00, ARRAY['Private Garden','Pool','Jacuzzi','Smart Security'])
  RETURNING id INTO v_uVA;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p2, v_own2, 'Villa B', 1, 'villa', 180.00, 3, 2, 2, 'semi_furnished', 'vacant', 1900.00, ARRAY['Private Garden','Solar Panels','BBQ Area'])
  RETURNING id INTO v_uVB;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p2, v_own2, 'Office 1', 1, 'office', 120.00, 0, 1, 3, 'furnished', 'occupied', 1500.00, ARRAY['Glass Partitions','Kitchenette','Meeting Room','Fiber 1Gbps'])
  RETURNING id INTO v_uO1;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p2, v_own2, 'Office 2', 2, 'office', 90.00, 0, 1, 2, 'unfurnished', 'vacant', 1100.00, ARRAY['Open Plan','AC','Raised Floor'])
  RETURNING id INTO v_uO2;

  -- â”€â”€ UNITS â€” Ocean View Commercial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p3, v_own3, 'Suite 101', 1, 'office', 80.00, 0, 1, 2, 'furnished',   'occupied', 1300.00, ARRAY['Sea View','VoIP Ready','24hr Access'])
  RETURNING id INTO v_uS1;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p3, v_own3, 'Suite 102', 1, 'office', 100.00, 0, 1, 3, 'furnished',  'occupied', 1600.00, ARRAY['Corner Office','Sea & City View','Boardroom Access'])
  RETURNING id INTO v_uS2;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p3, v_own3, 'Retail 01', 0, 'retail', 150.00, 0, 1, 4, 'unfurnished', 'vacant', 2000.00, ARRAY['Street Frontage','Shopfront','High Footfall Area'])
  RETURNING id INTO v_uS3;

  INSERT INTO units (id, tenant_id, property_id, owner_id, unit_number, floor, type,
    area_sqm, bedrooms, bathrooms, parking_spaces, furnished, status, market_rent, features)
  VALUES
    (gen_random_uuid(), v_tid, v_p3, v_own3, 'Warehouse 1', 0, 'warehouse', 300.00, 0, 1, 8, 'unfurnished', 'occupied', 2500.00, ARRAY['Loading Dock','CCTV','3-Phase Power','Fire Suppression'])
  RETURNING id INTO v_uS4;

  -- â”€â”€ RENTERS (property_tenants) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO property_tenants (id, tenant_id, first_name, last_name, email, phone,
    tenant_type, id_type, id_number, nationality, date_of_birth, city, country,
    employer, emergency_contact_name, emergency_contact_phone, tags, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'Lucas', 'Fernandez', 'lucas.fernandez@gmail.com', '+34 600 123 456',
     'individual', 'passport', 'ESP123456', 'Spanish', '1988-03-15', 'Limassol', 'Cyprus',
     'Freelance Consultant', 'Elena Fernandez', '+34 600 789 012',
     ARRAY['long-term','reliable'], 'Excellent tenant, always pays on time.')
  RETURNING id INTO v_r1;

  INSERT INTO property_tenants (id, tenant_id, first_name, last_name, email, phone,
    tenant_type, id_type, id_number, nationality, date_of_birth, city, country,
    employer, emergency_contact_name, emergency_contact_phone, tags, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'Anna', 'Constantinou', 'anna.const@hotmail.com', '+357 99 200 300',
     'individual', 'national_id', 'CY654321', 'Cypriot', '1992-07-22', 'Limassol', 'Cyprus',
     'Bank of Cyprus', 'Stavros Constantinou', '+357 99 400 500',
     ARRAY['employed','cypriot'], 'Employed at BoC, good references.')
  RETURNING id INTO v_r2;

  INSERT INTO property_tenants (id, tenant_id, first_name, last_name, email, phone,
    tenant_type, id_type, id_number, nationality, date_of_birth, city, country,
    employer, emergency_contact_name, emergency_contact_phone, tags, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'Michael', 'Georgiou', 'm.georgiou@yahoo.com', '+357 96 300 400',
     'individual', 'national_id', 'CY789012', 'Cypriot', '1985-11-08', 'Limassol', 'Cyprus',
     'Georgiou & Sons Construction', 'Nikos Georgiou', '+357 96 500 600',
     ARRAY['long-term','business-owner'], 'Self-employed, 3 months deposit paid upfront.')
  RETURNING id INTO v_r3;

  INSERT INTO property_tenants (id, tenant_id, first_name, last_name, email, phone,
    tenant_type, id_type, id_number, nationality, date_of_birth, city, country,
    employer, emergency_contact_name, emergency_contact_phone, tags, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'Sofia', 'Petridou', 'sofia.pet@gmail.com', '+30 694 100 200',
     'individual', 'passport', 'GR456789', 'Greek', '1990-05-30', 'Nicosia', 'Cyprus',
     'Deloitte Cyprus', 'Kostas Petridou', '+30 694 300 400',
     ARRAY['professional','greek','high-income'], 'Senior manager at Deloitte, impeccable references.')
  RETURNING id INTO v_r4;

  INSERT INTO property_tenants (id, tenant_id, first_name, last_name, company_name, email, phone,
    tenant_type, id_type, id_number, city, country, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'Christos', 'Andreou', 'TechCorp Solutions Ltd', 'office@techcorp.cy', '+357 22 500 600',
     'company', 'company_reg', 'HE456789', 'Nicosia', 'Cyprus',
     'IT solutions firm, 12 employees in the office. Always pays by SEPA transfer.')
  RETURNING id INTO v_r5;

  INSERT INTO property_tenants (id, tenant_id, first_name, last_name, email, phone,
    tenant_type, id_type, id_number, nationality, date_of_birth, city, country,
    employer, emergency_contact_name, emergency_contact_phone, tags, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'James', 'Wilson', 'j.wilson@wilsonarch.com', '+44 7700 900 123',
     'individual', 'passport', 'GB987654', 'British', '1979-09-12', 'Paphos', 'Cyprus',
     'Wilson Architecture Ltd', 'Sarah Wilson', '+44 7700 900 456',
     ARRAY['expat','british','professional'], 'Architect, moved to Cyprus 2 years ago. Very tidy tenant.')
  RETURNING id INTO v_r6;

  INSERT INTO property_tenants (id, tenant_id, first_name, last_name, company_name, email, phone,
    tenant_type, id_type, id_number, city, country, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'Petros', 'Loizou', 'MediaGroup Cyprus Ltd', 'info@mediagroup.cy', '+357 25 700 800',
     'company', 'company_reg', 'HE567890', 'Paphos', 'Cyprus',
     'Digital media agency, 8 employees. Director is Petros Loizou.')
  RETURNING id INTO v_r7;

  INSERT INTO property_tenants (id, tenant_id, first_name, last_name, company_name, email, phone,
    tenant_type, id_type, id_number, city, country, notes)
  VALUES
    (gen_random_uuid(), v_tid, 'Yiannos', 'Kyriacou', 'Logistics Pro Ltd', 'yk@logisticspro.cy', '+357 25 800 900',
     'company', 'company_reg', 'HE678901', 'Paphos', 'Cyprus',
     'Logistics and warehousing company. Reliable payer, 5-year history with us.')
  RETURNING id INTO v_r8;

  -- â”€â”€ LEASES â€” insert as draft, then activate (triggers rent schedule + unit status) â”€â”€
  INSERT INTO leases (id, tenant_id, unit_id, property_tenant_id, owner_id,
    lease_type, status, start_date, end_date, monthly_rent, rent_frequency, payment_due_day,
    notice_period_days, deposit_amount, deposit_paid, rent_includes_utilities,
    guarantor_name, special_conditions, internal_notes, auto_renew, auto_renew_months)
  VALUES
    (gen_random_uuid(), v_tid, v_u101, v_r1, v_own1,
     'fixed_term', 'draft',
     CURRENT_DATE - INTERVAL '8 months', CURRENT_DATE + INTERVAL '4 months',
     850.00, 'monthly', 1, 30, 1700.00, TRUE, FALSE,
     'Elena Fernandez', 'No pets. Key handover on 1st of month.', 'Lucas has been a model tenant since day 1.',
     TRUE, 12)
  RETURNING id INTO v_l1;

  INSERT INTO leases (id, tenant_id, unit_id, property_tenant_id, owner_id,
    lease_type, status, start_date, end_date, monthly_rent, rent_frequency, payment_due_day,
    notice_period_days, deposit_amount, deposit_paid, rent_includes_utilities,
    special_conditions, auto_renew, auto_renew_months)
  VALUES
    (gen_random_uuid(), v_tid, v_u102, v_r2, v_own1,
     'fixed_term', 'draft',
     CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '6 months',
     700.00, 'monthly', 1, 30, 1400.00, TRUE, FALSE,
     'No alterations without written consent.', FALSE, 12)
  RETURNING id INTO v_l2;

  INSERT INTO leases (id, tenant_id, unit_id, property_tenant_id, owner_id,
    lease_type, status, start_date, end_date, monthly_rent, rent_frequency, payment_due_day,
    notice_period_days, deposit_amount, deposit_paid, rent_includes_utilities,
    special_conditions, internal_notes, auto_renew, auto_renew_months)
  VALUES
    (gen_random_uuid(), v_tid, v_u103, v_r3, v_own1,
     'fixed_term', 'draft',
     CURRENT_DATE - INTERVAL '10 months', CURRENT_DATE + INTERVAL '2 months',
     1200.00, 'monthly', 5, 60, 3600.00, TRUE, TRUE,
     'Utilities included up to â‚¬150/month. Excess charged to tenant.',
     'Consider early renewal offer â€” Michael expressed interest in staying long-term.',
     TRUE, 12)
  RETURNING id INTO v_l3;

  INSERT INTO leases (id, tenant_id, unit_id, property_tenant_id, owner_id,
    lease_type, status, start_date, end_date, monthly_rent, rent_frequency, payment_due_day,
    notice_period_days, deposit_amount, deposit_paid, rent_includes_utilities,
    special_conditions, auto_renew, auto_renew_months)
  VALUES
    (gen_random_uuid(), v_tid, v_uVA, v_r4, v_own2,
     'fixed_term', 'draft',
     CURRENT_DATE - INTERVAL '4 months', CURRENT_DATE + INTERVAL '8 months',
     2200.00, 'monthly', 1, 60, 6600.00, TRUE, FALSE,
     'Garden maintenance included. Monthly pool service by approved contractor.',
     FALSE, 12)
  RETURNING id INTO v_l4;

  INSERT INTO leases (id, tenant_id, unit_id, property_tenant_id, owner_id,
    lease_type, status, start_date, end_date, monthly_rent, rent_frequency, payment_due_day,
    notice_period_days, deposit_amount, deposit_paid, rent_includes_utilities,
    special_conditions, internal_notes, auto_renew, auto_renew_months)
  VALUES
    (gen_random_uuid(), v_tid, v_uO1, v_r5, v_own2,
     'commercial', 'draft',
     CURRENT_DATE - INTERVAL '14 months', CURRENT_DATE + INTERVAL '10 months',
     1500.00, 'monthly', 1, 90, 4500.00, TRUE, FALSE,
     'Permitted use: IT services office. Subletting not permitted. VAT applicable.',
     'TechCorp requested signage rights â€” approved by owner.',
     FALSE, 12)
  RETURNING id INTO v_l5;

  INSERT INTO leases (id, tenant_id, unit_id, property_tenant_id, owner_id,
    lease_type, status, start_date, end_date, monthly_rent, rent_frequency, payment_due_day,
    notice_period_days, deposit_amount, deposit_paid,
    special_conditions, auto_renew, auto_renew_months)
  VALUES
    (gen_random_uuid(), v_tid, v_uS1, v_r6, v_own3,
     'fixed_term', 'draft',
     CURRENT_DATE - INTERVAL '3 months', CURRENT_DATE + INTERVAL '9 months',
     1300.00, 'monthly', 1, 30, 2600.00, TRUE,
     'No structural modifications. Tenant responsible for contents insurance.',
     FALSE, 12)
  RETURNING id INTO v_l6;

  INSERT INTO leases (id, tenant_id, unit_id, property_tenant_id, owner_id,
    lease_type, status, start_date, end_date, monthly_rent, rent_frequency, payment_due_day,
    notice_period_days, deposit_amount, deposit_paid,
    special_conditions, internal_notes, auto_renew, auto_renew_months)
  VALUES
    (gen_random_uuid(), v_tid, v_uS2, v_r7, v_own3,
     'commercial', 'draft',
     CURRENT_DATE - INTERVAL '2 months', CURRENT_DATE + INTERVAL '22 months',
     1600.00, 'monthly', 1, 90, 4800.00, TRUE,
     'Permitted use: media and digital marketing agency. External signage allowed.',
     'MediaGroup is a fast-growing agency â€” likely to need more space within 12 months.',
     TRUE, 24)
  RETURNING id INTO v_l7;

  INSERT INTO leases (id, tenant_id, unit_id, property_tenant_id, owner_id,
    lease_type, status, start_date, end_date, monthly_rent, rent_frequency, payment_due_day,
    notice_period_days, deposit_amount, deposit_paid,
    special_conditions, auto_renew, auto_renew_months)
  VALUES
    (gen_random_uuid(), v_tid, v_uS4, v_r8, v_own3,
     'commercial', 'draft',
     CURRENT_DATE - INTERVAL '5 months', CURRENT_DATE + INTERVAL '19 months',
     2500.00, 'monthly', 1, 90, 7500.00, TRUE,
     'Permitted use: warehousing and distribution. Loading dock access 6amâ€“10pm only.',
     FALSE, 12)
  RETURNING id INTO v_l8;

  -- â”€â”€ ACTIVATE LEASES (triggers rent schedule generation + unit status update) â”€â”€
  UPDATE leases SET status = 'active' WHERE id = v_l1;
  UPDATE leases SET status = 'active' WHERE id = v_l2;
  UPDATE leases SET status = 'active' WHERE id = v_l3;
  UPDATE leases SET status = 'active' WHERE id = v_l4;
  UPDATE leases SET status = 'active' WHERE id = v_l5;
  UPDATE leases SET status = 'active' WHERE id = v_l6;
  UPDATE leases SET status = 'active' WHERE id = v_l7;
  UPDATE leases SET status = 'active' WHERE id = v_l8;

  -- â”€â”€ MARK HISTORICAL RENT SCHEDULE ENTRIES AS PAID/OVERDUE â”€â”€â”€â”€â”€â”€â”€â”€
  -- Paid: all entries before this month
  UPDATE rent_schedule SET
    status = 'paid', paid_amount = amount, paid_date = due_date + INTERVAL '2 days'
  WHERE tenant_id = v_tid
    AND due_date < DATE_TRUNC('month', CURRENT_DATE)
    AND lease_id IN (v_l1, v_l2, v_l3, v_l4, v_l5, v_l6, v_l7, v_l8)
    AND due_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months';

  -- Overdue: Lucas (v_l1) missed last month's payment
  UPDATE rent_schedule SET status = 'overdue', paid_amount = 0
  WHERE lease_id = v_l1
    AND due_date = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month';

  -- Partial: Michael (v_l3) paid partial this month
  UPDATE rent_schedule SET
    status = 'partial', paid_amount = 600.00, paid_date = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '3 days'
  WHERE lease_id = v_l3
    AND due_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND due_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

  -- Current month pending (TechCorp and Logistics â€” awaiting SEPA)
  UPDATE rent_schedule SET status = 'pending'
  WHERE lease_id IN (v_l5, v_l8)
    AND due_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND due_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

  -- â”€â”€ PROPERTY PAYMENTS (receipts for paid entries) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO property_payments (tenant_id, lease_id, property_tenant_id, unit_id,
    amount, payment_type, method, reference, payment_date, notes)
  SELECT v_tid, r.lease_id, r.property_tenant_id, r.unit_id,
    r.amount, 'rent', 'bank_transfer',
    'REF-' || TO_CHAR(r.due_date, 'YYYYMM') || '-' || UPPER(SUBSTRING(r.lease_id::TEXT, 1, 4)),
    r.paid_date, 'Monthly rent payment'
  FROM rent_schedule r
  WHERE r.tenant_id = v_tid AND r.status = 'paid' AND r.lease_id IN (v_l1,v_l2,v_l3,v_l4,v_l5,v_l6,v_l7,v_l8);

  -- Deposit payments
  INSERT INTO property_payments (tenant_id, lease_id, property_tenant_id, unit_id,
    amount, payment_type, method, reference, payment_date, notes)
  VALUES
    (v_tid, v_l1, v_r1, v_u101, 1700.00, 'deposit', 'bank_transfer', 'DEP-L1-2024', CURRENT_DATE - INTERVAL '8 months', 'Security deposit â€” Lucas Fernandez'),
    (v_tid, v_l3, v_r3, v_u103, 3600.00, 'deposit', 'bank_transfer', 'DEP-L3-2024', CURRENT_DATE - INTERVAL '10 months', 'Security deposit â€” Michael Georgiou (3 months)'),
    (v_tid, v_l4, v_r4, v_uVA,  6600.00, 'deposit', 'bank_transfer', 'DEP-L4-2025', CURRENT_DATE - INTERVAL '4 months', 'Security deposit â€” Sofia Petridou (3 months)');

  -- â”€â”€ MAINTENANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO property_maintenance (tenant_id, unit_id, property_id, lease_id,
    reported_by_type, reported_by_tenant, category, title, description,
    priority, status, estimated_cost, actual_cost, cost_responsibility,
    contractor_name, contractor_phone, scheduled_date, completed_date)
  VALUES
    (v_tid, v_u105, v_p1, NULL, 'manager', NULL, 'plumbing',
     'Bathroom leak â€” Unit 105', 'Water leak from shower tray seeping into floor below. Reported during routine inspection. Unit currently empty.',
     'high', 'in_progress', 350.00, NULL, 'owner',
     'Plumb-Right Services', '+357 99 111 222', CURRENT_DATE + INTERVAL '2 days', NULL),

    (v_tid, v_u103, v_p1, v_l3, 'tenant', v_r3, 'hvac',
     'AC not cooling â€” Unit 103', 'Air conditioning unit in master bedroom not producing cold air. Tenant reports issue since 3 days ago.',
     'urgent', 'assessed', 200.00, NULL, 'owner',
     'CoolTech HVAC', '+357 99 222 333', CURRENT_DATE + INTERVAL '1 day', NULL),

    (v_tid, v_uVB, v_p2, NULL, 'manager', NULL, 'security',
     'Front door lock mechanism faulty â€” Villa B', 'Electronic lock not engaging properly. Temporary manual lock installed. Locksmith quote requested.',
     'high', 'quoted', 420.00, NULL, 'owner',
     'SecureLock Cyprus', '+357 99 333 444', CURRENT_DATE + INTERVAL '3 days', NULL),

    (v_tid, v_uS3, v_p3, NULL, 'manager', NULL, 'electrical',
     'Electrical fault â€” Retail 01', 'Main circuit breaker tripping repeatedly. Building electrician inspected and found faulty wiring in distribution board.',
     'emergency', 'in_progress', 1200.00, NULL, 'owner',
     'ElectroFix Pro', '+357 99 444 555', CURRENT_DATE, NULL),

    (v_tid, NULL, v_p2, NULL, 'manager', NULL, 'garden',
     'Garden landscaping â€” Palm Court Common Areas', 'Seasonal pruning and replanting of common garden areas. Scheduled as part of Q2 maintenance plan.',
     'low', 'completed', 800.00, 750.00, 'owner',
     'Green Thumb Gardens', '+357 99 555 666', CURRENT_DATE - INTERVAL '2 weeks', CURRENT_DATE - INTERVAL '10 days'),

    (v_tid, v_u101, v_p1, v_l1, 'tenant', v_r1, 'appliance',
     'Dishwasher not draining â€” Unit 101', 'Dishwasher leaves standing water after cycle. Tenant has been using it since move-in.',
     'normal', 'completed', 150.00, 130.00, 'owner',
     'Appliance Doctors', '+357 99 666 777', CURRENT_DATE - INTERVAL '3 weeks', CURRENT_DATE - INTERVAL '2 weeks');

  -- â”€â”€ INSPECTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO property_inspections (tenant_id, unit_id, lease_id, inspection_type,
    scheduled_date, completed_date, overall_condition, status, notes)
  VALUES
    (v_tid, v_u101, v_l1, 'move_in',
     CURRENT_DATE - INTERVAL '8 months', CURRENT_DATE - INTERVAL '8 months',
     'excellent', 'completed', 'All fixtures in perfect condition. Inventory signed by tenant.'),

    (v_tid, v_u102, v_l2, 'move_in',
     CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE - INTERVAL '6 months',
     'good', 'completed', 'Minor scuff on kitchen wall noted. Photographed and agreed as pre-existing.'),

    (v_tid, v_u103, v_l3, 'move_in',
     CURRENT_DATE - INTERVAL '10 months', CURRENT_DATE - INTERVAL '10 months',
     'excellent', 'completed', 'Property in excellent condition. 3-month deposit collected.'),

    (v_tid, v_uVA, v_l4, 'move_in',
     CURRENT_DATE - INTERVAL '4 months', CURRENT_DATE - INTERVAL '4 months',
     'excellent', 'completed', 'Villa handed over in pristine condition. Pool serviced day before. Tenant satisfied.'),

    (v_tid, v_u101, v_l1, 'routine',
     CURRENT_DATE - INTERVAL '2 months', CURRENT_DATE - INTERVAL '2 months',
     'good', 'completed', 'General condition good. Some minor wear on kitchen countertop noted.'),

    (v_tid, v_u104, NULL, 'routine',
     CURRENT_DATE + INTERVAL '7 days', NULL,
     NULL, 'scheduled', 'Pre-letting inspection for vacant unit. Check paint and fixtures before marketing.'),

    (v_tid, v_u105, NULL, 'maintenance',
     CURRENT_DATE + INTERVAL '3 days', NULL,
     NULL, 'scheduled', 'Inspect bathroom leak damage and confirm repair scope.'),

    (v_tid, v_uS1, v_l6, 'move_in',
     CURRENT_DATE - INTERVAL '3 months', CURRENT_DATE - INTERVAL '3 months',
     'excellent', 'completed', 'Suite handed over fully fitted. Tenant satisfied with condition.');

  -- â”€â”€ OWNER STATEMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO owner_statements (tenant_id, owner_id, period_start, period_end,
    total_rent_collected, management_fee, maintenance_costs, net_owner_payment, status, payment_date, notes)
  VALUES
    (v_tid, v_own1,
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months',
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' - INTERVAL '1 day',
     2750.00, 275.00, 130.00, 2345.00, 'paid',
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '3 days',
     'Units 101, 102, 103 â€” 2 months ago. Dishwasher repair deducted.'),

    (v_tid, v_own1,
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month',
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day',
     1550.00, 155.00, 0.00, 1395.00, 'sent', NULL,
     'Unit 101 arrears (missed payment). Units 102 + 103 collected. Awaiting owner confirmation.'),

    (v_tid, v_own2,
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months',
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' - INTERVAL '1 day',
     3700.00, 296.00, 0.00, 3404.00, 'paid',
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '5 days',
     'Villa A + Office 1 â€” all rents collected. Garden maintenance billed separately.'),

    (v_tid, v_own3,
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month',
     DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day',
     3900.00, 468.00, 0.00, 3432.00, 'draft', NULL,
     'Suites 101 & 102 collected. Awaiting SEPA from Logistics Pro.');

  -- â”€â”€ UTILITY ACCOUNTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO utility_accounts (tenant_id, unit_id, property_id, utility_type,
    provider, account_number, meter_number, billing_name, is_active)
  VALUES
    (v_tid, v_u101, v_p1, 'electricity', 'EAC', 'EAC-101-2024', 'M-10101', 'Lucas Fernandez', TRUE),
    (v_tid, v_u102, v_p1, 'water',       'Water Board', 'WB-102-2024', 'W-10201', 'Anna Constantinou', TRUE),
    (v_tid, v_u103, v_p1, 'electricity', 'EAC', 'EAC-103-2024', 'M-10301', 'Sunrise Apts - Unit 103', TRUE),
    (v_tid, v_uVA,  v_p2, 'electricity', 'EAC', 'EAC-VA-2024',  'M-VA001', 'Sofia Petridou', TRUE),
    (v_tid, v_uVA,  v_p2, 'water',       'Water Board', 'WB-VA-2024', 'W-VA001', 'Sofia Petridou', TRUE),
    (v_tid, v_uO1,  v_p2, 'internet',    'CYTA', 'CYTA-O1-2024', NULL, 'TechCorp Solutions Ltd', TRUE),
    (v_tid, v_uS1,  v_p3, 'electricity', 'EAC', 'EAC-S1-2024',  'M-S1001', 'James Wilson', TRUE),
    (v_tid, v_uS4,  v_p3, 'electricity', 'EAC', 'EAC-S4-2024',  'M-S4001', 'Logistics Pro Ltd', TRUE);

  -- â”€â”€ UTILITY BILLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO utility_bills (tenant_id, unit_id, billing_period_start, billing_period_end,
    reading_start, reading_end, consumption, unit_cost, amount, charged_to, lease_id, status)
  SELECT v_tid, v_u101,
    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '3 months',
    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months' - INTERVAL '1 day',
    1250.00, 1430.00, 180.00, 0.18, 32.40, 'tenant', v_l1, 'charged';

  INSERT INTO utility_bills (tenant_id, unit_id, billing_period_start, billing_period_end,
    reading_start, reading_end, consumption, unit_cost, amount, charged_to, lease_id, status)
  SELECT v_tid, v_u103,
    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months',
    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' - INTERVAL '1 day',
    5200.00, 5510.00, 310.00, 0.18, 55.80, 'owner', v_l3, 'paid';

  INSERT INTO utility_bills (tenant_id, unit_id, billing_period_start, billing_period_end,
    reading_start, reading_end, consumption, unit_cost, amount, charged_to, lease_id, status)
  SELECT v_tid, v_uVA,
    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month',
    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day',
    890.00, 1020.00, 130.00, 0.18, 23.40, 'tenant', v_l4, 'pending';

  -- â”€â”€ PROPERTY DOCUMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO property_documents (tenant_id, property_id, unit_id, lease_id, property_tenant_id,
    document_type, title, file_url, file_type, expiry_date, notes)
  VALUES
    (v_tid, v_p1, v_u101, v_l1, v_r1, 'lease_agreement',
     'Lease Agreement â€” Lucas Fernandez (Unit 101)',
     'https://example.com/docs/lease-101-lucas.pdf', 'application/pdf',
     CURRENT_DATE + INTERVAL '4 months', 'Signed by both parties.'),

    (v_tid, v_p1, v_u102, v_l2, v_r2, 'lease_agreement',
     'Lease Agreement â€” Anna Constantinou (Unit 102)',
     'https://example.com/docs/lease-102-anna.pdf', 'application/pdf',
     CURRENT_DATE + INTERVAL '6 months', 'Countersigned 6 months ago.'),

    (v_tid, v_p1, v_u103, v_l3, v_r3, 'lease_agreement',
     'Lease Agreement â€” Michael Georgiou (Unit 103)',
     'https://example.com/docs/lease-103-michael.pdf', 'application/pdf',
     CURRENT_DATE + INTERVAL '2 months', 'Renewal discussion to begin next month.'),

    (v_tid, v_p1, NULL, NULL, v_r1, 'id_document',
     'Passport â€” Lucas Fernandez',
     'https://example.com/docs/id-lucas.pdf', 'application/pdf',
     CURRENT_DATE + INTERVAL '3 years', 'Spanish passport, expires 2028.'),

    (v_tid, v_p2, v_uVA, v_l4, v_r4, 'lease_agreement',
     'Lease Agreement â€” Sofia Petridou (Villa A)',
     'https://example.com/docs/lease-villa-a-sofia.pdf', 'application/pdf',
     CURRENT_DATE + INTERVAL '8 months', 'Includes pool maintenance addendum.'),

    (v_tid, v_p2, NULL, NULL, NULL, 'title_deed',
     'Title Deed â€” Palm Court Villas',
     'https://example.com/docs/title-palm-court.pdf', 'application/pdf',
     NULL, 'Original title deed, owner: Stavrou Real Estate Ltd.');

  -- Insurance document linked to owner (not renter)
  INSERT INTO property_documents (tenant_id, property_id, owner_id,
    document_type, title, file_url, file_type, expiry_date, notes)
  VALUES
    (v_tid, v_p3, v_own3, 'insurance',
     'Building Insurance â€” Ocean View Commercial Centre',
     'https://example.com/docs/insurance-oceanview.pdf', 'application/pdf',
     CURRENT_DATE + INTERVAL '5 months', 'AXA Insurance policy. Renews annually.');

  RAISE NOTICE 'Demo data seeded successfully for tenant: %', v_tid;
END $$;

-- Run overdue detection
SELECT mark_overdue_rent();
