import { useEffect } from 'react'
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
      </div>
      </div>
    </DashboardLayout>
  )
}
