/**
 * useLoyalty — real Supabase-backed loyalty programme hooks
 *
 * Provides:
 *  - useLoyaltyAccounts()    — list all loyalty accounts with guest info
 *  - useLoyaltyTransactions()— list recent transactions
 *  - useLoyaltyAccount(guestId) — single account for a guest
 *  - useEnrolGuest()         — mutate: enrol a guest (creates account row)
 *  - useAdjustPoints()       — mutate: earn / redeem / adjust / expire manually
 *  - TIER_THRESHOLDS, TIER_DISCOUNTS — shared constants
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { LoyaltyAccount, LoyaltyTransaction, LoyaltyTierName } from '@/types'

// ── Tier config ───────────────────────────────────────────────────────────────

export const TIER_ORDER: LoyaltyTierName[] = ['bronze', 'silver', 'gold', 'platinum']

/** Lifetime-points thresholds for each tier */
export const TIER_THRESHOLDS: Record<LoyaltyTierName, number> = {
  bronze:   0,
  silver:   1_000,
  gold:     5_000,
  platinum: 15_000,
}

/** Room-rate discount percentages per tier */
export const TIER_DISCOUNTS: Record<LoyaltyTierName, number> = {
  bronze:   0,
  silver:   5,
  gold:     10,
  platinum: 15,
}

/** Calculate tier from lifetime points */
export function tierFromPoints(lifetimePoints: number): LoyaltyTierName {
  return (
    TIER_ORDER.slice().reverse().find((t) => lifetimePoints >= TIER_THRESHOLDS[t]) ?? 'bronze'
  )
}

/** Points-to-€ redemption rate: 100 pts = €1 */
export const POINTS_PER_EUR = 100

// ── Query keys ────────────────────────────────────────────────────────────────

export const loyaltyKeys = {
  accounts:     (tenantId: string) => ['loyalty-accounts',     tenantId] as const,
  transactions: (tenantId: string) => ['loyalty-transactions', tenantId] as const,
  account:      (tenantId: string, guestId: string) => ['loyalty-account', tenantId, guestId] as const,
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** All loyalty accounts for the tenant, ordered by balance descending */
export function useLoyaltyAccounts() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: loyaltyKeys.accounts(tenant?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_accounts')
        .select('*, guest:guests(first_name, last_name, email)')
        .eq('tenant_id', tenant!.id)
        .order('points_balance', { ascending: false })
      if (error) throw error
      return data as LoyaltyAccount[]
    },
    enabled: !!tenant,
    staleTime: 30_000,
  })
}

/** Recent loyalty transactions (last 100) */
export function useLoyaltyTransactions() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: loyaltyKeys.transactions(tenant?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*, booking:bookings(booking_reference)')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as LoyaltyTransaction[]
    },
    enabled: !!tenant,
    staleTime: 30_000,
  })
}

/** Single loyalty account for a specific guest */
export function useLoyaltyAccount(guestId: string | null | undefined) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: loyaltyKeys.account(tenant?.id ?? '', guestId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_accounts')
        .select('*, guest:guests(first_name, last_name, email)')
        .eq('tenant_id', tenant!.id)
        .eq('guest_id', guestId!)
        .maybeSingle()
      if (error) throw error
      return data as LoyaltyAccount | null
    },
    enabled: !!tenant && !!guestId,
    staleTime: 30_000,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

interface EnrolGuestVars {
  guestId: string
}

/** Enrol a guest in the loyalty programme (creates loyalty_accounts row) */
export function useEnrolGuest() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ guestId }: EnrolGuestVars) => {
      // Upsert via direct Supabase (anon key respects RLS)
      const { data, error } = await supabase
        .from('loyalty_accounts')
        .upsert(
          { tenant_id: tenant!.id, guest_id: guestId, points_balance: 0, lifetime_points: 0, tier: 'bronze' },
          { onConflict: 'tenant_id,guest_id', ignoreDuplicates: false }
        )
        .select()
        .single()
      if (error) throw error
      return data as LoyaltyAccount
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loyaltyKeys.accounts(tenant?.id ?? '') })
      toast.success('Guest enrolled in loyalty programme')
    },
    onError: (err: any) => toast.error(err.message ?? 'Enrol failed'),
  })
}

interface AdjustPointsVars {
  accountId: string
  type: 'earn' | 'redeem' | 'adjust' | 'expire'
  points: number          // always positive; sign is inferred from type
  description: string
  bookingId?: string | null
}

/**
 * Manually adjust points on an account.
 * Handles all four transaction types — updates balance and recalculates tier.
 */
export function useAdjustPoints() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ accountId, type, points, description, bookingId }: AdjustPointsVars) => {
      // Fetch current account
      const { data: account, error: fetchErr } = await supabase
        .from('loyalty_accounts')
        .select('points_balance, lifetime_points')
        .eq('id', accountId)
        .eq('tenant_id', tenant!.id)
        .single()
      if (fetchErr || !account) throw new Error('Account not found')

      const isDebit   = type === 'redeem' || type === 'expire'
      const delta     = isDebit ? -points : points
      const newBalance = Math.max(0, account.points_balance + delta)
      const newLifetime = type === 'earn'
        ? account.lifetime_points + points
        : account.lifetime_points
      const newTier = tierFromPoints(newLifetime)

      // Insert transaction
      const { error: txErr } = await supabase.from('loyalty_transactions').insert({
        account_id:  accountId,
        tenant_id:   tenant!.id,
        booking_id:  bookingId ?? null,
        type,
        points:      delta,
        description,
      })
      if (txErr) throw txErr

      // Update account
      const { error: updateErr } = await supabase
        .from('loyalty_accounts')
        .update({
          points_balance:  newBalance,
          lifetime_points: newLifetime,
          tier:            newTier,
          updated_at:      new Date().toISOString(),
        })
        .eq('id', accountId)
      if (updateErr) throw updateErr

      return { newBalance, newTier }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-accounts',     tenant?.id] })
      qc.invalidateQueries({ queryKey: ['loyalty-transactions', tenant?.id] })
      toast.success('Points updated')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to adjust points'),
  })
}

// ── Aggregate stats ────────────────────────────────────────────────────────────

export interface LoyaltyStats {
  totalMembers:   number
  totalPoints:    number
  platinumCount:  number
  goldCount:      number
  silverCount:    number
  bronzeCount:    number
  pointsRedeemed: number
}

export function useLoyaltyStats(
  accounts: LoyaltyAccount[],
  transactions: LoyaltyTransaction[]
): LoyaltyStats {
  const totalMembers   = accounts.length
  const totalPoints    = accounts.reduce((s, a) => s + a.points_balance, 0)
  const platinumCount  = accounts.filter((a) => a.tier === 'platinum').length
  const goldCount      = accounts.filter((a) => a.tier === 'gold').length
  const silverCount    = accounts.filter((a) => a.tier === 'silver').length
  const bronzeCount    = accounts.filter((a) => a.tier === 'bronze').length
  const pointsRedeemed = transactions
    .filter((t) => t.type === 'redeem')
    .reduce((s, t) => s + Math.abs(t.points), 0)

  return { totalMembers, totalPoints, platinumCount, goldCount, silverCount, bronzeCount, pointsRedeemed }
}
