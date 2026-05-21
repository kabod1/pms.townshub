import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { useCreateLease, useActivateLease } from '@/hooks/useLeases'
import { useOwners } from '@/hooks/useOwners'
import { useRenters } from '@/hooks/useRenters'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Unit } from '@/types/database'

// ─── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  // Step 1
  unit_id: z.string().min(1, 'Select a unit'),
  property_tenant_id: z.string().min(1, 'Select a renter'),
  owner_id: z.string().optional(),
  // Step 2
  lease_type: z.enum(['fixed_term', 'rolling', 'periodic', 'commercial']),
  start_date: z.string().min(1, 'Required'),
  end_date: z.string().optional(),
  monthly_rent: z.coerce.number().min(0, 'Required'),
  rent_frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']),
  payment_due_day: z.coerce.number().min(1).max(31).default(1),
  notice_period_days: z.coerce.number().min(0).default(30),
  // Step 3
  deposit_amount: z.coerce.number().min(0).default(0),
  deposit_paid: z.boolean().default(false),
  rent_includes_utilities: z.boolean().default(false),
  guarantor_name: z.string().optional(),
  guarantor_phone: z.string().optional(),
  guarantor_email: z.string().email('Invalid email').optional().or(z.literal('')),
  special_conditions: z.string().optional(),
  internal_notes: z.string().optional(),
  auto_renew: z.boolean().default(false),
  auto_renew_months: z.coerce.number().min(1).default(12),
})

type FormData = z.infer<typeof schema>

// ─── Options ────────────────────────────────────────────────────────────────

const LEASE_TYPE_OPTIONS = [
  { value: 'fixed_term', label: 'Fixed Term' },
  { value: 'rolling', label: 'Rolling' },
  { value: 'periodic', label: 'Periodic' },
  { value: 'commercial', label: 'Commercial' },
]

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

const STEP_LABELS = ['Unit & Renter', 'Lease Terms', 'Deposit & Extras']

// ─── Hook for vacant units ────────────────────────────────────────────────────

function useVacantUnits() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['units-vacant', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, property_id, status, market_rent, property:properties(name)')
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .eq('status', 'vacant')
        .eq('is_active', true)
        .order('unit_number')
      if (error) throw error
      return (data ?? []) as unknown as (Unit & { property: { name: string } | null })[]
    },
    enabled: !!tenant,
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewLease() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [createdLeaseId, setCreatedLeaseId] = useState<string | null>(null)

  const createLease = useCreateLease()
  const activateLease = useActivateLease()

  const { data: vacantUnits } = useVacantUnits()
  const { data: renters } = useRenters()
  const { data: owners } = useOwners()

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      lease_type: 'fixed_term',
      rent_frequency: 'monthly',
      payment_due_day: 1,
      notice_period_days: 30,
      deposit_amount: 0,
      deposit_paid: false,
      rent_includes_utilities: false,
      auto_renew: false,
      auto_renew_months: 12,
    },
  })

  const autoRenew = watch('auto_renew')
  const leaseType = watch('lease_type')

  const unitOptions = [
    { value: '', label: '— Select Unit —' },
    ...(vacantUnits ?? []).map((u) => ({
      value: u.id,
      label: `${u.unit_number}${u.property ? ` — ${(u.property as { name: string }).name}` : ''}`,
    })),
  ]

  const renterOptions = [
    { value: '', label: '— Select Renter —' },
    ...(renters ?? []).map((r) => ({
      value: r.id,
      label: `${r.first_name} ${r.last_name}`,
    })),
  ]

  const ownerOptions = [
    { value: '', label: '— None —' },
    ...(owners ?? []).map((o) => ({
      value: o.id,
      label: `${o.first_name} ${o.last_name}`,
    })),
  ]

  const STEP_FIELDS: (keyof FormData)[][] = [
    ['unit_id', 'property_tenant_id'],
    ['lease_type', 'start_date', 'monthly_rent', 'rent_frequency', 'payment_due_day', 'notice_period_days'],
    [],
  ]

  async function goNext() {
    const valid = await trigger(STEP_FIELDS[step] as (keyof FormData)[])
    if (valid) setStep((s) => s + 1)
  }

  async function onSubmit(formData: FormData) {
    const result = await createLease.mutateAsync({
      unit_id: formData.unit_id,
      property_tenant_id: formData.property_tenant_id,
      owner_id: formData.owner_id || null,
      lease_type: formData.lease_type,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      monthly_rent: formData.monthly_rent,
      rent_frequency: formData.rent_frequency,
      payment_due_day: formData.payment_due_day,
      notice_period_days: formData.notice_period_days,
      deposit_amount: formData.deposit_amount,
      deposit_paid: formData.deposit_paid,
      rent_includes_utilities: formData.rent_includes_utilities,
      guarantor_name: formData.guarantor_name || null,
      guarantor_phone: formData.guarantor_phone || null,
      guarantor_email: formData.guarantor_email || null,
      special_conditions: formData.special_conditions || null,
      internal_notes: formData.internal_notes || null,
      auto_renew: formData.auto_renew,
      auto_renew_months: formData.auto_renew_months,
    })
    setCreatedLeaseId(result.id)
  }

  async function handleActivate() {
    if (!createdLeaseId) return
    await activateLease.mutateAsync(createdLeaseId)
    navigate(`/leases/${createdLeaseId}`)
  }

  // ─── Success screen ──────────────────────────────────────────────────────

  if (createdLeaseId) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto mt-16 text-center space-y-5">
          <CheckCircle size={56} className="mx-auto text-green-600" />
          <h2 className="text-xl font-bold text-body">Lease Created</h2>
          <p className="text-sm text-subtext">
            The lease has been saved as a draft. Activate it now to generate the rent schedule.
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/leases/${createdLeaseId}`)}
            >
              View Lease
            </Button>
            <Button
              onClick={handleActivate}
              loading={activateLease.isPending}
            >
              Activate Now
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // ─── Step indicator ───────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/leases')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <h1 className="text-xl font-bold text-body">New Lease</h1>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i <= step
                      ? 'bg-gold text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    i === step ? 'text-body' : 'text-subtext'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className="h-px w-8 bg-mid" />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* ── Step 1: Unit & Renter ── */}
          {step === 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-body mb-4">Unit & Renter</h2>
              <div className="space-y-4">
                <Select
                  label="Unit (vacant only) *"
                  options={unitOptions}
                  {...register('unit_id')}
                  error={errors.unit_id?.message}
                />
                <Select
                  label="Renter *"
                  options={renterOptions}
                  {...register('property_tenant_id')}
                  error={errors.property_tenant_id?.message}
                />
                <Select
                  label="Owner (optional)"
                  options={ownerOptions}
                  {...register('owner_id')}
                />
              </div>
            </Card>
          )}

          {/* ── Step 2: Lease Terms ── */}
          {step === 1 && (
            <Card>
              <h2 className="text-sm font-semibold text-body mb-4">Lease Terms</h2>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Lease Type"
                  options={LEASE_TYPE_OPTIONS}
                  {...register('lease_type')}
                  className="col-span-2"
                />
                <Input
                  label="Start Date *"
                  type="date"
                  {...register('start_date')}
                  error={errors.start_date?.message}
                />
                {leaseType !== 'rolling' && (
                  <Input
                    label="End Date"
                    type="date"
                    {...register('end_date')}
                  />
                )}
                <Input
                  label="Monthly Rent *"
                  type="number"
                  min={0}
                  step={0.01}
                  {...register('monthly_rent')}
                  error={errors.monthly_rent?.message}
                />
                <Select
                  label="Rent Frequency"
                  options={FREQUENCY_OPTIONS}
                  {...register('rent_frequency')}
                />
                <Input
                  label="Payment Due Day (1–31)"
                  type="number"
                  min={1}
                  max={31}
                  {...register('payment_due_day')}
                  error={errors.payment_due_day?.message}
                />
                <Input
                  label="Notice Period (days)"
                  type="number"
                  min={0}
                  {...register('notice_period_days')}
                />
              </div>
            </Card>
          )}

          {/* ── Step 3: Deposit & Extras ── */}
          {step === 2 && (
            <div className="space-y-4">
              <Card>
                <h2 className="text-sm font-semibold text-body mb-4">Deposit</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Deposit Amount"
                    type="number"
                    min={0}
                    step={0.01}
                    {...register('deposit_amount')}
                  />
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('deposit_paid')}
                        className="h-4 w-4 rounded border-mid text-gold focus:ring-gold"
                      />
                      <span className="text-sm text-body">Deposit already paid</span>
                    </label>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('rent_includes_utilities')}
                        className="h-4 w-4 rounded border-mid text-gold focus:ring-gold"
                      />
                      <span className="text-sm text-body">Rent includes utilities</span>
                    </label>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="text-sm font-semibold text-body mb-4">Guarantor</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Guarantor Name" {...register('guarantor_name')} />
                  <Input label="Guarantor Phone" {...register('guarantor_phone')} />
                  <Input
                    label="Guarantor Email"
                    type="email"
                    {...register('guarantor_email')}
                    error={errors.guarantor_email?.message}
                    className="col-span-2"
                  />
                </div>
              </Card>

              <Card>
                <h2 className="text-sm font-semibold text-body mb-4">Auto Renewal</h2>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('auto_renew')}
                      className="h-4 w-4 rounded border-mid text-gold focus:ring-gold"
                    />
                    <span className="text-sm text-body">Auto-renew lease</span>
                  </label>
                  {autoRenew && (
                    <Input
                      label="Renewal Period (months)"
                      type="number"
                      min={1}
                      {...register('auto_renew_months')}
                    />
                  )}
                </div>
              </Card>

              <Card>
                <h2 className="text-sm font-semibold text-body mb-3">Special Conditions</h2>
                <textarea
                  {...register('special_conditions')}
                  rows={3}
                  placeholder="Any special conditions..."
                  className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold resize-none mb-3"
                />
                <h2 className="text-sm font-semibold text-body mb-3">Internal Notes</h2>
                <textarea
                  {...register('internal_notes')}
                  rows={2}
                  placeholder="Internal notes (not visible to tenant)..."
                  className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold resize-none"
                />
              </Card>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => (step === 0 ? navigate('/leases') : setStep((s) => s - 1))}
            >
              <ChevronLeft size={16} />
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < 2 ? (
              <Button type="button" onClick={goNext}>
                Next <ChevronRight size={16} />
              </Button>
            ) : (
              <Button type="submit" loading={createLease.isPending}>
                Create Lease
              </Button>
            )}
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
