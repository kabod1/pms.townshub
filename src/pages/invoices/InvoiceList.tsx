import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, FileText } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useBookings } from '@/hooks/useBookings'
import { useCreateInvoice } from '@/hooks/useInvoices'
import { formatDate, formatCurrency } from '@/lib/utils'
import { INVOICE_STATUS_LABELS, DEFAULT_VAT_RATE } from '@/lib/constants'
import type { Invoice } from '@/types'

const INVOICE_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const schema = z.object({
  booking_id: z.string().min(1, 'Select a booking'),
  vat_rate: z.coerce.number().min(0).max(100),
  due_date: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function InvoiceList() {
  const { tenant } = useAuthStore()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, booking:bookings(booking_reference, guest:guests(first_name, last_name))')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Invoice[]
    },
    enabled: !!tenant,
  })

  const { data: bookings } = useBookings()
  const createInvoice = useCreateInvoice()

  const bookingOptions = [
    { value: '', label: 'Select a booking…' },
    ...(bookings ?? []).map((b) => ({
      value: b.id,
      label: `${b.booking_reference}${b.guest ? ` — ${b.guest.first_name} ${b.guest.last_name}` : ''} (${formatCurrency(b.total_amount)})`,
    })),
  ]

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { vat_rate: DEFAULT_VAT_RATE },
  })

  const selectedBookingId = watch('booking_id')
  const selectedBooking = (bookings ?? []).find((b) => b.id === selectedBookingId)

  async function onSubmit(data: FormData) {
    const inv = await createInvoice.mutateAsync({
      bookingId: data.booking_id,
      subtotal: selectedBooking?.total_amount ?? 0,
      vatRate: data.vat_rate,
      dueDate: data.due_date || null,
      notes: data.notes || null,
    })
    reset()
    setShowModal(false)
    navigate(`/invoices/${inv.id}`)
  }

  const columns = [
    {
      key: 'number',
      header: 'Invoice #',
      render: (inv: Invoice) => (
        <span className="font-mono text-xs font-semibold text-navy">{inv.invoice_number}</span>
      ),
    },
    {
      key: 'booking',
      header: 'Booking',
      render: (inv: Invoice) => (
        <span className="text-xs">{inv.booking?.booking_reference ?? '—'}</span>
      ),
    },
    {
      key: 'issued',
      header: 'Issued',
      render: (inv: Invoice) => (
        <span className="text-xs text-subtext">{formatDate(inv.issued_date)}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (inv: Invoice) => <span className="font-medium">{formatCurrency(inv.total)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv: Invoice) => (
        <Badge
          label={INVOICE_STATUS_LABELS[inv.status]}
          className={INVOICE_STATUS_COLORS[inv.status]}
        />
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-body">Invoices</h1>
          <Button size="sm" onClick={() => setShowModal(true)} className="flex items-center gap-1.5">
            <Plus size={16} /> New Invoice
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (invoices ?? []).length === 0 ? (
          <div className="rounded-xl ring-1 ring-mid bg-white">
            <EmptyState
              icon={<FileText size={40} />}
              title="No invoices yet"
              description="Create an invoice from any booking to track payments and send to guests."
              action={{ label: '+ Create Invoice', onClick: () => setShowModal(true) }}
            />
          </div>
        ) : (
          <Table
            columns={columns}
            data={invoices ?? []}
            keyExtractor={(inv) => inv.id}
            onRowClick={(inv) => navigate(`/invoices/${inv.id}`)}
          />
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Invoice" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Booking"
            options={bookingOptions}
            error={errors.booking_id?.message}
            {...register('booking_id')}
          />

          {selectedBooking && (
            <div className="rounded-lg bg-light px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-subtext">Booking total</span>
                <span className="font-medium">{formatCurrency(selectedBooking.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtext">Guest</span>
                <span>{selectedBooking.guest ? `${selectedBooking.guest.first_name} ${selectedBooking.guest.last_name}` : '—'}</span>
              </div>
            </div>
          )}

          <Input
            label="VAT Rate (%)"
            type="number"
            min={0}
            max={100}
            step={0.5}
            {...register('vat_rate')}
          />
          <Input label="Due Date" type="date" {...register('due_date')} />
          <Input label="Notes" placeholder="Payment instructions, terms…" {...register('notes')} />

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowModal(false); reset() }}>
              Cancel
            </Button>
            <Button type="submit" loading={createInvoice.isPending}>
              Create Invoice
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
