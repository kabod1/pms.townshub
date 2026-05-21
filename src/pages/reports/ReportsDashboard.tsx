import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, BedDouble, Users, BarChart3 } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, subMonths,
  eachDayOfInterval, parseISO, subDays,
} from 'date-fns'
import type { Booking, BookingSource } from '@/types'
import { BOOKING_SOURCE_LABELS } from '@/lib/constants'

const CHART_COLORS = ['#0B1F4B', '#C9A84C', '#1A5CB5', '#1B5E20', '#E65100', '#B71C1C']

function useReportsData() {
  const { tenant } = useAuthStore()
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  const lastMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(subDays(new Date(), 29), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['reports', tenant?.id, monthStart],
    queryFn: async () => {
      const [roomsRes, thisMonthRes, lastMonthRes, guestsRes, recentBookingsRes] = await Promise.all([
        supabase.from('rooms').select('status').eq('tenant_id', tenant!.id).eq('is_active', true),
        supabase.from('bookings')
          .select('total_amount, room_rate, check_in_date, check_out_date, source, status')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', monthStart)
          .lte('check_in_date', monthEnd),
        supabase.from('bookings')
          .select('total_amount')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', lastMonthStart)
          .lte('check_in_date', lastMonthEnd),
        supabase.from('guests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant!.id),
        supabase.from('bookings')
          .select('total_amount, check_in_date, source, status')
          .eq('tenant_id', tenant!.id)
          .gte('check_in_date', thirtyDaysAgo)
          .order('check_in_date'),
      ])

      const rooms = roomsRes.data ?? []
      const thisMonthBookings = thisMonthRes.data ?? []
      const lastMonthBookings = lastMonthRes.data ?? []
      const recentBookings = (recentBookingsRes.data ?? []) as Pick<Booking, 'total_amount' | 'check_in_date' | 'source' | 'status'>[]
      const totalRooms = rooms.length
      const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length

      const revenueThisMonth = thisMonthBookings.reduce((s, b) => s + Number(b.total_amount), 0)
      const revenueLastMonth = lastMonthBookings.reduce((s, b) => s + Number(b.total_amount), 0)
      const revenueTrend = revenueLastMonth > 0
        ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
        : 0

      const adr = thisMonthBookings.length > 0
        ? thisMonthBookings.reduce((s, b) => s + Number(b.room_rate), 0) / thisMonthBookings.length
        : 0

      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
      const revpar = adr * (occupancyRate / 100)
      // GOPPAR: Gross Operating Profit Per Available Room (estimated at 65% GOP margin)
      const goppar = totalRooms > 0 ? (revenueThisMonth * 0.65) / totalRooms : 0

      // Daily revenue for last 30 days
      const days = eachDayOfInterval({ start: parseISO(thirtyDaysAgo), end: new Date() })
      const dailyRevenue = days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const dayBookings = recentBookings.filter((b) => b.check_in_date === dayStr)
        return {
          date: format(day, 'dd MMM'),
          revenue: dayBookings.reduce((s, b) => s + Number(b.total_amount), 0),
          bookings: dayBookings.length,
        }
      })

      // Booking source breakdown
      const sourceMap: Partial<Record<BookingSource, number>> = {}
      for (const b of recentBookings) {
        const src = b.source as BookingSource
        sourceMap[src] = (sourceMap[src] ?? 0) + 1
      }
      const sourceData = Object.entries(sourceMap).map(([source, count]) => ({
        name: BOOKING_SOURCE_LABELS[source as BookingSource] ?? source,
        value: count,
      }))

      return {
        revenueThisMonth, revenueTrend, occupancyRate, adr, revpar, goppar,
        totalBookings: thisMonthBookings.length,
        totalGuests: guestsRes.count ?? 0,
        dailyRevenue,
        sourceData,
      }
    },
    enabled: !!tenant,
  })
}

export default function ReportsDashboard() {
  const { tenant } = useAuthStore()
  const { data, isLoading } = useReportsData()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-body">Reports & Analytics</h1>
          <p className="text-sm text-subtext">Current month performance</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                title="Revenue (This Month)"
                value={formatCurrency(data.revenueThisMonth, tenant?.currency)}
                icon={<TrendingUp size={20} />}
                trend={{ value: Math.abs(data.revenueTrend), positive: data.revenueTrend >= 0 }}
                color="green"
              />
              <StatCard
                title="Occupancy Rate"
                value={`${data.occupancyRate}%`}
                icon={<BedDouble size={20} />}
                color="navy"
              />
              <StatCard
                title="ADR"
                value={formatCurrency(data.adr, tenant?.currency)}
                subtitle="Avg daily rate"
                icon={<BarChart3 size={20} />}
                color="blue"
              />
              <StatCard
                title="RevPAR"
                value={formatCurrency(data.revpar, tenant?.currency)}
                subtitle="Revenue per available room"
                icon={<BarChart3 size={20} />}
                color="gold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                title="GOPPAR"
                value={formatCurrency(data.goppar, tenant?.currency)}
                subtitle="Gross op. profit per room"
                icon={<BarChart3 size={20} />}
                color="green"
              />
              <StatCard title="Bookings This Month" value={data.totalBookings} icon={<TrendingUp size={20} />} color="navy" />
              <StatCard title="Total Guests on Record" value={data.totalGuests} icon={<Users size={20} />} color="blue" />
            </div>

            {/* Revenue chart — last 30 days */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
              <h2 className="text-sm font-semibold text-body mb-4">Daily Revenue — Last 30 Days</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.dailyRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#4A5568' }}
                    interval={4}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#4A5568' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `€${v}`}
                    width={50}
                  />
                  <Tooltip
                    formatter={(value) => `€${Number(value).toFixed(2)}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D0DCF0' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#C9A84C"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bookings per day + Source breakdown */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Bookings per Day — Last 30 Days</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.dailyRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#4A5568' }} interval={4} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                    <Tooltip
                      formatter={(value) => String(value)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D0DCF0' }}
                    />
                    <Bar dataKey="bookings" fill="#0B1F4B" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Booking Sources — Last 30 Days</h2>
                {data.sourceData.length === 0 ? (
                  <p className="text-sm text-subtext py-12 text-center">No bookings in this period</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="100%" height={180}>
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
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
