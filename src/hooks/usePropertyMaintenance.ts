import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type {
  PropertyMaintenance,
  PropertyMaintenanceStatus,
  PropertyMaintenancePriority,
  PropertyMaintenanceCategory,
} from '@/types/database'
import toast from 'react-hot-toast'

interface PropertyMaintenanceFilters {
  unit_id?: string
  property_id?: string
  status?: PropertyMaintenanceStatus
  priority?: PropertyMaintenancePriority
  category?: PropertyMaintenanceCategory
}

export function usePropertyMaintenanceList(filters?: PropertyMaintenanceFilters) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['property-maintenance', tenant?.id, filters],
    enabled: !!tenant,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return []

      let query = supabase
        .from('property_maintenance')
        .select('*, unit:units(unit_number), property:properties(name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (filters?.unit_id) query = query.eq('unit_id', filters.unit_id)
      if (filters?.property_id) query = query.eq('property_id', filters.property_id)
      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.priority) query = query.eq('priority', filters.priority)
      if (filters?.category) query = query.eq('category', filters.category)

      const { data, error } = await query
      if (error) {
        // fallback without join
        let fallbackQuery = supabase
          .from('property_maintenance')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
        if (filters?.unit_id) fallbackQuery = fallbackQuery.eq('unit_id', filters.unit_id)
        if (filters?.property_id) fallbackQuery = fallbackQuery.eq('property_id', filters.property_id)
        if (filters?.status) fallbackQuery = fallbackQuery.eq('status', filters.status)
        if (filters?.priority) fallbackQuery = fallbackQuery.eq('priority', filters.priority)
        if (filters?.category) fallbackQuery = fallbackQuery.eq('category', filters.category)
        const { data: fallback, error: fallbackError } = await fallbackQuery
        if (fallbackError) throw fallbackError
        return (fallback ?? []) as PropertyMaintenance[]
      }
      return (data ?? []) as PropertyMaintenance[]
    },
  })
}

interface CreatePropertyMaintenanceInput {
  unit_id?: string | null
  property_id?: string | null
  lease_id?: string | null
  reported_by_type: 'tenant' | 'owner' | 'manager' | 'inspection'
  reported_by_tenant?: string | null
  category: PropertyMaintenanceCategory
  title: string
  description: string
  priority: PropertyMaintenancePriority
  estimated_cost?: number | null
  cost_responsibility: 'owner' | 'tenant' | 'insurance' | 'shared'
  contractor_name?: string | null
  contractor_phone?: string | null
  scheduled_date?: string | null
}

export function useCreatePropertyMaintenance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreatePropertyMaintenanceInput) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')

      const { error } = await supabase.from('property_maintenance').insert({
        ...input,
        tenant_id: tenant.id,
        status: 'reported' as PropertyMaintenanceStatus,
        actual_cost: null,
        completed_date: null,
        photos: [],
        resolution_notes: null,
        reported_by_user: null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-maintenance'] })
      toast.success('Maintenance request created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

interface UpdatePropertyMaintenanceInput {
  id: string
  status?: PropertyMaintenanceStatus
  priority?: PropertyMaintenancePriority
  contractor_name?: string | null
  contractor_phone?: string | null
  scheduled_date?: string | null
  completed_date?: string | null
  actual_cost?: number | null
  estimated_cost?: number | null
  resolution_notes?: string | null
  cost_responsibility?: 'owner' | 'tenant' | 'insurance' | 'shared'
}

export function useUpdatePropertyMaintenance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...update }: UpdatePropertyMaintenanceInput) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')

      const { error } = await supabase
        .from('property_maintenance')
        .update(update)
        .eq('id', id)
        .eq('tenant_id', tenant.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-maintenance'] })
      toast.success('Maintenance request updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
