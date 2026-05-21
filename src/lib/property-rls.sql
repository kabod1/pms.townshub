-- ═══════════════════════════════════════════════════════
-- TOWNSHUB PROPERTY MANAGER — RLS POLICIES
-- Run after property-schema.sql
-- ═══════════════════════════════════════════════════════

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrears_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_lease_terms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to re-run)
DROP POLICY IF EXISTS "properties_all" ON properties;
DROP POLICY IF EXISTS "prop_owners_all" ON property_owners;
DROP POLICY IF EXISTS "units_all" ON units;
DROP POLICY IF EXISTS "prop_tenants_all" ON property_tenants;
DROP POLICY IF EXISTS "leases_all" ON leases;
DROP POLICY IF EXISTS "rent_schedule_all" ON rent_schedule;
DROP POLICY IF EXISTS "prop_payments_all" ON property_payments;
DROP POLICY IF EXISTS "prop_invoices_all" ON property_invoices;
DROP POLICY IF EXISTS "utility_accounts_all" ON utility_accounts;
DROP POLICY IF EXISTS "utility_bills_all" ON utility_bills;
DROP POLICY IF EXISTS "prop_maintenance_all" ON property_maintenance;
DROP POLICY IF EXISTS "prop_inspections_all" ON property_inspections;
DROP POLICY IF EXISTS "owner_statements_all" ON owner_statements;
DROP POLICY IF EXISTS "prop_documents_all" ON property_documents;
DROP POLICY IF EXISTS "arrears_all" ON arrears_log;
DROP POLICY IF EXISTS "commercial_lease_terms_all" ON commercial_lease_terms;

CREATE POLICY "properties_all" ON properties FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "prop_owners_all" ON property_owners FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "units_all" ON units FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "prop_tenants_all" ON property_tenants FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "leases_all" ON leases FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rent_schedule_all" ON rent_schedule FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "prop_payments_all" ON property_payments FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "prop_invoices_all" ON property_invoices FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "utility_accounts_all" ON utility_accounts FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "utility_bills_all" ON utility_bills FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "prop_maintenance_all" ON property_maintenance FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "prop_inspections_all" ON property_inspections FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "owner_statements_all" ON owner_statements FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "prop_documents_all" ON property_documents FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "arrears_all" ON arrears_log FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "commercial_lease_terms_all" ON commercial_lease_terms FOR ALL USING (tenant_id = get_my_tenant_id());
