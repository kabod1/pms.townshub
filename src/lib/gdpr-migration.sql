-- GDPR compliance migration
-- Run once in Supabase SQL Editor

-- Add marketing consent fields to guests
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS marketing_consent      BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_consent_date TIMESTAMPTZ;

-- Update any NULL values so the column is consistently set
UPDATE guests SET marketing_consent = FALSE WHERE marketing_consent IS NULL;

-- Add data retention setting to tenants (default 84 months = 7 years, matching EU financial record requirements)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS data_retention_months INTEGER DEFAULT 84;
