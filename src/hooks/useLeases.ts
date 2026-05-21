import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Lease } from '@/types/database'
import toast from 'react-hot-toast'

interface LeaseFilters {
  status?: string
  unit_id?: string
}

export function useLeases(filters?: LeaseFilters) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['leases', tenant?.id, filters],
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant!.id
      let query = supabase
        .from('leases')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.unit_id) query = query.eq('unit_id', filters.unit_id)

      const { data, error } = await query
      if (error) throw error
      return data as Lease[]
    },
    enabled: !!tenant,
  })
}

export function useLease(id: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['lease', id, tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leases')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .single()
      if (error) throw error
      return data as Lease
    },
    enabled: !!tenant && !!id,
  })
}

export function useCreateLease() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Partial<Lease>) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { data, error } = await supabase
        .from('leases')
        .insert({ ...payload, tenant_id: tenant.id, status: 'draft' })
        .select()
        .single()
      if (error) throw error
      return data as Lease
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] })
      toast.success('Lease created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateLease() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Lease> }) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { data: result, error } = await supabase
        .from('leases')
        .update(data)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select()
        .single()
      if (error) throw error
      return result as Lease
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leases'] })
      queryClient.invalidateQueries({ queryKey: ['lease', result.id] })
      toast.success('Lease updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useActivateLease() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { data, error } = await supabase
        .from('leases')
        .update({ status: 'active' })
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .eq('status', 'draft')
        .select()
        .single()
      if (error) throw error
      return data as Lease
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leases'] })
      queryClient.invalidateQueries({ queryKey: ['lease', result.id] })
      queryClient.invalidateQueries({ queryKey: ['rent-schedule'] })
      toast.success('Lease activated — rent schedule generated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
