import type {
  BookingStatus,
  BookingSource,
  RoomStatus,
  HousekeepingStatus,
  HousekeepingTaskType,
  HousekeepingPriority,
  PaymentMethod,
  InvoiceStatus,
  UserRole,
  SubscriptionTier,
} from '@/types'

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-green-100 text-green-800',
  checked_out: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-red-100 text-red-800',
}

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  direct: 'Direct',
  booking_com: 'Booking.com',
  expedia: 'Expedia',
  airbnb: 'Airbnb',
  phone: 'Phone',
  walk_in: 'Walk-in',
  other: 'Other',
}

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  vacant_clean: 'Vacant – Clean',
  vacant_dirty: 'Vacant – Dirty',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
  out_of_order: 'Out of Order',
}

export const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  vacant_clean: 'bg-green-100 text-green-800',
  vacant_dirty: 'bg-amber-100 text-amber-800',
  occupied: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-orange-100 text-orange-800',
  out_of_order: 'bg-red-100 text-red-800',
}

export const HOUSEKEEPING_STATUS_LABELS: Record<HousekeepingStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
}

export const HOUSEKEEPING_TYPE_LABELS: Record<HousekeepingTaskType, string> = {
  checkout_clean: 'Checkout Clean',
  stayover_clean: 'Stayover Clean',
  deep_clean: 'Deep Clean',
  maintenance: 'Maintenance',
  inspection: 'Inspection',
  turndown: 'Turndown',
}

export const HOUSEKEEPING_PRIORITY_LABELS: Record<HousekeepingPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  stripe: 'Stripe',
  other: 'Other',
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  front_desk: 'Front Desk',
  housekeeping: 'Housekeeping',
}

export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  essential: 'Essential',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

export const SUBSCRIPTION_PRICES: Record<SubscriptionTier, number> = {
  essential: 299,
  professional: 599,
  enterprise: 1199,
}

import type { MaintenanceCategory, MaintenanceStatus, MaintenancePriority } from '@/types'

export const MAINTENANCE_CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'HVAC',
  furniture: 'Furniture',
  appliance: 'Appliance',
  structural: 'Structural',
  general: 'General',
}

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
}

export const MAINTENANCE_STATUS_COLORS: Record<MaintenanceStatus, string> = {
  open: 'bg-red-100 text-red-800',
  assigned: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
}

export const MAINTENANCE_PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const MAINTENANCE_PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
}

export const MAINTENANCE_CATEGORY_COLORS: Record<MaintenanceCategory, string> = {
  plumbing: 'bg-cyan-100 text-cyan-800',
  electrical: 'bg-yellow-100 text-yellow-800',
  hvac: 'bg-indigo-100 text-indigo-800',
  furniture: 'bg-orange-100 text-orange-800',
  appliance: 'bg-purple-100 text-purple-800',
  structural: 'bg-red-100 text-red-800',
  general: 'bg-gray-100 text-gray-700',
}

export const DEFAULT_VAT_RATE = 19

export const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  AED: 'AED',
  NGN: '₦',
}

import type {
  FBOrderStatus, FBOrderType,
  CommunicationType, CommunicationStatus, CampaignTrigger, CampaignStatus,
  LoyaltyTierName, LoyaltyTransactionType,
  WaitlistStatus, CorporateAccountStatus,
} from '@/types'

export const FB_ORDER_STATUS_LABELS: Record<FBOrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const FB_ORDER_STATUS_COLORS: Record<FBOrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
}

export const FB_ORDER_TYPE_LABELS: Record<FBOrderType, string> = {
  room_service: 'Room Service',
  table: 'Table',
  poolside: 'Poolside',
  takeaway: 'Takeaway',
}

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  in_app: 'In-App',
}

export const COMMUNICATION_STATUS_LABELS: Record<CommunicationStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
}

export const CAMPAIGN_TRIGGER_LABELS: Record<CampaignTrigger, string> = {
  pre_arrival: 'Pre-Arrival',
  check_in: 'Check-In',
  mid_stay: 'Mid-Stay',
  post_stay: 'Post-Stay',
  manual: 'Manual',
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sent: 'Sent',
  cancelled: 'Cancelled',
}

export const LOYALTY_TIER_LABELS: Record<LoyaltyTierName, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
}

export const LOYALTY_TIER_COLORS: Record<LoyaltyTierName, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-100 text-gray-700',
  gold: 'bg-amber-100 text-amber-800',
  platinum: 'bg-purple-100 text-purple-800',
}

export const LOYALTY_TRANSACTION_LABELS: Record<LoyaltyTransactionType, string> = {
  earn: 'Points Earned',
  redeem: 'Points Redeemed',
  expire: 'Points Expired',
  adjust: 'Manual Adjustment',
}

export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  waiting: 'Waiting',
  offered: 'Offered',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

export const CORPORATE_ACCOUNT_STATUS_LABELS: Record<CorporateAccountStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  inactive: 'Inactive',
}
