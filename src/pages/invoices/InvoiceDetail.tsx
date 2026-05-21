import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Invoice } from '@/types'

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tenant } = useAuthStore()

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

  if (isLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>
  if (!invoice) return <DashboardLayout><p className="text-subtext">Invoice not found.</p></DashboardLayout>

  const booking = invoice.booking

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <h1 className="text-xl font-bold text-body">{invoice.invoice_number}</h1>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </Button>
        </div>

        <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-8 space-y-6 print:shadow-none">
          {/* Header */}
          <div className="flex justify-between">
            <div>
              <img src="/logo.png" alt="Townshub" className="h-10 w-auto object-contain mb-2" />
              <p className="text-sm font-bold text-navy">{tenant?.name}</p>
              <p className="text-xs text-subtext">{tenant?.address ?? ''}</p>
              <p className="text-xs text-subtext">{tenant?.email}</p>
              {tenant?.vat_number && <p className="text-xs text-subtext">VAT: {tenant.vat_number}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-navy">INVOICE</p>
              <p className="text-sm font-mono mt-1">{invoice.invoice_number}</p>
              <p className="text-xs text-subtext mt-1">Issued: {formatDate(invoice.issued_date)}</p>
              {invoice.due_date && (
                <p className="text-xs text-subtext">Due: {formatDate(invoice.due_date)}</p>
              )}
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
                  Room {booking?.room?.number ?? '—'} · {booking ? `${formatDate(booking.check_in_date)} – ${formatDate(booking.check_out_date)}` : ''}
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
    </DashboardLayout>
  )
}
