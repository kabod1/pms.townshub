import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { DEFAULT_VAT_RATE } from '@/lib/constants'
import toast from 'react-hot-toast'

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  const { tenant } = useAuthStore()

  return useMutation({
    mutationFn: async ({
      bookingId,
      subtotal,
      vatRate = DEFAULT_VAT_RATE,
      dueDate = null,
      notes = null,
    }: {
      bookingId: string
      subtotal: number
      vatRate?: number
      dueDate?: string | null
      notes?: string | null
    }) => {
      const vatAmount = Math.round(subtotal * vatRate) / 100
      const total = subtotal + vatAmount

      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id)

      const num = String((count ?? 0) + 1).padStart(4, '0')
      const invoiceNumber = `INV-${new Date().getFullYear()}-${num}`
      const issuedDate = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          tenant_id: tenant!.id,
          booking_id: bookingId,
          invoice_number: invoiceNumber,
          issued_date: issuedDate,
          due_date: dueDate,
          subtotal,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total,
          status: 'issued',
          notes,
        })
        .select()
        .single()
      if (error) throw error
      return data as { id: string; invoice_number: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
