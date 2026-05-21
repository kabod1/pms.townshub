import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { useCreateOwner } from '@/hooks/useOwners'

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  company_name: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  id_type: z.enum(['passport', 'national_id', 'driving_licence', 'company_reg', 'other', '']).optional(),
  id_number: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  bank_name: z.string().optional(),
  bank_iban: z.string().optional(),
  bank_swift: z.string().optional(),
  tax_number: z.string().optional(),
  vat_number: z.string().optional(),
  management_fee_rate: z.coerce.number().min(0).max(100).default(10),
  management_fee_type: z.enum(['percentage', 'fixed']).default('percentage'),
  portal_access: z.boolean().default(false),
  portal_email: z.string().email('Invalid email').optional().or(z.literal('')),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const ID_TYPE_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_licence', label: 'Driving Licence' },
  { value: 'company_reg', label: 'Company Registration' },
  { value: 'other', label: 'Other' },
]

const FEE_TYPE_OPTIONS = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount' },
]

export default function NewOwner() {
  const navigate = useNavigate()
  const createOwner = useCreateOwner()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      management_fee_rate: 10,
      management_fee_type: 'percentage',
      portal_access: false,
    },
  })

  const portalAccess = watch('portal_access')

  async function onSubmit(formData: FormData) {
    await createOwner.mutateAsync({
      first_name: formData.first_name,
      last_name: formData.last_name,
      company_name: formData.company_name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      id_type: (formData.id_type as ('passport' | 'national_id' | 'driving_licence' | 'company_reg' | 'other' | null)) || null,
      id_number: formData.id_number || null,
      address: formData.address || null,
      city: formData.city || null,
      country: formData.country || null,
      bank_name: formData.bank_name || null,
      bank_iban: formData.bank_iban || null,
      bank_swift: formData.bank_swift || null,
      tax_number: formData.tax_number || null,
      vat_number: formData.vat_number || null,
      management_fee_rate: formData.management_fee_rate,
      management_fee_type: formData.management_fee_type,
      portal_access: formData.portal_access,
      portal_email: formData.portal_email || null,
      notes: formData.notes || null,
    })
    navigate('/owners')
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/owners')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <h1 className="text-xl font-bold text-body">Add New Owner</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Personal Info */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Personal Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name *"
                {...register('first_name')}
                error={errors.first_name?.message}
              />
              <Input
                label="Last Name *"
                {...register('last_name')}
                error={errors.last_name?.message}
              />
              <Input
                label="Company Name"
                {...register('company_name')}
                className="col-span-2"
              />
              <Input
                label="Email"
                type="email"
                {...register('email')}
                error={errors.email?.message}
              />
              <Input label="Phone" {...register('phone')} />
              <Select
                label="ID Type"
                options={ID_TYPE_OPTIONS}
                {...register('id_type')}
              />
              <Input label="ID Number" {...register('id_number')} />
            </div>
          </Card>

          {/* Address */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Address</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Street Address"
                className="col-span-2"
                {...register('address')}
              />
              <Input label="City" {...register('city')} />
              <Input label="Country" {...register('country')} />
            </div>
          </Card>

          {/* Banking */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Banking Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Bank Name" {...register('bank_name')} />
              <Input label="IBAN" {...register('bank_iban')} />
              <Input label="SWIFT / BIC" {...register('bank_swift')} />
              <Input label="Tax Number" {...register('tax_number')} />
              <Input label="VAT Number" {...register('vat_number')} />
            </div>
          </Card>

          {/* Management Fee */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Management Fee</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fee Rate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                {...register('management_fee_rate')}
                error={errors.management_fee_rate?.message}
              />
              <Select
                label="Fee Type"
                options={FEE_TYPE_OPTIONS}
                {...register('management_fee_type')}
              />
            </div>
          </Card>

          {/* Portal Access */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Owner Portal</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('portal_access')}
                  className="h-4 w-4 rounded border-mid text-gold focus:ring-gold"
                />
                <span className="text-sm text-body">Enable portal access</span>
              </label>
              {portalAccess && (
                <Input
                  label="Portal Login Email"
                  type="email"
                  {...register('portal_email')}
                  error={errors.portal_email?.message}
                  hint="Login email for the owner portal (can differ from contact email)"
                />
              )}
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Notes</h2>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Any internal notes about this owner..."
              className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold resize-none"
            />
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => navigate('/owners')}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createOwner.isPending}>
              Save Owner
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
