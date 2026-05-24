-- ═══════════════════════════════════════════════════════
-- Staff Shifts Table
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS staff_shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time   TIME NOT NULL DEFAULT '16:00',
  shift_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (shift_type IN ('morning','afternoon','night','regular','off')),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, shift_date)
);

ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;

-- Read / update / delete: must belong to my tenant
CREATE POLICY "staff_shifts_select" ON staff_shifts
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "staff_shifts_insert" ON staff_shifts
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "staff_shifts_update" ON staff_shifts
  FOR UPDATE USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "staff_shifts_delete" ON staff_shifts
  FOR DELETE USING (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_staff_shifts_tenant_date
  ON staff_shifts(tenant_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_user
  ON staff_shifts(user_id, shift_date);
