import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { GiftVoucher } from '@/types'
import toast from 'react-hot-toast'

export function useGiftVouchers() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['gift_vouchers', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_vouchers')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as GiftVoucher[]
    },
    enabled: !!tenant,
  })
}

export function useCreateGiftVoucher() {
  const queryClient = useQueryClient()
  const { tenant } = useAuthStore()

  return useMutation({
    mutationFn: async (payload: Omit<GiftVoucher, 'id' | 'tenant_id' | 'balance' | 'status' | 'redeemed_at' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('gift_vouchers')
        .insert({
          ...payload,
          tenant_id: tenant!.id,
          balance: payload.value,
          status: 'active',
        })
        .select()
        .single()
      if (error) throw error
      return data as GiftVoucher
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift_vouchers'] })
      toast.success('Gift voucher created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateGiftVoucher() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<GiftVoucher> & { id: string }) => {
      const { data, error } = await supabase
        .from('gift_vouchers')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as GiftVoucher
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift_vouchers'] })
      toast.success('Voucher updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
