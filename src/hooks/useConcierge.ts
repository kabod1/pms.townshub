/**
 * useConcierge — real Supabase-backed concierge hooks
 *
 * Provides:
 *  - useConciergeCategories()    — list categories
 *  - useConciergeItems()         — list active concierge guide items
 *  - useConciergeServices()      — bookable services (tours, spa, etc.)
 *  - useConciergeRequests()      — guest requests with status tracking
 *  - useSaveCategory()           — create a category
 *  - useSaveItem()               — create/update a guide item
 *  - useDeleteItem()             — soft-delete a guide item
 *  - useSaveService()            — create/update a bookable service
 *  - useDeleteService()          — soft-delete a bookable service
 *  - useCreateRequest()          — create a concierge request (staff or guest widget)
 *  - useUpdateRequestStatus()    — update status / notes on a request
 *  - REQUEST_STATUSES, REQUEST_TYPES — label maps
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { ConciergeCategory, ConciergeItem } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConciergeRequestStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
export type ConciergeRequestType   = 'general' | 'tour' | 'transfer' | 'spa' | 'restaurant' | 'transport' | 'other'

export interface ConciergeService {
  id:               string
  tenant_id:        string
  category_id:      string | null
  name:             string
  description:      string | null
  price:            number | null
  price_unit:       'per person' | 'per group' | 'per booking' | 'included' | 'on request'
  duration_minutes: number | null
  max_capacity:     number | null
  is_active:        boolean
  sort_order:       number
  created_at:       string
  updated_at:       string
}

export interface ConciergeRequest {
  id:             string
  tenant_id:      string
  booking_id:     string | null
  guest_id:       string | null
  service_id:     string | null
  item_id:        string | null
  request_type:   ConciergeRequestType
  title:          string
  details:        string | null
  preferred_date: string | null
  preferred_time: string | null
  guests_count:   number
  status:         ConciergeRequestStatus
  assigned_to:    string | null
  staff_notes:    string | null
  price_quoted:   number | null
  confirmed_at:   string | null
  completed_at:   string | null
  cancelled_at:   string | null
  cancel_reason:  string | null
  created_at:     string
  updated_at:     string
  // joined
  booking?: { booking_reference: string }
  guest?:   { first_name: string; last_name: string; email: string | null }
  assignee?: { full_name: string }
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const REQUEST_STATUS_LABELS: Record<ConciergeRequestStatus, string> = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
}

export const REQUEST_STATUS_COLORS: Record<ConciergeRequestStatus, string> = {
  pending:     'bg-amber-100 text-amber-800',
  confirmed:   'bg-blue-100 text-blue-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
}

export const REQUEST_TYPE_LABELS: Record<ConciergeRequestType, string> = {
  general:    'General',
  tour:       'Tour',
  transfer:   'Transfer',
  spa:        'Spa',
  restaurant: 'Restaurant',
  transport:  'Transport',
  other:      'Other',
}

export const PRICE_UNIT_LABELS: Record<ConciergeService['price_unit'], string> = {
  'per person':  'Per Person',
  'per group':   'Per Group',
  'per booking': 'Per Booking',
  'included':    'Included',
  'on request':  'On Request',
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const conciergeKeys = {
  categories: (tid: string)            => ['concierge-categories', tid] as const,
  items:      (tid: string)            => ['concierge-items',      tid] as const,
  services:   (tid: string)            => ['concierge-services',   tid] as const,
  requests:   (tid: string, status?: string) => ['concierge-requests', tid, status] as const,
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useConciergeCategories() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: conciergeKeys.categories(tenant?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('concierge_categories')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data as ConciergeCategory[]
    },
    enabled: !!tenant,
    staleTime: 60_000,
  })
}

export function useConciergeItems() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: conciergeKeys.items(tenant?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('concierge_items')
        .select('*, category:concierge_categories(id, name)')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data as ConciergeItem[]
    },
    enabled: !!tenant,
    staleTime: 30_000,
  })
}

export function useConciergeServices() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: conciergeKeys.services(tenant?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('concierge_services')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data as ConciergeService[]
    },
    enabled: !!tenant,
    staleTime: 30_000,
  })
}

export function useConciergeRequests(status?: ConciergeRequestStatus) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: conciergeKeys.requests(tenant?.id ?? '', status),
    queryFn: async () => {
      let q = supabase
        .from('concierge_requests')
        .select('*, booking:bookings(booking_reference), guest:guests(first_name, last_name, email), assignee:users(full_name)')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (status) q = q.eq('status', status)

      const { data, error } = await q
      if (error) throw error
      return data as ConciergeRequest[]
    },
    enabled: !!tenant,
    staleTime: 20_000,
    refetchInterval: 60_000,  // poll for new requests every minute
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

interface SaveCategoryVars {
  id?:   string
  name:  string
  icon?: string
}

export function useSaveCategory() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name, icon }: SaveCategoryVars) => {
      if (id) {
        const { error } = await supabase
          .from('concierge_categories')
          .update({ name, icon: icon ?? null })
          .eq('id', id).eq('tenant_id', tenant!.id)
        if (error) throw error
      } else {
        const { data: existing } = await supabase
          .from('concierge_categories')
          .select('id')
          .eq('tenant_id', tenant!.id)
        const { error } = await supabase
          .from('concierge_categories')
          .insert({ tenant_id: tenant!.id, name, icon: icon ?? null, sort_order: (existing?.length ?? 0), is_active: true })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conciergeKeys.categories(tenant?.id ?? '') })
      toast.success('Category saved')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to save category'),
  })
}

interface SaveItemVars {
  id?:               string
  title:             string
  description?:      string
  categoryId?:       string
  address?:          string
  phone?:            string
  website?:          string
  distanceMinutes?:  number
  tags?:             string[]
}

export function useSaveItem() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, title, description, categoryId, address, phone, website, distanceMinutes, tags }: SaveItemVars) => {
      const { data: existing } = await supabase
        .from('concierge_items').select('id').eq('tenant_id', tenant!.id)
      const payload = {
        tenant_id:        tenant!.id,
        title,
        description:      description ?? null,
        category_id:      categoryId ?? null,
        address:          address ?? null,
        phone:            phone ?? null,
        website:          website ?? null,
        distance_minutes: distanceMinutes ?? null,
        tags:             tags ?? [],
        is_active:        true,
        sort_order:       id ? undefined : (existing?.length ?? 0),
      }

      if (id) {
        const { error } = await supabase
          .from('concierge_items').update(payload).eq('id', id).eq('tenant_id', tenant!.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('concierge_items').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conciergeKeys.items(tenant?.id ?? '') })
      toast.success('Item saved')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to save item'),
  })
}

export function useDeleteItem() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('concierge_items')
        .update({ is_active: false })
        .eq('id', id).eq('tenant_id', tenant!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conciergeKeys.items(tenant?.id ?? '') })
      toast.success('Item removed')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to remove item'),
  })
}

interface SaveServiceVars {
  id?:              string
  name:             string
  description?:     string
  categoryId?:      string
  price?:           number
  priceUnit?:       ConciergeService['price_unit']
  durationMinutes?: number
  maxCapacity?:     number
}

export function useSaveService() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name, description, categoryId, price, priceUnit, durationMinutes, maxCapacity }: SaveServiceVars) => {
      const { data: existing } = await supabase
        .from('concierge_services').select('id').eq('tenant_id', tenant!.id)
      const payload = {
        tenant_id:        tenant!.id,
        name,
        description:      description ?? null,
        category_id:      categoryId ?? null,
        price:            price ?? null,
        price_unit:       priceUnit ?? 'per person',
        duration_minutes: durationMinutes ?? null,
        max_capacity:     maxCapacity ?? null,
        is_active:        true,
        sort_order:       id ? undefined : (existing?.length ?? 0),
      }

      if (id) {
        const { error } = await supabase
          .from('concierge_services').update(payload).eq('id', id).eq('tenant_id', tenant!.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('concierge_services').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conciergeKeys.services(tenant?.id ?? '') })
      toast.success('Service saved')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to save service'),
  })
}

export function useDeleteService() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('concierge_services')
        .update({ is_active: false })
        .eq('id', id).eq('tenant_id', tenant!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conciergeKeys.services(tenant?.id ?? '') })
      toast.success('Service removed')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to remove service'),
  })
}

interface CreateRequestVars {
  title:          string
  requestType?:   ConciergeRequestType
  details?:       string
  bookingId?:     string
  guestId?:       string
  serviceId?:     string
  preferredDate?: string
  preferredTime?: string
  guestsCount?:   number
  priceQuoted?:   number
}

export function useCreateRequest() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: CreateRequestVars) => {
      const { data, error } = await supabase
        .from('concierge_requests')
        .insert({
          tenant_id:      tenant!.id,
          booking_id:     vars.bookingId ?? null,
          guest_id:       vars.guestId ?? null,
          service_id:     vars.serviceId ?? null,
          request_type:   vars.requestType ?? 'general',
          title:          vars.title,
          details:        vars.details ?? null,
          preferred_date: vars.preferredDate ?? null,
          preferred_time: vars.preferredTime ?? null,
          guests_count:   vars.guestsCount ?? 1,
          price_quoted:   vars.priceQuoted ?? null,
          status:         'pending',
        })
        .select()
        .single()
      if (error) throw error
      return data as ConciergeRequest
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concierge-requests', tenant?.id] })
      toast.success('Request created')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to create request'),
  })
}

interface UpdateRequestVars {
  id:           string
  status?:      ConciergeRequestStatus
  staffNotes?:  string
  priceQuoted?: number
  assignedTo?:  string
}

export function useUpdateRequest() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status, staffNotes, priceQuoted, assignedTo }: UpdateRequestVars) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (status !== undefined)      updates.status       = status
      if (staffNotes !== undefined)  updates.staff_notes  = staffNotes
      if (priceQuoted !== undefined) updates.price_quoted = priceQuoted
      if (assignedTo !== undefined)  updates.assigned_to  = assignedTo

      const { error } = await supabase
        .from('concierge_requests')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenant!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concierge-requests', tenant?.id] })
      toast.success('Request updated')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to update request'),
  })
}
