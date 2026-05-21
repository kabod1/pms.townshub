export type PlatformMode = 'hotel' | 'property' | 'both'
export type UserRole = 'admin' | 'manager' | 'front_desk' | 'housekeeping'
export type SubscriptionTier = 'essential' | 'professional' | 'enterprise'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled'
export type RoomStatus = 'vacant_clean' | 'vacant_dirty' | 'occupied' | 'maintenance' | 'out_of_order'
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
export type BookingSource = 'direct' | 'booking_com' | 'expedia' | 'airbnb' | 'phone' | 'walk_in' | 'other'
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'stripe' | 'other'
export type PaymentStatus = 'pending' | 'completed' | 'refunded' | 'failed'
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'
export type HousekeepingTaskType = 'checkout_clean' | 'stayover_clean' | 'deep_clean' | 'maintenance' | 'inspection' | 'turndown'
export type HousekeepingStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type HousekeepingPriority = 'low' | 'normal' | 'high' | 'urgent'
export type DiscountType = 'percentage' | 'fixed'
export type ModifierType = 'fixed' | 'percentage'

export interface Tenant {
  id: string
  name: string
  slug: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  country: string
  logo_url: string | null
  registration_number: string | null
  vat_number: string | null
  currency: string
  timezone: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_tier: SubscriptionTier | null
  subscription_status: SubscriptionStatus
  trial_ends_at: string
  mode: PlatformMode
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  tenant_id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface RoomType {
  id: string
  tenant_id: string
  name: string
  description: string | null
  base_price: number
  max_occupancy: number
  max_children: number
  bed_type: string | null
  size_sqm: number | null
  amenities: string[] | null
  photos: string[] | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Room {
  id: string
  tenant_id: string
  room_type_id: string | null
  number: string
  floor: number | null
  status: RoomStatus
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  room_type?: RoomType
}

export interface Guest {
  id: string
  tenant_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  nationality: string | null
  id_type: 'passport' | 'national_id' | 'driving_licence' | 'other' | null
  id_number: string | null
  date_of_birth: string | null
  address: string | null
  city: string | null
  country: string | null
  postal_code: string | null
  company_name: string | null
  notes: string | null
  vip_status: 'regular' | 'silver' | 'gold' | 'platinum'
  total_stays: number
  total_spent: number
  tags: string[]
  created_at: string
  updated_at: string
}

export interface RatePlan {
  id: string
  tenant_id: string
  name: string
  description: string | null
  price_modifier: number
  modifier_type: ModifierType
  is_active: boolean
  created_at: string
}

export interface Booking {
  id: string
  tenant_id: string
  booking_reference: string
  guest_id: string | null
  room_id: string | null
  room_type_id: string | null
  rate_plan_id: string | null
  check_in_date: string
  check_out_date: string
  actual_check_in: string | null
  actual_check_out: string | null
  adults: number
  children: number
  status: BookingStatus
  source: BookingSource
  room_rate: number
  total_amount: number
  paid_amount: number
  balance_due: number
  special_requests: string | null
  internal_notes: string | null
  pre_checkin_completed: boolean
  pre_checkin_token: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  guest?: Guest
  room?: Room
  room_type?: RoomType
  rate_plan?: RatePlan
}

export interface BookingExtra {
  id: string
  booking_id: string
  tenant_id: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
  created_at: string
}

export interface Payment {
  id: string
  tenant_id: string
  booking_id: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  reference: string | null
  notes: string | null
  processed_by: string | null
  created_at: string
}

export interface Invoice {
  id: string
  tenant_id: string
  booking_id: string
  invoice_number: string
  issued_date: string
  due_date: string | null
  subtotal: number
  vat_rate: number
  vat_amount: number
  total: number
  status: InvoiceStatus
  notes: string | null
  created_at: string
  booking?: Booking
}

export interface ChecklistItem {
  item: string
  done: boolean
}

export interface HousekeepingTask {
  id: string
  tenant_id: string
  room_id: string | null
  booking_id: string | null
  type: HousekeepingTaskType
  status: HousekeepingStatus
  priority: HousekeepingPriority
  assigned_to: string | null
  notes: string | null
  checklist: ChecklistItem[]
  started_at: string | null
  completed_at: string | null
  estimated_minutes: number
  created_at: string
  updated_at: string
  room?: Room
  assignee?: User
}

export interface Package {
  id: string
  tenant_id: string
  name: string
  description: string | null
  price: number
  includes: string[] | null
  room_type_ids: string[]
  valid_from: string | null
  valid_to: string | null
  min_nights: number
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Promotion {
  id: string
  tenant_id: string
  code: string
  name: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  applies_to: string
  valid_from: string | null
  valid_to: string | null
  max_uses: number | null
  current_uses: number
  min_nights: number
  min_amount: number
  room_type_ids: string[]
  is_active: boolean
  created_at: string
}

export interface SeasonalRate {
  id: string
  tenant_id: string
  room_type_id: string
  name: string
  start_date: string
  end_date: string
  price_override: number
  min_nights: number
  created_at: string
  room_type?: RoomType
}

export type MaintenanceCategory = 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'appliance' | 'structural' | 'general'
export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'
export type MaintenancePriority = 'low' | 'normal' | 'high' | 'urgent'

export interface MaintenanceRequest {
  id: string
  tenant_id: string
  room_id: string | null
  reported_by: string | null
  category: MaintenanceCategory
  description: string
  priority: MaintenancePriority
  status: MaintenanceStatus
  assigned_to: string | null
  resolution_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  room?: Room
  reporter?: User
}

export type VoucherStatus = 'active' | 'redeemed' | 'expired' | 'cancelled'

export interface GiftVoucher {
  id: string
  tenant_id: string
  code: string
  issued_to: string | null
  issued_to_email: string | null
  message: string | null
  value: number
  balance: number
  status: VoucherStatus
  expires_at: string | null
  redeemed_at: string | null
  booking_id: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  tenant_id: string
  user_id: string | null
  action: string
  table_name: string | null
  record_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  user?: User
}

// ─── F&B / Restaurant ───────────────────────────────────────────────────────

export interface FBMenuCategory {
  id: string
  tenant_id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface FBMenuItem {
  id: string
  tenant_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  currency: string
  allergens: string[]
  tags: string[]
  photo_url: string | null
  is_available: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  category?: FBMenuCategory
}

export type FBOrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
export type FBOrderType = 'room_service' | 'table' | 'poolside' | 'takeaway'

export interface FBOrder {
  id: string
  tenant_id: string
  booking_id: string | null
  room_number: string | null
  table_number: string | null
  guest_name: string | null
  order_type: FBOrderType
  status: FBOrderStatus
  subtotal: number
  notes: string | null
  created_at: string
  updated_at: string
  items?: FBOrderItem[]
  booking?: Booking
}

export interface FBOrderItem {
  id: string
  order_id: string
  menu_item_id: string | null
  name: string
  quantity: number
  unit_price: number
  total_price: number
  notes: string | null
  created_at: string
  menu_item?: FBMenuItem
}

// ─── Communications ──────────────────────────────────────────────────────────

export type CommunicationType = 'email' | 'sms' | 'whatsapp' | 'phone' | 'in_app'
export type CommunicationDirection = 'outbound' | 'inbound'
export type CommunicationStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'pending'

export interface Communication {
  id: string
  tenant_id: string
  guest_id: string | null
  booking_id: string | null
  type: CommunicationType
  direction: CommunicationDirection
  subject: string | null
  body: string
  status: CommunicationStatus
  sent_at: string | null
  created_at: string
  guest?: Guest
  booking?: Booking
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sent' | 'cancelled'
export type CampaignTrigger = 'pre_arrival' | 'check_in' | 'mid_stay' | 'post_stay' | 'manual'

export interface Campaign {
  id: string
  tenant_id: string
  name: string
  subject: string
  body: string
  type: CommunicationType
  trigger: CampaignTrigger
  trigger_days: number
  status: CampaignStatus
  sent_count: number
  created_at: string
  updated_at: string
}

// ─── Surveys / NPS ───────────────────────────────────────────────────────────

export interface Survey {
  id: string
  tenant_id: string
  booking_id: string | null
  guest_id: string | null
  nps_score: number | null
  cleanliness_rating: number | null
  service_rating: number | null
  amenities_rating: number | null
  overall_rating: number | null
  comments: string | null
  would_recommend: boolean | null
  submitted_at: string
  created_at: string
  guest?: Guest
  booking?: Booking
}

// ─── Loyalty Programme ───────────────────────────────────────────────────────

export type LoyaltyTierName = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface LoyaltyTier {
  id: string
  tenant_id: string
  name: LoyaltyTierName
  label: string
  min_points: number
  discount_percentage: number
  perks: string[]
  created_at: string
}

export interface LoyaltyAccount {
  id: string
  tenant_id: string
  guest_id: string
  points_balance: number
  tier: LoyaltyTierName
  lifetime_points: number
  created_at: string
  updated_at: string
  guest?: Guest
}

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'adjust'

export interface LoyaltyTransaction {
  id: string
  account_id: string
  tenant_id: string
  booking_id: string | null
  type: LoyaltyTransactionType
  points: number
  description: string
  created_at: string
  booking?: Booking
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export type MessageSenderType = 'guest' | 'staff'

export interface Message {
  id: string
  tenant_id: string
  booking_id: string
  sender_type: MessageSenderType
  sender_name: string
  body: string
  is_read: boolean
  created_at: string
  booking?: Booking
}

// ─── Concierge ────────────────────────────────────────────────────────────────

export interface ConciergeCategory {
  id: string
  tenant_id: string
  name: string
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface ConciergeItem {
  id: string
  tenant_id: string
  category_id: string | null
  title: string
  description: string | null
  address: string | null
  phone: string | null
  website: string | null
  distance_minutes: number | null
  tags: string[]
  photo_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  category?: ConciergeCategory
}

// ─── Corporate Accounts ───────────────────────────────────────────────────────

export type CorporateAccountStatus = 'active' | 'suspended' | 'inactive'

export interface CorporateAccount {
  id: string
  tenant_id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  address: string | null
  vat_number: string | null
  credit_limit: number
  current_balance: number
  discount_percentage: number
  payment_terms_days: number
  status: CorporateAccountStatus
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export type WaitlistStatus = 'waiting' | 'offered' | 'confirmed' | 'cancelled'

export interface WaitlistEntry {
  id: string
  tenant_id: string
  guest_id: string | null
  room_type_id: string | null
  check_in_date: string
  check_out_date: string
  adults: number
  children: number
  status: WaitlistStatus
  notes: string | null
  notified_at: string | null
  created_at: string
  guest?: Guest
  room_type?: RoomType
}

// ─── Property Management Module ───────────────────────────────────────────────


export type PropertyType = 'residential' | 'commercial' | 'mixed_use' | 'land'
export type UnitType = 'apartment' | 'studio' | 'villa' | 'penthouse' | 'maisonette' | 'room' | 'office' | 'retail' | 'warehouse' | 'industrial' | 'restaurant' | 'desk' | 'other'
export type UnitStatus = 'vacant' | 'occupied' | 'reserved' | 'maintenance' | 'not_available'
export type FurnishedType = 'furnished' | 'semi_furnished' | 'unfurnished'
export type LeaseType = 'fixed_term' | 'rolling' | 'periodic' | 'commercial'
export type LeaseStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'renewed'
export type RentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'
export type RentScheduleStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'waived' | 'cancelled'
export type PropertyPaymentType = 'rent' | 'deposit' | 'utilities' | 'maintenance_fee' | 'late_fee' | 'other'
export type PropertyPaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'cheque' | 'standing_order' | 'stripe' | 'other'
export type PropertyInvoiceType = 'rent' | 'deposit' | 'utilities' | 'service_charge' | 'other'
export type PropertyInvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'
export type UtilityType = 'electricity' | 'water' | 'gas' | 'internet' | 'telephone' | 'cyta' | 'eac' | 'other'
export type PropertyMaintenanceStatus = 'reported' | 'assessed' | 'quoted' | 'approved' | 'in_progress' | 'completed' | 'closed' | 'rejected'
export type PropertyMaintenancePriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency'
export type PropertyMaintenanceCategory = 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'structural' | 'cosmetic' | 'security' | 'garden' | 'common_area' | 'general'
export type InspectionType = 'move_in' | 'move_out' | 'routine' | 'maintenance' | 'emergency'
export type InspectionStatus = 'scheduled' | 'completed' | 'cancelled'
export type OwnerStatementStatus = 'draft' | 'sent' | 'paid'
export type PropertyDocumentType = 'lease_agreement' | 'inventory' | 'inspection_report' | 'id_document' | 'proof_of_income' | 'reference_letter' | 'insurance' | 'title_deed' | 'planning_permission' | 'certificate_of_occupancy' | 'utility_bill' | 'correspondence' | 'other'
export type ManagementFeeType = 'percentage' | 'fixed'
export type IdType = 'passport' | 'national_id' | 'driving_licence' | 'company_reg' | 'other'
export type PropertyTenantType = 'individual' | 'company'
export type CostResponsibility = 'owner' | 'tenant' | 'insurance' | 'shared'
export type UtilityBillStatus = 'pending' | 'charged' | 'paid' | 'disputed'
export type ChargedTo = 'tenant' | 'owner' | 'agency'
export type ReportedByType = 'tenant' | 'owner' | 'manager' | 'inspection'
export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'

export interface Property {
  id: string
  tenant_id: string
  owner_id: string | null
  name: string
  type: PropertyType
  address: string
  city: string
  district: string | null
  country: string
  postal_code: string | null
  total_units: number
  year_built: number | null
  total_area_sqm: number | null
  description: string | null
  amenities: string[]
  photos: string[]
  documents: string[]
  latitude: number | null
  longitude: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  owner?: PropertyOwner
}

export interface PropertyOwner {
  id: string
  tenant_id: string
  first_name: string
  last_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  id_type: IdType | null
  id_number: string | null
  address: string | null
  city: string | null
  country: string | null
  bank_name: string | null
  bank_iban: string | null
  bank_swift: string | null
  tax_number: string | null
  vat_number: string | null
  management_fee_rate: number
  management_fee_type: ManagementFeeType
  portal_access: boolean
  portal_email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Unit {
  id: string
  tenant_id: string
  property_id: string
  owner_id: string | null
  unit_number: string
  floor: number | null
  type: UnitType
  subtype: string | null
  area_sqm: number | null
  bedrooms: number
  bathrooms: number
  parking_spaces: number
  furnished: FurnishedType
  status: UnitStatus
  market_rent: number | null
  features: string[]
  photos: string[]
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  property?: Property
  owner?: PropertyOwner
}

export interface PropertyTenant {
  id: string
  tenant_id: string
  first_name: string
  last_name: string
  company_name: string | null
  tenant_type: PropertyTenantType
  email: string | null
  phone: string | null
  secondary_phone: string | null
  id_type: IdType | null
  id_number: string | null
  id_expiry: string | null
  nationality: string | null
  date_of_birth: string | null
  address: string | null
  city: string | null
  country: string | null
  employer: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  references: string[] | null
  notes: string | null
  tags: string[]
  portal_access: boolean
  portal_email: string | null
  total_properties_rented: number
  created_at: string
  updated_at: string
}

export interface Lease {
  id: string
  tenant_id: string
  unit_id: string
  property_tenant_id: string
  owner_id: string | null
  lease_reference: string
  lease_type: LeaseType
  status: LeaseStatus
  start_date: string
  end_date: string | null
  notice_period_days: number
  monthly_rent: number
  rent_frequency: RentFrequency
  payment_due_day: number
  deposit_amount: number
  deposit_paid: boolean
  deposit_returned: boolean
  deposit_return_date: string | null
  deposit_deductions: number
  deposit_deduction_notes: string | null
  rent_includes_utilities: boolean
  rent_review_date: string | null
  rent_review_increase_rate: number | null
  break_clause_date: string | null
  break_clause_notice_days: number | null
  guarantor_name: string | null
  guarantor_phone: string | null
  guarantor_email: string | null
  special_conditions: string | null
  internal_notes: string | null
  document_url: string | null
  auto_renew: boolean
  auto_renew_months: number
  terminated_at: string | null
  termination_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  unit?: Unit
  property_tenant?: PropertyTenant
  owner?: PropertyOwner
}

export interface RentSchedule {
  id: string
  tenant_id: string
  lease_id: string
  unit_id: string
  property_tenant_id: string
  due_date: string
  amount: number
  status: RentScheduleStatus
  paid_amount: number
  balance: number
  paid_date: string | null
  days_overdue: number
  late_fee: number
  notes: string | null
  created_at: string
  updated_at: string
  lease?: Lease
  property_tenant?: PropertyTenant
  unit?: Unit
}

export interface PropertyPayment {
  id: string
  tenant_id: string
  lease_id: string | null
  rent_schedule_id: string | null
  property_tenant_id: string | null
  unit_id: string | null
  amount: number
  payment_type: PropertyPaymentType
  method: PropertyPaymentMethod
  reference: string | null
  payment_date: string
  notes: string | null
  receipt_url: string | null
  recorded_by: string | null
  created_at: string
  lease?: Lease
  property_tenant?: PropertyTenant
  unit?: Unit
}

export interface PropertyInvoice {
  id: string
  tenant_id: string
  lease_id: string | null
  property_tenant_id: string | null
  unit_id: string | null
  invoice_number: string
  invoice_type: PropertyInvoiceType
  issued_date: string
  due_date: string | null
  period_start: string | null
  period_end: string | null
  subtotal: number
  vat_rate: number
  vat_amount: number
  total: number
  status: PropertyInvoiceStatus
  notes: string | null
  line_items: unknown[]
  created_at: string
  lease?: Lease
  property_tenant?: PropertyTenant
  unit?: Unit
}

export interface UtilityAccount {
  id: string
  tenant_id: string
  unit_id: string | null
  property_id: string | null
  utility_type: UtilityType
  provider: string | null
  account_number: string | null
  meter_number: string | null
  billing_name: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  unit?: Unit
  property?: Property
}

export interface UtilityBill {
  id: string
  tenant_id: string
  utility_account_id: string | null
  unit_id: string | null
  billing_period_start: string
  billing_period_end: string
  reading_start: number | null
  reading_end: number | null
  consumption: number | null
  unit_cost: number | null
  amount: number
  charged_to: ChargedTo
  lease_id: string | null
  status: UtilityBillStatus
  bill_document_url: string | null
  notes: string | null
  created_at: string
  utility_account?: UtilityAccount
  unit?: Unit
}

export interface PropertyMaintenance {
  id: string
  tenant_id: string
  unit_id: string | null
  property_id: string | null
  lease_id: string | null
  reported_by_type: ReportedByType
  reported_by_tenant: string | null
  reported_by_user: string | null
  category: PropertyMaintenanceCategory
  title: string
  description: string
  priority: PropertyMaintenancePriority
  status: PropertyMaintenanceStatus
  estimated_cost: number | null
  actual_cost: number | null
  cost_responsibility: CostResponsibility
  contractor_name: string | null
  contractor_phone: string | null
  scheduled_date: string | null
  completed_date: string | null
  photos: string[]
  resolution_notes: string | null
  created_at: string
  updated_at: string
  unit?: Unit
  property?: Property
}

export interface PropertyInspection {
  id: string
  tenant_id: string
  unit_id: string
  lease_id: string | null
  inspection_type: InspectionType
  scheduled_date: string | null
  completed_date: string | null
  conducted_by: string | null
  overall_condition: ConditionRating | null
  report: Record<string, unknown>
  photos: string[]
  notes: string | null
  tenant_signature_url: string | null
  manager_signature_url: string | null
  status: InspectionStatus
  created_at: string
  unit?: Unit
  lease?: Lease
}

export interface OwnerStatement {
  id: string
  tenant_id: string
  owner_id: string
  period_start: string
  period_end: string
  total_rent_collected: number
  management_fee: number
  maintenance_costs: number
  utility_costs: number
  other_deductions: number
  net_owner_payment: number
  status: OwnerStatementStatus
  payment_date: string | null
  payment_reference: string | null
  notes: string | null
  statement_document_url: string | null
  line_items: unknown[]
  created_at: string
  owner?: PropertyOwner
}

export interface PropertyDocument {
  id: string
  tenant_id: string
  property_id: string | null
  unit_id: string | null
  lease_id: string | null
  property_tenant_id: string | null
  owner_id: string | null
  document_type: PropertyDocumentType
  title: string
  file_url: string
  file_size: number | null
  file_type: string | null
  expiry_date: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
  property?: Property
  unit?: Unit
  lease?: Lease
}

export interface ArrearsLog {
  id: string
  tenant_id: string
  lease_id: string
  property_tenant_id: string
  unit_id: string
  total_arrears: number
  oldest_due_date: string | null
  action_taken: string | null
  action_date: string
  action_by: string | null
  notes: string | null
  created_at: string
  lease?: Lease
  property_tenant?: PropertyTenant
  unit?: Unit
}

export interface CommercialLeaseTerms {
  id: string
  lease_id: string
  tenant_id: string
  rent_review_schedule: string | null
  service_charge_amount: number
  service_charge_frequency: string
  cam_charges: number
  business_rates: number
  permitted_use: string | null
  subletting_allowed: boolean
  assignment_allowed: boolean
  alterations_allowed: string
  dilapidations_clause: boolean
  rent_free_period_months: number
  rent_deposit_months: number
  personal_guarantee_required: boolean
  created_at: string
}
