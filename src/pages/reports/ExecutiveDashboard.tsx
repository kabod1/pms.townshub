import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, BedDouble, Star, Users, BarChart3, ShoppingCart, Crown } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval,
} from 'date-fns'
import { BOOKING_STATUS_LABELS, BOOKING_SOURCE_LABELS } from '@/lib/constants'
import type { BookingSource } from '@/types'

const CHART_COLORS = ['#0B1F4B', '#C9A84C', '#1A5CB5', '#1B5E20', '#E65100', '#B71C1C']

function useExecutiveData() {
  const { tenant } = useAuthStore()
  const today = new Date()
  const twelveMonthsAgo = subMonths(today, 11)
  const sixMonthsAgo = subMonths(today, 5)

  return useQuery({
    queryKey: ['executive-dashboard', tenant?.id],
    queryFn: async () => {
      const months12 = eachMonthOfInterval({ start: twelveMonthsAgo, end: today })
      const months6 = eachMonthOfInterval({ start: sixMonthsAgo, end: today })

      const [
        roomsRes,
        currentMonthRes,
        allBookingsRes,
        guestCountRes,
        surveyRes,
        fbRes,
        topGuestsRes,
        sourceRes,
      ] = await Promise.all([
        supabase
          .from('rooms')
          .select('status, is_active')
          .eq('tenant_id', tenant!.id)
          .eq('is_active', true),
        supabase
          .from('bookings')
          .select('total_amount, room_rate, status, check_in_date, check_out_date')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', format(startOfMonth(today), 'yyyy-MM-dd'))
          .lte('check_in_date', format(endOfMonth(today), 'yyyy-MM-dd')),
        // 12-month booking history for trend
        supabase
          .from('bookings')
          .select('total_amount, room_rate, status, check_in_date, check_out_date')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', format(startOfMonth(twelveMonthsAgo), 'yyyy-MM-dd')),
        supabase
          .from('guests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant!.id),
        supabase
          .from('surveys')
          .select('nps_score, overall_rating')
          .eq('tenant_id', tenant!.id)
          .not('nps_score', 'is', null),
        supabase
          .from('fb_orders')
          .select('subtotal')
          .eq('tenant_id', tenant!.id)
          .neq('status', 'cancelled')
          .gte('created_at', format(startOfMonth(today), 'yyyy-MM-dd')),
        // Top 5 guests by total_spent
        supabase
          .from('guests')
          .select('id, first_name, last_name, total_stays, total_spent, vip_status')
          .eq('tenant_id', tenant!.id)
          .gt('total_spent', 0)
          .order('total_spent', { ascending: false })
          .limit(5),
        // Booking source breakdown (current month)
        supabase
          .from('bookings')
          .select('source')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', format(startOfMonth(today), 'yyyy-MM-dd'))
          .lte('check_in_date', format(endOfMonth(today), 'yyyy-MM-dd')),
      ])

      const rooms = roomsRes.data ?? []
      const totalRooms = rooms.length
      const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

      const thisMonthBookings = currentMonthRes.data ?? []
      const totalRevenue = thisMonthBookings.reduce((s, b) => s + Number(b.total_amount), 0)
      const adr =
        thisMonthBookings.length > 0
          ? thisMonthBookings.reduce((s, b) => s + Number(b.room_rate), 0) / thisMonthBookings.length
          : 0
      const revpar = adr * (occupancyRate / 100)
      const totalCosts = totalRevenue * 0.35
      const goppar = totalRooms > 0 ? (totalRevenue - totalCosts) / totalRooms : 0

      const surveys = surveyRes.data ?? []
      const avgNPS =
        surveys.length > 0
          ? Math.round(surveys.reduce((s, r) => s + (r.nps_score ?? 0), 0) / surveys.length)
          : null
      const promoters = surveys.filter((s) => (s.nps_score ?? 0) >= 9).length
      const detractors = surveys.filter((s) => (s.nps_score ?? 0) <= 6).length
      const npsScore =
        surveys.length > 0 ? Math.round(((promoters - detractors) / surveys.length) * 100) : null

      const fbRevenue = (fbRes.data ?? []).reduce((s, o) => s + Number(o.subtotal), 0)

      // 12-month revenue trend
      const allBookings = allBookingsRes.data ?? []
      const monthlyTrend12 = months12.map((month) => {
        const ms = format(startOfMonth(month), 'yyyy-MM-dd')
        const me = format(endOfMonth(month), 'yyyy-MM-dd')
        const mb = allBookings.filter((b) => b.check_in_date >= ms && b.check_in_date <= me)
        return {
          month: format(month, 'MMM yy'),
          revenue: mb.reduce((s, b) => s + Number(b.total_amount), 0),
          bookings: mb.length,
        }
      })

      // 6-month occupancy heatmap data
      const monthlyOccupancy = months6.map((month) => {
        const ms = format(startOfMonth(month), 'yyyy-MM-dd')
        const me = format(endOfMonth(month), 'yyyy-MM-dd')
        const mb = allBookings.filter((b) => b.check_in_date >= ms && b.check_in_date <= me)
        const uniqueRooms = new Set(mb.map((b) => (b as { room_id?: string }).room_id).filter(Boolean)).size
        return {
          month: format(month, 'MMM yy'),
          occupancy: totalRooms > 0 ? Math.min(Math.round((uniqueRooms / totalRooms) * 100), 100) : 0,
        }
      })

      // Booking source pie
      const sourceMap: Partial<Record<BookingSource, number>> = {}
      for (const b of sourceRes.data ?? []) {
        const src = b.source as BookingSource
        sourceMap[src] = (sourceMap[src] ?? 0) + 1
      }
      const sourceData = Object.entries(sourceMap).map(([source, count]) => ({
        name: BOOKING_SOURCE_LABELS[source as BookingSource] ?? source,
        value: count,
      }))

      // Status breakdown current month
      const statusMap: Record<string, number> = {}
      for (const b of thisMonthBookings) {
        statusMap[b.status] = (statusMap[b.status] ?? 0) + 1
      }

      const topGuests = topGuestsRes.data ?? []

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
        monthlyTrend: monthlyTrend12,
        monthlyOccupancy,
        sourceData,
        statusMap,
        topGuests,
      }
    },
    enabled: !!tenant,
  })
}

const VIP_COLORS: Record<string, string> = {
  platinum: 'bg-purple-100 text-purple-800',
  gold: 'bg-amber-100 text-amber-800',
  silver: 'bg-gray-100 text-gray-700',
  regular: 'bg-blue-50 text-blue-700',
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
              <StatCard
                title="Revenue (MTD)"
                value={formatCurrency(data.totalRevenue, tenant?.currency)}
                icon={<TrendingUp size={20} />}
                color="green"
              />
              <StatCard
                title="Occupancy Rate"
                value={`${data.occupancyRate}%`}
                subtitle={`${data.occupiedRooms}/${data.totalRooms} rooms`}
                icon={<BedDouble size={20} />}
                color="navy"
              />
              <StatCard
                title="ADR"
                value={formatCurrency(data.adr, tenant?.currency)}
                subtitle="Avg daily rate"
                icon={<BarChart3 size={20} />}
                color="gold"
              />
              <StatCard
                title="RevPAR"
                value={formatCurrency(data.revpar, tenant?.currency)}
                subtitle="Rev per available room"
                icon={<BarChart3 size={20} />}
                color="blue"
              />
            </div>

            {/* Extended KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                title="GOPPAR"
                value={formatCurrency(data.goppar, tenant?.currency)}
                subtitle="Gross op. profit per room"
                icon={<TrendingUp size={20} />}
                color="green"
              />
              <StatCard
                title="F&B Revenue (MTD)"
                value={formatCurrency(data.fbRevenue, tenant?.currency)}
                icon={<ShoppingCart size={20} />}
                color="navy"
              />
              <StatCard
                title="NPS Score"
                value={data.npsScore !== null ? `${data.npsScore > 0 ? '+' : ''}${data.npsScore}` : '—'}
                subtitle="Net Promoter Score"
                icon={<Star size={20} />}
                color="gold"
              />
              <StatCard
                title="Total Guests"
                value={data.totalGuests.toLocaleString()}
                icon={<Users size={20} />}
                color="blue"
              />
            </div>

            {/* Revenue trend — 12 months */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
              <h2 className="text-sm font-semibold text-body mb-4">Revenue Trend — Last 12 Months</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.monthlyTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#4A5568' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `€${Math.round(v / 1000)}k`}
                    width={50}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v), tenant?.currency)}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="revenue" fill="#0B1F4B" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Occupancy heatmap + Booking sources */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Occupancy trend */}
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Occupancy Rate — Last 6 Months</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.monthlyOccupancy} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#4A5568' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                      width={40}
                    />
                    <Tooltip
                      formatter={(v) => `${v}%`}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D0DCF0' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="occupancy"
                      stroke="#C9A84C"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#C9A84C' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Booking source pie */}
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Booking Sources — Current Month</h2>
                {data.sourceData.length === 0 ? (
                  <p className="text-sm text-subtext py-12 text-center">No booking data this month</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={data.sourceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {data.sourceData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => String(value)}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D0DCF0' }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => <span style={{ fontSize: 11, color: '#4A5568' }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Booking volume + Health indicators */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Bookings per Month — Last 12 Months</h2>
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

              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
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
                            {value}{suffix}{' '}
                            <span className="text-xs text-subtext font-normal">target: {target}{suffix}</span>
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
                        <span className="text-subtext capitalize">
                          {BOOKING_STATUS_LABELS[status as keyof typeof BOOKING_STATUS_LABELS] ?? status}
                        </span>
                        <span className="font-semibold text-body">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Top 5 Guests by Spend */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-mid">
                <Crown size={16} className="text-gold" />
                <h2 className="text-sm font-semibold text-body">Top 5 Guests by Total Spend</h2>
              </div>
              {data.topGuests.length === 0 ? (
                <p className="text-sm text-subtext text-center py-8">No guest spend data yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mid bg-light">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Guest</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">VIP</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-subtext uppercase tracking-wide">Stays</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-subtext uppercase tracking-wide">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mid">
                    {data.topGuests.map((guest, i) => (
                      <tr key={guest.id} className="hover:bg-light transition-colors">
                        <td className="px-5 py-3 text-subtext font-medium">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-body">
                            {guest.first_name} {guest.last_name}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${VIP_COLORS[guest.vip_status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {guest.vip_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-body">{guest.total_stays}</td>
                        <td className="px-4 py-3 text-right font-semibold text-body">
                          {formatCurrency(Number(guest.total_spent), tenant?.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
