import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { PropertyOwner } from '@/types/database'
import toast from 'react-hot-toast'

export function useOwners() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['property-owners', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_owners')
        .select('*')
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .order('last_name')
      if (error) throw error
      return data as PropertyOwner[]
    },
    enabled: !!tenant,
  })
}

export function useOwner(id: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['property-owner', id, tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_owners')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .single()
      if (error) throw error
      return data as PropertyOwner
    },
    enabled: !!tenant && !!id,
  })
}

export function useCreateOwner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Partial<PropertyOwner>) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { data, error } = await supabase
        .from('property_owners')
        .insert({ ...payload, tenant_id: tenant.id })
        .select()
        .single()
      if (error) throw error
      return data as PropertyOwner
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-owners'] })
      toast.success('Owner created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateOwner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PropertyOwner> }) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { data: result, error } = await supabase
        .from('property_owners')
        .update(data)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select()
        .single()
      if (error) throw error
      return result as PropertyOwner
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['property-owners'] })
      queryClient.invalidateQueries({ queryKey: ['property-owner', result.id] })
      toast.success('Owner updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteOwner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { error } = await supabase
        .from('property_owners')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-owners'] })
      toast.success('Owner deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
