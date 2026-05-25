-- Run this in Supabase SQL Editor
-- Creates a SECURITY DEFINER function so new hotels can self-register
-- without needing INSERT RLS policies on tenants/users

CREATE OR REPLACE FUNCTION register_hotel(
  p_hotel_name TEXT,
  p_slug       TEXT,
  p_email      TEXT,
  p_full_name  TEXT,
  p_phone      TEXT    DEFAULT NULL,
  p_city       TEXT    DEFAULT NULL,
  p_country    TEXT    DEFAULT 'Cyprus',
  p_mode       TEXT    DEFAULT 'hotel'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Hotel already registered for this account';
  END IF;

  -- Ensure slug is unique; append random suffix if taken
  WHILE EXISTS (SELECT 1 FROM tenants WHERE slug = p_slug) LOOP
    p_slug := p_slug || '-' || substr(md5(random()::text), 1, 4);
  END LOOP;

  INSERT INTO tenants (name, slug, email, phone, city, country, mode)
  VALUES (p_hotel_name, p_slug, p_email, p_phone, p_city, p_country, p_mode)
  RETURNING id INTO v_tenant_id;

  INSERT INTO users (id, tenant_id, email, full_name, role)
  VALUES (v_user_id, v_tenant_id, p_email, p_full_name, 'admin');

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id',   v_user_id
  );
END;
$$;

-- ─── Fix admin@townshub.cy login ─────────────────────────────────────────────
-- If admin@townshub.cy cannot log in, run the block below in SQL Editor.
-- It creates the required tenants + users rows for the super-admin account.

/*
DO $$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@townshub.cy';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'admin@townshub.cy not found in auth.users';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'townshub-platform') THEN
    INSERT INTO tenants (name, slug, email, mode, subscription_status, trial_ends_at, currency, timezone)
    VALUES ('TownsHub Platform', 'townshub-platform', 'admin@townshub.cy', 'both', 'active', '2099-12-31', 'EUR', 'Europe/Nicosia')
    RETURNING id INTO v_tenant_id;
  ELSE
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'townshub-platform';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    INSERT INTO users (id, tenant_id, email, full_name, role)
    VALUES (v_user_id, v_tenant_id, 'admin@townshub.cy', 'Platform Admin', 'admin');
  END IF;
END $$;
*/
