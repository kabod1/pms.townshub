-- ═══════════════════════════════════════════════════════
-- CHANNEL CONFIGS — run in Supabase SQL Editor
-- Stores OTA credentials (SiteMinder, Booking.com, etc.)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS channel_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL,  -- 'siteminder' | 'booking_com' | 'expedia' | 'airbnb' | 'ical'
  credentials  JSONB NOT NULL DEFAULT '{}',
  property_id  TEXT,           -- channel-specific property identifier
  webhook_secret TEXT,         -- used to verify inbound webhook signatures
  is_active    BOOLEAN DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, channel)
);

ALTER TABLE channel_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_configs_tenant_isolation" ON channel_configs
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "channel_configs_insert" ON channel_configs
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "channel_configs_update" ON channel_configs
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
