import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { PropertyTenant } from '@/types/database'
import toast from 'react-hot-toast'

export function useRenters() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['property-tenants', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_tenants')
        .select('*')
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .order('last_name')
      if (error) throw error
      return data as PropertyTenant[]
    },
    enabled: !!tenant,
  })
}

export function useRenter(id: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['property-tenant', id, tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_tenants')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .single()
      if (error) throw error
      return data as PropertyTenant
    },
    enabled: !!tenant && !!id,
  })
}

export function useCreateRenter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Partial<PropertyTenant>) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { data, error } = await supabase
        .from('property_tenants')
        .insert({ ...payload, tenant_id: tenant.id })
        .select()
        .single()
      if (error) throw error
      return data as PropertyTenant
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-tenants'] })
      toast.success('Renter created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateRenter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PropertyTenant> }) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { data: result, error } = await supabase
        .from('property_tenants')
        .update(data)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select()
        .single()
      if (error) throw error
      return result as PropertyTenant
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['property-tenants'] })
      queryClient.invalidateQueries({ queryKey: ['property-tenant', result.id] })
      toast.success('Renter updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteRenter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { error } = await supabase
        .from('property_tenants')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-tenants'] })
      toast.success('Renter deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
