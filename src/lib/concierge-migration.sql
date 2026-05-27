-- ═══════════════════════════════════════════════════════════════════════════════
-- CONCIERGE — MIGRATION
-- Run in Supabase SQL Editor AFTER schema.sql
-- Adds: concierge_requests (guest service requests with status tracking),
--       concierge_services (bookable services: tours, transfers, spa, etc.),
--       and public RLS policy so guests can submit requests via the chat/widget.
-- The core concierge_categories + concierge_items tables exist in schema.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Bookable concierge services (tours, transfers, spa, restaurant) ─────────
-- Distinct from concierge_items (informational guide) — these have pricing
-- and can be requested/booked by guests.
CREATE TABLE IF NOT EXISTS concierge_services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES concierge_categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2),
  price_unit    TEXT DEFAULT 'per person'
                CHECK (price_unit IN ('per person', 'per group', 'per booking', 'included', 'on request')),
  duration_minutes INTEGER,
  max_capacity  INTEGER,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concierge_services_tenant ON concierge_services(tenant_id, is_active);

ALTER TABLE concierge_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "concierge_services_tenant_policy" ON concierge_services;
CREATE POLICY "concierge_services_tenant_policy" ON concierge_services
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ── 2. Guest concierge requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concierge_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id    UUID REFERENCES bookings(id) ON DELETE SET NULL,
  guest_id      UUID REFERENCES guests(id) ON DELETE SET NULL,
  service_id    UUID REFERENCES concierge_services(id) ON DELETE SET NULL,
  item_id       UUID REFERENCES concierge_items(id) ON DELETE SET NULL,
  -- Free-text request (e.g. from guest chat or widget)
  request_type  TEXT NOT NULL DEFAULT 'general'
                CHECK (request_type IN ('general', 'tour', 'transfer', 'spa', 'restaurant', 'transport', 'other')),
  title         TEXT NOT NULL,
  details       TEXT,
  preferred_date DATE,
  preferred_time TEXT,
  guests_count  INTEGER DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  assigned_to   UUID REFERENCES users(id) ON DELETE SET NULL,
  staff_notes   TEXT,
  price_quoted  DECIMAL(10,2),
  confirmed_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concierge_requests_tenant  ON concierge_requests(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_requests_booking ON concierge_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_concierge_requests_guest   ON concierge_requests(guest_id);

ALTER TABLE concierge_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "concierge_requests_tenant_policy" ON concierge_requests;
CREATE POLICY "concierge_requests_tenant_policy" ON concierge_requests
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Allow guests (anonymous / public) to INSERT requests via public widget
-- (Only INSERT allowed — they cannot read other guests' requests)
DROP POLICY IF EXISTS "concierge_requests_public_insert" ON concierge_requests;
CREATE POLICY "concierge_requests_public_insert" ON concierge_requests
  FOR INSERT WITH CHECK (true);

-- ── 3. Updated_at triggers ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_concierge_services_updated_at ON concierge_services;
CREATE TRIGGER trg_concierge_services_updated_at
  BEFORE UPDATE ON concierge_services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_concierge_requests_updated_at ON concierge_requests;
CREATE TRIGGER trg_concierge_requests_updated_at
  BEFORE UPDATE ON concierge_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. Status transition helper ───────────────────────────────────────────────
-- Automatically timestamps status changes
CREATE OR REPLACE FUNCTION concierge_request_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
    NEW.confirmed_at = NOW();
  END IF;
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    NEW.cancelled_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_concierge_request_timestamps ON concierge_requests;
CREATE TRIGGER trg_concierge_request_timestamps
  BEFORE UPDATE OF status ON concierge_requests
  FOR EACH ROW EXECUTE FUNCTION concierge_request_status_timestamps();

-- ── 5. Summary view ───────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW concierge_requests_summary AS
SELECT
  cr.tenant_id,
  cr.status,
  cr.request_type,
  COUNT(*) AS count
FROM concierge_requests cr
GROUP BY cr.tenant_id, cr.status, cr.request_type;
