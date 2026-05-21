import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Gift, TrendingUp, Users } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatCard } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { LOYALTY_TIER_LABELS, LOYALTY_TIER_COLORS, LOYALTY_TRANSACTION_LABELS } from '@/lib/constants'
import toast from 'react-hot-toast'
import type { LoyaltyAccount, LoyaltyTransaction, LoyaltyTierName } from '@/types'

const adjustSchema = z.object({
  account_id: z.string().min(1),
  type: z.string().min(1),
  points: z.coerce.number().min(1, 'Points must be positive'),
  description: z.string().min(1, 'Description required'),
})
type AdjustForm = z.infer<typeof adjustSchema>

const TIER_ORDER: LoyaltyTierName[] = ['bronze', 'silver', 'gold', 'platinum']
const TIER_THRESHOLDS: Record<LoyaltyTierName, number> = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 15000,
}
const TIER_DISCOUNTS: Record<LoyaltyTierName, number> = {
  bronze: 0,
  silver: 5,
  gold: 10,
  platinum: 15,
}

function useLoyaltyAccounts() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['loyalty-accounts', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_accounts')
        .select('*, guest:guests(first_name,last_name,email)')
        .eq('tenant_id', tenant!.id)
        .order('points_balance', { ascending: false })
      if (error) throw error
      return data as LoyaltyAccount[]
    },
    enabled: !!tenant,
  })
}

function useLoyaltyTransactions() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['loyalty-transactions', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*, booking:bookings(booking_reference)')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as LoyaltyTransaction[]
    },
    enabled: !!tenant,
  })
}

export default function LoyaltyPage() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions' | 'tiers'>('accounts')
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<LoyaltyAccount | null>(null)

  const { data: accounts = [], isLoading: accLoading } = useLoyaltyAccounts()
  const { data: transactions = [], isLoading: txLoading } = useLoyaltyTransactions()

  const adjustForm = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { type: 'adjust' },
  })

  const adjustPoints = useMutation({
    mutationFn: async (data: AdjustForm) => {
      const account = accounts.find((a) => a.id === data.account_id)
      if (!account) throw new Error('Account not found')
      const delta = data.type === 'redeem' ? -data.points : data.points
      const newBalance = Math.max(0, account.points_balance + delta)
      const newLifetime = data.type === 'earn' ? account.lifetime_points + data.points : account.lifetime_points
      const newTier = TIER_ORDER.slice().reverse().find((t) => newLifetime >= TIER_THRESHOLDS[t]) ?? 'bronze'
      await supabase.from('loyalty_accounts').update({
        points_balance: newBalance,
        lifetime_points: newLifetime,
        tier: newTier,
      }).eq('id', data.account_id)
      await supabase.from('loyalty_transactions').insert({
        account_id: data.account_id,
        tenant_id: tenant!.id,
        type: data.type,
        points: data.type === 'redeem' ? -data.points : data.points,
        description: data.description,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-accounts'] })
      qc.invalidateQueries({ queryKey: ['loyalty-transactions'] })
      toast.success('Points adjusted')
      setShowAdjustModal(false)
      adjustForm.reset({ type: 'adjust' })
    },
    onError: () => toast.error('Failed to adjust points'),
  })

  const isLoading = accLoading || txLoading

  const totalMembers = accounts.length
  const totalPoints = accounts.reduce((s, a) => s + a.points_balance, 0)
  const platinumCount = accounts.filter((a) => a.tier === 'platinum').length

  const accountOptions = accounts.map((a) => {
    const guest = a.guest as { first_name: string; last_name: string } | null
    return { value: a.id, label: guest ? `${guest.first_name} ${guest.last_name} (${a.points_balance} pts)` : a.id }
  })

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">Loyalty Programme</h1>
            <p className="text-sm text-subtext">Points, tiers, rewards, and redemption management</p>
          </div>
          <Button size="sm" onClick={() => { setShowAdjustModal(true); adjustForm.reset({ type: 'earn' }) }}>
            <Plus size={15} /> Adjust Points
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Total Members" value={totalMembers} icon={<Users size={20} />} color="navy" />
          <StatCard title="Points in Circulation" value={totalPoints.toLocaleString()} icon={<Gift size={20} />} color="gold" />
          <StatCard title="Platinum Members" value={platinumCount} icon={<TrendingUp size={20} />} color="blue" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-mid">
          {(['accounts', 'transactions', 'tiers'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === tab ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
              }`}
            >
              {tab === 'accounts' ? 'Members' : tab === 'transactions' ? 'Transactions' : 'Tier Structure'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : activeTab === 'accounts' ? (
          accounts.length === 0 ? (
            <EmptyState icon={<Gift size={32} />} title="No loyalty members" description="Loyalty accounts are created automatically when guests enrol." />
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => {
                const guest = acc.guest as { first_name: string; last_name: string; email: string } | null
                const nextTier = TIER_ORDER[TIER_ORDER.indexOf(acc.tier) + 1]
                const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : null
                const pct = nextThreshold ? Math.min(100, Math.round((acc.lifetime_points / nextThreshold) * 100)) : 100
                return (
                  <div key={acc.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-body">
                            {guest ? `${guest.first_name} ${guest.last_name}` : 'Unknown'}
                          </p>
                          <Badge label={LOYALTY_TIER_LABELS[acc.tier]} className={LOYALTY_TIER_COLORS[acc.tier] + ' text-xs'} />
                        </div>
                        {guest?.email && <p className="text-xs text-subtext mt-0.5">{guest.email}</p>}
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-subtext">Lifetime: {acc.lifetime_points.toLocaleString()} pts</span>
                            {nextTier && <span className="text-xs text-subtext">Next: {LOYALTY_TIER_LABELS[nextTier]} at {nextThreshold?.toLocaleString()}</span>}
                          </div>
                          <div className="h-1.5 bg-light rounded-full overflow-hidden">
                            <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-gold">{acc.points_balance.toLocaleString()}</p>
                        <p className="text-xs text-subtext">available pts</p>
                        <button
                          className="mt-1 text-xs text-blue hover:underline"
                          onClick={() => { setSelectedAccount(acc); adjustForm.setValue('account_id', acc.id); setShowAdjustModal(true) }}
                        >
                          Adjust
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : activeTab === 'transactions' ? (
          transactions.length === 0 ? (
            <EmptyState icon={<Gift size={32} />} title="No transactions" description="Points transactions will appear here." />
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 rounded-xl bg-white shadow-sm ring-1 ring-mid px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm text-body">{tx.description}</p>
                    <p className="text-xs text-subtext">{LOYALTY_TRANSACTION_LABELS[tx.type]} · {new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`font-bold text-sm ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.points >= 0 ? '+' : ''}{tx.points} pts
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {TIER_ORDER.map((tier) => (
              <div key={tier} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge label={LOYALTY_TIER_LABELS[tier]} className={LOYALTY_TIER_COLORS[tier]} />
                      <span className="text-sm text-subtext">from {TIER_THRESHOLDS[tier].toLocaleString()} lifetime pts</span>
                    </div>
                    <p className="text-sm text-body mt-1">{TIER_DISCOUNTS[tier]}% discount on room rates</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-body">{accounts.filter((a) => a.tier === tier).length} members</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adjust Points Modal */}
      <Modal
        open={showAdjustModal}
        onClose={() => { setShowAdjustModal(false); setSelectedAccount(null); adjustForm.reset({ type: 'adjust' }) }}
        title="Adjust Loyalty Points"
        size="sm"
      >
        <form onSubmit={adjustForm.handleSubmit((d) => adjustPoints.mutate(d))} className="space-y-4">
          {!selectedAccount && (
            <Select
              label="Member"
              options={[{ value: '', label: 'Select member…' }, ...accountOptions]}
              error={adjustForm.formState.errors.account_id?.message}
              {...adjustForm.register('account_id')}
            />
          )}
          {selectedAccount && (
            <p className="text-sm text-subtext">
              Adjusting points for <strong>{(selectedAccount.guest as { first_name: string; last_name: string } | null)?.first_name}</strong> — Current balance: <strong>{selectedAccount.points_balance.toLocaleString()} pts</strong>
            </p>
          )}
          <Select
            label="Type"
            options={[
              { value: 'earn', label: 'Earn Points' },
              { value: 'redeem', label: 'Redeem Points' },
              { value: 'adjust', label: 'Manual Adjustment' },
              { value: 'expire', label: 'Expire Points' },
            ]}
            {...adjustForm.register('type')}
          />
          <Input
            label="Points"
            type="number"
            min={1}
            error={adjustForm.formState.errors.points?.message}
            {...adjustForm.register('points')}
          />
          <Input
            label="Description"
            placeholder="e.g. Stay bonus, Birthday reward…"
            error={adjustForm.formState.errors.description?.message}
            {...adjustForm.register('description')}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => setShowAdjustModal(false)}>Cancel</Button>
            <Button type="submit" loading={adjustPoints.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
