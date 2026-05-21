import { useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  parseISO, addMonths, subMonths, differenceInDays, isToday, isWeekend,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Booking, BookingStatus, Room } from '@/types'

const CELL_W = 40
const ROW_H = 48
const ROOM_COL_W = 96

const BAR_COLORS: Record<BookingStatus, string> = {
  confirmed: '#1A5CB5',
  checked_in: '#1B5E20',
  checked_out: '#6B7280',
  pending: '#E65100',
  cancelled: '#B71C1C',
  no_show: '#9CA3AF',
}

const BOOKINGS_NAV = [
  { to: '/bookings', label: 'List', end: true },
  { to: '/bookings/calendar', label: 'Calendar', end: true },
]

function useCalendarData(monthStart: Date, monthEnd: Date) {
  const { tenant } = useAuthStore()
  const start = format(monthStart, 'yyyy-MM-dd')
  const end = format(monthEnd, 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['calendar', tenant?.id, start, end],
    queryFn: async () => {
      const [roomsRes, bookingsRes] = await Promise.all([
        supabase
          .from('rooms')
          .select('id, number, room_type:room_types(name)')
          .eq('tenant_id', tenant!.id)
          .eq('is_active', true)
          .order('number'),
        supabase
          .from('bookings')
          .select('id, booking_reference, room_id, check_in_date, check_out_date, status, guest:guests(first_name, last_name)')
          .eq('tenant_id', tenant!.id)
          .not('status', 'in', '(cancelled,no_show)')
          .lte('check_in_date', end)
          .gte('check_out_date', start),
      ])

      if (roomsRes.error) throw roomsRes.error
      if (bookingsRes.error) throw bookingsRes.error

      return {
        rooms: roomsRes.data as unknown as Room[],
        bookings: bookingsRes.data as unknown as (Booking & { guest: { first_name: string; last_name: string } | null })[],
      }
    },
    enabled: !!tenant,
  })
}

function BookingBar({
  booking,
  startCol,
  spanDays,
  onClick,
}: {
  booking: Booking & { guest: { first_name: string; last_name: string } | null }
  startCol: number
  spanDays: number
  onClick: () => void
}) {
  const label = booking.guest
    ? `${booking.guest.first_name} ${booking.guest.last_name}`
    : booking.booking_reference

  return (
    <div
      title={`${label} · ${booking.booking_reference} · ${booking.status}`}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="absolute top-1.5 bottom-1.5 rounded-md cursor-pointer flex items-center px-2 overflow-hidden select-none z-10 hover:brightness-90 transition-all"
      style={{
        left: startCol * CELL_W + 2,
        width: spanDays * CELL_W - 4,
        backgroundColor: BAR_COLORS[booking.status],
        minWidth: 20,
      }}
    >
      <span className="text-white text-xs font-medium truncate leading-none">
        {label}
      </span>
    </div>
  )
}

export default function BookingCalendar() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const { data, isLoading } = useCalendarData(monthStart, monthEnd)

  function handleCellClick(roomId: string, day: Date) {
    const dateStr = format(day, 'yyyy-MM-dd')
    navigate(`/bookings/new?date=${dateStr}&room_id=${roomId}`)
  }

  function getBookingsForRoom(roomId: string) {
    return (data?.bookings ?? []).filter((b) => b.room_id === roomId)
  }

  function calcBarPosition(booking: Booking) {
    const start = parseISO(booking.check_in_date)
    const end = parseISO(booking.check_out_date)
    const clampedStart = start < monthStart ? monthStart : start
    const clampedEnd = end > monthEnd ? monthEnd : end
    const startCol = differenceInDays(clampedStart, monthStart)
    const spanDays = Math.max(1, differenceInDays(clampedEnd, clampedStart))
    return { startCol, spanDays }
  }

  const totalWidth = ROOM_COL_W + days.length * CELL_W

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Page header with sub-nav */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-body">Bookings</h1>
          <Button onClick={() => navigate('/bookings/new')} size="sm">
            <Plus size={16} /> New Booking
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1 border-b border-mid">
            {BOOKINGS_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    isActive ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="rounded-md p-1.5 text-subtext hover:bg-light hover:text-body"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-body min-w-[120px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="rounded-md p-1.5 text-subtext hover:bg-light hover:text-body"
            >
              <ChevronRight size={18} />
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : (
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: totalWidth }}>

                {/* Header row */}
                <div
                  className="flex border-b-2 border-mid bg-light sticky top-0 z-20"
                  style={{ height: 44 }}
                >
                  {/* Room label header */}
                  <div
                    className="shrink-0 border-r-2 border-mid flex items-center px-3 sticky left-0 bg-light z-30"
                    style={{ width: ROOM_COL_W }}
                  >
                    <span className="text-xs font-semibold text-subtext uppercase tracking-wide">Room</span>
                  </div>

                  {/* Day headers */}
                  {days.map((day) => {
                    const isTod = isToday(day)
                    const isWknd = isWeekend(day)
                    return (
                      <div
                        key={day.toISOString()}
                        className={`shrink-0 flex flex-col items-center justify-center border-r border-mid/50 ${
                          isTod ? 'bg-gold/10' : isWknd ? 'bg-gray-50' : ''
                        }`}
                        style={{ width: CELL_W }}
                      >
                        <span className={`text-xs font-semibold ${isTod ? 'text-gold' : 'text-subtext'}`}>
                          {format(day, 'EEE')[0]}
                        </span>
                        <span className={`text-sm font-bold leading-none ${isTod ? 'text-gold' : 'text-body'}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Room rows */}
                {(data?.rooms ?? []).length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-sm text-subtext">
                    No rooms found. Add rooms first.
                  </div>
                ) : (
                  (data?.rooms ?? []).map((room, roomIdx) => {
                    const roomBookings = getBookingsForRoom(room.id)

                    return (
                      <div
                        key={room.id}
                        className={`flex border-b border-mid relative ${roomIdx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
                        style={{ height: ROW_H }}
                      >
                        {/* Room label (sticky) */}
                        <div
                          className={`shrink-0 border-r-2 border-mid flex flex-col justify-center px-3 sticky left-0 z-10 ${roomIdx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}
                          style={{ width: ROOM_COL_W }}
                        >
                          <span className="text-sm font-semibold text-body leading-none">
                            {room.number}
                          </span>
                          {room.room_type && (
                            <span className="text-xs text-subtext truncate leading-none mt-0.5">
                              {(room.room_type as unknown as { name: string }).name}
                            </span>
                          )}
                        </div>

                        {/* Day cells — clickable for new booking */}
                        <div className="relative flex flex-1">
                          {days.map((day) => {
                            const isTod = isToday(day)
                            const isWknd = isWeekend(day)
                            return (
                              <div
                                key={day.toISOString()}
                                onClick={() => handleCellClick(room.id, day)}
                                className={`shrink-0 border-r border-mid/30 cursor-pointer transition-colors hover:bg-gold/5 ${
                                  isTod ? 'bg-gold/5' : isWknd ? 'bg-gray-100/50' : ''
                                }`}
                                style={{ width: CELL_W, height: ROW_H }}
                              />
                            )
                          })}

                          {/* Booking bars */}
                          {roomBookings.map((booking) => {
                            const { startCol, spanDays } = calcBarPosition(booking)
                            return (
                              <BookingBar
                                key={booking.id}
                                booking={booking}
                                startCol={startCol}
                                spanDays={spanDays}
                                onClick={() => navigate(`/bookings/${booking.id}`)}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-mid bg-light">
              {Object.entries(BAR_COLORS).map(([status, color]) => (
                <span key={status} className="flex items-center gap-1.5 text-xs text-subtext">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  {status.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
