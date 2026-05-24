-- ═══════════════════════════════════════════════════════
-- Visitor Analytics — Page Views Table
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS page_views (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  path         TEXT NOT NULL,
  referrer     TEXT,
  browser      TEXT,
  device_type  TEXT,
  session_id   TEXT NOT NULL,
  -- Geolocation (populated server-side via Vercel headers)
  country      TEXT,           -- ISO 3166-1 alpha-2 code, e.g. "CY"
  country_name TEXT,           -- Region/state, e.g. "Nicosia"
  city         TEXT,           -- e.g. "Limassol"
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  flag         TEXT,           -- emoji flag, e.g. "🇨🇾"
  viewed_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Service role inserts (api/track.ts uses service role key)
CREATE POLICY "Service role inserts page views"
  ON page_views FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users can also insert their own (fallback direct insert)
CREATE POLICY "Users can insert page views"
  ON page_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Super admin / service role can read all
CREATE POLICY "Service role reads all page views"
  ON page_views FOR SELECT
  TO service_role
  USING (true);

-- Indexes for fast admin queries
CREATE INDEX IF NOT EXISTS idx_page_views_time     ON page_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_tenant   ON page_views(tenant_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session  ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_path     ON page_views(path, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_country  ON page_views(country, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_city     ON page_views(city, viewed_at DESC);

-- ── If the table already exists, run these ALTERs to add location columns ──
-- ALTER TABLE page_views ADD COLUMN IF NOT EXISTS country      TEXT;
-- ALTER TABLE page_views ADD COLUMN IF NOT EXISTS country_name TEXT;
-- ALTER TABLE page_views ADD COLUMN IF NOT EXISTS city         TEXT;
-- ALTER TABLE page_views ADD COLUMN IF NOT EXISTS latitude     DOUBLE PRECISION;
-- ALTER TABLE page_views ADD COLUMN IF NOT EXISTS longitude    DOUBLE PRECISION;
-- ALTER TABLE page_views ADD COLUMN IF NOT EXISTS flag         TEXT;

-- Auto-purge rows older than 90 days (optional — run as a scheduled Supabase edge function)
-- DELETE FROM page_views WHERE viewed_at < NOW() - INTERVAL '90 days';
