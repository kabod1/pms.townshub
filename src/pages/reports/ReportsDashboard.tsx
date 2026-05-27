import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, BedDouble, Users, BarChart3, Download } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, subMonths,
  eachDayOfInterval, eachMonthOfInterval, parseISO,
} from 'date-fns'
import type { Booking, BookingSource } from '@/types'
import { BOOKING_SOURCE_LABELS } from '@/lib/constants'

const CHART_COLORS = ['#0B1F4B', '#C9A84C', '#1A5CB5', '#1B5E20', '#E65100', '#B71C1C']

function useReportsData(from: string, to: string) {
  const { tenant } = useAuthStore()
  const prevFrom = format(subMonths(parseISO(from), 1), 'yyyy-MM-dd')
  const prevTo = format(subMonths(parseISO(to), 1), 'yyyy-MM-dd')
  const sixMonthsAgo = subMonths(new Date(), 5)

  return useQuery({
    queryKey: ['reports', tenant?.id, from, to],
    queryFn: async () => {
      const [
        roomsRes,
        thisRes,
        prevRes,
        guestsRes,
        recentRes,
        roomTypesRes,
        sixMonthBookingsRes,
      ] = await Promise.all([
        supabase
          .from('rooms')
          .select('id, status, room_type_id')
          .eq('tenant_id', tenant!.id)
          .eq('is_active', true),
        supabase
          .from('bookings')
          .select('total_amount, room_rate, check_in_date, check_out_date, source, status, room_type_id')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', from)
          .lte('check_in_date', to),
        supabase
          .from('bookings')
          .select('total_amount')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', prevFrom)
          .lte('check_in_date', prevTo),
        supabase
          .from('guests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant!.id),
        supabase
          .from('bookings')
          .select('total_amount, check_in_date, check_out_date, source, status, room_type_id')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', from)
          .lte('check_in_date', to)
          .order('check_in_date'),
        supabase
          .from('room_types')
          .select('id, name')
          .eq('tenant_id', tenant!.id)
          .eq('is_active', true),
        // For 6-month occupancy trend
        supabase
          .from('bookings')
          .select('check_in_date, check_out_date, room_id, status')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd')),
      ])

      const rooms = roomsRes.data ?? []
      const thisBookings = thisRes.data ?? []
      const prevBookings = prevRes.data ?? []
      const recentBookings = (recentRes.data ?? []) as Pick<
        Booking,
        'total_amount' | 'check_in_date' | 'check_out_date' | 'source' | 'status'
      >[]
      const roomTypes = roomTypesRes.data ?? []
      const sixMonthBookings = sixMonthBookingsRes.data ?? []

      const totalRooms = rooms.length
      const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length

      const revenueThis = thisBookings.reduce((s, b) => s + Number(b.total_amount), 0)
      const revenuePrev = prevBookings.reduce((s, b) => s + Number(b.total_amount), 0)
      const revenueTrend = revenuePrev > 0
        ? Math.round(((revenueThis - revenuePrev) / revenuePrev) * 100)
        : 0

      const adr = thisBookings.length > 0
        ? thisBookings.reduce((s, b) => s + Number(b.room_rate), 0) / thisBookings.length
        : 0
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
      const revpar = adr * (occupancyRate / 100)
      const goppar = totalRooms > 0 ? (revenueThis * 0.65) / totalRooms : 0

      // Average length of stay
      const avgLengthOfStay = (() => {
        const valid = thisBookings.filter(
          (b) => b.check_in_date && b.check_out_date,
        )
        if (valid.length === 0) return 0
        const totalNights = valid.reduce((s, b) => {
          const ci = parseISO(b.check_in_date)
          const co = parseISO(b.check_out_date)
          return s + Math.max(0, (co.getTime() - ci.getTime()) / 86400000)
        }, 0)
        return totalNights / valid.length
      })()

      // Daily revenue
      const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })
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

      // Top room types by revenue
      const roomTypeMap: Record<string, { name: string; revenue: number; bookings: number }> = {}
      for (const rt of roomTypes) {
        roomTypeMap[rt.id] = { name: rt.name, revenue: 0, bookings: 0 }
      }
      for (const b of thisBookings) {
        const rtId = (b as { room_type_id?: string | null }).room_type_id
        if (rtId && roomTypeMap[rtId]) {
          roomTypeMap[rtId].revenue += Number(b.total_amount)
          roomTypeMap[rtId].bookings++
        }
      }
      const topRoomTypes = Object.values(roomTypeMap)
        .filter((rt) => rt.revenue > 0 || rt.bookings > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      // 6-month monthly occupancy trend
      const months = eachMonthOfInterval({ start: sixMonthsAgo, end: new Date() })
      const monthlyOccupancy = months.map((month) => {
        const ms = format(startOfMonth(month), 'yyyy-MM-dd')
        const me = format(endOfMonth(month), 'yyyy-MM-dd')
        // Count bookings with check_in in this month
        const monthBookings = sixMonthBookings.filter(
          (b) => b.check_in_date >= ms && b.check_in_date <= me,
        )
        // Unique rooms occupied
        const uniqueRooms = new Set(monthBookings.map((b) => b.room_id).filter(Boolean)).size
        const occ = totalRooms > 0 ? Math.round((uniqueRooms / totalRooms) * 100) : 0
        return {
          month: format(month, 'MMM yy'),
          occupancy: Math.min(occ, 100),
          bookings: monthBookings.length,
        }
      })

      return {
        revenueThis,
        revenueTrend,
        occupancyRate,
        adr,
        revpar,
        goppar,
        avgLengthOfStay,
        totalBookings: thisBookings.length,
        totalGuests: guestsRes.count ?? 0,
        dailyRevenue,
        sourceData,
        topRoomTypes,
        monthlyOccupancy,
        rawBookings: thisBookings,
      }
    },
    enabled: !!tenant,
  })
}

function exportCSV(data: ReturnType<typeof useReportsData>['data'], from: string, to: string) {
  if (!data) return
  const rows = [
    ['Date', 'Revenue', 'Bookings'],
    ...data.dailyRevenue.map((d) => [d.date, d.revenue.toFixed(2), d.bookings]),
  ]
  const csv = rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report_${from}_${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsDashboard() {
  const { tenant } = useAuthStore()

  const defaultFrom = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const defaultTo = format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)

  const { data, isLoading } = useReportsData(from, to)

  const handleExport = useCallback(() => exportCSV(data, from, to), [data, from, to])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-body">Reports & Analytics</h1>
            <p className="text-sm text-subtext">Select a date range to filter performance data</p>
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-subtext shrink-0">From</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-mid px-2 py-1.5 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-subtext shrink-0">To</label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-mid px-2 py-1.5 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              />
            </div>
            {[
              {
                label: 'This month',
                from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
              },
              {
                label: 'Last month',
                from: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
                to: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
              },
              {
                label: 'Last 3 months',
                from: format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'),
                to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
              },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => { setFrom(p.from); setTo(p.to) }}
                className="rounded-lg border border-mid px-2.5 py-1.5 text-xs text-subtext hover:bg-light transition-colors"
              >
                {p.label}
              </button>
            ))}
            <Button size="sm" variant="outline" onClick={handleExport} disabled={!data}>
              <Download size={14} /> CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                title="Revenue (Period)"
                value={formatCurrency(data.revenueThis, tenant?.currency)}
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
              <StatCard title="Bookings (Period)" value={data.totalBookings} icon={<TrendingUp size={20} />} color="navy" />
              <StatCard title="Total Guests on Record" value={data.totalGuests} icon={<Users size={20} />} color="blue" />
              <StatCard
                title="Avg Length of Stay"
                value={`${data.avgLengthOfStay.toFixed(1)} nights`}
                subtitle="For selected period"
                icon={<BedDouble size={20} />}
                color="gold"
              />
            </div>

            {/* Revenue chart */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
              <h2 className="text-sm font-semibold text-body mb-4">Daily Revenue — Selected Period</h2>
              <div className="overflow-x-auto">
                <div style={{ minWidth: 480 }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data.dailyRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#4A5568' }}
                        interval={Math.max(0, Math.floor(data.dailyRevenue.length / 8))}
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
              </div>
            </div>

            {/* Occupancy trend + Bookings per day */}
            <div className="grid gap-4 lg:grid-cols-2">
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
                      stroke="#0B1F4B"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#0B1F4B' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Bookings per Day</h2>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: 320 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.dailyRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: '#4A5568' }}
                          interval={Math.max(0, Math.floor(data.dailyRevenue.length / 6))}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                        <Tooltip
                          formatter={(value) => String(value)}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D0DCF0' }}
                        />
                        <Bar dataKey="bookings" fill="#0B1F4B" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Room Types + Booking Sources */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Top Room Types by Revenue */}
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Top Room Types by Revenue</h2>
                {data.topRoomTypes.length === 0 ? (
                  <p className="text-sm text-subtext py-8 text-center">No room type data available</p>
                ) : (
                  <div className="space-y-3">
                    {data.topRoomTypes.map((rt, i) => {
                      const pct = data.revenueThis > 0 ? (rt.revenue / data.revenueThis) * 100 : 0
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1 text-sm">
                            <span className="font-medium text-body truncate max-w-[160px]">{rt.name}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-subtext">{rt.bookings} bookings</span>
                              <span className="font-semibold text-body">
                                {formatCurrency(rt.revenue, tenant?.currency)}
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-light rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-navy"
                              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Booking Sources */}
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Booking Sources</h2>
                {data.sourceData.length === 0 ? (
                  <p className="text-sm text-subtext py-12 text-center">No bookings in this period</p>
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
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
