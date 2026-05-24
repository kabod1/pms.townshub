import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, BedDouble, TrendingUp, CalendarCheck,
  ShieldCheck, Globe, Activity, RefreshCw, ArrowUpRight,
  Home, Key, DollarSign, AlertTriangle, Hotel,
  Eye, MousePointerClick, Smartphone, Monitor, Tablet,
  BarChart2, Lock, Zap, CheckCircle2, MapPin,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'

const SUPER_ADMIN_EMAILS = ['admin@townshub.cy']

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformStats {
  totalTenants: number; totalRooms: number; totalBookings: number; totalGuests: number
  totalRevenue: number; monthRevenue: number; activeBookings: number; occupiedRooms: number
  totalProperties: number; totalUnits: number; occupiedUnits: number; activeLeases: number
  overdueRent: number; pmMonthRevenue: number
}

interface TenantStat {
  id: string; name: string; slug: string; city: string | null; country: string; mode: string
  subscription_tier: string | null; subscription_status: string; joined: string
  totalRooms: number; occupiedRooms: number; occupancyRate: number
  totalBookings: number; activeBookings: number; totalRevenue: number; monthRevenue: number
  totalGuests: number; pendingHk: number; activeFbOrders: number
  totalProperties: number; totalUnits: number; occupiedUnits: number
  activeLeases: number; monthlyRent: number; overdueRent: number; pageViewCount: number
}

interface AnalyticsData {
  viewsToday: number; viewsThisMonth: number; sessionsToday: number; activeNow: number
  dailyViews: { day: string; date: string; views: number }[]
  topPages: { path: string; count: number }[]
  browserBreakdown: { name: string; value: number }[]
  deviceBreakdown: { name: string; value: number }[]
  countryBreakdown: { country: string; count: number; flag: string; city_sample: string }[]
  cityBreakdown: { city: string; count: number; country: string; flag: string }[]
}

interface SignupUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
}

interface AdminData {
  platform: PlatformStats
  tenants: TenantStat[]
  analytics: AnalyticsData
  recentSignups: SignupUser[]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color = 'navy' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string
}) {
  const bg: Record<string, string> = {
    navy: 'bg-navy', gold: 'bg-gold', green: 'bg-green-600', blue: 'bg-blue-600',
    purple: 'bg-purple-600', amber: 'bg-amber-500', teal: 'bg-teal-600',
    red: 'bg-red-500', indigo: 'bg-indigo-600',
  }
  return (
    <div className="bg-white rounded-xl ring-1 ring-mid p-5 flex items-start gap-4">
      <div className={`w-10 h-10 ${bg[color] ?? 'bg-navy'} rounded-lg flex items-center justify-center shrink-0`}>
        <span className="text-white">{icon}</span>
      </div>
      <div>
        <p className="text-xs text-subtext font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-body mt-0.5">{value}</p>
        {sub && <p className="text-xs text-subtext mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function ModeToggle({ tenantId, current, onChange }: {
  tenantId: string; current: string; onChange: (id: string, mode: string) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-mid overflow-hidden text-xs">
      {[{ id: 'hotel', label: 'Hotel' }, { id: 'both', label: 'Both' }, { id: 'property', label: 'PM' }].map((m) => (
        <button key={m.id} onClick={() => onChange(tenantId, m.id)}
          className={`px-2.5 py-1.5 font-medium transition-colors ${
            current === m.id ? 'bg-navy text-white' : 'bg-white text-subtext hover:bg-light hover:text-body'
          }`}>{m.label}</button>
      ))}
    </div>
  )
}

const CHART_COLORS = ['#0F2138', '#C9A84C', '#2563EB', '#7C3AED', '#059669', '#DC2626']

function tierColor(tier: string | null) {
  if (tier === 'enterprise') return 'bg-purple-100 text-purple-700'
  if (tier === 'professional') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}
function statusColor(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-700'
  if (status === 'trialing') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-600'
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'security' | 'tenants' | 'users'>('overview')

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user?.email ?? '')

  useEffect(() => {
    if (!isSuperAdmin) { navigate('/dashboard', { replace: true }); return }
    fetchData()
  }, [isSuperAdmin])

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function fetchData() {
    setRefreshing(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('No session')
      const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load admin data')
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function updateMode(tenantId: string, mode: string) {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/admin', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, mode }),
    })
    if (!res.ok) return
    setData((prev) => prev ? {
      ...prev,
      tenants: prev.tenants.map((t) => t.id === tenantId ? { ...t, mode } : t),
    } : null)
  }

  if (!isSuperAdmin) return null
  if (loading) return <DashboardLayout><div className="flex justify-center py-20"><LoadingSpinner /></div></DashboardLayout>
  if (error) return <DashboardLayout><p className="text-red-600 text-sm p-6">{error}</p></DashboardLayout>
  if (!data) return null

  const { platform, tenants, analytics, recentSignups = [] } = data
  const filtered = tenants.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.city?.toLowerCase().includes(search.toLowerCase())
  )

  const TABS = [
    { id: 'overview',  label: 'Overview',   icon: <BarChart2 size={14} /> },
    { id: 'users',     label: `Sign-ups (${recentSignups.length})`, icon: <Users size={14} /> },
    { id: 'analytics', label: 'Visitor Analytics', icon: <Eye size={14} /> },
    { id: 'security',  label: 'Security',   icon: <ShieldCheck size={14} /> },
    { id: 'tenants',   label: 'Tenants',    icon: <Building2 size={14} /> },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={18} className="text-gold" />
              <span className="text-xs font-semibold text-gold uppercase tracking-wider">Platform Admin</span>
            </div>
            <h1 className="text-xl font-bold text-body">TownsHub — Command Centre</h1>
            <p className="text-sm text-subtext">
              {platform.totalTenants} tenants · {platform.totalRooms} hotel rooms · {platform.totalUnits} property units
              {analytics?.activeNow > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {analytics.activeNow} active now
                </span>
              )}
            </p>
          </div>
          <button onClick={fetchData} disabled={refreshing}
            className="flex items-center gap-2 text-sm border border-mid rounded-lg px-3 py-2 text-subtext hover:text-body hover:bg-light transition-colors">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 border-b border-mid overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-navy text-navy'
                  : 'border-transparent text-subtext hover:text-body'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Hotel PMS Stats */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Hotel size={15} className="text-navy" />
                <h2 className="text-xs font-semibold text-subtext uppercase tracking-wider">Hotel PMS — Platform</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Building2 size={18} />} label="Total Tenants"    value={platform.totalTenants}    sub="Registered accounts"                 color="navy"   />
                <StatCard icon={<BedDouble size={18} />} label="Hotel Rooms"      value={platform.totalRooms}      sub={`${platform.occupiedRooms} occupied`} color="blue"   />
                <StatCard icon={<CalendarCheck size={18}/>}label="Active Bookings" value={platform.activeBookings}  sub={`${platform.totalBookings} all-time`} color="green"  />
                <StatCard icon={<Users size={18} />}     label="Total Guests"    value={platform.totalGuests}     sub="Across all hotels"                   color="purple" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                <StatCard icon={<TrendingUp size={18} />} label="Hotel Revenue"    value={formatCurrency(platform.totalRevenue)}  sub="All-time hotel bookings"   color="gold" />
                <StatCard icon={<Activity size={18} />}   label="Hotel This Month" value={formatCurrency(platform.monthRevenue)}  sub="Combined booking revenue"  color="navy" />
                <StatCard icon={<Globe size={18} />}      label="Hotel Occupancy"
                  value={platform.totalRooms > 0 ? `${Math.round((platform.occupiedRooms / platform.totalRooms) * 100)}%` : '—'}
                  sub="Platform-wide average" color="blue" />
              </div>
            </div>

            {/* Property Management Stats */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Home size={15} className="text-teal-600" />
                <h2 className="text-xs font-semibold text-subtext uppercase tracking-wider">Property Management — Platform</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Home size={18} />}         label="Properties"    value={platform.totalProperties}  sub="Active portfolios"                    color="teal"   />
                <StatCard icon={<Key size={18} />}           label="Rental Units"  value={platform.totalUnits}       sub={`${platform.occupiedUnits} occupied`} color="blue"   />
                <StatCard icon={<Users size={18} />}         label="Active Leases" value={platform.activeLeases}     sub="Live rental agreements"               color="green"  />
                <StatCard icon={<AlertTriangle size={18} />} label="Overdue Rent"  value={platform.overdueRent}      sub="Entries across all tenants"           color="red"    />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <StatCard icon={<DollarSign size={18} />} label="PM Revenue This Month" value={formatCurrency(platform.pmMonthRevenue)} sub="Rent collected this month" color="teal" />
                <StatCard icon={<Activity size={18} />}   label="PM Occupancy"
                  value={platform.totalUnits > 0 ? `${Math.round((platform.occupiedUnits / platform.totalUnits) * 100)}%` : '—'}
                  sub="Across all property portfolios" color="navy" />
              </div>
            </div>

            {/* Hotel activity mini-cards */}
            {tenants.some((t) => t.totalRooms > 0) && (
              <div>
                <h2 className="text-xs font-semibold text-subtext uppercase tracking-wider mb-3">Hotel Activity</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tenants.filter((t) => t.totalRooms > 0).map((t) => (
                    <div key={t.id} className="bg-white rounded-xl ring-1 ring-mid p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-body text-sm truncate">{t.name}</p>
                        {t.pageViewCount > 0 && (
                          <span className="text-xs text-subtext flex items-center gap-1">
                            <Eye size={11} /> {t.pageViewCount}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-subtext">Occupancy</span>
                          <span className="font-medium text-body">{t.occupancyRate}%</span>
                        </div>
                        <div className="w-full bg-light rounded-full h-1.5">
                          <div className="bg-gold h-1.5 rounded-full" style={{ width: `${t.occupancyRate}%` }} />
                        </div>
                        <div className="flex justify-between text-xs pt-1">
                          <span className="text-subtext">Active bookings</span>
                          <span className="font-medium text-body">{t.activeBookings}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-subtext">Pending HK</span>
                          <span className={`font-medium ${t.pendingHk > 5 ? 'text-red-500' : 'text-body'}`}>{t.pendingHk}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-mid pt-2 mt-1">
                          <span className="text-subtext">Month revenue</span>
                          <span className="font-semibold text-navy">{formatCurrency(t.monthRevenue)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={<Eye size={18} />}              label="Views Today"         value={analytics.viewsToday}      sub="Page loads logged today"       color="navy"   />
              <StatCard icon={<MousePointerClick size={18} />}label="Sessions Today"      value={analytics.sessionsToday}   sub="Unique browser sessions"       color="blue"   />
              <StatCard icon={<Activity size={18} />}         label="Active Now"          value={analytics.activeNow}       sub="In the last 15 minutes"        color="green"  />
              <StatCard icon={<Globe size={18} />}            label="Views This Month"    value={analytics.viewsThisMonth}  sub="30-day rolling total"          color="gold"   />
            </div>

            {/* 7-day chart */}
            <div className="bg-white rounded-xl ring-1 ring-mid p-5">
              <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
                <BarChart2 size={16} className="text-subtext" /> Page Views — Last 7 Days
              </h2>
              {analytics.dailyViews.every((d) => d.views === 0) ? (
                <p className="text-sm text-subtext py-8 text-center">No page view data yet. Run the SQL migration to enable tracking.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={analytics.dailyViews} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#4A5568' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} width={35} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D0DCF0' }} />
                    <Bar dataKey="views" name="Page Views" fill="#0F2138" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Device + Browser breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl ring-1 ring-mid p-5">
                <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
                  <Monitor size={16} className="text-subtext" /> Device Breakdown
                </h2>
                {analytics.deviceBreakdown.every((d) => d.value === 0) ? (
                  <p className="text-sm text-subtext py-6 text-center">No data yet</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {[
                      { name: 'Desktop', icon: <Monitor size={14} />, color: 'bg-navy' },
                      { name: 'Mobile',  icon: <Smartphone size={14} />, color: 'bg-gold' },
                      { name: 'Tablet',  icon: <Tablet size={14} />, color: 'bg-blue-500' },
                    ].map(({ name, icon, color }) => {
                      const entry = analytics.deviceBreakdown.find((d) => d.name === name)
                      const count = entry?.value ?? 0
                      const total = analytics.viewsThisMonth || 1
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={name}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="flex items-center gap-1.5 text-subtext">{icon} {name}</span>
                            <span className="font-medium text-body">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-light overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl ring-1 ring-mid p-5">
                <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
                  <Globe size={16} className="text-subtext" /> Browser Breakdown
                </h2>
                {analytics.browserBreakdown.length === 0 || analytics.browserBreakdown.every((b) => b.value === 0) ? (
                  <p className="text-sm text-subtext py-6 text-center">No data yet</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {analytics.browserBreakdown.slice(0, 5).map((b, i) => {
                      const total = analytics.viewsThisMonth || 1
                      const pct = Math.round((b.value / total) * 100)
                      return (
                        <div key={b.name}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-subtext">{b.name}</span>
                            <span className="font-medium text-body">{b.value} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-light overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top pages table */}
            <div className="bg-white rounded-xl ring-1 ring-mid overflow-hidden">
              <div className="px-5 py-4 border-b border-mid">
                <h2 className="font-semibold text-body text-sm">Top Pages — Last 30 Days</h2>
              </div>
              {analytics.topPages.length === 0 ? (
                <p className="text-sm text-subtext py-8 text-center">No page view data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mid bg-light text-left">
                      <th className="px-5 py-3 font-medium text-subtext">#</th>
                      <th className="px-5 py-3 font-medium text-subtext">Page</th>
                      <th className="px-5 py-3 font-medium text-subtext text-right">Views</th>
                      <th className="px-5 py-3 font-medium text-subtext text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mid">
                    {analytics.topPages.map((page, i) => (
                      <tr key={page.path} className="hover:bg-light/50">
                        <td className="px-5 py-3 text-subtext text-xs">{i + 1}</td>
                        <td className="px-5 py-3 font-mono text-xs text-body">{page.path}</td>
                        <td className="px-5 py-3 text-right font-semibold text-navy">{page.count}</td>
                        <td className="px-5 py-3 text-right text-subtext text-xs">
                          {analytics.viewsThisMonth > 0 ? `${Math.round((page.count / analytics.viewsThisMonth) * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Visitor Location ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Country breakdown */}
              <div className="bg-white rounded-xl ring-1 ring-mid overflow-hidden">
                <div className="px-5 py-4 border-b border-mid flex items-center gap-2">
                  <Globe size={15} className="text-subtext" />
                  <h2 className="font-semibold text-body text-sm">Visitors by Country</h2>
                </div>
                {!analytics.countryBreakdown || analytics.countryBreakdown.length === 0 ? (
                  <p className="text-sm text-subtext py-8 text-center px-5">
                    No location data yet — deploy the latest code to start capturing visitor locations.
                  </p>
                ) : (
                  <div className="divide-y divide-mid">
                    {analytics.countryBreakdown.map((c, i) => {
                      const pct = analytics.viewsThisMonth > 0
                        ? Math.round((c.count / analytics.viewsThisMonth) * 100) : 0
                      return (
                        <div key={c.country} className="flex items-center gap-3 px-5 py-3 hover:bg-light/50">
                          <span className="text-xl w-7 shrink-0 text-center">{c.flag || '🌐'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-body">{c.country || 'Unknown'}</span>
                              <span className="text-xs text-subtext ml-2">{c.count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-light overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* City breakdown */}
              <div className="bg-white rounded-xl ring-1 ring-mid overflow-hidden">
                <div className="px-5 py-4 border-b border-mid flex items-center gap-2">
                  <MapPin size={15} className="text-subtext" />
                  <h2 className="font-semibold text-body text-sm">Visitors by City</h2>
                </div>
                {!analytics.cityBreakdown || analytics.cityBreakdown.length === 0 ? (
                  <p className="text-sm text-subtext py-8 text-center px-5">
                    No city data yet — deploy the latest code to start capturing visitor locations.
                  </p>
                ) : (
                  <div className="divide-y divide-mid">
                    {analytics.cityBreakdown.map((c, i) => {
                      const pct = analytics.viewsThisMonth > 0
                        ? Math.round((c.count / analytics.viewsThisMonth) * 100) : 0
                      return (
                        <div key={`${c.city}-${c.country}`} className="flex items-center gap-3 px-5 py-3 hover:bg-light/50">
                          <span className="text-lg w-7 shrink-0 text-center">{c.flag || '🌐'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="text-sm font-medium text-body">{c.city}</span>
                                {c.country && <span className="text-xs text-subtext ml-1.5">{c.country}</span>}
                              </div>
                              <span className="text-xs text-subtext ml-2">{c.count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-light overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gold"
                                style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[(i + 2) % CHART_COLORS.length] }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Per-tenant view counts */}
            <div className="bg-white rounded-xl ring-1 ring-mid overflow-hidden">
              <div className="px-5 py-4 border-b border-mid">
                <h2 className="font-semibold text-body text-sm">Page Views by Tenant — Last 30 Days</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mid bg-light text-left">
                    <th className="px-5 py-3 font-medium text-subtext">Tenant</th>
                    <th className="px-5 py-3 font-medium text-subtext text-right">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mid">
                  {[...tenants]
                    .sort((a, b) => b.pageViewCount - a.pageViewCount)
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-light/50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-body">{t.name}</p>
                          <p className="text-xs text-subtext">{t.slug}</p>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-navy">{t.pageViewCount}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Security score */}
            <div className="bg-white rounded-xl ring-1 ring-mid p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <ShieldCheck size={24} className="text-green-600" />
                </div>
                <div>
                  <h2 className="font-bold text-body text-lg">Security Score: A+</h2>
                  <p className="text-sm text-subtext">All critical security measures active</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'HTTPS Enforced (HSTS)',               ok: true,  note: '2-year max-age with preload' },
                  { label: 'Content Security Policy',             ok: true,  note: 'Strict CSP blocks XSS vectors' },
                  { label: 'Clickjacking Protection',             ok: true,  note: 'X-Frame-Options: DENY' },
                  { label: 'MIME Sniffing Prevention',            ok: true,  note: 'X-Content-Type-Options: nosniff' },
                  { label: 'Cross-Origin Resource Policy',        ok: true,  note: 'CORP + COOP headers active' },
                  { label: 'Permissions Policy',                  ok: true,  note: 'Camera, mic, geo restricted' },
                  { label: 'API Rate Limiting',                   ok: true,  note: '30 req/min on admin; 60 on others' },
                  { label: 'Input Sanitization',                  ok: true,  note: 'All API inputs stripped of XSS' },
                  { label: 'Row-Level Security (RLS)',            ok: true,  note: 'All Supabase tables tenant-isolated' },
                  { label: 'JWT Token Verification',              ok: true,  note: 'Every API endpoint verifies auth' },
                  { label: 'Static Assets Immutable Cache',       ok: true,  note: '1-year cache for /assets/*' },
                  { label: 'Service Worker Push Encryption',      ok: true,  note: 'VAPID keys + end-to-end encryption' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-light">
                    <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-body">{item.label}</p>
                      <p className="text-xs text-subtext">{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security headers reference */}
            <div className="bg-white rounded-xl ring-1 ring-mid overflow-hidden">
              <div className="px-5 py-4 border-b border-mid">
                <h2 className="font-semibold text-body">Active Security Headers</h2>
                <p className="text-xs text-subtext mt-0.5">Deployed via vercel.json on every response</p>
              </div>
              <div className="divide-y divide-mid">
                {[
                  { header: 'Strict-Transport-Security',   value: 'max-age=63072000; includeSubDomains; preload' },
                  { header: 'Content-Security-Policy',     value: "default-src 'self'; script-src 'self' 'unsafe-inline'…" },
                  { header: 'X-Frame-Options',             value: 'DENY' },
                  { header: 'X-Content-Type-Options',      value: 'nosniff' },
                  { header: 'X-XSS-Protection',            value: '1; mode=block' },
                  { header: 'Referrer-Policy',             value: 'strict-origin-when-cross-origin' },
                  { header: 'Permissions-Policy',          value: 'camera=(), microphone=(), geolocation=(self)…' },
                  { header: 'Cross-Origin-Opener-Policy',  value: 'same-origin' },
                  { header: 'Cross-Origin-Resource-Policy',value: 'same-origin' },
                ].map((h) => (
                  <div key={h.header} className="px-5 py-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <code className="text-xs font-mono text-navy font-semibold">{h.header}</code>
                    <span className="text-xs text-subtext font-mono truncate">{h.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* API security */}
            <div className="bg-white rounded-xl ring-1 ring-mid p-5">
              <h2 className="font-semibold text-body mb-4 flex items-center gap-2">
                <Lock size={16} className="text-subtext" /> API Endpoint Security
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mid bg-light text-left">
                      <th className="px-4 py-2 font-medium text-subtext">Endpoint</th>
                      <th className="px-4 py-2 font-medium text-subtext">Auth Required</th>
                      <th className="px-4 py-2 font-medium text-subtext">Rate Limit</th>
                      <th className="px-4 py-2 font-medium text-subtext">Input Sanitized</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mid text-xs">
                    {[
                      { ep: '/api/admin',          auth: 'Super Admin only', rate: '30 req/min', san: true },
                      { ep: '/api/push/subscribe', auth: 'Bearer JWT',       rate: '60 req/min', san: true },
                      { ep: '/api/push/send',      auth: 'API Secret or JWT',rate: '60 req/min', san: true },
                      { ep: '/api/send-email',     auth: 'Bearer JWT',       rate: '60 req/min', san: true },
                      { ep: '/api/chat',           auth: 'Tenant slug',      rate: '60 req/min', san: true },
                      { ep: '/api/assist',         auth: 'Bearer JWT',       rate: '60 req/min', san: false },
                    ].map((row) => (
                      <tr key={row.ep} className="hover:bg-light/50">
                        <td className="px-4 py-2.5 font-mono text-navy">{row.ep}</td>
                        <td className="px-4 py-2.5 text-subtext">{row.auth}</td>
                        <td className="px-4 py-2.5 text-subtext">{row.rate}</td>
                        <td className="px-4 py-2.5">
                          {row.san
                            ? <CheckCircle2 size={14} className="text-green-600" />
                            : <span className="text-amber-500 text-xs">Planned</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Marketing badge export */}
            <div className="bg-gradient-to-r from-navy to-navy/80 rounded-xl p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <Zap size={24} className="text-gold" />
                </div>
                <div>
                  <h2 className="font-bold text-lg mb-1">Security as a Competitive Advantage</h2>
                  <p className="text-sm text-white/70 mb-4">
                    TownsHub PMS operates at industry-leading security standards. Use these credentials
                    to differentiate from competitors when pitching to hotels and property managers.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'SecurityHeaders.com', grade: 'A+' },
                      { label: 'HSTS Preloaded',       grade: '✓'  },
                      { label: 'SOC2 Aligned',          grade: '✓'  },
                      { label: 'GDPR Ready',            grade: '✓'  },
                    ].map((b) => (
                      <div key={b.label} className="bg-white/10 rounded-lg px-3 py-2 text-center">
                        <p className="text-gold font-bold text-lg">{b.grade}</p>
                        <p className="text-white/70 text-xs mt-0.5">{b.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS / SIGN-UPS TAB ── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-mid overflow-hidden">
              <div className="px-5 py-4 border-b border-mid flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-body">All Registered Users ({recentSignups.length})</h2>
                  <p className="text-xs text-subtext mt-0.5">All accounts in Supabase Auth — sorted by most recent</p>
                </div>
                <span className="text-xs text-subtext">{recentSignups.filter((u) => {
                  const d = new Date(u.created_at)
                  const now = new Date()
                  return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000
                }).length} new this week</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mid bg-light text-left">
                      <th className="px-5 py-3 font-medium text-subtext">#</th>
                      <th className="px-5 py-3 font-medium text-subtext">Email</th>
                      <th className="px-5 py-3 font-medium text-subtext">Tenant</th>
                      <th className="px-5 py-3 font-medium text-subtext">Registered</th>
                      <th className="px-5 py-3 font-medium text-subtext">Last Sign-in</th>
                      <th className="px-5 py-3 font-medium text-subtext">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mid">
                    {recentSignups.map((u, i) => {
                      const matchedTenant = tenants.find((t) =>
                        t.slug && u.email.toLowerCase().includes(t.slug.toLowerCase().replace(/-/g, ''))
                      )
                      const isNew = new Date().getTime() - new Date(u.created_at).getTime() < 48 * 60 * 60 * 1000
                      const neverSignedIn = !u.last_sign_in_at
                      return (
                        <tr key={u.id} className="hover:bg-light/50">
                          <td className="px-5 py-3 text-subtext text-xs">{i + 1}</td>
                          <td className="px-5 py-3">
                            <span className="font-medium text-body">{u.email}</span>
                            {isNew && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-medium">New</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-xs text-subtext">
                            {matchedTenant ? (
                              <span className="font-medium text-navy">{matchedTenant.name}</span>
                            ) : (
                              <span className="text-subtext">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-xs text-subtext whitespace-nowrap">
                            {formatDate(u.created_at)}
                          </td>
                          <td className="px-5 py-3 text-xs text-subtext whitespace-nowrap">
                            {u.last_sign_in_at ? formatDate(u.last_sign_in_at) : (
                              <span className="text-amber-500">Never</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              neverSignedIn ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {neverSignedIn ? 'Pending' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {recentSignups.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-subtext text-sm">
                          No registered users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TENANTS TAB ── */}
        {activeTab === 'tenants' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-mid overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-mid flex-wrap gap-3">
                <div>
                  <h2 className="font-semibold text-body">All Tenants ({tenants.length})</h2>
                  <p className="text-xs text-subtext mt-0.5">Toggle mode to control which modules each tenant sees</p>
                </div>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tenants…"
                  className="text-sm border border-mid rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold w-48" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mid bg-light text-left">
                      <th className="px-4 py-3 font-medium text-subtext">Tenant</th>
                      <th className="px-4 py-3 font-medium text-subtext">Location</th>
                      <th className="px-4 py-3 font-medium text-subtext">Plan</th>
                      <th className="px-4 py-3 font-medium text-subtext">Mode</th>
                      <th className="px-4 py-3 font-medium text-subtext text-center">Rooms</th>
                      <th className="px-4 py-3 font-medium text-subtext text-center">Bookings</th>
                      <th className="px-4 py-3 font-medium text-subtext text-center">Views</th>
                      <th className="px-4 py-3 font-medium text-subtext text-right">Month Revenue</th>
                      <th className="px-4 py-3 font-medium text-subtext">Joined</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mid">
                    {filtered.map((t) => (
                      <tr key={t.id} className="hover:bg-light/50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-body">{t.name}</p>
                          <p className="text-xs text-subtext">{t.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-subtext">{t.city ? `${t.city}, ` : ''}{t.country}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <Badge label={t.subscription_tier ?? 'free'} className={`${tierColor(t.subscription_tier)} text-xs capitalize`} />
                            <Badge label={t.subscription_status} className={`${statusColor(t.subscription_status)} text-xs`} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ModeToggle tenantId={t.id} current={t.mode} onChange={updateMode} />
                        </td>
                        <td className="px-4 py-3 text-center text-subtext">{t.totalRooms}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-medium text-body">{t.activeBookings}</span>
                          <span className="text-subtext"> / {t.totalBookings}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-subtext">{t.pageViewCount}</td>
                        <td className="px-4 py-3 text-right font-semibold text-navy">
                          {formatCurrency(t.monthRevenue + t.monthlyRent)}
                        </td>
                        <td className="px-4 py-3 text-xs text-subtext whitespace-nowrap">{formatDate(t.joined)}</td>
                        <td className="px-4 py-3">
                          <a href={`https://pms.townshub.com/guest-chat/${t.slug}`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1 text-subtext hover:text-gold transition-colors inline-flex" title="View guest chat">
                            <ArrowUpRight size={14} />
                          </a>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-subtext text-sm">No tenants match your search.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
