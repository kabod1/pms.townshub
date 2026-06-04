import { useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { CreditCard, ArrowRight, CheckCircle2, AlertCircle, Receipt } from 'lucide-react'
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

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
  { to: '/settings/channels', label: 'Channels' },
]

export default function HotelSettings() {
  const { tenant, setAuth, user } = useAuthStore()
  const connected    = !!(tenant as any)?.stripe_connected
  const verified     = (tenant as any)?.stripe_verification_status === 'verified'
  const vatRegistered= !!(tenant as any)?.vat_registered
  const customFee    = (tenant as any)?.platform_fee_pct

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
    if (error) { toast.error(error.message); return }
    setAuth(user!, updated)
    toast.success('Hotel settings saved')
  }

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
                <Input label="VAT Number" placeholder="CY12345678X" {...register('vat_number')} />
                <Input label="Company Registration Number" placeholder="HE 000000" {...register('registration_number')} />
              </div>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save Settings</Button>
            </div>
          </form>

          {/* ── Payments shortcut ─────────────────────────────────────── */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-navy/10 flex items-center justify-center shrink-0 mt-0.5">
                  <CreditCard size={16} className="text-navy" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-body">Payments & Payouts</h2>
                  <p className="text-xs text-subtext mt-0.5">
                    Connect your Stripe account to accept guest payments and receive automatic payouts.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {connected && verified && (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                        <CheckCircle2 size={12} /> Connected & verified
                      </span>
                    )}
                    {connected && !verified && (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                        <AlertCircle size={12} /> Connected — verification pending
                      </span>
                    )}
                    {!connected && (
                      <span className="flex items-center gap-1 text-xs font-medium text-subtext">
                        <AlertCircle size={12} /> Not connected — payments disabled
                      </span>
                    )}
                    {customFee != null && (
                      <span className="flex items-center gap-1 text-xs text-subtext border border-mid rounded-full px-2 py-0.5">
                        Custom fee: {customFee}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Link
                to="/payments"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy/90 transition-colors shrink-0"
              >
                Manage <ArrowRight size={13} />
              </Link>
            </div>
          </Card>

          {/* ── VAT registration ──────────────────────────────────────── */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Receipt size={16} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-body">VAT Registration (Cyprus)</h2>
                  <p className="text-xs text-subtext mt-0.5">
                    When enabled, TownsHub adds 19% Cyprus VAT to its platform management fee and issues a VAT invoice.
                    Your hotel's VAT number appears on all financial documents.
                  </p>
                  <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${vatRegistered ? 'text-amber-600' : 'text-subtext'}`}>
                    {vatRegistered
                      ? <><CheckCircle2 size={12} /> VAT-registered — 19% VAT applies to platform fees</>
                      : <><AlertCircle size={12} /> Not VAT-registered — contact admin to enable</>
                    }
                  </p>
                </div>
              </div>
              {vatRegistered && tenant?.vat_number && (
                <span className="text-xs font-mono bg-amber-50 text-amber-700 px-2 py-1 rounded-lg border border-amber-200 shrink-0">
                  VAT: {tenant.vat_number}
                </span>
              )}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
