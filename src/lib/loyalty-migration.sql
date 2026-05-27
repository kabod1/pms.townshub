-- ═══════════════════════════════════════════════════════════════════════════════
-- LOYALTY PROGRAMME — MIGRATION
-- Run in Supabase SQL Editor AFTER schema.sql
-- Adds: loyalty_points (unified ledger), loyalty_balance view,
--       auto-earn trigger on booking checkout, and RLS for new tables.
-- The core tables (loyalty_accounts, loyalty_transactions) already exist in
-- schema.sql — this migration adds the extended ledger + automation.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Unified loyalty points ledger ─────────────────────────────────────────
-- A simpler, append-only table used by the auto-earn trigger.
-- loyalty_transactions (existing) is used for staff manual adjustments;
-- loyalty_points is used for automatic earning/redemption.
CREATE TABLE IF NOT EXISTS loyalty_points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_id      UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  booking_id    UUID REFERENCES bookings(id) ON DELETE SET NULL,
  account_id    UUID REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  points        INTEGER NOT NULL,  -- positive = earn, negative = redeem/expire
  type          TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjust')),
  description   TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_tenant   ON loyalty_points(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_guest    ON loyalty_points(guest_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_booking  ON loyalty_points(booking_id);

ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_points_tenant_policy" ON loyalty_points;
CREATE POLICY "loyalty_points_tenant_policy" ON loyalty_points
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ── 2. loyalty_balance view ────────────────────────────────────────────────────
-- Convenience view: current balance and lifetime points per guest.
CREATE OR REPLACE VIEW loyalty_balance AS
SELECT
  la.id           AS account_id,
  la.tenant_id,
  la.guest_id,
  la.tier,
  la.points_balance,
  la.lifetime_points,
  g.first_name,
  g.last_name,
  g.email
FROM loyalty_accounts la
JOIN guests g ON g.id = la.guest_id;

-- ── 3. Tier thresholds ────────────────────────────────────────────────────────
-- Upsert default tiers so every new tenant gets Bronze/Silver/Gold/Platinum.
-- Tiers use lifetime_points (not current balance) for progression.
-- Bronze: 0–999 | Silver: 1000–4999 | Gold: 5000–14999 | Platinum: 15000+
-- The thresholds here differ slightly from the page's TIER_THRESHOLDS constant
-- which you can adjust in src/pages/loyalty/LoyaltyPage.tsx.

-- (No per-tenant seed here — tiers are determined in code via TIER_THRESHOLDS.)

-- ── 4. Auto-earn function: 1 point per €1 spent on checkout ───────────────────
-- Fires when a booking's status changes to 'checked_out'.
-- Requires: loyalty_accounts row already exists for the guest (created at enrol).
-- Points formula: floor(total_amount / 1) → 1 pt per €1.

CREATE OR REPLACE FUNCTION loyalty_auto_earn_on_checkout()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id      UUID;
  v_points          INTEGER;
  v_lifetime        INTEGER;
  v_new_tier        TEXT;
BEGIN
  -- Only fire when transitioning TO 'checked_out'
  IF NEW.status <> 'checked_out' OR OLD.status = 'checked_out' THEN
    RETURN NEW;
  END IF;

  -- Guest must be linked
  IF NEW.guest_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find or skip the loyalty account
  SELECT id INTO v_account_id
    FROM loyalty_accounts
   WHERE tenant_id = NEW.tenant_id AND guest_id = NEW.guest_id;

  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1 point per €1 of total_amount (floor)
  v_points := GREATEST(0, FLOOR(COALESCE(NEW.total_amount, 0))::INTEGER);

  IF v_points = 0 THEN
    RETURN NEW;
  END IF;

  -- Prevent double-earn: check no earn transaction for this booking already
  IF EXISTS (
    SELECT 1 FROM loyalty_transactions
     WHERE account_id = v_account_id
       AND booking_id = NEW.id
       AND type = 'earn'
  ) THEN
    RETURN NEW;
  END IF;

  -- Insert transaction
  INSERT INTO loyalty_transactions (account_id, tenant_id, booking_id, type, points, description)
  VALUES (v_account_id, NEW.tenant_id, NEW.id, 'earn',
          v_points,
          'Earned on checkout — Booking ' || NEW.booking_reference);

  -- Also log in loyalty_points ledger
  INSERT INTO loyalty_points (tenant_id, guest_id, booking_id, account_id, points, type, description)
  VALUES (NEW.tenant_id, NEW.guest_id, NEW.id, v_account_id, v_points, 'earn',
          'Auto-earn on checkout — ' || NEW.booking_reference);

  -- Update account balance + lifetime
  SELECT lifetime_points INTO v_lifetime
    FROM loyalty_accounts WHERE id = v_account_id;

  v_lifetime := COALESCE(v_lifetime, 0) + v_points;

  -- Recalculate tier from lifetime points
  v_new_tier := CASE
    WHEN v_lifetime >= 15000 THEN 'platinum'
    WHEN v_lifetime >= 5000  THEN 'gold'
    WHEN v_lifetime >= 1000  THEN 'silver'
    ELSE 'bronze'
  END;

  UPDATE loyalty_accounts
     SET points_balance  = points_balance + v_points,
         lifetime_points = v_lifetime,
         tier            = v_new_tier,
         updated_at      = NOW()
   WHERE id = v_account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to bookings table
DROP TRIGGER IF EXISTS trg_loyalty_auto_earn ON bookings;
CREATE TRIGGER trg_loyalty_auto_earn
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION loyalty_auto_earn_on_checkout();

-- ── 5. Helper function: enrol guest in loyalty programme ──────────────────────
-- Call: SELECT loyalty_enrol_guest('<tenant_id>', '<guest_id>');
CREATE OR REPLACE FUNCTION loyalty_enrol_guest(p_tenant_id UUID, p_guest_id UUID)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO loyalty_accounts (tenant_id, guest_id, points_balance, lifetime_points, tier)
  VALUES (p_tenant_id, p_guest_id, 0, 0, 'bronze')
  ON CONFLICT (tenant_id, guest_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM loyalty_accounts
     WHERE tenant_id = p_tenant_id AND guest_id = p_guest_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
