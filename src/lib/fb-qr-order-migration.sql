-- ============================================================
-- QR Order System Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add QR-order fields to fb_orders
ALTER TABLE fb_orders
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'card', 'stripe')),
  ADD COLUMN IF NOT EXISTS is_paid        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS table_token    text;

-- 2. Ensure photo_url exists on fb_menu_items
ALTER TABLE fb_menu_items
  ADD COLUMN IF NOT EXISTS photo_url text;

-- 3. Enable Realtime for live KDS updates
--    (Also confirm in Supabase Dashboard → Database → Replication → fb_orders)
ALTER PUBLICATION supabase_realtime ADD TABLE fb_orders;

-- 4. Allow the service_role (used by api/order.ts) to insert orders
--    The API uses the service_role key so RLS is bypassed — no policy needed.
--    If you want anon inserts directly from the client, add:
-- CREATE POLICY "anon can insert orders" ON fb_orders
--   FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY "anon can insert order items" ON fb_order_items
--   FOR INSERT TO anon WITH CHECK (true);
