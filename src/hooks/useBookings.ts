import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Booking, BookingFilters } from '@/types'
import toast from 'react-hot-toast'

export function useBookings(filters?: BookingFilters) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['bookings', tenant?.id, filters],
    queryFn: async () => {
      if (!tenant) return []
      let query = supabase
        .from('bookings')
        .select(`*, guest:guests(*), room:rooms(*), room_type:room_types(*)`)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.dateFrom) query = query.gte('check_in_date', filters.dateFrom)
      if (filters?.dateTo) query = query.lte('check_out_date', filters.dateTo)
      if (filters?.search) {
        query = query.or(
          `booking_reference.ilike.%${filters.search}%`,
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as Booking[]
    },
    enabled: !!tenant,
  })
}

export function useBooking(id: string) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, guest:guests(*), room:rooms(*), room_type:room_types(*), rate_plan:rate_plans(*)`)
        .eq('id', id)
        .eq('tenant_id', tenant!.id)
        .single()
      if (error) throw error
      return data as Booking
    },
    enabled: !!tenant && !!id,
  })
}

export function useCreateBooking() {
  const queryClient = useQueryClient()
  const { tenant, user } = useAuthStore()

  return useMutation({
    mutationFn: async (payload: Partial<Booking>) => {
      const { data, error } = await supabase
        .from('bookings')
        .insert({ ...payload, tenant_id: tenant!.id, created_by: user!.id })
        .select()
        .single()
      if (error) throw error
      return data as Booking
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Booking created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Booking> & { id: string }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Booking
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['booking', data.id] })
      toast.success('Booking updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Booking deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
