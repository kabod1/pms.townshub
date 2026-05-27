import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Lease } from '@/types/database'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'

// Extended Lease type with joined unit and renter data
// Use Omit to avoid conflicting with the Unit type on the unit field
export interface LeaseWithDetails extends Omit<Lease, 'unit' | 'property_tenant'> {
  unit?: {
    id: string
    unit_number: string
    type: string
    property?: {
      id: string
      name: string
    }
  }
  property_tenant?: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
  }
}

interface LeaseFilters {
  status?: string
  unit_id?: string
}

const LEASE_DETAIL_SELECT = `
  *,
  unit:units(id, unit_number, type, property:properties(id, name)),
  property_tenant:property_tenants(id, first_name, last_name, email, phone)
`

export function useLeases(filters?: LeaseFilters) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['leases', tenant?.id, filters],
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant!.id
      let query = supabase
        .from('leases')
        .select(LEASE_DETAIL_SELECT)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.unit_id) query = query.eq('unit_id', filters.unit_id)

      const { data, error } = await query
      if (error) {
        // fallback to plain select if joins fail
        let fbQuery = supabase
          .from('leases')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
        if (filters?.status) fbQuery = fbQuery.eq('status', filters.status)
        if (filters?.unit_id) fbQuery = fbQuery.eq('unit_id', filters.unit_id)
        const { data: fb, error: fbErr } = await fbQuery
        if (fbErr) throw fbErr
        return fb as LeaseWithDetails[]
      }
      return data as LeaseWithDetails[]
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
        .select(LEASE_DETAIL_SELECT)
        .eq('id', id)
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .single()
      if (error) throw error
      return data as LeaseWithDetails
    },
    enabled: !!tenant && !!id,
  })
}

/**
 * Leases expiring within the next `days` days (default 30).
 * Only returns active leases with a non-null end_date.
 */
export function useExpiringLeases(days = 30) {
  const { tenant } = useAuthStore()
  const today = format(new Date(), 'yyyy-MM-dd')
  const cutoff = format(addDays(new Date(), days), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['leases-expiring', tenant?.id, days],
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant!.id
      const { data, error } = await supabase
        .from('leases')
        .select(LEASE_DETAIL_SELECT)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .not('end_date', 'is', null)
        .gte('end_date', today)
        .lte('end_date', cutoff)
        .order('end_date', { ascending: true })
      if (error) throw error
      return data as LeaseWithDetails[]
    },
    enabled: !!tenant,
  })
}

/**
 * Alias kept for backward compat — returns leases expiring in 30 days
 */
export const useExpiredLeases = () => useExpiringLeases(30)

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
