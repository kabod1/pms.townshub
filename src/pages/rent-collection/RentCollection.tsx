import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import {
  DollarSign,
  AlertCircle,
  Clock,
  TrendingUp,
  Search,
  X,
  CreditCard,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  useRentSchedule,
  useRentSummary,
  useRecordPayment,
  usePropertyTenants,
} from '@/hooks/useRentCollection'
import { useUnits } from '@/hooks/useProperties'
import type { RentSchedule, RentScheduleStatus, PropertyPaymentMethod } from '@/types/database'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<RentScheduleStatus, string> = {
  pending: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
  waived: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function StatusBadge({ status }: { status: RentScheduleStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-xl border border-mid bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-subtext uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-body">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-subtext">{sub}</p>}
        </div>
        <span className={`rounded-lg p-2 ${color}`}>
          <Icon size={20} className="text-white" />
        </span>
      </div>
    </div>
  )
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

interface PaymentFormValues {
  amount: number
  method: PropertyPaymentMethod
  reference: string
  payment_date: string
  notes: string
}

function RecordPaymentModal({
  entry,
  tenantName,
  unitNumber,
  onClose,
}: {
  entry: RentSchedule
  tenantName: string
  unitNumber: string
  onClose: () => void
}) {
  const balance = entry.amount - entry.paid_amount
  const { register, handleSubmit, formState: { errors } } = useForm<PaymentFormValues>({
    defaultValues: {
      amount: balance > 0 ? balance : 0,
      method: 'bank_transfer',
      reference: '',
      payment_date: new Date().toISOString().slice(0, 10),
      notes: '',
    },
  })

  const { mutate: recordPayment, isPending } = useRecordPayment()

  const onSubmit = (values: PaymentFormValues) => {
    recordPayment(
      {
        rent_schedule_id: entry.id,
        lease_id: entry.lease_id,
        property_tenant_id: entry.property_tenant_id,
        unit_id: entry.unit_id,
        amount: Number(values.amount),
        current_paid_amount: entry.paid_amount,
        total_amount: entry.amount,
        method: values.method,
        reference: values.reference || undefined,
        payment_date: values.payment_date,
        notes: values.notes || undefined,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mid px-6 py-4">
          <h2 className="text-base font-semibold text-body">Record Payment</h2>
          <button onClick={onClose} className="text-subtext hover:text-body">
            <X size={18} />
          </button>
        </div>

        {/* Entry details */}
        <div className="bg-light px-6 py-3 text-sm text-body">
          <div className="flex items-center justify-between">
            <span className="font-medium">{tenantName}</span>
            <span className="text-subtext">Unit {unitNumber}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-subtext">
            <span>Amount Due: ${entry.amount.toLocaleString()}</span>
            <span>Balance: ${balance.toLocaleString()}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-body">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register('amount', { required: 'Amount is required', min: { value: 0.01, message: 'Must be greater than 0' } })}
            />
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-body">Payment Method</label>
            <select
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register('method')}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
              <option value="standing_order">Standing Order</option>
            </select>
          </div>

          <Input
            label="Reference"
            placeholder="Transaction reference..."
            {...register('reference')}
          />

          <Input
            label="Payment Date"
            type="date"
            {...register('payment_date', { required: 'Date is required' })}
            error={errors.payment_date?.message}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-body">Notes</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Optional notes..."
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth loading={isPending}>
              Record Payment
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RentCollection() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [paymentEntry, setPaymentEntry] = useState<RentSchedule | null>(null)

  const { data: schedule = [], isLoading } = useRentSchedule({
    month: selectedMonth,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })
  const { data: summary } = useRentSummary()
  const { data: propertyTenants = [] } = usePropertyTenants()
  const { data: units = [] } = useUnits()

  // Build lookup maps for enrichment
  const tenantMap = useMemo(
    () => Object.fromEntries(propertyTenants.map((t) => [t.id, `${t.first_name} ${t.last_name}`])),
    [propertyTenants],
  )
  const unitMap = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u.unit_number])),
    [units],
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return schedule
    const q = search.toLowerCase()
    return schedule.filter((entry) => {
      const name = tenantMap[entry.property_tenant_id ?? ''] ?? ''
      const unit = unitMap[entry.unit_id ?? ''] ?? ''
      return name.toLowerCase().includes(q) || unit.toLowerCase().includes(q)
    })
  }, [schedule, search, tenantMap, unitMap])

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-body">Rent Collection</h1>
            <p className="mt-0.5 text-sm text-subtext">Track and record rental payments</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="This Month's Rent Due"
            value={fmt(summary?.totalDueThisMonth ?? 0)}
            icon={DollarSign}
            color="bg-navy"
          />
          <StatCard
            label="Collected"
            value={fmt(summary?.totalCollectedThisMonth ?? 0)}
            sub={summary && summary.totalDueThisMonth > 0
              ? `${Math.round((summary.totalCollectedThisMonth / summary.totalDueThisMonth) * 100)}% of due`
              : undefined}
            icon={TrendingUp}
            color="bg-green-500"
          />
          <StatCard
            label="Overdue"
            value={fmt(summary?.totalOverdueAmount ?? 0)}
            sub={`${summary?.overdueCount ?? 0} entries`}
            icon={AlertCircle}
            color="bg-red-500"
          />
          <StatCard
            label="Upcoming (7 days)"
            value={fmt(summary?.upcomingAmount ?? 0)}
            sub={`${summary?.upcomingCount ?? 0} payments`}
            icon={Clock}
            color="bg-amber-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
            <option value="waived">Waived</option>
          </select>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtext" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search renter or unit..."
              className="rounded-lg border border-mid bg-white pl-9 pr-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-mid bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-sm text-subtext">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-subtext">
              <DollarSign size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No rent schedule entries found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Renter</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Overdue Days</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {filtered.map((entry) => {
                  const renterName = tenantMap[entry.property_tenant_id ?? ''] ?? '—'
                  const unitNum = unitMap[entry.unit_id ?? ''] ?? '—'
                  const balance = entry.amount - entry.paid_amount
                  return (
                    <tr key={entry.id} className="hover:bg-light/50 transition-colors">
                      <td className="px-4 py-3 text-body">{new Date(entry.due_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-body">{renterName}</td>
                      <td className="px-4 py-3 text-body">{unitNum}</td>
                      <td className="px-4 py-3 text-right text-body">{fmt(entry.amount)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{fmt(entry.paid_amount)}</td>
                      <td className="px-4 py-3 text-right font-medium text-body">{fmt(balance)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-4 py-3">
                        {entry.status === 'overdue' && entry.days_overdue > 0 ? (
                          <span className="text-xs font-medium text-red-600">{entry.days_overdue}d</span>
                        ) : (
                          <span className="text-subtext">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.status !== 'paid' && entry.status !== 'waived' && entry.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPaymentEntry(entry)}
                          >
                            <CreditCard size={13} />
                            Pay
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {paymentEntry && (
        <RecordPaymentModal
          entry={paymentEntry}
          tenantName={tenantMap[paymentEntry.property_tenant_id ?? ''] ?? 'Unknown Renter'}
          unitNumber={unitMap[paymentEntry.unit_id ?? ''] ?? '—'}
          onClose={() => setPaymentEntry(null)}
        />
      )}
    </DashboardLayout>
  )
}
