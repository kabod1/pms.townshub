import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Promotion } from '@/types'
import toast from 'react-hot-toast'

type PromotionInput = Omit<Promotion, 'id' | 'tenant_id' | 'current_uses' | 'created_at'>

export function usePromotions() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['promotions', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Promotion[]
    },
    enabled: !!tenant,
  })
}

export function useCreatePromotion() {
  const { tenant } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: PromotionInput) => {
      const { error } = await supabase
        .from('promotions')
        .insert({ ...input, tenant_id: tenant!.id, current_uses: 0 })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      toast.success('Promotion created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PromotionInput> & { id: string }) => {
      const { error } = await supabase.from('promotions').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      toast.success('Promotion updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
