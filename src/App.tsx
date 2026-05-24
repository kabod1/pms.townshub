import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useAuth } from '@/hooks/useAuth'

// Auth pages
const Login = lazy(() => import('@/pages/auth/Login'))
const Register = lazy(() => import('@/pages/auth/Register'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))

// Dashboard
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))

// Bookings
const BookingsList = lazy(() => import('@/pages/bookings/BookingsList'))
const BookingDetail = lazy(() => import('@/pages/bookings/BookingDetail'))
const NewBooking = lazy(() => import('@/pages/bookings/NewBooking'))
const BookingCalendar = lazy(() => import('@/pages/bookings/BookingCalendar'))

// Rooms
const RoomManagement = lazy(() => import('@/pages/rooms/RoomManagement'))
const RoomTypes = lazy(() => import('@/pages/rooms/RoomTypes'))
const SeasonalRates = lazy(() => import('@/pages/rooms/SeasonalRates'))

// Guests
const GuestDirectory = lazy(() => import('@/pages/guests/GuestDirectory'))
const GuestProfile = lazy(() => import('@/pages/guests/GuestProfile'))
const NewGuest = lazy(() => import('@/pages/guests/NewGuest'))

// Operations
const HousekeepingBoard = lazy(() => import('@/pages/housekeeping/HousekeepingBoard'))
const MaintenancePage = lazy(() => import('@/pages/maintenance/MaintenancePage'))
const WaitlistPage = lazy(() => import('@/pages/waitlist/WaitlistPage'))

// F&B module
const FBMenuManagement = lazy(() => import('@/pages/fb/FBMenuManagement'))
const FBOrders = lazy(() => import('@/pages/fb/FBOrders'))
const KitchenDisplay = lazy(() => import('@/pages/fb/KitchenDisplay'))
const FBReporting = lazy(() => import('@/pages/fb/FBReporting'))

// Invoices
const InvoiceList = lazy(() => import('@/pages/invoices/InvoiceList'))
const InvoiceDetail = lazy(() => import('@/pages/invoices/InvoiceDetail'))

// Reports
const ReportsDashboard = lazy(() => import('@/pages/reports/ReportsDashboard'))
const CustomReportBuilder = lazy(() => import('@/pages/reports/CustomReportBuilder'))
const ExecutiveDashboard = lazy(() => import('@/pages/reports/ExecutiveDashboard'))
const PredictiveAnalytics = lazy(() => import('@/pages/reports/PredictiveAnalytics'))

// Communications & Guest Experience
const CommunicationsCenter = lazy(() => import('@/pages/communications/CommunicationsCenter'))
const SurveysPage = lazy(() => import('@/pages/surveys/SurveysPage'))
const MessagingPage = lazy(() => import('@/pages/messaging/MessagingPage'))
const ConciergePage = lazy(() => import('@/pages/concierge/ConciergePage'))

// Loyalty
const LoyaltyPage = lazy(() => import('@/pages/loyalty/LoyaltyPage'))

// Corporate
const CorporateAccounts = lazy(() => import('@/pages/accounts/CorporateAccounts'))

// Settings
const HotelSettings = lazy(() => import('@/pages/settings/HotelSettings'))
const UserManagement = lazy(() => import('@/pages/settings/UserManagement'))
const BillingSettings = lazy(() => import('@/pages/settings/BillingSettings'))
const BrandingSettings = lazy(() => import('@/pages/settings/BrandingSettings'))
const Packages = lazy(() => import('@/pages/settings/Packages'))
const Promotions = lazy(() => import('@/pages/settings/Promotions'))
const GiftVouchers = lazy(() => import('@/pages/settings/GiftVouchers'))
const AuditLog = lazy(() => import('@/pages/settings/AuditLog'))
const ChannelManager = lazy(() => import('@/pages/settings/ChannelManager'))
const StaffSchedule = lazy(() => import('@/pages/settings/StaffSchedule'))
const StaffDetail   = lazy(() => import('@/pages/settings/StaffDetail'))

// Surveys
const PublicSurvey = lazy(() => import('@/pages/surveys/PublicSurvey'))

// Marketing
const MarketingHub = lazy(() => import('@/pages/marketing/MarketingHub'))

// Property Management Module
const PropertyDashboard = lazy(() => import('@/pages/property/PropertyDashboard'))
const PropertiesList = lazy(() => import('@/pages/properties/PropertiesList'))
const PropertyDetail = lazy(() => import('@/pages/properties/PropertyDetail'))
const NewProperty = lazy(() => import('@/pages/properties/NewProperty'))
const UnitsList = lazy(() => import('@/pages/units/UnitsList'))
const UnitDetail = lazy(() => import('@/pages/units/UnitDetail'))
const NewUnit = lazy(() => import('@/pages/units/NewUnit'))
const OwnersList = lazy(() => import('@/pages/owners/OwnersList'))
const OwnerDetail = lazy(() => import('@/pages/owners/OwnerDetail'))
const NewOwner = lazy(() => import('@/pages/owners/NewOwner'))
const RentersList = lazy(() => import('@/pages/renters/RentersList'))
const RenterDetail = lazy(() => import('@/pages/renters/RenterDetail'))
const NewRenter = lazy(() => import('@/pages/renters/NewRenter'))
const LeasesList = lazy(() => import('@/pages/leases/LeasesList'))
const LeaseDetail = lazy(() => import('@/pages/leases/LeaseDetail'))
const NewLease = lazy(() => import('@/pages/leases/NewLease'))
const RentCollection = lazy(() => import('@/pages/rent-collection/RentCollection'))
const PropertyMaintenancePage = lazy(() => import('@/pages/property-maintenance/PropertyMaintenancePage'))
const InspectionsPage = lazy(() => import('@/pages/inspections/InspectionsPage'))
const UtilitiesPage = lazy(() => import('@/pages/utilities/UtilitiesPage'))
const PropertyReports = lazy(() => import('@/pages/property-reports/PropertyReports'))
const PropertyDocumentsPage = lazy(() => import('@/pages/property-documents/PropertyDocumentsPage'))
const OwnerPortalPage = lazy(() => import('@/pages/owner-portal/OwnerPortalPage'))
const PropertyMarketingHub = lazy(() => import('@/pages/property-marketing/PropertyMarketingHub'))

// AI / Onboarding
const OnboardingWizard = lazy(() => import('@/pages/onboarding/OnboardingWizard'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const GuestChat = lazy(() => import('@/pages/GuestChat'))

// Public
const PreCheckin = lazy(() => import('@/pages/PreCheckin'))
const PublicMenu = lazy(() => import('@/pages/PublicMenu'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 2,
    },
  },
})

function AppRoutes() {
  useAuth()

  return (
    <ErrorBoundary>
    <Suspense fallback={<LoadingSpinner fullPage />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Auth */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Bookings */}
        <Route path="/bookings" element={<BookingsList />} />
        <Route path="/bookings/new" element={<NewBooking />} />
        <Route path="/bookings/calendar" element={<BookingCalendar />} />
        <Route path="/bookings/:id" element={<BookingDetail />} />

        {/* Rooms */}
        <Route path="/rooms" element={<RoomManagement />} />
        <Route path="/rooms/types" element={<RoomTypes />} />
        <Route path="/rooms/rates" element={<SeasonalRates />} />

        {/* Guests */}
        <Route path="/guests" element={<GuestDirectory />} />
        <Route path="/guests/new" element={<NewGuest />} />
        <Route path="/guests/:id" element={<GuestProfile />} />

        {/* Operations */}
        <Route path="/housekeeping" element={<HousekeepingBoard />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />

        {/* F&B */}
        <Route path="/fb/menu" element={<FBMenuManagement />} />
        <Route path="/fb/orders" element={<FBOrders />} />
        <Route path="/fb/kds" element={<KitchenDisplay />} />
        <Route path="/fb/reports" element={<FBReporting />} />

        {/* Invoices */}
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />

        {/* Reports */}
        <Route path="/reports" element={<ReportsDashboard />} />
        <Route path="/reports/builder" element={<CustomReportBuilder />} />
        <Route path="/reports/executive" element={<ExecutiveDashboard />} />
        <Route path="/reports/intelligence" element={<PredictiveAnalytics />} />

        {/* Guest Experience */}
        <Route path="/communications" element={<CommunicationsCenter />} />
        <Route path="/surveys" element={<SurveysPage />} />
        <Route path="/messaging" element={<MessagingPage />} />
        <Route path="/concierge" element={<ConciergePage />} />

        {/* Marketing Hub */}
        <Route path="/marketing" element={<MarketingHub />} />

        {/* Property Management Module */}
        <Route path="/property/dashboard" element={<PropertyDashboard />} />
        <Route path="/properties" element={<PropertiesList />} />
        <Route path="/properties/new" element={<NewProperty />} />
        <Route path="/properties/:id" element={<PropertyDetail />} />
        <Route path="/units" element={<UnitsList />} />
        <Route path="/units/new" element={<NewUnit />} />
        <Route path="/units/:id" element={<UnitDetail />} />
        <Route path="/owners" element={<OwnersList />} />
        <Route path="/owners/new" element={<NewOwner />} />
        <Route path="/owners/:id" element={<OwnerDetail />} />
        <Route path="/renters" element={<RentersList />} />
        <Route path="/renters/new" element={<NewRenter />} />
        <Route path="/renters/:id" element={<RenterDetail />} />
        <Route path="/leases" element={<LeasesList />} />
        <Route path="/leases/new" element={<NewLease />} />
        <Route path="/leases/:id" element={<LeaseDetail />} />
        <Route path="/rent-collection" element={<RentCollection />} />
        <Route path="/property-maintenance" element={<PropertyMaintenancePage />} />
        <Route path="/inspections" element={<InspectionsPage />} />
        <Route path="/utilities" element={<UtilitiesPage />} />
        <Route path="/property-reports" element={<PropertyReports />} />
        <Route path="/property-documents" element={<PropertyDocumentsPage />} />
        <Route path="/owner-portal" element={<OwnerPortalPage />} />
        <Route path="/property-marketing" element={<PropertyMarketingHub />} />

        {/* Loyalty */}
        <Route path="/loyalty" element={<LoyaltyPage />} />

        {/* Corporate */}
        <Route path="/accounts" element={<CorporateAccounts />} />

        {/* Settings */}
        <Route path="/settings" element={<HotelSettings />} />
        <Route path="/settings/users" element={<UserManagement />} />
        <Route path="/settings/billing" element={<BillingSettings />} />
        <Route path="/settings/branding" element={<BrandingSettings />} />
        <Route path="/settings/packages" element={<Packages />} />
        <Route path="/settings/promotions" element={<Promotions />} />
        <Route path="/settings/vouchers" element={<GiftVouchers />} />
        <Route path="/settings/audit-log" element={<AuditLog />} />
        <Route path="/settings/channels" element={<ChannelManager />} />
        <Route path="/settings/staff-schedule" element={<StaffSchedule />} />
        <Route path="/settings/users/:id" element={<StaffDetail />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={<OnboardingWizard />} />

        {/* Platform admin */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Public — no auth required */}
        <Route path="/guest-chat/:slug" element={<GuestChat />} />
        <Route path="/pre-checkin/:token" element={<PreCheckin />} />
        <Route path="/menu/:slug" element={<PublicMenu />} />
        <Route path="/menu/:slug/:tableToken" element={<PublicMenu />} />
        <Route path="/survey/:ref" element={<PublicSurvey />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontSize: '14px' },
            success: { iconTheme: { primary: '#1B5E20', secondary: '#fff' } },
            error: { iconTheme: { primary: '#B71C1C', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
