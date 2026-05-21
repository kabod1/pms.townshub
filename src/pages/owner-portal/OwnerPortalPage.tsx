import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  UserCheck,
  Building2,
  DollarSign,
  FileText,
  Plus,
  X,
  Home,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useOwners } from '@/hooks/useProperties'
import type {
  Property,
  Unit,
  PropertyPayment,
  OwnerStatement,
  OwnerStatementStatus,
  UnitStatus,
} from '@/types/database'

// ─── Inline queries ────────────────────────────────────────────────────────────

function useOwnerProperties(ownerId: string | null) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['owner-properties', ownerId, tenant?.id],
    enabled: !!tenant && !!ownerId,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId || !ownerId) return []
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('owner_id', ownerId)
        .eq('is_active', true)
      if (error) throw error
      return (data ?? []) as Property[]
    },
  })
}

function useOwnerUnits(ownerId: string | null) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['owner-units', ownerId, tenant?.id],
    enabled: !!tenant && !!ownerId,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId || !ownerId) return []
      const { data, error } = await supabase
        .from('units')
        .select('*, property:properties(name)')
        .eq('tenant_id', tenantId)
        .eq('owner_id', ownerId)
        .eq('is_active', true)
      if (error) {
        const { data: fb, error: fbErr } = await supabase
          .from('units')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('owner_id', ownerId)
          .eq('is_active', true)
        if (fbErr) throw fbErr
        return (fb ?? []) as Unit[]
      }
      return (data ?? []) as Unit[]
    },
  })
}

function useOwnerRecentPayments(ownerId: string | null) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['owner-payments', ownerId, tenant?.id],
    enabled: !!tenant && !!ownerId,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId || !ownerId) return []

      // Get units owned by this owner first, then query payments
      const { data: unitData } = await supabase
        .from('units')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('owner_id', ownerId)

      const unitIds = (unitData ?? []).map((u) => u.id)
      if (unitIds.length === 0) return []

      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      const { data, error } = await supabase
        .from('property_payments')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('unit_id', unitIds)
        .gte('payment_date', threeMonthsAgo.toISOString().slice(0, 10))
        .order('payment_date', { ascending: false })

      if (error) throw error
      return (data ?? []) as PropertyPayment[]
    },
  })
}

function useOwnerStatements(ownerId: string | null) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['owner-statements', ownerId, tenant?.id],
    enabled: !!tenant && !!ownerId,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId || !ownerId) return []
      const { data, error } = await supabase
        .from('owner_statements')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('owner_id', ownerId)
        .order('period_start', { ascending: false })
      if (error) throw error
      return (data ?? []) as OwnerStatement[]
    },
  })
}

function useGenerateStatement(ownerId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      period_start,
      period_end,
    }: {
      period_start: string
      period_end: string
    }) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant || !ownerId) throw new Error('Not authenticated')

      // Get owner details for management fee rate
      const { data: ownerData } = await supabase
        .from('property_owners')
        .select('management_fee_rate, management_fee_type')
        .eq('id', ownerId)
        .eq('tenant_id', tenant.id)
        .single()

      // Get units owned by this owner
      const { data: unitData } = await supabase
        .from('units')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('owner_id', ownerId)

      const unitIds = (unitData ?? []).map((u) => u.id)

      // Sum payments for this period
      let totalRentCollected = 0
      if (unitIds.length > 0) {
        const { data: payments } = await supabase
          .from('property_payments')
          .select('amount')
          .eq('tenant_id', tenant.id)
          .in('unit_id', unitIds)
          .gte('payment_date', period_start)
          .lte('payment_date', period_end)
        totalRentCollected = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
      }

      // Calculate management fee
      let managementFee = 0
      if (ownerData) {
        if (ownerData.management_fee_type === 'percentage') {
          managementFee = (totalRentCollected * ownerData.management_fee_rate) / 100
        } else {
          managementFee = ownerData.management_fee_rate
        }
      }

      const netOwnerPayment = totalRentCollected - managementFee

      const { error } = await supabase.from('owner_statements').insert({
        tenant_id: tenant.id,
        owner_id: ownerId,
        period_start,
        period_end,
        total_rent_collected: totalRentCollected,
        management_fee: managementFee,
        maintenance_costs: 0,
        utility_costs: 0,
        other_deductions: 0,
        net_owner_payment: netOwnerPayment,
        status: 'draft' as OwnerStatementStatus,
        payment_date: null,
        payment_reference: null,
        notes: null,
        statement_document_url: null,
        line_items: [],
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-statements'] }),
  })
}

// ─── Statement status badge ────────────────────────────────────────────────────

const STMT_STATUS_STYLES: Record<OwnerStatementStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
}

// ─── Unit status colors ────────────────────────────────────────────────────────

const UNIT_STATUS_STYLES: Record<UnitStatus, string> = {
  vacant: 'bg-gray-100 text-gray-600',
  occupied: 'bg-green-100 text-green-700',
  reserved: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-700',
  not_available: 'bg-red-100 text-red-700',
}

// ─── Generate Statement Modal ─────────────────────────────────────────────────

interface StatementFormValues {
  period_start: string
  period_end: string
}

function GenerateStatementModal({
  ownerId,
  onClose,
}: {
  ownerId: string
  onClose: () => void
}) {
  const { mutate: generate, isPending } = useGenerateStatement(ownerId)
  const { register, handleSubmit, formState: { errors } } = useForm<StatementFormValues>()

  const onSubmit = (values: StatementFormValues) => {
    generate(values, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mid px-6 py-4">
          <h2 className="text-base font-semibold text-body">Generate Statement</h2>
          <button onClick={onClose} className="text-subtext hover:text-body">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <Input
            label="Period Start"
            type="date"
            {...register('period_start', { required: 'Required' })}
            error={errors.period_start?.message}
          />
          <Input
            label="Period End"
            type="date"
            {...register('period_end', { required: 'Required' })}
            error={errors.period_end?.message}
          />
          <p className="text-xs text-subtext">
            The statement will be created as a draft, calculating rent collected and management fees
            for this period.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth loading={isPending}>
              Generate
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OwnerPortalPage() {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('')
  const [showStatementModal, setShowStatementModal] = useState(false)

  const { data: owners = [] } = useOwners()
  const { data: properties = [] } = useOwnerProperties(selectedOwnerId || null)
  const { data: units = [] } = useOwnerUnits(selectedOwnerId || null)
  const { data: payments = [] } = useOwnerRecentPayments(selectedOwnerId || null)
  const { data: statements = [] } = useOwnerStatements(selectedOwnerId || null)

  const selectedOwner = owners.find((o) => o.id === selectedOwnerId)

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-body">Owner Portal</h1>
            <p className="mt-0.5 text-sm text-subtext">Internal view of owner portfolios and statements</p>
          </div>
        </div>

        {/* Owner selector */}
        <div className="flex items-center gap-3">
          <UserCheck size={18} className="text-subtext shrink-0" />
          <select
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            className="max-w-xs rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select an owner...</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.first_name} {o.last_name}
                {o.company_name ? ` (${o.company_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        {!selectedOwnerId ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-mid py-24 text-subtext">
            <UserCheck size={48} className="mb-4 opacity-30" />
            <p className="text-base font-medium">Select an owner to view their portal</p>
            <p className="mt-1 text-sm">Choose an owner from the dropdown above</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Owner info card */}
            {selectedOwner && (
              <div className="rounded-xl border border-mid bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-body">
                      {selectedOwner.first_name} {selectedOwner.last_name}
                    </h2>
                    {selectedOwner.company_name && (
                      <p className="text-sm text-subtext">{selectedOwner.company_name}</p>
                    )}
                    {selectedOwner.email && (
                      <p className="mt-1 text-sm text-subtext">{selectedOwner.email}</p>
                    )}
                  </div>
                  <div className="text-right text-sm text-subtext">
                    <p>Management Fee:</p>
                    <p className="font-semibold text-body">
                      {selectedOwner.management_fee_rate}
                      {selectedOwner.management_fee_type === 'percentage' ? '%' : ' (fixed)'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Properties */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-body">
                <Home size={16} />
                Properties ({properties.length})
              </h3>
              {properties.length === 0 ? (
                <p className="text-sm text-subtext">No properties found for this owner.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {properties.map((prop) => (
                    <div key={prop.id} className="rounded-xl border border-mid bg-white p-4 shadow-sm">
                      <p className="font-semibold text-body">{prop.name}</p>
                      <p className="text-xs text-subtext">{prop.address}, {prop.city}</p>
                      <p className="mt-1 text-xs text-subtext capitalize">{prop.type}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Units */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-body">
                <Building2 size={16} />
                Units ({units.length})
              </h3>
              {units.length === 0 ? (
                <p className="text-sm text-subtext">No units found for this owner.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-mid bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3">Property</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Market Rent</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mid">
                      {units.map((u) => {
                        const prop = (u as Unit & { property?: { name: string } }).property
                        return (
                          <tr key={u.id} className="hover:bg-light/50">
                            <td className="px-4 py-3 font-medium text-body">{u.unit_number}</td>
                            <td className="px-4 py-3 text-body">{prop?.name ?? '—'}</td>
                            <td className="px-4 py-3 capitalize text-body">{u.type}</td>
                            <td className="px-4 py-3 text-right text-body">{u.market_rent != null ? fmt(u.market_rent) : '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${UNIT_STATUS_STYLES[u.status]}`}>
                                {u.status.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Payments */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-body">
                <DollarSign size={16} />
                Recent Payments (Last 3 Months)
              </h3>
              {payments.length === 0 ? (
                <p className="text-sm text-subtext">No payments recorded in the last 3 months.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-mid bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mid">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-light/50">
                          <td className="px-4 py-3 text-body">{new Date(p.payment_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-700">{fmt(p.amount)}</td>
                          <td className="px-4 py-3 capitalize text-body">{p.method.replace('_', ' ')}</td>
                          <td className="px-4 py-3 text-subtext">{p.reference ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Statements */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-body">
                  <FileText size={16} />
                  Statement History ({statements.length})
                </h3>
                <Button size="sm" onClick={() => setShowStatementModal(true)}>
                  <Plus size={13} />
                  Generate Statement
                </Button>
              </div>
              {statements.length === 0 ? (
                <p className="text-sm text-subtext">No statements generated yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-mid bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                        <th className="px-4 py-3">Period</th>
                        <th className="px-4 py-3 text-right">Rent Collected</th>
                        <th className="px-4 py-3 text-right">Mgmt Fee</th>
                        <th className="px-4 py-3 text-right">Net Payment</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mid">
                      {statements.map((s) => (
                        <tr key={s.id} className="hover:bg-light/50">
                          <td className="px-4 py-3 text-body text-xs">
                            {new Date(s.period_start).toLocaleDateString()} – {new Date(s.period_end).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right text-body">{fmt(s.total_rent_collected)}</td>
                          <td className="px-4 py-3 text-right text-red-600">-{fmt(s.management_fee)}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(s.net_owner_payment)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STMT_STATUS_STYLES[s.status]}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showStatementModal && selectedOwnerId && (
        <GenerateStatementModal
          ownerId={selectedOwnerId}
          onClose={() => setShowStatementModal(false)}
        />
      )}
    </DashboardLayout>
  )
}
