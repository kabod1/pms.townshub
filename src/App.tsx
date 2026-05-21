import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
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

// Marketing
const MarketingHub = lazy(() => import('@/pages/marketing/MarketingHub'))

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
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function AppRoutes() {
  useAuth()

  return (
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

        {/* Guest Experience */}
        <Route path="/communications" element={<CommunicationsCenter />} />
        <Route path="/surveys" element={<SurveysPage />} />
        <Route path="/messaging" element={<MessagingPage />} />
        <Route path="/concierge" element={<ConciergePage />} />

        {/* Marketing Hub */}
        <Route path="/marketing" element={<MarketingHub />} />

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

        {/* Onboarding */}
        <Route path="/onboarding" element={<OnboardingWizard />} />

        {/* Platform admin */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Public — no auth required */}
        <Route path="/guest-chat/:slug" element={<GuestChat />} />
        <Route path="/pre-checkin/:token" element={<PreCheckin />} />
        <Route path="/menu/:slug" element={<PublicMenu />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
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
