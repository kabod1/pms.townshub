import { useState, useCallback } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { Plus, Search, Download } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useBookings } from '@/hooks/useBookings'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS,
  BOOKING_SOURCE_LABELS,
} from '@/lib/constants'
import type { Booking, BookingStatus } from '@/types'

function exportBookingsCSV(bookings: Booking[]) {
  const headers = ['Reference', 'Guest', 'Room', 'Check-in', 'Check-out', 'Status', 'Source', 'Total']
  const rows = bookings.map((b) => [
    b.booking_reference,
    b.guest ? `${b.guest.first_name} ${b.guest.last_name}` : '',
    b.room ? `Room ${b.room.number}` : b.room_type?.name ?? '',
    b.check_in_date,
    b.check_out_date,
    BOOKING_STATUS_LABELS[b.status],
    BOOKING_SOURCE_LABELS[b.source],
    b.total_amount,
  ])
  const csv = [headers, ...rows].map((r) => r.map(String).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bookings_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_TABS: { value: BookingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'pending', label: 'Pending' },
  { value: 'checked_out', label: 'Checked Out' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function BookingsList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')

  const { data: bookings, isLoading } = useBookings({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  })

  const handleExport = useCallback(() => exportBookingsCSV(bookings ?? []), [bookings])

  const columns = [
    {
      key: 'reference',
      header: 'Reference',
      render: (b: Booking) => (
        <span className="font-mono text-xs font-semibold text-navy">{b.booking_reference}</span>
      ),
    },
    {
      key: 'guest',
      header: 'Guest',
      render: (b: Booking) =>
        b.guest ? (
          <span className="font-medium">{b.guest.first_name} {b.guest.last_name}</span>
        ) : (
          <span className="text-subtext italic">No guest</span>
        ),
    },
    {
      key: 'room',
      header: 'Room',
      className: 'hidden sm:table-cell',
      render: (b: Booking) => (
        <span>{b.room ? `Room ${b.room.number}` : b.room_type?.name ?? '—'}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (b: Booking) => (
        <span className="text-xs">
          {formatDate(b.check_in_date)} → {formatDate(b.check_out_date)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (b: Booking) => (
        <Badge
          label={BOOKING_STATUS_LABELS[b.status]}
          className={BOOKING_STATUS_COLORS[b.status]}
        />
      ),
    },
    {
      key: 'source',
      header: 'Source',
      className: 'hidden md:table-cell',
      render: (b: Booking) => (
        <span className="text-xs text-subtext">{BOOKING_SOURCE_LABELS[b.source]}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Total',
      render: (b: Booking) => (
        <span className="font-medium">{formatCurrency(b.total_amount)}</span>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-body">Bookings</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!bookings?.length}>
              <Download size={16} /> Export
            </Button>
            <Button onClick={() => navigate('/bookings/new')} size="sm">
              <Plus size={16} /> New Booking
            </Button>
          </div>
        </div>

        {/* View tabs: List | Calendar */}
        <div className="flex gap-1 border-b border-mid">
          {[
            { to: '/bookings', label: 'List' },
            { to: '/bookings/calendar', label: 'Calendar' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
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

        {/* Status tabs */}
        <div className="flex gap-1 border-b border-mid overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                statusFilter === tab.value
                  ? 'border-gold text-gold'
                  : 'border-transparent text-subtext hover:text-body'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Input
          placeholder="Search by reference, guest name..."
          leftIcon={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <Table
            columns={columns}
            data={bookings ?? []}
            keyExtractor={(b) => b.id}
            onRowClick={(b) => navigate(`/bookings/${b.id}`)}
            emptyMessage="No bookings found"
          />
        )}
      </div>
    </DashboardLayout>
  )
}
