import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, BedDouble, TrendingUp, CalendarCheck,
  ShieldCheck, Globe, Activity, RefreshCw, ArrowUpRight,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'

const SUPER_ADMIN_EMAILS = ['childrenfromlight@gmail.com']

interface PlatformStats {
  totalHotels: number
  totalRooms: number
  totalBookings: number
  totalGuests: number
  totalRevenue: number
  monthRevenue: number
  activeBookings: number
  occupiedRooms: number
}

interface HotelStat {
  id: string
  name: string
  slug: string
  city: string | null
  country: string
  subscription_tier: string | null
  subscription_status: string
  joined: string
  totalRooms: number
  occupiedRooms: number
  occupancyRate: number
  totalBookings: number
  activeBookings: number
  totalRevenue: number
  monthRevenue: number
  totalGuests: number
  pendingHk: number
  activeFbOrders: number
}

interface AdminData {
  platform: PlatformStats
  hotels: HotelStat[]
  recentSignups: { id: string; name: string; slug: string; created_at: string }[]
}

function StatCard({ icon, label, value, sub, color = 'navy' }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  const bg: Record<string, string> = {
    navy: 'bg-navy', gold: 'bg-gold', green: 'bg-green-600', blue: 'bg-blue-600', purple: 'bg-purple-600'
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

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user?.email ?? '')

  useEffect(() => {
    if (!isSuperAdmin) { navigate('/dashboard', { replace: true }); return }
    fetchData()
  }, [isSuperAdmin])

  async function fetchData() {
    setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('No session')

      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load admin data')
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (!isSuperAdmin) return null
  if (loading) return <DashboardLayout><div className="flex justify-center py-20"><LoadingSpinner /></div></DashboardLayout>
  if (error) return <DashboardLayout><p className="text-red-600 text-sm p-6">{error}</p></DashboardLayout>
  if (!data) return null

  const { platform, hotels } = data
  const filtered = hotels.filter((h) =>
    !search || h.name.toLowerCase().includes(search.toLowerCase()) || h.city?.toLowerCase().includes(search.toLowerCase())
  )

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
            <p className="text-sm text-subtext">Live overview of all hotels on the platform</p>
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm border border-mid rounded-lg px-3 py-2 text-subtext hover:text-body hover:bg-light transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Platform KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Building2 size={18} />} label="Total Hotels"    value={platform.totalHotels}               sub="Registered properties"            color="navy"   />
          <StatCard icon={<BedDouble size={18} />} label="Total Rooms"     value={platform.totalRooms}                sub={`${platform.occupiedRooms} occupied`} color="blue"   />
          <StatCard icon={<CalendarCheck size={18}/>}label="Active Bookings" value={platform.activeBookings}           sub={`${platform.totalBookings} all-time`} color="green"  />
          <StatCard icon={<Users size={18} />}     label="Total Guests"   value={platform.totalGuests}               sub="Across all properties"            color="purple" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatCard icon={<TrendingUp size={18} />} label="Platform Revenue" value={formatCurrency(platform.totalRevenue)} sub="All-time across all hotels" color="gold" />
          <StatCard icon={<Activity size={18} />}   label="This Month"       value={formatCurrency(platform.monthRevenue)} sub="Combined monthly revenue"  color="navy" />
          <StatCard icon={<Globe size={18} />}      label="Occupancy"
            value={platform.totalRooms > 0 ? `${Math.round((platform.occupiedRooms / platform.totalRooms) * 100)}%` : '—'}
            sub="Platform-wide average" color="blue" />
        </div>

        {/* Hotel table */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-mid overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-mid flex-wrap gap-3">
            <h2 className="font-semibold text-body">All Hotels ({hotels.length})</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search hotels…"
              className="text-sm border border-mid rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold w-48"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light text-left">
                  <th className="px-4 py-3 font-medium text-subtext">Hotel</th>
                  <th className="px-4 py-3 font-medium text-subtext">Location</th>
                  <th className="px-4 py-3 font-medium text-subtext">Plan</th>
                  <th className="px-4 py-3 font-medium text-subtext text-center">Rooms</th>
                  <th className="px-4 py-3 font-medium text-subtext text-center">Occupancy</th>
                  <th className="px-4 py-3 font-medium text-subtext text-center">Bookings</th>
                  <th className="px-4 py-3 font-medium text-subtext text-center">Guests</th>
                  <th className="px-4 py-3 font-medium text-subtext text-right">Month Revenue</th>
                  <th className="px-4 py-3 font-medium text-subtext">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {filtered.map((h) => (
                  <tr key={h.id} className="hover:bg-light/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-body">{h.name}</p>
                      <p className="text-xs text-subtext">{h.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-subtext">{h.city ? `${h.city}, ` : ''}{h.country}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge label={h.subscription_tier ?? 'free'} className={`${tierColor(h.subscription_tier)} text-xs capitalize`} />
                        <Badge label={h.subscription_status} className={`${statusColor(h.subscription_status)} text-xs`} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-subtext">{h.totalRooms}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${h.occupancyRate >= 70 ? 'text-green-600' : h.occupancyRate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                        {h.occupancyRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-body">{h.activeBookings}</span>
                      <span className="text-subtext"> / {h.totalBookings}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-subtext">{h.totalGuests}</td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">{formatCurrency(h.monthRevenue)}</td>
                    <td className="px-4 py-3 text-xs text-subtext whitespace-nowrap">{formatDate(h.joined)}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://pms.townshub.com/guest-chat/${h.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-subtext hover:text-gold transition-colors inline-flex"
                        title="View guest chat"
                      >
                        <ArrowUpRight size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-subtext text-sm">No hotels match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity indicators per hotel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hotels.filter((h) => h.totalRooms > 0).map((h) => (
            <div key={h.id} className="bg-white rounded-xl ring-1 ring-mid p-4">
              <p className="font-semibold text-body text-sm mb-3 truncate">{h.name}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-subtext">Occupancy</span>
                  <span className="font-medium text-body">{h.occupancyRate}%</span>
                </div>
                <div className="w-full bg-light rounded-full h-1.5">
                  <div className="bg-gold h-1.5 rounded-full" style={{ width: `${h.occupancyRate}%` }} />
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-subtext">Active bookings</span>
                  <span className="font-medium text-body">{h.activeBookings}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-subtext">Pending housekeeping</span>
                  <span className={`font-medium ${h.pendingHk > 5 ? 'text-red-500' : 'text-body'}`}>{h.pendingHk}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-subtext">Live F&B orders</span>
                  <span className={`font-medium ${h.activeFbOrders > 0 ? 'text-amber-600' : 'text-body'}`}>{h.activeFbOrders}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-mid pt-2 mt-1">
                  <span className="text-subtext">Month revenue</span>
                  <span className="font-semibold text-navy">{formatCurrency(h.monthRevenue)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
