import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Payment } from '@/types'
import toast from 'react-hot-toast'

export function usePayments(bookingId: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['payments', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Payment[]
    },
    enabled: !!tenant && !!bookingId,
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  const { tenant, user } = useAuthStore()

  return useMutation({
    mutationFn: async ({
      bookingId,
      amount,
      method,
      reference,
      notes,
    }: {
      bookingId: string
      amount: number
      method: Payment['method']
      reference: string
      notes: string
    }) => {
      const { data: payment, error: payErr } = await supabase
        .from('payments')
        .insert({
          tenant_id: tenant!.id,
          booking_id: bookingId,
          amount,
          method,
          status: 'completed',
          reference: reference || null,
          notes: notes || null,
          processed_by: user!.id,
        })
        .select()
        .single()
      if (payErr) throw payErr

      const { data: bk, error: bkErr } = await supabase
        .from('bookings')
        .select('paid_amount, total_amount')
        .eq('id', bookingId)
        .single()
      if (bkErr) throw bkErr

      const newPaid = (bk.paid_amount ?? 0) + amount
      const newBalance = Math.max(0, (bk.total_amount ?? 0) - newPaid)
      await supabase.from('bookings').update({ paid_amount: newPaid, balance_due: newBalance }).eq('id', bookingId)

      return payment as Payment
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['payments', vars.bookingId] })
      queryClient.invalidateQueries({ queryKey: ['booking', vars.bookingId] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Payment recorded')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
