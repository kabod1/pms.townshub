-- ═══════════════════════════════════════════════════════
-- Push Subscriptions Table
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (user_id = auth.uid());

-- Service role can read all (for server-side sending)
CREATE POLICY "Service role reads all push subscriptions"
  ON push_subscriptions
  FOR SELECT
  TO service_role
  USING (true);

-- Index for fast lookup by tenant when broadcasting
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user   ON push_subscriptions(user_id);
