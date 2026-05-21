import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { HousekeepingTask, HousekeepingStatus, HousekeepingTaskType, HousekeepingPriority, ChecklistItem } from '@/types'
import toast from 'react-hot-toast'

export function useHousekeepingTasks(statusFilter?: HousekeepingStatus) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['housekeeping', tenant?.id, statusFilter],
    queryFn: async () => {
      if (!tenant) return []
      let query = supabase
        .from('housekeeping_tasks')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('priority', { ascending: false })
        .order('created_at')

      if (statusFilter) query = query.eq('status', statusFilter)

      const { data, error } = await query
      if (error) throw error
      return data as HousekeepingTask[]
    },
    enabled: !!tenant,
  })
}

export function useCreateHousekeepingTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      room_id: string | null
      type: HousekeepingTaskType
      priority: HousekeepingPriority
      assigned_to: string | null
      notes: string | null
      checklist?: ChecklistItem[]
    }) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { error } = await supabase.from('housekeeping_tasks').insert({
        ...input,
        tenant_id: tenant.id,
        status: 'pending',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
      toast.success('Task created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useAutoGenerateTasks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')

      const { data: dirtyRooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, number')
        .eq('tenant_id', tenant.id)
        .eq('status', 'vacant_dirty')

      if (roomsError) throw roomsError
      if (!dirtyRooms || dirtyRooms.length === 0) {
        throw new Error('No dirty rooms found')
      }

      const tasks = dirtyRooms.map((room) => ({
        tenant_id: tenant.id,
        room_id: room.id,
        type: 'checkout_clean' as HousekeepingTaskType,
        status: 'pending',
        priority: 'high' as HousekeepingPriority,
        assigned_to: null,
        notes: null,
        checklist: DEFAULT_CHECKLISTS.checkout_clean,
      }))

      const { error } = await supabase.from('housekeeping_tasks').insert(tasks)
      if (error) throw error
      return dirtyRooms.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
      toast.success(`${count} checkout clean task${count > 1 ? 's' : ''} generated`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: HousekeepingStatus }) => {
      const update: Partial<HousekeepingTask> = { status }
      if (status === 'in_progress') update.started_at = new Date().toISOString()
      if (status === 'completed') update.completed_at = new Date().toISOString()
      const { error } = await supabase.from('housekeeping_tasks').update(update).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
      toast.success('Task updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateTaskChecklist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, checklist }: { id: string; checklist: ChecklistItem[] }) => {
      const { error } = await supabase
        .from('housekeeping_tasks')
        .update({ checklist })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export const DEFAULT_CHECKLISTS: Record<HousekeepingTaskType, ChecklistItem[]> = {
  checkout_clean: [
    { item: 'Strip all beds', done: false },
    { item: 'Replace bed linens', done: false },
    { item: 'Clean & disinfect bathroom', done: false },
    { item: 'Replace towels & toiletries', done: false },
    { item: 'Vacuum carpets / mop floors', done: false },
    { item: 'Wipe all surfaces', done: false },
    { item: 'Clean mirrors & windows', done: false },
    { item: 'Empty all bins', done: false },
    { item: 'Check & restock minibar', done: false },
    { item: 'Check for guest items left behind', done: false },
    { item: 'Report any damage', done: false },
  ],
  stayover_clean: [
    { item: 'Make beds', done: false },
    { item: 'Replace used towels', done: false },
    { item: 'Clean bathroom surfaces', done: false },
    { item: 'Restock toiletries', done: false },
    { item: 'Vacuum floors', done: false },
    { item: 'Wipe surfaces', done: false },
    { item: 'Empty bins', done: false },
    { item: 'Tidy room', done: false },
  ],
  deep_clean: [
    { item: 'Strip & replace linens', done: false },
    { item: 'Deep clean bathroom', done: false },
    { item: 'Clean grout & tiles', done: false },
    { item: 'Vacuum all surfaces incl. behind furniture', done: false },
    { item: 'Mop all floors', done: false },
    { item: 'Clean windows inside & out', done: false },
    { item: 'Wipe AC filters', done: false },
    { item: 'Clean light fixtures', done: false },
    { item: 'Inspect & clean under furniture', done: false },
    { item: 'Check all fixtures & fittings', done: false },
  ],
  inspection: [
    { item: 'Check all light bulbs', done: false },
    { item: 'Test AC / heating', done: false },
    { item: 'Test TV & remote', done: false },
    { item: 'Check safe / lock operation', done: false },
    { item: 'Inspect bathroom fixtures', done: false },
    { item: 'Check minibar stock', done: false },
    { item: 'Inspect furniture for damage', done: false },
    { item: 'Check windows & curtains', done: false },
  ],
  maintenance: [
    { item: 'Identify & document issue', done: false },
    { item: 'Complete repair', done: false },
    { item: 'Test repair', done: false },
    { item: 'Clean up work area', done: false },
  ],
  turndown: [
    { item: 'Turn down bed', done: false },
    { item: 'Place turndown amenities', done: false },
    { item: 'Replace used towels', done: false },
    { item: 'Empty bins', done: false },
    { item: 'Draw curtains', done: false },
    { item: 'Adjust lighting', done: false },
    { item: 'Set room temperature', done: false },
  ],
}
