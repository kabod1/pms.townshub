-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — MULTI-TENANT ISOLATION
-- Each hotel can ONLY see and modify their own data
-- Run this AFTER schema.sql
-- ═══════════════════════════════════════════════════════

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Get current user's tenant
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- TENANTS
CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (id = get_my_tenant_id());
CREATE POLICY "tenants_update" ON tenants FOR UPDATE USING (id = get_my_tenant_id() AND get_my_role() = 'admin');

-- USERS
CREATE POLICY "users_select" ON users FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'admin');
CREATE POLICY "users_update" ON users FOR UPDATE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'admin');

-- ROOMS
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() IN ('admin','manager'));
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rooms_delete" ON rooms FOR DELETE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'admin');

-- ALL OTHER TABLES: tenant-scoped access
CREATE POLICY "room_types_all" ON room_types FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "guests_all" ON guests FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "bookings_all" ON bookings FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "booking_extras_all" ON booking_extras FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "payments_all" ON payments FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "invoices_all" ON invoices FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "housekeeping_all" ON housekeeping_tasks FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "packages_all" ON packages FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "promotions_all" ON promotions FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rate_plans_all" ON rate_plans FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "seasonal_rates_all" ON seasonal_rates FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "audit_log_all" ON audit_log FOR ALL USING (tenant_id = get_my_tenant_id());
