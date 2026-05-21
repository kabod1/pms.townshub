import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Property, PropertyOwner, Unit } from '@/types/database'
import toast from 'react-hot-toast'

// ─── Property Owners ──────────────────────────────────────────────────────────

export function useOwners() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['property-owners', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_owners')
        .select('*')
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .order('last_name')
      if (error) throw error
      return data as PropertyOwner[]
    },
  })
}

// ─── Properties ───────────────────────────────────────────────────────────────

export function useProperties() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['properties', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return []
      const { data, error } = await supabase
        .from('properties')
        .select('*, owner:property_owners(first_name, last_name, company_name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
      if (error) {
        // fallback without join
        const { data: fallback, error: fallbackError } = await supabase
          .from('properties')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
        if (fallbackError) throw fallbackError
        return fallback as Property[]
      }
      return data as Property[]
    },
  })
}

export function useProperty(id: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['properties', id, tenant?.id],
    enabled: !!tenant && !!id,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return null
      const { data, error } = await supabase
        .from('properties')
        .select('*, owner:property_owners(first_name, last_name, company_name)')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Property
    },
  })
}

export function useCreateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Omit<Property, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'owner'>) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { data, error } = await supabase
        .from('properties')
        .insert({ ...input, tenant_id: tenant.id })
        .select()
        .single()
      if (error) throw error
      return data as Property
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      toast.success('Property created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Property> & { id: string }) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { error } = await supabase
        .from('properties')
        .update(input)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      toast.success('Property updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { error } = await supabase
        .from('properties')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenant.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      toast.success('Property deactivated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Units ────────────────────────────────────────────────────────────────────

export function useUnits(propertyId?: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['units', tenant?.id, propertyId],
    enabled: !!tenant,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return []
      let query = supabase
        .from('units')
        .select('*, property:properties(name, city), owner:property_owners(first_name, last_name)')
        .eq('tenant_id', tenantId)
        .order('unit_number')

      if (propertyId) query = query.eq('property_id', propertyId)

      const { data, error } = await query
      if (error) {
        // fallback without join
        let fallbackQuery = supabase
          .from('units')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('unit_number')
        if (propertyId) fallbackQuery = fallbackQuery.eq('property_id', propertyId)
        const { data: fallback, error: fallbackError } = await fallbackQuery
        if (fallbackError) throw fallbackError
        return fallback as Unit[]
      }
      return data as Unit[]
    },
  })
}

export function useUnit(id: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['units', id, tenant?.id],
    enabled: !!tenant && !!id,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return null
      const { data, error } = await supabase
        .from('units')
        .select('*, property:properties(name, city, address), owner:property_owners(first_name, last_name)')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Unit
    },
  })
}

export function useCreateUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Omit<Unit, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'property' | 'owner'>) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { data, error } = await supabase
        .from('units')
        .insert({ ...input, tenant_id: tenant.id })
        .select()
        .single()
      if (error) throw error
      return data as Unit
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      toast.success('Unit created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Unit> & { id: string }) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { error } = await supabase
        .from('units')
        .update(input)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      toast.success('Unit updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { error } = await supabase
        .from('units')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenant.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      toast.success('Unit deactivated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Leases for a unit ────────────────────────────────────────────────────────

export function useUnitLeases(unitId: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['leases', 'unit', unitId, tenant?.id],
    enabled: !!tenant && !!unitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leases')
        .select('*, property_tenant:property_tenants(first_name, last_name)')
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .eq('unit_id', unitId)
        .eq('status', 'active')
        .limit(1)
      if (error) throw error
      return data ?? []
    },
  })
}
