import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { RentSchedule, PropertyPaymentMethod } from '@/types/database'
import toast from 'react-hot-toast'

// ─── Rent Schedule ─────────────────────────────────────────────────────────────

interface RentScheduleFilters {
  leaseId?: string
  status?: string
  month?: string // YYYY-MM format
}

export function useRentSchedule(filters?: RentScheduleFilters) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['rent-schedule', tenant?.id, filters],
    enabled: !!tenant,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return []

      let query = supabase
        .from('rent_schedule')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: false })

      if (filters?.leaseId) query = query.eq('lease_id', filters.leaseId)
      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.month) {
        const start = `${filters.month}-01`
        const [year, month] = filters.month.split('-').map(Number)
        const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
        query = query.gte('due_date', start).lt('due_date', nextMonth)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as RentSchedule[]
    },
  })
}

// ─── Property Tenants (for enrichment) ────────────────────────────────────────

export function usePropertyTenants() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['property-tenants-list', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return []
      const { data, error } = await supabase
        .from('property_tenants')
        .select('id, first_name, last_name')
        .eq('tenant_id', tenantId)
        .order('last_name')
      if (error) throw error
      return data ?? []
    },
  })
}

// ─── Record Payment ─────────────────────────────────────────────────────────────

interface RecordPaymentInput {
  rent_schedule_id: string
  lease_id: string | null
  property_tenant_id: string | null
  unit_id: string | null
  amount: number
  current_paid_amount: number
  total_amount: number
  method: PropertyPaymentMethod
  reference?: string
  payment_date: string
  notes?: string
}

export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')

      // 1. Insert into property_payments
      const { error: paymentError } = await supabase.from('property_payments').insert({
        tenant_id: tenant.id,
        lease_id: input.lease_id,
        rent_schedule_id: input.rent_schedule_id,
        property_tenant_id: input.property_tenant_id,
        unit_id: input.unit_id,
        amount: input.amount,
        payment_type: 'rent' as const,
        method: input.method,
        reference: input.reference ?? null,
        payment_date: input.payment_date,
        notes: input.notes ?? null,
        receipt_url: null,
        recorded_by: null,
      })
      if (paymentError) throw paymentError

      // 2. Update rent_schedule: paid_amount and status
      const newPaidAmount = input.current_paid_amount + input.amount
      const newStatus =
        newPaidAmount >= input.total_amount
          ? 'paid'
          : newPaidAmount > 0
          ? 'partial'
          : 'pending'

      const { error: scheduleError } = await supabase
        .from('rent_schedule')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          paid_date: newStatus === 'paid' ? input.payment_date : null,
        })
        .eq('id', input.rent_schedule_id)
        .eq('tenant_id', tenant.id)

      if (scheduleError) throw scheduleError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['rent-summary'] })
      toast.success('Payment recorded successfully')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Rent Summary ──────────────────────────────────────────────────────────────

interface RentSummary {
  totalCollectedThisMonth: number
  totalOverdueAmount: number
  overdueCount: number
  upcomingCount: number
  upcomingAmount: number
  totalDueThisMonth: number
}

export function useRentSummary() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['rent-summary', tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<RentSummary> => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) {
        return {
          totalCollectedThisMonth: 0,
          totalOverdueAmount: 0,
          overdueCount: 0,
          upcomingCount: 0,
          upcomingAmount: 0,
          totalDueThisMonth: 0,
        }
      }

      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const nextMonthStart =
        now.getMonth() === 11
          ? `${now.getFullYear() + 1}-01-01`
          : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`
      const today = now.toISOString().slice(0, 10)
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('rent_schedule')
        .select('amount, paid_amount, balance, status, due_date')
        .eq('tenant_id', tenantId)

      if (error) throw error
      const rows = data ?? []

      // This month's entries
      const thisMonthRows = rows.filter(
        (r) => r.due_date >= monthStart && r.due_date < nextMonthStart,
      )

      const totalDueThisMonth = thisMonthRows.reduce((s, r) => s + (r.amount ?? 0), 0)
      const totalCollectedThisMonth = thisMonthRows.reduce((s, r) => s + (r.paid_amount ?? 0), 0)

      // Overdue
      const overdueRows = rows.filter((r) => r.status === 'overdue')
      const totalOverdueAmount = overdueRows.reduce((s, r) => s + (r.balance ?? 0), 0)

      // Upcoming in next 7 days (pending/partial, due between today and today+7)
      const upcomingRows = rows.filter(
        (r) =>
          (r.status === 'pending' || r.status === 'partial') &&
          r.due_date >= today &&
          r.due_date <= in7Days,
      )
      const upcomingAmount = upcomingRows.reduce((s, r) => s + (r.balance ?? 0), 0)

      return {
        totalCollectedThisMonth,
        totalOverdueAmount,
        overdueCount: overdueRows.length,
        upcomingCount: upcomingRows.length,
        upcomingAmount,
        totalDueThisMonth,
      }
    },
  })
}
