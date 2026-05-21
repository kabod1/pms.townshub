import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, BedDouble, Star, Users, BarChart3, ShoppingCart } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import { BOOKING_STATUS_LABELS } from '@/lib/constants'

function useExecutiveData() {
  const { tenant } = useAuthStore()
  const today = new Date()
  const sixMonthsAgo = subMonths(today, 5)

  return useQuery({
    queryKey: ['executive-dashboard', tenant?.id],
    queryFn: async () => {
      const months = eachMonthOfInterval({ start: sixMonthsAgo, end: today })
      const [roomsRes, currentMonthRes, allBookingsRes, guestCountRes, surveyRes, fbRes] = await Promise.all([
        supabase.from('rooms').select('status, is_active').eq('tenant_id', tenant!.id).eq('is_active', true),
        supabase.from('bookings').select('total_amount, room_rate, status, check_in_date, check_out_date')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', format(startOfMonth(today), 'yyyy-MM-dd'))
          .lte('check_in_date', format(endOfMonth(today), 'yyyy-MM-dd')),
        supabase.from('bookings').select('total_amount, room_rate, status, check_in_date, check_out_date')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd')),
        supabase.from('guests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant!.id),
        supabase.from('surveys').select('nps_score, overall_rating').eq('tenant_id', tenant!.id).not('nps_score', 'is', null),
        supabase.from('fb_orders').select('subtotal').eq('tenant_id', tenant!.id).neq('status', 'cancelled')
          .gte('created_at', format(startOfMonth(today), 'yyyy-MM-dd')),
      ])

      const rooms = roomsRes.data ?? []
      const totalRooms = rooms.length
      const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

      const thisMonthBookings = currentMonthRes.data ?? []
      const totalRevenue = thisMonthBookings.reduce((s, b) => s + Number(b.total_amount), 0)
      const adr = thisMonthBookings.length > 0
        ? thisMonthBookings.reduce((s, b) => s + Number(b.room_rate), 0) / thisMonthBookings.length
        : 0
      const revpar = adr * (occupancyRate / 100)
      const totalCosts = totalRevenue * 0.35
      const goppar = totalRooms > 0 ? (totalRevenue - totalCosts) / totalRooms : 0

      const surveys = surveyRes.data ?? []
      const avgNPS = surveys.length > 0
        ? Math.round(surveys.reduce((s, r) => s + (r.nps_score ?? 0), 0) / surveys.length)
        : null
      const promoters = surveys.filter((s) => (s.nps_score ?? 0) >= 9).length
      const detractors = surveys.filter((s) => (s.nps_score ?? 0) <= 6).length
      const npsScore = surveys.length > 0 ? Math.round(((promoters - detractors) / surveys.length) * 100) : null

      const fbRevenue = (fbRes.data ?? []).reduce((s, o) => s + Number(o.subtotal), 0)

      // Monthly trend (6 months)
      const allBookings = allBookingsRes.data ?? []
      const monthlyTrend = months.map((month) => {
        const ms = format(startOfMonth(month), 'yyyy-MM-dd')
        const me = format(endOfMonth(month), 'yyyy-MM-dd')
        const mb = allBookings.filter((b) => b.check_in_date >= ms && b.check_in_date <= me)
        return {
          month: format(month, 'MMM yy'),
          revenue: mb.reduce((s, b) => s + Number(b.total_amount), 0),
          bookings: mb.length,
        }
      })

      // Status breakdown
      const statusMap: Record<string, number> = {}
      for (const b of thisMonthBookings) {
        statusMap[b.status] = (statusMap[b.status] ?? 0) + 1
      }

      return {
        totalRooms,
        occupiedRooms,
        occupancyRate,
        totalRevenue,
        adr,
        revpar,
        goppar,
        totalGuests: guestCountRes.count ?? 0,
        avgNPS,
        npsScore,
        fbRevenue,
        monthlyTrend,
        statusMap,
      }
    },
    enabled: !!tenant,
  })
}

export default function ExecutiveDashboard() {
  const { tenant } = useAuthStore()
  const { data, isLoading } = useExecutiveData()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-body">Executive Dashboard</h1>
          <p className="text-sm text-subtext">Consolidated business intelligence — current month</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : data ? (
          <>
            {/* Core KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard title="Revenue (MTD)" value={formatCurrency(data.totalRevenue, tenant?.currency)} icon={<TrendingUp size={20} />} color="green" />
              <StatCard title="Occupancy Rate" value={`${data.occupancyRate}%`} subtitle={`${data.occupiedRooms}/${data.totalRooms} rooms`} icon={<BedDouble size={20} />} color="navy" />
              <StatCard title="ADR" value={formatCurrency(data.adr, tenant?.currency)} subtitle="Avg daily rate" icon={<BarChart3 size={20} />} color="gold" />
              <StatCard title="RevPAR" value={formatCurrency(data.revpar, tenant?.currency)} subtitle="Rev per available room" icon={<BarChart3 size={20} />} color="blue" />
            </div>

            {/* Extended KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard title="GOPPAR" value={formatCurrency(data.goppar, tenant?.currency)} subtitle="Gross op. profit per room" icon={<TrendingUp size={20} />} color="green" />
              <StatCard title="F&B Revenue (MTD)" value={formatCurrency(data.fbRevenue, tenant?.currency)} icon={<ShoppingCart size={20} />} color="navy" />
              <StatCard title="NPS Score" value={data.npsScore !== null ? `${data.npsScore > 0 ? '+' : ''}${data.npsScore}` : '—'} subtitle="Net Promoter Score" icon={<Star size={20} />} color="gold" />
              <StatCard title="Total Guests" value={data.totalGuests.toLocaleString()} icon={<Users size={20} />} color="blue" />
            </div>

            {/* Revenue trend */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
              <h2 className="text-sm font-semibold text-body mb-4">Revenue Trend — Last 6 Months</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.monthlyTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${Math.round(v / 1000)}k`} width={50} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v), tenant?.currency)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="revenue" fill="#0B1F4B" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Booking volume + Health indicators */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Bookings per Month — Last 6 Months</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.monthlyTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="bookings" fill="#C9A84C" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Performance Health</h2>
                <div className="space-y-3">
                  {[
                    { label: 'Occupancy', value: data.occupancyRate, target: 75, suffix: '%' },
                    { label: 'NPS Score', value: data.avgNPS ?? 0, target: 8, suffix: '/10' },
                  ].map(({ label, value, target, suffix }) => {
                    const pct = Math.min(100, Math.round((value / target) * 100))
                    const good = value >= target
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span className="text-body">{label}</span>
                          <span className={`font-semibold ${good ? 'text-green-600' : 'text-amber-600'}`}>
                            {value}{suffix} <span className="text-xs text-subtext font-normal">target: {target}{suffix}</span>
                          </span>
                        </div>
                        <div className="h-2 bg-light rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${good ? 'bg-green-500' : 'bg-amber-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  <div className="pt-2 border-t border-mid space-y-1 text-sm">
                    {Object.entries(data.statusMap).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span className="text-subtext capitalize">{BOOKING_STATUS_LABELS[status as keyof typeof BOOKING_STATUS_LABELS] ?? status}</span>
                        <span className="font-semibold text-body">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
