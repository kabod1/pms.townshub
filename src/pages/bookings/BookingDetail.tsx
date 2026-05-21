import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, FileText, CreditCard, Copy, Check, Link2 } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useBooking, useUpdateBooking } from '@/hooks/useBookings'
import { usePayments, useCreatePayment } from '@/hooks/usePayments'
import { useCreateInvoice } from '@/hooks/useInvoices'
import { formatDate, formatCurrency, nightCount } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, BOOKING_SOURCE_LABELS } from '@/lib/constants'
import type { BookingStatus, PaymentMethod } from '@/types'

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
  no_show: [],
}

const paySchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount required'),
  method: z.string().min(1),
  reference: z.string().optional(),
  notes: z.string().optional(),
})
type PayForm = z.infer<typeof paySchema>

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => ({
  value: k,
  label: PAYMENT_METHOD_LABELS[k],
}))

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy} className="text-subtext hover:text-body transition-colors" title="Copy">
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
    </button>
  )
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showPayModal, setShowPayModal] = useState(false)

  const { data: booking, isLoading } = useBooking(id!)
  const { data: payments } = usePayments(id!)
  const updateBooking = useUpdateBooking()
  const createPayment = useCreatePayment()
  const createInvoice = useCreateInvoice()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { method: 'cash' },
  })

  if (isLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>
  if (!booking) return <DashboardLayout><p className="text-subtext">Booking not found.</p></DashboardLayout>

  const nights = nightCount(booking.check_in_date, booking.check_out_date)
  const transitions = ALLOWED_TRANSITIONS[booking.status]
  const precheckinUrl = booking.pre_checkin_token
    ? `${window.location.origin}/pre-checkin/${booking.pre_checkin_token}`
    : null

  async function handlePay(data: PayForm) {
    await createPayment.mutateAsync({
      bookingId: booking!.id,
      amount: data.amount,
      method: data.method as PaymentMethod,
      reference: data.reference ?? '',
      notes: data.notes ?? '',
    })
    reset({ method: 'cash' })
    setShowPayModal(false)
  }

  async function handleGenerateInvoice() {
    const inv = await createInvoice.mutateAsync({ bookingId: booking!.id, subtotal: booking!.total_amount })
    navigate(`/invoices/${inv.id}`)
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/bookings')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-body">{booking.booking_reference}</h1>
          </div>
          <Badge label={BOOKING_STATUS_LABELS[booking.status]} className={BOOKING_STATUS_COLORS[booking.status]} />
          <Button
            variant="outline"
            size="sm"
            loading={createInvoice.isPending}
            onClick={handleGenerateInvoice}
          >
            <FileText size={15} /> Generate Invoice
          </Button>
        </div>

        {/* Status transitions */}
        {transitions.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {transitions.map((next) => (
              <Button
                key={next}
                variant={next === 'cancelled' || next === 'no_show' ? 'danger' : 'primary'}
                size="sm"
                loading={updateBooking.isPending}
                onClick={() => updateBooking.mutate({ id: booking.id, status: next })}
              >
                Mark as {BOOKING_STATUS_LABELS[next]}
              </Button>
            ))}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Guest */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Guest</h2>
            {booking.guest ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{booking.guest.first_name} {booking.guest.last_name}</p>
                <p className="text-subtext">{booking.guest.email ?? '—'}</p>
                <p className="text-subtext">{booking.guest.phone ?? '—'}</p>
                <p className="text-subtext">{booking.guest.nationality ?? '—'}</p>
                {booking.guest.id_number && (
                  <p className="text-subtext">ID: {booking.guest.id_number}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-subtext italic">No guest assigned</p>
            )}
          </Card>

          {/* Room & Dates */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Room & Dates</h2>
            <div className="space-y-1 text-sm">
              <p><span className="text-subtext">Room:</span> {booking.room?.number ?? '—'} ({booking.room_type?.name ?? '—'})</p>
              <p><span className="text-subtext">Check-in:</span> {formatDate(booking.check_in_date)}</p>
              <p><span className="text-subtext">Check-out:</span> {formatDate(booking.check_out_date)}</p>
              <p><span className="text-subtext">Nights:</span> {nights}</p>
              <p><span className="text-subtext">Guests:</span> {booking.adults} adults, {booking.children} children</p>
              <p><span className="text-subtext">Source:</span> {BOOKING_SOURCE_LABELS[booking.source]}</p>
            </div>
          </Card>

          {/* Financials */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-body">Financials</h2>
              <Button size="sm" variant="outline" onClick={() => setShowPayModal(true)}>
                <CreditCard size={14} /> Record Payment
              </Button>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-subtext">Room rate</span>
                <span>{formatCurrency(booking.room_rate)} / night</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtext">Nights</span>
                <span>{nights}</span>
              </div>
              <div className="flex justify-between border-t border-mid pt-1 mt-1 font-medium">
                <span>Total</span>
                <span>{formatCurrency(booking.total_amount)}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>Paid</span>
                <span>{formatCurrency(booking.paid_amount)}</span>
              </div>
              <div className={`flex justify-between font-semibold ${booking.balance_due > 0 ? 'text-red-600' : 'text-green-700'}`}>
                <span>Balance due</span>
                <span>{formatCurrency(booking.balance_due)}</span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Notes</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-subtext uppercase tracking-wide mb-0.5">Special Requests</p>
                <p>{booking.special_requests || <span className="italic text-subtext">None</span>}</p>
              </div>
              <div>
                <p className="text-xs text-subtext uppercase tracking-wide mb-0.5">Internal Notes</p>
                <p>{booking.internal_notes || <span className="italic text-subtext">None</span>}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Pre-check-in link */}
        {precheckinUrl && (
          <Card>
            <div className="flex items-center gap-2">
              <Link2 size={15} className="text-subtext shrink-0" />
              <p className="text-sm font-semibold text-body">Pre-check-in Link</p>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-light px-3 py-2">
              <span className="flex-1 text-xs text-subtext font-mono truncate">{precheckinUrl}</span>
              <CopyButton text={precheckinUrl} />
            </div>
            <p className="text-xs text-subtext mt-1">Send this link to the guest to complete their details before arrival.</p>
          </Card>
        )}

        {/* Payment history */}
        {(payments ?? []).length > 0 && (
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-mid">
              <h2 className="text-sm font-semibold text-body">Payment History</h2>
            </div>
            <div className="divide-y divide-mid">
              {(payments ?? []).map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{PAYMENT_METHOD_LABELS[p.method]}</p>
                    <p className="text-xs text-subtext">
                      {new Date(p.created_at).toLocaleDateString()}
                      {p.reference ? ` · Ref: ${p.reference}` : ''}
                    </p>
                    {p.notes && <p className="text-xs text-subtext">{p.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-700">{formatCurrency(p.amount)}</p>
                    <Badge label={p.status} className="bg-green-100 text-green-700 text-xs" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={showPayModal}
        onClose={() => { setShowPayModal(false); reset({ method: 'cash' }) }}
        title="Record Payment"
        size="sm"
      >
        <form onSubmit={handleSubmit(handlePay)} className="space-y-4">
          <Input
            label="Amount (€)"
            type="number"
            min={0.01}
            step={0.01}
            placeholder="0.00"
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Select
            label="Payment Method"
            options={METHOD_OPTIONS}
            {...register('method')}
          />
          <Input label="Reference" placeholder="Receipt number, transaction ID…" {...register('reference')} />
          <Input label="Notes" placeholder="Optional note" {...register('notes')} />
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowPayModal(false); reset({ method: 'cash' }) }}>
              Cancel
            </Button>
            <Button type="submit" loading={createPayment.isPending}>
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
