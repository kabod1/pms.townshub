-- Run this in Supabase SQL Editor
-- Write-only log of failed registration attempts, so we can diagnose
-- real-user failures from the actual client-side error instead of
-- relying on screenshots.

CREATE TABLE IF NOT EXISTS registration_failures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT,
  step          TEXT,        -- e.g. 'signup', 'no_session', 'rpc'
  error_message TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ  DEFAULT now()
);

ALTER TABLE registration_failures ENABLE ROW LEVEL SECURITY;

-- Anonymous clients can insert (needed — this fires before a session/tenant
-- exists) but cannot read. Reading is admin-only via the service role.
CREATE POLICY "anon can log failures" ON registration_failures
  FOR INSERT TO anon
  WITH CHECK (true);
