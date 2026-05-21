import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Room, RoomFilters, RoomType } from '@/types'
import toast from 'react-hot-toast'

type RoomTypeInput = Omit<RoomType, 'id' | 'tenant_id' | 'created_at'>

export function useRooms(filters?: RoomFilters) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['rooms', tenant?.id, filters],
    queryFn: async () => {
      if (!tenant) return []
      let query = supabase
        .from('rooms')
        .select('*, room_type:room_types(*)')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('number')

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.floor) query = query.eq('floor', filters.floor)
      if (filters?.roomTypeId) query = query.eq('room_type_id', filters.roomTypeId)

      const { data, error } = await query
      if (error) throw error
      return data as Room[]
    },
    enabled: !!tenant,
  })
}

export function useRoomTypes() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['room-types', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data as RoomType[]
    },
    enabled: !!tenant,
  })
}

export function useCreateRoom() {
  const { tenant } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      number: string
      room_type_id: string | null
      floor: number | null
      status: Room['status']
      notes: string | null
    }) => {
      const { error } = await supabase
        .from('rooms')
        .insert({ ...input, tenant_id: tenant!.id, is_active: true })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      toast.success('Room added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; number?: string; room_type_id?: string | null; floor?: number | null; status?: Room['status']; notes?: string | null }) => {
      const { error } = await supabase.from('rooms').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      toast.success('Room updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateRoomStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Room['status'] }) => {
      const { error } = await supabase.from('rooms').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      toast.success('Room status updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCreateRoomType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RoomTypeInput) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')
      const { error } = await supabase
        .from('room_types')
        .insert({ ...input, tenant_id: tenant.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-types'] })
      toast.success('Room type created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateRoomType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<RoomTypeInput> & { id: string }) => {
      const { error } = await supabase.from('room_types').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-types'] })
      toast.success('Room type updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
