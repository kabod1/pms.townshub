-- ═══════════════════════════════════════════════════════════════════════════════
-- SURVEYS — MIGRATION
-- Run in Supabase SQL Editor AFTER schema.sql
-- Adds: survey_templates, survey_questions, survey_responses,
--       survey_triggers (auto-send after checkout), and RLS.
-- The existing `surveys` table holds simple NPS/star responses; this migration
-- adds a full template engine while keeping the public survey flow intact.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Survey templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS survey_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  is_default  BOOLEAN DEFAULT FALSE,  -- one default template per tenant
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_templates_tenant ON survey_templates(tenant_id);

ALTER TABLE survey_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "survey_templates_tenant_policy" ON survey_templates;
CREATE POLICY "survey_templates_tenant_policy" ON survey_templates
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ── 2. Survey questions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS survey_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES survey_templates(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'rating'
               CHECK (type IN ('rating', 'nps', 'text', 'boolean', 'choice')),
  options      TEXT[] DEFAULT '{}',   -- for 'choice' type
  required     BOOLEAN DEFAULT TRUE,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_template ON survey_questions(template_id);

ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "survey_questions_tenant_policy" ON survey_questions;
CREATE POLICY "survey_questions_tenant_policy" ON survey_questions
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ── 3. Survey responses (structured, per question) ────────────────────────────
-- Complements the simple `surveys` table — stores per-question answers.
CREATE TABLE IF NOT EXISTS survey_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id   UUID REFERENCES surveys(id) ON DELETE CASCADE,  -- link to existing surveys row
  question_id UUID REFERENCES survey_questions(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
  guest_id    UUID REFERENCES guests(id) ON DELETE SET NULL,
  answer_text TEXT,
  answer_num  DECIMAL(5,2),  -- for rating / nps answers
  answer_bool BOOLEAN,        -- for yes/no answers
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_tenant   ON survey_responses(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_question ON survey_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_booking  ON survey_responses(booking_id);

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "survey_responses_tenant_policy" ON survey_responses;
CREATE POLICY "survey_responses_tenant_policy" ON survey_responses
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ── 4. Survey triggers (auto-send after checkout) ─────────────────────────────
CREATE TABLE IF NOT EXISTS survey_triggers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  guest_id      UUID REFERENCES guests(id) ON DELETE SET NULL,
  template_id   UUID REFERENCES survey_templates(id) ON DELETE SET NULL,
  survey_link   TEXT NOT NULL,          -- e.g. /survey/HTL-001234
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'completed', 'skipped')),
  scheduled_at  TIMESTAMPTZ DEFAULT NOW(),
  sent_at       TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id)  -- one trigger per booking
);

CREATE INDEX IF NOT EXISTS idx_survey_triggers_tenant ON survey_triggers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_survey_triggers_booking ON survey_triggers(booking_id);

ALTER TABLE survey_triggers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "survey_triggers_tenant_policy" ON survey_triggers;
CREATE POLICY "survey_triggers_tenant_policy" ON survey_triggers
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ── 5. Auto-create survey trigger on checkout ─────────────────────────────────
CREATE OR REPLACE FUNCTION survey_auto_trigger_on_checkout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> 'checked_out' OR OLD.status = 'checked_out' THEN
    RETURN NEW;
  END IF;

  -- Upsert so reruns are idempotent
  INSERT INTO survey_triggers (
    tenant_id, booking_id, guest_id, survey_link, status, scheduled_at
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    NEW.guest_id,
    '/survey/' || NEW.booking_reference,
    'pending',
    NOW() + INTERVAL '2 hours'  -- send 2 hours after checkout
  )
  ON CONFLICT (booking_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_survey_auto_trigger ON bookings;
CREATE TRIGGER trg_survey_auto_trigger
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION survey_auto_trigger_on_checkout();

-- ── 6. Analytics helper view: avg rating per question ─────────────────────────
CREATE OR REPLACE VIEW survey_question_analytics AS
SELECT
  sr.question_id,
  sq.question,
  sq.type,
  sq.template_id,
  sr.tenant_id,
  COUNT(*)                              AS response_count,
  AVG(sr.answer_num)                    AS avg_score,
  MIN(sr.answer_num)                    AS min_score,
  MAX(sr.answer_num)                    AS max_score
FROM survey_responses sr
JOIN survey_questions sq ON sq.id = sr.question_id
WHERE sr.answer_num IS NOT NULL
GROUP BY sr.question_id, sq.question, sq.type, sq.template_id, sr.tenant_id;

-- ── 7. Mark trigger as completed when survey is submitted ─────────────────────
CREATE OR REPLACE FUNCTION survey_mark_trigger_completed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE survey_triggers
     SET status       = 'completed',
         completed_at = NOW()
   WHERE booking_id = NEW.booking_id
     AND status     <> 'completed';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_survey_mark_completed ON surveys;
CREATE TRIGGER trg_survey_mark_completed
  AFTER INSERT ON surveys
  FOR EACH ROW
  WHEN (NEW.booking_id IS NOT NULL)
  EXECUTE FUNCTION survey_mark_trigger_completed();
