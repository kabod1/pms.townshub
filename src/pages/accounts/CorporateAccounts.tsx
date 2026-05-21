import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Building2, Pencil, CreditCard } from 'lucide-react'
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
import { formatCurrency } from '@/lib/utils'
import { CORPORATE_ACCOUNT_STATUS_LABELS } from '@/lib/constants'
import toast from 'react-hot-toast'
import type { CorporateAccount, CorporateAccountStatus } from '@/types'

const schema = z.object({
  company_name: z.string().min(1, 'Company name required'),
  contact_name: z.string().min(1, 'Contact name required'),
  contact_email: z.string().email('Valid email required'),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  vat_number: z.string().optional(),
  credit_limit: z.coerce.number().min(0),
  discount_percentage: z.coerce.number().min(0).max(100),
  payment_terms_days: z.coerce.number().min(0),
  status: z.string().min(1),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUS_OPTIONS = (['active', 'suspended', 'inactive'] as CorporateAccountStatus[]).map((s) => ({
  value: s,
  label: CORPORATE_ACCOUNT_STATUS_LABELS[s],
}))

const STATUS_COLORS: Record<CorporateAccountStatus, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-amber-100 text-amber-800',
  inactive: 'bg-gray-100 text-gray-600',
}

function useAccounts() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['corporate-accounts', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corporate_accounts')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('company_name')
      if (error) throw error
      return data as CorporateAccount[]
    },
    enabled: !!tenant,
  })
}

export default function CorporateAccounts() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CorporateAccount | null>(null)

  const { data: accounts = [], isLoading } = useAccounts()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active', credit_limit: 5000, discount_percentage: 0, payment_terms_days: 30 },
  })

  const save = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = { ...data, tenant_id: tenant!.id, current_balance: editing?.current_balance ?? 0 }
      if (editing) {
        await supabase.from('corporate_accounts').update(data).eq('id', editing.id)
      } else {
        await supabase.from('corporate_accounts').insert(payload)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corporate-accounts'] })
      toast.success(editing ? 'Account updated' : 'Account created')
      setShowModal(false)
      setEditing(null)
      form.reset({ status: 'active', credit_limit: 5000, discount_percentage: 0, payment_terms_days: 30 })
    },
    onError: () => toast.error('Failed to save account'),
  })

  function openEdit(acc: CorporateAccount) {
    setEditing(acc)
    form.reset({
      company_name: acc.company_name,
      contact_name: acc.contact_name,
      contact_email: acc.contact_email,
      contact_phone: acc.contact_phone ?? '',
      address: acc.address ?? '',
      vat_number: acc.vat_number ?? '',
      credit_limit: acc.credit_limit,
      discount_percentage: acc.discount_percentage,
      payment_terms_days: acc.payment_terms_days,
      status: acc.status,
      notes: acc.notes ?? '',
    })
    setShowModal(true)
  }

  const totalCredit = accounts.reduce((s, a) => s + a.credit_limit, 0)
  const totalOutstanding = accounts.reduce((s, a) => s + a.current_balance, 0)
  const activeCount = accounts.filter((a) => a.status === 'active').length

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">Corporate Accounts</h1>
            <p className="text-sm text-subtext">Manage corporate clients with direct billing and credit terms</p>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); form.reset({ status: 'active', credit_limit: 5000, discount_percentage: 0, payment_terms_days: 30 }); setShowModal(true) }}>
            <Plus size={15} /> New Account
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Active Accounts" value={activeCount} icon={<Building2 size={20} />} color="navy" />
          <StatCard title="Total Credit Limit" value={formatCurrency(totalCredit, tenant?.currency)} icon={<CreditCard size={20} />} color="gold" />
          <StatCard title="Outstanding Balance" value={formatCurrency(totalOutstanding, tenant?.currency)} icon={<CreditCard size={20} />} color={totalOutstanding > 0 ? 'blue' : 'green'} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : accounts.length === 0 ? (
          <EmptyState icon={<Building2 size={32} />} title="No corporate accounts" description="Create accounts for companies with direct billing arrangements." />
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => {
              const utilisation = acc.credit_limit > 0 ? Math.min(100, Math.round((acc.current_balance / acc.credit_limit) * 100)) : 0
              return (
                <div key={acc.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-body">{acc.company_name}</p>
                        <Badge label={CORPORATE_ACCOUNT_STATUS_LABELS[acc.status]} className={STATUS_COLORS[acc.status] + ' text-xs'} />
                        {acc.discount_percentage > 0 && (
                          <Badge label={`${acc.discount_percentage}% discount`} className="bg-purple-100 text-purple-700 text-xs" />
                        )}
                      </div>
                      <p className="text-sm text-subtext mt-0.5">{acc.contact_name} · {acc.contact_email}</p>
                      {acc.vat_number && <p className="text-xs text-subtext">VAT: {acc.vat_number}</p>}
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1 text-xs text-subtext">
                          <span>Credit used: {formatCurrency(acc.current_balance, tenant?.currency)} / {formatCurrency(acc.credit_limit, tenant?.currency)}</span>
                          <span>{utilisation}%</span>
                        </div>
                        <div className="h-1.5 bg-light rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${utilisation > 90 ? 'bg-red-500' : utilisation > 70 ? 'bg-amber-400' : 'bg-green-500'}`}
                            style={{ width: `${utilisation}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-subtext">Net {acc.payment_terms_days} days</p>
                      <button onClick={() => openEdit(acc)} className="mt-2 flex items-center gap-1 text-xs text-blue hover:underline">
                        <Pencil size={11} /> Edit
                      </button>
                    </div>
                  </div>
                  {acc.notes && <p className="mt-2 text-xs text-subtext italic border-t border-mid pt-2">{acc.notes}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Account Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null) }}
        title={editing ? 'Edit Corporate Account' : 'New Corporate Account'}
      >
        <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Company Name" error={form.formState.errors.company_name?.message} {...form.register('company_name')} />
            </div>
            <Input label="Contact Name" error={form.formState.errors.contact_name?.message} {...form.register('contact_name')} />
            <Input label="Contact Email" type="email" error={form.formState.errors.contact_email?.message} {...form.register('contact_email')} />
            <Input label="Phone" {...form.register('contact_phone')} />
            <Input label="VAT Number" {...form.register('vat_number')} />
            <div className="col-span-2">
              <Input label="Address" {...form.register('address')} />
            </div>
            <Input label={`Credit Limit (${tenant?.currency ?? 'EUR'})`} type="number" min={0} {...form.register('credit_limit')} />
            <Input label="Discount (%)" type="number" min={0} max={100} {...form.register('discount_percentage')} />
            <Input label="Payment Terms (days)" type="number" min={0} {...form.register('payment_terms_days')} />
            <Select label="Status" options={STATUS_OPTIONS} {...form.register('status')} />
            <div className="col-span-2">
              <Input label="Notes" {...form.register('notes')} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
