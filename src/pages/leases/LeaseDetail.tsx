import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  Link2,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useLease, useUpdateLease, useActivateLease } from '@/hooks/useLeases'
import type { LeaseWithDetails } from '@/hooks/useLeases'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import type { RentSchedule } from '@/types/database'
import toast from 'react-hot-toast'

// ─── Rent Schedule sub-query ─────────────────────────────────────────────────

function useRentSchedule(leaseId: string) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['rent-schedule', leaseId, tenant?.id],
    enabled: !!tenant && !!leaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rent_schedule')
        .select('*')
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .eq('lease_id', leaseId)
        .order('due_date', { ascending: true })
      if (error) throw error
      return data as RentSchedule[]
    },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  const display =
    typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : value ?? '—'
  return (
    <div className="flex justify-between py-2 border-b border-light last:border-0">
      <span className="text-sm text-subtext">{label}</span>
      <span className="text-sm font-medium text-body">{display}</span>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-800',
  expired: 'bg-amber-100 text-amber-800',
  terminated: 'bg-red-100 text-red-700',
  renewed: 'bg-blue-100 text-blue-800',
}

const SCHEDULE_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700',
  waived: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-gray-100 text-gray-400',
}

// ─── Component ───────────────────────────────────────────────────────────────

type Tab = 'details' | 'schedule' | 'documents'

export default function LeaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('details')
  const [terminateOpen, setTerminateOpen] = useState(false)
  const [terminateReason, setTerminateReason] = useState('')

  const { data: lease, isLoading } = useLease(id ?? '') as { data: LeaseWithDetails | undefined; isLoading: boolean }
  const activateLease = useActivateLease()
  const updateLease = useUpdateLease()
  const { data: schedule } = useRentSchedule(id ?? '')
  const [rentLinkLoading, setRentLinkLoading] = useState<string | null>(null)

  async function handleRentPaymentLink(scheduleId: string) {
    setRentLinkLoading(scheduleId)
    try {
      const token = (() => {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k?.startsWith('sb-') && k.endsWith('-auth-token')) {
            const raw = localStorage.getItem(k)
            return raw ? JSON.parse(raw)?.access_token : null
          }
        }
        return null
      })()
      const res = await fetch('/api/stripe?action=rent-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rentScheduleId: scheduleId }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to generate payment link')
      await navigator.clipboard.writeText(body.url)
      toast.success('Rent payment link copied! Send it to your tenant.')
    } catch (err: any) {
      toast.error(err.message ?? 'Could not create payment link')
    } finally {
      setRentLinkLoading(null)
    }
  }

  async function handleActivate() {
    if (!id) return
    await activateLease.mutateAsync(id)
  }

  async function handleTerminate() {
    if (!id) return
    await updateLease.mutateAsync({
      id,
      data: {
        status: 'terminated',
        terminated_at: new Date().toISOString(),
        termination_reason: terminateReason || null,
      },
    })
    setTerminateOpen(false)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    )
  }

  if (!lease) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-subtext">Lease not found.</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/leases')}>
              <ArrowLeft size={16} /> Back
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold font-mono text-body">
                  {lease.lease_reference}
                </h1>
                <Badge
                  label={lease.status.charAt(0).toUpperCase() + lease.status.slice(1)}
                  className={`text-sm px-3 py-1 ${STATUS_STYLES[lease.status] ?? 'bg-gray-100 text-gray-700'}`}
                />
              </div>
              <p className="text-lg font-semibold text-gold mt-0.5">
                {lease.monthly_rent.toLocaleString()} / month
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {lease.status === 'draft' && (
              <Button
                size="sm"
                onClick={handleActivate}
                loading={activateLease.isPending}
              >
                <CheckCircle size={15} /> Activate Lease
              </Button>
            )}
            {lease.status === 'active' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setTerminateOpen(true)}
              >
                <XCircle size={15} /> Terminate
              </Button>
            )}
          </div>
        </div>

        {/* Quick info cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-subtext mb-1">Unit</p>
            {lease.unit ? (
              <button
                className="text-sm font-semibold text-blue-600 hover:underline text-left"
                onClick={() => navigate(`/units/${lease.unit_id}`)}
              >
                Unit {lease.unit.unit_number}
                {lease.unit.property ? ` — ${lease.unit.property.name}` : ''}
              </button>
            ) : (
              <p className="text-sm font-semibold text-body font-mono">{lease.unit_id.slice(0, 8)}…</p>
            )}
          </Card>
          <Card>
            <p className="text-xs text-subtext mb-1">Renter</p>
            {lease.property_tenant ? (
              <button
                className="text-sm font-semibold text-blue-600 hover:underline text-left"
                onClick={() => navigate(`/renters/${lease.property_tenant_id}`)}
              >
                {lease.property_tenant.first_name} {lease.property_tenant.last_name}
              </button>
            ) : (
              <button
                className="text-sm font-semibold text-blue-600 hover:underline text-left"
                onClick={() => navigate(`/renters/${lease.property_tenant_id}`)}
              >
                View Renter
              </button>
            )}
          </Card>
          <Card>
            <p className="text-xs text-subtext mb-1">Deposit</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {lease.deposit_amount.toLocaleString()}
              </span>
              {lease.deposit_paid ? (
                <Badge label="Paid" className="bg-green-100 text-green-800" />
              ) : (
                <Badge label="Unpaid" className="bg-red-100 text-red-700" />
              )}
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-mid flex gap-6">
          {(['details', 'schedule', 'documents'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm font-medium capitalize transition-colors border-b-2 ${
                tab === t
                  ? 'border-gold text-body'
                  : 'border-transparent text-subtext hover:text-body'
              }`}
            >
              {t === 'schedule' ? 'Rent Schedule' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab: Details */}
        {tab === 'details' && (
          <div className="grid grid-cols-2 gap-5">
            <Card>
              <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
                <Calendar size={15} /> Lease Terms
              </h2>
              <InfoRow label="Type" value={lease.lease_type.replace('_', ' ')} />
              <InfoRow label="Start Date" value={formatDate(lease.start_date)} />
              <InfoRow
                label="End Date"
                value={lease.end_date ? formatDate(lease.end_date) : 'Rolling'}
              />
              <InfoRow label="Rent Frequency" value={lease.rent_frequency} />
              <InfoRow label="Payment Due Day" value={`Day ${lease.payment_due_day}`} />
              <InfoRow label="Notice Period" value={`${lease.notice_period_days} days`} />
              <InfoRow label="Utilities Included" value={lease.rent_includes_utilities} />
              <InfoRow label="Auto Renew" value={lease.auto_renew} />
              {lease.auto_renew && (
                <InfoRow label="Renewal Months" value={lease.auto_renew_months} />
              )}
            </Card>

            <Card>
              <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
                <DollarSign size={15} /> Deposit & Guarantor
              </h2>
              <InfoRow label="Deposit Amount" value={lease.deposit_amount.toLocaleString()} />
              <InfoRow label="Deposit Paid" value={lease.deposit_paid} />
              <InfoRow label="Deposit Returned" value={lease.deposit_returned} />
              {lease.deposit_return_date && (
                <InfoRow label="Return Date" value={formatDate(lease.deposit_return_date)} />
              )}
              {lease.deposit_deductions > 0 && (
                <InfoRow
                  label="Deductions"
                  value={lease.deposit_deductions.toLocaleString()}
                />
              )}
              <div className="mt-3 pt-3 border-t border-light">
                <p className="text-xs text-subtext font-medium mb-2">Guarantor</p>
                <InfoRow label="Name" value={lease.guarantor_name} />
                <InfoRow label="Phone" value={lease.guarantor_phone} />
                <InfoRow label="Email" value={lease.guarantor_email} />
              </div>
            </Card>

            {(lease.special_conditions || lease.internal_notes) && (
              <Card className="col-span-2">
                <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
                  <FileText size={15} /> Notes & Conditions
                </h2>
                {lease.special_conditions && (
                  <div className="mb-3">
                    <p className="text-xs text-subtext mb-1">Special Conditions</p>
                    <p className="text-sm text-body whitespace-pre-wrap">
                      {lease.special_conditions}
                    </p>
                  </div>
                )}
                {lease.internal_notes && (
                  <div>
                    <p className="text-xs text-subtext mb-1">Internal Notes</p>
                    <p className="text-sm text-body whitespace-pre-wrap">
                      {lease.internal_notes}
                    </p>
                  </div>
                )}
              </Card>
            )}

            {lease.termination_reason && (
              <Card className="col-span-2 border border-red-200 bg-red-50">
                <h2 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <AlertTriangle size={15} /> Termination
                </h2>
                {lease.terminated_at && (
                  <p className="text-xs text-subtext mb-1">
                    Terminated: {formatDate(lease.terminated_at)}
                  </p>
                )}
                <p className="text-sm text-red-800">{lease.termination_reason}</p>
              </Card>
            )}
          </div>
        )}

        {/* Tab: Rent Schedule */}
        {tab === 'schedule' && (
          <Card>
            {!schedule || schedule.length === 0 ? (
              <div className="text-center py-10">
                <Calendar size={36} className="mx-auto text-subtext mb-2" />
                <p className="text-sm text-subtext">
                  {lease.status === 'draft'
                    ? 'Activate the lease to generate the rent schedule.'
                    : 'No rent schedule entries found.'}
                </p>
                {lease.status === 'draft' && (
                  <Button
                    className="mt-4"
                    size="sm"
                    onClick={handleActivate}
                    loading={activateLease.isPending}
                  >
                    <CheckCircle size={15} /> Activate Lease
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mid">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-subtext">
                        Due Date
                      </th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-subtext">
                        Amount
                      </th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-subtext">
                        Paid
                      </th>
                      <th className="text-right py-2 pr-4 text-xs font-semibold text-subtext">
                        Balance
                      </th>
                      <th className="text-center py-2 pr-4 text-xs font-semibold text-subtext">
                        Status
                      </th>
                      <th className="py-2 text-xs font-semibold text-subtext" />
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-light hover:bg-light transition-colors"
                      >
                        <td className="py-2.5 pr-4 text-body">
                          {formatDate(row.due_date)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-medium">
                          {row.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-subtext">
                          {row.paid_amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-subtext">
                          {row.balance.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 text-center">
                          <Badge
                            label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                            className={
                              SCHEDULE_STATUS_STYLES[row.status] ?? 'bg-gray-100 text-gray-600'
                            }
                          />
                        </td>
                        <td className="py-2.5 text-right">
                          {row.status !== 'paid' && row.status !== 'waived' && row.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={rentLinkLoading === row.id}
                              onClick={() => handleRentPaymentLink(row.id)}
                              title="Generate Stripe payment link and copy to clipboard"
                            >
                              <Link2 size={13} />
                              <span className="hidden sm:inline">Pay Link</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Tab: Documents (placeholder) */}
        {tab === 'documents' && (
          <Card>
            <div className="text-center py-10">
              <FileText size={36} className="mx-auto text-subtext mb-2" />
              <p className="text-sm font-medium text-body">Documents</p>
              <p className="text-xs text-subtext mt-1">
                Document management coming soon.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Terminate Modal */}
      <Modal
        open={terminateOpen}
        onClose={() => setTerminateOpen(false)}
        title="Terminate Lease"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-body">
            Are you sure you want to terminate lease{' '}
            <strong>{lease.lease_reference}</strong>? This action cannot be undone.
          </p>
          <Input
            label="Reason for termination"
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder="Optional reason..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTerminateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleTerminate}
              loading={updateLease.isPending}
            >
              Terminate Lease
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
