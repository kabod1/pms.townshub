import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, CheckCircle2, AlertCircle, Clock, ArrowUpRight,
  ExternalLink, RefreshCw, Loader2, DollarSign, TrendingUp,
  Banknote, Shield, Zap, ChevronRight,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

const NAVY = '#0F2138'
const GOLD = '#D4A843'

// ── helpers ───────────────────────────────────────────────────────────────────

function getToken(): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('sb-') && k.endsWith('-auth-token')) {
      const raw = localStorage.getItem(k)
      return raw ? JSON.parse(raw)?.access_token : null
    }
  }
  return null
}

async function callStripeApi(action: string, body?: object) {
  const res = await fetch(`/api/stripe?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `${action} failed`)
  return data
}

// ── types ─────────────────────────────────────────────────────────────────────

interface ConnectStatus {
  connected: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'restricted' | 'rejected'
  email?: string
}

interface Transaction {
  id: string
  type: string
  amount: number
  currency: string
  status: string
  description: string | null
  created_at: string
  booking_id: string | null
}

// ── component ─────────────────────────────────────────────────────────────────

export default function HotelPayments() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const onboardResult = params.get('onboard') // 'success' | 'refresh'

  // Show toast on return from Stripe onboarding
  useEffect(() => {
    if (onboardResult === 'success') {
      toast.success('Stripe onboarding complete! Syncing your account status…')
      syncStatus()
    } else if (onboardResult === 'refresh') {
      toast('Onboarding session expired — click Connect to restart.', { icon: '⚠️' })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connect status ────────────────────────────────────────────────────────
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<ConnectStatus>({
    queryKey: ['connect-status', tenant?.id],
    enabled: !!tenant,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await callStripeApi('connect-status')
      return data as ConnectStatus
    },
  })

  function syncStatus() {
    callStripeApi('connect-status')
      .then(() => qc.invalidateQueries({ queryKey: ['connect-status'] }))
      .catch(() => {})
  }

  // ── Transactions ──────────────────────────────────────────────────────────
  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ['stripe-transactions', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_transactions')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
  })

  // ── Earnings summary ──────────────────────────────────────────────────────
  const { data: earnings } = useQuery({
    queryKey: ['earnings-summary', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('hotel_earning,payout_status,payment_status')
        .eq('tenant_id', tenant!.id)
        .eq('payment_status', 'paid')
      if (error) throw error
      const rows = data ?? []
      return {
        total:     rows.reduce((s, r) => s + (r.hotel_earning ?? 0), 0),
        pending:   rows.filter((r) => r.payout_status === 'held').reduce((s, r) => s + (r.hotel_earning ?? 0), 0),
        released:  rows.filter((r) => r.payout_status === 'released' || r.payout_status === 'paid_out').reduce((s, r) => s + (r.hotel_earning ?? 0), 0),
      }
    },
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const [onboarding, setOnboarding] = useState(false)
  async function handleConnect() {
    setOnboarding(true)
    try {
      const { url } = await callStripeApi('connect-onboard')
      window.location.href = url
    } catch (err: any) {
      toast.error(err.message)
      setOnboarding(false)
    }
  }

  const [dashLoading, setDashLoading] = useState(false)
  async function handleManage() {
    setDashLoading(true)
    try {
      const { url } = await callStripeApi('connect-dashboard')
      window.open(url, '_blank', 'noopener')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDashLoading(false)
    }
  }

  // ── Bookings ready for payout release ─────────────────────────────────────
  const { data: readyBookings = [] } = useQuery({
    queryKey: ['ready-payouts', tenant?.id],
    enabled: !!tenant && status?.connected,
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select('id,booking_reference,check_out_date,hotel_earning,guest:guests(first_name,last_name)')
        .eq('tenant_id', tenant!.id)
        .eq('payment_status', 'paid')
        .eq('payout_status', 'held')
        .lte('check_out_date', new Date().toISOString().slice(0, 10))
        .order('check_out_date', { ascending: true })
      return data ?? []
    },
  })

  const releasePayout = useMutation({
    mutationFn: (bookingId: string) => callStripeApi('release-payout', { bookingId }),
    onSuccess: () => {
      toast.success('Payout released — hotel earnings transferred to Stripe account')
      qc.invalidateQueries({ queryKey: ['ready-payouts'] })
      qc.invalidateQueries({ queryKey: ['earnings-summary'] })
      qc.invalidateQueries({ queryKey: ['stripe-transactions'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (statusLoading) {
    return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>
  }

  const connected       = status?.connected ?? false
  const chargesEnabled  = status?.chargesEnabled ?? false
  const vs              = status?.verificationStatus ?? 'unverified'

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-body">Payments</h1>
          <button
            onClick={() => { refetchStatus(); syncStatus() }}
            className="flex items-center gap-1.5 text-xs text-subtext hover:text-body transition-colors"
          >
            <RefreshCw size={13} /> Refresh status
          </button>
        </div>

        {/* ── Connection status card ──────────────────────────────────────── */}
        <Card>
          <div className="flex items-start gap-4 flex-wrap">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: connected ? '#DCFCE7' : '#FEF3C7' }}
            >
              {connected
                ? <CheckCircle2 size={22} className="text-green-600" />
                : <AlertCircle size={22} className="text-amber-600" />
              }
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-base font-bold text-body">Stripe Connect</h2>
                <VerificationBadge status={vs} />
              </div>

              {connected ? (
                <div className="space-y-0.5">
                  <p className="text-sm text-subtext">
                    Your Stripe Express account is connected
                    {status?.email ? ` (${status.email})` : ''}.
                  </p>
                  <p className="text-xs text-subtext">
                    Payments: {chargesEnabled ? '✅ enabled' : '⏳ pending verification'} ·
                    Payouts: {status?.payoutsEnabled ? '✅ enabled' : '⏳ pending'}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-subtext mb-3">
                    Connect your Stripe account to accept guest payments and receive automatic payouts.
                    Stripe handles identity verification and banking — TownsHub never stores your bank details.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-3 mb-4">
                    {[
                      { icon: Shield, text: 'Stripe-hosted identity verification' },
                      { icon: Banknote, text: 'Direct bank deposits via Stripe' },
                      { icon: Zap, text: 'Automatic commission deduction' },
                    ].map((f) => (
                      <div key={f.text} className="flex items-start gap-2 text-xs text-subtext">
                        <f.icon size={14} className="shrink-0 mt-0.5 text-navy" />
                        {f.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap shrink-0">
              {connected ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={onboarding}
                    onClick={handleConnect}
                  >
                    Update Onboarding
                  </Button>
                  <Button
                    size="sm"
                    loading={dashLoading}
                    onClick={handleManage}
                  >
                    <ExternalLink size={14} /> Stripe Dashboard
                  </Button>
                </>
              ) : (
                <Button loading={onboarding} onClick={handleConnect}>
                  <CreditCard size={15} /> Connect Stripe Account
                </Button>
              )}
            </div>
          </div>

          {/* Onboarding steps for unconnected state */}
          {!connected && (
            <div className="mt-5 pt-5 border-t border-mid">
              <p className="text-xs font-semibold text-subtext uppercase tracking-wider mb-3">Stripe will collect</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  'Business name & type',
                  'Email address & phone',
                  'Bank account for payouts',
                  'Identity verification documents',
                  'Tax information (where required)',
                  'Hotel website or description',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-subtext">
                    <ChevronRight size={12} className="text-gold shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* ── Earnings summary ────────────────────────────────────────────── */}
        {connected && (
          <div className="grid grid-cols-3 gap-4">
            <EarningsCard
              label="Total Earned"
              amount={earnings?.total ?? 0}
              icon={TrendingUp}
              color="#10B981"
            />
            <EarningsCard
              label="Pending Release"
              amount={earnings?.pending ?? 0}
              icon={Clock}
              color={GOLD}
              note="Released after guest checkout"
            />
            <EarningsCard
              label="Released to Stripe"
              amount={earnings?.released ?? 0}
              icon={DollarSign}
              color={NAVY}
              note="Stripe will pay out automatically"
            />
          </div>
        )}

        {/* ── Ready for payout release ────────────────────────────────────── */}
        {connected && readyBookings.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">
              Ready to Release ({readyBookings.length})
            </h2>
            <p className="text-xs text-subtext mb-4">
              These guests have checked out. Release their earnings to your Stripe account.
            </p>
            <div className="space-y-2">
              {readyBookings.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-mid bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-body">
                      {b.guest?.first_name} {b.guest?.last_name}
                    </p>
                    <p className="text-xs text-subtext">{b.booking_reference} · Checked out {b.check_out_date}</p>
                  </div>
                  <p className="text-sm font-bold text-green-700 shrink-0">
                    {formatCurrency(b.hotel_earning ?? 0)}
                  </p>
                  <Button
                    size="sm"
                    loading={releasePayout.isPending}
                    onClick={() => releasePayout.mutate(b.id)}
                  >
                    Release
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Transaction history ─────────────────────────────────────────── */}
        {connected && (
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Transaction History</h2>
            {txLoading ? (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-10 text-subtext">
                <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No transactions yet. Payment links will appear here once guests pay.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mid text-xs font-semibold text-subtext uppercase">
                      <th className="text-left pb-2 pr-4">Type</th>
                      <th className="text-left pb-2 pr-4">Description</th>
                      <th className="text-right pb-2 pr-4">Amount</th>
                      <th className="text-center pb-2 pr-4">Status</th>
                      <th className="text-right pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-light hover:bg-light transition-colors">
                        <td className="py-2.5 pr-4">
                          <TypeBadge type={tx.type} />
                        </td>
                        <td className="py-2.5 pr-4 text-subtext max-w-xs truncate">
                          {tx.description ?? '—'}
                        </td>
                        <td className={`py-2.5 pr-4 text-right font-semibold ${
                          tx.type === 'commission' ? 'text-red-600' : 'text-green-700'
                        }`}>
                          {tx.type === 'commission' ? '-' : '+'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="py-2.5 pr-4 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            tx.status === 'succeeded' ? 'bg-green-50 text-green-700' :
                            tx.status === 'pending'   ? 'bg-amber-50 text-amber-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-subtext text-xs">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── Platform info (unconnected) ─────────────────────────────────── */}
        {!connected && (
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">How it works</h2>
            <div className="space-y-4">
              {[
                {
                  step: '1',
                  title: 'Connect your Stripe account',
                  desc: 'Click "Connect Stripe Account" above. Stripe guides you through business verification and banking setup.',
                },
                {
                  step: '2',
                  title: 'Guest pays through the platform',
                  desc: 'When you send a payment link from an invoice, guests pay through a secure Stripe-hosted checkout.',
                },
                {
                  step: '3',
                  title: 'Platform commission is deducted automatically',
                  desc: `TownsHub automatically deducts its platform commission. The remainder is allocated to your Stripe account.`,
                },
                {
                  step: '4',
                  title: 'Stripe pays you out automatically',
                  desc: 'After guest checkout, earnings are transferred to your Stripe account. Stripe then deposits directly to your bank.',
                },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: NAVY }}
                  >
                    {s.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-body">{s.title}</p>
                    <p className="text-xs text-subtext mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    verified:   { label: 'Verified',    className: 'bg-green-100 text-green-700' },
    pending:    { label: 'Pending',     className: 'bg-amber-100 text-amber-700' },
    restricted: { label: 'Restricted', className: 'bg-red-100 text-red-700' },
    rejected:   { label: 'Rejected',   className: 'bg-red-100 text-red-700' },
    unverified: { label: 'Not connected', className: 'bg-gray-100 text-gray-600' },
  }
  const s = map[status] ?? map.unverified
  return <Badge label={s.label} className={`text-xs px-2 py-0.5 ${s.className}`} />
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    payment:    'bg-blue-50 text-blue-700',
    commission: 'bg-red-50 text-red-700',
    transfer:   'bg-green-50 text-green-700',
    payout:     'bg-purple-50 text-purple-700',
    refund:     'bg-amber-50 text-amber-700',
    chargeback: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[type] ?? 'bg-gray-50 text-gray-600'}`}>
      {type}
    </span>
  )
}

function EarningsCard({
  label, amount, icon: Icon, color, note,
}: {
  label: string; amount: number; icon: any; color: string; note?: string
}) {
  return (
    <Card>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-subtext">{label}</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black" style={{ color }}>{formatCurrency(amount)}</p>
      {note && <p className="text-xs text-subtext mt-1">{note}</p>}
    </Card>
  )
}
