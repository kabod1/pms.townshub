-- ═══════════════════════════════════════════════════════════════════════════════
-- TOWNSHUB FINANCE UPGRADE — MIGRATION
-- Run in Supabase SQL Editor.
-- Adds: per-tenant fee, double-entry ledger, owner_payouts, rent_invoices,
--       deposit trust tracking, VAT fields, expense-to-payout linking.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Per-tenant platform fee + VAT registration ─────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS platform_fee_pct  NUMERIC(5,2) DEFAULT NULL,
    -- NULL = use global platform_settings.commission_pct (default)
    -- Set per-hotel to negotiate individual rates
  ADD COLUMN IF NOT EXISTS vat_registered    BOOLEAN DEFAULT FALSE,
    -- When TRUE: TownsHub adds 19% VAT to its management fee
  ADD COLUMN IF NOT EXISTS payout_hold_days  INTEGER DEFAULT 3;
    -- Days after guest checkout before earnings are released

-- ── 2. Double-entry ledger — immutable source of financial truth ──────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_type      TEXT NOT NULL CHECK (entry_type IN (
    'booking_income',   -- guest payment received
    'rent_income',      -- monthly rent received
    'expense',          -- maintenance/operational cost
    'platform_fee',     -- TownsHub commission
    'vat_on_fee',       -- 19% VAT on platform fee (Cyprus)
    'payout',           -- transfer to hotel's Stripe account
    'deposit_in',       -- security deposit received from tenant
    'deposit_out',      -- security deposit returned to tenant
    'deposit_forfeited',-- deposit kept (damages/breach)
    'refund',           -- booking refund
    'chargeback',       -- Stripe dispute
    'adjustment'        -- manual correction
  )),
  debit           NUMERIC(12,2) NOT NULL DEFAULT 0,  -- money leaving hotel's account
  credit          NUMERIC(12,2) NOT NULL DEFAULT 0,  -- money entering hotel's account
  reference_id    UUID,           -- FK to bookings / rent_invoices / owner_payouts / leases
  reference_table TEXT,           -- table name for the reference
  description     TEXT,
  period_month    TEXT,           -- 'YYYY-MM' — for monthly P&L grouping
  created_at      TIMESTAMPTZ    DEFAULT NOW(),
  created_by      UUID            -- NULL = system/cron, else user.id
);

-- Ledger is append-only — no UPDATE or DELETE for tenant users
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_tenant_select" ON ledger_entries
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
-- INSERT/UPDATE/DELETE only via service_role (server-side code)
CREATE POLICY "ledger_service_all" ON ledger_entries
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_ledger_tenant  ON ledger_entries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_period  ON ledger_entries(tenant_id, period_month);
CREATE INDEX IF NOT EXISTS idx_ledger_ref     ON ledger_entries(reference_id) WHERE reference_id IS NOT NULL;

-- ── 3. Owner payouts — full gross/expense/fee/net breakdown ───────────────────
CREATE TABLE IF NOT EXISTS owner_payouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  gross_income      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_expenses    NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0,  -- snapshot at payout time
  platform_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_on_fee        NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_payout        NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- net_payout = gross_income − total_expenses − platform_fee − vat_on_fee
  stripe_transfer_id TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','preview','processing','paid','failed','skipped')),
  booking_ids       UUID[],        -- bookings included in this payout
  expense_ids       UUID[],        -- expenses deducted
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  paid_at           TIMESTAMPTZ
);

ALTER TABLE owner_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts_tenant_select" ON owner_payouts
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "payouts_service_all" ON owner_payouts
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_owner_payouts_tenant ON owner_payouts(tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_owner_payouts_status ON owner_payouts(status) WHERE status IN ('pending','processing');

-- ── 4. Rent invoices — monthly auto-generated per lease ───────────────────────
CREATE TABLE IF NOT EXISTS rent_invoices (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lease_id                 UUID REFERENCES leases(id) ON DELETE SET NULL,
  invoice_number           TEXT,
  period_start             DATE NOT NULL,
  period_end               DATE NOT NULL,
  due_date                 DATE NOT NULL,
  amount                   NUMERIC(12,2) NOT NULL,   -- rent amount ex-VAT
  vat_amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  overdue_fee              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_due                NUMERIC(12,2) GENERATED ALWAYS AS (amount + vat_amount + overdue_fee) STORED,
  status                   TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','waived','cancelled')),
  stripe_payment_intent_id TEXT,
  reminder_sent_at         TIMESTAMPTZ,
  overdue_marked_at        TIMESTAMPTZ,
  paid_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rent_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rent_inv_tenant" ON rent_invoices
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "rent_inv_service" ON rent_invoices
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_rent_inv_tenant ON rent_invoices(tenant_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_rent_inv_lease  ON rent_invoices(lease_id, status);
CREATE INDEX IF NOT EXISTS idx_rent_inv_due    ON rent_invoices(due_date) WHERE status = 'pending';

-- Auto-generate invoice number via trigger
CREATE OR REPLACE FUNCTION generate_rent_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'RI-[0-9]+-([0-9]+)') AS INT)), 0) + 1
    INTO seq
    FROM rent_invoices
    WHERE tenant_id = NEW.tenant_id;
  NEW.invoice_number := 'RI-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rent_invoice_number ON rent_invoices;
CREATE TRIGGER trg_rent_invoice_number
  BEFORE INSERT ON rent_invoices
  FOR EACH ROW WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_rent_invoice_number();

-- ── 5. Deposit trust tracking on leases ───────────────────────────────────────
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS deposit_trust_ref      TEXT,
    -- Stripe PaymentIntent ID or bank transfer ref for the deposit
  ADD COLUMN IF NOT EXISTS deposit_status         TEXT DEFAULT 'none'
    CHECK (deposit_status IN ('none','held','refunded','partially_refunded','forfeited')),
  ADD COLUMN IF NOT EXISTS deposit_refund_amount  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS deposit_damage_amount  NUMERIC(12,2) DEFAULT 0,
    -- Amount withheld for damages before refund
  ADD COLUMN IF NOT EXISTS deposit_refunded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_forfeited_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_notes          TEXT;

-- ── 6. Expense approval for payout deduction ──────────────────────────────────
-- Link maintenance expenses to monthly payout periods
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS expense_amount      NUMERIC(10,2),
    -- Actual cost of the maintenance work
  ADD COLUMN IF NOT EXISTS approved_for_payout BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payout_period       TEXT;
    -- 'YYYY-MM' — which payout month this expense is charged to

-- ── 7. VAT tracking on platform transactions ─────────────────────────────────
ALTER TABLE stripe_transactions
  ADD COLUMN IF NOT EXISTS vat_amount       NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_invoice_ref  TEXT;

-- ── 8. Update bookings: track which payout they belong to ────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payout_id  UUID REFERENCES owner_payouts(id) ON DELETE SET NULL;

-- ── Convenience view: monthly P&L per tenant ──────────────────────────────────
CREATE OR REPLACE VIEW ledger_monthly_summary AS
SELECT
  tenant_id,
  period_month,
  SUM(credit) FILTER (WHERE entry_type IN ('booking_income','rent_income')) AS total_income,
  SUM(debit)  FILTER (WHERE entry_type = 'expense')                          AS total_expenses,
  SUM(debit)  FILTER (WHERE entry_type IN ('platform_fee','vat_on_fee'))     AS total_fees,
  SUM(debit)  FILTER (WHERE entry_type = 'payout')                          AS total_payouts,
  SUM(credit) FILTER (WHERE entry_type = 'deposit_in')                      AS deposits_received,
  SUM(debit)  FILTER (WHERE entry_type = 'deposit_out')                     AS deposits_returned,
  SUM(credit) - SUM(debit) AS net_balance
FROM ledger_entries
GROUP BY tenant_id, period_month;

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'ledger_entries')  AS ledger_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'owner_payouts')   AS payouts_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'rent_invoices')   AS rent_inv_table,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'platform_fee_pct') AS per_tenant_fee,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'vat_registered')   AS vat_col,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'leases'  AND column_name = 'deposit_status')   AS deposit_trust;
