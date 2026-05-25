import { type ReactNode, useState, useEffect } from 'react'
import { NavLink, useNavigate, Navigate } from 'react-router-dom'
import { SUPPORTED_LANGUAGES, changeLanguage, getCurrentLanguage, type SupportedLang } from '@/lib/i18n'
import { usePageTracking } from '@/hooks/usePageTracking'
import {
  LayoutDashboard, CalendarDays, BedDouble, Users, Sparkles,
  Wrench, FileText, BarChart3, Settings, LogOut, Menu, X, ChevronLeft,
  Bell, Search, UtensilsCrossed, MessageSquare, Gift, Building2,
  MapPin, Star, ClipboardList, BarChart2, ChevronDown, ChevronRight, ShieldCheck, Megaphone,
  Home, UserCheck, Key, DollarSign, Zap, ClipboardCheck, FolderOpen, PieChart, ArrowLeftRight, Brain,
} from 'lucide-react'

const SUPER_ADMIN_EMAILS = ['admin@townshub.cy']
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { signOut } from '@/lib/auth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { GlobalSearch } from '@/components/GlobalSearch'
import { AIAssistantWidget } from '@/components/AIAssistantWidget'
import { PushNotificationBell } from '@/components/PushNotificationBell'
import { initials } from '@/lib/utils'
import toast from 'react-hot-toast'
import { classNames } from '@/lib/utils'
import type { PlatformMode } from '@/types/database'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  children?: NavItem[]
}

const hotelNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/bookings', label: 'Bookings', icon: <CalendarDays size={18} /> },
  { to: '/settings/channels', label: 'Channels', icon: <ArrowLeftRight size={18} /> },
  { to: '/rooms', label: 'Rooms', icon: <BedDouble size={18} /> },
  { to: '/guests', label: 'Guests', icon: <Users size={18} /> },
  {
    to: '/fb', label: 'F&B', icon: <UtensilsCrossed size={18} />,
    children: [
      { to: '/fb/orders', label: 'Orders', icon: <UtensilsCrossed size={16} /> },
      { to: '/fb/menu', label: 'Menu', icon: <FileText size={16} /> },
      { to: '/fb/kds', label: 'Kitchen Display', icon: <UtensilsCrossed size={16} /> },
      { to: '/fb/reports', label: 'F&B Reports', icon: <BarChart3 size={16} /> },
    ],
  },
  { to: '/housekeeping', label: 'Housekeeping', icon: <Sparkles size={18} /> },
  { to: '/maintenance', label: 'Maintenance', icon: <Wrench size={18} /> },
  { to: '/waitlist', label: 'Waitlist', icon: <ClipboardList size={18} /> },
  { to: '/messaging', label: 'Messaging', icon: <MessageSquare size={18} /> },
  { to: '/concierge', label: 'Concierge', icon: <MapPin size={18} /> },
  { to: '/marketing', label: 'AI Marketing', icon: <Megaphone size={18} /> },
  { to: '/communications', label: 'Communications', icon: <Bell size={18} /> },
  { to: '/surveys', label: 'Surveys', icon: <Star size={18} /> },
  { to: '/loyalty', label: 'Loyalty', icon: <Gift size={18} /> },
  { to: '/accounts', label: 'Corporate', icon: <Building2 size={18} /> },
  { to: '/invoices', label: 'Invoices', icon: <FileText size={18} /> },
  {
    to: '/reports', label: 'Reports', icon: <BarChart3 size={18} />,
    children: [
      { to: '/reports', label: 'Analytics', icon: <BarChart3 size={16} /> },
      { to: '/reports/builder', label: 'Custom Reports', icon: <BarChart2 size={16} /> },
      { to: '/reports/executive', label: 'Executive BI', icon: <BarChart2 size={16} /> },
      { to: '/reports/intelligence', label: 'AI Intelligence', icon: <Brain size={16} /> },
    ],
  },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
]

const propertyNavItems: NavItem[] = [
  { to: '/property/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/properties', label: 'Properties', icon: <Home size={18} /> },
  { to: '/units', label: 'Units', icon: <Building2 size={18} /> },
  { to: '/owners', label: 'Owners', icon: <UserCheck size={18} /> },
  { to: '/renters', label: 'Renters', icon: <Users size={18} /> },
  { to: '/leases', label: 'Leases', icon: <Key size={18} /> },
  { to: '/rent-collection', label: 'Rent Collection', icon: <DollarSign size={18} /> },
  { to: '/property-maintenance', label: 'Maintenance', icon: <Wrench size={18} /> },
  { to: '/inspections', label: 'Inspections', icon: <ClipboardCheck size={18} /> },
  { to: '/utilities', label: 'Utilities', icon: <Zap size={18} /> },
  { to: '/property-reports', label: 'Reports', icon: <PieChart size={18} /> },
  { to: '/property-documents', label: 'Documents', icon: <FolderOpen size={18} /> },
  { to: '/owner-portal', label: 'Owner Portal', icon: <Star size={18} /> },
  { to: '/property-marketing', label: 'AI Marketing', icon: <Megaphone size={18} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
]

interface DashboardLayoutProps {
  children: ReactNode
}

function NavItemComponent({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [open, setOpen] = useState(false)

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={classNames(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-white/70 hover:bg-white/10 hover:text-white',
            collapsed && 'justify-center',
          )}
          title={collapsed ? item.label : undefined}
        >
          {item.icon}
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </>
          )}
        </button>
        {open && !collapsed && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
            {item.children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                end
                className={({ isActive }) =>
                  classNames(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive ? 'bg-gold text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                {child.icon}
                <span>{child.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/reports'}
      className={({ isActive }) =>
        classNames(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-gold text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
          collapsed && 'justify-center',
        )
      }
      title={collapsed ? item.label : undefined}
    >
      {item.icon}
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  )
}

function ModeSwitcher({ mode, onChange, collapsed }: { mode: PlatformMode; onChange: (m: PlatformMode) => void; collapsed: boolean }) {
  const isHotel = mode === 'hotel'
  if (collapsed) {
    return (
      <button
        onClick={() => onChange(isHotel ? 'property' : 'hotel')}
        className="w-full flex justify-center py-2 text-white/60 hover:text-white"
        title={isHotel ? 'Switch to Property Mode' : 'Switch to Hotel Mode'}
      >
        <ArrowLeftRight size={16} />
      </button>
    )
  }
  return (
    <div className="px-3 py-2">
      <div className="flex rounded-lg bg-white/10 p-0.5 text-xs font-medium">
        <button
          onClick={() => onChange('hotel')}
          className={classNames(
            'flex-1 rounded-md py-1 transition-colors',
            mode === 'hotel' ? 'bg-gold text-white' : 'text-white/60 hover:text-white',
          )}
        >
          Hotel
        </button>
        <button
          onClick={() => onChange('property')}
          className={classNames(
            'flex-1 rounded-md py-1 transition-colors',
            mode === 'property' ? 'bg-gold text-white' : 'text-white/60 hover:text-white',
          )}
        >
          Property
        </button>
      </div>
    </div>
  )
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  usePageTracking()
  const { user, tenant, isInitialized } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [lang, setLang] = useState<SupportedLang>(getCurrentLanguage)
  const [activeMode, setActiveMode] = useState<PlatformMode>(() => {
    const saved = sessionStorage.getItem('platform_mode') as PlatformMode | null
    return saved ?? 'hotel'
  })
  const navigate = useNavigate()

  const tenantMode: PlatformMode = tenant?.mode ?? 'hotel'
  const showModeSwitcher = tenantMode === 'both'
  const currentMode: PlatformMode = tenantMode === 'both' ? activeMode : tenantMode

  function handleModeChange(m: PlatformMode) {
    setActiveMode(m)
    sessionStorage.setItem('platform_mode', m)
    navigate(m === 'hotel' ? '/dashboard' : '/property/dashboard')
  }

  const role = user?.role ?? 'front_desk'

  const HOTEL_ROLE_NAV: Record<string, string[]> = {
    admin:        [], // empty = all
    manager:      [], // all (sub-page restriction handled in settings pages)
    front_desk:   ['/dashboard', '/bookings', '/rooms', '/guests', '/invoices', '/messaging'],
    housekeeping: ['/dashboard', '/housekeeping'],
  }

  function filterNav(items: NavItem[]): NavItem[] {
    const allowed = HOTEL_ROLE_NAV[role]
    if (!allowed || allowed.length === 0) return items
    return items.filter((item) => allowed.some((prefix) => item.to.startsWith(prefix)))
  }

  const navItems = currentMode === 'property' ? propertyNavItems : filterNav(hotelNavItems)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Show a minimal full-screen spinner only on the very first cold load
  if (!isInitialized) return <LoadingSpinner fullPage />
  if (!user) return <Navigate to="/auth/login" replace />

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/auth/login', { replace: true })
    } catch {
      toast.error('Failed to sign out')
    }
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={classNames(
        'flex items-center border-b border-white/10',
        sidebarCollapsed ? 'justify-center px-3 py-3' : 'justify-between px-4 py-3',
      )}>
        {sidebarCollapsed ? (
          <img src="/logo.jpeg" alt="TH" className="h-9 w-9 object-cover rounded-xl" />
        ) : (
          <img src="/logo.jpeg" alt="Townshub" className="h-12 w-auto object-contain rounded-xl" />
        )}
        <button
          onClick={toggleSidebar}
          className={classNames(
            'hidden lg:flex rounded-md p-1 text-white/60 hover:text-white hover:bg-white/10',
            sidebarCollapsed && 'hidden',
          )}
        >
          <ChevronLeft size={16} className={classNames('transition-transform', sidebarCollapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Hotel / property name + mode switcher */}
      {!sidebarCollapsed && (
        <div className="px-4 py-2 border-b border-white/10">
          <p className="text-xs font-medium text-gold truncate">{tenant?.name}</p>
          <p className="text-xs text-blue-200 capitalize">{tenant?.subscription_status} plan</p>
        </div>
      )}

      {showModeSwitcher && (
        <div className="border-b border-white/10">
          <ModeSwitcher mode={currentMode} onChange={handleModeChange} collapsed={sidebarCollapsed} />
        </div>
      )}

      {/* Mode label for non-both tenants */}
      {!showModeSwitcher && !sidebarCollapsed && tenantMode === 'property' && (
        <div className="px-3 py-1 border-b border-white/10">
          <span className="text-xs font-semibold text-amber-400">Property Mode</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavItemComponent key={item.to} item={item} collapsed={sidebarCollapsed} />
        ))}

        {/* Platform admin — super admin only */}
        {SUPER_ADMIN_EMAILS.includes(user?.email ?? '') && (
          <div className="pt-2 mt-2 border-t border-white/10">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-gold text-white' : 'text-gold/70 hover:bg-white/10 hover:text-gold',
                  sidebarCollapsed && 'justify-center',
                )
              }
              title={sidebarCollapsed ? 'Platform Admin' : undefined}
            >
              <ShieldCheck size={18} />
              {!sidebarCollapsed && <span>Platform Admin</span>}
            </NavLink>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-3">
        <div className={classNames('flex items-center gap-3', sidebarCollapsed && 'justify-center')}>
          <div className="h-8 w-8 shrink-0 rounded-full bg-gold flex items-center justify-center text-xs font-bold text-white">
            {user ? initials(user.full_name) : '?'}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
              <p className="truncate text-xs text-white/50 capitalize">{user?.role.replace('_', ' ')}</p>
            </div>
          )}
          {!sidebarCollapsed && (
            <button
              onClick={handleSignOut}
              className="rounded-md p-1 text-white/50 hover:text-white hover:bg-white/10"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
        {sidebarCollapsed && (
          <button
            onClick={handleSignOut}
            className="mt-2 flex w-full items-center justify-center rounded-md p-1.5 text-white/50 hover:text-white hover:bg-white/10"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — mobile */}
      <aside
        className={classNames(
          'fixed inset-y-0 left-0 z-50 w-64 bg-navy transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {SidebarContent}
      </aside>

      {/* Sidebar — desktop */}
      <aside
        className={classNames(
          'hidden lg:flex flex-col bg-navy transition-all duration-200',
          sidebarCollapsed ? 'w-16' : 'w-60',
        )}
      >
        {SidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-mid bg-white px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden rounded-md p-1.5 text-subtext hover:bg-light"
          >
            <Menu size={20} />
          </button>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden rounded-md p-1.5 text-subtext hover:bg-light"
            >
              <X size={20} />
            </button>
          )}

          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-mid bg-light px-3 py-1.5 text-sm text-subtext hover:border-blue hover:text-body transition-colors"
          >
            <Search size={15} />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-mid bg-white px-1.5 text-xs">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          <div className="flex-1" />

          {/* Language selector */}
          <select
            value={lang}
            onChange={(e) => {
              const l = e.target.value as SupportedLang
              setLang(l)
              changeLanguage(l)
            }}
            className="rounded-lg border border-mid bg-light px-2 py-1 text-xs text-body focus:outline-none focus:ring-1 focus:ring-blue hidden sm:block"
            title="Language"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
            ))}
          </select>

          <PushNotificationBell />
          <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center text-xs font-bold text-white">
            {user ? initials(user.full_name) : '?'}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AIAssistantWidget />
    </div>
  )
}
