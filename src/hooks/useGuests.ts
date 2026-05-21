import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Guest } from '@/types'
import toast from 'react-hot-toast'

export function useGuests(search?: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['guests', tenant?.id, search],
    queryFn: async () => {
      if (!tenant) return []
      let query = supabase
        .from('guests')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('last_name')

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as Guest[]
    },
    enabled: !!tenant,
  })
}

export function useGuest(id: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['guest', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenant!.id)
        .single()
      if (error) throw error
      return data as Guest
    },
    enabled: !!tenant && !!id,
  })
}

export function useCreateGuest() {
  const queryClient = useQueryClient()
  const { tenant } = useAuthStore()

  return useMutation({
    mutationFn: async (payload: Partial<Guest>) => {
      const { data, error } = await supabase
        .from('guests')
        .insert({ ...payload, tenant_id: tenant!.id })
        .select()
        .single()
      if (error) throw error
      return data as Guest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] })
      toast.success('Guest created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateGuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Guest> & { id: string }) => {
      const { data, error } = await supabase
        .from('guests')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Guest
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['guests'] })
      queryClient.invalidateQueries({ queryKey: ['guest', data.id] })
      toast.success('Guest updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
