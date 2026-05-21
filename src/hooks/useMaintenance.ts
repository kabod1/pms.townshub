import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { MaintenanceRequest, MaintenanceStatus } from '@/types'
import toast from 'react-hot-toast'

type MaintenanceInput = {
  room_id?: string | null
  category: MaintenanceRequest['category']
  description: string
  priority: MaintenanceRequest['priority']
  assigned_to?: string | null
}

export function useMaintenanceRequests(status?: MaintenanceStatus) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['maintenance', tenant?.id, status],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_requests')
        .select('*, room:rooms(id, number)')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })

      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error
      return data as MaintenanceRequest[]
    },
    enabled: !!tenant,
  })
}

export function useCreateMaintenanceRequest() {
  const { tenant, user } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: MaintenanceInput) => {
      const { error } = await supabase.from('maintenance_requests').insert({
        ...input,
        tenant_id: tenant!.id,
        reported_by: user!.id,
        status: 'open',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      toast.success('Maintenance request created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateMaintenanceRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string; status?: MaintenanceStatus; resolution_notes?: string; assigned_to?: string }) => {
      const payload: Record<string, unknown> = { ...updates }
      if (updates.status === 'completed') {
        payload.resolved_at = new Date().toISOString()
      }
      const { error } = await supabase
        .from('maintenance_requests')
        .update(payload)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      toast.success('Request updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
