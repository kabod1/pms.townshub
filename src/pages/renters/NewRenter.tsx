import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, X } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { useCreateRenter } from '@/hooks/useRenters'

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  tenant_type: z.enum(['individual', 'company']).default('individual'),
  company_name: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  secondary_phone: z.string().optional(),
  id_type: z.enum(['passport', 'national_id', 'driving_licence', 'company_reg', 'other', '']).optional(),
  id_number: z.string().optional(),
  id_expiry: z.string().optional(),
  nationality: z.string().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  employer: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const TENANT_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
]

const ID_TYPE_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_licence', label: 'Driving Licence' },
  { value: 'company_reg', label: 'Company Registration' },
  { value: 'other', label: 'Other' },
]

export default function NewRenter() {
  const navigate = useNavigate()
  const createRenter = useCreateRenter()
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tenant_type: 'individual' },
  })

  const tenantType = watch('tenant_type')

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  async function onSubmit(formData: FormData) {
    await createRenter.mutateAsync({
      first_name: formData.first_name,
      last_name: formData.last_name,
      tenant_type: formData.tenant_type,
      company_name: formData.company_name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      secondary_phone: formData.secondary_phone || null,
      id_type: (formData.id_type as ('passport' | 'national_id' | 'driving_licence' | 'company_reg' | 'other' | null)) || null,
      id_number: formData.id_number || null,
      id_expiry: formData.id_expiry || null,
      nationality: formData.nationality || null,
      date_of_birth: formData.date_of_birth || null,
      address: formData.address || null,
      city: formData.city || null,
      country: formData.country || null,
      employer: formData.employer || null,
      emergency_contact_name: formData.emergency_contact_name || null,
      emergency_contact_phone: formData.emergency_contact_phone || null,
      notes: formData.notes || null,
      tags,
    })
    navigate('/renters')
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/renters')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <h1 className="text-xl font-bold text-body">Add New Renter</h1>
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
              <Select
                label="Renter Type"
                options={TENANT_TYPE_OPTIONS}
                {...register('tenant_type')}
              />
              {tenantType === 'company' && (
                <Input label="Company Name" {...register('company_name')} />
              )}
              <Input
                label="Email"
                type="email"
                {...register('email')}
                error={errors.email?.message}
              />
              <Input label="Phone" {...register('phone')} />
              <Input label="Secondary Phone" {...register('secondary_phone')} />
              <Input label="Nationality" {...register('nationality')} />
              <Input
                label="Date of Birth"
                type="date"
                {...register('date_of_birth')}
              />
              <Input label="Employer" {...register('employer')} />
            </div>
          </Card>

          {/* ID */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Identification</h2>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="ID Type"
                options={ID_TYPE_OPTIONS}
                {...register('id_type')}
              />
              <Input label="ID Number" {...register('id_number')} />
              <Input
                label="ID Expiry Date"
                type="date"
                {...register('id_expiry')}
              />
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

          {/* Emergency Contact */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Emergency Contact</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Contact Name"
                {...register('emergency_contact_name')}
              />
              <Input
                label="Contact Phone"
                {...register('emergency_contact_phone')}
              />
            </div>
          </Card>

          {/* Tags */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Tags</h2>
            <div className="flex gap-2 mb-3">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Add a tag and press Enter"
                className="flex-1 rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-1 focus:ring-gold"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-amber-600 hover:text-amber-900"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Notes</h2>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Any internal notes about this renter..."
              className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold resize-none"
            />
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => navigate('/renters')}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createRenter.isPending}>
              Save Renter
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
