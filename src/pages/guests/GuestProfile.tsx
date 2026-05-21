import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useGuest } from '@/hooks/useGuests'
import { useBookings } from '@/hooks/useBookings'
import { formatDate, formatCurrency } from '@/lib/utils'
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '@/lib/constants'
import type { Booking } from '@/types'

export default function GuestProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: guest, isLoading } = useGuest(id!)
  const { data: bookings } = useBookings()
  const guestBookings = (bookings ?? []).filter((b) => b.guest_id === id)

  if (isLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>
  if (!guest) return <DashboardLayout><p className="text-subtext">Guest not found.</p></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/guests')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <h1 className="text-xl font-bold text-body">{guest.first_name} {guest.last_name}</h1>
          <span className="text-sm text-subtext">· {guest.total_stays} stay(s)</span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Contact Details</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2"><dt className="text-subtext w-24">Email</dt><dd>{guest.email ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">Phone</dt><dd>{guest.phone ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">Nationality</dt><dd>{guest.nationality ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">Date of Birth</dt><dd>{guest.date_of_birth ? formatDate(guest.date_of_birth) : '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">ID / Passport</dt><dd>{guest.id_number ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">Address</dt><dd>{guest.address ?? '—'}</dd></div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Notes</h2>
            <p className="text-sm">{guest.notes || <span className="italic text-subtext">No notes</span>}</p>
          </Card>
        </div>

        <Card padding={false}>
          <div className="px-5 py-4 border-b border-mid">
            <h2 className="text-sm font-semibold text-body">Stay History</h2>
          </div>
          {guestBookings.length === 0 ? (
            <p className="px-5 py-8 text-sm text-subtext text-center">No bookings on record</p>
          ) : (
            <div className="divide-y divide-mid">
              {guestBookings.map((b: Booking) => (
                <div
                  key={b.id}
                  className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-light"
                  onClick={() => navigate(`/bookings/${b.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium font-mono">{b.booking_reference}</p>
                    <p className="text-xs text-subtext">
                      {formatDate(b.check_in_date)} → {formatDate(b.check_out_date)} · Room {b.room?.number ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatCurrency(b.total_amount)}</span>
                    <Badge label={BOOKING_STATUS_LABELS[b.status]} className={BOOKING_STATUS_COLORS[b.status]} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
