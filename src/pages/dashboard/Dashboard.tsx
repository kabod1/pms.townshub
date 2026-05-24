import { useQuery } from '@tanstack/react-query'
import {
  BedDouble, CalendarCheck, CalendarX, Sparkles,
  TrendingUp, Users, Activity, Wrench, CheckCircle2, LogIn, LogOut,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/lib/constants'
import type { Booking, DashboardStats } from '@/types'
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns'

function useDashboardStats() {
  const { tenant } = useAuthStore()
  const today = format(new Date(), 'yyyy-MM-dd')

  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', tenant?.id, today],
    queryFn: async () => {
      if (!tenant) throw new Error('No tenant')

      const [roomsRes, bookingsRes, housekeepingRes] = await Promise.all([
        supabase.from('rooms').select('status').eq('tenant_id', tenant.id).eq('is_active', true),
        supabase.from('bookings').select('status, check_in_date, check_out_date, total_amount')
          .eq('tenant_id', tenant.id).not('status', 'in', '(cancelled,no_show)'),
        supabase.from('housekeeping_tasks').select('status').eq('tenant_id', tenant.id).eq('status', 'pending'),
      ])

      const rooms = roomsRes.data ?? []
      const bookings = bookingsRes.data ?? []
      const totalRooms = rooms.length
      const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length

      const todayCheckIns = bookings.filter(
        (b) => b.check_in_date === today && b.status === 'confirmed',
      ).length
      const todayCheckOuts = bookings.filter(
        (b) => b.check_out_date === today && b.status === 'checked_in',
      ).length

      const thisMonthStart = format(new Date(), 'yyyy-MM-01')
      const revenueThisMonth = bookings
        .filter((b) => b.check_in_date >= thisMonthStart)
        .reduce((sum, b) => sum + Number(b.total_amount), 0)

      return {
        totalRooms,
        occupiedRooms,
        availableRooms: rooms.filter((r) => r.status === 'vacant_clean').length,
        occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
        todayCheckIns,
        todayCheckOuts,
        pendingHousekeeping: (housekeepingRes.data ?? []).length,
        revenueToday: 0,
        revenueThisMonth,
      }
    },
    enabled: !!tenant,
    refetchInterval: 60_000,
  })
}

function useTodayBookings() {
  const { tenant } = useAuthStore()
  const today = format(new Date(), 'yyyy-MM-dd')

  return useQuery<Booking[]>({
    queryKey: ['today-bookings', tenant?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, guest:guests(first_name, last_name), room:rooms(number)')
        .eq('tenant_id', tenant!.id)
        .or(`check_in_date.eq.${today},check_out_date.eq.${today}`)
        .not('status', 'in', '(cancelled,no_show)')
        .order('check_in_date')
      if (error) throw error
      return data as Booking[]
    },
    enabled: !!tenant,
  })
}

function use7DayOccupancy() {
  const { tenant } = useAuthStore()
  const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['7day-occupancy', tenant?.id, today],
    queryFn: async () => {
      const [roomsRes, bookingsRes] = await Promise.all([
        supabase.from('rooms').select('id').eq('tenant_id', tenant!.id).eq('is_active', true),
        supabase.from('bookings')
          .select('check_in_date, check_out_date')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .lte('check_in_date', today)
          .gte('check_out_date', sevenDaysAgo),
      ])

      const totalRooms = (roomsRes.data ?? []).length
      const bookings = bookingsRes.data ?? []
      const days = eachDayOfInterval({ start: parseISO(sevenDaysAgo), end: parseISO(today) })

      return days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const occupied = bookings.filter(
          (b) => b.check_in_date <= dayStr && b.check_out_date > dayStr,
        ).length
        return {
          day: format(day, 'EEE'),
          occupancy: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
        }
      })
    },
    enabled: !!tenant,
  })
}

function useRecentActivity() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['recent-activity', tenant?.id],
    queryFn: async () => {
      const since = format(subDays(new Date(), 7), 'yyyy-MM-dd')
      const [bookingsRes, maintenanceRes, housekeepingRes] = await Promise.all([
        supabase.from('bookings')
          .select('id, booking_reference, status, check_in_date, updated_at, guest:guests(first_name,last_name)')
          .eq('tenant_id', tenant!.id)
          .gte('updated_at', since)
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase.from('maintenance_requests')
          .select('id, title, status, created_at')
          .eq('tenant_id', tenant!.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('housekeeping_tasks')
          .select('id, type, status, updated_at, room:rooms(number)')
          .eq('tenant_id', tenant!.id)
          .gte('updated_at', since)
          .order('updated_at', { ascending: false })
          .limit(5),
      ])

      type ActivityItem = { id: string; time: string; icon: string; label: string; sub: string; color: string }
      const items: ActivityItem[] = []

      for (const b of bookingsRes.data ?? []) {
        const guest = (Array.isArray(b.guest) ? b.guest[0] : b.guest) as { first_name: string; last_name: string } | null
        const name = guest ? `${guest.first_name} ${guest.last_name}` : b.booking_reference
        if (b.status === 'checked_in')  items.push({ id: b.id, time: b.updated_at, icon: 'checkin',   label: `${name} checked in`,      sub: b.booking_reference, color: 'text-green-600' })
        else if (b.status === 'checked_out') items.push({ id: b.id, time: b.updated_at, icon: 'checkout',  label: `${name} checked out`,     sub: b.booking_reference, color: 'text-blue' })
        else if (b.status === 'confirmed')   items.push({ id: b.id, time: b.updated_at, icon: 'booking',   label: `New booking — ${name}`,   sub: b.booking_reference, color: 'text-navy' })
        else if (b.status === 'cancelled')   items.push({ id: b.id, time: b.updated_at, icon: 'cancel',    label: `Booking cancelled`,       sub: b.booking_reference, color: 'text-red-500' })
      }
      for (const m of maintenanceRes.data ?? []) {
        items.push({ id: m.id, time: m.created_at, icon: 'maintenance', label: m.title, sub: `Maintenance · ${m.status}`, color: 'text-amber-600' })
      }
      for (const h of housekeepingRes.data ?? []) {
        const room = (Array.isArray(h.room) ? h.room[0] : h.room) as { number: string } | null
        items.push({ id: h.id, time: h.updated_at, icon: 'housekeeping', label: `Room ${room?.number ?? '—'} — ${h.type.replace('_', ' ')}`, sub: h.status, color: 'text-subtext' })
      }

      return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12)
    },
    enabled: !!tenant,
    refetchInterval: 30_000,
  })
}

function ActivityIcon({ icon, color }: { icon: string; color: string }) {
  const cls = `${color} shrink-0`
  if (icon === 'checkin')     return <LogIn size={14} className={cls} />
  if (icon === 'checkout')    return <LogOut size={14} className={cls} />
  if (icon === 'maintenance') return <Wrench size={14} className={cls} />
  if (icon === 'housekeeping')return <CheckCircle2 size={14} className={cls} />
  return <Activity size={14} className={cls} />
}

export default function Dashboard() {
  const { tenant } = useAuthStore()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: todayBookings, isLoading: bookingsLoading } = useTodayBookings()
  const { data: occupancyData } = use7DayOccupancy()
  const { data: activity } = useRecentActivity()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-body">Dashboard</h1>
          <p className="text-sm text-subtext">{formatDate(new Date())} · {tenant?.name}</p>
        </div>

        {/* Stats */}
        {statsLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              title="Occupancy Rate"
              value={`${stats.occupancyRate}%`}
              subtitle={`${stats.occupiedRooms} / ${stats.totalRooms} rooms`}
              icon={<BedDouble size={20} />}
              color="navy"
            />
            <StatCard
              title="Today's Check-ins"
              value={stats.todayCheckIns}
              subtitle="Expected arrivals"
              icon={<CalendarCheck size={20} />}
              color="blue"
            />
            <StatCard
              title="Today's Check-outs"
              value={stats.todayCheckOuts}
              subtitle="Departures due"
              icon={<CalendarX size={20} />}
              color="gold"
            />
            <StatCard
              title="Revenue This Month"
              value={formatCurrency(stats.revenueThisMonth, tenant?.currency)}
              subtitle={`${stats.pendingHousekeeping} housekeeping tasks pending`}
              icon={<TrendingUp size={20} />}
              color="green"
            />
          </div>
        ) : null}

        {/* Today's Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
            <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
              <Users size={16} className="text-subtext" />
              Today's Arrivals & Departures
            </h2>
            {bookingsLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="sm" /></div>
            ) : !todayBookings?.length ? (
              <p className="text-sm text-subtext py-8 text-center">No arrivals or departures today</p>
            ) : (
              <div className="space-y-2">
                {todayBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg bg-light px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-body">
                        {b.guest ? `${b.guest.first_name} ${b.guest.last_name}` : 'Guest'}
                      </p>
                      <p className="text-xs text-subtext">
                        Room {b.room?.number ?? '—'} · {b.booking_reference}
                      </p>
                    </div>
                    <Badge
                      label={BOOKING_STATUS_LABELS[b.status]}
                      className={BOOKING_STATUS_COLORS[b.status]}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
            <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-subtext" />
              Room Status Overview
            </h2>
            {stats && (
              <div className="space-y-3">
                {[
                  { label: 'Occupied', count: stats.occupiedRooms, color: 'bg-blue' },
                  { label: 'Vacant – Clean', count: stats.availableRooms, color: 'bg-green-600' },
                  {
                    label: 'Other (dirty / maintenance)',
                    count: stats.totalRooms - stats.occupiedRooms - stats.availableRooms,
                    color: 'bg-amber-500',
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-subtext">{item.label}</span>
                      <span className="font-medium text-body">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-light overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{
                          width: stats.totalRooms > 0 ? `${(item.count / stats.totalRooms) * 100}%` : '0%',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity feed */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
          <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
            <Activity size={16} className="text-subtext" /> Recent Activity
            <span className="ml-auto text-xs font-normal text-subtext">Last 7 days</span>
          </h2>
          {!activity?.length ? (
            <p className="text-sm text-subtext py-6 text-center">No recent activity</p>
          ) : (
            <div className="divide-y divide-mid">
              {activity.map((item) => (
                <div key={item.id + item.time} className="flex items-center gap-3 py-2.5">
                  <ActivityIcon icon={item.icon} color={item.color} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-body truncate">{item.label}</p>
                    <p className="text-xs text-subtext">{item.sub}</p>
                  </div>
                  <span className="text-xs text-subtext shrink-0">
                    {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7-day occupancy chart */}
        {occupancyData && (
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
            <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-subtext" />
              Occupancy Rate — Last 7 Days
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={occupancyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#4A5568' }} tickLine={false} axisLine={false} />
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
                <Bar dataKey="occupancy" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
