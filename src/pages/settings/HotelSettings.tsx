import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Eye, EyeOff, ExternalLink, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  vat_number: z.string().optional(),
  registration_number: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function HotelSettings() {
  const { tenant, setAuth, user } = useAuthStore()

  // Stripe payment keys (separate sub-form)
  const [stripePk, setStripePk] = useState('')
  const [stripeSk, setStripeSk] = useState('')
  const [showSk, setShowSk] = useState(false)
  const [savingStripe, setSavingStripe] = useState(false)
  const stripeConfigured = !!(tenant as any)?.stripe_payment_pk

  useEffect(() => {
    if (tenant) {
      setStripePk((tenant as any).stripe_payment_pk ?? '')
      // Secret key is never sent to the frontend — just show a placeholder if set
    }
  }, [tenant])

  async function saveStripeKeys() {
    if (!tenant) return
    if (!stripePk.startsWith('pk_')) {
      toast.error('Publishable key must start with pk_live_ or pk_test_')
      return
    }
    if (stripeSk && !stripeSk.startsWith('sk_')) {
      toast.error('Secret key must start with sk_live_ or sk_test_')
      return
    }
    setSavingStripe(true)
    try {
      const updates: Record<string, string> = { stripe_payment_pk: stripePk }
      if (stripeSk) updates.stripe_payment_sk = stripeSk
      const { error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', tenant.id)
      if (error) throw error
      toast.success('Stripe payment keys saved')
      setStripeSk('')  // clear secret after saving
      // Refresh tenant in store
      const { data: updated } = await supabase
        .from('tenants').select('*').eq('id', tenant.id).single()
      if (updated) setAuth(user!, updated)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save Stripe keys')
    } finally {
      setSavingStripe(false)
    }
  }

  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (tenant) {
      reset({
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone ?? undefined,
        address: tenant.address ?? undefined,
        city: tenant.city ?? undefined,
        country: tenant.country ?? undefined,
        vat_number: tenant.vat_number ?? undefined,
        registration_number: tenant.registration_number ?? undefined,
      })
    }
  }, [tenant, reset])

  async function onSubmit(data: FormData) {
    const { data: updated, error } = await supabase
      .from('tenants')
      .update(data)
      .eq('id', tenant!.id)
      .select()
      .single()

    if (error) {
      toast.error(error.message)
      return
    }
    setAuth(user!, updated)
    toast.success('Hotel settings saved')
  }

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
  { to: '/settings/channels', label: 'Channels' },
]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-body">Settings</h1>

        <div className="flex gap-1 border-b border-mid overflow-x-auto">
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

      <div className="max-w-2xl space-y-5">

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Hotel Details</h2>
            <div className="space-y-3">
              <Input label="Hotel Name" error={errors.name?.message} {...register('name')} />
              <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
              <Input label="Phone" {...register('phone')} />
              <Input label="Address" {...register('address')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" {...register('city')} />
                <Input label="Country" {...register('country')} />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Tax & Legal</h2>
            <div className="space-y-3">
              <Input
                label="VAT Number"
                placeholder="CY12345678X"
                {...register('vat_number')}
              />
              <Input
                label="Company Registration Number"
                placeholder="HE 000000"
                {...register('registration_number')}
              />
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save Settings
            </Button>
          </div>
        </form>

        {/* ── Stripe Payment Keys ─────────────────────────────────────── */}
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-body">Online Payments (Stripe)</h2>
              <p className="text-xs text-subtext mt-0.5">
                Add your own Stripe API keys so guests and tenants can pay online.
                Money goes directly to your Stripe account.
              </p>
            </div>
            {stripeConfigured && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-700 shrink-0">
                <CheckCircle2 size={13} /> Connected
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-subtext mb-1">
                Publishable Key <span className="text-gray-400">(pk_live_... or pk_test_...)</span>
              </label>
              <Input
                placeholder="pk_live_..."
                value={stripePk}
                onChange={(e) => setStripePk(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-subtext mb-1">
                Secret Key <span className="text-gray-400">(sk_live_... or sk_test_...)</span>
                {stripeConfigured && !stripeSk && (
                  <span className="ml-2 text-green-600">— already saved, enter new value to update</span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showSk ? 'text' : 'password'}
                  placeholder={stripeConfigured ? '••••••••••••••••••••••' : 'sk_live_...'}
                  value={stripeSk}
                  onChange={(e) => setStripeSk(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowSk((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtext hover:text-body"
                >
                  {showSk ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                size="sm"
                onClick={saveStripeKeys}
                loading={savingStripe}
                disabled={!stripePk}
              >
                Save Payment Keys
              </Button>
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                Get keys from Stripe <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </Card>

      </div>
      </div>
    </DashboardLayout>
  )
}
