-- ═══════════════════════════════════════════════════════
-- TOWNSHUB PROPERTY MANAGER — DATABASE SCHEMA
-- Run in Supabase SQL Editor after hotel schema
-- ═══════════════════════════════════════════════════════

-- Add mode column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'hotel' CHECK (mode IN ('hotel','property','both'));

-- PROPERTY OWNERS (landlords)
CREATE TABLE IF NOT EXISTS property_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  id_type TEXT CHECK (id_type IN ('passport','national_id','company_reg','other')),
  id_number TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  bank_name TEXT,
  bank_iban TEXT,
  bank_swift TEXT,
  tax_number TEXT,
  vat_number TEXT,
  management_fee_rate DECIMAL(5,2) DEFAULT 10.00,
  management_fee_type TEXT DEFAULT 'percentage' CHECK (management_fee_type IN ('percentage','fixed')),
  portal_access BOOLEAN DEFAULT FALSE,
  portal_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROPERTIES (buildings or land parcels)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES property_owners(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('residential','commercial','mixed_use','land')),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT,
  country TEXT DEFAULT 'Cyprus',
  postal_code TEXT,
  total_units INTEGER DEFAULT 1,
  year_built INTEGER,
  total_area_sqm DECIMAL(10,2),
  description TEXT,
  amenities TEXT[] DEFAULT '{}',
  photos TEXT[] DEFAULT '{}',
  documents TEXT[] DEFAULT '{}',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- UNITS (individual rentable spaces)
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES property_owners(id),
  unit_number TEXT NOT NULL,
  floor INTEGER,
  type TEXT NOT NULL CHECK (type IN (
    'apartment','studio','villa','penthouse','maisonette','room',
    'office','retail','warehouse','industrial','restaurant','desk','other'
  )),
  subtype TEXT,
  area_sqm DECIMAL(8,2),
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  parking_spaces INTEGER DEFAULT 0,
  furnished TEXT DEFAULT 'unfurnished' CHECK (furnished IN ('furnished','semi_furnished','unfurnished')),
  status TEXT DEFAULT 'vacant' CHECK (status IN ('vacant','occupied','reserved','maintenance','not_available')),
  market_rent DECIMAL(10,2),
  features TEXT[] DEFAULT '{}',
  photos TEXT[] DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, property_id, unit_number)
);

-- PROPERTY TENANTS (renters)
CREATE TABLE IF NOT EXISTS property_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT,
  tenant_type TEXT DEFAULT 'individual' CHECK (tenant_type IN ('individual','company')),
  email TEXT,
  phone TEXT,
  secondary_phone TEXT,
  id_type TEXT CHECK (id_type IN ('passport','national_id','driving_licence','company_reg','other')),
  id_number TEXT,
  id_expiry DATE,
  nationality TEXT,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  country TEXT,
  employer TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  tenant_references TEXT[],
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  portal_access BOOLEAN DEFAULT FALSE,
  portal_email TEXT,
  total_properties_rented INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEASES
CREATE TABLE IF NOT EXISTS leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID REFERENCES units(id) NOT NULL,
  property_tenant_id UUID REFERENCES property_tenants(id) NOT NULL,
  owner_id UUID REFERENCES property_owners(id),
  lease_reference TEXT UNIQUE NOT NULL DEFAULT '',
  lease_type TEXT DEFAULT 'fixed_term' CHECK (lease_type IN ('fixed_term','rolling','periodic','commercial')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','expired','terminated','renewed')),
  start_date DATE NOT NULL,
  end_date DATE,
  notice_period_days INTEGER DEFAULT 30,
  monthly_rent DECIMAL(10,2) NOT NULL,
  rent_frequency TEXT DEFAULT 'monthly' CHECK (rent_frequency IN ('weekly','biweekly','monthly','quarterly','annually')),
  payment_due_day INTEGER DEFAULT 1 CHECK (payment_due_day BETWEEN 1 AND 31),
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT FALSE,
  deposit_returned BOOLEAN DEFAULT FALSE,
  deposit_return_date DATE,
  deposit_deductions DECIMAL(10,2) DEFAULT 0,
  deposit_deduction_notes TEXT,
  rent_includes_utilities BOOLEAN DEFAULT FALSE,
  rent_review_date DATE,
  rent_review_increase_rate DECIMAL(5,2),
  break_clause_date DATE,
  break_clause_notice_days INTEGER,
  guarantor_name TEXT,
  guarantor_phone TEXT,
  guarantor_email TEXT,
  special_conditions TEXT,
  internal_notes TEXT,
  document_url TEXT,
  auto_renew BOOLEAN DEFAULT FALSE,
  auto_renew_months INTEGER DEFAULT 12,
  terminated_at DATE,
  termination_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lease reference generator
CREATE OR REPLACE FUNCTION generate_lease_reference()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'LS-';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_lease_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lease_reference IS NULL OR NEW.lease_reference = '' THEN
    LOOP
      NEW.lease_reference := generate_lease_reference();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM leases WHERE lease_reference = NEW.lease_reference);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lease_reference_trigger ON leases;
CREATE TRIGGER lease_reference_trigger
  BEFORE INSERT ON leases FOR EACH ROW EXECUTE FUNCTION set_lease_reference();

-- RENT SCHEDULE
CREATE TABLE IF NOT EXISTS rent_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID REFERENCES units(id) NOT NULL,
  property_tenant_id UUID REFERENCES property_tenants(id) NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','partial','overdue','waived','cancelled')),
  paid_amount DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
  paid_date DATE,
  days_overdue INTEGER DEFAULT 0,
  late_fee DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROPERTY PAYMENTS
CREATE TABLE IF NOT EXISTS property_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  lease_id UUID REFERENCES leases(id),
  rent_schedule_id UUID REFERENCES rent_schedule(id),
  property_tenant_id UUID REFERENCES property_tenants(id),
  unit_id UUID REFERENCES units(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_type TEXT DEFAULT 'rent' CHECK (payment_type IN ('rent','deposit','utilities','maintenance_fee','late_fee','other')),
  method TEXT NOT NULL CHECK (method IN ('bank_transfer','cash','card','cheque','standing_order','stripe','other')),
  reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  receipt_url TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROPERTY INVOICES
CREATE TABLE IF NOT EXISTS property_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  lease_id UUID REFERENCES leases(id),
  property_tenant_id UUID REFERENCES property_tenants(id),
  unit_id UUID REFERENCES units(id),
  invoice_number TEXT NOT NULL,
  invoice_type TEXT DEFAULT 'rent' CHECK (invoice_type IN ('rent','deposit','utilities','service_charge','other')),
  issued_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  period_start DATE,
  period_end DATE,
  subtotal DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 0,
  vat_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','overdue','cancelled')),
  notes TEXT,
  line_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_number)
);

-- UTILITY ACCOUNTS
CREATE TABLE IF NOT EXISTS utility_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  utility_type TEXT NOT NULL CHECK (utility_type IN ('electricity','water','gas','internet','telephone','cyta','eac','other')),
  provider TEXT,
  account_number TEXT,
  meter_number TEXT,
  billing_name TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UTILITY BILLS
CREATE TABLE IF NOT EXISTS utility_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  utility_account_id UUID REFERENCES utility_accounts(id),
  unit_id UUID REFERENCES units(id),
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  reading_start DECIMAL(10,2),
  reading_end DECIMAL(10,2),
  consumption DECIMAL(10,2),
  unit_cost DECIMAL(10,4),
  amount DECIMAL(10,2) NOT NULL,
  charged_to TEXT DEFAULT 'tenant' CHECK (charged_to IN ('tenant','owner','agency')),
  lease_id UUID REFERENCES leases(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','charged','paid','disputed')),
  bill_document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROPERTY MAINTENANCE
CREATE TABLE IF NOT EXISTS property_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID REFERENCES units(id),
  property_id UUID REFERENCES properties(id),
  lease_id UUID REFERENCES leases(id),
  reported_by_type TEXT DEFAULT 'tenant' CHECK (reported_by_type IN ('tenant','owner','manager','inspection')),
  reported_by_tenant UUID REFERENCES property_tenants(id),
  reported_by_user UUID REFERENCES users(id),
  category TEXT DEFAULT 'general' CHECK (category IN ('plumbing','electrical','hvac','appliance','structural','cosmetic','security','garden','common_area','general')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent','emergency')),
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported','assessed','quoted','approved','in_progress','completed','closed','rejected')),
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  cost_responsibility TEXT DEFAULT 'owner' CHECK (cost_responsibility IN ('owner','tenant','insurance','shared')),
  contractor_name TEXT,
  contractor_phone TEXT,
  scheduled_date DATE,
  completed_date DATE,
  photos TEXT[] DEFAULT '{}',
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROPERTY INSPECTIONS
CREATE TABLE IF NOT EXISTS property_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID REFERENCES units(id) NOT NULL,
  lease_id UUID REFERENCES leases(id),
  inspection_type TEXT DEFAULT 'routine' CHECK (inspection_type IN ('move_in','move_out','routine','maintenance','emergency')),
  scheduled_date DATE,
  completed_date DATE,
  conducted_by UUID REFERENCES users(id),
  overall_condition TEXT CHECK (overall_condition IN ('excellent','good','fair','poor','critical')),
  report JSONB DEFAULT '{}',
  photos TEXT[] DEFAULT '{}',
  notes TEXT,
  tenant_signature_url TEXT,
  manager_signature_url TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OWNER STATEMENTS
CREATE TABLE IF NOT EXISTS owner_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES property_owners(id) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_rent_collected DECIMAL(10,2) DEFAULT 0,
  management_fee DECIMAL(10,2) DEFAULT 0,
  maintenance_costs DECIMAL(10,2) DEFAULT 0,
  utility_costs DECIMAL(10,2) DEFAULT 0,
  other_deductions DECIMAL(10,2) DEFAULT 0,
  net_owner_payment DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),
  payment_date DATE,
  payment_reference TEXT,
  notes TEXT,
  statement_document_url TEXT,
  line_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROPERTY DOCUMENTS
CREATE TABLE IF NOT EXISTS property_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id),
  unit_id UUID REFERENCES units(id),
  lease_id UUID REFERENCES leases(id),
  property_tenant_id UUID REFERENCES property_tenants(id),
  owner_id UUID REFERENCES property_owners(id),
  document_type TEXT NOT NULL CHECK (document_type IN (
    'lease_agreement','inventory','inspection_report','id_document',
    'proof_of_income','reference_letter','insurance','title_deed',
    'planning_permission','certificate_of_occupancy','utility_bill',
    'correspondence','other'
  )),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  expiry_date DATE,
  notes TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ARREARS LOG
CREATE TABLE IF NOT EXISTS arrears_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  lease_id UUID REFERENCES leases(id) NOT NULL,
  property_tenant_id UUID REFERENCES property_tenants(id) NOT NULL,
  unit_id UUID REFERENCES units(id) NOT NULL,
  total_arrears DECIMAL(10,2) NOT NULL,
  oldest_due_date DATE,
  action_taken TEXT,
  action_date DATE DEFAULT CURRENT_DATE,
  action_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMERCIAL LEASE TERMS
CREATE TABLE IF NOT EXISTS commercial_lease_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID UNIQUE REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  rent_review_schedule TEXT,
  service_charge_amount DECIMAL(10,2) DEFAULT 0,
  service_charge_frequency TEXT DEFAULT 'monthly',
  cam_charges DECIMAL(10,2) DEFAULT 0,
  business_rates DECIMAL(10,2) DEFAULT 0,
  permitted_use TEXT,
  subletting_allowed BOOLEAN DEFAULT FALSE,
  assignment_allowed BOOLEAN DEFAULT FALSE,
  alterations_allowed TEXT DEFAULT 'not_permitted',
  dilapidations_clause BOOLEAN DEFAULT TRUE,
  rent_free_period_months INTEGER DEFAULT 0,
  rent_deposit_months INTEGER DEFAULT 3,
  personal_guarantee_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_unit_status_on_lease()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE units SET status = 'occupied' WHERE id = NEW.unit_id;
  ELSIF NEW.status IN ('expired','terminated') THEN
    UPDATE units SET status = 'vacant' WHERE id = NEW.unit_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unit_lease_status ON leases;
CREATE TRIGGER trg_unit_lease_status
  AFTER UPDATE ON leases FOR EACH ROW EXECUTE FUNCTION update_unit_status_on_lease();

CREATE OR REPLACE FUNCTION generate_rent_schedule()
RETURNS TRIGGER AS $$
DECLARE
  loop_date DATE;
  end_loop DATE;
BEGIN
  IF NEW.status = 'active' AND OLD.status = 'draft' THEN
    loop_date := NEW.start_date;
    end_loop := LEAST(
      COALESCE(NEW.end_date, NEW.start_date + INTERVAL '12 months'),
      NEW.start_date + INTERVAL '12 months'
    );
    WHILE loop_date <= end_loop LOOP
      INSERT INTO rent_schedule (tenant_id, lease_id, unit_id, property_tenant_id, due_date, amount)
      VALUES (NEW.tenant_id, NEW.id, NEW.unit_id, NEW.property_tenant_id,
              DATE_TRUNC('month', loop_date) + (NEW.payment_due_day - 1) * INTERVAL '1 day',
              NEW.monthly_rent)
      ON CONFLICT DO NOTHING;
      loop_date := loop_date + INTERVAL '1 month';
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_rent_schedule ON leases;
CREATE TRIGGER trg_generate_rent_schedule
  AFTER UPDATE ON leases FOR EACH ROW EXECUTE FUNCTION generate_rent_schedule();

CREATE OR REPLACE FUNCTION mark_overdue_rent()
RETURNS void AS $$
BEGIN
  UPDATE rent_schedule
  SET status = 'overdue'
  WHERE status = 'pending' AND due_date < CURRENT_DATE AND balance > 0;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_properties_ts ON properties;
DROP TRIGGER IF EXISTS trg_units_ts ON units;
DROP TRIGGER IF EXISTS trg_leases_ts ON leases;
DROP TRIGGER IF EXISTS trg_rent_schedule_ts ON rent_schedule;
DROP TRIGGER IF EXISTS trg_prop_maintenance_ts ON property_maintenance;
DROP TRIGGER IF EXISTS trg_owners_ts ON property_owners;
DROP TRIGGER IF EXISTS trg_prop_tenants_ts ON property_tenants;

CREATE TRIGGER trg_properties_ts BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_units_ts BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leases_ts BEFORE UPDATE ON leases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rent_schedule_ts BEFORE UPDATE ON rent_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_prop_maintenance_ts BEFORE UPDATE ON property_maintenance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_owners_ts BEFORE UPDATE ON property_owners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_prop_tenants_ts BEFORE UPDATE ON property_tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_tenant ON units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leases_dates ON leases(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rent_schedule_tenant ON rent_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rent_schedule_lease ON rent_schedule(lease_id);
CREATE INDEX IF NOT EXISTS idx_rent_schedule_due ON rent_schedule(tenant_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_prop_payments_tenant ON property_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prop_payments_lease ON property_payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_prop_tenants_tenant ON property_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prop_owners_tenant ON property_owners(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prop_maintenance_tenant ON property_maintenance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_arrears_lease ON arrears_log(lease_id);
CREATE INDEX IF NOT EXISTS idx_documents_unit ON property_documents(unit_id);
CREATE INDEX IF NOT EXISTS idx_documents_lease ON property_documents(lease_id);

-- ═══════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════
GRANT SELECT,INSERT,UPDATE,DELETE ON property_owners TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON properties TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON units TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON property_tenants TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON leases TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON rent_schedule TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON property_payments TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON property_invoices TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON utility_accounts TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON utility_bills TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON property_maintenance TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON property_inspections TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON owner_statements TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON property_documents TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON arrears_log TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON commercial_lease_terms TO authenticated;
