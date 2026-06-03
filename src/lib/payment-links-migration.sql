-- ═══════════════════════════════════════════════════════════════════════════════
-- GUEST & TENANT PAYMENT LINKS — MIGRATION
-- Run in Supabase SQL Editor.
-- Adds per-hotel Stripe keys + Stripe session tracking on invoices and rent.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Per-hotel Stripe payment keys ─────────────────────────────────────────
-- Each hotel enters their OWN Stripe publishable + secret key in Settings.
-- Money from guests/tenants flows directly to the hotel's Stripe account.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_payment_pk  TEXT,   -- pk_live_... or pk_test_...
  ADD COLUMN IF NOT EXISTS stripe_payment_sk  TEXT;   -- sk_live_... or sk_test_...

-- ── 2. Track Stripe Checkout sessions on invoices ─────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_session_id   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_url  TEXT;  -- cached URL for re-sharing

-- ── 3. Track Stripe Checkout sessions on rent schedule rows ──────────────────
ALTER TABLE rent_schedule
  ADD COLUMN IF NOT EXISTS stripe_session_id   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_url  TEXT;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_session
  ON invoices(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rent_schedule_stripe_session
  ON rent_schedule(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('tenants', 'invoices', 'rent_schedule')
  AND column_name LIKE 'stripe_%'
ORDER BY table_name, column_name;
