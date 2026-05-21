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
  p_country    TEXT    DEFAULT 'Cyprus'
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

  INSERT INTO tenants (name, slug, email, phone, city, country)
  VALUES (p_hotel_name, p_slug, p_email, p_phone, p_city, p_country)
  RETURNING id INTO v_tenant_id;

  INSERT INTO users (id, tenant_id, email, full_name, role)
  VALUES (v_user_id, v_tenant_id, p_email, p_full_name, 'admin');

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id',   v_user_id
  );
END;
$$;
