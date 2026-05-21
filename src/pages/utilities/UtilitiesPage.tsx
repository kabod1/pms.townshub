import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Zap,
  Droplets,
  Flame,
  Wifi,
  Phone,
  Plus,
  X,
  ToggleRight,
  ToggleLeft,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useUnits } from '@/hooks/useProperties'
import type {
  UtilityAccount,
  UtilityBill,
  UtilityType,
  UtilityBillStatus,
  ChargedTo,
} from '@/types/database'

// ─── Utility icons ────────────────────────────────────────────────────────────

function UtilityIcon({ type }: { type: UtilityType }) {
  const icons: Partial<Record<UtilityType, React.ReactNode>> = {
    electricity: <Zap size={16} className="text-yellow-500" />,
    water: <Droplets size={16} className="text-blue-500" />,
    gas: <Flame size={16} className="text-orange-500" />,
    internet: <Wifi size={16} className="text-purple-500" />,
    telephone: <Phone size={16} className="text-gray-500" />,
  }
  return <>{icons[type] ?? <Zap size={16} className="text-gray-400" />}</>
}

// ─── Inline hooks ─────────────────────────────────────────────────────────────

function useUtilityAccounts() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['utility-accounts', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return []
      const { data, error } = await supabase
        .from('utility_accounts')
        .select('*, unit:units(unit_number)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
      if (error) {
        const { data: fb, error: fbErr } = await supabase
          .from('utility_accounts')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
        if (fbErr) throw fbErr
        return (fb ?? []) as UtilityAccount[]
      }
      return (data ?? []) as UtilityAccount[]
    },
  })
}

function useCreateUtilityAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<UtilityAccount>) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('utility_accounts')
        .insert({ ...input, tenant_id: tenant.id, is_active: true })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['utility-accounts'] }),
  })
}

function useUtilityBills() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['utility-bills', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return []
      const { data, error } = await supabase
        .from('utility_bills')
        .select('*, utility_account:utility_accounts(utility_type, provider, unit_id), unit:units(unit_number)')
        .eq('tenant_id', tenantId)
        .order('billing_period_end', { ascending: false })
      if (error) {
        const { data: fb, error: fbErr } = await supabase
          .from('utility_bills')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('billing_period_end', { ascending: false })
        if (fbErr) throw fbErr
        return (fb ?? []) as UtilityBill[]
      }
      return (data ?? []) as UtilityBill[]
    },
  })
}

function useCreateUtilityBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<UtilityBill>) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('utility_bills')
        .insert({ ...input, tenant_id: tenant.id, status: 'pending' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['utility-bills'] }),
  })
}

// ─── Bill status badge ────────────────────────────────────────────────────────

const BILL_STATUS_STYLES: Record<UtilityBillStatus, string> = {
  pending: 'bg-blue-100 text-blue-700',
  charged: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
}

// ─── Add Account Modal ────────────────────────────────────────────────────────

interface AccountFormValues {
  unit_id: string
  utility_type: UtilityType
  provider: string
  account_number: string
  meter_number: string
  billing_name: string
}

function AddAccountModal({ onClose }: { onClose: () => void }) {
  const { data: units = [] } = useUnits()
  const { mutate: create, isPending } = useCreateUtilityAccount()
  const { register, handleSubmit } = useForm<AccountFormValues>({
    defaultValues: { utility_type: 'electricity' },
  })

  const onSubmit = (values: AccountFormValues) => {
    create(
      {
        unit_id: values.unit_id || null,
        utility_type: values.utility_type,
        provider: values.provider || null,
        account_number: values.account_number || null,
        meter_number: values.meter_number || null,
        billing_name: values.billing_name || null,
        notes: null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mid px-6 py-4">
          <h2 className="text-base font-semibold text-body">Add Utility Account</h2>
          <button onClick={onClose} className="text-subtext hover:text-body"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-body">Unit</label>
            <select
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
              {...register('unit_id')}
            >
              <option value="">Select unit...</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-body">Utility Type</label>
            <select
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
              {...register('utility_type')}
            >
              <option value="electricity">Electricity</option>
              <option value="water">Water</option>
              <option value="gas">Gas</option>
              <option value="internet">Internet</option>
              <option value="telephone">Telephone</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input label="Provider" placeholder="e.g. EAC, CYTA..." {...register('provider')} />
          <Input label="Account Number" {...register('account_number')} />
          <Input label="Meter Number" {...register('meter_number')} />
          <Input label="Billing Name" {...register('billing_name')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>Cancel</Button>
            <Button type="submit" fullWidth loading={isPending}>Add Account</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Record Bill Modal ────────────────────────────────────────────────────────

interface BillFormValues {
  utility_account_id: string
  billing_period_start: string
  billing_period_end: string
  amount: string
  charged_to: ChargedTo
  lease_id: string
}

function RecordBillModal({ onClose }: { onClose: () => void }) {
  const { data: accounts = [] } = useUtilityAccounts()
  const { mutate: create, isPending } = useCreateUtilityBill()
  const { register, handleSubmit, formState: { errors } } = useForm<BillFormValues>({
    defaultValues: { charged_to: 'tenant' },
  })

  const onSubmit = (values: BillFormValues) => {
    create(
      {
        utility_account_id: values.utility_account_id || null,
        billing_period_start: values.billing_period_start,
        billing_period_end: values.billing_period_end,
        amount: Number(values.amount),
        charged_to: values.charged_to,
        lease_id: values.lease_id || null,
        unit_id: null,
        reading_start: null,
        reading_end: null,
        consumption: null,
        unit_cost: null,
        bill_document_url: null,
        notes: null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mid px-6 py-4">
          <h2 className="text-base font-semibold text-body">Record Utility Bill</h2>
          <button onClick={onClose} className="text-subtext hover:text-body"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-body">Utility Account</label>
            <select
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
              {...register('utility_account_id')}
            >
              <option value="">Select account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.utility_type} – {a.provider ?? 'Unknown'} ({a.account_number ?? 'N/A'})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Period Start"
              type="date"
              {...register('billing_period_start', { required: 'Required' })}
              error={errors.billing_period_start?.message}
            />
            <Input
              label="Period End"
              type="date"
              {...register('billing_period_end', { required: 'Required' })}
              error={errors.billing_period_end?.message}
            />
          </div>
          <Input
            label="Amount"
            type="number"
            step="0.01"
            {...register('amount', { required: 'Required' })}
            error={errors.amount?.message}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-body">Charged To</label>
            <select
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
              {...register('charged_to')}
            >
              <option value="tenant">Tenant</option>
              <option value="owner">Owner</option>
              <option value="agency">Agency</option>
            </select>
          </div>
          <Input label="Lease ID (optional)" placeholder="Leave blank if N/A" {...register('lease_id')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>Cancel</Button>
            <Button type="submit" fullWidth loading={isPending}>Record Bill</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'accounts' | 'bills'

export default function UtilitiesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('accounts')
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)

  const { data: accounts = [], isLoading: loadingAccounts } = useUtilityAccounts()
  const { data: bills = [], isLoading: loadingBills } = useUtilityBills()

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-body">Utilities</h1>
            <p className="mt-0.5 text-sm text-subtext">Manage utility accounts and bills</p>
          </div>
          {activeTab === 'accounts' ? (
            <Button onClick={() => setShowAccountModal(true)}>
              <Plus size={15} />
              Add Account
            </Button>
          ) : (
            <Button onClick={() => setShowBillModal(true)}>
              <Plus size={15} />
              Record Bill
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-mid bg-white p-1 w-fit shadow-sm">
          {(['accounts', 'bills'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-5 py-1.5 text-sm font-medium capitalize transition-colors ${
                activeTab === tab ? 'bg-navy text-white' : 'text-subtext hover:text-body'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <div className="overflow-x-auto rounded-xl border border-mid bg-white shadow-sm">
            {loadingAccounts ? (
              <div className="flex items-center justify-center py-20 text-sm text-subtext">Loading...</div>
            ) : accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-subtext">
                <Zap size={40} className="mb-3 opacity-30" />
                <p className="text-sm">No utility accounts yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Account #</th>
                    <th className="px-4 py-3">Meter #</th>
                    <th className="px-4 py-3">Billing Name</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mid">
                  {accounts.map((acc) => {
                    const unit = (acc as UtilityAccount & { unit?: { unit_number: string } }).unit
                    return (
                      <tr key={acc.id} className="hover:bg-light/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 capitalize">
                            <UtilityIcon type={acc.utility_type} />
                            <span className="text-body">{acc.utility_type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-body">{unit?.unit_number ?? '—'}</td>
                        <td className="px-4 py-3 text-body">{acc.provider ?? '—'}</td>
                        <td className="px-4 py-3 text-body font-mono text-xs">{acc.account_number ?? '—'}</td>
                        <td className="px-4 py-3 text-body font-mono text-xs">{acc.meter_number ?? '—'}</td>
                        <td className="px-4 py-3 text-body">{acc.billing_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          {acc.is_active ? (
                            <span className="flex items-center gap-1 text-xs text-green-700">
                              <ToggleRight size={14} /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-subtext">
                              <ToggleLeft size={14} /> Inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Bills Tab */}
        {activeTab === 'bills' && (
          <div className="overflow-x-auto rounded-xl border border-mid bg-white shadow-sm">
            {loadingBills ? (
              <div className="flex items-center justify-center py-20 text-sm text-subtext">Loading...</div>
            ) : bills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-subtext">
                <Zap size={40} className="mb-3 opacity-30" />
                <p className="text-sm">No utility bills recorded</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Billing Period</th>
                    <th className="px-4 py-3">Consumption</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Charged To</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mid">
                  {bills.map((bill) => {
                    const acc = (bill as UtilityBill & { utility_account?: { utility_type: UtilityType; provider?: string } }).utility_account
                    const unit = (bill as UtilityBill & { unit?: { unit_number: string } }).unit
                    return (
                      <tr key={bill.id} className="hover:bg-light/50 transition-colors">
                        <td className="px-4 py-3">
                          {acc ? (
                            <div className="flex items-center gap-2 capitalize">
                              <UtilityIcon type={acc.utility_type} />
                              <span className="text-body">{acc.utility_type}</span>
                            </div>
                          ) : <span className="text-subtext">—</span>}
                        </td>
                        <td className="px-4 py-3 text-body">{unit?.unit_number ?? '—'}</td>
                        <td className="px-4 py-3 text-body text-xs">
                          {new Date(bill.billing_period_start).toLocaleDateString()} – {new Date(bill.billing_period_end).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-body">
                          {bill.consumption != null ? `${bill.consumption} units` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-body">
                          ${bill.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 capitalize text-body">{bill.charged_to}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${BILL_STATUS_STYLES[bill.status]}`}>
                            {bill.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showAccountModal && <AddAccountModal onClose={() => setShowAccountModal(false)} />}
      {showBillModal && <RecordBillModal onClose={() => setShowBillModal(false)} />}
    </DashboardLayout>
  )
}
