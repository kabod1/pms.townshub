# TOWNSHUB PMS — COMPLETE BUILD SPECIFICATION
# ═══════════════════════════════════════════════════════════════
# DROP THIS FILE INTO GOOGLE ANTIGRAVITY AS YOUR SINGLE PROMPT.
# IT CONTAINS THE FULL SPECIFICATION FOR EVERY FEATURE.
# BUILD EVERYTHING. DO NOT STOP UNTIL EVERY SECTION IS COMPLETE.
# ═══════════════════════════════════════════════════════════════

## IDENTITY

- Company: Townshub Limited (HE 481530)
- Product: Cloud-based Hotel Property Management System
- Contact: admin@townshub.cy | +357 96 186 440
- Address: 19 Katsoni, Nicosia, Cyprus
- Website: townshub.cy

## TECH STACK (NON-NEGOTIABLE)

- React 18 + Vite + TypeScript (strict mode)
- Tailwind CSS with custom brand palette
- Supabase (PostgreSQL + Auth + Row Level Security + Realtime)
- Stripe (subscription billing via webhooks)
- Zustand (client state)
- @tanstack/react-query (server state / data fetching)
- react-router-dom v6 (routing)
- react-hook-form + zod (forms + validation)
- lucide-react (icons)
- date-fns (date formatting)
- react-hot-toast (notifications)
- Deployed on Vercel

## BRAND PALETTE (use these as Tailwind custom colours)

```
navy:    #0B1F4B   — sidebar, headers, primary backgrounds
gold:    #C9A84C   — accents, CTAs, active highlights
blue:    #1A5CB5   — links, secondary actions, hover states
light:   #EFF4FB   — card backgrounds, subtle fills
gray:    #F5F7FA   — table alternating rows, input backgrounds
white:   #FFFFFF   — content areas, cards
text:    #1C1C2E   — body text
subtext: #4A5568   — labels, secondary text
mid:     #D0DCF0   — borders, dividers
success: #1B5E20   — confirmed, success states
danger:  #B71C1C   — cancelled, errors, danger
warning: #E65100   — warnings, partial states
```

---

# ═══════════════════════════════════════════════════════════════
# SECTION 1: DATABASE SCHEMA
# Run this as a SINGLE SQL block in Supabase SQL Editor
# ═══════════════════════════════════════════════════════════════

Create file: `src/lib/schema.sql`

```sql
-- TENANTS (each hotel = one tenant)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Cyprus',
  logo_url TEXT,
  registration_number TEXT,
  vat_number TEXT,
  vat_rate DECIMAL(5,2) DEFAULT 19.00,
  currency TEXT DEFAULT 'EUR',
  timezone TEXT DEFAULT 'Asia/Nicosia',
  check_in_time TIME DEFAULT '14:00',
  check_out_time TIME DEFAULT '11:00',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_tier TEXT CHECK (subscription_tier IN ('essential','professional','enterprise')),
  subscription_status TEXT DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- USERS (staff linked to a tenant)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','front_desk','housekeeping','manager')),
  is_active BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROOM TYPES
CREATE TABLE room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_occupancy INTEGER NOT NULL DEFAULT 2,
  max_children INTEGER DEFAULT 1,
  bed_type TEXT,
  size_sqm DECIMAL(6,1),
  amenities TEXT[] DEFAULT '{}',
  photos TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROOMS
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  room_type_id UUID REFERENCES room_types(id),
  number TEXT NOT NULL,
  floor INTEGER,
  status TEXT DEFAULT 'vacant_clean'
    CHECK (status IN ('vacant_clean','vacant_dirty','occupied','maintenance','out_of_order')),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, number)
);

-- GUESTS
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  id_type TEXT CHECK (id_type IN ('passport','national_id','driving_licence','other')),
  id_number TEXT,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  country TEXT,
  postal_code TEXT,
  company_name TEXT,
  notes TEXT,
  vip_status TEXT DEFAULT 'regular' CHECK (vip_status IN ('regular','silver','gold','platinum')),
  total_stays INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RATE PLANS
CREATE TABLE rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_modifier DECIMAL(5,2) DEFAULT 0,
  modifier_type TEXT DEFAULT 'fixed' CHECK (modifier_type IN ('fixed','percentage')),
  meal_plan TEXT DEFAULT 'room_only' CHECK (meal_plan IN ('room_only','breakfast','half_board','full_board','all_inclusive')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEASONAL RATES
CREATE TABLE seasonal_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_override DECIMAL(10,2) NOT NULL,
  min_nights INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOOKINGS
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  booking_reference TEXT UNIQUE NOT NULL,
  guest_id UUID REFERENCES guests(id),
  room_id UUID REFERENCES rooms(id),
  room_type_id UUID REFERENCES room_types(id),
  rate_plan_id UUID REFERENCES rate_plans(id),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  actual_check_in TIMESTAMPTZ,
  actual_check_out TIMESTAMPTZ,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  status TEXT DEFAULT 'confirmed'
    CHECK (status IN ('pending','confirmed','checked_in','checked_out','cancelled','no_show')),
  source TEXT DEFAULT 'direct'
    CHECK (source IN ('direct','booking_com','expedia','airbnb','phone','walk_in','website','agent','other')),
  room_rate DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  special_requests TEXT,
  internal_notes TEXT,
  guest_comments TEXT,
  pre_checkin_completed BOOLEAN DEFAULT FALSE,
  pre_checkin_token TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOOKING EXTRAS (add-ons charged to folio)
CREATE TABLE booking_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'other' CHECK (category IN ('room_service','minibar','laundry','transport','activity','meal','other')),
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  charged_at TIMESTAMPTZ DEFAULT NOW(),
  charged_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENTS
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash','card','bank_transfer','stripe','cheque','other')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','refunded','failed','voided')),
  reference TEXT,
  stripe_payment_id TEXT,
  notes TEXT,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INVOICES
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id),
  invoice_number TEXT NOT NULL,
  issued_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 19,
  vat_amount DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','cancelled','overdue')),
  notes TEXT,
  line_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_number)
);

-- INVOICE SEQUENCE per tenant
CREATE TABLE invoice_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  current_number INTEGER DEFAULT 0,
  prefix TEXT DEFAULT 'INV'
);

-- HOUSEKEEPING TASKS
CREATE TABLE housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id),
  type TEXT NOT NULL CHECK (type IN ('checkout_clean','stayover_clean','deep_clean','maintenance','inspection','turndown')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped','blocked')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to UUID REFERENCES users(id),
  notes TEXT,
  checklist JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MAINTENANCE REQUESTS
CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id),
  reported_by UUID REFERENCES users(id),
  category TEXT DEFAULT 'general' CHECK (category IN ('plumbing','electrical','hvac','furniture','appliance','structural','general')),
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','completed','closed')),
  assigned_to TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PACKAGES
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  includes TEXT[] DEFAULT '{}',
  room_type_ids UUID[] DEFAULT '{}',
  valid_from DATE,
  valid_to DATE,
  min_nights INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROMOTIONS
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  applies_to TEXT DEFAULT 'room' CHECK (applies_to IN ('room','total','extras')),
  valid_from DATE,
  valid_to DATE,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  min_nights INTEGER DEFAULT 1,
  min_amount DECIMAL(10,2) DEFAULT 0,
  room_type_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- GIFT VOUCHERS (Professional tier)
CREATE TABLE gift_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  remaining_value DECIMAL(10,2) NOT NULL,
  purchaser_name TEXT,
  purchaser_email TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  message TEXT,
  expires_at DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','redeemed','expired','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GUEST COMMUNICATIONS LOG (Professional tier)
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  guest_id UUID REFERENCES guests(id),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp','phone','in_person')),
  direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
  type TEXT DEFAULT 'general' CHECK (type IN ('confirmation','pre_arrival','welcome','checkout','post_stay','survey','marketing','general')),
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('draft','scheduled','sent','delivered','failed','opened')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GUEST SURVEYS (Professional tier)
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  guest_id UUID REFERENCES guests(id),
  nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
  cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
  location_rating INTEGER CHECK (location_rating >= 1 AND location_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  comments TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOG
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════

-- Booking reference: TH-XXXXXX
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'TH-';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_booking_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_reference IS NULL OR NEW.booking_reference = '' THEN
    LOOP
      NEW.booking_reference := generate_booking_reference();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM bookings WHERE booking_reference = NEW.booking_reference);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_reference_trigger
  BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION set_booking_reference();

-- Invoice number auto-increment per tenant
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  seq RECORD;
  new_num INTEGER;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    INSERT INTO invoice_sequences (tenant_id, current_number, prefix)
    VALUES (NEW.tenant_id, 0, 'INV')
    ON CONFLICT (tenant_id) DO NOTHING;

    UPDATE invoice_sequences SET current_number = current_number + 1
    WHERE tenant_id = NEW.tenant_id
    RETURNING current_number, prefix INTO seq;

    NEW.invoice_number := seq.prefix || '-' || LPAD(seq.current_number::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_number_trigger
  BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_ts BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_ts BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rooms_ts BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_guests_ts BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bookings_ts BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_housekeeping_ts BEFORE UPDATE ON housekeeping_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_maintenance_ts BEFORE UPDATE ON maintenance_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create housekeeping task on checkout
CREATE OR REPLACE FUNCTION auto_create_housekeeping_task()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'checked_out' AND OLD.status = 'checked_in' AND NEW.room_id IS NOT NULL THEN
    INSERT INTO housekeeping_tasks (tenant_id, room_id, booking_id, type, priority)
    VALUES (NEW.tenant_id, NEW.room_id, NEW.id, 'checkout_clean', 'high');
    UPDATE rooms SET status = 'vacant_dirty' WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_housekeeping
  AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION auto_create_housekeeping_task();

-- Auto-update room status on check-in
CREATE OR REPLACE FUNCTION auto_room_checkin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'checked_in' AND OLD.status != 'checked_in' AND NEW.room_id IS NOT NULL THEN
    UPDATE rooms SET status = 'occupied' WHERE id = NEW.room_id;
    NEW.actual_check_in = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_room_checkin
  BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION auto_room_checkin();

-- Auto-update guest stay count
CREATE OR REPLACE FUNCTION update_guest_stay_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'checked_out' AND OLD.status = 'checked_in' THEN
    UPDATE guests SET
      total_stays = total_stays + 1,
      total_spent = total_spent + NEW.total_amount
    WHERE id = NEW.guest_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guest_stays
  AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_guest_stay_count();

-- INDEXES
CREATE INDEX idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX idx_bookings_dates ON bookings(tenant_id, check_in_date, check_out_date);
CREATE INDEX idx_bookings_status ON bookings(tenant_id, status);
CREATE INDEX idx_bookings_guest ON bookings(guest_id);
CREATE INDEX idx_bookings_room ON bookings(room_id);
CREATE INDEX idx_bookings_ref ON bookings(booking_reference);
CREATE INDEX idx_rooms_tenant ON rooms(tenant_id);
CREATE INDEX idx_rooms_status ON rooms(tenant_id, status);
CREATE INDEX idx_guests_tenant ON guests(tenant_id);
CREATE INDEX idx_guests_name ON guests(tenant_id, last_name, first_name);
CREATE INDEX idx_guests_email ON guests(tenant_id, email);
CREATE INDEX idx_housekeeping_tenant ON housekeeping_tasks(tenant_id, status);
CREATE INDEX idx_housekeeping_room ON housekeeping_tasks(room_id);
CREATE INDEX idx_maintenance_tenant ON maintenance_requests(tenant_id, status);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at);
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_booking ON invoices(booking_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_seasonal_rates ON seasonal_rates(tenant_id, room_type_id, start_date, end_date);
CREATE INDEX idx_communications_booking ON communications(booking_id);
CREATE INDEX idx_surveys_booking ON surveys(booking_id);
CREATE INDEX idx_vouchers_code ON gift_vouchers(code);
```

---

# ═══════════════════════════════════════════════════════════════
# SECTION 2: ROW LEVEL SECURITY
# Run AFTER the schema above
# ═══════════════════════════════════════════════════════════════

Create file: `src/lib/rls.sql`

```sql
-- Enable RLS on ALL tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Tenant-scoped policies for ALL tables
CREATE POLICY "tenants_sel" ON tenants FOR SELECT USING (id = get_my_tenant_id());
CREATE POLICY "tenants_upd" ON tenants FOR UPDATE USING (id = get_my_tenant_id() AND get_my_role() = 'admin');
CREATE POLICY "users_all" ON users FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rooms_all" ON rooms FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "room_types_all" ON room_types FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "guests_all" ON guests FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "bookings_all" ON bookings FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "extras_all" ON booking_extras FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "payments_all" ON payments FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "invoices_all" ON invoices FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "inv_seq_all" ON invoice_sequences FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "hk_all" ON housekeeping_tasks FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "maint_all" ON maintenance_requests FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "packages_all" ON packages FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "promos_all" ON promotions FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rates_all" ON rate_plans FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "seasonal_all" ON seasonal_rates FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "vouchers_all" ON gift_vouchers FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "comms_all" ON communications FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "surveys_all" ON surveys FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "audit_all" ON audit_log FOR ALL USING (tenant_id = get_my_tenant_id());
```

---

# ═══════════════════════════════════════════════════════════════
# SECTION 3: COMPLETE FEATURE SPECIFICATION
# Build ALL of these. Every page, every component, every hook.
# ═══════════════════════════════════════════════════════════════

## 3.1 AUTH SYSTEM

### Login Page (`/login`)
- Email + password form with zod validation
- Show/hide password toggle
- "Forgot password?" link
- Loading spinner on submit
- Error toast on failure
- Redirect to /dashboard on success
- Auto-redirect if already logged in

### Registration / Hotel Onboarding (`/register`)
- Step 1: Hotel details (name, address, city, country, VAT number)
- Step 2: Admin account (name, email, password)
- Step 3: Choose subscription tier (show 3 pricing cards)
- Step 4: Stripe Checkout redirect for payment
- On success: create tenant + admin user + redirect to /dashboard
- Generate slug from hotel name automatically

### Forgot Password (`/forgot-password`)
- Email input → Supabase reset email
- Success message with "check your email"

### Auth Store (Zustand)
- user: Supabase auth user
- profile: our users table row
- tenant: our tenants table row
- isLoading, isInitialized
- signIn(email, password)
- signOut()
- initialize() — runs on app start, loads session

### Permissions System
```
admin:       full access to everything
manager:     everything except user management and billing settings
front_desk:  bookings, guests, rooms (view+update), invoices, payments
housekeeping: housekeeping board only, room status updates only
```

### Protected Route Component
- Checks auth, redirects to /login if not logged in
- Optional role check for admin-only routes
- Shows full-page loading spinner while checking session

---

## 3.2 DASHBOARD LAYOUT

### Sidebar Navigation (left side, collapsible)
- Townshub logo at top
- Hotel name below logo
- Nav items with lucide icons:
  - Dashboard (LayoutDashboard)
  - Bookings (CalendarDays)
  - Rooms (DoorOpen)
  - Guests (Users)
  - Housekeeping (Sparkles)
  - Maintenance (Wrench) — Professional+
  - Invoices (FileText)
  - Reports (BarChart3)
  - Settings (Settings) — admin only
- Active state: gold left border + gold text
- Collapsed state: icons only, tooltip on hover
- Mobile: hamburger toggle, slide-over drawer
- Role-based hiding: housekeeping role only sees Housekeeping

### Top Header Bar
- Page title (dynamic per route)
- Search bar (global search bookings/guests/rooms)
- Notification bell icon
- User avatar + dropdown (Profile, Settings, Sign Out)
- Breadcrumbs on inner pages

---

## 3.3 DASHBOARD PAGE (`/dashboard`)

### KPI Cards Row (4 cards)
- Today's Arrivals (count of bookings with check_in_date = today, status = confirmed)
- Today's Departures (count with check_out_date = today, status = checked_in)
- Current Occupancy % (occupied rooms / total active rooms × 100)
- Revenue Today (sum of payments.amount where processed_at = today)

### Quick Actions Row
- New Booking (button → /bookings/new)
- Check In Guest (button → modal with today's arrivals list)
- View Housekeeping (button → /housekeeping)

### Today's Activity Panel
- Left: Arrivals list (guest name, room, time, check-in button)
- Right: Departures list (guest name, room, balance, check-out button)

### Recent Bookings Table
- Last 10 bookings
- Columns: Reference, Guest, Room, Check-in, Check-out, Status, Amount
- Click row → /bookings/:id

### Room Status Overview (visual grid)
- Small coloured squares for each room
- Green = vacant clean, Yellow = vacant dirty, Red = occupied, Gray = maintenance
- Click room → quick status change modal

### Occupancy Chart (7-day)
- Simple bar chart showing occupancy % for past 7 days
- Use recharts or chart.js

---

## 3.4 BOOKINGS MODULE

### Bookings List Page (`/bookings`)
- Filterable table:
  - Search by reference, guest name, room number
  - Filter by status (all, confirmed, checked_in, checked_out, cancelled)
  - Filter by date range
  - Filter by source (direct, booking_com, etc.)
- Sortable columns: check-in date, guest name, amount, status
- Pagination (20 per page)
- "New Booking" button top right
- Export to CSV button

### New Booking Page (`/bookings/new`)
- Step 1: Dates — check-in date, check-out date, adults, children
  - Show available rooms for selected dates (query rooms not booked for those dates)
- Step 2: Room Selection — pick from available rooms, show price per night
  - Apply seasonal rate if applicable
  - Apply promotion code (optional)
- Step 3: Guest — search existing guests or create new
  - Autocomplete by name/email/phone
  - Quick-create form if new guest
- Step 4: Summary — line items, total, deposit required, special requests
- Step 5: Confirm — create booking, show confirmation with reference number
- Send confirmation email automatically

### Booking Detail Page (`/bookings/:id`)
- Header: Reference, Status badge, Guest name, Room number
- Action buttons (context-dependent):
  - Check In (if confirmed + today's date)
  - Check Out (if checked_in)
  - Cancel Booking (if not checked_out)
  - Print Invoice
  - Send Email to Guest
- Left panel: Booking details
  - Dates, nights, room, rate, source
  - Guest info (linked to guest profile)
  - Special requests
  - Internal notes (editable)
- Right panel: Financial
  - Room charges (nightly breakdown)
  - Extras / add-ons (with "Add Extra" button)
  - Payments received (with "Record Payment" button)
  - Balance due (highlighted if > 0)
  - Invoice link
- Timeline: audit log of all changes to this booking

### Booking Calendar View (`/bookings/calendar`)
- Monthly grid view
- Rooms as rows, dates as columns
- Booking bars showing guest name across date range
- Colour coded by status
- Click empty cell → new booking for that room+date
- Click booking bar → booking detail
- Drag to extend (stretch check-out date)

---

## 3.5 ROOMS MODULE

### Room Management Page (`/rooms`)
- Two views: Grid view (visual cards) and Table view (data table)
- Grid view: card per room showing number, type, status, floor
  - Status colour indicator (green/yellow/red/gray)
  - Click card → edit room modal
- Table view: sortable columns (number, type, floor, status, rate)
- "Add Room" button → modal form
- "Add Room Type" button → separate page/modal
- Bulk status update (select multiple → change status)

### Room Types Management (`/rooms/types`)
- List of room types with base price, max occupancy, bed type
- Add/Edit room type form:
  - Name, description, base price, max occupancy, max children
  - Bed type selector (single, double, twin, king, queen)
  - Size in sqm
  - Amenities checkboxes (WiFi, AC, TV, minibar, balcony, sea view, etc.)
  - Photo upload (multiple, drag to reorder)
  - Active/inactive toggle

### Seasonal Rates (`/rooms/rates`)
- Table of seasonal rate overrides
- Add/Edit form: name, room type, start date, end date, price override, min nights
- Visual timeline showing rate periods on a calendar strip

---

## 3.6 GUESTS MODULE

### Guest Directory (`/guests`)
- Searchable table: name, email, phone, nationality, stays, total spent, VIP status
- Click row → guest profile
- "Add Guest" button → modal form
- Filters: VIP status, nationality, tags
- Sort by: name, total stays, total spent, last stay

### Guest Profile (`/guests/:id`)
- Header: full name, VIP badge, contact info, photo
- Stats cards: total stays, total spent, average stay length, last visit
- Tabs:
  - Booking History: all bookings for this guest
  - Communications: all emails/messages sent
  - Notes: editable notes about preferences
  - Surveys: satisfaction scores from this guest
- Edit button → edit guest details
- Tags system (e.g. "corporate", "repeat", "birthday-month")

---

## 3.7 HOUSEKEEPING MODULE

### Housekeeping Board (`/housekeeping`)
- Kanban-style board with columns: Pending → In Progress → Completed
- Cards show: room number, task type, priority badge, assigned staff
- Drag cards between columns to update status
- Click card → detail panel (notes, checklist, time tracking)
- Filter by: floor, priority, assigned staff, task type
- "Auto-generate tasks" button (creates tasks for all dirty rooms)
- Mobile-optimised (this is the primary housekeeping interface)

### Housekeeping Checklist
- Each task has a configurable checklist (stored as JSONB)
- Items: bed made, bathroom cleaned, towels replaced, minibar checked, etc.
- Housekeeper checks items on their phone
- Photo upload for issue reporting

---

## 3.8 MAINTENANCE MODULE (Professional tier)

### Maintenance Board (`/maintenance`)
- Similar kanban to housekeeping: Open → Assigned → In Progress → Completed
- Cards show: room, category, priority, description excerpt
- "New Request" button → form (room, category, description, priority, photos)
- Categories: plumbing, electrical, HVAC, furniture, appliance, structural, general
- Resolution notes and timestamp when completed
- Link maintenance to room (auto-sets room to "maintenance" status)

---

## 3.9 INVOICING MODULE

### Invoice List (`/invoices`)
- Table: invoice number, guest, booking ref, date, total, status
- Filters: status (draft, issued, paid, cancelled, overdue)
- Search by invoice number or guest name
- "Create Invoice" button (select booking → auto-populate)

### Invoice Detail (`/invoices/:id`)
- Professional invoice layout (preview mode)
- Hotel logo, name, address, VAT number at top
- Guest billing details
- Line items table (room charges, extras, packages)
- Subtotal, VAT (19% default, configurable), Total
- Payment history
- Buttons: Download PDF, Send to Guest, Mark as Paid, Print
- PDF generation using browser print or a library

### Auto-Invoice
- On checkout, automatically generate a draft invoice with all charges
- Alert if balance > 0 on checkout attempt

---

## 3.10 REPORTS MODULE

### Reports Dashboard (`/reports`)
- Date range selector (today, this week, this month, custom range)
- KPI summary cards:
  - Total Revenue
  - Occupancy Rate %
  - ADR (Average Daily Rate)
  - RevPAR (Revenue Per Available Room)
  - Average Length of Stay
  - Cancellation Rate %

### Sub-reports (tabs or sub-pages):

**Revenue Report**
- Daily/weekly/monthly revenue chart (line or bar)
- Breakdown by source (direct, OTA, walk-in)
- Revenue by room type
- Exportable to CSV

**Occupancy Report**
- Daily occupancy % chart
- Occupancy by room type
- Peak and off-peak analysis
- Historical comparison (vs previous month/year)

**Booking Source Report**
- Pie chart: bookings by source
- Table: source, count, revenue, average rate, average stay
- Identify top-performing channels

**Guest Report**
- New vs returning guests
- Nationality breakdown
- Average spend per guest
- VIP guest contribution to revenue

**Financial Summary**
- Daily financial summary (like a night audit report)
- Total room revenue, extras revenue, payments received, outstanding balance
- Exportable to PDF and CSV

---

## 3.11 PACKAGES & PROMOTIONS

### Packages Page (`/settings/packages`)
- List of packages with name, price, included items, validity
- Add/Edit form: name, description, price, included items (multi-select), room types, validity dates, min nights
- Active/inactive toggle

### Promotions Page (`/settings/promotions`)
- List with code, name, discount, validity, usage count
- Add/Edit form: code, name, discount type (% or fixed), value, applies to (room/total/extras), validity dates, max uses, min nights, min amount, applicable room types
- Usage tracking (current uses vs max)
- Copy code to clipboard button

---

## 3.12 SETTINGS MODULE

### Hotel Settings (`/settings`) — Admin only
- Hotel details form: name, address, phone, email, logo upload
- Registration number, VAT number, VAT rate
- Default check-in/check-out times
- Currency selection
- Timezone selection
- Email footer text / branding

### User Management (`/settings/users`) — Admin only
- Table of staff: name, email, role, active status, last login
- Invite new user: email, name, role → sends invitation email
- Edit role, deactivate/reactivate
- Cannot deactivate yourself

### Billing & Subscription (`/settings/billing`) — Admin only
- Current plan display (Essential / Professional / Enterprise)
- Feature comparison of tiers
- Upgrade/downgrade buttons → Stripe Checkout or portal
- Payment history from Stripe
- Next billing date

---

## 3.13 STRIPE INTEGRATION

### Subscription Management
- Hotel registers → Stripe Customer created
- Selects tier → Stripe Checkout Session for that price
- Webhook: `checkout.session.completed` → update tenant subscription_tier and status
- Webhook: `customer.subscription.updated` → handle upgrades/downgrades
- Webhook: `customer.subscription.deleted` → set status to cancelled, show upgrade prompt
- Webhook: `invoice.payment_failed` → show payment failed banner in dashboard

### Feature Gating
- Check `tenant.subscription_tier` before rendering Professional/Enterprise features
- Show locked/upgrade prompts for features above current tier
- Middleware/hook: `useFeatureGate('professional')` returns boolean

---

## 3.14 EMAIL SYSTEM

### Transactional Emails (build using React Email or simple HTML templates)
- Booking Confirmation (on booking create)
- Booking Cancellation
- Pre-Arrival (3 days before check-in, with pre-check-in link)
- Pre-Check-In Form (link to web form where guest enters passport, preferences)
- Welcome (on check-in)
- Post-Stay Thank You + Survey Link (1 day after check-out)
- Invoice (attached or linked)
- Password Reset

### Email sending
- Use Supabase Edge Functions or a service like Resend / SendGrid
- Store sent emails in communications table

---

## 3.15 PRE-CHECK-IN SYSTEM

### Pre-Check-In Page (`/pre-checkin/:token`) — PUBLIC, no auth required
- Guest receives email with unique link 3 days before arrival
- Form collects: passport/ID number, nationality, arrival time, special requests
- On submit: updates booking with pre_checkin_completed = true
- Shows confirmation message
- Multi-language support (detect browser language)

---

## 3.16 GLOBAL SEARCH

- Search bar in top header
- Searches across: bookings (by reference), guests (by name/email/phone), rooms (by number)
- Dropdown results grouped by type
- Click result → navigate to detail page
- Keyboard shortcut: Ctrl+K or Cmd+K to focus search

---

## 3.17 REUSABLE UI COMPONENTS

Build all of these in `src/components/ui/`:

- **Button** — variants: primary (gold bg), secondary (navy outline), danger (red), ghost, loading state
- **Input** — with label, error message, helper text, disabled state
- **Select** — styled dropdown with search
- **Textarea** — with character count
- **Checkbox** — styled
- **RadioGroup** — styled
- **Switch** — toggle switch
- **Modal** — accessible dialog with backdrop, sizes (sm/md/lg/xl)
- **Drawer** — slide-in panel from right (for detail views)
- **Badge** — status badges with colour mapping per status
- **Card** — white rounded card with optional header, footer
- **DataTable** — sortable, filterable, paginated, selectable rows, bulk actions
- **EmptyState** — icon + message + CTA button
- **LoadingSpinner** — centred spinner
- **Skeleton** — content loading placeholders
- **Avatar** — user photo with fallback initials
- **Breadcrumbs** — route-aware breadcrumb trail
- **Tabs** — horizontal tab bar
- **DatePicker** — date input with calendar popup
- **DateRangePicker** — start/end date selector
- **FileUpload** — drag-and-drop with preview
- **SearchInput** — debounced search with clear button
- **StatusDot** — small coloured circle for room/booking status
- **KPICard** — number + label + trend indicator
- **ConfirmDialog** — "Are you sure?" dialog for destructive actions
- **Toast** — react-hot-toast configured with Townshub styling

---

# ═══════════════════════════════════════════════════════════════
# SECTION 4: ARCHITECTURAL RULES (ALWAYS FOLLOW)
# ═══════════════════════════════════════════════════════════════

1. EVERY database query must be tenant-scoped via RLS. Never trust client-side filtering.
2. NEVER use TypeScript `any`. Every variable, function, prop must be typed.
3. ALWAYS show loading skeletons while data fetches. ALWAYS show error toasts on failure.
4. All monetary values: DECIMAL(10,2) in DB, number in TypeScript, formatted with Intl.NumberFormat.
5. Cyprus VAT default 19%. Must be configurable per tenant.
6. Dates stored in UTC. Displayed in tenant timezone (default: Asia/Nicosia).
7. Auth uses Supabase Auth. Our `users` table extends auth.users with tenant_id + role.
8. Feature gating: check tenant.subscription_tier to show/hide Professional/Enterprise features.
9. Mobile-first responsive design. Hotels use tablets at front desk.
10. Use React Query for all server state. Zustand for UI state only.
11. Every form uses react-hook-form + zod validation.
12. Use the `eyJ` format anon key with supabase-js (not the newer sb_publishable_ format).
13. Run schema.sql as one single block in Supabase SQL Editor (partial runs roll back).
14. Booking references format: TH-XXXXXX (auto-generated by trigger).
15. All list pages must have: search, filters, sort, pagination, empty state.

---

# ═══════════════════════════════════════════════════════════════
# SECTION 5: EXECUTION INSTRUCTIONS FOR ANTIGRAVITY
# ═══════════════════════════════════════════════════════════════

READ THIS ENTIRE FILE FIRST. Then execute in this order:

PHASE 1 — FOUNDATION (do first, everything else depends on this)
  1. Create all TypeScript types/interfaces from the schema
  2. Set up Supabase client (src/lib/supabase.ts)
  3. Build auth system (store, hooks, login page, register page)
  4. Build DashboardLayout with sidebar and header
  5. Set up all routes in App.tsx with ProtectedRoute wrapper
  6. Build all reusable UI components

PHASE 2 — CORE MODULES (can be built in parallel by multiple agents)
  Agent A: Bookings module (list, new, detail, calendar)
  Agent B: Rooms module (management, types, seasonal rates)
  Agent C: Guests module (directory, profile)
  Agent D: Housekeeping module (board, tasks)

PHASE 3 — FINANCIAL (depends on Phase 2)
  7. Invoicing module (list, detail, PDF generation, auto-invoice)
  8. Payments (record payment modal, payment history)
  9. Stripe subscription integration + webhooks + feature gating

PHASE 4 — COMMUNICATIONS & EXTRAS
  10. Email templates + sending system
  11. Pre-check-in public page
  12. Packages and promotions management
  13. Gift vouchers, maintenance module
  14. Guest communications log + surveys

PHASE 5 — ANALYTICS & POLISH
  15. Reports dashboard with all charts
  16. Global search (Ctrl+K)
  17. Dashboard page with all KPIs and widgets
  18. Settings pages (hotel, users, billing)
  19. Mobile responsiveness pass
  20. Error handling, loading states, empty states everywhere

VERIFY AT END:
- npm run build compiles with zero errors
- npm run dev starts without errors
- Login page renders correctly
- All routes resolve to the correct pages
- No TypeScript errors remain
- All imports resolve correctly

DO NOT STOP until all 20 steps are complete.
