import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { SeasonalRate } from '@/types'
import toast from 'react-hot-toast'

type SeasonalRateInput = Omit<SeasonalRate, 'id' | 'tenant_id' | 'created_at' | 'room_type'>

export function useSeasonalRates(roomTypeId?: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['seasonal-rates', tenant?.id, roomTypeId],
    queryFn: async () => {
      let query = supabase
        .from('seasonal_rates')
        .select('*, room_type:room_types(id, name)')
        .eq('tenant_id', tenant!.id)
        .order('start_date')
      if (roomTypeId) query = query.eq('room_type_id', roomTypeId)
      const { data, error } = await query
      if (error) throw error
      return data as SeasonalRate[]
    },
    enabled: !!tenant,
  })
}

export function useCreateSeasonalRate() {
  const { tenant } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SeasonalRateInput) => {
      const { error } = await supabase
        .from('seasonal_rates')
        .insert({ ...input, tenant_id: tenant!.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasonal-rates'] })
      toast.success('Seasonal rate created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateSeasonalRate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<SeasonalRateInput> & { id: string }) => {
      const { error } = await supabase.from('seasonal_rates').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasonal-rates'] })
      toast.success('Seasonal rate updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteSeasonalRate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasonal_rates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasonal-rates'] })
      toast.success('Seasonal rate deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
