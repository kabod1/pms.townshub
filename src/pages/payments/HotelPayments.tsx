import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, CheckCircle2, AlertCircle,
  ExternalLink, RefreshCw,
  Banknote, Shield, FileText,
  ArrowUpDown, AlertTriangle, Plus,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

// ── helpers ───────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function api(action: string, opts?: { method?: string; body?: object; query?: Record<string,string> }) {
  const token = await getToken()
  const qs    = new URLSearchParams({ action, ...(opts?.query ?? {}) }).toString()
  const res   = await fetch(`/api/stripe?${qs}`, {
    method:  opts?.method ?? (opts?.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `${action} failed`)
  return data
}

type Tab = 'overview' | 'ledger' | 'payouts' | 'rent' | 'deposits'

// ── component ─────────────────────────────────────────────────────────────────

export default function HotelPayments() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>('overview')
  const onboardResult = params.get('onboard')

  useEffect(() => {
    if (onboardResult === 'success') {
      toast.success('Stripe onboarding complete — syncing account…')
      api('connect-status', { method: 'POST' })
        .then(() => qc.invalidateQueries({ queryKey: ['connect-status'] }))
        .catch(() => {})
    } else if (onboardResult === 'refresh') {
      toast('Onboarding session expired — click Connect to restart.', { icon: '⚠️' })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connect status ────────────────────────────────────────────────────────
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['connect-status', tenant?.id],
    enabled: !!tenant,
    staleTime: 60_000,
    queryFn: () => api('connect-status', { method: 'POST' }),
  })

  // ── Current month payout preview ──────────────────────────────────────────
  const period = new Date().toISOString().slice(0, 7)
  const { data: preview } = useQuery({
    queryKey: ['payout-preview', tenant?.id, period],
    enabled: !!tenant && !!status?.connected,
    queryFn: () => api('payout-preview', { query: { period } }),
  })

  // ── Ledger entries ────────────────────────────────────────────────────────
  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['ledger', tenant?.id, period],
    enabled: !!tenant && tab === 'ledger',
    queryFn: () => api('ledger', { query: { period, limit: '50' } }),
  })

  // ── Payout history ────────────────────────────────────────────────────────
  const { data: payoutHistory, isLoading: payoutsLoading } = useQuery({
    queryKey: ['payout-history', tenant?.id],
    enabled: !!tenant && tab === 'payouts',
    queryFn: () => api('payout-history'),
  })

  // ── Rent invoices ─────────────────────────────────────────────────────────
  const { data: rentInvoices = [], isLoading: rentLoading } = useQuery({
    queryKey: ['rent-invoices', tenant?.id],
    enabled: !!tenant && tab === 'rent',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rent_invoices')
        .select('*, lease:leases(property_tenant:property_tenants(first_name, last_name))')
        .eq('tenant_id', tenant!.id)
        .order('due_date', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  // ── Deposits ──────────────────────────────────────────────────────────────
  const { data: deposits = [], isLoading: depositsLoading } = useQuery({
    queryKey: ['deposits', tenant?.id],
    enabled: !!tenant && tab === 'deposits',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leases')
        .select('id,lease_reference,deposit_amount,deposit_status,deposit_trust_ref,deposit_refund_amount,deposit_damage_amount,property_tenant:property_tenants(first_name, last_name), unit:units(unit_number)')
        .eq('tenant_id', tenant!.id)
        .not('deposit_status', 'eq', 'none')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  // ── Ready bookings for payout ─────────────────────────────────────────────
  const { data: readyBookings = [] } = useQuery({
    queryKey: ['ready-payouts', tenant?.id],
    enabled: !!tenant && !!status?.connected,
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select('id,booking_reference,check_out_date,total_amount,guest:guests(first_name,last_name)')
        .eq('tenant_id', tenant!.id)
        .eq('payment_status', 'paid')
        .eq('payout_status', 'held')
        .lte('check_out_date', new Date().toISOString().slice(0, 10))
        .order('check_out_date', { ascending: true })
      return data ?? []
    },
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const [onboarding, setOnboarding] = useState(false)
  async function handleConnect() {
    setOnboarding(true)
    try {
      const { url } = await api('connect-onboard', { method: 'POST' })
      window.location.href = url
    } catch (err: any) { toast.error(err.message); setOnboarding(false) }
  }

  const [dashLoading, setDashLoading] = useState(false)
  async function handleManage() {
    setDashLoading(true)
    try {
      const { url } = await api('connect-dashboard', { method: 'POST' })
      window.open(url, '_blank', 'noopener')
    } catch (err: any) { toast.error(err.message) } finally { setDashLoading(false) }
  }

  const releasePayout = useMutation({
    mutationFn: (bookingId: string) => api('release-payout', { method: 'POST', body: { bookingId } }),
    onSuccess: (data) => {
      toast.success(`Payout released — Net: ${formatCurrency(data.netPayout)} (Gross: ${formatCurrency(data.gross)} − Exp: ${formatCurrency(data.totalExpenses)} − Fee: ${formatCurrency(data.platformFee)}${data.vatOnFee > 0 ? ` − VAT: ${formatCurrency(data.vatOnFee)}` : ''})`)
      qc.invalidateQueries({ queryKey: ['ready-payouts'] })
      qc.invalidateQueries({ queryKey: ['payout-preview'] })
      qc.invalidateQueries({ queryKey: ['payout-history'] })
      qc.invalidateQueries({ queryKey: ['ledger'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const [generatingInvoices, setGeneratingInvoices] = useState(false)
  async function handleGenerateInvoices() {
    setGeneratingInvoices(true)
    try {
      const data = await api('generate-rent-invoices', { method: 'POST', body: { period } })
      toast.success(data.message ?? `${data.created} rent invoices created for ${period}`)
      qc.invalidateQueries({ queryKey: ['rent-invoices'] })
    } catch (e: any) { toast.error(e.message) } finally { setGeneratingInvoices(false) }
  }

  // ── Deposit modal ─────────────────────────────────────────────────────────
  const [depositModal, setDepositModal] = useState<{ leaseId: string; depositAmount: number; action: string } | null>(null)
  const [depositNotes, setDepositNotes] = useState('')
  const [depositPartialAmt, setDepositPartialAmt] = useState('')

  const depositAction = useMutation({
    mutationFn: () => api('deposit-action', { method: 'POST', body: {
      leaseId: depositModal!.leaseId,
      action: depositModal!.action,
      amount: depositPartialAmt || undefined,
      notes: depositNotes || undefined,
    }}),
    onSuccess: (data) => {
      toast.success(`Deposit ${data.status}`)
      setDepositModal(null); setDepositNotes(''); setDepositPartialAmt('')
      qc.invalidateQueries({ queryKey: ['deposits'] })
      qc.invalidateQueries({ queryKey: ['ledger'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (statusLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>

  const connected      = status?.connected      ?? false
  const chargesEnabled = status?.chargesEnabled ?? false
  const vs             = status?.verificationStatus ?? 'unverified'

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'ledger',   label: 'Ledger' },
    { id: 'payouts',  label: 'Payout History' },
    { id: 'rent',     label: 'Rent Invoices' },
    { id: 'deposits', label: 'Deposits' },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-body">Payments</h1>
          <button
            onClick={() => api('connect-status', { method: 'POST' }).then(() => qc.invalidateQueries({ queryKey: ['connect-status'] }))}
            className="flex items-center gap-1.5 text-xs text-subtext hover:text-body transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* ── Connect status card ──────────────────────────────────────────── */}
        <Card>
          <div className="flex items-start gap-4 flex-wrap">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${connected ? 'bg-green-50' : 'bg-amber-50'}`}>
              {connected ? <CheckCircle2 size={22} className="text-green-600" /> : <AlertCircle size={22} className="text-amber-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-base font-bold text-body">Stripe Connect</h2>
                <VerificationBadge status={vs} />
              </div>
              {connected ? (
                <p className="text-sm text-subtext">
                  Connected{status?.email ? ` (${status.email})` : ''} ·
                  Payments {chargesEnabled ? '✅ enabled' : '⏳ pending'} ·
                  Payouts {status?.payoutsEnabled ? '✅ enabled' : '⏳ pending'} ·
                  <span className="font-medium text-body"> Fee: {(tenant as any)?.platform_fee_pct != null ? `${(tenant as any).platform_fee_pct}% (custom)` : 'platform default'}</span>
                  {(tenant as any)?.vat_registered && <span className="text-amber-600 ml-1">· VAT registered</span>}
                </p>
              ) : (
                <p className="text-sm text-subtext mb-3">
                  Connect your Stripe account to accept guest payments and receive automatic payouts.
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              {connected ? (
                <>
                  <Button size="sm" variant="outline" loading={onboarding} onClick={handleConnect}>Update</Button>
                  <Button size="sm" loading={dashLoading} onClick={handleManage}>
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
        </Card>

        {/* ── Payout preview (current month) ──────────────────────────────── */}
        {connected && preview && (
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">
              Payout Preview — {period}
              <span className="ml-2 text-xs font-normal text-subtext">({preview.bookingCount ?? 0} bookings ready)</span>
            </h2>
            <div className="grid sm:grid-cols-5 gap-3">
              {[
                { label: 'Gross Revenue',   value: preview.gross,         color: 'text-green-600', note: `${preview.bookingCount ?? 0} bookings` },
                { label: 'Expenses',        value: -preview.totalExpenses, color: 'text-red-500',   note: `${preview.expenseCount ?? 0} items` },
                { label: `Fee (${preview.feePct}%)`, value: -preview.platformFee, color: 'text-orange-500', note: preview.vatRegistered ? `+${formatCurrency(preview.vatOnFee)} VAT` : undefined },
                { label: 'VAT on Fee',      value: -preview.vatOnFee,     color: 'text-amber-600', note: preview.vatRegistered ? '19% (CY)' : 'N/A' },
                { label: 'Net Payout',      value: preview.netPayout,     color: 'text-navy',      note: 'after all deductions', highlight: true },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl p-3 ${s.highlight ? 'bg-navy text-white' : 'bg-gray-50'}`}>
                  <p className={`text-xs mb-1 ${s.highlight ? 'text-white/60' : 'text-subtext'}`}>{s.label}</p>
                  <p className={`text-xl font-black ${s.highlight ? 'text-white' : s.color}`}>
                    {s.value < 0 ? `−${formatCurrency(Math.abs(s.value))}` : formatCurrency(s.value)}
                  </p>
                  {s.note && <p className={`text-xs mt-0.5 ${s.highlight ? 'text-white/50' : 'text-subtext'}`}>{s.note}</p>}
                </div>
              ))}
            </div>
            {preview.vatRegistered && (
              <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                <AlertTriangle size={12} /> VAT-registered account — TownsHub will issue a separate VAT invoice for the management fee.
              </p>
            )}
          </Card>
        )}

        {/* ── Ready for payout release ──────────────────────────────────────── */}
        {connected && readyBookings.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">
              Ready to Release ({readyBookings.length})
            </h2>
            <p className="text-xs text-subtext mb-4">
              Guests have checked out. Release their earnings — payout = gross − expenses − platform fee.
            </p>
            <div className="space-y-2">
              {readyBookings.map((b: any) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-mid bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-body">{b.guest?.first_name} {b.guest?.last_name}</p>
                    <p className="text-xs text-subtext">{b.booking_reference} · Checked out {b.check_out_date}</p>
                  </div>
                  <p className="text-sm font-bold text-body shrink-0">{formatCurrency(b.total_amount)}</p>
                  <Button size="sm" loading={releasePayout.isPending} onClick={() => releasePayout.mutate(b.id)}>
                    Release
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        {connected && (
          <>
            <div className="flex gap-1 border-b border-mid overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.id ? 'border-gold text-body' : 'border-transparent text-subtext hover:text-body'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Overview tab ─────────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="text-center py-8 text-subtext">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500" />
                <p className="text-sm">Your payment infrastructure is active.</p>
                <p className="text-xs mt-1">Switch to Ledger, Payout History, Rent Invoices or Deposits for details.</p>
              </div>
            )}

            {/* ── Ledger tab ───────────────────────────────────────────────── */}
            {tab === 'ledger' && (
              <Card>
                <h2 className="text-sm font-semibold text-body mb-4">Ledger — {period}</h2>
                {ledgerLoading ? <LoadingSpinner /> : (
                  <LedgerTable entries={ledgerData?.entries ?? []} />
                )}
              </Card>
            )}

            {/* ── Payout history ───────────────────────────────────────────── */}
            {tab === 'payouts' && (
              <Card>
                <h2 className="text-sm font-semibold text-body mb-4">Payout History</h2>
                {payoutsLoading ? <LoadingSpinner /> : (
                  <PayoutHistoryTable payouts={payoutHistory?.payouts ?? []} />
                )}
              </Card>
            )}

            {/* ── Rent invoices ─────────────────────────────────────────────── */}
            {tab === 'rent' && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-body">Rent Invoices</h2>
                  <Button size="sm" loading={generatingInvoices} onClick={handleGenerateInvoices}>
                    <Plus size={14} /> Generate {period}
                  </Button>
                </div>
                {rentLoading ? <LoadingSpinner /> : (
                  <RentInvoicesTable invoices={rentInvoices} />
                )}
              </Card>
            )}

            {/* ── Deposits ──────────────────────────────────────────────────── */}
            {tab === 'deposits' && (
              <Card>
                <h2 className="text-sm font-semibold text-body mb-4">Security Deposits (Trust Account)</h2>
                <p className="text-xs text-subtext mb-4 flex items-center gap-1.5">
                  <Shield size={12} className="text-blue-600" />
                  Per Cyprus law, deposits are tracked separately and never co-mingled with operating funds.
                </p>
                {depositsLoading ? <LoadingSpinner /> : (
                  <DepositsTable deposits={deposits} onAction={(leaseId, action, depositAmount) => {
                    setDepositModal({ leaseId, action, depositAmount })
                  }} />
                )}
              </Card>
            )}
          </>
        )}

        {/* ── Not connected state ─────────────────────────────────────────── */}
        {!connected && (
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">How payments work</h2>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Connect Stripe', desc: 'Click "Connect Stripe Account". Stripe handles KYC, banking setup and identity verification.' },
                { step: '2', title: 'Correct payout formula', desc: 'Net payout = gross booking revenue − approved maintenance expenses − platform fee (± VAT if VAT-registered).' },
                { step: '3', title: 'Full audit trail', desc: 'Every payment, expense, fee and payout is recorded in the double-entry ledger — defensible to any accountant.' },
                { step: '4', title: 'Deposits in trust', desc: 'Security deposits are tracked separately per Cyprus law and never mixed with operating funds.' },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-white text-xs font-bold shrink-0">{s.step}</div>
                  <div><p className="text-sm font-semibold text-body">{s.title}</p><p className="text-xs text-subtext mt-0.5">{s.desc}</p></div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ── Deposit action modal ──────────────────────────────────────────── */}
      {depositModal && (
        <Modal
          open={!!depositModal}
          onClose={() => { setDepositModal(null); setDepositNotes(''); setDepositPartialAmt('') }}
          title={`Deposit — ${depositModal.action.replace('_', ' ')}`}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-subtext">Deposit amount: <strong>{formatCurrency(depositModal.depositAmount)}</strong></p>
            {depositModal.action === 'refund_partial' && (
              <Input
                label="Refund amount (€)"
                type="number"
                value={depositPartialAmt}
                onChange={(e) => setDepositPartialAmt(e.target.value)}
                placeholder={String(depositModal.depositAmount)}
              />
            )}
            <div>
              <label className="block text-xs font-medium text-subtext mb-1">Notes (optional)</label>
              <textarea
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
                placeholder="Damage description, reason for deduction…"
                rows={3}
                className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDepositModal(null)}>Cancel</Button>
              <Button
                loading={depositAction.isPending}
                variant={depositModal.action === 'forfeit' ? 'danger' : 'primary'}
                onClick={() => depositAction.mutate()}
              >
                Confirm
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    verified:   { label: 'Verified',      className: 'bg-green-100 text-green-700' },
    pending:    { label: 'Pending',       className: 'bg-amber-100 text-amber-700' },
    restricted: { label: 'Restricted',   className: 'bg-red-100 text-red-700' },
    rejected:   { label: 'Rejected',     className: 'bg-red-100 text-red-700' },
    unverified: { label: 'Not connected', className: 'bg-gray-100 text-gray-600' },
  }
  const s = map[status] ?? map.unverified
  return <Badge label={s.label} className={`text-xs px-2 py-0.5 ${s.className}`} />
}

function LedgerTable({ entries }: { entries: any[] }) {
  if (entries.length === 0) return (
    <div className="text-center py-8 text-subtext">
      <ArrowUpDown size={28} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">No ledger entries yet for this period.</p>
    </div>
  )
  const typeColors: Record<string, string> = {
    booking_income: 'bg-green-50 text-green-700', rent_income: 'bg-green-50 text-green-700',
    expense: 'bg-red-50 text-red-600', platform_fee: 'bg-orange-50 text-orange-600',
    vat_on_fee: 'bg-amber-50 text-amber-600', payout: 'bg-blue-50 text-blue-700',
    deposit_in: 'bg-purple-50 text-purple-700', deposit_out: 'bg-purple-50 text-purple-500',
    deposit_forfeited: 'bg-gray-100 text-gray-600', refund: 'bg-red-50 text-red-500',
    chargeback: 'bg-red-100 text-red-800',
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mid text-xs font-semibold text-subtext uppercase">
            <th className="text-left pb-2 pr-3">Type</th>
            <th className="text-left pb-2 pr-3">Description</th>
            <th className="text-right pb-2 pr-3">Debit</th>
            <th className="text-right pb-2 pr-3">Credit</th>
            <th className="text-right pb-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e: any) => (
            <tr key={e.id} className="border-b border-light hover:bg-light transition-colors">
              <td className="py-2.5 pr-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[e.entry_type] ?? 'bg-gray-50 text-gray-600'}`}>
                  {e.entry_type.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-subtext text-xs max-w-xs truncate">{e.description ?? '—'}</td>
              <td className="py-2.5 pr-3 text-right text-xs text-red-600 font-medium">
                {e.debit > 0 ? formatCurrency(e.debit) : '—'}
              </td>
              <td className="py-2.5 pr-3 text-right text-xs text-green-600 font-medium">
                {e.credit > 0 ? formatCurrency(e.credit) : '—'}
              </td>
              <td className="py-2.5 text-right text-xs text-subtext">
                {new Date(e.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PayoutHistoryTable({ payouts }: { payouts: any[] }) {
  if (payouts.length === 0) return (
    <div className="text-center py-8 text-subtext">
      <Banknote size={28} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">No payouts yet.</p>
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mid text-xs font-semibold text-subtext uppercase">
            <th className="text-left pb-2 pr-3">Period</th>
            <th className="text-right pb-2 pr-3">Gross</th>
            <th className="text-right pb-2 pr-3">Expenses</th>
            <th className="text-right pb-2 pr-3">Fee</th>
            <th className="text-right pb-2 pr-3">VAT</th>
            <th className="text-right pb-2 pr-3">Net Payout</th>
            <th className="text-center pb-2 pr-3">Status</th>
            <th className="text-right pb-2">Paid</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p: any) => (
            <tr key={p.id} className="border-b border-light hover:bg-light transition-colors">
              <td className="py-2.5 pr-3 text-body text-xs">{p.period_start?.slice(0,7)}</td>
              <td className="py-2.5 pr-3 text-right text-xs">{formatCurrency(p.gross_income)}</td>
              <td className="py-2.5 pr-3 text-right text-xs text-red-500">{formatCurrency(p.total_expenses)}</td>
              <td className="py-2.5 pr-3 text-right text-xs text-orange-500">{formatCurrency(p.platform_fee)}</td>
              <td className="py-2.5 pr-3 text-right text-xs text-amber-500">{p.vat_on_fee > 0 ? formatCurrency(p.vat_on_fee) : '—'}</td>
              <td className="py-2.5 pr-3 text-right font-bold text-navy">{formatCurrency(p.net_payout)}</td>
              <td className="py-2.5 pr-3 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.status === 'paid' ? 'bg-green-100 text-green-700' :
                  p.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                  p.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{p.status}</span>
              </td>
              <td className="py-2.5 text-right text-xs text-subtext">
                {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RentInvoicesTable({ invoices }: { invoices: any[] }) {
  if (invoices.length === 0) return (
    <div className="text-center py-8 text-subtext">
      <FileText size={28} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">No rent invoices. Click "Generate" to create invoices for active leases.</p>
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mid text-xs font-semibold text-subtext uppercase">
            <th className="text-left pb-2 pr-3">Invoice #</th>
            <th className="text-left pb-2 pr-3">Tenant</th>
            <th className="text-right pb-2 pr-3">Period</th>
            <th className="text-right pb-2 pr-3">Amount</th>
            <th className="text-center pb-2 pr-3">Status</th>
            <th className="text-right pb-2">Due</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv: any) => {
            const renter = inv.lease?.property_tenant
            return (
              <tr key={inv.id} className="border-b border-light hover:bg-light transition-colors">
                <td className="py-2.5 pr-3 text-xs font-mono text-subtext">{inv.invoice_number ?? '—'}</td>
                <td className="py-2.5 pr-3 text-sm text-body">{renter ? `${renter.first_name} ${renter.last_name}` : '—'}</td>
                <td className="py-2.5 pr-3 text-right text-xs text-subtext">{inv.period_start?.slice(0,7)}</td>
                <td className="py-2.5 pr-3 text-right font-semibold">{formatCurrency(inv.total_due ?? inv.amount)}</td>
                <td className="py-2.5 pr-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    inv.status === 'paid'    ? 'bg-green-100 text-green-700' :
                    inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                    inv.status === 'waived'  ? 'bg-gray-100 text-gray-500' :
                    'bg-amber-50 text-amber-700'
                  }`}>{inv.status}</span>
                </td>
                <td className="py-2.5 text-right text-xs text-subtext">{formatDate(inv.due_date)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DepositsTable({ deposits, onAction }: { deposits: any[]; onAction: (leaseId: string, action: string, amount: number) => void }) {
  if (deposits.length === 0) return (
    <div className="text-center py-8 text-subtext">
      <Shield size={28} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">No deposits recorded. Use "Deposit received" on a lease to begin trust tracking.</p>
    </div>
  )
  const statusStyle: Record<string, string> = {
    held: 'bg-blue-100 text-blue-700',
    refunded: 'bg-green-100 text-green-700',
    partially_refunded: 'bg-amber-100 text-amber-700',
    forfeited: 'bg-gray-100 text-gray-500',
  }
  return (
    <div className="space-y-2">
      {deposits.map((d: any) => (
        <div key={d.id} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-mid bg-white flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-body">
              {d.property_tenant?.first_name} {d.property_tenant?.last_name}
              <span className="ml-2 text-xs text-subtext">· Unit {d.unit?.unit_number} · {d.lease_reference}</span>
            </p>
            <p className="text-xs text-subtext mt-0.5">
              Deposit: {formatCurrency(d.deposit_amount)}
              {d.deposit_refund_amount != null && ` · Refunded: ${formatCurrency(d.deposit_refund_amount)}`}
              {d.deposit_damage_amount > 0 && ` · Damages: ${formatCurrency(d.deposit_damage_amount)}`}
              {d.deposit_trust_ref && ` · Ref: ${d.deposit_trust_ref}`}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[d.deposit_status] ?? 'bg-gray-50 text-gray-600'}`}>
            {d.deposit_status.replace('_', ' ')}
          </span>
          {d.deposit_status === 'held' && (
            <div className="flex gap-1">
              <button onClick={() => onAction(d.id, 'refund_full', d.deposit_amount)} className="text-xs px-2 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors">Full refund</button>
              <button onClick={() => onAction(d.id, 'refund_partial', d.deposit_amount)} className="text-xs px-2 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors">Partial</button>
              <button onClick={() => onAction(d.id, 'forfeit', d.deposit_amount)} className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors">Forfeit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
