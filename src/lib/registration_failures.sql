-- Run this in Supabase SQL Editor
-- Write-only log of failed registration attempts, so we can diagnose
-- real-user failures from the actual client-side error instead of
-- relying on screenshots.
--
-- Inserted only via POST /api/track?action=registration-failure (rate
-- limited to 10/min per IP, fields sanitized and length-capped there) —
-- NOT directly from the browser with the anon key. RLS is enabled with
-- no policies at all, so only the service role (which the API route uses,
-- and which bypasses RLS) can write; nothing can read it except an admin
-- querying with the service role directly.

CREATE TABLE IF NOT EXISTS registration_failures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT CHECK (char_length(email) <= 320),
  step          TEXT CHECK (char_length(step) <= 50),         -- e.g. 'no_session', 'rpc'
  error_message TEXT CHECK (char_length(error_message) <= 2000),
  user_agent    TEXT CHECK (char_length(user_agent) <= 500),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE registration_failures ENABLE ROW LEVEL SECURITY;

-- Drop the original wide-open anon-insert policy if it was already created
-- by an earlier version of this file — writes now go through the rate
-- limited /api/track endpoint using the service role instead.
DROP POLICY IF EXISTS "anon can log failures" ON registration_failures;
-- No policies remain — RLS default-denies everyone except the service role.
