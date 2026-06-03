-- ═══════════════════════════════════════════════════════════════════════════════
-- STRIPE CONNECT EXPRESS — MIGRATION
-- Run in Supabase SQL Editor.
-- Removes per-hotel Stripe key approach; adds full Connect marketplace fields.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Remove old per-hotel key columns (replaced by Connect) ─────────────────
ALTER TABLE tenants
  DROP COLUMN IF EXISTS stripe_payment_pk,
  DROP COLUMN IF EXISTS stripe_payment_sk;

ALTER TABLE invoices
  DROP COLUMN IF EXISTS stripe_session_id,
  DROP COLUMN IF EXISTS stripe_payment_url;

ALTER TABLE rent_schedule
  DROP COLUMN IF EXISTS stripe_session_id,
  DROP COLUMN IF EXISTS stripe_payment_url;

DROP INDEX IF EXISTS idx_invoices_stripe_session;
DROP INDEX IF EXISTS idx_rent_schedule_stripe_session;

-- ── 2. Stripe Connect fields on tenants (hotels) ──────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_account_id          TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connected           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_verification_status TEXT    DEFAULT 'unverified'
    CHECK (stripe_verification_status IN ('unverified','pending','verified','restricted','rejected'));

-- ── 3. Payment fields on bookings ─────────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status          TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid','partially_paid','refunded','failed')),
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session  TEXT,
  ADD COLUMN IF NOT EXISTS hotel_earning            DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS platform_commission      DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS payout_status            TEXT DEFAULT 'pending'
    CHECK (payout_status IN ('pending','held','ready','released','paid_out'));

CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(tenant_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payout_status  ON bookings(tenant_id, payout_status);

-- ── 4. Platform-level settings (commission %, etc.) ───────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description)
VALUES ('commission_pct', '10', 'Platform commission percentage (0–100) deducted from each booking')
ON CONFLICT (key) DO NOTHING;

-- ── 5. Stripe transactions ledger ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
  type        TEXT NOT NULL
              CHECK (type IN ('payment','refund','commission','transfer','payout','chargeback')),
  amount      DECIMAL(10,2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'eur',
  stripe_id   TEXT,        -- payment_intent / transfer / payout ID from Stripe
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','succeeded','failed','cancelled')),
  description TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_txn_tenant  ON stripe_transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_txn_booking ON stripe_transactions(booking_id);

ALTER TABLE stripe_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stripe_txn_tenant_policy" ON stripe_transactions
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Platform admin can see all transactions (for admin panel)
CREATE POLICY "stripe_txn_service_policy" ON stripe_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT 'tenants (Connect fields)' AS check,
       COUNT(*) FILTER (WHERE column_name LIKE 'stripe_%') AS stripe_cols
FROM information_schema.columns WHERE table_name = 'tenants'
UNION ALL
SELECT 'bookings (payment fields)',
       COUNT(*) FILTER (WHERE column_name IN ('payment_status','stripe_payment_intent_id','hotel_earning','platform_commission','payout_status'))
FROM information_schema.columns WHERE table_name = 'bookings'
UNION ALL
SELECT 'platform_settings rows', COUNT(*) FROM platform_settings
UNION ALL
SELECT 'stripe_transactions table', COUNT(*) FROM stripe_transactions;
