import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Printer, Download, PlusCircle, CheckCircle, Link2 } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Invoice, PaymentMethod } from '@/types'
import toast from 'react-hot-toast'

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card (POS)' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'stripe', label: 'Stripe (Online)' },
  { value: 'other', label: 'Other' },
]

const INVOICE_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tenant } = useAuthStore()
  const queryClient = useQueryClient()
  const invoiceRef = useRef<HTMLDivElement>(null)

  const [showPayModal, setShowPayModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('card')
  const [payRef, setPayRef] = useState('')
  const [payNote, setPayNote] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, booking:bookings(*, guest:guests(*), room:rooms(number))')
        .eq('id', id!)
        .eq('tenant_id', tenant!.id)
        .single()
      if (error) throw error
      return data as Invoice
    },
    enabled: !!tenant && !!id,
  })

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!invoice) return
      const amount = parseFloat(payAmount)
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount')

      const { error: payErr } = await supabase.from('payments').insert({
        tenant_id: tenant!.id,
        booking_id: invoice.booking_id,
        amount,
        method: payMethod,
        status: 'completed',
        reference: payRef || null,
        notes: payNote || null,
      })
      if (payErr) throw payErr

      // Mark invoice as paid if amount covers total
      if (amount >= invoice.total) {
        await supabase
          .from('invoices')
          .update({ status: 'paid' })
          .eq('id', invoice.id)
      }
    },
    onSuccess: () => {
      toast.success('Payment recorded')
      setShowPayModal(false)
      setPayAmount('')
      setPayRef('')
      setPayNote('')
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to record payment'),
  })

  async function handleDownloadPDF() {
    if (!invoiceRef.current) return
    setPdfLoading(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = (canvas.height * pageW) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH)
      pdf.save(`${invoice?.invoice_number ?? 'invoice'}.pdf`)
    } catch {
      toast.error('PDF generation failed')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleSendPaymentLink() {
    if (!invoice) return
    setLinkLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch('/api/stripe?action=booking-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId: invoice.booking_id }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to generate payment link')
      await navigator.clipboard.writeText(body.url)
      toast.success('Payment link copied — send it to your guest via WhatsApp or email.')
    } catch (err: any) {
      toast.error(err.message ?? 'Could not create payment link')
    } finally {
      setLinkLoading(false)
    }
  }

  if (isLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>
  if (!invoice) return <DashboardLayout><p className="text-subtext">Invoice not found.</p></DashboardLayout>

  const booking = invoice.booking

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <h1 className="text-xl font-bold text-body">{invoice.invoice_number}</h1>
          <Badge
            label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            className={INVOICE_STATUS_COLORS[invoice.status]}
          />
          <div className="flex-1" />
          <div className="flex gap-2 flex-wrap">
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendPaymentLink}
                  loading={linkLoading}
                  title="Generate a Stripe payment link and copy it to clipboard"
                >
                  <Link2 size={15} /> Payment Link
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setPayAmount(String(invoice.total))
                    setShowPayModal(true)
                  }}
                >
                  <PlusCircle size={16} /> Record Payment
                </Button>
              </>
            )}
            {invoice.status === 'paid' && (
              <span className="flex items-center gap-1 text-sm font-medium text-green-700">
                <CheckCircle size={16} /> Paid
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} loading={pdfLoading}>
              <Download size={16} /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </Button>
          </div>
        </div>

        {/* Invoice document */}
        <div ref={invoiceRef} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4 sm:p-8 space-y-6 print:shadow-none">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <img src="/logo.png" alt="Townshub" className="h-10 w-auto object-contain mb-2" />
              <p className="text-sm font-bold text-navy">{tenant?.name}</p>
              <p className="text-xs text-subtext">{tenant?.address ?? ''}</p>
              <p className="text-xs text-subtext">{tenant?.email}</p>
              {tenant?.vat_number && <p className="text-xs text-subtext">VAT: {tenant.vat_number}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-2xl font-bold text-navy">INVOICE</p>
              <p className="text-sm font-mono mt-1">{invoice.invoice_number}</p>
              <p className="text-xs text-subtext mt-1">Issued: {formatDate(invoice.issued_date)}</p>
              {invoice.due_date && (
                <p className="text-xs text-subtext">Due: {formatDate(invoice.due_date)}</p>
              )}
              <span className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Bill to */}
          {booking?.guest && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-subtext mb-1">Bill To</p>
              <p className="text-sm font-medium">{booking.guest.first_name} {booking.guest.last_name}</p>
              <p className="text-xs text-subtext">{booking.guest.email ?? ''}</p>
            </div>
          )}

          {/* Line items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mid text-xs text-subtext uppercase">
                <th className="text-left pb-2">Description</th>
                <th className="text-right pb-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-mid">
                <td className="py-3">
                  Room {booking?.room?.number ?? '—'} ·{' '}
                  {booking ? `${formatDate(booking.check_in_date)} – ${formatDate(booking.check_out_date)}` : ''}
                </td>
                <td className="py-3 text-right">{formatCurrency(invoice.subtotal)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 text-subtext text-xs">Subtotal</td>
                <td className="pt-3 text-right text-xs">{formatCurrency(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td className="text-subtext text-xs">VAT ({invoice.vat_rate}%)</td>
                <td className="text-right text-xs">{formatCurrency(invoice.vat_amount)}</td>
              </tr>
              <tr className="border-t border-mid font-bold">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right text-navy">{formatCurrency(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>

          {invoice.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-subtext mb-1">Notes</p>
              <p className="text-sm">{invoice.notes}</p>
            </div>
          )}

          <p className="text-center text-xs text-subtext border-t border-mid pt-4">
            Townshub Limited · HE 481530 · 19 Katsoni, Nicosia, Cyprus · admin@townshub.cy
          </p>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        title="Record Payment"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-subtext mb-1">Invoice total</p>
            <p className="text-lg font-bold text-navy">{formatCurrency(invoice.total)}</p>
          </div>

          <Input
            label="Amount Received"
            type="number"
            min={0}
            step={0.01}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="0.00"
          />

          <Select
            label="Payment Method"
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            options={METHOD_OPTIONS}
          />

          <Input
            label="Reference / Transaction ID"
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
            placeholder="Optional — e.g. card last 4, bank ref"
          />

          <Input
            label="Notes"
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
            placeholder="Optional"
          />

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setShowPayModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => recordPayment.mutate()}
              loading={recordPayment.isPending}
              disabled={!payAmount || parseFloat(payAmount) <= 0}
            >
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
